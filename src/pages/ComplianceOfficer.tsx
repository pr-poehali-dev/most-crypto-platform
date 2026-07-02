import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useApi } from '@/hooks/useApi';
import Icon from '@/components/ui/icon';

// ─── URLs ─────────────────────────────────────────────────────────────────────
const COMPLIANCE_API  = 'https://functions.poehali.dev/30cbda0e-a401-4771-99ae-9526937b05db';
const APPROVE_URL     = 'https://functions.poehali.dev/9cec00cd-a2d5-4d4a-96b8-ddb169426cc6';
const RISK_CHECK_URL  = 'https://functions.poehali.dev/410aaa09-451b-41e6-b66e-e0015ce8011c';

// ─── Палитра ──────────────────────────────────────────────────────────────────
const C = {
  bg:      '#07071A',
  sidebar: '#0B0B20',
  card:    '#0F0F28',
  border:  'rgba(255,255,255,0.07)',
  accent:  '#00FF88',
  text:    '#FFFFFF',
  dim:     'rgba(255,255,255,0.45)',
  danger:  '#FF4444',
  warn:    '#FFAA00',
  info:    '#4D9FFF',
};

type Tab = 'dashboard' | 'queue' | 'aml' | 'frozen' | 'audit';

// ─── Типы ─────────────────────────────────────────────────────────────────────
interface Stats {
  pending: number; approved_today: number; rejected_today: number;
  high_risk: number; frozen: number;
  risk_by_day: { date: string; avg_score: number; count: number }[];
  top_suspicious: { address: string; score: number; count: number }[];
}

interface QueueItem {
  id: string; user_email: string; user_company: string | null;
  from_currency: string; to_currency: string; amount: number;
  destination_country: string | null; destination_address: string;
  risk_score: number; risk_level: string; created_at: string | null;
}

interface FrozenUser {
  id: string; email: string; company_name: string | null;
  inn: string | null; freeze_reason: string | null; frozen_at: string | null;
}

interface AuditEntry {
  id: number; action: string; details: Record<string, unknown>;
  ip_address: string | null; created_at: string | null;
  user_email: string | null; user_role: string | null;
}

