"""
MOST — kyc-notify
Отправляет email-уведомление компании после решения compliance-офицера.
Вызывается внутренне из kyc-review (или напрямую).

POST /
{
  "kyc_id": "uuid",           -- заявка (читаем email, название из БД)
  "action": "approve"|"reject",
  "reason": "string"          -- обязателен при reject
}

Авторизация: тот же JWT (роль compliance/admin/superadmin).
"""
import json
import os
import smtplib
import ssl
import urllib.parse
from datetime import datetime, timezone
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

import psycopg2
import psycopg2.extras
from jose import JWTError, jwt

ALLOWED_ROLES = {"compliance", "admin", "superadmin"}
PLATFORM_URL  = os.environ.get("PLATFORM_URL", "https://most.network")
FROM_NAME     = "MOST Compliance"

CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Authorization",
}


# ─── helpers ─────────────────────────────────────────────────────────────────
def _resp(code: int, body: dict) -> dict:
    return {"statusCode": code,
            "headers": {**CORS, "Content-Type": "application/json"},
            "body": json.dumps(body, ensure_ascii=False)}


def _get_caller(event: dict):
    secret = os.environ.get("JWT_SECRET", "")
    if not secret:
        return None
    header = ((event.get("headers") or {}).get("X-Authorization")
              or (event.get("headers") or {}).get("Authorization") or "")
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
    conn.autocommit = True
    return conn


def _parse_smtp_url(smtp_url: str) -> dict:
    """smtp://user:pass@host:port → dict."""
    p = urllib.parse.urlparse(smtp_url)
    return {
        "host":     p.hostname,
        "port":     p.port or 587,
        "user":     urllib.parse.unquote(p.username or ""),
        "password": urllib.parse.unquote(p.password or ""),
    }


def _send_email(to: str, subject: str, html: str, text: str):
    smtp_url = os.environ.get("SMTP_URL", "")
    if not smtp_url:
        print(f"[kyc-notify] SMTP_URL не задан — email не отправлен (to={to})")
        return

    cfg = _parse_smtp_url(smtp_url)
    from_addr = cfg["user"]

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"]    = f"{FROM_NAME} <{from_addr}>"
    msg["To"]      = to
    msg.attach(MIMEText(text, "plain", "utf-8"))
    msg.attach(MIMEText(html, "html",  "utf-8"))

    ctx = ssl.create_default_context()
    with smtplib.SMTP(cfg["host"], cfg["port"]) as s:
        s.ehlo()
        s.starttls(context=ctx)
        s.login(cfg["user"], cfg["password"])
        s.sendmail(from_addr, [to], msg.as_bytes())

    print(f"[kyc-notify] ✓ sent to {to} | subject: {subject}")


