"""
MOST — admin-api
Единый backend для AdminPanel. JWT-авторизация, role-based доступ.

Разрешённые роли: superadmin, admin, finance, devops

GET  /?resource=users&limit=&offset=&search=&role=&status=
GET  /?resource=user&user_id=
GET  /?resource=admin_audit&limit=&offset=
GET  /?resource=stats

POST / { resource: "update_role",   user_id, new_role }
POST / { resource: "set_status",    user_id, new_status }
POST / { resource: "create_user",   email, password, role, company_name }
POST / { resource: "delete_user",   user_id }
POST / { resource: "update_tariff", user_id, tariff }
"""
import hashlib
import json
import os
import secrets
from datetime import datetime, timezone

import psycopg2
import psycopg2.extras
from jose import JWTError, jwt

ALLOWED_ROLES = {"superadmin", "admin", "finance", "devops"}
CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Authorization",
}
VALID_ROLES   = {"superadmin", "admin", "finance", "compliance", "devops", "user", "regulator"}
VALID_STATUSES = {"active", "blocked", "suspended", "pending_kyc"}


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


def _audit(conn, caller_id: str, action: str, details: dict, ip=None):
    conn.cursor().execute(
        "INSERT INTO audit_logs (user_id, action, details, ip_address) VALUES (%s::uuid, %s, %s, %s)",
        (caller_id, action, json.dumps(details), ip),
    )


# ── GET: users ────────────────────────────────────────────────────────────────
def get_users(conn, qs: dict) -> dict:
    try:
        limit  = max(1, min(100, int(qs.get("limit",  50))))
        offset = max(0, int(qs.get("offset", 0)))
    except (ValueError, TypeError):
        limit, offset = 50, 0
    search = (qs.get("search") or "").strip()
    role   = (qs.get("role")   or "").strip()
    status = (qs.get("status") or "").strip()

    cond, params = [], []
    if search:
        cond.append("(u.email ILIKE %s OR u.company_name ILIKE %s OR u.inn ILIKE %s)")
        params += [f"%{search}%"] * 3
    if role:
        cond.append("u.role = %s"); params.append(role)
    if status:
        cond.append("u.status = %s"); params.append(status)

    where = ("WHERE " + " AND ".join(cond)) if cond else ""

    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute(f"SELECT COUNT(*) AS n FROM users u {where}", params)
        total = int(cur.fetchone()["n"])
        cur.execute(f"""
            SELECT u.id, u.email, u.company_name, u.inn, u.role, u.status, u.created_at,
                   k.status AS kyc_status,
                   COALESCE(p.tx_count, 0) AS tx_count,
                   COALESCE(p.total_vol, 0) AS total_vol
            FROM users u
            LEFT JOIN LATERAL (
                SELECT status FROM kyc_applications WHERE user_id = u.id ORDER BY created_at DESC LIMIT 1
            ) k ON TRUE
            LEFT JOIN LATERAL (
                SELECT COUNT(*) AS tx_count, SUM(amount) AS total_vol
                FROM payment_orders WHERE user_id = u.id
            ) p ON TRUE
            {where}
            ORDER BY u.created_at DESC
            LIMIT %s OFFSET %s
        """, params + [limit, offset])
        rows = cur.fetchall()

    return {"items": [{
        "id": str(r["id"]), "email": r["email"],
        "company_name": r["company_name"], "inn": r["inn"],
        "role": r["role"], "status": r["status"],
        "kyc_status": r["kyc_status"],
        "tx_count": int(r["tx_count"]),
        "total_vol": float(r["total_vol"] or 0),
        "created_at": r["created_at"].isoformat() if r["created_at"] else None,
    } for r in rows], "total": total, "limit": limit, "offset": offset}


# ── GET: single user ──────────────────────────────────────────────────────────
def get_user(conn, user_id: str) -> dict:
    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute("SELECT * FROM users WHERE id = %s::uuid", (user_id,))
        u = cur.fetchone()
        if not u:
            return {"error": "Не найден"}
        cur.execute("""
            SELECT id, from_currency, to_currency, amount, status, risk_score, created_at
            FROM payment_orders WHERE user_id = %s::uuid ORDER BY created_at DESC LIMIT 10
        """, (user_id,))
        payments = [{**dict(r), "id": str(r["id"]), "amount": float(r["amount"]),
                     "created_at": r["created_at"].isoformat() if r["created_at"] else None}
                    for r in cur.fetchall()]
    return {**dict(u), "id": str(u["id"]),
            "created_at": u["created_at"].isoformat() if u["created_at"] else None,
            "recent_payments": payments}


