"""
MOST — regulator-api
Полный доступ к данным платформы для регулятора. Авторизация: X-API-Key.

GET  /?resource=overview
GET  /?resource=participants&limit=&offset=&search=&status=
GET  /?resource=participant&user_id=
GET  /?resource=transactions&limit=&offset=&company=&country=&risk_min=&amount_min=&status=
GET  /?resource=routes&order_id=
GET  /?resource=emergency_log
GET  /?resource=report&date_from=&date_to=

POST / { resource: "suspend_participant", user_id, reason }
POST / { resource: "emergency_stop", reason, confirm: true }
POST / { resource: "resume_platform", reason }
"""
import json
import os
from datetime import datetime, timezone

import psycopg2
import psycopg2.extras

CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-API-Key",
}


def _resp(code: int, body: dict) -> dict:
    return {"statusCode": code, "headers": {**CORS, "Content-Type": "application/json"},
            "body": json.dumps(body, ensure_ascii=False, default=str)}


def _verify(event: dict) -> bool:
    key = os.environ.get("REGULATOR_API_KEY", "")
    if not key:
        return False
    headers = event.get("headers") or {}
    sent = headers.get("X-API-Key") or headers.get("x-api-key") or ""
    return sent == key


def _db():
    schema = os.environ.get("MAIN_DB_SCHEMA", "public")
    conn = psycopg2.connect(os.environ["DATABASE_URL"], options=f"-c search_path={schema}")
    conn.autocommit = True
    return conn


# ── GET: overview ─────────────────────────────────────────────────────────────
def get_overview(conn) -> dict:
    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute("SELECT COUNT(*) AS n FROM users WHERE role='user'")
        total_users = int(cur.fetchone()["n"])

        cur.execute("SELECT COUNT(*) AS n FROM users WHERE role='user' AND status='active'")
        active_users = int(cur.fetchone()["n"])

        cur.execute("SELECT COALESCE(SUM(amount),0) AS v FROM payment_orders WHERE created_at >= NOW()-INTERVAL '24 hours'")
        vol_24h = float(cur.fetchone()["v"] or 0)

        cur.execute("SELECT COUNT(*) AS n FROM payment_orders WHERE status='processing'")
        processing = int(cur.fetchone()["n"])

        cur.execute("SELECT COUNT(*) AS n FROM payment_orders WHERE status='aml_pending'")
        aml_pending = int(cur.fetchone()["n"])

        cur.execute("""
            SELECT destination_country AS country, COUNT(*) AS cnt, SUM(amount) AS vol
            FROM payment_orders
            WHERE destination_country IS NOT NULL AND created_at >= NOW()-INTERVAL '30 days'
            GROUP BY destination_country ORDER BY vol DESC LIMIT 10
        """)
        top_countries = [{"country": r["country"], "count": int(r["cnt"]), "volume": float(r["vol"] or 0)}
                         for r in cur.fetchall()]

        cur.execute("""
            SELECT u.company_name, u.inn, COUNT(po.id) AS tx_count,
                   SUM(po.amount) AS total_vol, ROUND(AVG(po.risk_score)) AS avg_risk
            FROM payment_orders po JOIN users u ON u.id=po.user_id
            WHERE po.created_at >= NOW()-INTERVAL '30 days'
            GROUP BY u.id, u.company_name, u.inn ORDER BY total_vol DESC LIMIT 5
        """)
        top_companies = [{"company_name": r["company_name"], "inn": r["inn"],
                          "tx_count": int(r["tx_count"]), "total_vol": float(r["total_vol"] or 0),
                          "avg_risk": int(r["avg_risk"] or 0)} for r in cur.fetchall()]

        cur.execute("""
            SELECT DATE(created_at) AS d, SUM(amount) AS vol, COUNT(*) AS cnt
            FROM payment_orders WHERE created_at >= NOW()-INTERVAL '14 days'
            GROUP BY DATE(created_at) ORDER BY d
        """)
        volume_by_day = [{"date": str(r["d"]), "volume": float(r["vol"] or 0), "count": int(r["cnt"])}
                         for r in cur.fetchall()]

    return {"total_users": total_users, "active_users": active_users,
            "vol_24h": vol_24h, "processing": processing, "aml_pending": aml_pending,
            "top_countries": top_countries, "top_companies": top_companies,
            "volume_by_day": volume_by_day}


