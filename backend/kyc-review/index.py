"""
MOST — kyc-review
Верификация / отклонение KYC-заявки compliance-офицером.
Обновляет статус заявки и пользователя, пишет в audit_log.

POST /
{
  "kyc_id":  "uuid",
  "action":  "approve" | "reject",
  "reason":  "string (обязателен при reject)"
}
"""
import json
import os
from datetime import datetime, timezone

import psycopg2
import psycopg2.extras
from jose import JWTError, jwt

ALLOWED_ROLES = {"compliance", "admin", "superadmin"}
CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Authorization",
}


def _resp(code: int, body: dict) -> dict:
    return {"statusCode": code, "headers": {**CORS, "Content-Type": "application/json"},
            "body": json.dumps(body, ensure_ascii=False)}


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
    schema = os.environ.get("MAIN_DB_SCHEMA", "public")
    conn = psycopg2.connect(os.environ["DATABASE_URL"],
                            options=f"-c search_path={schema}")
    conn.autocommit = False
    return conn


def handler(event: dict, context) -> dict:
    """Одобряет или отклоняет KYC-заявку. Меняет статус пользователя."""
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    caller = _get_caller(event)
    if not caller:
        return _resp(401, {"error": "Требуется авторизация"})
    if caller.get("role", "") not in ALLOWED_ROLES:
        return _resp(403, {"error": "Недостаточно прав"})

    try:
        body = json.loads(event.get("body") or "{}")
    except json.JSONDecodeError:
        return _resp(400, {"error": "Невалидный JSON"})

    kyc_id = (body.get("kyc_id") or "").strip()
    action = (body.get("action") or "").strip().lower()
    reason = (body.get("reason") or "").strip()

    if not kyc_id:
        return _resp(400, {"error": "Поле kyc_id обязательно"})
    if action not in ("approve", "reject"):
        return _resp(400, {"error": "action: 'approve' или 'reject'"})
    if action == "reject" and not reason:
        return _resp(400, {"error": "При отклонении укажите reason"})

    reviewer_id = caller.get("sub")
    now = datetime.now(timezone.utc)

    conn = _db()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            # 1. Загружаем заявку
            cur.execute(
                "SELECT id, user_id, status, company_name, inn FROM kyc_applications WHERE id = %s",
                (kyc_id,),
            )
            kyc = cur.fetchone()
            if not kyc:
                return _resp(404, {"error": "Заявка не найдена"})
            if kyc["status"] not in ("pending_review",):
                return _resp(409, {"error": "Заявка уже обработана", "current_status": kyc["status"]})

            new_kyc_status  = "approved"  if action == "approve" else "rejected"
            new_user_status = "active"    if action == "approve" else "blocked"

            # 2. Обновляем KYC-заявку
            cur.execute("""
                UPDATE kyc_applications
                   SET status        = %s,
                       reviewed_by   = %s,
                       reviewed_at   = %s,
                       reject_reason = %s,
                       updated_at    = %s
                 WHERE id = %s
            """, (new_kyc_status, reviewer_id, now, reason or None, now, kyc_id))

            # 3. Обновляем статус пользователя
            cur.execute("""
                UPDATE users
                   SET status     = %s,
                       updated_at = %s
                 WHERE id = %s
            """, (new_user_status, now, str(kyc["user_id"])))

            # 4. Аудит
            ip = (event.get("requestContext") or {}).get("identity", {}).get("sourceIp")
            cur.execute("""
                INSERT INTO audit_logs (user_id, action, details, ip_address)
                VALUES (%s, %s, %s, %s)
            """, (
                reviewer_id,
                f"kyc.{action}",
                json.dumps({
                    "kyc_id":       kyc_id,
                    "company_name": kyc["company_name"],
                    "inn":          kyc["inn"],
                    "reason":       reason or None,
                }),
                ip,
            ))

            conn.commit()

        return _resp(200, {
            "kyc_id":        kyc_id,
            "action":        action,
            "new_status":    new_kyc_status,
            "user_status":   new_user_status,
            "reviewed_by":   reviewer_id,
            "reviewed_at":   now.isoformat(),
            **({"reject_reason": reason} if action == "reject" else {}),
        })

    except Exception as exc:
        conn.rollback()
        return _resp(500, {"error": "Внутренняя ошибка", "detail": str(exc)})
    finally:
        conn.close()