# ── GET: admin audit log ──────────────────────────────────────────────────────
def get_admin_audit(conn, qs: dict) -> dict:
    try:
        limit  = max(1, min(100, int(qs.get("limit",  50))))
        offset = max(0, int(qs.get("offset", 0)))
    except (ValueError, TypeError):
        limit, offset = 50, 0
    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute("SELECT COUNT(*) AS n FROM audit_logs al JOIN users u ON u.id=al.user_id WHERE u.role IN ('superadmin','admin','finance','devops')")
        total = int(cur.fetchone()["n"])
        cur.execute("""
            SELECT al.id, al.action, al.details, al.ip_address, al.created_at,
                   u.email, u.role
            FROM audit_logs al
            JOIN users u ON u.id = al.user_id
            WHERE u.role IN ('superadmin','admin','finance','devops')
            ORDER BY al.created_at DESC
            LIMIT %s OFFSET %s
        """, (limit, offset))
        rows = cur.fetchall()
    return {"items": [{"id": r["id"], "action": r["action"], "details": r["details"],
                       "ip": r["ip_address"],
                       "created_at": r["created_at"].isoformat() if r["created_at"] else None,
                       "email": r["email"], "role": r["role"]} for r in rows],
            "total": total}


# ── GET: stats ────────────────────────────────────────────────────────────────
def get_stats(conn) -> dict:
    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute("SELECT role, COUNT(*) AS n FROM users GROUP BY role")
        by_role = {r["role"]: int(r["n"]) for r in cur.fetchall()}
        cur.execute("SELECT status, COUNT(*) AS n FROM users GROUP BY status")
        by_status = {r["status"]: int(r["n"]) for r in cur.fetchall()}
        cur.execute("SELECT COUNT(*) AS n FROM payment_orders WHERE created_at >= NOW()-INTERVAL '24h'")
        tx_today = int(cur.fetchone()["n"])
        cur.execute("SELECT COALESCE(SUM(amount),0) AS v FROM payment_orders WHERE created_at >= NOW()-INTERVAL '24h'")
        vol_today = float(cur.fetchone()["v"] or 0)
        cur.execute("SELECT COUNT(*) AS n FROM kyc_applications WHERE status='pending_review'")
        kyc_pending = int(cur.fetchone()["n"])
    return {"by_role": by_role, "by_status": by_status,
            "tx_today": tx_today, "vol_today": vol_today, "kyc_pending": kyc_pending}


# ── POST: update role ─────────────────────────────────────────────────────────
def update_role(conn, body: dict, caller: dict, ip) -> tuple:
    user_id  = (body.get("user_id")  or "").strip()
    new_role = (body.get("new_role") or "").strip()
    if not user_id or new_role not in VALID_ROLES:
        return {"error": f"user_id и new_role ({', '.join(VALID_ROLES)}) обязательны"}, 400
    if caller.get("role") != "superadmin" and new_role in ("superadmin", "admin"):
        return {"error": "Только superadmin может назначать admin/superadmin"}, 403
    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute("SELECT id, email, role FROM users WHERE id = %s::uuid", (user_id,))
        u = cur.fetchone()
        if not u:
            return {"error": "Пользователь не найден"}, 404
        cur.execute("UPDATE users SET role = %s, updated_at = %s WHERE id = %s::uuid",
                    (new_role, datetime.now(timezone.utc), user_id))
    _audit(conn, caller["sub"], "admin.update_role",
           {"target_id": user_id, "email": u["email"], "old_role": u["role"], "new_role": new_role}, ip)
    return {"user_id": user_id, "new_role": new_role}, 200


# ── POST: set status ──────────────────────────────────────────────────────────
def set_status(conn, body: dict, caller: dict, ip) -> tuple:
    user_id    = (body.get("user_id")    or "").strip()
    new_status = (body.get("new_status") or "").strip()
    if not user_id or new_status not in VALID_STATUSES:
        return {"error": f"user_id и new_status ({', '.join(VALID_STATUSES)}) обязательны"}, 400
    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute("SELECT id, email, status FROM users WHERE id = %s::uuid", (user_id,))
        u = cur.fetchone()
        if not u:
            return {"error": "Пользователь не найден"}, 404
        cur.execute("UPDATE users SET status = %s, updated_at = %s WHERE id = %s::uuid",
                    (new_status, datetime.now(timezone.utc), user_id))
    _audit(conn, caller["sub"], "admin.set_status",
           {"target_id": user_id, "email": u["email"], "old": u["status"], "new": new_status}, ip)
    return {"user_id": user_id, "new_status": new_status}, 200