# ── GET: participants ─────────────────────────────────────────────────────────
def get_participants(conn, qs: dict) -> dict:
    try:
        limit  = max(1, min(100, int(qs.get("limit", 50))))
        offset = max(0, int(qs.get("offset", 0)))
    except (ValueError, TypeError):
        limit, offset = 50, 0
    search = (qs.get("search") or "").strip()
    status = (qs.get("status") or "").strip()

    cond, params = ["u.role='user'"], []
    if search:
        cond.append("(u.company_name ILIKE %s OR u.inn ILIKE %s OR u.email ILIKE %s)")
        params += [f"%{search}%"] * 3
    if status:
        cond.append("u.status=%s"); params.append(status)

    where = "WHERE " + " AND ".join(cond)
    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute(f"SELECT COUNT(*) AS n FROM users u {where}", params)
        total = int(cur.fetchone()["n"])
        cur.execute(f"""
            SELECT u.id, u.email, u.company_name, u.inn, u.status, u.created_at,
                   k.status AS kyc_status,
                   COALESCE(p.tx_count,0) AS tx_count,
                   COALESCE(p.total_vol,0) AS total_vol,
                   COALESCE(p.avg_risk,0) AS avg_risk,
                   COALESCE(p.countries, ARRAY[]::text[]) AS countries
            FROM users u
            LEFT JOIN LATERAL (
                SELECT status FROM kyc_applications WHERE user_id=u.id ORDER BY created_at DESC LIMIT 1
            ) k ON TRUE
            LEFT JOIN LATERAL (
                SELECT COUNT(*) AS tx_count, SUM(amount) AS total_vol,
                       ROUND(AVG(risk_score)) AS avg_risk,
                       ARRAY_AGG(DISTINCT destination_country)
                         FILTER (WHERE destination_country IS NOT NULL) AS countries
                FROM payment_orders WHERE user_id=u.id
            ) p ON TRUE
            {where}
            ORDER BY total_vol DESC NULLS LAST
            LIMIT %s OFFSET %s
        """, params + [limit, offset])
        rows = cur.fetchall()

    return {"items": [{
        "id": str(r["id"]), "email": r["email"], "company_name": r["company_name"],
        "inn": r["inn"], "status": r["status"], "kyc_status": r["kyc_status"],
        "tx_count": int(r["tx_count"]), "total_vol": float(r["total_vol"] or 0),
        "avg_risk": int(r["avg_risk"] or 0), "countries": r["countries"] or [],
        "created_at": r["created_at"].isoformat() if r["created_at"] else None,
    } for r in rows], "total": total, "limit": limit, "offset": offset}


# ── GET: participant detail ───────────────────────────────────────────────────
def get_participant(conn, user_id: str) -> dict:
    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute("SELECT id,email,company_name,inn,status,created_at,updated_at FROM users WHERE id=%s::uuid", (user_id,))
        user = cur.fetchone()
        if not user:
            return {"error": "Не найден"}

        cur.execute("""
            SELECT id, from_currency, to_currency, amount, destination_country,
                   destination_address, status, risk_score, created_at
            FROM payment_orders WHERE user_id=%s::uuid ORDER BY created_at DESC LIMIT 50
        """, (user_id,))
        payments = [{**dict(r), "id": str(r["id"]), "amount": float(r["amount"]),
                     "created_at": r["created_at"].isoformat() if r["created_at"] else None}
                    for r in cur.fetchall()]

        cur.execute("""
            SELECT id, company_name, inn, status, reject_reason, created_at, reviewed_at
            FROM kyc_applications WHERE user_id=%s::uuid ORDER BY created_at DESC LIMIT 5
        """, (user_id,))
        kyc_history = [{**dict(r), "id": str(r["id"]),
                        "created_at": r["created_at"].isoformat() if r["created_at"] else None,
                        "reviewed_at": r["reviewed_at"].isoformat() if r["reviewed_at"] else None}
                       for r in cur.fetchall()]

        cur.execute("""
            SELECT DISTINCT destination_address, destination_country, to_currency,
                   MAX(risk_score) AS risk_score
            FROM payment_orders WHERE user_id=%s::uuid
            GROUP BY destination_address, destination_country, to_currency LIMIT 20
        """, (user_id,))
        counterparties = [{"address": r["destination_address"], "country": r["destination_country"],
                           "currency": r["to_currency"], "risk_score": int(r["risk_score"] or 0)}
                          for r in cur.fetchall()]

    return {"user": {**dict(user), "id": str(user["id"]),
                     "created_at": user["created_at"].isoformat() if user["created_at"] else None},
            "payments": payments, "kyc_history": kyc_history, "counterparties": counterparties}


