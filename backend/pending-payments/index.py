"""
MOST — compliance-api (pending-payments slot)
Единая точка для всех compliance-операций.
Доступ: compliance, admin, superadmin, finance.

GET  /?resource=stats
GET  /?resource=queue   (список aml_pending)
GET  /?resource=frozen
GET  /?resource=audit&limit=&offset=&action=&user_id=&date_from=&date_to=
POST / { resource: "freeze"|"unfreeze"|"escalate", user_id, reason }
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

COMPLIANCE_EMAIL = "compliance@most.network"
PLATFORM_URL     = os.environ.get("PLATFORM_URL", "https://most.network")


# ─── SMTP ─────────────────────────────────────────────────────────────────────
def _parse_smtp(url: str) -> dict:
    p = urllib.parse.urlparse(url)
    return {"host": p.hostname, "port": p.port or 587,
            "user": urllib.parse.unquote(p.username or ""),
            "password": urllib.parse.unquote(p.password or "")}


def _send_email(to: str, subject: str, html: str, text: str) -> bool:
    smtp_url = os.environ.get("SMTP_URL", "")
    if not smtp_url:
        print(f"[freeze-notify] SMTP_URL не задан — письмо НЕ отправлено (to={to})")
        return False
    cfg = _parse_smtp(smtp_url)
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"]    = f"MOST Compliance <{cfg['user']}>"
    msg["To"]      = to
    msg.attach(MIMEText(text, "plain", "utf-8"))
    msg.attach(MIMEText(html, "html",  "utf-8"))
    ctx = ssl.create_default_context()
    with smtplib.SMTP(cfg["host"], cfg["port"]) as s:
        s.ehlo(); s.starttls(context=ctx)
        s.login(cfg["user"], cfg["password"])
        s.sendmail(cfg["user"], [to], msg.as_bytes())
    print(f"[freeze-notify] ✓ sent to {to}")
    return True


# ─── HTML-шаблон заморозки ─────────────────────────────────────────────────────
def _build_freeze_email(company: str, reason: str, year: int) -> tuple[str, str]:
    contact_url   = f"{PLATFORM_URL}/support"
    compliance_em = COMPLIANCE_EMAIL

    html = f"""<!DOCTYPE html>
