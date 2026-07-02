import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useApi } from '@/hooks/useApi';
import Icon from '@/components/ui/icon';

const ADMIN_API = 'https://functions.poehali.dev/0d5d92bb-9238-4222-8d1c-cbafdf0a40b4';

// ─── Цветовая схема ───────────────────────────────────────────────────────────
const C = {
  bg:     '#080816',
  side:   '#0B0B1C',
  card:   '#0F0F28',
  border: 'rgba(255,255,255,0.07)',
  text:   '#FFFFFF',
  dim:    'rgba(255,255,255,0.45)',
  green:  '#00FF88',
  accent: '#FF7A00',   // admin orange
  danger: '#FF4444',
  warn:   '#FFAA00',
  info:   '#4D9FFF',
  purple: '#A855F7',
  gold:   '#FFD700',
};

// Цвета ролей
const ROLE_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  superadmin: { bg: 'rgba(255,68,68,0.15)',   text: '#FF6666', label: 'Superadmin' },
  admin:      { bg: 'rgba(255,122,0,0.15)',   text: '#FF9444', label: 'Admin'      },
  finance:    { bg: 'rgba(255,215,0,0.15)',   text: '#FFD700', label: 'Finance'    },
  compliance: { bg: 'rgba(77,159,255,0.15)',  text: '#4D9FFF', label: 'Compliance' },
  devops:     { bg: 'rgba(168,85,247,0.15)',  text: '#C084FC', label: 'DevOps'     },
  user:       { bg: 'rgba(255,255,255,0.08)', text: 'rgba(255,255,255,0.5)', label: 'User' },
  regulator:  { bg: 'rgba(0,255,136,0.12)',   text: '#00FF88', label: 'Regulator'  },
};

function RoleBadge({ role }: { role: string }) {
  const r = ROLE_COLORS[role] || ROLE_COLORS.user;
  return (
    <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 20,
      background: r.bg, color: r.text, fontFamily: 'JetBrains Mono, monospace',
      letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>
      {r.label}
    </span>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { color: string; label: string }> = {
    active:      { color: C.green,  label: 'Активен'   },
    blocked:     { color: C.danger, label: 'Заблокирован' },
    suspended:   { color: C.warn,   label: 'Приостановлен' },
    pending_kyc: { color: C.info,   label: 'KYC'        },
  };
  const m = map[status] || { color: C.dim, label: status };
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, color: m.color }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: m.color, display: 'inline-block', flexShrink: 0 }} />
      {m.label}
    </span>
  );
}

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
}
function fmtMoney(n: number) {
  return n >= 1e6 ? `$${(n/1e6).toFixed(1)}M` : n >= 1e3 ? `$${(n/1e3).toFixed(0)}K` : `$${n.toFixed(0)}`;
}

// ─── Типы ─────────────────────────────────────────────────────────────────────
type AdminRole = 'superadmin' | 'admin' | 'finance' | 'devops';
type Tab = 'users' | 'tariffs' | 'config' | 'audit' | 'roles' |
           'wallets' | 'pools' | 'fees' | 'revenue' |
           'services' | 'metrics' | 'errors' | 'deploy';

interface UserRow {
  id: string; email: string; company_name: string | null; inn: string | null;
  role: string; status: string; kyc_status: string | null;
  tx_count: number; total_vol: number; created_at: string | null;
}
interface Stats {
  by_role: Record<string, number>; by_status: Record<string, number>;
  tx_today: number; vol_today: number; kyc_pending: number;
}
interface AuditRow {
  id: number; action: string; details: Record<string, unknown>;
  ip: string | null; created_at: string | null; email: string; role: string;
}

// ─── Модалка: изменение роли ──────────────────────────────────────────────────
function RoleModal({ user, onClose, onDone, apiFetch }: {
  user: UserRow; onClose: () => void; onDone: () => void;
  apiFetch: (url: string, opts?: RequestInit) => Promise<Response>;
}) {
  const [role, setRole]     = useState(user.role);
  const [loading, setLoading] = useState(false);
  const [err, setErr]       = useState('');

  const save = async () => {
    setLoading(true); setErr('');
    const res = await apiFetch(ADMIN_API, { method: 'POST',
      body: JSON.stringify({ resource: 'update_role', user_id: user.id, new_role: role }) });
    const d = await res.json();
    if (!res.ok) { setErr(d.error || `HTTP ${res.status}`); setLoading(false); return; }
    onClose(); onDone();
  };

  const roles = Object.keys(ROLE_COLORS);
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ width: '100%', maxWidth: 400, background: C.card, border: `1px solid ${C.border}`, borderRadius: 18, padding: '28px 32px', display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 17, fontWeight: 700 }}>Изменить роль</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: C.dim, cursor: 'pointer' }}><Icon name="X" size={18} /></button>
        </div>
        <div style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(255,255,255,0.04)', fontSize: 13 }}>
          <div style={{ fontWeight: 600 }}>{user.company_name || user.email}</div>
          <div style={{ color: C.dim, fontSize: 12 }}>{user.email}</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {roles.map(r => {
            const rc = ROLE_COLORS[r];
            return (
              <button key={r} onClick={() => setRole(r)} style={{ padding: '10px 14px', borderRadius: 10, border: `2px solid ${role === r ? rc.text : 'transparent'}`, background: role === r ? rc.bg : 'rgba(255,255,255,0.04)', color: role === r ? rc.text : C.dim, fontSize: 13, fontWeight: role === r ? 700 : 400, cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s' }}>
                {rc.label}
              </button>
            );
          })}
        </div>
        {err && <div style={{ fontSize: 13, color: '#ff8888' }}>{err}</div>}
        <button onClick={save} disabled={loading || role === user.role} style={{ padding: '12px', borderRadius: 10, background: role !== user.role ? C.accent : 'rgba(255,255,255,0.07)', color: role !== user.role ? '#fff' : C.dim, fontWeight: 700, fontSize: 14, border: 'none', cursor: 'pointer' }}>
          {loading ? 'Сохраняем...' : 'Сохранить роль'}
        </button>
      </div>
    </div>
  );
}