# ── GET: transactions ─────────────────────────────────────────────────────────
def get_transactions(conn, qs: dict) -> dict:
    try:
        limit  = max(1, min(100, int(qs.get("limit", 50))))
        offset = max(0, int(qs.get("offset", 0)))
    except (ValueError, TypeError):
        limit, offset = 50, 0

    cond, params = [], []
    if qs.get("company"):
        cond.append("u.company_name ILIKE %s"); params.append(f"%{qs['company']}%")
    if qs.get("country"):
        cond.append("po.destination_country=%s"); params.append(qs["country"])
    if qs.get("risk_min"):
        try: cond.append("po.risk_score>=%s"); params.append(int(qs["risk_min"]))
        except ValueError: pass
    if qs.get("amount_min"):
        try: cond.append("po.amount>=%s"); params.append(float(qs["amount_min"]))
        except ValueError: pass
    if qs.get("status"):
        cond.append("po.status=%s"); params.append(qs["status"])

    where = ("WHERE " + " AND ".join(cond)) if cond else ""
    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute(f"SELECT COUNT(*) AS n FROM payment_orders po LEFT JOIN users u ON u.id=po.user_id {where}", params)
        total = int(cur.fetchone()["n"])
        cur.execute(f"""
            SELECT po.id, po.from_currency, po.to_currency, po.amount,
                   po.destination_country, po.destination_address, po.status,
                   po.risk_score, po.created_at,
                   u.company_name, u.inn, u.email,
                   sr.total_parts AS hops, sr.status AS route_status
            FROM payment_orders po
            LEFT JOIN users u ON u.id=po.user_id
            LEFT JOIN swarm_routes sr ON sr.order_id=po.id
            {where} ORDER BY po.created_at DESC LIMIT %s OFFSET %s
        """, params + [limit, offset])
        rows = cur.fetchall()

    return {"items": [{
        "id": str(r["id"]), "from_currency": r["from_currency"], "to_currency": r["to_currency"],
        "amount": float(r["amount"]), "destination_country": r["destination_country"],
        "destination_address": r["destination_address"], "status": r["status"],
        "risk_score": r["risk_score"], "company_name": r["company_name"],
        "inn": r["inn"], "email": r["email"],
        "hops": r["hops"] or 0, "route_status": r["route_status"],
        "created_at": r["created_at"].isoformat() if r["created_at"] else None,
    } for r in rows], "total": total, "limit": limit, "offset": offset}


# ── GET: route graph ──────────────────────────────────────────────────────────
def get_route(conn, order_id: str) -> dict:
    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute("""
            SELECT po.id, po.amount, po.from_currency, po.to_currency,
                   po.destination_address, po.destination_country, po.status,
                   u.company_name, u.email,
                   sr.id AS route_id, sr.total_parts, sr.completed_parts, sr.status AS route_status
            FROM payment_orders po
            LEFT JOIN users u ON u.id=po.user_id
            LEFT JOIN swarm_routes sr ON sr.order_id=po.id
            WHERE po.id=%s
        """, (order_id,))
        order = cur.fetchone()
        if not order:
            return {"error": "Платёж не найден"}

        agents = []
        if order["route_id"]:
            cur.execute("""
                SELECT id, agent_name, network, from_address, to_address,
                       amount, status, tx_hash, attempts, created_at
                FROM swarm_agents WHERE route_id=%s ORDER BY created_at
            """, (str(order["route_id"]),))
            agents = [{**dict(r), "id": str(r["id"]), "amount": float(r["amount"]),
                       "created_at": r["created_at"].isoformat() if r["created_at"] else None}
                      for r in cur.fetchall()]

    return {"order": {**dict(order), "id": str(order["id"]),
                      "route_id": str(order["route_id"]) if order["route_id"] else None,
                      "amount": float(order["amount"])},
            "agents": agents}