<html lang="ru">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Аккаунт временно заморожен — MOST</title></head>
<body style="margin:0;padding:0;background:#0A0A1A;font-family:Arial,sans-serif;color:#fff;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0A0A1A;padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0"
             style="background:#0f0f1f;border:1px solid rgba(255,68,68,0.3);border-radius:16px;overflow:hidden;">

        <!-- Header -->
        <tr><td style="background:linear-gradient(135deg,rgba(255,68,68,0.10),rgba(255,68,68,0.04));
                       padding:32px 40px;border-bottom:1px solid rgba(255,68,68,0.15);">
          <table width="100%" cellpadding="0" cellspacing="0"><tr>
            <td>
              <div style="display:inline-block;width:38px;height:38px;background:#00FF88;border-radius:9px;
                          text-align:center;line-height:38px;font-weight:700;font-size:19px;
                          color:#0A0A1A;vertical-align:middle;">M</div>
              <span style="font-size:20px;font-weight:700;margin-left:10px;vertical-align:middle;">MOST</span>
            </td>
            <td align="right">
              <span style="background:rgba(255,68,68,0.12);border:1px solid rgba(255,68,68,0.35);
                           border-radius:20px;padding:4px 14px;font-size:11px;color:#FF6666;
                           letter-spacing:0.1em;font-family:monospace;">АККАУНТ ЗАМОРОЖЕН</span>
            </td>
          </tr></table>
        </td></tr>

        <!-- Body -->
        <tr><td style="padding:40px;">

          <!-- Icon -->
          <div style="width:68px;height:68px;background:rgba(255,68,68,0.1);border:2px solid #FF4444;
                      border-radius:50%;margin:0 auto 28px;text-align:center;line-height:64px;font-size:28px;">
            🔒
          </div>

          <h1 style="margin:0 0 12px;font-size:24px;font-weight:700;text-align:center;letter-spacing:-0.02em;">
            Ваш аккаунт временно заморожен
          </h1>

          <p style="color:rgba(255,255,255,0.6);font-size:15px;line-height:1.7;text-align:center;margin:0 0 28px;">
            Аккаунт компании <strong style="color:#fff;">{company}</strong>
            на платформе MOST был временно заморожен командой Compliance.
          </p>

          <!-- Причина -->
          <table width="100%" cellpadding="0" cellspacing="0"
                 style="background:rgba(255,68,68,0.06);border:1px solid rgba(255,68,68,0.2);
                        border-radius:12px;margin-bottom:28px;">
            <tr><td style="padding:20px 24px;">
              <p style="font-size:11px;color:rgba(255,255,255,0.35);letter-spacing:0.12em;
                        margin:0 0 10px;font-family:monospace;">ПРИЧИНА ЗАМОРОЗКИ</p>
              <p style="font-size:15px;color:rgba(255,255,255,0.9);line-height:1.6;margin:0;">
                {reason}
              </p>
            </td></tr>
          </table>

          <!-- Что делать -->
          <table width="100%" cellpadding="0" cellspacing="0"
                 style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);
                        border-radius:12px;margin-bottom:28px;">
            <tr><td style="padding:20px 24px;">
              <p style="font-size:11px;color:rgba(255,255,255,0.35);letter-spacing:0.12em;
                        margin:0 0 14px;font-family:monospace;">ДЛЯ РАЗБЛОКИРОВКИ</p>
              {"".join(f'<div style="display:flex;align-items:flex-start;gap:10px;margin-bottom:10px;"><span style="color:#FFAA00;font-size:14px;line-height:1.4;">→</span><span style="font-size:14px;color:rgba(255,255,255,0.75);line-height:1.5;">{s}</span></div>' for s in [
                f'Напишите на <a href="mailto:{compliance_em}" style="color:#00FF88;">{compliance_em}</a> с темой «Разблокировка аккаунта»',
                'Укажите ИНН компании и ваш контактный номер телефона',
                'Compliance-менеджер свяжется с вами в течение 1 рабочего дня',
              ])}
            </td></tr>
          </table>

          <!-- CTA -->
          <div style="text-align:center;margin-bottom:28px;">
            <a href="mailto:{compliance_em}?subject=Разблокировка аккаунта {company}"
               style="display:inline-block;background:#FFAA00;color:#0A0A1A;
                      padding:13px 36px;border-radius:10px;font-weight:700;font-size:15px;
                      text-decoration:none;">
              Написать в Compliance →
            </a>
          </div>

          <p style="font-size:12px;color:rgba(255,255,255,0.25);text-align:center;margin:0;">
            Если вы считаете, что произошла ошибка — также напишите на
            <a href="mailto:{compliance_em}" style="color:rgba(0,255,136,0.5);">{compliance_em}</a>
          </p>
        </td></tr>

        <!-- Footer -->
        <tr><td style="padding:18px 40px;border-top:1px solid rgba(255,255,255,0.07);text-align:center;">
          <p style="font-size:12px;color:rgba(255,255,255,0.2);margin:0 0 4px;">
            MOST © {year} · Swarm Payment Network
          </p>
          <p style="font-size:11px;color:rgba(255,255,255,0.15);margin:0;">
            Это автоматическое уведомление платформы. Не отвечайте на это письмо.
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body></html>"""

    text = f"""Ваш аккаунт временно заморожен — MOST

Аккаунт компании {company} на платформе MOST был временно заморожен командой Compliance.

ПРИЧИНА: {reason}

Для разблокировки:
1. Напишите на {compliance_em} с темой «Разблокировка аккаунта»
2. Укажите ИНН компании и контактный телефон
3. Compliance-менеджер свяжется с вами в течение 1 рабочего дня

