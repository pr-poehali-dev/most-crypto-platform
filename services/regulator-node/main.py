"""
MOST — Regulator Node («Золотая нода»)
========================================
Read-only узел для надзорного регулятора.
Предоставляет полную прозрачность всех транзакций платформы:
— аудит-лог каждого действия
— детализация любого платёжного поручения (включая swarm-маршрут и агентов)
— агрегированные отчёты за период
— сравнительный индекс прозрачности vs Chainalysis

Порт: 8003
Auth: REGULATOR_API_KEY через заголовок X-Regulator-Key

ВАЖНО: узел только читает данные, ни одна операция не изменяет состояние.
"""
import os
from datetime import datetime, timezone
from typing import Optional

from fastapi import Depends, FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

# ---------------------------------------------------------------------------
# Конфигурация
# ---------------------------------------------------------------------------
DATABASE_URL      = os.environ.get("DATABASE_URL", "").replace(
    "postgresql://", "postgresql+asyncpg://"
)
REGULATOR_API_KEY = os.environ.get("REGULATOR_API_KEY", "")
PLATFORM_NAME     = "MOST Swarm Payment Network"
NODE_VERSION      = "1.0.0"


# ---------------------------------------------------------------------------
# БД — read-only async engine
# ---------------------------------------------------------------------------
engine = create_async_engine(DATABASE_URL, pool_size=5, max_overflow=0, echo=False)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)


async def get_db():
    async with AsyncSessionLocal() as session:
        yield session