# ─── HTML-шаблоны ────────────────────────────────────────────────────────────
def _html_approve(company: str, login_url: str) -> tuple[str, str]:
    html = f"""<!DOCTYPE html>
<html lang="ru">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Верификация пройдена — MOST</title></head>
<body style="margin:0;padding:0;background:#0A0A1A;font-family:Arial,sans-serif;color:#fff;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0A0A1A;padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0"
             style="background:#0f0f1f;border:1px solid rgba(0,255,136,0.25);border-radius:16px;overflow:hidden;">

        <!-- Header -->
        <tr><td style="background:linear-gradient(135deg,rgba(0,255,136,0.12),rgba(98,126,234,0.08));
                       padding:36px 40px;border-bottom:1px solid rgba(0,255,136,0.15);">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td>
                <div style="display:inline-block;width:40px;height:40px;background:#00FF88;
                            border-radius:10px;text-align:center;line-height:40px;
                            font-weight:700;font-size:20px;color:#0A0A1A;vertical-align:middle;">M</div>
                <span style="font-size:22px;font-weight:700;margin-left:12px;vertical-align:middle;">MOST</span>
              </td>
              <td align="right">
                <span style="background:rgba(0,255,136,0.12);border:1px solid rgba(0,255,136,0.3);
                             border-radius:20px;padding:4px 14px;font-size:12px;color:#00FF88;
                             letter-spacing:0.1em;">ВЕРИФИЦИРОВАНО</span>
              </td>
            </tr>
          </table>
        </td></tr>

        <!-- Body -->
        <tr><td style="padding:40px;">
          <div style="width:64px;height:64px;background:rgba(0,255,136,0.1);
                      border:2px solid #00FF88;border-radius:50%;margin:0 auto 28px;
                      text-align:center;line-height:60px;font-size:28px;">✓</div>

          <h1 style="margin:0 0 16px;font-size:26px;font-weight:700;text-align:center;
                     letter-spacing:-0.02em;">Верификация пройдена!</h1>

          <p style="color:rgba(255,255,255,0.65);font-size:15px;line-height:1.7;
                    text-align:center;margin:0 0 32px;">
            Компания <strong style="color:#fff;">{company}</strong> успешно верифицирована
            командой MOST Compliance. Ваш аккаунт активирован.
          </p>

          <!-- Что дальше -->
          <table width="100%" cellpadding="0" cellspacing="0"
                 style="background:rgba(0,255,136,0.05);border:1px solid rgba(0,255,136,0.18);
                        border-radius:12px;padding:24px;margin-bottom:32px;">
            <tr><td>
              <p style="font-size:12px;color:rgba(255,255,255,0.4);letter-spacing:0.12em;
                        margin:0 0 16px;font-family:monospace;">ЧТО ТЕПЕРЬ ДОСТУПНО</p>
              {"".join(f'<div style="display:flex;align-items:flex-start;gap:10px;margin-bottom:12px;"><span style="color:#00FF88;font-size:16px;line-height:1;">✓</span><span style="font-size:14px;color:rgba(255,255,255,0.8);line-height:1.5;">{f}</span></div>' for f in [
                'Отправка и получение крипто-платежей через 20+ сетей',
                'Swarm-маршрутизация для крупных переводов',
                'API-доступ для интеграции с вашими системами',
                'Персональный compliance-менеджер',
              ])}
            </td></tr>
          </table>

          <!-- CTA -->
          <div style="text-align:center;margin-bottom:32px;">
            <a href="{login_url}"
               style="display:inline-block;background:#00FF88;color:#0A0A1A;
                      padding:15px 40px;border-radius:12px;font-weight:700;font-size:16px;
                      text-decoration:none;box-shadow:0 0 24px rgba(0,255,136,0.4);">
              Войти в платформу →
            </a>
          </div>

          <p style="font-size:13px;color:rgba(255,255,255,0.3);text-align:center;margin:0;">
            Или перейдите по ссылке:<br>
            <a href="{login_url}" style="color:rgba(0,255,136,0.7);">{login_url}</a>
          </p>
        </td></tr>

        <!-- Footer -->
        <tr><td style="padding:20px 40px;border-top:1px solid rgba(255,255,255,0.07);
                       text-align:center;">
          <p style="font-size:12px;color:rgba(255,255,255,0.25);margin:0 0 4px;">
            MOST © {datetime.now().year} · Swarm Payment Network
          </p>
          <p style="font-size:11px;color:rgba(255,255,255,0.2);margin:0;">
            Лицензировано в рамках ЭПР ЦБ РФ №258-ФЗ
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>"""

    text = f"""Верификация пройдена — MOST

Компания {company} успешно верифицирована командой MOST Compliance.
Ваш аккаунт активирован.

Войти в платформу: {login_url}

---
MOST © {datetime.now().year} · Swarm Payment Network
Лицензировано в рамках ЭПР ЦБ РФ №258-ФЗ"""

    return html, text


