"""
MOST — kyc-list
Список KYC-заявок для compliance-офицера с фильтрами и пагинацией.
Доступ: роли compliance, admin, superadmin (JWT).

GET /
  ?status=pending_review|approved|rejected|all  (default: pending_review)
  ?limit=1..100                                  (default: 50)
  ?offset=0..
  ?search=строка                                 (по имени / ИНН / email)
"""
import json
import os

import psycopg2
import psycopg2.extras
from jose import JWTError, jwt

ALLOWED_ROLES = {"compliance", "admin", "superadmin"}
CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Authorization",
}


def _resp(code: int, body: dict) -> dict:
    return {"statusCode": code, "headers": {**CORS, "Content-Type": "application/json"},
            "body": json.dumps(body, ensure_ascii=False, default=str)}


def _get_caller(event: dict):
    secret = os.environ.get("JWT_SECRET", "")
    if not secret:
        return None
    header = (event.get("headers") or {}).get("X-Authorization") \
          or (event.get("headers") or {}).get("Authorization") or ""
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
    conn = psycopg2.connect(os.environ["DATABASE_URL"],
                            options=f"-c search_path={schema}")
    conn.autocommit = True
    return conn


def handler(event: dict, context) -> dict:
    """Возвращает очередь KYC-заявок для compliance-офицера."""
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    caller = _get_caller(event)
    if not caller:
        return _resp(401, {"error": "Требуется авторизация"})
    if caller.get("role", "") not in ALLOWED_ROLES:
        return _resp(403, {"error": "Недостаточно прав"})

    qs = event.get("queryStringParameters") or {}
    status_filter = qs.get("status", "pending_review")
    search        = (qs.get("search") or "").strip()
    try:
        limit  = max(1, min(100, int(qs.get("limit",  50))))
        offset = max(0,          int(qs.get("offset",  0)))
    except (ValueError, TypeError):
        limit, offset = 50, 0

    conn = _db()
    try:
        import psycopg2.extras
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            conds, params = [], []

            if status_filter != "all":
                conds.append("k.status = %s")
                params.append(status_filter)

            if search:
                conds.append("(k.company_name ILIKE %s OR k.inn ILIKE %s OR u.email ILIKE %s)")
                like = f"%{search}%"
                params += [like, like, like]

            where = ("WHERE " + " AND ".join(conds)) if conds else ""

            # Общее кол-во
            cur.execute(f"""
                SELECT COUNT(*) AS total
                FROM kyc_applications k
                JOIN users u ON u.id = k.user_id
                {where}
            """, params)
            total = cur.fetchone()["total"]

            # Основная выборка
            cur.execute(f"""
                SELECT
                    k.id, k.user_id,
                    u.email         AS user_email,
                    k.company_name, k.inn, k.legal_address,
                    k.ceo_name,     k.phone,   k.website,
                    k.business_type, k.monthly_volume,
                    k.status,
                    k.doc_charter_url, k.doc_ceo_id_url, k.doc_extract_url,
                    k.reject_reason,
                    k.reviewed_at,
                    rv.email        AS reviewed_by_email,
                    k.created_at,   k.updated_at
                FROM kyc_applications k
                JOIN users u          ON u.id  = k.user_id
                LEFT JOIN users rv    ON rv.id = k.reviewed_by
                {where}
                ORDER BY k.created_at DESC
                LIMIT %s OFFSET %s
            """, params + [limit, offset])
            rows = cur.fetchall()

        # Статистика по статусам
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("""
                SELECT status, COUNT(*) AS cnt
                FROM kyc_applications
                GROUP BY status
            """)
            stats = {r["status"]: r["cnt"] for r in cur.fetchall()}

        return _resp(200, {
            "total":  total,
            "limit":  limit,
            "offset": offset,
            "pages":  max(1, (total + limit - 1) // limit),
            "stats":  stats,
            "items":  [dict(r) for r in rows],
        })
    finally:
        conn.close()