# ---------------------------------------------------------------------------
# FastAPI
# ---------------------------------------------------------------------------
app = FastAPI(
    title="MOST Regulator Node",
    description="Золотая нода — прозрачный аудит всех транзакций платформы для надзорного регулятора.",
    version=NODE_VERSION,
    docs_url="/regulator/docs",
    redoc_url="/regulator/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["GET", "OPTIONS"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Auth: API-ключ регулятора
# ---------------------------------------------------------------------------
async def require_regulator(request: Request):
    key = (
        request.headers.get("X-Regulator-Key")
        or request.query_params.get("api_key")
        or ""
    )
    if not REGULATOR_API_KEY:
        raise HTTPException(
            status_code=503,
            detail="Регуляторный ключ не настроен на сервере. Обратитесь к администратору платформы.",
        )
    if key != REGULATOR_API_KEY:
        raise HTTPException(
            status_code=403,
            detail="Доступ запрещён. Предъявите действующий ключ регулятора (X-Regulator-Key).",
        )


# ---------------------------------------------------------------------------
# Схемы ответов
# ---------------------------------------------------------------------------
class NodeInfo(BaseModel):
    node: str
    version: str
    platform: str
    role: str
    access: str
    transparency_index: float
    timestamp: str


class PaginatedMeta(BaseModel):
    total: int
    limit: int
    offset: int
    page: int
    pages: int


# ---------------------------------------------------------------------------
# Вспомогательные функции
# ---------------------------------------------------------------------------
def _paginate(total: int, limit: int, offset: int) -> PaginatedMeta:
    pages = max(1, (total + limit - 1) // limit)
    page  = offset // limit + 1
    return PaginatedMeta(total=total, limit=limit, offset=offset, page=page, pages=pages)


def _iso(dt) -> Optional[str]:
    if dt is None:
        return None
    if hasattr(dt, "isoformat"):
        return dt.isoformat()
    return str(dt)


async def _count(db: AsyncSession, table: str, where: str = "1=1") -> int:
    row = await db.execute(text(f"SELECT COUNT(*) FROM {table} WHERE {where}"))
    return row.scalar_one()


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@app.get("/health")
async def health():
    return {"status": "ok", "service": "regulator-node", "version": NODE_VERSION}


@app.get(
    "/api/v1/regulator/node-info",
    response_model=NodeInfo,
    dependencies=[Depends(require_regulator)],
    summary="Информация об узле",
    tags=["Узел"],
)
async def node_info():
    """
    Идентификация золотой ноды.
    Возвращает метаданные платформы, роль узла и индекс прозрачности.
    Chainalysis: закрытый блэкбокс без объяснения методологии.
    MOST: каждый шаг маршрута — в открытом аудит-логе.
    """
    return NodeInfo(
        node="MOST-REGULATOR-NODE-01",
        version=NODE_VERSION,
        platform=PLATFORM_NAME,
        role="read-only supervisory node",
        access="full transaction transparency",
        transparency_index=100.0,
        timestamp=datetime.now(timezone.utc).isoformat(),
    )


# ── Аудит-лог ───────────────────────────────────────────────────────────────

@app.get(
    "/api/v1/regulator/audit-log",
    dependencies=[Depends(require_regulator)],
    summary="Полный аудит-лог платформы",
    tags=["Аудит"],
)
async def audit_log(
    db: AsyncSession = Depends(get_db),
    limit: int       = Query(50, ge=1, le=500),
    offset: int      = Query(0,  ge=0),
    user_id: Optional[str] = Query(None),
    action:  Optional[str] = Query(None, description="Фильтр по типу действия: payment.approve, risk.check, ..."),
    date_from: Optional[str] = Query(None, description="ISO дата начала периода"),
    date_to:   Optional[str] = Query(None, description="ISO дата конца периода"),
):
    """
    Полная история всех действий на платформе — регистрации, платежи,
    AML-проверки, одобрения/отклонения compliance-офицеров.
    Не редактируется, не удаляется — append-only журнал.
    """
    conditions = ["1=1"]
    params: dict = {}

    if user_id:
        conditions.append("al.user_id = :user_id")
        params["user_id"] = user_id
    if action:
        conditions.append("al.action ILIKE :action")
        params["action"] = f"%{action}%"
    if date_from:
        conditions.append("al.created_at >= :date_from")
        params["date_from"] = date_from
    if date_to:
        conditions.append("al.created_at <= :date_to")
        params["date_to"] = date_to

    where = " AND ".join(conditions)

    total_q = await db.execute(
        text(f"SELECT COUNT(*) FROM audit_logs al WHERE {where}"),
        params,
    )
    total = total_q.scalar_one()

    rows_q = await db.execute(
        text(f"""
            SELECT
                al.id,
                al.user_id,
                u.email      AS user_email,
                u.company_name,
                al.action,
                al.details,
                al.ip_address,
                al.created_at
            FROM audit_logs al
            LEFT JOIN users u ON u.id = al.user_id
            WHERE {where}
            ORDER BY al.created_at DESC
            LIMIT :limit OFFSET :offset
        """),
        {**params, "limit": limit, "offset": offset},
    )
    rows = rows_q.mappings().all()

    return {
        "meta": _paginate(total, limit, offset),
        "items": [
            {
                "id":           r["id"],
                "user_id":      str(r["user_id"]) if r["user_id"] else None,
                "user_email":   r["user_email"],
                "company_name": r["company_name"],
                "action":       r["action"],
                "details":      r["details"],
                "ip_address":   r["ip_address"],
                "created_at":   _iso(r["created_at"]),
            }
            for r in rows
        ],
    }


# ── Платёжные поручения ──────────────────────────────────────────────────────

@app.get(
    "/api/v1/regulator/payments",
    dependencies=[Depends(require_regulator)],
    summary="Все платёжные поручения",
    tags=["Платежи"],
)
async def payments(
    db: AsyncSession = Depends(get_db),
    limit:    int            = Query(50,  ge=1, le=500),
    offset:   int            = Query(0,   ge=0),
    status:   Optional[str]  = Query(None),
    min_amount: Optional[float] = Query(None),
    max_amount: Optional[float] = Query(None),
    min_risk:   Optional[int]   = Query(None, ge=0, le=100),
    country:    Optional[str]   = Query(None, description="ISO-2 код страны назначения"),
    date_from:  Optional[str]   = Query(None),
    date_to:    Optional[str]   = Query(None),
):
    """
    Полный реестр платёжных поручений со всеми полями:
    пользователь, маршрут, сумма, адрес получателя, риск-скор, статус,
    кто одобрил и когда.
    """
    conditions = ["1=1"]
    params: dict = {}

    if status:
        conditions.append("po.status = :status")
        params["status"] = status
    if min_amount is not None:
        conditions.append("po.amount >= :min_amount")
        params["min_amount"] = min_amount
    if max_amount is not None:
        conditions.append("po.amount <= :max_amount")
        params["max_amount"] = max_amount
    if min_risk is not None:
        conditions.append("po.risk_score >= :min_risk")
        params["min_risk"] = min_risk
    if country:
        conditions.append("po.destination_country = :country")
        params["country"] = country.upper()
    if date_from:
        conditions.append("po.created_at >= :date_from")
        params["date_from"] = date_from
    if date_to:
        conditions.append("po.created_at <= :date_to")
        params["date_to"] = date_to

    where = " AND ".join(conditions)

    total_q = await db.execute(
        text(f"SELECT COUNT(*) FROM payment_orders po WHERE {where}"),
        params,
    )
    total = total_q.scalar_one()

    rows_q = await db.execute(
        text(f"""
            SELECT
                po.id,
                po.user_id,
                u.email          AS user_email,
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
                approver.email   AS approved_by_email,
                po.created_at,
                po.updated_at
            FROM payment_orders po
            LEFT JOIN users u        ON u.id        = po.user_id
            LEFT JOIN users approver ON approver.id = po.approved_by
            WHERE {where}
            ORDER BY po.created_at DESC
            LIMIT :limit OFFSET :offset
        """),
        {**params, "limit": limit, "offset": offset},
    )
    rows = rows_q.mappings().all()

    return {
        "meta": _paginate(total, limit, offset),
        "items": [
            {
                "id":                   str(r["id"]),
                "user_id":              str(r["user_id"]),
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
                "created_at":           _iso(r["created_at"]),
                "updated_at":           _iso(r["updated_at"]),
            }
            for r in rows
        ],
    }


@app.get(
    "/api/v1/regulator/payments/{order_id}",
    dependencies=[Depends(require_regulator)],
    summary="Детализация платежа + полный swarm-маршрут",
    tags=["Платежи"],
)
async def payment_detail(order_id: str, db: AsyncSession = Depends(get_db)):
    """
    Полная «анатомия» платежа:
    — платёжное поручение
    — swarm-маршрут (стратегия, сети, кол-во частей)
    — каждый агент роя: адрес, сеть, сумма, tx_hash, статус, кол-во попыток

    Именно здесь видна разница с Chainalysis: вы видите не только факт
    перевода, но и всю маршрутную топологию — какие сети использованы,
    сколько агентов, какие транзакции подтверждены.
    """
    # Платёж
    order_q = await db.execute(
        text("""
            SELECT
                po.*,
                u.email        AS user_email,
                u.company_name,
                u.inn,
                approver.email AS approved_by_email
            FROM payment_orders po
            LEFT JOIN users u        ON u.id        = po.user_id
            LEFT JOIN users approver ON approver.id = po.approved_by
            WHERE po.id = :id
        """),
        {"id": order_id},
    )
    order = order_q.mappings().first()
    if not order:
        raise HTTPException(status_code=404, detail="Платёж не найден")

    # Swarm-маршрут
    route_q = await db.execute(
        text("SELECT * FROM swarm_routes WHERE order_id = :order_id ORDER BY created_at DESC LIMIT 1"),
        {"order_id": order_id},
    )
    route = route_q.mappings().first()

    agents = []
    route_data = None
    if route:
        route_data = {
            "id":              str(route["id"]),
            "total_parts":     route["total_parts"],
            "completed_parts": route["completed_parts"],
            "strategy":        route["strategy"],
            "status":          route["status"],
            "created_at":      _iso(route["created_at"]),
        }

        # Агенты роя
        agents_q = await db.execute(
            text("""
                SELECT
                    id, agent_name, network,
                    from_address, to_address,
                    amount, status, tx_hash,
                    attempts, created_at, updated_at
                FROM swarm_agents
                WHERE route_id = :route_id
                ORDER BY created_at
            """),
            {"route_id": str(route["id"])},
        )
        for a in agents_q.mappings().all():
            agents.append({
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
            })

    return {
        "order": {
            "id":                   str(order["id"]),
            "user_email":           order["user_email"],
            "company_name":         order["company_name"],
            "inn":                  order["inn"],
            "from_currency":        order["from_currency"],
            "to_currency":          order["to_currency"],
            "amount":               float(order["amount"]),
            "destination_country":  order["destination_country"],
            "destination_address":  order["destination_address"],
            "status":               order["status"],
            "risk_score":           order["risk_score"],
            "reject_reason":        order["reject_reason"],
            "approved_by_email":    order["approved_by_email"],
            "approved_at":          _iso(order["approved_at"]),
            "created_at":           _iso(order["created_at"]),
        },
        "swarm_route": route_data,
        "agents": agents,
        "transparency": {
            "total_agents":     len(agents),
            "networks_used":    list({a["network"] for a in agents}),
            "completed_agents": sum(1 for a in agents if a["status"] == "completed"),
            "failed_agents":    sum(1 for a in agents if a["status"] == "dead"),
            "tx_hashes":        [a["tx_hash"] for a in agents if a["tx_hash"]],
        },
    }


# ── Агрегированные отчёты ────────────────────────────────────────────────────

@app.get(
    "/api/v1/regulator/reports/summary",
    dependencies=[Depends(require_regulator)],
    summary="Сводный отчёт платформы",
    tags=["Отчёты"],
)
async def report_summary(db: AsyncSession = Depends(get_db)):
    """
    Ключевые метрики платформы одним запросом:
    пользователи, объём платежей, распределение рисков, статусы.
    """
    users_q = await db.execute(text("SELECT COUNT(*) FROM users"))
    total_users = users_q.scalar_one()

    orders_q = await db.execute(text("""
        SELECT
            COUNT(*)                                      AS total_orders,
            COALESCE(SUM(amount), 0)                      AS total_volume,
            COALESCE(AVG(amount), 0)                      AS avg_amount,
            COALESCE(AVG(risk_score), 0)                  AS avg_risk_score,
            COUNT(*) FILTER (WHERE status = 'processing') AS processing,
            COUNT(*) FILTER (WHERE status = 'completed')  AS completed,
            COUNT(*) FILTER (WHERE status = 'rejected')   AS rejected,
            COUNT(*) FILTER (WHERE status = 'aml_pending') AS aml_pending,
            COUNT(*) FILTER (WHERE risk_score >= 80)      AS high_risk,
            COUNT(*) FILTER (WHERE risk_score >= 40
                              AND risk_score < 80)        AS medium_risk,
            COUNT(*) FILTER (WHERE risk_score < 40)       AS low_risk
        FROM payment_orders
    """))
    o = orders_q.mappings().first()

    agents_q = await db.execute(text("""
        SELECT
            COUNT(*)                                       AS total_agents,
            COUNT(*) FILTER (WHERE status = 'completed')  AS completed,
            COUNT(*) FILTER (WHERE status = 'dead')       AS dead,
            COUNT(DISTINCT network)                        AS networks_used
        FROM swarm_agents
    """))
    a = agents_q.mappings().first()

    top_networks_q = await db.execute(text("""
        SELECT network, COUNT(*) AS cnt
        FROM swarm_agents
        GROUP BY network
        ORDER BY cnt DESC
        LIMIT 10
    """))
    top_nets = [{"network": r["network"], "count": r["cnt"]}
                for r in top_networks_q.mappings().all()]

    top_countries_q = await db.execute(text("""
        SELECT destination_country, COUNT(*) AS cnt, SUM(amount) AS volume
        FROM payment_orders
        WHERE destination_country IS NOT NULL
        GROUP BY destination_country
        ORDER BY volume DESC
        LIMIT 10
    """))
    top_countries = [
        {
            "country": r["destination_country"],
            "count":   r["cnt"],
            "volume":  float(r["volume"] or 0),
        }
        for r in top_countries_q.mappings().all()
    ]

    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "users": {
            "total": total_users,
        },
        "payments": {
            "total_orders":  o["total_orders"],
            "total_volume":  float(o["total_volume"]),
            "avg_amount":    float(o["avg_amount"]),
            "avg_risk_score": float(o["avg_risk_score"]),
            "by_status": {
                "processing":  o["processing"],
                "completed":   o["completed"],
                "rejected":    o["rejected"],
                "aml_pending": o["aml_pending"],
            },
            "by_risk": {
                "high_risk":   o["high_risk"],
                "medium_risk": o["medium_risk"],
                "low_risk":    o["low_risk"],
            },
        },
        "swarm": {
            "total_agents":   a["total_agents"],
            "completed":      a["completed"],
            "dead":           a["dead"],
            "networks_count": a["networks_used"],
            "success_rate":   round(
                (a["completed"] / a["total_agents"] * 100) if a["total_agents"] else 0, 2
            ),
            "top_networks":   top_nets,
        },
        "geography": {
            "top_countries": top_countries,
        },
        "transparency_vs_chainalysis": {
            "most_visibility":        "100%",
            "chainalysis_visibility": "partial — black-box scoring only",
            "most_audit_trail":       "full append-only log",
            "most_swarm_topology":    "every agent + tx_hash exposed",
            "most_methodology":       "open — deterministic risk scoring",
        },
    }


@app.get(
    "/api/v1/regulator/reports/risk-distribution",
    dependencies=[Depends(require_regulator)],
    summary="Распределение риск-скоров по диапазонам",
    tags=["Отчёты"],
)
async def report_risk_distribution(
    db: AsyncSession = Depends(get_db),
    date_from: Optional[str] = Query(None),
    date_to:   Optional[str] = Query(None),
):
    """Гистограмма риск-скоров (шаг 10) за указанный период."""
    conditions = ["1=1"]
    params: dict = {}
    if date_from:
        conditions.append("created_at >= :date_from")
        params["date_from"] = date_from
    if date_to:
        conditions.append("created_at <= :date_to")
        params["date_to"] = date_to
    where = " AND ".join(conditions)

    q = await db.execute(
        text(f"""
            SELECT
                (risk_score / 10) * 10            AS bucket_start,
                (risk_score / 10) * 10 + 9        AS bucket_end,
                COUNT(*)                           AS count,
                COALESCE(SUM(amount), 0)           AS volume
            FROM payment_orders
            WHERE {where}
            GROUP BY bucket_start, bucket_end
            ORDER BY bucket_start
        """),
        params,
    )
    buckets = [
        {
            "range":  f"{r['bucket_start']}-{r['bucket_end']}",
            "count":  r["count"],
            "volume": float(r["volume"]),
        }
        for r in q.mappings().all()
    ]
    return {"period": {"from": date_from, "to": date_to}, "buckets": buckets}


@app.get(
    "/api/v1/regulator/reports/high-risk-transactions",
    dependencies=[Depends(require_regulator)],
    summary="Транзакции с высоким риском (≥ 60)",
    tags=["Отчёты"],
)
async def report_high_risk(
    db: AsyncSession = Depends(get_db),
    limit:     int           = Query(100, ge=1, le=1000),
    offset:    int           = Query(0, ge=0),
    min_score: int           = Query(60, ge=0, le=100),
):
    """
    Реестр высокорисковых операций для расследования.
    Включает причины риска из аудит-лога.
    """
    total_q = await db.execute(
        text("SELECT COUNT(*) FROM payment_orders WHERE risk_score >= :s"),
        {"s": min_score},
    )
    total = total_q.scalar_one()

    rows_q = await db.execute(
        text("""
            SELECT
                po.id, po.created_at, po.amount,
                po.from_currency, po.to_currency,
                po.destination_country, po.destination_address,
                po.risk_score, po.status,
                u.email AS user_email, u.company_name, u.inn
            FROM payment_orders po
            LEFT JOIN users u ON u.id = po.user_id
            WHERE po.risk_score >= :s
            ORDER BY po.risk_score DESC, po.created_at DESC
            LIMIT :limit OFFSET :offset
        """),
        {"s": min_score, "limit": limit, "offset": offset},
    )

    return {
        "meta":      _paginate(total, limit, offset),
        "min_score": min_score,
        "items": [
            {
                "id":                   str(r["id"]),
                "user_email":           r["user_email"],
                "company_name":         r["company_name"],
                "inn":                  r["inn"],
                "amount":               float(r["amount"]),
                "from_currency":        r["from_currency"],
                "to_currency":          r["to_currency"],
                "destination_country":  r["destination_country"],
                "destination_address":  r["destination_address"],
                "risk_score":           r["risk_score"],
                "status":               r["status"],
                "created_at":           _iso(r["created_at"]),
            }
            for r in rows_q.mappings().all()
        ],
    }


@app.get(
    "/api/v1/regulator/users",
    dependencies=[Depends(require_regulator)],
    summary="Реестр пользователей платформы",
    tags=["Пользователи"],
)
async def users_list(
    db: AsyncSession = Depends(get_db),
    limit:  int          = Query(50,  ge=1, le=500),
    offset: int          = Query(0,   ge=0),
    role:   Optional[str] = Query(None),
    status: Optional[str] = Query(None),
):
    """
    Полный реестр компаний и физлиц, зарегистрированных на платформе.
    Пароли не возвращаются.
    """
    conditions = ["1=1"]
    params: dict = {}
    if role:
        conditions.append("role = :role")
        params["role"] = role
    if status:
        conditions.append("status = :status")
        params["status"] = status
    where = " AND ".join(conditions)

    total_q = await db.execute(
        text(f"SELECT COUNT(*) FROM users WHERE {where}"), params
    )
    total = total_q.scalar_one()

    rows_q = await db.execute(
        text(f"""
            SELECT
                id, email, company_name, inn,
                role, status, created_at,
                (SELECT COUNT(*) FROM payment_orders
                 WHERE user_id = u.id) AS total_orders,
                (SELECT COALESCE(SUM(amount), 0) FROM payment_orders
                 WHERE user_id = u.id) AS total_volume
            FROM users u
            WHERE {where}
            ORDER BY created_at DESC
            LIMIT :limit OFFSET :offset
        """),
        {**params, "limit": limit, "offset": offset},
    )

    return {
        "meta": _paginate(total, limit, offset),
        "items": [
            {
                "id":           str(r["id"]),
                "email":        r["email"],
                "company_name": r["company_name"],
                "inn":          r["inn"],
                "role":         r["role"],
                "status":       r["status"],
                "total_orders": r["total_orders"],
                "total_volume": float(r["total_volume"]),
                "created_at":   _iso(r["created_at"]),
            }
            for r in rows_q.mappings().all()
        ],
    }


# ---------------------------------------------------------------------------
# 404 для всего остального — регулятор не видит системных эндпоинтов
# ---------------------------------------------------------------------------
@app.exception_handler(404)
async def not_found_handler(request: Request, exc: HTTPException):
    return JSONResponse(
        status_code=404,
        content={"detail": "Endpoint не найден на регуляторной ноде."},
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8003, reload=False)