// ─── Хелперы ──────────────────────────────────────────────────────────────────
const riskColor = (s: number) => s >= 60 ? C.danger : s >= 30 ? C.warn : C.accent;

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function fmtMoney(n: number) {
  return n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}M`
       : n >= 1_000     ? `$${(n / 1_000).toFixed(0)}K`
       : `$${n}`;
}

function RiskBadge({ score }: { score: number }) {
  const c = riskColor(score);
  const label = score >= 60 ? 'HIGH' : score >= 30 ? 'MED' : 'LOW';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 9px', borderRadius: 20, fontSize: 11, fontWeight: 700,
      fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.06em',
      background: `${c}15`, border: `1px solid ${c}44`, color: c,
    }}>
      {score} · {label}
    </span>
  );
}

// ─── Мини-график рисков ───────────────────────────────────────────────────────
function RiskSparkline({ data }: { data: Stats['risk_by_day'] }) {
  if (!data.length) return <div style={{ color: C.dim, fontSize: 13 }}>Нет данных за период</div>;
  const max = Math.max(...data.map(d => d.avg_score), 1);
  const W = 480, H = 80;
  const pts = data.map((d, i) => {
    const x = (i / Math.max(data.length - 1, 1)) * W;
    const y = H - (d.avg_score / max) * H * 0.85 - 4;
    return `${x},${y}`;
  });
  const polyline = pts.join(' ');
  const area = `0,${H} ${polyline} ${W},${H}`;
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: 'visible' }}>
      <defs>
        <linearGradient id="rg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={C.warn} stopOpacity="0.3" />
          <stop offset="100%" stopColor={C.warn} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={area} fill="url(#rg)" />
      <polyline points={polyline} fill="none" stroke={C.warn} strokeWidth="2" strokeLinejoin="round" />
      {data.map((d, i) => {
        const x = (i / Math.max(data.length - 1, 1)) * W;
        const y = H - (d.avg_score / max) * H * 0.85 - 4;
        return <circle key={i} cx={x} cy={y} r={3} fill={C.warn} />;
      })}
    </svg>
  );
}

// ─── Модалка одобрения/отклонения ─────────────────────────────────────────────
function ApproveModal({ item, onClose, onDone, apiFetch }: {
  item: QueueItem; onClose: () => void; onDone: () => void;
  apiFetch: (url: string, opts?: RequestInit) => Promise<Response>;
}) {
  const [action,   setAction]   = useState<'approve' | 'reject' | null>(null);
  const [reason,   setReason]   = useState('');
  const [checked,  setChecked]  = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [err,      setErr]      = useState('');
  const [done,     setDone]     = useState(false);
  const [newStatus, setNewStatus] = useState('');

  const highRisk = item.risk_score >= 80;

  const canSubmit = action &&
    (action === 'approve' ? (!highRisk || checked) : reason.trim().length > 3);

  const submit = async () => {
    if (!action || !canSubmit) return;
    setLoading(true); setErr('');
    try {
      const res = await apiFetch(APPROVE_URL, {
        method: 'POST',
        body: JSON.stringify({ order_id: item.id, action, reason: reason.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setNewStatus(data.new_status);
      setDone(true);
      setTimeout(() => { onClose(); onDone(); }, 1800);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Ошибка');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center',
      justifyContent: 'center', padding: 24,
      background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)',
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ width: '100%', maxWidth: 580, background: C.card, border: `1px solid ${C.border}`, borderRadius: 20, overflow: 'hidden' }}>

        {/* Шапка */}
        <div style={{ padding: '20px 28px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 11, color: C.dim, fontFamily: 'JetBrains Mono, monospace', marginBottom: 4 }}>
              AML · {item.id.slice(0, 8).toUpperCase()}
            </div>
            <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 18, fontWeight: 700 }}>
              {item.user_company || item.user_email}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: C.dim, cursor: 'pointer' }}>
            <Icon name="X" size={20} />
          </button>
        </div>

        <div style={{ padding: '22px 28px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Инфо */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
            {[
              { l: 'Сумма',    v: `${item.amount.toLocaleString('ru')} ${item.from_currency}` },
              { l: 'Получить', v: item.to_currency },
              { l: 'Страна',   v: item.destination_country || '—' },
            ].map(f => (
              <div key={f.l} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: '10px 14px' }}>
                <div style={{ fontSize: 10, color: C.dim, marginBottom: 3 }}>{f.l.toUpperCase()}</div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{f.v}</div>
              </div>
            ))}
          </div>

          {/* Адрес */}
          <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: '12px 14px' }}>
            <div style={{ fontSize: 10, color: C.dim, marginBottom: 4 }}>АДРЕС ПОЛУЧАТЕЛЯ</div>
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, wordBreak: 'break-all' }}>
              {item.destination_address}
            </div>
          </div>

          {/* Риск */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px', borderRadius: 12, background: `${riskColor(item.risk_score)}0d`, border: `1px solid ${riskColor(item.risk_score)}33` }}>
            <div style={{ width: 52, height: 52, borderRadius: '50%', flexShrink: 0, display: 'grid', placeItems: 'center', background: `${riskColor(item.risk_score)}15`, border: `2px solid ${riskColor(item.risk_score)}`, fontFamily: 'JetBrains Mono, monospace', fontSize: 16, fontWeight: 700, color: riskColor(item.risk_score) }}>
              {item.risk_score}
            </div>
            <div>
              <div style={{ fontWeight: 600, color: riskColor(item.risk_score) }}>
                Риск-скор {item.risk_score}/100 {item.risk_score >= 80 ? '— КРИТИЧЕСКИЙ' : item.risk_score >= 60 ? '— ВЫСОКИЙ' : '— СРЕДНИЙ'}
              </div>
              <div style={{ fontSize: 12, color: C.dim, marginTop: 2 }}>
                {item.risk_score >= 80 ? 'Возможная связь с санкционными адресами' : 'Требует ручной проверки AML-офицером'}
              </div>
            </div>
          </div>

          {/* Решение */}
          {!done && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {(['approve', 'reject'] as const).map(a => (
                  <button key={a} onClick={() => setAction(a)} style={{
                    padding: '12px', borderRadius: 10, fontWeight: 600, fontSize: 14, cursor: 'pointer',
                    border: `2px solid ${action === a ? (a === 'approve' ? C.accent : C.danger) : C.border}`,
                    background: action === a ? (a === 'approve' ? `${C.accent}15` : `${C.danger}15`) : 'transparent',
                    color: action === a ? (a === 'approve' ? C.accent : C.danger) : C.dim,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, transition: 'all 0.15s',
                  }}>
                    <Icon name={a === 'approve' ? 'CheckCircle2' : 'XCircle'} size={17} />
                    {a === 'approve' ? 'Одобрить' : 'Отклонить'}
                  </button>
                ))}
              </div>

              {/* Высокий риск: обязательный чекбокс */}
              {action === 'approve' && highRisk && (
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', padding: '12px 14px', borderRadius: 10, background: `${C.warn}10`, border: `1px solid ${C.warn}33` }}>
                  <input type="checkbox" checked={checked} onChange={e => setChecked(e.target.checked)} style={{ marginTop: 2, accentColor: C.warn }} />
                  <span style={{ fontSize: 13, color: C.warn, lineHeight: 1.5 }}>
                    Подтверждаю, что проверил адрес <strong>{item.destination_address.slice(0, 16)}…</strong> вручную через внешние AML-системы и принимаю ответственность за это решение.
                  </span>
                </label>
              )}

              {action === 'reject' && (
                <div>
                  <label style={{ fontSize: 12, color: C.dim, display: 'block', marginBottom: 6 }}>Причина отклонения *</label>
                  <textarea value={reason} onChange={e => setReason(e.target.value)} rows={3}
                    placeholder="Укажите причину..."
                    style={{ width: '100%', padding: '10px 14px', borderRadius: 10, fontSize: 13, background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.border}`, color: C.text, resize: 'vertical', outline: 'none', fontFamily: "'Rubik', sans-serif", boxSizing: 'border-box' }} />
                </div>
              )}

              {err && <div style={{ fontSize: 13, color: '#ff8888', display: 'flex', alignItems: 'center', gap: 6 }}><Icon name="AlertCircle" size={14} />{err}</div>}

              {action && (
                <button onClick={submit} disabled={loading || !canSubmit} style={{
                  padding: '13px', borderRadius: 10, fontWeight: 700, fontSize: 15, border: 'none',
                  cursor: (!canSubmit || loading) ? 'not-allowed' : 'pointer',
                  background: canSubmit ? (action === 'approve' ? C.accent : C.danger) : 'rgba(255,255,255,0.1)',
                  color: canSubmit ? (action === 'approve' ? C.bg : '#fff') : C.dim,
                  opacity: loading ? 0.7 : 1,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                }}>
                  {loading
                    ? <><Icon name="Loader" size={15} style={{ animation: 'spin 1s linear infinite' }} />Применяем решение...</>
                    : action === 'approve'
                    ? <><Icon name="CheckCircle2" size={16} />Подтвердить одобрение</>
                    : <><Icon name="XCircle" size={16} />Подтвердить отклонение</>}
                </button>
              )}
            </>
          )}

          {done && (
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <Icon name={newStatus === 'processing' ? 'CheckCircle2' : 'XCircle'} size={44}
                style={{ color: newStatus === 'processing' ? C.accent : C.danger, marginBottom: 12 }} />
              <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 18, fontWeight: 700 }}>
                {newStatus === 'processing' ? 'Платёж одобрен и запущен' : 'Платёж отклонён'}
              </div>
              <div style={{ fontSize: 13, color: C.dim, marginTop: 4 }}>Статус обновлён в БД...</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Модалка заморозки/разморозки ─────────────────────────────────────────────
