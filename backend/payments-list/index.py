"""
MOST — payments-list
Список платежей с JWT-авторизацией и role-based фильтрацией.

Роли:
  user       — видит только свои платежи (WHERE user_id = sub)
  compliance — видит платежи в статусе aml_pending
  admin / superadmin / finance — видит всё
  regulator  — видит всё, только чтение

GET /
  ?status=all|completed|pending|aml_pending|rejected
  ?limit=1..100   (default: 50)
  ?offset=0       (default: 0)
  ?sort=created_at|amount|risk_score  (default: created_at)
  ?order=desc|asc (default: desc)

Headers:
  Authorization: Bearer <jwt>
"""
import json
import os

import psycopg2
import psycopg2.extras
from jose import JWTError, jwt

CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Authorization",
}

ALLOWED_SORT   = {"created_at", "amount", "risk_score"}
ALLOWED_STATUS = {"all", "completed", "pending", "aml_pending", "rejected", "processing"}

# Какие статусы видит compliance по умолчанию
COMPLIANCE_STATUSES = {"aml_pending"}

# Роли с полным доступом (все платежи, все статусы)
FULL_ACCESS_ROLES = {"admin", "superadmin", "finance", "regulator"}


def _resp(code: int, body: dict) -> dict:
    return {
        "statusCode": code,
        "headers": {**CORS, "Content-Type": "application/json"},
        "body": json.dumps(body, ensure_ascii=False, default=str),
    }


def _verify_token(event: dict) -> dict | None:
    """Декодирует JWT из заголовка Authorization / X-Authorization."""
    secret = os.environ.get("JWT_SECRET", "most-dev-secret-change-in-prod")
    headers = event.get("headers") or {}
    raw = headers.get("X-Authorization") or headers.get("Authorization") or ""
    token = raw.removeprefix("Bearer ").strip()
    if not token:
        return None
    try:
        return jwt.decode(token, secret, algorithms=["HS256"])
    except JWTError:
        return None


def _db():
    schema = os.environ.get("MAIN_DB_SCHEMA", "public")
    conn = psycopg2.connect(
        os.environ["DATABASE_URL"],
        options=f"-c search_path={schema}",
    )
    conn.autocommit = True
    return conn


def handler(event: dict, context) -> dict:
    """Возвращает список платежей согласно роли пользователя из JWT."""
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    # ── Авторизация ────────────────────────────────────────────────────────────
    caller = _verify_token(event)
    if not caller:
        return _resp(401, {"error": "Требуется авторизация. Передайте JWT в заголовке Authorization: Bearer <token>"})

    user_id = caller.get("sub")
    role    = caller.get("role", "user")

    # ── Параметры запроса ─────────────────────────────────────────────────────
    qs = event.get("queryStringParameters") or {}

    sort = qs.get("sort", "created_at")
    if sort not in ALLOWED_SORT:
        sort = "created_at"

    order = qs.get("order", "desc").lower()
    if order not in ("asc", "desc"):
        order = "desc"

    try:
        limit = max(1, min(100, int(qs.get("limit", 50))))
    except (ValueError, TypeError):
        limit = 50

    try:
        offset = max(0, int(qs.get("offset", 0)))
    except (ValueError, TypeError):
        offset = 0

    status_filter = qs.get("status", "all")
    if status_filter not in ALLOWED_STATUS:
        status_filter = "all"

    # ── Построение WHERE-условия по роли ──────────────────────────────────────
    conditions = []
    params: list = []

    if role == "user":
        # Клиент — только свои платежи
        conditions.append("po.user_id = %s::uuid")
        params.append(user_id)
    elif role == "compliance":
        # Compliance — только aml_pending (если не задан другой фильтр явно)
        if status_filter == "all":
            conditions.append("po.status = 'aml_pending'")
        # иначе — фильтр ниже применится
    # admin / superadmin / finance / regulator — без ограничений по user_id

    if status_filter != "all" and role != "compliance":
        conditions.append("po.status = %s")
        params.append(status_filter)
    elif status_filter not in ("all",) and role == "compliance":
        # compliance может запросить конкретный статус явно
        conditions.append("po.status = %s")
        params.append(status_filter)

    where = ("WHERE " + " AND ".join(conditions)) if conditions else ""

    # ── Запрос к БД ───────────────────────────────────────────────────────────
    conn = _db()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:

            count_sql = f"SELECT COUNT(*) AS total FROM payment_orders po {where}"
            cur.execute(count_sql, params)
            total = cur.fetchone()["total"]

            data_sql = f"""
                SELECT
                    po.id,
                    po.user_id,
                    u.email        AS user_email,
                    u.company_name AS user_company,
                    po.from_currency,
                    po.to_currency,
                    po.amount,
                    po.destination_country,
                    po.destination_address,
                    po.status,
                    po.risk_score,
                    po.reject_reason,
                    po.created_at,
                    po.updated_at
                FROM payment_orders po
                LEFT JOIN users u ON u.id = po.user_id
                {where}
                ORDER BY po.{sort} {order}
                LIMIT %s OFFSET %s
            """
            cur.execute(data_sql, params + [limit, offset])
            rows = cur.fetchall()

    finally:
        conn.close()

    items = []
    for r in rows:
        risk = r["risk_score"] or 0
        item = {
            "id":                  str(r["id"]),
            "user_id":             str(r["user_id"]),
            "from_currency":       r["from_currency"],
            "to_currency":         r["to_currency"],
            "amount":              float(r["amount"]),
            "destination_country": r["destination_country"],
            "destination_address": r["destination_address"],
            "status":              r["status"],
            "risk_score":          risk,
            "risk_level":          "high" if risk >= 60 else ("medium" if risk >= 30 else "low"),
            "reject_reason":       r["reject_reason"],
            "created_at":          r["created_at"].isoformat() if r["created_at"] else None,
            "updated_at":          r["updated_at"].isoformat() if r["updated_at"] else None,
        }
        # Полный доступ видит email/компанию отправителя
        if role in FULL_ACCESS_ROLES or role == "compliance":
            item["user_email"]   = r["user_email"]
            item["user_company"] = r["user_company"]

        items.append(item)

    return _resp(200, {
        "items":  items,
        "total":  total,
        "limit":  limit,
        "offset": offset,
        "role":   role,
    })
