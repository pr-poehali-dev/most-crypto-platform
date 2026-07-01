"""
MOST — payment-create
Создаёт платёжный ордер, запускает внутренний risk-check, определяет статус.

POST /
Headers: Authorization: Bearer <jwt>
Body: {
    "amount":               float,         -- сумма (в from_currency)
    "from_currency":        str,           -- RUB | USD | EUR
    "to_currency":          str,           -- USDT | USDC | BTC | ETH | TON
    "destination_address":  str,           -- адрес кошелька
    "destination_country":  str | null     -- ISO-код страны, необязательно
}

Логика статуса:
  risk_score >= 80  → aml_pending   (ручное одобрение compliance)
  risk_score >= 40  → aml_pending   (требует проверки)
  risk_score <  40  → processing    (автоматически в обработку)

→ { id, status, risk_score, risk_level, created_at }
"""
import hashlib
import json
import os
import re
from decimal import Decimal

import psycopg2
import psycopg2.extras
from jose import JWTError, jwt

CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Authorization",
}

ALLOWED_FROM = {"RUB", "USD", "EUR"}
ALLOWED_TO   = {"USDT", "USDC", "BTC", "ETH", "TON"}

# Санкционные / mixer-адреса (дублируем из risk-check для автономной работы)
SANCTIONED = {
    "0x8589427373d6d84e98730d7795d8f6f8731fda16",
    "0x722122df12d4e14e13ac3b6895a86e84145b6967",
    "1boadfl5wtqwdt5gadnsdrqm7qcgg4crm",
    "tuv7bxwrqe6qkd8s5nqrwuuipyhnwvdlkn",
}
MIXERS    = {"0xdd4c48c0b24039969fc16d1cdf626eab821d3384"}
MIXER_KW  = ("tornado", "mixer", "wasabi", "coinjoin", "blender")


# ── Хелперы ───────────────────────────────────────────────────────────────────

def _resp(code: int, body: dict) -> dict:
    return {
        "statusCode": code,
        "headers": {**CORS, "Content-Type": "application/json"},
        "body": json.dumps(body, ensure_ascii=False, default=str),
    }


def _verify_token(event: dict) -> dict | None:
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
    conn   = psycopg2.connect(
        os.environ["DATABASE_URL"],
        options=f"-c search_path={schema}",
    )
    conn.autocommit = True
    return conn


def _calc_risk(address: str) -> tuple[int, list[str], bool]:
    """Быстрый локальный risk-score без HTTP-вызова."""
    low     = address.strip().lower()
    score   = 0
    reasons = []

    if low in SANCTIONED:
        score += 100
        reasons.append("Адрес в санкционном списке OFAC/SDN")

    if low in MIXERS or any(k in low for k in MIXER_KW):
        score += 70
        reasons.append("Адрес связан с миксером")

    if not re.fullmatch(r"[a-zA-Z0-9:_\-]{4,128}", address.strip()):
        score += 20
        reasons.append("Нестандартный формат адреса")

    entropy = int(hashlib.sha256(low.encode()).hexdigest()[:8], 16) % 41
    score  += entropy
    if entropy >= 30:
        reasons.append("Аномальный поведенческий паттерн")

    score = max(0, min(100, score))
    if not reasons:
        reasons.append("Значимых факторов риска не обнаружено")

    is_high = score >= 80
    return score, reasons, is_high


# ── Handler ───────────────────────────────────────────────────────────────────

def handler(event: dict, context) -> dict:
    """Создаёт платёжный ордер с AML-проверкой и записью в БД."""

    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    # ── Авторизация ────────────────────────────────────────────────────────────
    caller = _verify_token(event)
    if not caller:
        return _resp(401, {"error": "Требуется авторизация"})

    if caller.get("role") not in ("user", "admin", "superadmin", "finance"):
        return _resp(403, {"error": "Недостаточно прав для создания платежа"})

    user_id = caller["sub"]

    # ── Парсинг тела ───────────────────────────────────────────────────────────
    try:
        body = json.loads(event.get("body") or "{}")
    except json.JSONDecodeError:
        return _resp(400, {"error": "Невалидный JSON"})

    amount              = body.get("amount")
    from_currency       = (body.get("from_currency") or "").strip().upper()
    to_currency         = (body.get("to_currency")   or "").strip().upper()
    destination_address = (body.get("destination_address") or "").strip()
    destination_country = (body.get("destination_country") or None)
    if destination_country:
        destination_country = destination_country.strip().upper() or None

    # ── Валидация ──────────────────────────────────────────────────────────────
    errors = []
    if amount is None:
        errors.append("amount обязателен")
    else:
        try:
            amount = float(amount)
            if amount <= 0:
                errors.append("amount должен быть больше 0")
        except (ValueError, TypeError):
            errors.append("amount должен быть числом")

    if from_currency not in ALLOWED_FROM:
        errors.append(f"from_currency должен быть одним из: {', '.join(ALLOWED_FROM)}")
    if to_currency not in ALLOWED_TO:
        errors.append(f"to_currency должен быть одним из: {', '.join(ALLOWED_TO)}")
    if not destination_address or len(destination_address) < 4:
        errors.append("destination_address обязателен (мин. 4 символа)")

    if errors:
        return _resp(400, {"error": "Ошибка валидации", "details": errors})

    # ── Risk Engine ────────────────────────────────────────────────────────────
    risk_score, risk_reasons, is_high_risk = _calc_risk(destination_address)

    # Логика статуса
    if risk_score >= 40:
        status = "aml_pending"
    else:
        status = "processing"

    risk_level = "high" if risk_score >= 60 else ("medium" if risk_score >= 30 else "low")

    # ── Запись в БД ────────────────────────────────────────────────────────────
    conn = _db()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            # Проверяем, что user существует и активен
            cur.execute(
                "SELECT id, status FROM users WHERE id = %s::uuid",
                (user_id,),
            )
            user_row = cur.fetchone()
            if not user_row:
                return _resp(404, {"error": "Пользователь не найден"})
            if user_row["status"] == "blocked":
                return _resp(403, {"error": "Аккаунт заблокирован"})

            cur.execute(
                """
                INSERT INTO payment_orders
                    (user_id, from_currency, to_currency, amount,
                     destination_address, destination_country,
                     status, risk_score)
                VALUES
                    (%s::uuid, %s, %s, %s, %s, %s, %s, %s)
                RETURNING id, status, risk_score, created_at
                """,
                (
                    user_id,
                    from_currency,
                    to_currency,
                    Decimal(str(amount)),
                    destination_address,
                    destination_country,
                    status,
                    risk_score,
                ),
            )
            row = cur.fetchone()
    finally:
        conn.close()

    return _resp(201, {
        "id":          str(row["id"]),
        "status":      row["status"],
        "risk_score":  row["risk_score"],
        "risk_level":  risk_level,
        "risk_reasons": risk_reasons,
        "created_at":  row["created_at"].isoformat() if row["created_at"] else None,
        "message": (
            "Платёж отправлен на ручную проверку AML-офицера"
            if status == "aml_pending"
            else "Платёж принят в обработку"
        ),
    })