function FreezeModal({ user, action, onClose, onDone, apiFetch }: {
  user: FrozenUser | null; action: 'freeze' | 'unfreeze' | 'escalate';
  onClose: () => void; onDone: () => void;
  apiFetch: (url: string, opts?: RequestInit) => Promise<Response>;
}) {
  const [reason,  setReason]  = useState('');
  const [loading, setLoading] = useState(false);
  const [err,     setErr]     = useState('');

  if (!user) return null;

  const submit = async () => {
    setLoading(true); setErr('');
    try {
      const res = await apiFetch(COMPLIANCE_API, {
        method: 'POST',
        body: JSON.stringify({ resource: action, user_id: user.id, reason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      onClose(); onDone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Ошибка');
    } finally {
      setLoading(false);
    }
  };

  const labels = {
    freeze:   { title: 'Заморозить аккаунт', btn: 'Заморозить', color: C.danger },
    unfreeze: { title: 'Разморозить аккаунт', btn: 'Разморозить', color: C.accent },
    escalate: { title: 'Эскалировать регулятору', btn: 'Эскалировать', color: C.warn },
  };
  const { title, btn, color } = labels[action];

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ width: '100%', maxWidth: 460, background: C.card, border: `1px solid ${C.border}`, borderRadius: 18, padding: '28px 32px', display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 18, fontWeight: 700 }}>{title}</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: C.dim, cursor: 'pointer' }}><Icon name="X" size={18} /></button>
        </div>
        <div style={{ padding: '12px 14px', borderRadius: 10, background: 'rgba(255,255,255,0.04)' }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>{user.company_name || user.email}</div>
          <div style={{ fontSize: 12, color: C.dim }}>{user.email}</div>
        </div>
        <div>
          <label style={{ fontSize: 12, color: C.dim, display: 'block', marginBottom: 6 }}>
            Причина {action === 'unfreeze' ? '(необязательно)' : '*'}
          </label>
          <textarea value={reason} onChange={e => setReason(e.target.value)} rows={3}
            placeholder={action === 'escalate' ? 'Опишите ситуацию для регулятора...' : 'Укажите причину...'}
            style={{ width: '100%', padding: '10px 14px', borderRadius: 10, fontSize: 13, background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.border}`, color: C.text, resize: 'none', outline: 'none', fontFamily: "'Rubik', sans-serif", boxSizing: 'border-box' }} />
        </div>
        {err && <div style={{ fontSize: 13, color: '#ff8888' }}>{err}</div>}
        <button onClick={submit} disabled={loading} style={{ padding: '13px', borderRadius: 10, fontWeight: 700, fontSize: 14, border: 'none', cursor: 'pointer', background: color, color: action === 'unfreeze' ? C.bg : '#fff', opacity: loading ? 0.7 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          {loading ? <><Icon name="Loader" size={14} style={{ animation: 'spin 1s linear infinite' }} />Выполняем...</> : btn}
        </button>
      </div>
    </div>
  );
}

// ─── Tab: Dashboard ───────────────────────────────────────────────────────────
function TabDashboard({ stats, loading }: { stats: Stats | null; loading: boolean }) {
  const cards = [
    { label: 'На проверке',    value: stats?.pending        ?? '—', icon: 'Clock',       color: C.warn  },
    { label: 'Одобрено сегодня', value: stats?.approved_today ?? '—', icon: 'CheckCircle2', color: C.accent },
    { label: 'Отклонено',      value: stats?.rejected_today ?? '—', icon: 'XCircle',     color: C.danger },
    { label: 'Высокий риск',   value: stats?.high_risk      ?? '—', icon: 'ShieldAlert', color: '#FF6B35' },
    { label: 'Заморожено',     value: stats?.frozen         ?? '—', icon: 'Lock',        color: C.info  },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Карточки */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
        {cards.map(c => (
          <div key={c.label} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '18px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: `${c.color}18`, display: 'grid', placeItems: 'center' }}>
                <Icon name={c.icon} size={16} style={{ color: c.color }} />
              </div>
              <span style={{ fontSize: 12, color: C.dim }}>{c.label}</span>
            </div>
            {loading
              ? <div style={{ height: 32, background: 'rgba(255,255,255,0.05)', borderRadius: 6, animation: 'pulse 1.5s infinite' }} />
              : <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 30, fontWeight: 700, color: c.color }}>
                  {c.value}
                </div>}
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* График риск-скоров */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: '20px 24px' }}>
          <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 15, fontWeight: 600, marginBottom: 4 }}>
            Средний риск-скор по дням
          </div>
          <div style={{ fontSize: 12, color: C.dim, marginBottom: 16 }}>Последние 14 дней</div>
          {loading
            ? <div style={{ height: 80, background: 'rgba(255,255,255,0.04)', borderRadius: 8 }} />
            : <RiskSparkline data={stats?.risk_by_day ?? []} />}
        </div>

        {/* Топ-5 подозрительных */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: '20px 24px' }}>
          <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 15, fontWeight: 600, marginBottom: 16 }}>
            Топ-5 подозрительных адресов
          </div>
          {loading
            ? [1,2,3].map(i => <div key={i} style={{ height: 36, background: 'rgba(255,255,255,0.04)', borderRadius: 8, marginBottom: 8 }} />)
            : (stats?.top_suspicious?.length ?? 0) === 0
            ? <div style={{ color: C.dim, fontSize: 13 }}>Нет данных</div>
            : stats!.top_suspicious.map((a, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: i < (stats!.top_suspicious.length - 1) ? `1px solid ${C.border}` : 'none' }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: `${riskColor(a.score)}15`, border: `1px solid ${riskColor(a.score)}44`, display: 'grid', placeItems: 'center', fontSize: 10, fontWeight: 700, color: riskColor(a.score), flexShrink: 0 }}>
                  {a.score}
                </div>
                <div style={{ flex: 1, fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: C.dim, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {a.address}
                </div>
                <span style={{ fontSize: 11, color: C.dim }}>{a.count}×</span>
              </div>
            ))
          }
        </div>
      </div>
    </div>
  );
}

// ─── Модалка "Заморозить + Отклонить" ────────────────────────────────────────
function FreezeRejectModal({ item, onClose, onDone, apiFetch }: {
  item: QueueItem; onClose: () => void; onDone: () => void;
  apiFetch: (url: string, opts?: RequestInit) => Promise<Response>;
}) {
  const [reason,     setReason]     = useState('');
  const [rejectAll,  setRejectAll]  = useState(false);
  const [confirmed,  setConfirmed]  = useState(false);
  const [loading,    setLoading]    = useState(false);
  const [err,        setErr]        = useState('');
  const [result,     setResult]     = useState<{ rejected_count: number; user_email: string } | null>(null);

  const canSubmit = reason.trim().length >= 5 && confirmed;

  const submit = async () => {
    if (!canSubmit) return;
    setLoading(true); setErr('');
    try {
      const res = await apiFetch(COMPLIANCE_API, {
        method: 'POST',
        body: JSON.stringify({
          resource:   'freeze_and_reject',
          order_id:   item.id,
          user_id:    item.user_id,
          reason:     reason.trim(),
          reject_all: rejectAll,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setResult(data);
      setTimeout(() => { onClose(); onDone(); }, 2200);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Ошибка сети');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center',
      justifyContent: 'center', padding: 24,
      background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(16px)',
    }} onClick={e => e.target === e.currentTarget && !loading && onClose()}>
      <div style={{ width: '100%', maxWidth: 520, background: '#14041A', border: `1px solid ${C.danger}44`, borderRadius: 20, overflow: 'hidden', boxShadow: `0 0 60px ${C.danger}22` }}>

        {/* Шапка — красная полоса */}
        <div style={{ background: `linear-gradient(135deg, ${C.danger}22, rgba(255,68,68,0.05))`, padding: '22px 28px', borderBottom: `1px solid ${C.danger}33`, display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: `${C.danger}20`, border: `1px solid ${C.danger}55`, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
            <Icon name="ShieldOff" size={22} style={{ color: C.danger }} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 17, fontWeight: 700, color: C.danger }}>
              Инцидент: Заморозить и Отклонить
            </div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>
              Атомарная операция — аккаунт заморожен + платёж отклонён
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', padding: 4 }}>
            <Icon name="X" size={18} />
          </button>
        </div>

        <div style={{ padding: '22px 28px', display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Цель */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: '12px 14px' }}>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginBottom: 4, letterSpacing: '0.1em' }}>КОМПАНИЯ</div>
              <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.user_company || '—'}</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.user_email}</div>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: '12px 14px' }}>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginBottom: 4, letterSpacing: '0.1em' }}>ПЛАТЁЖ</div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{fmtMoney(item.amount)} {item.from_currency}</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>→ {item.to_currency} {item.destination_country ? `· ${item.destination_country}` : ''}</div>
            </div>
          </div>

          {/* Адрес + риск */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '12px 14px', borderRadius: 10, background: `${riskColor(item.risk_score)}0a`, border: `1px solid ${riskColor(item.risk_score)}33` }}>
            <div style={{ width: 42, height: 42, borderRadius: '50%', flexShrink: 0, background: `${riskColor(item.risk_score)}18`, border: `2px solid ${riskColor(item.risk_score)}`, display: 'grid', placeItems: 'center', fontFamily: 'JetBrains Mono, monospace', fontSize: 14, fontWeight: 700, color: riskColor(item.risk_score) }}>
              {item.risk_score}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'rgba(255,255,255,0.5)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {item.destination_address}
              </div>
              <div style={{ fontSize: 11, color: riskColor(item.risk_score), marginTop: 2 }}>
                {item.risk_level === 'high' ? 'Высокий риск' : 'Средний риск'} · {item.risk_score}/100
              </div>
            </div>
          </div>

          {/* Что будет сделано */}
          <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.1em', marginBottom: 2 }}>БУДЕТ ВЫПОЛНЕНО</div>
            {[
              { icon: 'Lock',      color: C.danger, text: `Аккаунт ${item.user_company || item.user_email} будет заморожен` },
              { icon: 'XCircle',   color: C.danger, text: `Платёж #${item.id.slice(0, 8)} будет отклонён` },
              { icon: 'FileText',  color: C.dim,    text: 'Запись в audit_log с полным контекстом инцидента' },
            ].map((a, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                <Icon name={a.icon} size={13} style={{ color: a.color, flexShrink: 0 }} />
                <span style={{ color: a.color === C.dim ? 'rgba(255,255,255,0.45)' : C.text }}>{a.text}</span>
              </div>
            ))}
          </div>

          {/* Опция: отклонить все */}
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', padding: '10px 14px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: `1px solid ${C.border}` }}>
            <input type="checkbox" checked={rejectAll} onChange={e => setRejectAll(e.target.checked)} style={{ marginTop: 2, accentColor: C.danger }} />
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', lineHeight: 1.5 }}>
              Также отклонить <strong style={{ color: C.text }}>все остальные</strong> платежи этого пользователя со статусом «на проверке»
            </span>
          </label>

          {/* Причина */}
          <div>
            <label style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', display: 'block', marginBottom: 6 }}>
              Причина (для audit_log и клиента) *
            </label>
            <textarea value={reason} onChange={e => setReason(e.target.value)} rows={3}
              placeholder="Например: подозрение на обход санкций, адрес связан с mixer-сервисом..."
              style={{ width: '100%', padding: '10px 14px', borderRadius: 10, fontSize: 13, background: 'rgba(255,255,255,0.05)', border: `1px solid ${reason.length >= 5 ? C.danger + '55' : C.border}`, color: C.text, resize: 'none', outline: 'none', fontFamily: "'Rubik', sans-serif", boxSizing: 'border-box' }} />
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 4 }}>{reason.length}/500 · минимум 5 символов</div>
          </div>

          {/* Подтверждение */}
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', padding: '12px 14px', borderRadius: 10, background: `${C.danger}08`, border: `1px solid ${C.danger}33` }}>
            <input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} style={{ marginTop: 2, accentColor: C.danger }} />
            <span style={{ fontSize: 12, color: '#ff9999', lineHeight: 1.5 }}>
              Подтверждаю принятие решения об инциденте. Действие будет записано в audit_log с моими данными и IP-адресом.
            </span>
          </label>

          {err && (
            <div style={{ padding: '10px 14px', borderRadius: 10, background: `${C.danger}0d`, border: `1px solid ${C.danger}33`, color: '#ff8888', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Icon name="AlertTriangle" size={14} style={{ flexShrink: 0 }} /> {err}
            </div>
          )}

          {/* Кнопка */}
          {!result ? (
            <button onClick={submit} disabled={!canSubmit || loading} style={{
              padding: '14px', borderRadius: 12, fontWeight: 700, fontSize: 15, border: 'none',
              cursor: (!canSubmit || loading) ? 'not-allowed' : 'pointer',
              background: canSubmit ? `linear-gradient(135deg, ${C.danger}, #cc2222)` : 'rgba(255,255,255,0.07)',
              color: canSubmit ? '#fff' : 'rgba(255,255,255,0.3)',
              boxShadow: canSubmit ? `0 4px 24px ${C.danger}44` : 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              transition: 'all 0.2s', opacity: loading ? 0.8 : 1,
            }}>
              {loading
                ? <><Icon name="Loader" size={16} style={{ animation: 'spin 1s linear infinite' }} /> Выполняем операцию...</>
                : <><Icon name="ShieldOff" size={17} /> Заморозить аккаунт и отклонить платёж</>}
            </button>
          ) : (
            <div style={{ textAlign: 'center', padding: '12px 0' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 10 }}>
                <Icon name="CheckCircle2" size={28} style={{ color: C.accent }} />
                <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 17, fontWeight: 700 }}>Инцидент закрыт</div>
              </div>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', lineHeight: 1.6 }}>
                Аккаунт <strong style={{ color: C.text }}>{result.user_email}</strong> заморожен.<br />
                Отклонено платежей: <strong style={{ color: C.danger }}>{result.rejected_count}</strong>.<br />
                Запись в audit_log создана.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Tab: Очередь проверки ────────────────────────────────────────────────────
function TabQueue({ apiFetch, statsRefresh }: { apiFetch: (url: string, opts?: RequestInit) => Promise<Response>; statsRefresh: () => void }) {
  const [items,    setItems]    = useState<QueueItem[]>([]);
  const [total,    setTotal]    = useState(0);
  const [loading,  setLoading]  = useState(false);
  const [err,      setErr]      = useState('');
  const [sortBy,   setSortBy]   = useState('risk_score');
  const [order,    setOrder]    = useState('desc');
  const [selected,  setSelected]  = useState<QueueItem | null>(null);
  const [freezing,  setFreezing]  = useState<QueueItem | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true); setErr('');
    try {
      const p = new URLSearchParams({ resource: 'queue', sort_by: sortBy, order, limit: '50' });
      const res = await apiFetch(`${COMPLIANCE_API}?${p}`);
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || `HTTP ${res.status}`);
      setItems(d.items); setTotal(d.total);
    } catch (e) { setErr(e instanceof Error ? e.message : 'Ошибка'); }
    finally { setLoading(false); }
  }, [apiFetch, sortBy, order]);

  useEffect(() => { fetch(); }, [fetch]);

  const cols = '120px 1fr 110px 100px 140px 80px 200px';

  return (
    <div>
      {selected && (
        <ApproveModal item={selected} onClose={() => setSelected(null)} onDone={() => { setSelected(null); fetch(); statsRefresh(); }} apiFetch={apiFetch} />
      )}
      {freezing && (
        <FreezeRejectModal item={freezing} onClose={() => setFreezing(null)} onDone={() => { setFreezing(null); fetch(); statsRefresh(); }} apiFetch={apiFetch} />
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 20, fontWeight: 700, marginBottom: 2 }}>Очередь AML-проверки</h2>
          <div style={{ fontSize: 13, color: C.dim }}>{loading ? 'Загрузка...' : `${total} платежей ожидают решения`}</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <select value={sortBy} onChange={e => setSortBy(e.target.value)} style={{ padding: '8px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.05)', border: `1px solid ${C.border}`, color: C.text, fontSize: 12, outline: 'none', cursor: 'pointer' }}>
            <option value="risk_score" style={{ background: C.card }}>По риск-скору</option>
            <option value="amount"     style={{ background: C.card }}>По сумме</option>
            <option value="created_at" style={{ background: C.card }}>По дате</option>
          </select>
          <button onClick={() => setOrder(o => o === 'desc' ? 'asc' : 'desc')} style={{ padding: '8px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.05)', border: `1px solid ${C.border}`, color: C.text, cursor: 'pointer' }}>
            {order === 'desc' ? '↓' : '↑'}
          </button>
          <button onClick={fetch} style={{ padding: '8px 14px', borderRadius: 8, background: `${C.accent}15`, border: `1px solid ${C.accent}33`, color: C.accent, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Icon name="RefreshCw" size={13} /> Обновить
          </button>
        </div>
      </div>

      {err && <div style={{ padding: '12px 16px', borderRadius: 10, background: `${C.danger}0d`, border: `1px solid ${C.danger}33`, color: '#ff8888', fontSize: 13, marginBottom: 16 }}>{err}</div>}

      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: cols, gap: 8, padding: '11px 20px', borderBottom: `1px solid ${C.border}`, fontSize: 11, color: C.dim, fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.08em' }}>
          <span>ДАТА</span><span>КОМПАНИЯ</span><span>СУММА</span><span>АДРЕС</span><span></span><span>РИСК</span><span>ДЕЙСТВИЯ</span>
        </div>

        {loading && !items.length ? (
          <div style={{ padding: 48, textAlign: 'center', color: C.dim }}>
            <div style={{ marginBottom: 10 }}><Icon name="Loader" size={22} style={{ animation: 'spin 1s linear infinite' }} /></div>
            Загрузка очереди...
          </div>
        ) : items.length === 0 ? (
          <div style={{ padding: 64, textAlign: 'center' }}>
            <Icon name="ShieldCheck" size={40} style={{ color: C.accent, opacity: 0.5, marginBottom: 12 }} />
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>Очередь пуста</div>
            <div style={{ fontSize: 13, color: C.dim }}>Нет платежей, ожидающих AML-решения</div>
          </div>
        ) : items.map((item, i) => (
          <div key={item.id} style={{ display: 'grid', gridTemplateColumns: cols, gap: 8, padding: '13px 20px', alignItems: 'center', borderBottom: i < items.length - 1 ? `1px solid ${C.border}` : 'none', transition: 'background 0.15s' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
            <span style={{ fontSize: 11, color: C.dim, fontFamily: 'JetBrains Mono, monospace' }}>{fmtDate(item.created_at)}</span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.user_company || '—'}</div>
              <div style={{ fontSize: 11, color: C.dim, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.user_email}</div>
            </div>
            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, fontWeight: 600 }}>{fmtMoney(item.amount)}</span>
            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: C.dim, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {item.destination_address.slice(0, 10)}…
            </span>
            <span style={{ fontSize: 12, color: C.dim }}>{item.from_currency} → {item.to_currency} {item.destination_country ? `· ${item.destination_country}` : ''}</span>
            <RiskBadge score={item.risk_score} />
            <div style={{ display: 'flex', gap: 5 }}>
              <button onClick={() => setSelected(item)} style={{ flex: 1, padding: '7px 0', borderRadius: 8, fontSize: 11, fontWeight: 700, border: 'none', background: `${C.accent}18`, color: C.accent, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                <Icon name="CheckCircle2" size={12} /> Решить
              </button>
              <button
                onClick={e => { e.stopPropagation(); setFreezing(item); }}
                title="Заморозить аккаунт и отклонить платёж"
                style={{
                  padding: '7px 9px', borderRadius: 8, fontSize: 11, fontWeight: 700,
                  border: `1px solid ${item.risk_score >= 60 ? C.danger + '66' : C.border}`,
                  background: item.risk_score >= 60 ? `${C.danger}18` : 'rgba(255,255,255,0.04)',
                  color: item.risk_score >= 60 ? C.danger : 'rgba(255,255,255,0.4)',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
                  flexShrink: 0, transition: 'all 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = `${C.danger}25`; e.currentTarget.style.color = C.danger; e.currentTarget.style.borderColor = `${C.danger}88`; }}
                onMouseLeave={e => { e.currentTarget.style.background = item.risk_score >= 60 ? `${C.danger}18` : 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = item.risk_score >= 60 ? C.danger : 'rgba(255,255,255,0.4)'; e.currentTarget.style.borderColor = item.risk_score >= 60 ? C.danger + '66' : C.border; }}>
                <Icon name="ShieldOff" size={12} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Tab: AML-скрининг ────────────────────────────────────────────────────────
function TabAml({ apiFetch }: { apiFetch: (url: string, opts?: RequestInit) => Promise<Response> }) {
  const [address, setAddress] = useState('');
  const [network, setNetwork] = useState('USDT');
  const [result,  setResult]  = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<{ address: string; score: number; ts: string }[]>([]);

  const check = async () => {
    if (!address.trim()) return;
    setLoading(true);
    try {
      const res  = await apiFetch(RISK_CHECK_URL, { method: 'POST', body: JSON.stringify({ address: address.trim(), network }) });
      const data = await res.json();
      setResult(data);
      setHistory(h => [{ address: address.trim(), score: data.risk_score ?? 0, ts: new Date().toLocaleTimeString('ru') }, ...h.slice(0, 9)]);
    } catch { setResult({ error: 'Ошибка соединения', risk_score: 0 }); }
    finally { setLoading(false); }
  };

  const score  = result ? Number(result.risk_score ?? 0) : 0;
  const rc     = riskColor(score);
  const catIcons: Record<string, string> = { exchange: 'ArrowLeftRight', mixer: 'Shuffle', darknet: 'EyeOff', sanctioned: 'Ban' };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 24 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div>
          <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 20, fontWeight: 700, marginBottom: 4 }}>AML-скрининг адресов</h2>
          <div style={{ fontSize: 13, color: C.dim }}>Проверьте любой крипто-адрес перед транзакцией</div>
        </div>

        {/* Поле ввода */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', gap: 10 }}>
            <input value={address} onChange={e => setAddress(e.target.value)} onKeyDown={e => e.key === 'Enter' && check()}
              placeholder="Введите адрес кошелька (0x..., T..., bc1...)"
              style={{ flex: 1, padding: '12px 16px', borderRadius: 10, fontSize: 14, background: 'rgba(255,255,255,0.05)', border: `1px solid ${C.border}`, color: C.text, outline: 'none', fontFamily: 'JetBrains Mono, monospace' }}
              onFocus={e => (e.target.style.borderColor = C.accent)}
              onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.07)')} />
            <select value={network} onChange={e => setNetwork(e.target.value)} style={{ padding: '12px 14px', borderRadius: 10, background: 'rgba(255,255,255,0.05)', border: `1px solid ${C.border}`, color: C.text, outline: 'none', cursor: 'pointer', fontSize: 13 }}>
              {['USDT','USDC','BTC','ETH','TON'].map(n => <option key={n} value={n} style={{ background: C.card }}>{n}</option>)}
            </select>
          </div>
          <button onClick={check} disabled={loading || !address.trim()} style={{ padding: '13px', borderRadius: 10, fontWeight: 700, fontSize: 14, border: 'none', cursor: !address.trim() ? 'not-allowed' : 'pointer', background: address.trim() ? C.accent : 'rgba(255,255,255,0.07)', color: address.trim() ? C.bg : C.dim, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            {loading ? <><Icon name="Loader" size={15} style={{ animation: 'spin 1s linear infinite' }} />Проверяем...</> : <><Icon name="ShieldSearch" size={16} />Проверить адрес</>}
          </button>
        </div>

        {/* Результат */}
        {result && !result.error && (
          <div style={{ background: C.card, border: `1px solid ${rc}33`, borderRadius: 16, padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Главный индикатор */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
              <div style={{ position: 'relative', width: 80, height: 80, flexShrink: 0 }}>
                <svg viewBox="0 0 80 80" style={{ transform: 'rotate(-90deg)' }}>
                  <circle cx="40" cy="40" r="32" fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="8" />
                  <circle cx="40" cy="40" r="32" fill="none" stroke={rc} strokeWidth="8"
                    strokeDasharray={`${(score / 100) * 201} 201`} strokeLinecap="round" />
                </svg>
                <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', fontFamily: 'JetBrains Mono, monospace', fontSize: 18, fontWeight: 700, color: rc }}>
                  {score}
                </div>
              </div>
              <div>
                <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 18, fontWeight: 700, color: rc, marginBottom: 4 }}>
                  {score >= 80 ? 'Критический риск' : score >= 60 ? 'Высокий риск' : score >= 30 ? 'Средний риск' : 'Низкий риск'}
                </div>
                <div style={{ fontSize: 13, color: C.dim }}>
                  {result.recommendation === 'REJECT' ? 'Рекомендация: ОТКЛОНИТЬ транзакцию'
                   : result.recommendation === 'MANUAL_REVIEW' ? 'Рекомендация: РУЧНАЯ ПРОВЕРКА'
                   : 'Рекомендация: ОДОБРИТЬ'}
                </div>
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: C.dim, marginTop: 4, wordBreak: 'break-all' }}>
                  {String(result.address)}
                </div>
              </div>
            </div>

            {/* Категории */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
              {Object.entries(catIcons).map(([cat, icon]) => {
                const active = Boolean(result[`is_${cat}`]);
                return (
                  <div key={cat} style={{ padding: '10px 12px', borderRadius: 10, textAlign: 'center', background: active ? `${C.danger}12` : 'rgba(255,255,255,0.03)', border: `1px solid ${active ? C.danger : C.border}33` }}>
                    <Icon name={icon} size={18} style={{ color: active ? C.danger : C.dim, marginBottom: 4 }} />
                    <div style={{ fontSize: 11, fontWeight: 600, color: active ? C.danger : C.dim, textTransform: 'capitalize' }}>{cat}</div>
                    <div style={{ fontSize: 10, color: active ? '#ff8888' : C.dim }}>{active ? 'Обнаружено' : 'Чисто'}</div>
                  </div>
                );
              })}
            </div>

            {/* Причины */}
            {Array.isArray(result.reasons) && (result.reasons as string[]).length > 0 && (
              <div>
                <div style={{ fontSize: 11, color: C.dim, fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.1em', marginBottom: 8 }}>ДЕТАЛИ ПРОВЕРКИ</div>
                {(result.reasons as string[]).map((r, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', fontSize: 13, borderBottom: i < (result.reasons as string[]).length - 1 ? `1px solid ${C.border}` : 'none' }}>
                    <Icon name="AlertCircle" size={13} style={{ color: score >= 50 ? C.danger : C.dim, flexShrink: 0 }} />
                    {r}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {result?.error && (
          <div style={{ padding: '14px 18px', borderRadius: 12, background: `${C.danger}0d`, border: `1px solid ${C.danger}33`, color: '#ff8888', fontSize: 13 }}>
            {String(result.error)}
          </div>
        )}
      </div>

      {/* История */}
      <div>
        <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 15, fontWeight: 600, marginBottom: 14 }}>История проверок</div>
        {history.length === 0
          ? <div style={{ color: C.dim, fontSize: 13 }}>Проверок ещё нет</div>
          : history.map((h, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 10, background: C.card, border: `1px solid ${C.border}`, marginBottom: 8, cursor: 'pointer' }}
              onClick={() => setAddress(h.address)}>
              <div style={{ width: 32, height: 32, borderRadius: '50%', background: `${riskColor(h.score)}15`, border: `1px solid ${riskColor(h.score)}44`, display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 700, color: riskColor(h.score), flexShrink: 0 }}>
                {h.score}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.address}</div>
                <div style={{ fontSize: 11, color: C.dim }}>{h.ts}</div>
              </div>
            </div>
          ))
        }
      </div>
    </div>
  );
}

// ─── Tab: Замороженные аккаунты ───────────────────────────────────────────────
function TabFrozen({ apiFetch }: { apiFetch: (url: string, opts?: RequestInit) => Promise<Response> }) {
  const [items,    setItems]    = useState<FrozenUser[]>([]);
  const [loading,  setLoading]  = useState(false);
  const [modal,    setModal]    = useState<{ user: FrozenUser; action: 'freeze' | 'unfreeze' | 'escalate' } | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch(`${COMPLIANCE_API}?resource=frozen`);
      const d = await res.json();
      if (res.ok) setItems(d.items || []);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [apiFetch]);

  useEffect(() => { fetch(); }, [fetch]);

  return (
    <div>
      {modal && (
        <FreezeModal user={modal.user} action={modal.action} onClose={() => setModal(null)} onDone={() => { setModal(null); fetch(); }} apiFetch={apiFetch} />
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 20, fontWeight: 700, marginBottom: 2 }}>Замороженные аккаунты</h2>
          <div style={{ fontSize: 13, color: C.dim }}>{loading ? 'Загрузка...' : `${items.length} аккаунтов заблокировано`}</div>
        </div>
        <button onClick={fetch} style={{ padding: '8px 14px', borderRadius: 8, background: `${C.accent}15`, border: `1px solid ${C.accent}33`, color: C.accent, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
          <Icon name="RefreshCw" size={13} /> Обновить
        </button>
      </div>

      {items.length === 0 && !loading ? (
        <div style={{ padding: 64, textAlign: 'center', background: C.card, border: `1px solid ${C.border}`, borderRadius: 16 }}>
          <Icon name="Unlock" size={40} style={{ color: C.accent, opacity: 0.4, marginBottom: 12 }} />
          <div style={{ fontSize: 16, fontWeight: 600 }}>Нет заморожённых аккаунтов</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {items.map(user => (
            <div key={user.id} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ width: 40, height: 40, borderRadius: '50%', background: `${C.danger}15`, border: `1px solid ${C.danger}33`, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                <Icon name="Lock" size={17} style={{ color: C.danger }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, marginBottom: 2 }}>{user.company_name || user.email}</div>
                <div style={{ fontSize: 12, color: C.dim, marginBottom: user.freeze_reason ? 4 : 0 }}>{user.email} {user.inn ? `· ИНН ${user.inn}` : ''}</div>
                {user.freeze_reason && (
                  <div style={{ fontSize: 12, color: '#ff8888' }}>Причина: {user.freeze_reason}</div>
                )}
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontSize: 11, color: C.dim, marginBottom: 8 }}>{fmtDate(user.frozen_at)}</div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => setModal({ user, action: 'unfreeze' })} style={{ padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, border: 'none', background: `${C.accent}18`, color: C.accent, cursor: 'pointer' }}>
                    Разморозить
                  </button>
                  <button onClick={() => setModal({ user, action: 'escalate' })} style={{ padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, border: `1px solid ${C.border}`, background: 'transparent', color: C.dim, cursor: 'pointer' }}>
                    Эскалировать
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Tab: Аудит-лог ───────────────────────────────────────────────────────────
function TabAudit({ apiFetch }: { apiFetch: (url: string, opts?: RequestInit) => Promise<Response> }) {
  const [items,      setItems]      = useState<AuditEntry[]>([]);
  const [total,      setTotal]      = useState(0);
  const [loading,    setLoading]    = useState(false);
  const [expanded,   setExpanded]   = useState<number | null>(null);
  const [filterAction, setFilterAction] = useState('');
  const [filterDate,   setFilterDate]   = useState('');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams({ resource: 'audit', limit: '50' });
      if (filterAction) p.set('action', filterAction);
      if (filterDate)   p.set('date_from', filterDate);
      const res = await apiFetch(`${COMPLIANCE_API}?${p}`);
      const d = await res.json();
      if (res.ok) { setItems(d.items); setTotal(d.total); }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [apiFetch, filterAction, filterDate]);

  useEffect(() => {
    fetch();
    intervalRef.current = setInterval(fetch, 15_000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [fetch]);

  const ACTION_COLOR: Record<string, string> = {
    'payment.approve': C.accent,
    'payment.reject':  C.danger,
    'account.freeze':  C.danger,
    'account.unfreeze': C.accent,
    'account.escalate': C.warn,
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 20, fontWeight: 700, marginBottom: 2 }}>Аудит-лог</h2>
          <div style={{ fontSize: 13, color: C.dim }}>{total} записей · обновляется каждые 15 сек</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input value={filterAction} onChange={e => setFilterAction(e.target.value)} placeholder="Фильтр по действию..."
            style={{ padding: '8px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.05)', border: `1px solid ${C.border}`, color: C.text, fontSize: 12, outline: 'none', fontFamily: "'Rubik', sans-serif" }} />
          <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.05)', border: `1px solid ${C.border}`, color: C.text, fontSize: 12, outline: 'none', colorScheme: 'dark' }} />
          <button onClick={fetch} style={{ padding: '8px 14px', borderRadius: 8, background: `${C.accent}15`, border: `1px solid ${C.accent}33`, color: C.accent, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Icon name="RefreshCw" size={13} /> Обновить
          </button>
        </div>
      </div>

      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, overflow: 'hidden' }}>
        {loading && !items.length ? (
          <div style={{ padding: 48, textAlign: 'center', color: C.dim }}>
            <div style={{ marginBottom: 10 }}><Icon name="Loader" size={20} style={{ animation: 'spin 1s linear infinite' }} /></div>
            Загрузка лога...
          </div>
        ) : items.length === 0 ? (
          <div style={{ padding: 64, textAlign: 'center', color: C.dim }}>
            <Icon name="FileText" size={36} style={{ opacity: 0.3, marginBottom: 12 }} />
            <div>Нет записей</div>
          </div>
        ) : items.map((entry, i) => {
          const ac = ACTION_COLOR[entry.action] || C.dim;
          const isExp = expanded === entry.id;
          return (
            <div key={entry.id} style={{ borderBottom: i < items.length - 1 ? `1px solid ${C.border}` : 'none' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr 180px 100px 36px', gap: 8, padding: '12px 20px', alignItems: 'center', cursor: 'pointer', transition: 'background 0.15s' }}
                onClick={() => setExpanded(isExp ? null : entry.id)}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                <span style={{ fontSize: 11, color: C.dim, fontFamily: 'JetBrains Mono, monospace' }}>{fmtDate(entry.created_at)}</span>
                <div>
                  <span style={{ fontSize: 12, fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: `${ac}15`, color: ac, fontFamily: 'JetBrains Mono, monospace' }}>
                    {entry.action}
                  </span>
                </div>
                <span style={{ fontSize: 12, color: C.dim, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {entry.user_email || '—'}
                </span>
                <span style={{ fontSize: 11, color: C.dim }}>{entry.ip_address || '—'}</span>
                <Icon name={isExp ? 'ChevronUp' : 'ChevronDown'} size={14} style={{ color: C.dim }} />
              </div>
              {isExp && (
                <div style={{ padding: '0 20px 16px', marginTop: -4 }}>
                  <pre style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: C.dim, background: 'rgba(0,0,0,0.2)', borderRadius: 8, padding: '12px 14px', overflow: 'auto', margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
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

// ─── Главный компонент ─────────────────────────────────────────────────────────
export default function ComplianceOfficer() {
  const { user, logout, hasRole } = useAuth();
  const navigate = useNavigate();
  const { apiFetch } = useApi();

  const [tab,          setTab]          = useState<Tab>('dashboard');
  const [stats,        setStats]        = useState<Stats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [queueCount,   setQueueCount]   = useState<number | null>(null);

  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const res = await apiFetch(`${COMPLIANCE_API}?resource=stats`);
      const d = await res.json();
      if (res.ok) { setStats(d); setQueueCount(d.pending); }
    } catch { /* ignore */ }
    finally { setStatsLoading(false); }
  }, [apiFetch]);

  useEffect(() => { loadStats(); }, [loadStats]);

  // Проверка роли — после всех хуков
  if (!hasRole('compliance', 'admin', 'superadmin')) {
    navigate('/login', { replace: true });
    return null;
  }

  const NAV: { id: Tab; label: string; icon: string; badge?: number | null }[] = [
    { id: 'dashboard', label: 'Дашборд',           icon: 'LayoutGrid' },
    { id: 'queue',     label: 'Очередь проверки',   icon: 'ShieldAlert', badge: queueCount },
    { id: 'aml',       label: 'AML-скрининг',       icon: 'Search' },
    { id: 'frozen',    label: 'Замороженные',        icon: 'Lock' },
    { id: 'audit',     label: 'Аудит-лог',           icon: 'FileText' },
  ];

  const TITLES: Record<Tab, string> = {
    dashboard: 'Дашборд',
    queue:     'Очередь AML-проверки',
    aml:       'AML-скрининг',
    frozen:    'Замороженные аккаунты',
    audit:     'Аудит-лог',
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: C.bg, color: C.text, fontFamily: "'Rubik', sans-serif" }}>

      {/* ── Sidebar ─────────────────────────────────────────────────────────── */}
      <aside style={{ width: 232, flexShrink: 0, background: C.sidebar, borderRight: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', position: 'sticky', top: 0, height: '100vh', overflow: 'hidden' }}>

        {/* Logo */}
        <div style={{ padding: '22px 18px 18px', borderBottom: `1px solid ${C.border}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <div style={{ width: 34, height: 34, borderRadius: 9, background: C.accent, display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 17, color: C.bg, fontFamily: "'Space Grotesk', sans-serif", flexShrink: 0 }}>M</div>
            <div>
              <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 16 }}>MOST</div>
              <div style={{ fontSize: 9, color: C.dim, letterSpacing: '0.15em', fontFamily: 'JetBrains Mono, monospace' }}>COMPLIANCE OFFICER</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '14px 10px', overflowY: 'auto' }}>
          {NAV.map(item => (
            <button key={item.id} onClick={() => setTab(item.id)} style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '10px 12px', borderRadius: 10, marginBottom: 4, background: tab === item.id ? `${C.accent}14` : 'transparent', border: `1px solid ${tab === item.id ? `${C.accent}33` : 'transparent'}`, color: tab === item.id ? C.accent : C.dim, fontSize: 13, fontWeight: tab === item.id ? 600 : 400, cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s', fontFamily: "'Rubik', sans-serif" }}
              onMouseEnter={e => { if (tab !== item.id) e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
              onMouseLeave={e => { if (tab !== item.id) e.currentTarget.style.background = 'transparent'; }}>
              <Icon name={item.icon} size={16} style={{ flexShrink: 0 }} />
              <span style={{ flex: 1 }}>{item.label}</span>
              {item.badge != null && item.badge > 0 && (
                <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 10, background: item.id === tab ? C.accent : C.danger, color: item.id === tab ? C.bg : '#fff', fontFamily: 'JetBrains Mono, monospace' }}>
                  {item.badge}
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* User */}
        <div style={{ padding: '12px 10px', borderTop: `1px solid ${C.border}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: 10, marginBottom: 6 }}>
            <div style={{ width: 30, height: 30, borderRadius: 7, background: `${C.accent}20`, display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 700, color: C.accent, flexShrink: 0 }}>
              {(user?.email?.[0] ?? 'C').toUpperCase()}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 11, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.email}</div>
              <div style={{ fontSize: 10, color: C.dim, fontFamily: 'JetBrains Mono, monospace' }}>{user?.role?.toUpperCase()}</div>
            </div>
          </div>
          <button onClick={() => { logout(); navigate('/login', { replace: true }); }}
            style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 12px', borderRadius: 9, background: 'transparent', border: 'none', color: C.dim, fontSize: 12, cursor: 'pointer', fontFamily: "'Rubik', sans-serif" }}
            onMouseEnter={e => (e.currentTarget.style.color = C.danger)}
            onMouseLeave={e => (e.currentTarget.style.color = C.dim)}>
            <Icon name="LogOut" size={14} /> Выход
          </button>
        </div>
      </aside>

      {/* ── Основной контент ─────────────────────────────────────────────────── */}
      <main style={{ flex: 1, minWidth: 0, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>

        {/* Header */}
        <div style={{ padding: '18px 32px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(7,7,26,0.8)', backdropFilter: 'blur(10px)', position: 'sticky', top: 0, zIndex: 10 }}>
          <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 19, fontWeight: 700, margin: 0 }}>
            {TITLES[tab]}
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: C.accent, fontFamily: 'JetBrains Mono, monospace' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: C.accent, boxShadow: `0 0 6px ${C.accent}`, animation: 'pulse 2s infinite' }} />
            COMPLIANCE PANEL ACTIVE
          </div>
        </div>

        <div style={{ padding: '28px 32px', flex: 1 }}>
          {tab === 'dashboard' && <TabDashboard stats={stats} loading={statsLoading} />}
          {tab === 'queue'     && <TabQueue apiFetch={apiFetch} statsRefresh={loadStats} />}
          {tab === 'aml'       && <TabAml   apiFetch={apiFetch} />}
          {tab === 'frozen'    && <TabFrozen apiFetch={apiFetch} />}
          {tab === 'audit'     && <TabAudit  apiFetch={apiFetch} />}
        </div>
      </main>

      <style>{`
        @keyframes spin  { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        input::placeholder { color: rgba(255,255,255,0.2); }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 2px; }
      `}</style>
    </div>
  );
}