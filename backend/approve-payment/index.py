"""
MOST — approve-payment
Ручное одобрение / отклонение платежа compliance-офицером или администратором.
Доступ: роли compliance, admin, superadmin.

POST /  { "order_id": "uuid", "action": "approve"|"reject", "reason": "..." }
"""
import json
import os
from datetime import datetime, timezone

ALLOWED_ROLES = {"compliance", "admin", "superadmin"}
CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Authorization",
}


def _db():
    import psycopg2
    import psycopg2.extras
    schema = os.environ.get("MAIN_DB_SCHEMA", "public")
    conn = psycopg2.connect(os.environ["DATABASE_URL"], options=f"-c search_path={schema}")
    conn.autocommit = False
    return conn


def _get_caller(event: dict) -> dict | None:
    """Читает JWT из Authorization / X-Authorization и возвращает payload."""
    from jose import JWTError, jwt
    secret = os.environ.get("JWT_SECRET", "")
    header = (
        event.get("headers", {}).get("X-Authorization")
        or event.get("headers", {}).get("Authorization")
        or ""
    )
    token = header.removeprefix("Bearer ").strip()
    if not token:
        return None
    try:
        return jwt.decode(token, secret, algorithms=["HS256"])
    except JWTError:
        return None


def _resp(code: int, body: dict) -> dict:
    return {"statusCode": code, "headers": {**CORS, "Content-Type": "application/json"}, "body": json.dumps(body, ensure_ascii=False)}


def handler(event: dict, context) -> dict:
    """Одобрение или отклонение платежа AML-compliance офицером."""

    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    # --- авторизация --------------------------------------------------------
    caller = _get_caller(event)
    if not caller:
        return _resp(401, {"error": "Требуется авторизация"})

    caller_role = caller.get("role", "user")
    caller_id   = caller.get("sub")
    if caller_role not in ALLOWED_ROLES:
        return _resp(403, {"error": "Недостаточно прав. Требуется роль: compliance / admin"})

    # --- тело запроса -------------------------------------------------------
    try:
        body = json.loads(event.get("body") or "{}")
    except json.JSONDecodeError:
        return _resp(400, {"error": "Невалидный JSON"})

    order_id = (body.get("order_id") or "").strip()
    action   = (body.get("action") or "").strip().lower()
    reason   = (body.get("reason") or "").strip()

    if not order_id:
        return _resp(400, {"error": "Поле order_id обязательно"})
    if action not in ("approve", "reject"):
        return _resp(400, {"error": "action должен быть 'approve' или 'reject'"})
    if action == "reject" and not reason:
        return _resp(400, {"error": "При отклонении необходимо указать reason"})

    # --- работа с БД --------------------------------------------------------
    conn = _db()
    try:
        import psycopg2.extras
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:

            # 1. Получаем платёж
            cur.execute(
                "SELECT id, status, risk_score, destination_address FROM payment_orders WHERE id = %s",
                (order_id,),
            )
            order = cur.fetchone()

            if not order:
                return _resp(404, {"error": "Платёж не найден"})

            if order["status"] != "aml_pending":
                return _resp(409, {
                    "error": "Платёж не ожидает проверки",
                    "current_status": order["status"],
                })

            now = datetime.now(timezone.utc)

            if action == "approve":
                new_status = "processing"
                cur.execute(
                    """
                    UPDATE payment_orders
                       SET status      = %s,
                           approved_by = %s,
                           approved_at = %s,
                           updated_at  = %s
                     WHERE id = %s
                    """,
                    (new_status, caller_id, now, now, order_id),
                )
            else:
                new_status = "rejected"
                cur.execute(
                    """
                    UPDATE payment_orders
                       SET status        = %s,
                           approved_by   = %s,
                           approved_at   = %s,
                           reject_reason = %s,
                           updated_at    = %s
                     WHERE id = %s
                    """,
                    (new_status, caller_id, now, reason, now, order_id),
                )

            # 2. Пишем в audit_log
            ip = (event.get("requestContext") or {}).get("identity", {}).get("sourceIp")
            cur.execute(
                """
                INSERT INTO audit_logs (user_id, action, details, ip_address)
                VALUES (%s, %s, %s, %s)
                """,
                (
                    caller_id,
                    f"payment.{action}",
                    json.dumps({
                        "order_id":   order_id,
                        "risk_score": order["risk_score"],
                        "address":    order["destination_address"],
                        "reason":     reason or None,
                    }),
                    ip,
                ),
            )

            conn.commit()

        return _resp(200, {
            "order_id":   order_id,
            "action":     action,
            "new_status": new_status,
            "approved_by": caller_id,
            "approved_at": now.isoformat(),
            **({"reject_reason": reason} if action == "reject" else {}),
        })

    except Exception as exc:
        conn.rollback()
        return _resp(500, {"error": "Внутренняя ошибка сервера", "detail": str(exc)})
    finally:
        conn.close()