def _html_reject(company: str, reason: str, reapply_url: str) -> tuple[str, str]:
    html = f"""<!DOCTYPE html>
<html lang="ru">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Заявка отклонена — MOST</title></head>
<body style="margin:0;padding:0;background:#0A0A1A;font-family:Arial,sans-serif;color:#fff;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0A0A1A;padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0"
             style="background:#0f0f1f;border:1px solid rgba(255,68,68,0.25);border-radius:16px;overflow:hidden;">

        <!-- Header -->
        <tr><td style="background:rgba(255,68,68,0.06);
                       padding:36px 40px;border-bottom:1px solid rgba(255,68,68,0.12);">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td>
                <div style="display:inline-block;width:40px;height:40px;background:#00FF88;
                            border-radius:10px;text-align:center;line-height:40px;
                            font-weight:700;font-size:20px;color:#0A0A1A;vertical-align:middle;">M</div>
                <span style="font-size:22px;font-weight:700;margin-left:12px;vertical-align:middle;">MOST</span>
              </td>
              <td align="right">
                <span style="background:rgba(255,68,68,0.12);border:1px solid rgba(255,68,68,0.3);
                             border-radius:20px;padding:4px 14px;font-size:12px;color:#ff8888;
                             letter-spacing:0.1em;">ЗАЯВКА ОТКЛОНЕНА</span>
              </td>
            </tr>
          </table>
        </td></tr>

        <!-- Body -->
        <tr><td style="padding:40px;">
          <h1 style="margin:0 0 16px;font-size:24px;font-weight:700;text-align:center;">
            Заявка требует доработки
          </h1>

          <p style="color:rgba(255,255,255,0.65);font-size:15px;line-height:1.7;
                    text-align:center;margin:0 0 28px;">
            К сожалению, заявка компании <strong style="color:#fff;">{company}</strong>
            не прошла проверку compliance. Ниже указана причина.
          </p>

          <!-- Причина -->
          <table width="100%" cellpadding="0" cellspacing="0"
                 style="background:rgba(255,68,68,0.06);border:1px solid rgba(255,68,68,0.2);
                        border-radius:12px;padding:24px;margin-bottom:28px;">
            <tr><td>
              <p style="font-size:11px;color:rgba(255,136,136,0.6);letter-spacing:0.12em;
                        margin:0 0 10px;font-family:monospace;">ПРИЧИНА ОТКЛОНЕНИЯ</p>
              <p style="font-size:15px;color:#ffaaaa;line-height:1.6;margin:0;">
                {reason}
              </p>
            </td></tr>
          </table>

          <!-- Что делать -->
          <table width="100%" cellpadding="0" cellspacing="0"
                 style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);
                        border-radius:12px;padding:24px;margin-bottom:32px;">
            <tr><td>
              <p style="font-size:12px;color:rgba(255,255,255,0.4);letter-spacing:0.12em;
                        margin:0 0 14px;font-family:monospace;">КАК ИСПРАВИТЬ</p>
              {"".join(f'<div style="display:flex;align-items:flex-start;gap:10px;margin-bottom:10px;"><span style="color:rgba(255,255,255,0.3);">→</span><span style="font-size:14px;color:rgba(255,255,255,0.65);line-height:1.5;">{s}</span></div>' for s in [
                'Устраните указанную причину отклонения',
                'Подготовьте полный комплект документов: устав, паспорт директора, выписка ЕГРЮЛ',
                'Подайте заявку повторно через форму регистрации',
              ])}
            </td></tr>
          </table>

          <!-- CTA -->
          <div style="text-align:center;margin-bottom:32px;">
            <a href="{reapply_url}"
               style="display:inline-block;background:transparent;color:#fff;
                      padding:14px 36px;border-radius:12px;font-weight:600;font-size:15px;
                      text-decoration:none;border:1px solid rgba(255,255,255,0.2);">
              Подать повторную заявку →
            </a>
          </div>

          <p style="font-size:13px;color:rgba(255,255,255,0.35);text-align:center;margin:0;">
            Вопросы? Напишите нам:
            <a href="mailto:compliance@most.network"
               style="color:rgba(0,255,136,0.7);">compliance@most.network</a>
          </p>
        </td></tr>

        <!-- Footer -->
        <tr><td style="padding:20px 40px;border-top:1px solid rgba(255,255,255,0.07);
                       text-align:center;">
          <p style="font-size:12px;color:rgba(255,255,255,0.25);margin:0 0 4px;">
            MOST © {datetime.now().year} · Swarm Payment Network
          </p>
          <p style="font-size:11px;color:rgba(255,255,255,0.2);margin:0;">
            Лицензировано в рамках ЭПР ЦБ РФ №258-ФЗ
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>"""

    text = f"""Заявка требует доработки — MOST

Заявка компании {company} не прошла проверку compliance.

Причина отклонения:
{reason}

Что делать:
→ Устраните указанную причину
→ Подготовьте полный комплект документов
→ Подайте заявку повторно: {reapply_url}

Вопросы: compliance@most.network

---
MOST © {datetime.now().year} · Swarm Payment Network"""

    return html, text


# ─── Handler ─────────────────────────────────────────────────────────────────
def handler(event: dict, context) -> dict:
    """Отправляет email-уведомление о результате KYC-проверки."""
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
        return _resp(400, {"error": "kyc_id обязателен"})
    if action not in ("approve", "reject"):
        return _resp(400, {"error": "action: 'approve' или 'reject'"})
    if action == "reject" and not reason:
        return _resp(400, {"error": "reason обязателен при отклонении"})

    conn = _db()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("""
                SELECT k.company_name, k.status, u.email
                FROM kyc_applications k
                JOIN users u ON u.id = k.user_id
                WHERE k.id = %s
            """, (kyc_id,))
            row = cur.fetchone()
    finally:
        conn.close()

    if not row:
        return _resp(404, {"error": "Заявка не найдена"})

    to_email     = row["email"]
    company_name = row["company_name"]
    login_url    = f"{PLATFORM_URL}/login"
    register_url = f"{PLATFORM_URL}/register"

    if action == "approve":
        subject      = f"✅ Верификация пройдена — добро пожаловать в MOST, {company_name}!"
        html, text   = _html_approve(company_name, login_url)
    else:
        subject      = f"⚠️ Заявка на верификацию требует доработки — MOST"
        html, text   = _html_reject(company_name, reason, register_url)

    try:
        _send_email(to_email, subject, html, text)
    except Exception as exc:
        return _resp(502, {"error": "Ошибка отправки email", "detail": str(exc)})

    return _resp(200, {
        "sent":     True,
        "to":       to_email,
        "action":   action,
        "kyc_id":   kyc_id,
        "subject":  subject,
        "sent_at":  datetime.now(timezone.utc).isoformat(),
    })