# ── GET: emergency log ────────────────────────────────────────────────────────
def get_emergency_log(conn) -> dict:
    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute("""
            SELECT id, action, details, ip_address, created_at FROM audit_logs
            WHERE action IN ('regulator.emergency_stop','regulator.resume_platform',
                             'regulator.suspend_participant')
            ORDER BY created_at DESC LIMIT 100
        """)
        rows = cur.fetchall()
    return {"items": [{"id": r["id"], "action": r["action"], "details": r["details"],
                       "ip_address": r["ip_address"],
                       "created_at": r["created_at"].isoformat() if r["created_at"] else None}
                      for r in rows]}


# ── GET: report ───────────────────────────────────────────────────────────────
def get_report(conn, qs: dict) -> dict:
    df = f"'{qs['date_from']}'" if qs.get("date_from") else "NOW()-INTERVAL '30 days'"
    dt = f"'{qs['date_to']}'"   if qs.get("date_to")   else "NOW()"

    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute(f"""
            SELECT COUNT(*) AS tx_count, COALESCE(SUM(amount),0) AS total_vol,
                   COUNT(DISTINCT user_id) AS unique_senders, AVG(risk_score) AS avg_risk
            FROM payment_orders WHERE created_at BETWEEN {df} AND {dt}
        """)
        s = cur.fetchone()

        cur.execute(f"""
            SELECT destination_country AS country, COUNT(*) AS cnt, SUM(amount) AS vol
            FROM payment_orders
            WHERE created_at BETWEEN {df} AND {dt} AND destination_country IS NOT NULL
            GROUP BY destination_country ORDER BY vol DESC LIMIT 10
        """)
        by_country = [{"country": r["country"], "count": int(r["cnt"]), "volume": float(r["vol"] or 0)}
                      for r in cur.fetchall()]

        cur.execute(f"""
            SELECT u.company_name, u.inn, COUNT(po.id) AS cnt, SUM(po.amount) AS vol
            FROM payment_orders po JOIN users u ON u.id=po.user_id
            WHERE po.created_at BETWEEN {df} AND {dt}
            GROUP BY u.id, u.company_name, u.inn ORDER BY vol DESC LIMIT 10
        """)
        by_company = [{"company_name": r["company_name"], "inn": r["inn"],
                       "count": int(r["cnt"]), "volume": float(r["vol"] or 0)} for r in cur.fetchall()]

        cur.execute(f"""
            SELECT id, amount, destination_address, destination_country,
                   risk_score, from_currency, to_currency, status, created_at
            FROM payment_orders
            WHERE risk_score>=70 AND created_at BETWEEN {df} AND {dt}
            ORDER BY risk_score DESC LIMIT 20
        """)
        suspicious = [{**dict(r), "id": str(r["id"]), "amount": float(r["amount"]),
                       "created_at": r["created_at"].isoformat() if r["created_at"] else None}
                      for r in cur.fetchall()]

    return {
        "period": {"from": qs.get("date_from"), "to": qs.get("date_to")},
        "summary": {"tx_count": int(s["tx_count"]), "total_vol": float(s["total_vol"] or 0),
                    "unique_senders": int(s["unique_senders"]),
                    "avg_risk": round(float(s["avg_risk"] or 0), 1)},
        "by_country": by_country, "by_company": by_company, "suspicious": suspicious,
    }


# ── POST handlers ─────────────────────────────────────────────────────────────
def suspend_participant(conn, body: dict, ip) -> tuple:
    user_id = (body.get("user_id") or "").strip()
    reason  = (body.get("reason")  or "").strip()
    if not user_id or not reason:
        return {"error": "user_id и reason обязательны"}, 400
    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute("SELECT id, email FROM users WHERE id=%s::uuid", (user_id,))
        user = cur.fetchone()
        if not user:
            return {"error": "Пользователь не найден"}, 404
        now = datetime.now(timezone.utc)
        cur.execute("UPDATE users SET status='suspended', updated_at=%s WHERE id=%s::uuid", (now, user_id))
        cur.execute("INSERT INTO audit_logs (action, details, ip_address) VALUES (%s, %s, %s)",
                    ("regulator.suspend_participant",
                     json.dumps({"target_user_id": user_id, "email": user["email"], "reason": reason}), ip))
    return {"user_id": user_id, "new_status": "suspended"}, 200