# ── POST: create user ─────────────────────────────────────────────────────────
def create_user(conn, body: dict, caller: dict, ip) -> tuple:
    email        = (body.get("email")        or "").strip().lower()
    password     = (body.get("password")     or "").strip()
    role         = (body.get("role")         or "user").strip()
    company_name = (body.get("company_name") or "").strip() or None

    if not email or not password:
        return {"error": "email и password обязательны"}, 400
    if role not in VALID_ROLES:
        return {"error": f"Недопустимая роль: {role}"}, 400
    if caller.get("role") != "superadmin" and role in ("superadmin", "admin"):
        return {"error": "Только superadmin может создавать admin/superadmin"}, 403

    salt = secrets.token_hex(16)
    pw_hash = hashlib.sha256(f"{salt}{password}".encode()).hexdigest()
    password_hash = f"{salt}:{pw_hash}"

    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute("SELECT id FROM users WHERE email = %s", (email,))
        if cur.fetchone():
            return {"error": "Пользователь с таким email уже существует"}, 409
        cur.execute("""
            INSERT INTO users (email, password_hash, role, status, company_name)
            VALUES (%s, %s, %s, 'active', %s)
            RETURNING id
        """, (email, password_hash, role, company_name))
        new_id = str(cur.fetchone()["id"])

    _audit(conn, caller["sub"], "admin.create_user",
           {"new_id": new_id, "email": email, "role": role}, ip)
    return {"id": new_id, "email": email, "role": role}, 201


# ── POST: delete user ─────────────────────────────────────────────────────────
def delete_user(conn, body: dict, caller: dict, ip) -> tuple:
    if caller.get("role") != "superadmin":
        return {"error": "Удаление доступно только superadmin"}, 403
    user_id = (body.get("user_id") or "").strip()
    if not user_id:
        return {"error": "user_id обязателен"}, 400
    if user_id == caller["sub"]:
        return {"error": "Нельзя удалить самого себя"}, 400
    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute("SELECT id, email FROM users WHERE id = %s::uuid", (user_id,))
        u = cur.fetchone()
        if not u:
            return {"error": "Пользователь не найден"}, 404
        cur.execute("DELETE FROM users WHERE id = %s::uuid", (user_id,))
    _audit(conn, caller["sub"], "admin.delete_user",
           {"deleted_id": user_id, "email": u["email"]}, ip)
    return {"deleted": user_id}, 200


# ── Handler ───────────────────────────────────────────────────────────────────
def handler(event: dict, context) -> dict:
    """Admin API — управление пользователями, ролями, аудит."""
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    caller = _verify(event)
    if not caller:
        return _resp(401, {"error": "Требуется авторизация"})
    if caller.get("role") not in ALLOWED_ROLES:
        return _resp(403, {"error": "Нет доступа. Требуется роль: admin/superadmin/finance/devops"})

    method   = event.get("httpMethod", "GET")
    qs       = event.get("queryStringParameters") or {}
    resource = (qs.get("resource") or "").strip()
    ip       = (event.get("requestContext") or {}).get("identity", {}).get("sourceIp")
    conn = _db()
    try:
        if method == "GET":
            if resource == "users":       return _resp(200, get_users(conn, qs))
            if resource == "user":        return _resp(200, get_user(conn, qs.get("user_id", "")))
            if resource == "admin_audit": return _resp(200, get_admin_audit(conn, qs))
            if resource == "stats":       return _resp(200, get_stats(conn))
            return _resp(400, {"error": "resource: users|user|admin_audit|stats"})

        if method == "POST":
            try:
                body = json.loads(event.get("body") or "{}")
            except json.JSONDecodeError:
                return _resp(400, {"error": "Невалидный JSON"})
            r = (body.get("resource") or "").strip()
            handlers_map = {
                "update_role":   lambda: update_role(conn, body, caller, ip),
                "set_status":    lambda: set_status(conn, body, caller, ip),
                "create_user":   lambda: create_user(conn, body, caller, ip),
                "delete_user":   lambda: delete_user(conn, body, caller, ip),
            }
            if r not in handlers_map:
                return _resp(400, {"error": "resource: update_role|set_status|create_user|delete_user"})
            result, code = handlers_map[r]()
            return _resp(code, result)

        return _resp(405, {"error": "Method not allowed"})
    finally:
        conn.close()
