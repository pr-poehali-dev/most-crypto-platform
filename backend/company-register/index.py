"""
MOST — company-register
Регистрация компании: создаёт пользователя, KYC-заявку и загружает
документы в S3. После регистрации компания попадает в очередь
на проверку compliance-офицером (status = pending_review).

POST /
Content-Type: multipart/form-data  →  application/json body с base64-документами

Тело запроса (JSON):
{
  "email":          str,
  "password":       str (min 8),
  "company_name":   str,
  "inn":            str (10 или 12 цифр),
  "legal_address":  str,
  "ceo_name":       str,
  "phone":          str,
  "website":        str | null,
  "business_type":  str,
  "monthly_volume": str,
  "doc_charter":    { "name": str, "data": base64_str, "mime": str } | null,
  "doc_ceo_id":     { "name": str, "data": base64_str, "mime": str } | null,
  "doc_extract":    { "name": str, "data": base64_str, "mime": str } | null
}
"""
import base64
import hashlib
import json
import os
import re
import uuid
from datetime import datetime, timezone

import boto3
import psycopg2
import psycopg2.extras

CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
}
MAX_DOC_BYTES = 10 * 1024 * 1024   # 10 МБ
ALLOWED_MIME  = {"application/pdf", "image/jpeg", "image/png", "image/webp"}


def _resp(code: int, body: dict) -> dict:
    return {
        "statusCode": code,
        "headers": {**CORS, "Content-Type": "application/json"},
        "body": json.dumps(body, ensure_ascii=False),
    }


def _db():
    schema = os.environ.get("MAIN_DB_SCHEMA", "public")
    conn = psycopg2.connect(
        os.environ["DATABASE_URL"],
        options=f"-c search_path={schema}",
    )
    conn.autocommit = False
    return conn


def _s3():
    return boto3.client(
        "s3",
        endpoint_url="https://bucket.poehali.dev",
        aws_access_key_id=os.environ["AWS_ACCESS_KEY_ID"],
        aws_secret_access_key=os.environ["AWS_SECRET_ACCESS_KEY"],
    )


def _hash_password(password: str) -> str:
    """bcrypt-совместимый хэш через hashlib (без внешних зависимостей)."""
    import hashlib
    salt = os.urandom(16).hex()
    h = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 260_000)
    return f"pbkdf2$sha256${salt}${h.hex()}"


def _upload_doc(s3_client, company_id: str, key: str, doc: dict) -> str | None:
    """Загружает base64-документ в S3, возвращает CDN-URL."""
    if not doc or not doc.get("data"):
        return None
    raw = base64.b64decode(doc["data"])
    if len(raw) > MAX_DOC_BYTES:
        raise ValueError(f"Документ {key} превышает 10 МБ")
    mime = doc.get("mime", "application/pdf")
    if mime not in ALLOWED_MIME:
        raise ValueError(f"Недопустимый тип файла: {mime}")
    ext = mime.split("/")[-1].replace("jpeg", "jpg")
    s3_key = f"kyc/{company_id}/{key}.{ext}"
    s3_client.put_object(
        Bucket="files",
        Key=s3_key,
        Body=raw,
        ContentType=mime,
    )
    aid = os.environ["AWS_ACCESS_KEY_ID"]
    return f"https://cdn.poehali.dev/projects/{aid}/bucket/{s3_key}"


def _validate(body: dict) -> list[str]:
    errors = []
    if not body.get("email") or not re.fullmatch(r"[^@]+@[^@]+\.[^@]+", body["email"]):
        errors.append("Некорректный email")
    if not body.get("password") or len(body["password"]) < 8:
        errors.append("Пароль минимум 8 символов")
    if not body.get("company_name") or len(body["company_name"].strip()) < 2:
        errors.append("Укажите название компании")
    inn = body.get("inn", "").strip()
    if not re.fullmatch(r"\d{10}|\d{12}", inn):
        errors.append("ИНН должен содержать 10 или 12 цифр")
    for f in ("legal_address", "ceo_name", "phone", "business_type", "monthly_volume"):
        if not body.get(f, "").strip():
            errors.append(f"Поле '{f}' обязательно")
    return errors


