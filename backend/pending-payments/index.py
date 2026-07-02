"""
MOST — compliance-api (pending-payments slot)
Единая точка для всех compliance-операций.
Доступ: compliance, admin, superadmin, finance.

GET  /?resource=stats
GET  /?resource=queue   (список aml_pending)
GET  /?resource=frozen
GET  /?resource=audit&limit=&offset=&action=&user_id=&date_from=&date_to=
POST / { resource: "freeze"|"unfreeze"|"escalate", user_id, reason }
"""
import json
import os
from datetime import datetime, timezone

import psycopg2
import psycopg2.extras
from jose import JWTError, jwt

ALLOWED_ROLES = {"compliance", "admin", "superadmin", "finance"}
CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Authorization",
}


def _resp(code: int, body: dict) -> dict:
    return {"statusCode": code, "headers": {**CORS, "Content-Type": "application/json"},
            "body": json.dumps(body, ensure_ascii=False, default=str)}


def _verify(event: dict) -> dict | None:
    secret  = os.environ.get("JWT_SECRET", "most-dev-secret-change-in-prod")
    headers = event.get("headers") or {}
    raw     = headers.get("X-Authorization") or headers.get("Authorization") or ""
    token   = raw.removeprefix("Bearer ").strip()
    if not token:
        return None
    try:
        return jwt.decode(token, secret, algorithms=["HS256"])
    except JWTError:
        return None


def _db():
    schema = os.environ.get("MAIN_DB_SCHEMA", "public")
    conn   = psycopg2.connect(os.environ["DATABASE_URL"], options=f"-c search_path={schema}")
    conn.autocommit = True
    return conn


def get_stats(conn) -> dict:
    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute("SELECT COUNT(*) AS n FROM payment_orders WHERE status = 'aml_pending'")
        pending = int(cur.fetchone()["n"])
        cur.execute("SELECT COUNT(*) AS n FROM payment_orders WHERE status = 'processing' AND DATE(approved_at) = CURRENT_DATE")
        approved_today = int(cur.fetchone()["n"])
        cur.execute("SELECT COUNT(*) AS n FROM payment_orders WHERE status = 'rejected' AND DATE(approved_at) = CURRENT_DATE")
        rejected_today = int(cur.fetchone()["n"])
        cur.execute("SELECT COUNT(*) AS n FROM payment_orders WHERE status = 'aml_pending' AND risk_score >= 80")
        high_risk = int(cur.fetchone()["n"])
        cur.execute("SELECT COUNT(*) AS n FROM users WHERE status = 'blocked'")
        frozen = int(cur.fetchone()["n"])
        cur.execute("""
            SELECT DATE(created_at) AS date, ROUND(AVG(risk_score)) AS avg_score, COUNT(*) AS count
            FROM payment_orders WHERE created_at >= NOW() - INTERVAL '14 days'
            GROUP BY DATE(created_at) ORDER BY date
        """)
        risk_by_day = [{"date": str(r["date"]), "avg_score": int(r["avg_score"] or 0), "count": int(r["count"])} for r in cur.fetchall()]
        cur.execute("""
            SELECT destination_address AS address, MAX(risk_score) AS score, COUNT(*) AS count
            FROM payment_orders WHERE risk_score >= 50
            GROUP BY destination_address ORDER BY score DESC, count DESC LIMIT 5
        """)
        top_suspicious = [{"address": r["address"], "score": int(r["score"]), "count": int(r["count"])} for r in cur.fetchall()]
    return {"pending": pending, "approved_today": approved_today, "rejected_today": rejected_today,
            "high_risk": high_risk, "frozen": frozen, "risk_by_day": risk_by_day, "top_suspicious": top_suspicious}


def get_queue(conn, qs: dict) -> dict:
    sort_by = qs.get("sort_by", "risk_score")
    if sort_by not in ("risk_score", "amount", "created_at"):
        sort_by = "risk_score"
    order = "asc" if qs.get("order") == "asc" else "desc"
    try:
        limit  = max(1, min(100, int(qs.get("limit",  50))))
        offset = max(0, int(qs.get("offset", 0)))
    except (ValueError, TypeError):
        limit, offset = 50, 0
    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute("SELECT COUNT(*) AS total FROM payment_orders WHERE status = 'aml_pending'")
        total = int(cur.fetchone()["total"])
        cur.execute(f"""
            SELECT po.id, po.user_id, u.email AS user_email, u.company_name AS user_company,
                   po.from_currency, po.to_currency, po.amount, po.destination_country,
                   po.destination_address, po.risk_score, po.created_at
            FROM payment_orders po LEFT JOIN users u ON u.id = po.user_id
            WHERE po.status = 'aml_pending'
            ORDER BY po.{sort_by} {order} LIMIT %s OFFSET %s
        """, (limit, offset))
        rows = cur.fetchall()
    items = [{
        "id": str(r["id"]), "user_id": str(r["user_id"]),
        "user_email": r["user_email"], "user_company": r["user_company"],
        "from_currency": r["from_currency"], "to_currency": r["to_currency"],
        "amount": float(r["amount"]), "destination_country": r["destination_country"],
        "destination_address": r["destination_address"], "risk_score": r["risk_score"],
        "risk_level": "high" if r["risk_score"] >= 60 else ("medium" if r["risk_score"] >= 30 else "low"),
        "created_at": r["created_at"].isoformat() if r["created_at"] else None,
    } for r in rows]
    return {"items": items, "total": total, "limit": limit, "offset": offset}


