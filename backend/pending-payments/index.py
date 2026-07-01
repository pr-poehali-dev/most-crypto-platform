"""
MOST — pending-payments
Список платежей в статусе aml_pending для compliance-офицера.
Доступ: compliance, admin, superadmin.

GET /
  ?sort_by=risk_score|amount|created_at   (default: risk_score)
  ?order=desc|asc                          (default: desc)
  ?limit=1..100                            (default: 50)
  ?offset=0..                              (default: 0)
"""
import json
import os
from datetime import timezone

ALLOWED_ROLES = {"compliance", "admin", "superadmin"}
ALLOWED_SORT  = {"risk_score", "amount", "created_at"}

CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Authorization",
}


def _resp(code: int, body: dict) -> dict:
    return {
        "statusCode": code,
        "headers": {**CORS, "Content-Type": "application/json"},
        "body": json.dumps(body, ensure_ascii=False, default=str),
    }


def _get_caller(event: dict):
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


def _db():
    import psycopg2
    schema = os.environ.get("MAIN_DB_SCHEMA", "public")
    conn = psycopg2.connect(
        os.environ["DATABASE_URL"],
        options=f"-c search_path={schema}",
    )
    conn.autocommit = True
    return conn


def handler(event: dict, context) -> dict:
    """Возвращает очередь платежей на AML-проверку с сортировкой и пагинацией."""

    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    # --- авторизация --------------------------------------------------------
    caller = _get_caller(event)
    if not caller:
        return _resp(401, {"error": "Требуется авторизация"})
    if caller.get("role", "user") not in ALLOWED_ROLES:
        return _resp(403, {"error": "Недостаточно прав. Требуется роль: compliance / admin"})

    # --- параметры запроса --------------------------------------------------
    qs = event.get("queryStringParameters") or {}

    sort_by = qs.get("sort_by", "risk_score")
    if sort_by not in ALLOWED_SORT:
        sort_by = "risk_score"

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

    # --- запрос к БД --------------------------------------------------------
    conn = _db()
    try:
        import psycopg2.extras
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:

            # Общее количество
            cur.execute(
                "SELECT COUNT(*) AS total FROM payment_orders WHERE status = 'aml_pending'"
            )
            total = cur.fetchone()["total"]

            # Основная выборка с JOIN на users
            cur.execute(
                f"""
                SELECT
                    po.id,
                    po.user_id,
                    u.email            AS user_email,
                    u.company_name     AS user_company,
                    po.from_currency,
                    po.to_currency,
                    po.amount,
                    po.destination_country,
                    po.destination_address,
                    po.risk_score,
                    po.created_at,
                    po.updated_at
                FROM payment_orders po
                LEFT JOIN users u ON u.id = po.user_id
                WHERE po.status = 'aml_pending'
                ORDER BY po.{sort_by} {order}
                LIMIT %s OFFSET %s
                """,
                (limit, offset),
            )
            rows = cur.fetchall()

        items = []
        for r in rows:
            risk = r["risk_score"]
            items.append({
                "id":                   str(r["id"]),
                "user_id":              str(r["user_id"]),
                "user_email":           r["user_email"],
                "user_company":         r["user_company"],
                "from_currency":        r["from_currency"],
                "to_currency":          r["to_currency"],
                "amount":               float(r["amount"]),
                "destination_country":  r["destination_country"],
                "destination_address":  r["destination_address"],
                "risk_score":           risk,
                "risk_level":           "high" if risk >= 60 else ("medium" if risk >= 30 else "low"),
                "created_at":           r["created_at"].isoformat() if r["created_at"] else None,
                "updated_at":           r["updated_at"].isoformat() if r["updated_at"] else None,
            })

        return _resp(200, {
            "total":   total,
            "limit":   limit,
            "offset":  offset,
            "sort_by": sort_by,
            "order":   order,
            "items":   items,
        })

    except Exception as exc:
        return _resp(500, {"error": "Внутренняя ошибка сервера", "detail": str(exc)})
    finally:
        conn.close()