def handler(event: dict, context) -> dict:
    """Регистрация компании на платформе MOST с загрузкой KYC-документов."""

    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    try:
        body = json.loads(event.get("body") or "{}")
    except json.JSONDecodeError:
        return _resp(400, {"error": "Невалидный JSON"})

    # Валидация
    errors = _validate(body)
    if errors:
        return _resp(422, {"error": "Ошибка валидации", "details": errors})

    conn = _db()
    try:
        s3 = _s3()
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:

            # 1. Проверка дубля email
            cur.execute("SELECT id FROM users WHERE email = %s", (body["email"].lower(),))
            if cur.fetchone():
                return _resp(409, {"error": "Этот email уже зарегистрирован"})

            # 2. Создаём пользователя
            user_id = str(uuid.uuid4())
            pw_hash = _hash_password(body["password"])
            now = datetime.now(timezone.utc)
            cur.execute(
                """
                INSERT INTO users
                    (id, email, password_hash, company_name, inn, role, status, created_at, updated_at)
                VALUES (%s,%s,%s,%s,%s,'user','pending_kyc',%s,%s)
                """,
                (user_id, body["email"].lower(), pw_hash,
                 body["company_name"].strip(), body["inn"].strip(), now, now),
            )

            # 3. Загружаем документы в S3
            kyc_id = str(uuid.uuid4())
            doc_urls = {}
            for slot in ("doc_charter", "doc_ceo_id", "doc_extract"):
                url = _upload_doc(s3, kyc_id, slot, body.get(slot))
                doc_urls[f"{slot}_url"] = url

            # 4. Создаём KYC-заявку
            cur.execute(
                """
                INSERT INTO kyc_applications (
                    id, user_id, company_name, inn, legal_address,
                    ceo_name, phone, website, business_type, monthly_volume,
                    status, doc_charter_url, doc_ceo_id_url, doc_extract_url,
                    created_at, updated_at
                ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,
                          'pending_review',%s,%s,%s,%s,%s)
                """,
                (
                    kyc_id, user_id,
                    body["company_name"].strip(), body["inn"].strip(),
                    body["legal_address"].strip(), body["ceo_name"].strip(),
                    body["phone"].strip(), body.get("website", ""),
                    body["business_type"], body["monthly_volume"],
                    doc_urls.get("doc_charter_url"),
                    doc_urls.get("doc_ceo_id_url"),
                    doc_urls.get("doc_extract_url"),
                    now, now,
                ),
            )

            # 5. Аудит-лог
            ip = (event.get("requestContext") or {}).get("identity", {}).get("sourceIp")
            cur.execute(
                """
                INSERT INTO audit_logs (user_id, action, details, ip_address)
                VALUES (%s,'company.register',%s,%s)
                """,
                (
                    user_id,
                    json.dumps({
                        "kyc_id": kyc_id,
                        "company_name": body["company_name"],
                        "inn": body["inn"],
                        "docs_uploaded": [k for k, v in doc_urls.items() if v],
                    }),
                    ip,
                ),
            )

            conn.commit()

        return _resp(201, {
            "success": True,
            "user_id": user_id,
            "kyc_id":  kyc_id,
            "status":  "pending_review",
            "message": "Заявка принята. Compliance-офицер проверит её в течение 1 рабочего дня.",
            "docs_uploaded": {k: bool(v) for k, v in doc_urls.items()},
        })

    except ValueError as e:
        conn.rollback()
        return _resp(400, {"error": str(e)})
    except Exception as e:
        conn.rollback()
        return _resp(500, {"error": "Внутренняя ошибка", "detail": str(e)})
    finally:
        conn.close()
