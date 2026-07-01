"""
MOST — auth-login
Аутентификация по email + password, выдаёт JWT.
Поддерживает оба формата хэшей:
  - pbkdf2$sha256$salt$hash (формат company-register)
  - bcrypt $2b$ (формат admin-сида из SQL)

POST /
{ "email": str, "password": str }
→ { access_token, token_type, user: { id, email, company_name, role, status } }
"""
import hashlib
import json
import os
import uuid
from datetime import datetime, timedelta, timezone

import psycopg2
import psycopg2.extras
from jose import jwt

CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
}
TOKEN_EXPIRE_HOURS = 24


def _resp(code: int, body: dict) -> dict:
    return {"statusCode": code,
            "headers": {**CORS, "Content-Type": "application/json"},
            "body": json.dumps(body, ensure_ascii=False)}


def _db():
    schema = os.environ.get("MAIN_DB_SCHEMA", "public")
    conn = psycopg2.connect(os.environ["DATABASE_URL"],
                            options=f"-c search_path={schema}")
    conn.autocommit = True
    return conn


def _verify_pbkdf2(password: str, stored: str) -> bool:
    """Проверяет pbkdf2$sha256$salt$hash (формат company-register)."""
    try:
        parts = stored.split("$")
        if len(parts) != 4 or parts[0] != "pbkdf2":
            return False
        _, algo, salt, stored_hash = parts
        candidate = hashlib.pbkdf2_hmac(
            algo, password.encode(), salt.encode(), 260_000
        ).hex()
        return candidate == stored_hash
    except Exception:
        return False


def _verify_bcrypt(password: str, stored: str) -> bool:
    """Проверяет bcrypt (формат старых пользователей)."""
    try:
        import bcrypt  # опциональный импорт
        return bcrypt.checkpw(password.encode(), stored.encode())
    except Exception:
        return False


def _verify_password(password: str, stored: str) -> bool:
    if stored.startswith("pbkdf2$"):
        return _verify_pbkdf2(password, stored)
    if stored.startswith("$2b$") or stored.startswith("$2a$"):
        return _verify_bcrypt(password, stored)
    return False


def _make_token(user: dict) -> str:
    secret = os.environ.get("JWT_SECRET", "most-dev-secret-change-in-prod")
    payload = {
        "sub":   str(user["id"]),
        "email": user["email"],
        "role":  user["role"],
        "exp":   datetime.now(timezone.utc) + timedelta(hours=TOKEN_EXPIRE_HOURS),
        "iat":   datetime.now(timezone.utc),
        "jti":   str(uuid.uuid4()),
    }
    return jwt.encode(payload, secret, algorithm="HS256")


def handler(event: dict, context) -> dict:
    """Вход по email + пароль, возвращает JWT и данные пользователя."""
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    try:
        body = json.loads(event.get("body") or "{}")
    except json.JSONDecodeError:
        return _resp(400, {"error": "Невалидный JSON"})

    email    = (body.get("email") or "").strip().lower()
    password = (body.get("password") or "").strip()

    if not email or not password:
        return _resp(400, {"error": "Email и пароль обязательны"})

    conn = _db()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                "SELECT id, email, password_hash, company_name, inn, role, status "
                "FROM users WHERE email = %s",
                (email,),
            )
            user = cur.fetchone()
    finally:
        conn.close()

    if not user:
        return _resp(401, {"error": "Неверный email или пароль"})

    if not _verify_password(password, user["password_hash"]):
        return _resp(401, {"error": "Неверный email или пароль"})

    if user["status"] == "blocked":
        return _resp(403, {"error": "Аккаунт заблокирован. Обратитесь в support@most.network"})

    if user["status"] == "pending_kyc":
        # Разрешаем войти, но сигнализируем о необходимости KYC
        pass

    token = _make_token(dict(user))

    return _resp(200, {
        "access_token": token,
        "token_type":   "bearer",
        "expires_in":   TOKEN_EXPIRE_HOURS * 3600,
        "user": {
            "id":           str(user["id"]),
            "email":        user["email"],
            "company_name": user["company_name"],
            "inn":          user["inn"],
            "role":         user["role"],
            "status":       user["status"],
        },
    })