def get_frozen(conn) -> dict:
    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute("""
            SELECT u.id, u.email, u.company_name, u.inn, u.status, u.updated_at,
                   al.details->>'reason' AS freeze_reason, al.created_at AS frozen_at
            FROM users u
            LEFT JOIN LATERAL (
                SELECT details, created_at FROM audit_logs
                WHERE action IN ('account.freeze','account.block')
                  AND details->>'target_user_id' = u.id::text
                ORDER BY created_at DESC LIMIT 1
            ) al ON TRUE
            WHERE u.status = 'blocked' ORDER BY u.updated_at DESC
        """)
        rows = cur.fetchall()
    return {"items": [{
        "id": str(r["id"]), "email": r["email"], "company_name": r["company_name"],
        "inn": r["inn"], "status": r["status"], "freeze_reason": r["freeze_reason"],
        "frozen_at": r["frozen_at"].isoformat() if r["frozen_at"] else (r["updated_at"].isoformat() if r["updated_at"] else None),
    } for r in rows], "total": len(rows)}


def get_audit(conn, qs: dict) -> dict:
    try:
        limit  = max(1, min(100, int(qs.get("limit",  50))))
        offset = max(0, int(qs.get("offset", 0)))
    except (ValueError, TypeError):
        limit, offset = 50, 0
    conditions, params = [], []
    if qs.get("action"):
        conditions.append("al.action ILIKE %s"); params.append(f"%{qs['action']}%")
    if qs.get("user_id"):
        conditions.append("al.user_id = %s::uuid"); params.append(qs["user_id"])
    if qs.get("date_from"):
        conditions.append("al.created_at >= %s::timestamptz"); params.append(qs["date_from"])
    if qs.get("date_to"):
        conditions.append("al.created_at <= %s::timestamptz"); params.append(qs["date_to"] + " 23:59:59")
    where = ("WHERE " + " AND ".join(conditions)) if conditions else ""
    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute(f"SELECT COUNT(*) AS total FROM audit_logs al {where}", params)
        total = int(cur.fetchone()["total"])
        cur.execute(f"""
            SELECT al.id, al.action, al.details, al.ip_address, al.created_at,
                   u.email AS user_email, u.role AS user_role
            FROM audit_logs al LEFT JOIN users u ON u.id = al.user_id
            {where} ORDER BY al.created_at DESC LIMIT %s OFFSET %s
        """, params + [limit, offset])
        rows = cur.fetchall()
    return {
        "items": [{"id": r["id"], "action": r["action"], "details": r["details"],
                   "ip_address": r["ip_address"],
                   "created_at": r["created_at"].isoformat() if r["created_at"] else None,
                   "user_email": r["user_email"], "user_role": r["user_role"]} for r in rows],
        "total": total, "limit": limit, "offset": offset,
    }