def emergency_stop(conn, body: dict, ip) -> tuple:
    reason  = (body.get("reason") or "").strip()
    confirm = body.get("confirm", False)
    if not confirm or not reason:
        return {"error": "Необходимо confirm:true и reason"}, 400
    now = datetime.now(timezone.utc)
    conn.autocommit = False
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("SELECT COUNT(*) AS n FROM swarm_routes WHERE status IN ('pending','active')")
            frozen = int(cur.fetchone()["n"])
            cur.execute("UPDATE swarm_routes SET status='frozen', updated_at=%s WHERE status IN ('pending','active')", (now,))
            cur.execute("UPDATE swarm_agents SET status='frozen', updated_at=%s WHERE status IN ('idle','running')", (now,))
            cur.execute("INSERT INTO audit_logs (action, details, ip_address) VALUES (%s, %s, %s)",
                        ("regulator.emergency_stop",
                         json.dumps({"reason": reason, "frozen_routes": frozen, "ts": now.isoformat()}), ip))
        conn.commit()
    except Exception as e:
        conn.rollback()
        return {"error": str(e)}, 500
    finally:
        conn.autocommit = True
    return {"status": "stopped", "frozen_routes": frozen, "timestamp": now.isoformat()}, 200


def resume_platform(conn, body: dict, ip) -> tuple:
    reason = (body.get("reason") or "Плановое возобновление работы").strip()
    now = datetime.now(timezone.utc)
    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute("SELECT COUNT(*) AS n FROM swarm_routes WHERE status='frozen'")
        resumed = int(cur.fetchone()["n"])
        cur.execute("UPDATE swarm_routes SET status='pending', updated_at=%s WHERE status='frozen'", (now,))
        cur.execute("UPDATE swarm_agents SET status='idle', updated_at=%s WHERE status='frozen'", (now,))
        cur.execute("INSERT INTO audit_logs (action, details, ip_address) VALUES (%s, %s, %s)",
                    ("regulator.resume_platform",
                     json.dumps({"reason": reason, "resumed_routes": resumed, "ts": now.isoformat()}), ip))
    return {"status": "resumed", "resumed_routes": resumed}, 200


# ── Handler ───────────────────────────────────────────────────────────────────
def handler(event: dict, context) -> dict:
    """Regulator API — полный read/write доступ по API-ключу."""
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}
    if not _verify(event):
        return _resp(401, {"error": "Неверный или отсутствующий X-API-Key"})

    method   = event.get("httpMethod", "GET")
    qs       = event.get("queryStringParameters") or {}
    resource = (qs.get("resource") or "").strip()
    ip       = (event.get("requestContext") or {}).get("identity", {}).get("sourceIp")
    conn = _db()
    try:
        if method == "GET":
            if resource == "overview":      return _resp(200, get_overview(conn))
            if resource == "participants":   return _resp(200, get_participants(conn, qs))
            if resource == "participant":    return _resp(200, get_participant(conn, qs.get("user_id", "")))
            if resource == "transactions":   return _resp(200, get_transactions(conn, qs))
            if resource == "routes":         return _resp(200, get_route(conn, qs.get("order_id", "")))
            if resource == "emergency_log":  return _resp(200, get_emergency_log(conn))
            if resource == "report":         return _resp(200, get_report(conn, qs))
            return _resp(400, {"error": "resource: overview|participants|participant|transactions|routes|emergency_log|report"})
        if method == "POST":
            try:
                body = json.loads(event.get("body") or "{}")
            except json.JSONDecodeError:
                return _resp(400, {"error": "Невалидный JSON"})
            r = (body.get("resource") or "").strip()
            if r == "suspend_participant": result, code = suspend_participant(conn, body, ip)
            elif r == "emergency_stop":    result, code = emergency_stop(conn, body, ip)
            elif r == "resume_platform":   result, code = resume_platform(conn, body, ip)
            else: return _resp(400, {"error": "resource: suspend_participant|emergency_stop|resume_platform"})
            return _resp(code, result)
        return _resp(405, {"error": "Method not allowed"})
    finally:
        conn.close()