// ─── Модалка: создать пользователя ────────────────────────────────────────────
function CreateUserModal({ onClose, onDone, apiFetch, callerRole }: {
  onClose: () => void; onDone: () => void;
  apiFetch: (url: string, opts?: RequestInit) => Promise<Response>;
  callerRole: string;
}) {
  const [email, setEmail]     = useState('');
  const [pass,  setPass]      = useState('');
  const [role,  setRole]      = useState('user');
  const [company, setCompany] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr]         = useState('');

  const save = async () => {
    if (!email || !pass) { setErr('Email и пароль обязательны'); return; }
    setLoading(true); setErr('');
    const res = await apiFetch(ADMIN_API, { method: 'POST',
      body: JSON.stringify({ resource: 'create_user', email, password: pass, role, company_name: company || undefined }) });
    const d = await res.json();
    if (!res.ok) { setErr(d.error || `HTTP ${res.status}`); setLoading(false); return; }
    onClose(); onDone();
  };

  const allowedRoles = callerRole === 'superadmin'
    ? Object.keys(ROLE_COLORS)
    : ['user', 'compliance', 'finance', 'devops', 'regulator'];

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ width: '100%', maxWidth: 440, background: C.card, border: `1px solid ${C.border}`, borderRadius: 18, padding: '28px 32px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 17, fontWeight: 700 }}>Создать пользователя</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: C.dim, cursor: 'pointer' }}><Icon name="X" size={18} /></button>
        </div>
        {[
          { label: 'Email *', value: email, set: setEmail, type: 'email', ph: 'user@company.com' },
          { label: 'Пароль *', value: pass, set: setPass, type: 'password', ph: 'Минимум 8 символов' },
          { label: 'Компания', value: company, set: setCompany, type: 'text', ph: 'ООО «Пример»' },
        ].map(f => (
          <div key={f.label}>
            <label style={{ fontSize: 12, color: C.dim, display: 'block', marginBottom: 6 }}>{f.label}</label>
            <input value={f.value} onChange={e => f.set(e.target.value)} type={f.type} placeholder={f.ph}
              style={{ width: '100%', padding: '10px 14px', borderRadius: 10, fontSize: 13, background: 'rgba(255,255,255,0.05)', border: `1px solid ${C.border}`, color: C.text, outline: 'none', fontFamily: "'Rubik', sans-serif", boxSizing: 'border-box' }} />
          </div>
        ))}
        <div>
          <label style={{ fontSize: 12, color: C.dim, display: 'block', marginBottom: 8 }}>Роль</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {allowedRoles.map(r => {
              const rc = ROLE_COLORS[r];
              return (
                <button key={r} onClick={() => setRole(r)} style={{ padding: '6px 14px', borderRadius: 20, border: `1px solid ${role === r ? rc.text : 'transparent'}`, background: role === r ? rc.bg : 'rgba(255,255,255,0.05)', color: role === r ? rc.text : C.dim, fontSize: 12, cursor: 'pointer' }}>
                  {rc.label}
                </button>
              );
            })}
          </div>
        </div>
        {err && <div style={{ fontSize: 13, color: '#ff8888' }}>{err}</div>}
        <button onClick={save} disabled={loading} style={{ padding: '12px', borderRadius: 10, background: C.accent, color: '#fff', fontWeight: 700, fontSize: 14, border: 'none', cursor: 'pointer', opacity: loading ? 0.7 : 1 }}>
          {loading ? 'Создаём...' : 'Создать'}
        </button>
      </div>
    </div>
  );
}