def freeze_and_reject(conn, body: dict, caller: dict, ip) -> tuple:
    """
    Атомарная операция: заморозить аккаунт + отклонить платёж + записать в audit_log.
    body: { order_id, user_id, reason, reject_all? }
    """
    order_id   = (body.get("order_id")  or "").strip()
    user_id    = (body.get("user_id")   or "").strip()
    reason     = (body.get("reason")    or "Подозрение на нарушение AML-политики").strip()
    reject_all = bool(body.get("reject_all", False))

    if not order_id or not user_id:
        return {"error": "order_id и user_id обязательны"}, 400

    conn.autocommit = False
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            # 1. Проверяем платёж
            cur.execute(
                "SELECT id, status, user_id FROM payment_orders WHERE id = %s AND status = 'aml_pending'",
                (order_id,),
            )
            order = cur.fetchone()
            if not order:
                conn.rollback()
                return {"error": "Платёж не найден или уже обработан"}, 404

            # 2. Проверяем пользователя
            cur.execute("SELECT id, email FROM users WHERE id = %s::uuid", (user_id,))
            user = cur.fetchone()
            if not user:
                conn.rollback()
                return {"error": "Пользователь не найден"}, 404

            now = datetime.now(timezone.utc)

            # 3. Отклоняем текущий платёж
            cur.execute(
                """UPDATE payment_orders
                      SET status='rejected', approved_by=%s::uuid, approved_at=%s,
                          reject_reason=%s, updated_at=%s
                    WHERE id=%s""",
                (caller["sub"], now, reason, now, order_id),
            )
            rejected_count = 1

            # 4. Если reject_all — отклоняем все aml_pending платежи этого пользователя
            if reject_all:
                cur.execute(
                    """UPDATE payment_orders
                          SET status='rejected', approved_by=%s::uuid, approved_at=%s,
                              reject_reason=%s, updated_at=%s
                        WHERE user_id=%s::uuid AND status='aml_pending' AND id != %s""",
                    (caller["sub"], now, reason, now, user_id, order_id),
                )
                rejected_count += cur.rowcount

            # 5. Замораживаем аккаунт
            cur.execute(
                "UPDATE users SET status='blocked', updated_at=%s WHERE id=%s::uuid",
                (now, user_id),
            )

            # 6. Audit log — одна запись с полным контекстом
            audit_details = {
                "order_id":         order_id,
                "target_user_id":   user_id,
                "target_email":     user["email"],
                "reason":           reason,
                "reject_all":       reject_all,
                "rejected_count":   rejected_count,
                "action_type":      "freeze_and_reject",
            }
            cur.execute(
                "INSERT INTO audit_logs (user_id, action, details, ip_address) VALUES (%s::uuid, %s, %s, %s)",
                (caller["sub"], "incident.freeze_and_reject", json.dumps(audit_details), ip),
            )

        conn.commit()
        conn.autocommit = True
        return {
            "order_id":       order_id,
            "user_id":        user_id,
            "user_email":     user["email"],
            "rejected_count": rejected_count,
            "user_status":    "blocked",
            "order_status":   "rejected",
        }, 200

    except Exception as exc:
        conn.rollback()
        conn.autocommit = True
        return {"error": f"Ошибка транзакции: {str(exc)}"}, 500


def post_action(conn, body: dict, caller: dict, ip) -> tuple:
    resource = (body.get("resource") or "").strip()
    user_id  = (body.get("user_id")  or "").strip()
    reason   = (body.get("reason")   or "").strip()
    if resource not in ("freeze", "unfreeze", "escalate"):
        return {"error": "resource: freeze | unfreeze | escalate"}, 400
    if not user_id:
        return {"error": "user_id обязателен"}, 400
    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute("SELECT id, email, status FROM users WHERE id = %s::uuid", (user_id,))
        user = cur.fetchone()
        if not user:
            return {"error": "Пользователь не найден"}, 404
        now = datetime.now(timezone.utc)
        if resource == "freeze":
            cur.execute("UPDATE users SET status='blocked', updated_at=%s WHERE id=%s::uuid", (now, user_id))
            new_status = "blocked"
        elif resource == "unfreeze":
            cur.execute("UPDATE users SET status='active', updated_at=%s WHERE id=%s::uuid", (now, user_id))
            new_status = "active"
        else:
            new_status = user["status"]
        cur.execute(
            "INSERT INTO audit_logs (user_id, action, details, ip_address) VALUES (%s::uuid, %s, %s, %s)",
            (caller["sub"], f"account.{resource}",
             json.dumps({"target_user_id": user_id, "email": user["email"], "reason": reason or None}), ip))
    return {"user_id": user_id, "resource": resource, "new_status": new_status}, 200


def handler(event: dict, context) -> dict:
    """Compliance API: stats | queue | frozen | audit | freeze | unfreeze | escalate."""
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}
    caller = _verify(event)
    if not caller:
        return _resp(401, {"error": "Требуется авторизация"})
    if caller.get("role") not in ALLOWED_ROLES:
        return _resp(403, {"error": "Нет доступа"})
    method   = event.get("httpMethod", "GET")
    qs       = event.get("queryStringParameters") or {}
    resource = (qs.get("resource") or "").strip()
    conn = _db()
    try:
        if method == "GET":
            if resource == "stats":  return _resp(200, get_stats(conn))
            if resource == "queue":  return _resp(200, get_queue(conn, qs))
            if resource == "frozen": return _resp(200, get_frozen(conn))
            if resource == "audit":  return _resp(200, get_audit(conn, qs))
            return _resp(400, {"error": "resource: stats | queue | frozen | audit"})
        if method == "POST":
            try:
                body = json.loads(event.get("body") or "{}")
            except json.JSONDecodeError:
                return _resp(400, {"error": "Невалидный JSON"})
            ip = (event.get("requestContext") or {}).get("identity", {}).get("sourceIp")
            # Атомарный инцидент-эндпоинт
            if (body.get("resource") or "").strip() == "freeze_and_reject":
                result, code = freeze_and_reject(conn, body, caller, ip)
                return _resp(code, result)
            result, code = post_action(conn, body, caller, ip)
            return _resp(code, result)
        return _resp(405, {"error": "Method not allowed"})
    finally:
        conn.close()