---
MOST © {year} · Swarm Payment Network
"""
    return html, text

ALLOWED_ROLES = {"compliance", "admin", "superadmin", "finance"}
CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Authorization",
}


def _resp(code: int, body: dict) -> dict:
    return {"statusCode": code, "headers": {**CORS, "Content-Type": "application/json"},
            "body": json.dumps(body, ensure_ascii=False, default=str)}


def _verify(event: dict) -> dict | None:
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
    conn   = psycopg2.connect(os.environ["DATABASE_URL"], options=f"-c search_path={schema}")
    conn.autocommit = True
    return conn


def get_stats(conn) -> dict:
    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute("SELECT COUNT(*) AS n FROM payment_orders WHERE status = 'aml_pending'")
        pending = int(cur.fetchone()["n"])
        cur.execute("SELECT COUNT(*) AS n FROM payment_orders WHERE status = 'processing' AND DATE(approved_at) = CURRENT_DATE")
        approved_today = int(cur.fetchone()["n"])
        cur.execute("SELECT COUNT(*) AS n FROM payment_orders WHERE status = 'rejected' AND DATE(approved_at) = CURRENT_DATE")
        rejected_today = int(cur.fetchone()["n"])
        cur.execute("SELECT COUNT(*) AS n FROM payment_orders WHERE status = 'aml_pending' AND risk_score >= 80")
        high_risk = int(cur.fetchone()["n"])
        cur.execute("SELECT COUNT(*) AS n FROM users WHERE status = 'blocked'")
        frozen = int(cur.fetchone()["n"])
        cur.execute("""
            SELECT DATE(created_at) AS date, ROUND(AVG(risk_score)) AS avg_score, COUNT(*) AS count
            FROM payment_orders WHERE created_at >= NOW() - INTERVAL '14 days'
            GROUP BY DATE(created_at) ORDER BY date
        """)
        risk_by_day = [{"date": str(r["date"]), "avg_score": int(r["avg_score"] or 0), "count": int(r["count"])} for r in cur.fetchall()]
        cur.execute("""
            SELECT destination_address AS address, MAX(risk_score) AS score, COUNT(*) AS count
            FROM payment_orders WHERE risk_score >= 50
            GROUP BY destination_address ORDER BY score DESC, count DESC LIMIT 5
        """)
        top_suspicious = [{"address": r["address"], "score": int(r["score"]), "count": int(r["count"])} for r in cur.fetchall()]
    return {"pending": pending, "approved_today": approved_today, "rejected_today": rejected_today,
            "high_risk": high_risk, "frozen": frozen, "risk_by_day": risk_by_day, "top_suspicious": top_suspicious}


def get_queue(conn, qs: dict) -> dict:
    sort_by = qs.get("sort_by", "risk_score")
    if sort_by not in ("risk_score", "amount", "created_at"):
        sort_by = "risk_score"
    order = "asc" if qs.get("order") == "asc" else "desc"
    try:
        limit  = max(1, min(100, int(qs.get("limit",  50))))
        offset = max(0, int(qs.get("offset", 0)))
    except (ValueError, TypeError):
        limit, offset = 50, 0
    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute("SELECT COUNT(*) AS total FROM payment_orders WHERE status = 'aml_pending'")
        total = int(cur.fetchone()["total"])
        cur.execute(f"""
            SELECT po.id, po.user_id, u.email AS user_email, u.company_name AS user_company,
                   po.from_currency, po.to_currency, po.amount, po.destination_country,
                   po.destination_address, po.risk_score, po.created_at
            FROM payment_orders po LEFT JOIN users u ON u.id = po.user_id
            WHERE po.status = 'aml_pending'
            ORDER BY po.{sort_by} {order} LIMIT %s OFFSET %s
        """, (limit, offset))
        rows = cur.fetchall()
    items = [{
        "id": str(r["id"]), "user_id": str(r["user_id"]),
        "user_email": r["user_email"], "user_company": r["user_company"],
        "from_currency": r["from_currency"], "to_currency": r["to_currency"],
        "amount": float(r["amount"]), "destination_country": r["destination_country"],
        "destination_address": r["destination_address"], "risk_score": r["risk_score"],
        "risk_level": "high" if r["risk_score"] >= 60 else ("medium" if r["risk_score"] >= 30 else "low"),
        "created_at": r["created_at"].isoformat() if r["created_at"] else None,
    } for r in rows]
    return {"items": items, "total": total, "limit": limit, "offset": offset}


def get_frozen(conn) -> dict:
    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute("""
            SELECT u.id, u.email, u.company_name, u.inn, u.status, u.updated_at,
                   al.details->>'reason' AS freeze_reason, al.created_at AS frozen_at
            FROM users u
            LEFT JOIN LATERAL (
                SELECT details, created_at FROM audit_logs
                WHERE action IN ('account.freeze','account.block')
                  AND details->>'target_user_id' = u.id::text
                ORDER BY created_at DESC LIMIT 1
            ) al ON TRUE
            WHERE u.status = 'blocked' ORDER BY u.updated_at DESC
        """)
        rows = cur.fetchall()
    return {"items": [{
        "id": str(r["id"]), "email": r["email"], "company_name": r["company_name"],
        "inn": r["inn"], "status": r["status"], "freeze_reason": r["freeze_reason"],
        "frozen_at": r["frozen_at"].isoformat() if r["frozen_at"] else (r["updated_at"].isoformat() if r["updated_at"] else None),
    } for r in rows], "total": len(rows)}


def get_audit(conn, qs: dict) -> dict:
    try:
        limit  = max(1, min(100, int(qs.get("limit",  50))))
        offset = max(0, int(qs.get("offset", 0)))
    except (ValueError, TypeError):
        limit, offset = 50, 0
    conditions, params = [], []
    if qs.get("action"):
        conditions.append("al.action ILIKE %s"); params.append(f"%{qs['action']}%")
    if qs.get("user_id"):
        conditions.append("al.user_id = %s::uuid"); params.append(qs["user_id"])
    if qs.get("date_from"):
        conditions.append("al.created_at >= %s::timestamptz"); params.append(qs["date_from"])
    if qs.get("date_to"):
        conditions.append("al.created_at <= %s::timestamptz"); params.append(qs["date_to"] + " 23:59:59")
    where = ("WHERE " + " AND ".join(conditions)) if conditions else ""
    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute(f"SELECT COUNT(*) AS total FROM audit_logs al {where}", params)
        total = int(cur.fetchone()["total"])
        cur.execute(f"""
            SELECT al.id, al.action, al.details, al.ip_address, al.created_at,
                   u.email AS user_email, u.role AS user_role
            FROM audit_logs al LEFT JOIN users u ON u.id = al.user_id
            {where} ORDER BY al.created_at DESC LIMIT %s OFFSET %s
        """, params + [limit, offset])
        rows = cur.fetchall()
    return {
        "items": [{"id": r["id"], "action": r["action"], "details": r["details"],
                   "ip_address": r["ip_address"],
                   "created_at": r["created_at"].isoformat() if r["created_at"] else None,
                   "user_email": r["user_email"], "user_role": r["user_role"]} for r in rows],
        "total": total, "limit": limit, "offset": offset,
    }


def freeze_and_reject(conn, body: dict, caller: dict, ip) -> tuple:
    """
    Атомарная операция: заморозить аккаунт + отклонить платёж + записать в audit_log.
    body: { order_id, user_id, reason, reject_all? }
    """
    order_id   = (body.get("order_id")  or "").strip()
    user_id    = (body.get("user_id")   or "").strip()
    reason     = (body.get("reason")    or "Подозрение на нарушение AML-политики").strip()
    reject_all = bool(body.get("reject_all", False))

    if not order_id or not user_id:
        return {"error": "order_id и user_id обязательны"}, 400

    conn.autocommit = False
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            # 1. Проверяем платёж
            cur.execute(
                "SELECT id, status, user_id FROM payment_orders WHERE id = %s AND status = 'aml_pending'",
                (order_id,),
            )
            order = cur.fetchone()
            if not order:
                conn.rollback()
                return {"error": "Платёж не найден или уже обработан"}, 404

            # 2. Проверяем пользователя
            cur.execute("SELECT id, email FROM users WHERE id = %s::uuid", (user_id,))
            user = cur.fetchone()
            if not user:
                conn.rollback()
                return {"error": "Пользователь не найден"}, 404

            now = datetime.now(timezone.utc)

            # 3. Отклоняем текущий платёж
            cur.execute(
                """UPDATE payment_orders
                      SET status='rejected', approved_by=%s::uuid, approved_at=%s,
                          reject_reason=%s, updated_at=%s
                    WHERE id=%s""",
                (caller["sub"], now, reason, now, order_id),
            )
            rejected_count = 1

            # 4. Если reject_all — отклоняем все aml_pending платежи этого пользователя
            if reject_all:
                cur.execute(
                    """UPDATE payment_orders
                          SET status='rejected', approved_by=%s::uuid, approved_at=%s,
                              reject_reason=%s, updated_at=%s
                        WHERE user_id=%s::uuid AND status='aml_pending' AND id != %s""",
                    (caller["sub"], now, reason, now, user_id, order_id),
                )
                rejected_count += cur.rowcount

            # 5. Замораживаем аккаунт
            cur.execute(
                "UPDATE users SET status='blocked', updated_at=%s WHERE id=%s::uuid",
                (now, user_id),
            )

            # 6. Audit log — одна запись с полным контекстом
            audit_details = {
                "order_id":         order_id,
                "target_user_id":   user_id,
                "target_email":     user["email"],
                "reason":           reason,
                "reject_all":       reject_all,
                "rejected_count":   rejected_count,
                "action_type":      "freeze_and_reject",
            }
            cur.execute(
                "INSERT INTO audit_logs (user_id, action, details, ip_address) VALUES (%s::uuid, %s, %s, %s)",
                (caller["sub"], "incident.freeze_and_reject", json.dumps(audit_details), ip),
            )

        conn.commit()
        conn.autocommit = True

        # 7. Email-уведомление клиенту (fire-and-forget, не блокируем ответ)
        email_sent = False
        try:
            company = user.get("company_name") or user["email"]
            html, text = _build_freeze_email(company, reason, now.year)
            email_sent = _send_email(
                to      = user["email"],
                subject = "⚠️ Ваш аккаунт MOST временно заморожен",
                html    = html,
                text    = text,
            )
        except Exception as mail_exc:
            print(f"[freeze-notify] email error: {mail_exc}")

        return {
            "order_id":       order_id,
            "user_id":        user_id,
            "user_email":     user["email"],
            "rejected_count": rejected_count,
            "user_status":    "blocked",
            "order_status":   "rejected",
            "email_sent":     email_sent,
        }, 200

    except Exception as exc:
        conn.rollback()
        conn.autocommit = True
        return {"error": f"Ошибка транзакции: {str(exc)}"}, 500


def post_action(conn, body: dict, caller: dict, ip) -> tuple:
    resource = (body.get("resource") or "").strip()
    user_id  = (body.get("user_id")  or "").strip()
    reason   = (body.get("reason")   or "").strip()
    if resource not in ("freeze", "unfreeze", "escalate"):
        return {"error": "resource: freeze | unfreeze | escalate"}, 400
    if not user_id:
        return {"error": "user_id обязателен"}, 400
    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute("SELECT id, email, status FROM users WHERE id = %s::uuid", (user_id,))
        user = cur.fetchone()
        if not user:
            return {"error": "Пользователь не найден"}, 404
        now = datetime.now(timezone.utc)
        if resource == "freeze":
            cur.execute("UPDATE users SET status='blocked', updated_at=%s WHERE id=%s::uuid", (now, user_id))
            new_status = "blocked"
        elif resource == "unfreeze":
            cur.execute("UPDATE users SET status='active', updated_at=%s WHERE id=%s::uuid", (now, user_id))
            new_status = "active"
        else:
            new_status = user["status"]
        cur.execute(
            "INSERT INTO audit_logs (user_id, action, details, ip_address) VALUES (%s::uuid, %s, %s, %s)",
            (caller["sub"], f"account.{resource}",
             json.dumps({"target_user_id": user_id, "email": user["email"], "reason": reason or None}), ip))
    return {"user_id": user_id, "resource": resource, "new_status": new_status}, 200


def handler(event: dict, context) -> dict:
    """Compliance API: stats | queue | frozen | audit | freeze | unfreeze | escalate."""
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}
    caller = _verify(event)
    if not caller:
        return _resp(401, {"error": "Требуется авторизация"})
    if caller.get("role") not in ALLOWED_ROLES:
        return _resp(403, {"error": "Нет доступа"})
    method   = event.get("httpMethod", "GET")
    qs       = event.get("queryStringParameters") or {}
    resource = (qs.get("resource") or "").strip()
    conn = _db()
    try:
        if method == "GET":
            if resource == "stats":  return _resp(200, get_stats(conn))
            if resource == "queue":  return _resp(200, get_queue(conn, qs))
            if resource == "frozen": return _resp(200, get_frozen(conn))
            if resource == "audit":  return _resp(200, get_audit(conn, qs))
            return _resp(400, {"error": "resource: stats | queue | frozen | audit"})
        if method == "POST":
            try:
                body = json.loads(event.get("body") or "{}")
            except json.JSONDecodeError:
                return _resp(400, {"error": "Невалидный JSON"})
            ip = (event.get("requestContext") or {}).get("identity", {}).get("sourceIp")
            # Атомарный инцидент-эндпоинт
            if (body.get("resource") or "").strip() == "freeze_and_reject":
                result, code = freeze_and_reject(conn, body, caller, ip)
                return _resp(code, result)
            result, code = post_action(conn, body, caller, ip)
            return _resp(code, result)
        return _resp(405, {"error": "Method not allowed"})
    finally:
        conn.close()