// ─── Таб: ПОЛЬЗОВАТЕЛИ ────────────────────────────────────────────────────────
function TabUsers({ apiFetch, callerRole }: { apiFetch: (url: string, opts?: RequestInit) => Promise<Response>; callerRole: string }) {
  const [items, setItems]     = useState<UserRow[]>([]);
  const [total, setTotal]     = useState(0);
  const [loading, setLoading] = useState(false);
  const [search, setSearch]   = useState('');
  const [filterRole, setFilterRole]     = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [editRole, setEditRole]   = useState<UserRow | null>(null);
  const [creating, setCreating]   = useState(false);
  const [deleting, setDeleting]   = useState<UserRow | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const p = new URLSearchParams({ resource: 'users', limit: '50' });
    if (search)       p.set('search', search);
    if (filterRole)   p.set('role', filterRole);
    if (filterStatus) p.set('status', filterStatus);
    const res = await apiFetch(`${ADMIN_API}?${p}`);
    const d = await res.json();
    setItems(d.items || []); setTotal(d.total || 0); setLoading(false);
  }, [apiFetch, search, filterRole, filterStatus]);

  useEffect(() => { load(); }, [load]);

  const doStatus = async (user: UserRow, s: string) => {
    setActionLoading(true);
    await apiFetch(ADMIN_API, { method: 'POST', body: JSON.stringify({ resource: 'set_status', user_id: user.id, new_status: s }) });
    setActionLoading(false); load();
  };

  const doDelete = async () => {
    if (!deleting) return;
    setActionLoading(true);
    await apiFetch(ADMIN_API, { method: 'POST', body: JSON.stringify({ resource: 'delete_user', user_id: deleting.id }) });
    setActionLoading(false); setDeleting(null); load();
  };

  const ROLES = Object.keys(ROLE_COLORS);
  const STATUSES = ['active', 'blocked', 'suspended', 'pending_kyc'];

  return (
    <div>
      {editRole && <RoleModal user={editRole} onClose={() => setEditRole(null)} onDone={() => { setEditRole(null); load(); }} apiFetch={apiFetch} />}
      {creating  && <CreateUserModal onClose={() => setCreating(false)} onDone={() => { setCreating(false); load(); }} apiFetch={apiFetch} callerRole={callerRole} />}

      {/* Модалка удаления */}
      {deleting && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
          onClick={e => e.target === e.currentTarget && setDeleting(null)}>
          <div style={{ width: '100%', maxWidth: 380, background: C.card, border: `1px solid ${C.danger}44`, borderRadius: 18, padding: '28px 32px', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 17, fontWeight: 700, color: C.danger }}>Удалить пользователя?</div>
            <div style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(255,255,255,0.04)', fontSize: 13 }}>
              <div style={{ fontWeight: 600 }}>{deleting.company_name || deleting.email}</div>
              <div style={{ color: C.dim }}>{deleting.email}</div>
            </div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>Все данные пользователя будут удалены безвозвратно. Это действие нельзя отменить.</div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setDeleting(null)} style={{ flex: 1, padding: '11px', borderRadius: 9, background: 'transparent', border: `1px solid ${C.border}`, color: C.dim, cursor: 'pointer' }}>Отмена</button>
              <button onClick={doDelete} disabled={actionLoading} style={{ flex: 2, padding: '11px', borderRadius: 9, background: C.danger, color: '#fff', fontWeight: 700, border: 'none', cursor: 'pointer' }}>
                {actionLoading ? 'Удаляем...' : 'Удалить'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Тулбар */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 20, fontWeight: 700, margin: 0 }}>Пользователи</h2>
        <span style={{ fontSize: 12, color: C.dim }}>{total}</span>
        <div style={{ flex: 1 }} />
        <div style={{ position: 'relative' }}>
          <Icon name="Search" size={13} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: C.dim }} />
          <input value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && load()}
            placeholder="Email, компания, ИНН..."
            style={{ padding: '8px 12px 8px 30px', borderRadius: 8, background: 'rgba(255,255,255,0.05)', border: `1px solid ${C.border}`, color: C.text, fontSize: 12, outline: 'none', fontFamily: "'Rubik', sans-serif", width: 200 }} />
        </div>
        <select value={filterRole} onChange={e => setFilterRole(e.target.value)}
          style={{ padding: '8px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.05)', border: `1px solid ${C.border}`, color: C.text, fontSize: 12, outline: 'none', cursor: 'pointer' }}>
          <option value="" style={{ background: C.card }}>Все роли</option>
          {ROLES.map(r => <option key={r} value={r} style={{ background: C.card }}>{ROLE_COLORS[r].label}</option>)}
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          style={{ padding: '8px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.05)', border: `1px solid ${C.border}`, color: C.text, fontSize: 12, outline: 'none', cursor: 'pointer' }}>
          <option value="" style={{ background: C.card }}>Все статусы</option>
          {STATUSES.map(s => <option key={s} value={s} style={{ background: C.card }}>{s}</option>)}
        </select>
        <button onClick={() => setCreating(true)} style={{ padding: '8px 16px', borderRadius: 8, background: C.accent, color: '#fff', fontSize: 12, fontWeight: 700, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
          <Icon name="UserPlus" size={13} /> Создать
        </button>
      </div>

      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px 80px 80px 70px 60px 180px', gap: 8, padding: '10px 20px', borderBottom: `1px solid ${C.border}`, fontSize: 11, color: C.dim, fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.07em' }}>
          <span>ПОЛЬЗОВАТЕЛЬ</span><span>ИНН</span><span>РОЛЬ</span><span>СТАТУС</span><span>KYC</span><span>TX</span><span>ДЕЙСТВИЯ</span>
        </div>

        {loading && !items.length ? (
          <div style={{ padding: 48, textAlign: 'center', color: C.dim }}><Icon name="Loader" size={22} style={{ animation: 'spin 1s linear infinite' }} /></div>
        ) : items.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: C.dim }}>Нет пользователей</div>
        ) : items.map((u, i) => (
          <div key={u.id} style={{ display: 'grid', gridTemplateColumns: '1fr 100px 80px 80px 70px 60px 180px', gap: 8, padding: '12px 20px', alignItems: 'center', borderBottom: i < items.length - 1 ? `1px solid ${C.border}` : 'none', opacity: actionLoading ? 0.5 : 1, transition: 'background 0.15s' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.company_name || u.email}</div>
              <div style={{ fontSize: 11, color: C.dim, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.email}</div>
            </div>
            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: C.dim }}>{u.inn || '—'}</span>
            <RoleBadge role={u.role} />
            <StatusPill status={u.status} />
            <span style={{ fontSize: 11, color: u.kyc_status === 'approved' ? C.green : u.kyc_status === 'rejected' ? C.danger : C.warn }}>
              {u.kyc_status === 'approved' ? '✓' : u.kyc_status === 'rejected' ? '✗' : u.kyc_status ? '~' : '—'}
            </span>
            <span style={{ fontSize: 12, color: C.dim }}>{u.tx_count}</span>
            <div style={{ display: 'flex', gap: 4 }}>
              <button onClick={() => setEditRole(u)} title="Изменить роль"
                style={{ padding: '5px 8px', borderRadius: 7, fontSize: 11, border: `1px solid ${C.border}`, background: 'transparent', color: ROLE_COLORS[u.role]?.text || C.dim, cursor: 'pointer' }}>
                <Icon name="Shield" size={12} />
              </button>
              <button onClick={() => doStatus(u, u.status === 'blocked' ? 'active' : 'blocked')} title={u.status === 'blocked' ? 'Разблокировать' : 'Заблокировать'}
                style={{ padding: '5px 8px', borderRadius: 7, fontSize: 11, border: 'none', background: u.status === 'blocked' ? `${C.green}18` : `${C.warn}18`, color: u.status === 'blocked' ? C.green : C.warn, cursor: 'pointer' }}>
                <Icon name={u.status === 'blocked' ? 'Unlock' : 'Lock'} size={12} />
              </button>
              {callerRole === 'superadmin' && (
                <button onClick={() => setDeleting(u)} title="Удалить"
                  style={{ padding: '5px 8px', borderRadius: 7, fontSize: 11, border: 'none', background: `${C.danger}18`, color: C.danger, cursor: 'pointer' }}>
                  <Icon name="Trash2" size={12} />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Таб: ТАРИФЫ ─────────────────────────────────────────────────────────────
function TabTariffs() {
  const tariffs = [
    { name: 'Starter',    price: '$0/мес',   vol: 'до $100K',  commission: '0.3%', features: ['5 сетей', 'Базовый KYC', 'Email-поддержка'] },
    { name: 'Business',   price: '$299/мес',  vol: 'до $1M',    commission: '0.2%', features: ['20 сетей', 'Ускоренный KYC', 'Приоритетная поддержка', 'API'] },
    { name: 'Enterprise', price: '$999/мес',  vol: 'до $10M',   commission: '0.15%', features: ['Все сети', 'VIP KYC', 'Dedicated менеджер', 'API + Webhooks', 'White-label'] },
    { name: 'Unlimited',  price: 'Договор',   vol: 'Без лимита', commission: 'Индив.', features: ['Всё из Enterprise', 'Кастомные правила', 'On-premise вариант'] },
  ];
  const [assigning, setAssigning] = useState(false);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Тарифные планы</h2>
          <div style={{ fontSize: 13, color: C.dim }}>Управление тарифами и назначение клиентам</div>
        </div>
        <button onClick={() => setAssigning(true)} style={{ padding: '9px 18px', borderRadius: 9, background: C.accent, color: '#fff', fontWeight: 700, fontSize: 13, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7 }}>
          <Icon name="Plus" size={14} /> Назначить тариф
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 28 }}>
        {tariffs.map((t, i) => (
          <div key={t.name} style={{ background: C.card, border: `1px solid ${i === 2 ? C.accent + '66' : C.border}`, borderRadius: 16, padding: '22px 20px', position: 'relative' }}>
            {i === 2 && <div style={{ position: 'absolute', top: -10, left: '50%', transform: 'translateX(-50%)', background: C.accent, color: '#fff', fontSize: 10, fontWeight: 700, padding: '3px 12px', borderRadius: 20, whiteSpace: 'nowrap' }}>POPULAR</div>}
            <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 17, fontWeight: 700, marginBottom: 4 }}>{t.name}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: C.accent, marginBottom: 2 }}>{t.price}</div>
            <div style={{ fontSize: 12, color: C.dim, marginBottom: 16 }}>{t.vol} · {t.commission}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {t.features.map(f => (
                <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>
                  <Icon name="Check" size={12} style={{ color: C.green, flexShrink: 0 }} /> {f}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {assigning && (
        <div style={{ background: `${C.accent}0a`, border: `1px solid ${C.accent}33`, borderRadius: 14, padding: '20px 24px', display: 'flex', gap: 16, alignItems: 'center' }}>
          <Icon name="UserCog" size={20} style={{ color: C.accent, flexShrink: 0 }} />
          <div style={{ flex: 1, fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>
            Назначение тарифа реализуется через поле <code style={{ background: 'rgba(255,255,255,0.1)', padding: '1px 6px', borderRadius: 4 }}>tariff</code> в профиле пользователя. Расширенное управление тарифами — в разделе Конфигурация.
          </div>
          <button onClick={() => setAssigning(false)} style={{ background: 'none', border: 'none', color: C.dim, cursor: 'pointer' }}><Icon name="X" size={16} /></button>
        </div>
      )}
    </div>
  );
}

// ─── Таб: КОНФИГУРАЦИЯ ───────────────────────────────────────────────────────
function TabConfig() {
  const [saved, setSaved] = useState(false);
  const configs = [
    { label: 'Максимальная сумма платежа (USD)', value: '5,000,000', key: 'max_payment' },
    { label: 'Лимит для AML-проверки (USD)', value: '10,000', key: 'aml_threshold' },
    { label: 'Максимум агентов в рое', value: '50', key: 'max_agents' },
    { label: 'Таймаут маршрута (сек)', value: '120', key: 'route_timeout' },
    { label: 'Комиссия по умолчанию (%)', value: '0.25', key: 'default_fee' },
    { label: 'Email поддержки', value: 'support@most.network', key: 'support_email' },
  ];
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 20, fontWeight: 700 }}>Конфигурация платформы</h2>
        <button onClick={() => { setSaved(true); setTimeout(() => setSaved(false), 2000); }}
          style={{ padding: '9px 20px', borderRadius: 9, background: saved ? C.green : C.accent, color: saved ? '#0A0A1A' : '#fff', fontWeight: 700, fontSize: 13, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7, transition: 'all 0.3s' }}>
          <Icon name={saved ? 'Check' : 'Save'} size={14} /> {saved ? 'Сохранено!' : 'Сохранить'}
        </button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {configs.map(c => (
          <div key={c.key} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: '16px 18px' }}>
            <label style={{ fontSize: 12, color: C.dim, display: 'block', marginBottom: 8 }}>{c.label}</label>
            <input defaultValue={c.value}
              style={{ width: '100%', padding: '10px 14px', borderRadius: 8, fontSize: 14, background: 'rgba(255,255,255,0.05)', border: `1px solid ${C.border}`, color: C.text, outline: 'none', boxSizing: 'border-box', fontFamily: 'JetBrains Mono, monospace' }}
              onFocus={e => (e.target.style.borderColor = C.accent)}
              onBlur={e => (e.target.style.borderColor = C.border)} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Таб: АУДИТ АДМИНОВ ──────────────────────────────────────────────────────
function TabAdminAudit({ apiFetch }: { apiFetch: (url: string, opts?: RequestInit) => Promise<Response> }) {
  const [items, setItems]     = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(null);

  useEffect(() => {
    setLoading(true);
    apiFetch(`${ADMIN_API}?resource=admin_audit&limit=50`)
      .then(r => r.json()).then(d => setItems(d.items || [])).finally(() => setLoading(false));
  }, [apiFetch]);

  const ACTION_COLOR: Record<string, string> = {
    'admin.update_role':   C.accent,
    'admin.set_status':    C.warn,
    'admin.create_user':   C.green,
    'admin.delete_user':   C.danger,
    'incident.freeze_and_reject': C.danger,
    'regulator.emergency_stop': C.danger,
  };

  return (
    <div>
      <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 20, fontWeight: 700, marginBottom: 20 }}>Лог действий администраторов</h2>
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '140px 180px 1fr 80px 28px', gap: 8, padding: '10px 20px', borderBottom: `1px solid ${C.border}`, fontSize: 11, color: C.dim, fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.07em' }}>
          <span>ВРЕМЯ</span><span>КТО</span><span>ДЕЙСТВИЕ</span><span>IP</span><span></span>
        </div>
        {loading ? <div style={{ padding: 48, textAlign: 'center', color: C.dim }}><Icon name="Loader" size={22} style={{ animation: 'spin 1s linear infinite' }} /></div>
          : items.length === 0 ? <div style={{ padding: 48, textAlign: 'center', color: C.dim }}>Нет записей</div>
          : items.map((entry, i) => {
            const ac = ACTION_COLOR[entry.action] || C.dim;
            return (
              <div key={entry.id} style={{ borderBottom: i < items.length - 1 ? `1px solid ${C.border}` : 'none' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '140px 180px 1fr 80px 28px', gap: 8, padding: '11px 20px', alignItems: 'center', cursor: 'pointer', transition: 'background 0.15s' }}
                  onClick={() => setExpanded(expanded === entry.id ? null : entry.id)}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <span style={{ fontSize: 11, color: C.dim, fontFamily: 'JetBrains Mono, monospace' }}>{fmtDate(entry.created_at)}</span>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.email}</div>
                    <RoleBadge role={entry.role} />
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 5, background: `${ac}18`, color: ac, fontFamily: 'JetBrains Mono, monospace', width: 'fit-content' }}>
                    {entry.action}
                  </span>
                  <span style={{ fontSize: 10, color: C.dim, fontFamily: 'JetBrains Mono, monospace' }}>{entry.ip || '—'}</span>
                  <Icon name={expanded === entry.id ? 'ChevronUp' : 'ChevronDown'} size={13} style={{ color: C.dim }} />
                </div>
                {expanded === entry.id && (
                  <div style={{ padding: '0 20px 14px' }}>
                    <pre style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: C.dim, background: 'rgba(0,0,0,0.2)', borderRadius: 8, padding: '10px 14px', margin: 0, overflow: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                      {JSON.stringify(entry.details, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            );
          })}
      </div>
    </div>
  );
}

// ─── Таб: КОШЕЛЬКИ (Finance) ──────────────────────────────────────────────────
function TabWallets() {
  const [op2fa, setOp2fa]     = useState<string | null>(null);
  const [code,  setCode]      = useState('');
  const [done,  setDone]      = useState<string | null>(null);

  const wallets = [
    { net: 'ETH',  balance: 142.87,  limit: 500,   currency: 'ETH',  color: '#627EEA' },
    { net: 'BTC',  balance: 4.23,    limit: 20,    currency: 'BTC',  color: '#F7931A' },
    { net: 'USDT', balance: 487420,  limit: 1000000, currency: 'USDT', color: '#26A17B' },
    { net: 'TRX',  balance: 9823100, limit: 50000000, currency: 'TRX', color: '#E50915' },
    { net: 'TON',  balance: 32100,   limit: 100000, currency: 'TON',  color: '#0088CC' },
    { net: 'BNB',  balance: 218.4,   limit: 1000,  currency: 'BNB',  color: '#F3BA2F' },
  ];

  const movements = [
    { date: '02.07.2026 14:21', type: 'Cold → Hot', net: 'ETH', amount: '+50 ETH', status: 'done' },
    { date: '02.07.2026 11:05', type: 'Hot → Cold', net: 'USDT', amount: '-200K USDT', status: 'done' },
    { date: '01.07.2026 22:30', type: 'Cold → Hot', net: 'USDT', amount: '+500K USDT', status: 'done' },
    { date: '01.07.2026 18:00', type: 'Fee sweep',  net: 'ETH', amount: '+2.1 ETH', status: 'done' },
  ];

  const confirm2fa = (op: string) => {
    if (code === '2222') { setOp2fa(null); setCode(''); setDone(op); setTimeout(() => setDone(null), 3000); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {op2fa && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
          onClick={e => e.target === e.currentTarget && setOp2fa(null)}>
          <div style={{ width: '100%', maxWidth: 360, background: C.card, border: `1px solid ${C.border}`, borderRadius: 18, padding: '28px 32px', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 17, fontWeight: 700 }}>Подтверждение 2FA</div>
            <div style={{ fontSize: 13, color: C.dim }}>{op2fa}</div>
            <input value={code} onChange={e => setCode(e.target.value)} placeholder="Код из приложения"
              style={{ padding: '12px 14px', borderRadius: 10, fontSize: 16, background: 'rgba(255,255,255,0.05)', border: `1px solid ${C.border}`, color: C.text, outline: 'none', fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.3em', textAlign: 'center', boxSizing: 'border-box', width: '100%' }} />
            <div style={{ fontSize: 11, color: C.dim, textAlign: 'center' }}>Демо: введите 2222</div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setOp2fa(null)} style={{ flex: 1, padding: '11px', borderRadius: 9, background: 'transparent', border: `1px solid ${C.border}`, color: C.dim, cursor: 'pointer' }}>Отмена</button>
              <button onClick={() => confirm2fa(op2fa!)} style={{ flex: 2, padding: '11px', borderRadius: 9, background: C.gold, color: '#0A0A1A', fontWeight: 700, border: 'none', cursor: 'pointer' }}>Подтвердить</button>
            </div>
          </div>
        </div>
      )}

      {done && (
        <div style={{ padding: '12px 16px', borderRadius: 10, background: `${C.green}0d`, border: `1px solid ${C.green}33`, color: C.green, fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Icon name="CheckCircle2" size={15} /> Операция выполнена: {done}
        </div>
      )}

      <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 20, fontWeight: 700, margin: 0 }}>Hot-кошельки по сетям</h2>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
        {wallets.map(w => {
          const pct = Math.min((w.balance / w.limit) * 100, 100);
          return (
            <div key={w.net} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '18px 20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: `${w.color}22`, border: `1px solid ${w.color}55`, display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 700, color: w.color }}>
                    {w.net}
                  </div>
                  <span style={{ fontWeight: 600 }}>{w.net} Network</span>
                </div>
                <span style={{ fontSize: 11, color: pct > 80 ? C.green : pct > 40 ? C.warn : C.danger }}>
                  {pct.toFixed(0)}%
                </span>
              </div>
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 18, fontWeight: 700, marginBottom: 4 }}>
                {w.balance.toLocaleString()} <span style={{ fontSize: 12, color: C.dim }}>{w.currency}</span>
              </div>
              <div style={{ fontSize: 11, color: C.dim, marginBottom: 10 }}>Лимит: {w.limit.toLocaleString()} {w.currency}</div>
              <div style={{ height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
                <div style={{ height: '100%', borderRadius: 3, background: pct > 80 ? C.green : pct > 40 ? C.warn : C.danger, width: `${pct}%`, transition: 'width 0.5s' }} />
              </div>
              <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
                <button onClick={() => setOp2fa(`Пополнить Hot Pool ${w.net} из Cold Vault`)}
                  style={{ flex: 1, padding: '7px 0', borderRadius: 8, fontSize: 11, fontWeight: 700, border: 'none', background: `${w.color}18`, color: w.color, cursor: 'pointer' }}>
                  ↓ Из Cold
                </button>
                <button onClick={() => setOp2fa(`Вывести ${w.net} в Cold Vault`)}
                  style={{ flex: 1, padding: '7px 0', borderRadius: 8, fontSize: 11, fontWeight: 600, border: `1px solid ${C.border}`, background: 'transparent', color: C.dim, cursor: 'pointer' }}>
                  ↑ В Cold
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* История движений */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: '20px 24px' }}>
        <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 15, fontWeight: 600, marginBottom: 14 }}>История движений между пулами</div>
        {movements.map((m, i) => (
          <div key={i} style={{ display: 'flex', gap: 14, padding: '10px 0', borderBottom: i < movements.length - 1 ? `1px solid ${C.border}` : 'none', alignItems: 'center', fontSize: 13 }}>
            <span style={{ color: C.dim, fontFamily: 'JetBrains Mono, monospace', fontSize: 11, width: 120, flexShrink: 0 }}>{m.date}</span>
            <span style={{ color: m.type.includes('Cold → Hot') ? C.green : C.accent }}>{m.type}</span>
            <span style={{ background: 'rgba(255,255,255,0.06)', padding: '2px 8px', borderRadius: 6, fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }}>{m.net}</span>
            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 600, marginLeft: 'auto' }}>{m.amount}</span>
            <Icon name="CheckCircle2" size={14} style={{ color: C.green }} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Таб: СТАТУС СЕРВИСОВ (DevOps) ────────────────────────────────────────────
function TabServices() {
  const [maintenance, setMaintenance] = useState(false);
  const [restarting,  setRestarting]  = useState<string | null>(null);

  const services = [
    { name: 'Orchestrator',    status: 'ok',   rps: 142, p50: 12, p95: 45, p99: 89,  err: 0.01 },
    { name: 'Coordinator',     status: 'ok',   rps: 89,  p50: 8,  p95: 28, p99: 61,  err: 0.02 },
    { name: 'Risk Engine',     status: 'ok',   rps: 210, p50: 5,  p95: 19, p99: 44,  err: 0.00 },
    { name: 'Regulator Node',  status: 'warn', rps: 34,  p50: 22, p95: 87, p99: 210, err: 0.12 },
    { name: 'Agent Pool ETH',  status: 'ok',   rps: 67,  p50: 18, p95: 55, p99: 120, err: 0.03 },
    { name: 'Agent Pool BTC',  status: 'ok',   rps: 23,  p50: 14, p95: 42, p99: 98,  err: 0.01 },
    { name: 'Agent Pool TON',  status: 'error', rps: 0,  p50: 0,  p95: 0,  p99: 0,   err: 100  },
    { name: 'KYC Service',     status: 'ok',   rps: 12,  p50: 35, p95: 110, p99: 280, err: 0.05 },
  ];

  const doRestart = (name: string) => {
    setRestarting(name);
    setTimeout(() => setRestarting(null), 2500);
  };

  const ST: Record<string, { dot: string; label: string }> = {
    ok:    { dot: C.green,  label: '● Работает' },
    warn:  { dot: C.warn,   label: '● Деградация' },
    error: { dot: C.danger, label: '● Недоступен' },
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, alignItems: 'center' }}>
        <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 20, fontWeight: 700, margin: 0 }}>Статус сервисов</h2>
        <div style={{ flex: 1 }} />
        <button onClick={() => setMaintenance(m => !m)} style={{ padding: '9px 18px', borderRadius: 9, background: maintenance ? `${C.warn}25` : 'rgba(255,255,255,0.06)', border: `1px solid ${maintenance ? C.warn : C.border}`, color: maintenance ? C.warn : C.dim, fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7 }}>
          <Icon name={maintenance ? 'ToggleRight' : 'ToggleLeft'} size={16} />
          {maintenance ? 'Режим обслуживания ВКЛ' : 'Режим обслуживания'}
        </button>
      </div>

      {maintenance && (
        <div style={{ padding: '14px 18px', borderRadius: 12, background: `${C.warn}0d`, border: `1px solid ${C.warn}33`, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10, color: C.warn, fontSize: 13 }}>
          <Icon name="AlertTriangle" size={16} /> Платформа переведена в режим обслуживания. Новые платежи не принимаются.
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {services.map(svc => (
          <div key={svc.name} style={{ background: C.card, border: `1px solid ${svc.status === 'error' ? C.danger + '55' : svc.status === 'warn' ? C.warn + '44' : C.border}`, borderRadius: 14, padding: '16px 20px', display: 'grid', gridTemplateColumns: '200px 120px 80px 280px 120px', gap: 12, alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 2 }}>{svc.name}</div>
              <div style={{ fontSize: 12, color: ST[svc.status].dot, fontWeight: 600 }}>{ST[svc.status].label}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: C.dim, marginBottom: 2 }}>Req/sec</div>
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 16, fontWeight: 700, color: svc.rps > 0 ? C.text : C.dim }}>{svc.rps}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: C.dim, marginBottom: 2 }}>Error %</div>
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 14, fontWeight: 700, color: svc.err > 1 ? C.danger : svc.err > 0.05 ? C.warn : C.green }}>{svc.err.toFixed(2)}</div>
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              {[{ l: 'P50', v: svc.p50 }, { l: 'P95', v: svc.p95 }, { l: 'P99', v: svc.p99 }].map(m => (
                <div key={m.l}>
                  <div style={{ fontSize: 10, color: C.dim, marginBottom: 2 }}>{m.l}</div>
                  <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13, fontWeight: 600, color: m.v > 200 ? C.danger : m.v > 80 ? C.warn : C.text }}>{m.v}ms</div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => doRestart(svc.name)} disabled={restarting === svc.name}
                style={{ padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, border: `1px solid ${C.border}`, background: 'transparent', color: restarting === svc.name ? C.green : C.dim, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
                <Icon name={restarting === svc.name ? 'Loader' : 'RefreshCw'} size={12} style={{ animation: restarting === svc.name ? 'spin 1s linear infinite' : 'none' }} />
                {restarting === svc.name ? 'Перезапуск...' : 'Рестарт'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Таб: Дашборд (Overview) ──────────────────────────────────────────────────
function TabOverview({ apiFetch }: { apiFetch: (url: string, opts?: RequestInit) => Promise<Response> }) {
  const [stats, setStats]     = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch(`${ADMIN_API}?resource=stats`).then(r => r.json()).then(setStats).finally(() => setLoading(false));
  }, [apiFetch]);

  const roleStats = Object.entries(stats?.by_role || {}).sort((a, b) => b[1] - a[1]);
  const cards = [
    { label: 'Транзакций сегодня', value: stats?.tx_today, icon: 'Zap',       color: C.accent },
    { label: 'Объём сегодня',      value: stats ? fmtMoney(stats.vol_today) : '—', icon: 'TrendingUp', color: C.gold },
    { label: 'KYC на проверке',    value: stats?.kyc_pending, icon: 'FileCheck', color: C.warn },
    { label: 'Активных',           value: stats?.by_status?.active, icon: 'Users', color: C.green },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {cards.map(c => (
          <div key={c.label} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '18px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <div style={{ width: 30, height: 30, borderRadius: 8, background: `${c.color}18`, display: 'grid', placeItems: 'center' }}>
                <Icon name={c.icon} size={15} style={{ color: c.color }} />
              </div>
              <span style={{ fontSize: 11, color: C.dim }}>{c.label}</span>
            </div>
            {loading ? <div style={{ height: 26, background: 'rgba(255,255,255,0.05)', borderRadius: 6 }} />
              : <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 26, fontWeight: 700, color: c.color }}>{c.value ?? '—'}</div>}
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Распределение ролей */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: '20px 24px' }}>
          <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 14, fontWeight: 600, marginBottom: 16 }}>Пользователи по ролям</div>
          {loading ? <div style={{ height: 120, background: 'rgba(255,255,255,0.04)', borderRadius: 8 }} /> :
            roleStats.map(([role, count]) => {
              const rc = ROLE_COLORS[role];
              const total = roleStats.reduce((s, [, c]) => s + c, 0);
              return (
                <div key={role} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <span style={{ fontSize: 12, width: 80, color: rc?.text || C.dim }}>{rc?.label || role}</span>
                  <div style={{ flex: 1, height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', background: rc?.text || C.dim, borderRadius: 3, width: `${(count / total) * 100}%`, transition: 'width 0.5s' }} />
                  </div>
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: C.dim, width: 30, textAlign: 'right' }}>{count}</span>
                </div>
              );
            })}
        </div>

        {/* Статусы */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: '20px 24px' }}>
          <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 14, fontWeight: 600, marginBottom: 16 }}>Статусы аккаунтов</div>
          {loading ? <div style={{ height: 120, background: 'rgba(255,255,255,0.04)', borderRadius: 8 }} /> :
            Object.entries(stats?.by_status || {}).map(([status, count]) => (
              <div key={status} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1px solid ${C.border}`, fontSize: 13 }}>
                <StatusPill status={status} />
                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 14, fontWeight: 700 }}>{count}</span>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}

// ─── Главный компонент ─────────────────────────────────────────────────────────
export default function AdminPanel() {
  const { user, logout, hasRole } = useAuth();
  const navigate = useNavigate();
  const { apiFetch } = useApi();
  const [tab, setTab] = useState<Tab>('users');

  // Все хуки выше раннего return
  useEffect(() => {
    if (!hasRole('superadmin', 'admin', 'finance', 'devops')) {
      navigate('/login', { replace: true });
    }
  }, [hasRole, navigate]);

  if (!hasRole('superadmin', 'admin', 'finance', 'devops')) return null;

  const role = (user?.role || 'admin') as AdminRole;

  // Меню по роли
  type NavItem = { id: Tab; label: string; icon: string; group?: string };
  const NAV: NavItem[] = [];

  if (['superadmin', 'admin'].includes(role)) {
    NAV.push(
      { id: 'users',   label: 'Пользователи',   icon: 'Users',       group: 'Управление' },
      { id: 'tariffs', label: 'Тарифы',          icon: 'CreditCard',  group: 'Управление' },
      { id: 'config',  label: 'Конфигурация',    icon: 'Settings',    group: 'Управление' },
      { id: 'audit',   label: 'Логи действий',   icon: 'ClipboardList', group: 'Управление' },
    );
  }
  if (role === 'superadmin') {
    NAV.push({ id: 'roles', label: 'Управление ролями', icon: 'ShieldCheck', group: 'Управление' });
  }
  if (['superadmin', 'finance'].includes(role)) {
    NAV.push(
      { id: 'wallets', label: 'Кошельки',         icon: 'Wallet',   group: 'Finance'    },
      { id: 'pools',   label: 'Балансировка пулов', icon: 'ArrowLeftRight', group: 'Finance' },
      { id: 'fees',    label: 'Комиссии сети',    icon: 'Percent',  group: 'Finance'    },
      { id: 'revenue', label: 'Отчёт по прибыли', icon: 'BarChart2', group: 'Finance'   },
    );
  }
  if (['superadmin', 'devops'].includes(role)) {
    NAV.push(
      { id: 'services', label: 'Статус сервисов', icon: 'Activity',    group: 'DevOps' },
      { id: 'metrics',  label: 'Метрики',         icon: 'Gauge',       group: 'DevOps' },
      { id: 'errors',   label: 'Логи ошибок',     icon: 'AlertCircle', group: 'DevOps' },
      { id: 'deploy',   label: 'Деплой',          icon: 'Rocket',      group: 'DevOps' },
    );
  }

  // Устанавливаем первый доступный таб
  const firstTab = NAV[0]?.id;
  const currentTab = NAV.find(n => n.id === tab) ? tab : firstTab;

  const ROLE_META = ROLE_COLORS[role];
  const groups = [...new Set(NAV.map(n => n.group))];

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: C.bg, color: C.text, fontFamily: "'Rubik', sans-serif" }}>
      {/* ── Sidebar ─────────────────────────────────────────────────────────── */}
      <aside style={{ width: 220, flexShrink: 0, background: C.side, borderRight: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', position: 'sticky', top: 0, height: '100vh' }}>
        {/* Logo */}
        <div style={{ padding: '20px 16px 16px', borderBottom: `1px solid ${C.border}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 9, background: C.accent + '22', border: `1px solid ${C.accent}44`, display: 'grid', placeItems: 'center' }}>
              <Icon name="ShieldCheck" size={17} style={{ color: C.accent }} />
            </div>
            <div>
              <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 16 }}>MOST</div>
              <div style={{ fontSize: 9, color: C.dim, letterSpacing: '0.12em', fontFamily: 'JetBrains Mono, monospace' }}>ADMIN PANEL</div>
            </div>
          </div>
          <RoleBadge role={role} />
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '12px 10px', overflowY: 'auto' }}>
          {groups.map(group => (
            <div key={group} style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)', letterSpacing: '0.12em', fontFamily: 'JetBrains Mono, monospace', padding: '0 10px', marginBottom: 4 }}>
                {group?.toUpperCase()}
              </div>
              {NAV.filter(n => n.group === group).map(item => (
                <button key={item.id} onClick={() => setTab(item.id)} style={{
                  display: 'flex', alignItems: 'center', gap: 9, width: '100%', padding: '9px 11px',
                  borderRadius: 9, marginBottom: 2,
                  background: currentTab === item.id ? `${ROLE_META?.text || C.accent}14` : 'transparent',
                  border: `1px solid ${currentTab === item.id ? `${ROLE_META?.text || C.accent}33` : 'transparent'}`,
                  color: currentTab === item.id ? (ROLE_META?.text || C.accent) : C.dim,
                  fontSize: 13, fontWeight: currentTab === item.id ? 600 : 400,
                  cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s',
                  fontFamily: "'Rubik', sans-serif",
                }}>
                  <Icon name={item.icon} size={14} style={{ flexShrink: 0 }} />
                  {item.label}
                </button>
              ))}
            </div>
          ))}
        </nav>

        {/* User info */}
        <div style={{ padding: '10px 10px', borderTop: `1px solid ${C.border}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: 'rgba(255,255,255,0.03)', borderRadius: 9, marginBottom: 6 }}>
            <div style={{ width: 28, height: 28, borderRadius: 7, background: `${ROLE_META?.text || C.accent}20`, display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 700, color: ROLE_META?.text || C.accent, flexShrink: 0 }}>
              {(user?.email?.[0] ?? 'A').toUpperCase()}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 11, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.email}</div>
              <div style={{ fontSize: 9, color: C.dim, fontFamily: 'JetBrains Mono, monospace' }}>{role.toUpperCase()}</div>
            </div>
          </div>
          <button onClick={() => { logout(); navigate('/login', { replace: true }); }}
            style={{ display: 'flex', alignItems: 'center', gap: 7, width: '100%', padding: '7px 10px', borderRadius: 8, background: 'transparent', border: 'none', color: C.dim, fontSize: 12, cursor: 'pointer', fontFamily: "'Rubik', sans-serif" }}
            onMouseEnter={e => (e.currentTarget.style.color = C.danger)}
            onMouseLeave={e => (e.currentTarget.style.color = C.dim)}>
            <Icon name="LogOut" size={13} /> Выйти
          </button>
        </div>
      </aside>

      {/* ── Main ─────────────────────────────────────────────────────────────── */}
      <main style={{ flex: 1, minWidth: 0, overflow: 'auto' }}>
        <div style={{ padding: '16px 32px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(8,8,22,0.8)', backdropFilter: 'blur(10px)', position: 'sticky', top: 0, zIndex: 10 }}>
          <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 18, fontWeight: 700, margin: 0 }}>
            {NAV.find(n => n.id === currentTab)?.label || 'Обзор'}
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: ROLE_META?.text || C.accent, fontFamily: 'JetBrains Mono, monospace' }}>
            <Icon name="ShieldCheck" size={12} /> {role.toUpperCase()} PANEL
          </div>
        </div>

        <div style={{ padding: '26px 32px' }}>
          {/* Admin/Superadmin вкладки */}
          {currentTab === 'users'    && <TabUsers    apiFetch={apiFetch} callerRole={role} />}
          {currentTab === 'tariffs'  && <TabTariffs  />}
          {currentTab === 'config'   && <TabConfig   />}
          {currentTab === 'audit'    && <TabAdminAudit apiFetch={apiFetch} />}
          {currentTab === 'roles'    && <TabUsers    apiFetch={apiFetch} callerRole={role} />}

          {/* Finance вкладки */}
          {currentTab === 'wallets'  && <TabWallets  />}
          {currentTab === 'pools'    && <TabWallets  />}
          {currentTab === 'fees'     && (
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: '32px', textAlign: 'center', color: C.dim }}>
              <Icon name="Percent" size={40} style={{ opacity: 0.3, marginBottom: 12 }} />
              <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>Управление комиссиями</div>
              <div style={{ fontSize: 13 }}>Настройка комиссий по сетям и тарифам — в разделе Конфигурация</div>
            </div>
          )}
          {currentTab === 'revenue'  && <TabOverview apiFetch={apiFetch} />}

          {/* DevOps вкладки */}
          {currentTab === 'services' && <TabServices />}
          {currentTab === 'metrics'  && <TabServices />}
          {currentTab === 'errors'   && <TabAdminAudit apiFetch={apiFetch} />}
          {currentTab === 'deploy'   && (
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: '32px', textAlign: 'center', color: C.dim }}>
              <Icon name="Rocket" size={40} style={{ opacity: 0.3, marginBottom: 12 }} />
              <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>CI/CD Pipeline</div>
              <div style={{ fontSize: 13 }}>Управление деплоем через интерфейс платформы. Текущий билд: <span style={{ color: C.text, fontFamily: 'JetBrains Mono, monospace' }}>e6c2be4</span></div>
            </div>
          )}

          {/* Fallback — Overview */}
          {!NAV.find(n => n.id === currentTab) && <TabOverview apiFetch={apiFetch} />}
        </div>
      </main>

      <style>{`
        @keyframes spin  { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        input::placeholder, textarea::placeholder { color: rgba(255,255,255,0.2); }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 2px; }
      `}</style>
    </div>
  );
}
