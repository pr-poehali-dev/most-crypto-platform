"""
MOST — seed-users
Создаёт демо-аккаунты в БД (вызывается один раз).
GET / — вставляет пользователей и возвращает результат.
"""
import hashlib
import json
import os

import psycopg2
import psycopg2.extras


CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
}

DEMO_USERS = [
    {"email": "user@most.network",       "password": "User1234!",  "company_name": "Demo Company Ltd",   "role": "user",       "salt": "mostsalt_user"},
    {"email": "compliance@most.network", "password": "Comp1234!",  "company_name": "Compliance Corp",    "role": "compliance", "salt": "mostsalt_comp"},
    {"email": "regulator@most.network",  "password": "Reg12345!",  "company_name": "Central Bank Demo",  "role": "regulator",  "salt": "mostsalt_reg"},
    {"email": "admin@most.network",      "password": "Admin123!",  "company_name": "MOST Network",       "role": "superadmin", "salt": "mostsalt_adm"},
    {"email": "jobtravel@bk.ru",         "password": "18081991",   "company_name": "MOST Network",       "role": "superadmin", "salt": "mostsalt_jbt"},
]


def _hash(salt: str, password: str) -> str:
    return hashlib.sha256((salt + password).encode()).hexdigest()


def _db():
    conn = psycopg2.connect(os.environ["DATABASE_URL"])
    conn.autocommit = True
    return conn


def handler(event: dict, context) -> dict:
    """Засеивает демо-пользователей в таблицу users."""
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    conn = _db()
    results = []
    try:
        with conn.cursor() as cur:
            for u in DEMO_USERS:
                ph = f"sha256plain${u['salt']}${_hash(u['salt'], u['password'])}"
                cur.execute(
                    """
                    INSERT INTO users (email, password_hash, company_name, role, status)
                    VALUES (%s, %s, %s, %s, 'active')
                    ON CONFLICT (email) DO UPDATE
                      SET password_hash = EXCLUDED.password_hash,
                          role          = EXCLUDED.role,
                          status        = 'active'
                    RETURNING email, role
                    """,
                    (u["email"], ph, u["company_name"], u["role"]),
                )
                row = cur.fetchone()
                results.append({"email": row[0], "role": row[1]})
    finally:
        conn.close()

    return {
        "statusCode": 200,
        "headers": {**CORS, "Content-Type": "application/json"},
        "body": json.dumps({"ok": True, "seeded": results}, ensure_ascii=False),
    }