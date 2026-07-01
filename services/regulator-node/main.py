"""
MOST — Regulator Node v2 («Золотая нода»)
==========================================
Read-only надзорный узел.  Регулятор видит всё, что скрыто от Chainalysis:
полный граф маршрута, каждого агента, tx_hash, from/to адреса.

Auth:  X-API-Key заголовок == REGULATOR_API_KEY из ENV
Порт:  8003
"""
import os
from datetime import datetime, timezone
from typing import Optional

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
DATABASE_URL = os.environ.get("DATABASE_URL", "").replace(
    "postgresql://", "postgresql+asyncpg://"
)
REGULATOR_API_KEY = os.environ.get("REGULATOR_API_KEY", "")

# ---------------------------------------------------------------------------
# DB — read-only async engine
# ---------------------------------------------------------------------------
engine = create_async_engine(DATABASE_URL, pool_size=5, max_overflow=0, echo=False)
SessionLocal = async_sessionmaker(engine, expire_on_commit=False)


async def get_db():
    async with SessionLocal() as s:
        yield s


# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------
app = FastAPI(
    title="MOST Regulator Node",
    version="2.0.0",
    docs_url="/regulator/docs",
    redoc_url=None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET", "OPTIONS"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------
async def require_regulator(request: Request):
    key = (
        request.headers.get("X-API-Key")
        or request.headers.get("X-Regulator-Key")
        or request.query_params.get("api_key")
        or ""
    )
    if not REGULATOR_API_KEY:
        raise HTTPException(503, "REGULATOR_API_KEY не настроен на сервере")
    if key != REGULATOR_API_KEY:
        raise HTTPException(403, "Доступ запрещён. Предъявите действующий X-API-Key регулятора")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _iso(dt) -> Optional[str]:
    if dt is None:
        return None
    return dt.isoformat() if hasattr(dt, "isoformat") else str(dt)


def _paginate(total: int, limit: int, offset: int) -> dict:
    pages = max(1, (total + limit - 1) // limit)
    return {"total": total, "limit": limit, "offset": offset,
            "page": offset // limit + 1, "pages": pages}


# ---------------------------------------------------------------------------
# /health  — без авторизации
# ---------------------------------------------------------------------------
@app.get("/health")
async def health():
    return {"status": "ok", "service": "regulator-node", "version": "2.0.0"}


# ---------------------------------------------------------------------------
# GET /api/v1/regulator/dashboard
# ---------------------------------------------------------------------------
@app.get(
    "/api/v1/regulator/dashboard",
    dependencies=[Depends(require_regulator)],
    summary="Сводная панель регулятора",
)
async def dashboard(db: AsyncSession = Depends(get_db)):
    """
    Агрегированные KPI платформы.
    Данные обновляются в реальном времени.
    """
    orders_q = await db.execute(text("""
        SELECT
            COUNT(*)                                        AS total_orders,
            COUNT(*) FILTER (WHERE status = 'processing')  AS active_orders,
            COUNT(*) FILTER (WHERE status = 'completed')   AS completed_orders,
            COUNT(*) FILTER (WHERE status = 'rejected')    AS rejected_orders,
            COUNT(*) FILTER (WHERE status = 'aml_pending') AS pending_orders,
            COALESCE(SUM(amount), 0)                        AS total_volume,
            COALESCE(AVG(amount), 0)                        AS avg_amount,
            COALESCE(AVG(risk_score), 0)                    AS avg_risk_score,
            COUNT(*) FILTER (WHERE risk_score >= 80)        AS high_risk_orders
        FROM payment_orders
    """))
    o = orders_q.mappings().first()

    agents_q = await db.execute(text("""
        SELECT
            COUNT(*)                                        AS total_agents,
            COUNT(*) FILTER (WHERE status = 'completed')   AS completed_agents,
            COUNT(*) FILTER (WHERE status = 'active')      AS active_agents,
            COUNT(*) FILTER (WHERE status = 'dead')        AS dead_agents,
            COUNT(DISTINCT network)                         AS networks_used
        FROM swarm_agents
    """))
    a = agents_q.mappings().first()

    users_q = await db.execute(text("SELECT COUNT(*) AS total FROM users"))
    u = users_q.mappings().first()

    routes_q = await db.execute(text("""
        SELECT COUNT(*) AS total,
               COUNT(*) FILTER (WHERE status = 'active') AS active
        FROM swarm_routes
    """))
    r = routes_q.mappings().first()

    success_rate = (
        round(a["completed_agents"] / a["total_agents"] * 100, 2)
        if a["total_agents"] else 0.0
    )

    return {
        "generated_at":      datetime.now(timezone.utc).isoformat(),
        "total_orders":      o["total_orders"],
        "active_orders":     o["active_orders"],
        "completed_orders":  o["completed_orders"],
        "rejected_orders":   o["rejected_orders"],
        "pending_orders":    o["pending_orders"],
        "high_risk_orders":  o["high_risk_orders"],
        "total_volume":      float(o["total_volume"]),
        "avg_amount":        float(o["avg_amount"]),
        "avg_risk_score":    float(o["avg_risk_score"]),
        "total_agents":      a["total_agents"],
        "completed_agents":  a["completed_agents"],
        "active_agents":     a["active_agents"],
        "dead_agents":       a["dead_agents"],
        "networks_used":     a["networks_used"],
        "agent_success_rate": success_rate,
        "total_users":       u["total"],
        "total_routes":      r["total"],
        "active_routes":     r["active"],
    }


# ---------------------------------------------------------------------------
# GET /api/v1/regulator/orders
# ---------------------------------------------------------------------------
@app.get(
    "/api/v1/regulator/orders",
    dependencies=[Depends(require_regulator)],
    summary="Список всех платёжных поручений",
)
async def orders(
    db: AsyncSession = Depends(get_db),
    limit:      int           = 50,
    offset:     int           = 0,
    status:     Optional[str] = None,
    min_risk:   Optional[int] = None,
    country:    Optional[str] = None,
    date_from:  Optional[str] = None,
    date_to:    Optional[str] = None,
):
    """
    Полный реестр поручений со всеми полями включая ИНН, адрес получателя,
    риск-скор, кто одобрил.  Регулятор видит то, что недоступно Chainalysis.
    """
    conds = ["1=1"]
    params: dict = {}

    if status:
        conds.append("po.status = :status")
        params["status"] = status
    if min_risk is not None:
        conds.append("po.risk_score >= :min_risk")
        params["min_risk"] = min_risk
    if country:
        conds.append("po.destination_country = :country")
        params["country"] = country.upper()
    if date_from:
        conds.append("po.created_at >= :date_from")
        params["date_from"] = date_from
    if date_to:
        conds.append("po.created_at <= :date_to")
        params["date_to"] = date_to

    where = " AND ".join(conds)

    total = (await db.execute(
        text(f"SELECT COUNT(*) FROM payment_orders po WHERE {where}"), params
    )).scalar_one()

    rows = (await db.execute(
        text(f"""
            SELECT
                po.id,
                po.user_id,
                u.email           AS user_email,
                u.company_name,
                u.inn,
                po.from_currency,
                po.to_currency,
                po.amount,
                po.destination_country,
                po.destination_address,
                po.status,
                po.risk_score,
                po.reject_reason,
                po.approved_at,
                apr.email         AS approved_by_email,
                po.created_at,
                po.updated_at,
                (SELECT COUNT(*) FROM swarm_agents sa
                 JOIN swarm_routes sr ON sr.id = sa.route_id
                 WHERE sr.order_id = po.id)  AS total_agents,
                (SELECT COUNT(*) FROM swarm_agents sa
                 JOIN swarm_routes sr ON sr.id = sa.route_id
                 WHERE sr.order_id = po.id AND sa.status = 'completed')
                                              AS completed_agents
            FROM payment_orders po
            LEFT JOIN users u   ON u.id   = po.user_id
            LEFT JOIN users apr ON apr.id = po.approved_by
            WHERE {where}
            ORDER BY po.created_at DESC
            LIMIT :limit OFFSET :offset
        """),
        {**params, "limit": limit, "offset": offset},
    )).mappings().all()

    return {
        "meta": _paginate(total, limit, offset),
        "items": [
            {
                "id":                   str(r["id"]),
                "user_email":           r["user_email"],
                "company_name":         r["company_name"],
                "inn":                  r["inn"],
                "from_currency":        r["from_currency"],
                "to_currency":          r["to_currency"],
                "amount":               float(r["amount"]),
                "destination_country":  r["destination_country"],
                "destination_address":  r["destination_address"],
                "status":               r["status"],
                "risk_score":           r["risk_score"],
                "reject_reason":        r["reject_reason"],
                "approved_by_email":    r["approved_by_email"],
                "approved_at":          _iso(r["approved_at"]),
                "total_agents":         r["total_agents"],
                "completed_agents":     r["completed_agents"],
                "progress_percent":     round(
                    r["completed_agents"] / r["total_agents"] * 100, 2
                ) if r["total_agents"] else 0.0,
                "created_at":           _iso(r["created_at"]),
            }
            for r in rows
        ],
    }


# ---------------------------------------------------------------------------
# GET /api/v1/regulator/order/{id}/trace
# ---------------------------------------------------------------------------
@app.get(
    "/api/v1/regulator/order/{order_id}/trace",
    dependencies=[Depends(require_regulator)],
    summary="Полный граф маршрута платежа",
)
async def order_trace(order_id: str, db: AsyncSession = Depends(get_db)):
    """
    ПОЛНАЯ «анатомия» платежа — всё, что скрыто от внешнего мира:
    · swarm-маршрут (стратегия, сети, части)
    · каждый агент: from_address → to_address, сумма, tx_hash, статус, попытки
    · tx_hash каждой on-chain транзакции
    · список задействованных сетей
    · временна́я шкала: когда агент запущен / завершён

    Именно здесь — ключевое преимущество перед Chainalysis:
    регулятор видит не только «деньги пришли», но и весь маршрут движения.
    """
    # Платёж
    order_q = (await db.execute(
        text("""
            SELECT po.*,
                   u.email        AS user_email,
                   u.company_name, u.inn,
                   apr.email      AS approved_by_email
            FROM payment_orders po
            LEFT JOIN users u   ON u.id   = po.user_id
            LEFT JOIN users apr ON apr.id = po.approved_by
            WHERE po.id = :id
        """),
        {"id": order_id},
    )).mappings().first()

    if not order_q:
        raise HTTPException(404, "Платёж не найден")

    # Маршрут
    route_q = (await db.execute(
        text("""
            SELECT * FROM swarm_routes
            WHERE order_id = :oid
            ORDER BY created_at DESC LIMIT 1
        """),
        {"oid": order_id},
    )).mappings().first()

    agents = []
    route_data = None
    timeline: list[dict] = []

    if route_q:
        route_data = {
            "id":              str(route_q["id"]),
            "total_parts":     route_q["total_parts"],
            "completed_parts": route_q["completed_parts"],
            "strategy":        route_q["strategy"],
            "status":          route_q["status"],
            "created_at":      _iso(route_q["created_at"]),
        }

        # Агенты
        agents_rows = (await db.execute(
            text("""
                SELECT id, agent_name, network,
                       from_address, to_address,
                       amount, status, tx_hash,
                       attempts, created_at, updated_at
                FROM swarm_agents
                WHERE route_id = :rid
                ORDER BY created_at
            """),
            {"rid": str(route_q["id"])},
        )).mappings().all()

        for a in agents_rows:
            agent = {
                "id":           str(a["id"]),
                "agent_name":   a["agent_name"],
                "network":      a["network"],
                "from_address": a["from_address"],
                "to_address":   a["to_address"],
                "amount":       float(a["amount"]),
                "status":       a["status"],
                "tx_hash":      a["tx_hash"],
                "attempts":     a["attempts"],
                "created_at":   _iso(a["created_at"]),
                "updated_at":   _iso(a["updated_at"]),
            }
            agents.append(agent)

            # временна́я шкала
            timeline.append({
                "ts":     _iso(a["created_at"]),
                "event":  "agent_started",
                "agent":  a["agent_name"],
                "network": a["network"],
            })
            if a["status"] in ("completed", "dead"):
                timeline.append({
                    "ts":     _iso(a["updated_at"]),
                    "event":  "agent_completed" if a["status"] == "completed" else "agent_failed",
                    "agent":  a["agent_name"],
                    "tx_hash": a["tx_hash"],
                })

        timeline.sort(key=lambda x: x["ts"] or "")

    networks_used = list({a["network"] for a in agents})
    completed     = [a for a in agents if a["status"] == "completed"]
    failed        = [a for a in agents if a["status"] == "dead"]

    return {
        "order": {
            "id":                   str(order_q["id"]),
            "user_email":           order_q["user_email"],
            "company_name":         order_q["company_name"],
            "inn":                  order_q["inn"],
            "from_currency":        order_q["from_currency"],
            "to_currency":          order_q["to_currency"],
            "amount":               float(order_q["amount"]),
            "destination_country":  order_q["destination_country"],
            "destination_address":  order_q["destination_address"],
            "status":               order_q["status"],
            "risk_score":           order_q["risk_score"],
            "reject_reason":        order_q["reject_reason"],
            "approved_by_email":    order_q["approved_by_email"],
            "approved_at":          _iso(order_q["approved_at"]),
            "created_at":           _iso(order_q["created_at"]),
        },
        "swarm_route":   route_data,
        "agents":        agents,
        "timeline":      timeline,
        "transparency": {
            "total_agents":     len(agents),
            "completed_agents": len(completed),
            "failed_agents":    len(failed),
            "networks_used":    networks_used,
            "networks_count":   len(networks_used),
            "tx_hashes":        [a["tx_hash"] for a in completed if a["tx_hash"]],
            "total_tx_hashes":  len([a for a in completed if a["tx_hash"]]),
            "progress_percent": round(len(completed) / len(agents) * 100, 2) if agents else 0.0,
            "vs_chainalysis": {
                "most":        "Полный граф: все агенты, адреса, tx_hash, сети, временна́я шкала",
                "chainalysis": "Только входная и выходная точка — без маршрута",
            },
        },
    }


# ---------------------------------------------------------------------------
# 404
# ---------------------------------------------------------------------------
from fastapi.responses import JSONResponse

@app.exception_handler(404)
async def not_found(request: Request, exc: HTTPException):
    return JSONResponse({"detail": "Endpoint не найден на регуляторной ноде"}, status_code=404)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8003, reload=False)
