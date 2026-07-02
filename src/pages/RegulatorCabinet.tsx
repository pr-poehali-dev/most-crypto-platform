import { useState, useEffect, useCallback, useRef } from 'react';
import Icon from '@/components/ui/icon';

const API = 'https://functions.poehali.dev/9d967023-b0c6-4778-a536-221013e6149c';

// ─── Палитра ──────────────────────────────────────────────────────────────────
const C = {
  bg:      '#06061A',
  sidebar: '#09091F',
  card:    '#0D0D26',
  border:  'rgba(255,255,255,0.07)',
  accent:  '#4D9FFF',
  gold:    '#FFD700',
  text:    '#FFFFFF',
  dim:     'rgba(255,255,255,0.45)',
  danger:  '#FF4444',
  warn:    '#FFAA00',
  green:   '#00FF88',
};

type Tab = 'overview' | 'participants' | 'transactions' | 'routes' | 'emergency' | 'reports';

// ─── Типы ─────────────────────────────────────────────────────────────────────
interface Overview {
  total_users: number; active_users: number; vol_24h: number;
  processing: number; aml_pending: number;
  top_countries: { country: string; count: number; volume: number }[];
  top_companies: { company_name: string; inn: string; tx_count: number; total_vol: number; avg_risk: number }[];
  volume_by_day: { date: string; volume: number; count: number }[];
}
interface Participant {
  id: string; email: string; company_name: string; inn: string;
  status: string; kyc_status: string; tx_count: number;
  total_vol: number; avg_risk: number; countries: string[]; created_at: string;
}
interface Transaction {
  id: string; from_currency: string; to_currency: string; amount: number;
  destination_country: string; destination_address: string;
  status: string; risk_score: number; company_name: string;
  inn: string; hops: number; created_at: string;
}
interface Agent {
  id: string; agent_name: string; network: string;
  from_address: string; to_address: string; amount: number;
  status: string; tx_hash: string | null; created_at: string;
}
interface EmergencyEntry {
  id: number; action: string; details: Record<string, unknown>;
  ip_address: string | null; created_at: string;
}

// ─── Хелперы ──────────────────────────────────────────────────────────────────
function fmtDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
}
function fmtMoney(n: number, short = false) {
  if (short) return n >= 1e9 ? `$${(n/1e9).toFixed(1)}B` : n >= 1e6 ? `$${(n/1e6).toFixed(1)}M` : n >= 1e3 ? `$${(n/1e3).toFixed(0)}K` : `$${n.toFixed(0)}`;
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}
function riskColor(s: number) { return s >= 60 ? C.danger : s >= 30 ? C.warn : C.green; }

function StatusDot({ status }: { status: string }) {
  const map: Record<string, string> = { active: C.green, suspended: C.danger, blocked: C.danger, processing: C.accent, aml_pending: C.warn, rejected: C.danger };
  return <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: map[status] || C.dim, marginRight: 6, flexShrink: 0 }} />;
}

// ─── Мини-Sparkline ───────────────────────────────────────────────────────────
function VolumeSparkline({ data }: { data: Overview['volume_by_day'] }) {
  if (!data.length) return <div style={{ color: C.dim, fontSize: 13, padding: '20px 0' }}>Нет данных</div>;
  const W = 440, H = 70;
  const maxV = Math.max(...data.map(d => d.volume), 1);
  const pts = data.map((d, i) => {
    const x = (i / Math.max(data.length - 1, 1)) * W;
    const y = H - (d.volume / maxV) * H * 0.9 - 2;
    return `${x},${y}`;
  });
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H + 4}`} style={{ overflow: 'visible' }}>
      <defs>
        <linearGradient id="vg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={C.accent} stopOpacity="0.25" />
          <stop offset="100%" stopColor={C.accent} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,${H} ${pts.join(' ')} ${W},${H}`} fill="url(#vg)" />
      <polyline points={pts.join(' ')} fill="none" stroke={C.accent} strokeWidth="2" strokeLinejoin="round" />
      {data.map((d, i) => {
        const x = (i / Math.max(data.length - 1, 1)) * W;
        const y = H - (d.volume / maxV) * H * 0.9 - 2;
        return <circle key={i} cx={x} cy={y} r={2.5} fill={C.accent} />;
      })}
    </svg>
  );
}

// ─── Gate: вход по API-ключу ──────────────────────────────────────────────────
function ApiKeyGate({ onAuth }: { onAuth: (key: string) => void }) {
  const [key, setKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!key.trim()) return;
    setLoading(true); setErr('');
    try {
      const res = await fetch(`${API}?resource=overview`, { headers: { 'X-API-Key': key.trim() } });
      if (res.status === 401) { setErr('Неверный API-ключ'); return; }
      if (!res.ok) { setErr(`Ошибка сервера: ${res.status}`); return; }
      onAuth(key.trim());
    } catch { setErr('Ошибка соединения'); }
    finally { setLoading(false); }
  };

  return (
    <div style={{ background: C.bg, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Rubik', sans-serif" }}>
      <div style={{ width: '100%', maxWidth: 420, padding: 28 }}>
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{ width: 52, height: 52, borderRadius: 13, background: C.gold + '22', border: `2px solid ${C.gold}44`, display: 'grid', placeItems: 'center', margin: '0 auto 16px' }}>
            <Icon name="Landmark" size={24} style={{ color: C.gold }} />
          </div>
          <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 22, fontWeight: 700, marginBottom: 6 }}>MOST — Кабинет регулятора</h1>
          <p style={{ fontSize: 13, color: C.dim }}>Доступ только по API-ключу</p>
        </div>
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ position: 'relative' }}>
            <Icon name="Key" size={15} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: C.dim }} />
            <input value={key} onChange={e => setKey(e.target.value)} placeholder="Введите API-ключ регулятора" type="password"
              style={{ width: '100%', padding: '13px 14px 13px 40px', borderRadius: 11, fontSize: 14, background: 'rgba(255,255,255,0.05)', border: `1px solid ${err ? C.danger : C.border}`, color: C.text, outline: 'none', fontFamily: 'JetBrains Mono, monospace', boxSizing: 'border-box' }} />
          </div>
          {err && <div style={{ fontSize: 13, color: '#ff8888', display: 'flex', alignItems: 'center', gap: 6 }}><Icon name="AlertCircle" size={13} />{err}</div>}
          <button type="submit" disabled={loading || !key.trim()} style={{ padding: '13px', borderRadius: 11, background: key.trim() ? C.gold : 'rgba(255,255,255,0.07)', color: key.trim() ? '#0A0A1A' : C.dim, fontWeight: 700, fontSize: 15, border: 'none', cursor: key.trim() ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            {loading ? <><Icon name="Loader" size={15} style={{ animation: 'spin 1s linear infinite' }} /> Проверяем...</> : 'Войти в систему'}
          </button>
        </form>
        <p style={{ textAlign: 'center', fontSize: 11, color: 'rgba(255,255,255,0.2)', marginTop: 24, fontFamily: 'JetBrains Mono, monospace' }}>
          MOST Regulatory Access System · v2.0
        </p>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ─── Tab 1: Обзор рынка ───────────────────────────────────────────────────────
function TabOverview({ apiKey }: { apiKey: string }) {
  const [data, setData]     = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API}?resource=overview`, { headers: { 'X-API-Key': apiKey } })
      .then(r => r.json()).then(setData).finally(() => setLoading(false));
  }, [apiKey]);

  const cards = [
    { label: 'Всего участников', value: data?.total_users, icon: 'Users',       color: C.accent },
    { label: 'Активных',        value: data?.active_users, icon: 'UserCheck',   color: C.green  },
    { label: 'Объём за 24ч',    value: data ? fmtMoney(data.vol_24h, true) : '—', icon: 'TrendingUp', color: C.gold },
    { label: 'В обработке',     value: data?.processing,   icon: 'Zap',         color: C.accent },
    { label: 'AML-очередь',     value: data?.aml_pending,  icon: 'ShieldAlert', color: C.warn   },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Карточки */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
        {cards.map(c => (
          <div key={c.label} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '18px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <div style={{ width: 30, height: 30, borderRadius: 8, background: `${c.color}18`, display: 'grid', placeItems: 'center' }}>
                <Icon name={c.icon} size={15} style={{ color: c.color }} />
              </div>
              <span style={{ fontSize: 11, color: C.dim }}>{c.label}</span>
            </div>
            {loading
              ? <div style={{ height: 28, background: 'rgba(255,255,255,0.05)', borderRadius: 6 }} />
              : <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 28, fontWeight: 700, color: c.color }}>{c.value ?? '—'}</div>}
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 20 }}>
        {/* График объёма */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: '20px 24px' }}>
          <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Объём платежей</div>
          <div style={{ fontSize: 12, color: C.dim, marginBottom: 16 }}>Последние 14 дней</div>
          {loading ? <div style={{ height: 70, background: 'rgba(255,255,255,0.04)', borderRadius: 8 }} /> : <VolumeSparkline data={data?.volume_by_day ?? []} />}
        </div>

        {/* Топ стран */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: '20px 24px' }}>
          <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 15, fontWeight: 600, marginBottom: 16 }}>Топ стран-получателей</div>
          {loading ? [1,2,3,4,5].map(i => <div key={i} style={{ height: 24, background: 'rgba(255,255,255,0.04)', borderRadius: 5, marginBottom: 8 }} />) :
            (data?.top_countries.slice(0, 5) ?? []).map((c, i) => (
              <div key={c.country} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderBottom: i < 4 ? `1px solid ${C.border}` : 'none' }}>
                <span style={{ fontSize: 14 }}>
                  {{'CN':'🇨🇳','AE':'🇦🇪','TR':'🇹🇷','DE':'🇩🇪','US':'🇺🇸','RU':'🇷🇺','GB':'🇬🇧','KZ':'🇰🇿','UA':'🇺🇦','BY':'🇧🇾'}[c.country] || '🌐'}
                </span>
                <span style={{ flex: 1, fontSize: 13 }}>{c.country}</span>
                <span style={{ fontSize: 12, color: C.accent, fontFamily: 'JetBrains Mono, monospace' }}>{fmtMoney(c.volume, true)}</span>
                <span style={{ fontSize: 11, color: C.dim }}>{c.count} тр.</span>
              </div>
            ))}
        </div>
      </div>

      {/* Топ компаний */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: '20px 24px' }}>
        <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 15, fontWeight: 600, marginBottom: 16 }}>Топ-5 компаний по объёму (30 дней)</div>
        {loading ? <div style={{ height: 120, background: 'rgba(255,255,255,0.04)', borderRadius: 8 }} /> : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px 90px 90px 80px', gap: 8, fontSize: 11, color: C.dim, fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.07em', marginBottom: 10 }}>
            <span>КОМПАНИЯ</span><span>ИНН</span><span>ОБЪЁМ</span><span>ТРАНЗАКЦИЙ</span><span>СР. РИСК</span>
          </div>
        )}
        {!loading && (data?.top_companies ?? []).map((c, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 100px 90px 90px 80px', gap: 8, padding: '10px 0', borderBottom: i < 4 ? `1px solid ${C.border}` : 'none', alignItems: 'center' }}>
            <div style={{ fontWeight: 600, fontSize: 13 }}>{c.company_name || '—'}</div>
            <span style={{ fontSize: 11, color: C.dim, fontFamily: 'JetBrains Mono, monospace' }}>{c.inn || '—'}</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: C.gold, fontFamily: 'JetBrains Mono, monospace' }}>{fmtMoney(c.total_vol, true)}</span>
            <span style={{ fontSize: 12, color: C.dim }}>{c.tx_count}</span>
            <span style={{ fontSize: 12, color: riskColor(c.avg_risk), fontWeight: 600 }}>{c.avg_risk}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Tab 2: Реестр участников ─────────────────────────────────────────────────
function TabParticipants({ apiKey }: { apiKey: string }) {
  const [items, setItems]   = useState<Participant[]>([]);
  const [total, setTotal]   = useState(0);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [detail, setDetail] = useState<Record<string, unknown> | null>(null);
  const [suspending, setSuspending] = useState<Participant | null>(null);
  const [suspendReason, setSuspendReason] = useState('');
  const [suspendLoading, setSuspendLoading] = useState(false);

  const load = useCallback(async (q = search) => {
    setLoading(true);
    const p = new URLSearchParams({ resource: 'participants', limit: '50', search: q });
    const res = await fetch(`${API}?${p}`, { headers: { 'X-API-Key': apiKey } });
    const d = await res.json();
    setItems(d.items || []); setTotal(d.total || 0);
    setLoading(false);
  }, [apiKey, search]);

  useEffect(() => { load(); }, [apiKey]);

  const openDetail = async (id: string) => {
    const res = await fetch(`${API}?resource=participant&user_id=${id}`, { headers: { 'X-API-Key': apiKey } });
    const d = await res.json();
    setDetail(d);
  };

  const doSuspend = async () => {
    if (!suspending || !suspendReason.trim()) return;
    setSuspendLoading(true);
    await fetch(API, { method: 'POST', headers: { 'X-API-Key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ resource: 'suspend_participant', user_id: suspending.id, reason: suspendReason }) });
    setSuspendLoading(false); setSuspending(null); setSuspendReason(''); load();
  };

  const KYC_COLOR: Record<string, string> = { approved: C.green, pending_review: C.warn, rejected: C.danger };

  return (
    <div>
      {/* Модалка деталей */}
      {detail && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', overflowY: 'auto', padding: '32px 16px' }}
          onClick={e => e.target === e.currentTarget && setDetail(null)}>
          <div style={{ width: '100%', maxWidth: 680, background: C.card, border: `1px solid ${C.border}`, borderRadius: 20, overflow: 'hidden' }}>
            <div style={{ padding: '20px 28px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 11, color: C.dim, fontFamily: 'JetBrains Mono, monospace', marginBottom: 4 }}>УЧАСТНИК · {String((detail.user as Record<string,unknown>)?.id ?? '').slice(0,8).toUpperCase()}</div>
                <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 18, fontWeight: 700 }}>{String((detail.user as Record<string,unknown>)?.company_name ?? '—')}</div>
              </div>
              <button onClick={() => setDetail(null)} style={{ background: 'none', border: 'none', color: C.dim, cursor: 'pointer' }}><Icon name="X" size={20} /></button>
            </div>
            <div style={{ padding: '20px 28px', display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Последние платежи */}
              <div>
                <div style={{ fontSize: 11, color: C.dim, fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.1em', marginBottom: 10 }}>ПОСЛЕДНИЕ ПЛАТЕЖИ</div>
                {((detail.payments as unknown[]) ?? []).slice(0, 5).map((p: unknown, i: number) => {
                  const pay = p as Record<string, unknown>;
                  return (
                    <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '8px 0', borderBottom: i < 4 ? `1px solid ${C.border}` : 'none', fontSize: 12 }}>
                      <span style={{ color: C.dim, fontFamily: 'JetBrains Mono, monospace' }}>{fmtDate(String(pay.created_at ?? ''))}</span>
                      <span style={{ fontWeight: 600 }}>{fmtMoney(Number(pay.amount ?? 0))} {String(pay.from_currency ?? '')}</span>
                      <span style={{ color: C.dim }}>→ {String(pay.to_currency ?? '')}</span>
                      <span style={{ fontFamily: 'JetBrains Mono, monospace', color: C.dim, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{String(pay.destination_address ?? '').slice(0, 18)}…</span>
                      <span style={{ color: riskColor(Number(pay.risk_score ?? 0)), fontWeight: 700 }}>{Number(pay.risk_score ?? 0)}</span>
                    </div>
                  );
                })}
              </div>
              {/* Контрагенты */}
              <div>
                <div style={{ fontSize: 11, color: C.dim, fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.1em', marginBottom: 10 }}>ГРАФ КОНТРАГЕНТОВ ({((detail.counterparties as unknown[]) ?? []).length} адресов)</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {((detail.counterparties as unknown[]) ?? []).slice(0, 12).map((cp: unknown, i: number) => {
                    const c = cp as Record<string, unknown>;
                    return (
                      <div key={i} style={{ padding: '6px 12px', borderRadius: 20, fontSize: 11, background: `${riskColor(Number(c.risk_score ?? 0))}15`, border: `1px solid ${riskColor(Number(c.risk_score ?? 0))}33`, color: riskColor(Number(c.risk_score ?? 0)), fontFamily: 'JetBrains Mono, monospace' }}>
                        {String(c.address ?? '').slice(0, 12)}… {c.country ? `· ${c.country}` : ''}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Модалка приостановки */}
      {suspending && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
          onClick={e => e.target === e.currentTarget && setSuspending(null)}>
          <div style={{ width: '100%', maxWidth: 440, background: C.card, border: `1px solid ${C.danger}44`, borderRadius: 18, padding: '28px 32px', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 17, fontWeight: 700 }}>Приостановить участника</div>
            <div style={{ padding: '12px 14px', borderRadius: 10, background: 'rgba(255,255,255,0.04)', fontSize: 13 }}>
              <div style={{ fontWeight: 600 }}>{suspending.company_name}</div>
              <div style={{ color: C.dim, fontSize: 12 }}>{suspending.email}</div>
            </div>
            <textarea value={suspendReason} onChange={e => setSuspendReason(e.target.value)} rows={3} placeholder="Причина приостановки..."
              style={{ padding: '10px 14px', borderRadius: 10, fontSize: 13, background: 'rgba(255,255,255,0.05)', border: `1px solid ${C.border}`, color: C.text, resize: 'none', outline: 'none', fontFamily: "'Rubik', sans-serif" }} />
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setSuspending(null)} style={{ flex: 1, padding: '11px', borderRadius: 9, background: 'transparent', border: `1px solid ${C.border}`, color: C.dim, fontSize: 13, cursor: 'pointer' }}>Отмена</button>
              <button onClick={doSuspend} disabled={!suspendReason.trim() || suspendLoading} style={{ flex: 2, padding: '11px', borderRadius: 9, background: C.danger, color: '#fff', fontWeight: 700, fontSize: 14, border: 'none', cursor: 'pointer', opacity: suspendLoading ? 0.7 : 1 }}>
                {suspendLoading ? 'Выполняем...' : 'Приостановить'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Поиск */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 20, fontWeight: 700, margin: 0 }}>Реестр участников</h2>
        <div style={{ fontSize: 12, color: C.dim, marginLeft: 4 }}>{total} компаний</div>
        <div style={{ flex: 1 }} />
        <div style={{ position: 'relative' }}>
          <Icon name="Search" size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: C.dim }} />
          <input value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && load(search)}
            placeholder="Название, ИНН, email..."
            style={{ padding: '9px 14px 9px 34px', borderRadius: 9, background: 'rgba(255,255,255,0.05)', border: `1px solid ${C.border}`, color: C.text, fontSize: 13, outline: 'none', fontFamily: "'Rubik', sans-serif", width: 240 }} />
        </div>
        <button onClick={() => load(search)} style={{ padding: '9px 14px', borderRadius: 9, background: `${C.accent}18`, border: `1px solid ${C.accent}33`, color: C.accent, fontSize: 12, cursor: 'pointer' }}>Найти</button>
      </div>

      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px 80px 90px 90px 70px 160px', gap: 8, padding: '11px 20px', borderBottom: `1px solid ${C.border}`, fontSize: 11, color: C.dim, fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.07em' }}>
          <span>КОМПАНИЯ</span><span>ИНН</span><span>СТАТУС</span><span>KYC</span><span>ОБЪЁМ</span><span>РИСК</span><span>ДЕЙСТВИЯ</span>
        </div>
        {loading ? <div style={{ padding: 48, textAlign: 'center', color: C.dim }}><Icon name="Loader" size={22} style={{ animation: 'spin 1s linear infinite' }} /></div>
          : items.length === 0 ? <div style={{ padding: 48, textAlign: 'center', color: C.dim }}>Нет участников</div>
          : items.map((p, i) => (
            <div key={p.id} style={{ display: 'grid', gridTemplateColumns: '1fr 100px 80px 90px 90px 70px 160px', gap: 8, padding: '12px 20px', alignItems: 'center', borderBottom: i < items.length - 1 ? `1px solid ${C.border}` : 'none', transition: 'background 0.15s' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.company_name || '—'}</div>
                <div style={{ fontSize: 11, color: C.dim }}>{p.email}</div>
              </div>
              <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: C.dim }}>{p.inn || '—'}</span>
              <div style={{ display: 'flex', alignItems: 'center' }}><StatusDot status={p.status} /><span style={{ fontSize: 11 }}>{p.status}</span></div>
              <span style={{ fontSize: 11, color: KYC_COLOR[p.kyc_status] || C.dim, fontWeight: 600 }}>{p.kyc_status || '—'}</span>
              <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: C.gold }}>{fmtMoney(p.total_vol, true)}</span>
              <span style={{ fontSize: 12, color: riskColor(p.avg_risk), fontWeight: 700 }}>{p.avg_risk}</span>
              <div style={{ display: 'flex', gap: 5 }}>
                <button onClick={() => openDetail(p.id)} style={{ flex: 1, padding: '6px 0', borderRadius: 7, fontSize: 11, fontWeight: 600, border: `1px solid ${C.border}`, background: 'transparent', color: C.text, cursor: 'pointer' }}>Детали</button>
                <button onClick={() => { setSuspending(p); setSuspendReason(''); }} style={{ padding: '6px 10px', borderRadius: 7, fontSize: 11, border: 'none', background: `${C.danger}18`, color: C.danger, cursor: 'pointer' }}>
                  <Icon name="PauseCircle" size={13} />
                </button>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}

// ─── Tab 3: Мониторинг транзакций ─────────────────────────────────────────────
function TabTransactions({ apiKey }: { apiKey: string }) {
  const [items, setItems]    = useState<Transaction[]>([]);
  const [total, setTotal]    = useState(0);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [route, setRoute]    = useState<{ order: Record<string,unknown>; agents: Agent[] } | null>(null);
  const [filters, setFilters] = useState({ company: '', country: '', risk_min: '', amount_min: '', status: '' });
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const p = new URLSearchParams({ resource: 'transactions', limit: '50' });
    Object.entries(filters).forEach(([k, v]) => { if (v) p.set(k, v); });
    const res = await fetch(`${API}?${p}`, { headers: { 'X-API-Key': apiKey } });
    const d = await res.json();
    setItems(d.items || []); setTotal(d.total || 0); setLoading(false);
  }, [apiKey, filters]);

  useEffect(() => {
    load();
    timerRef.current = setInterval(load, 20_000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [load]);

  const loadRoute = async (orderId: string) => {
    if (expanded === orderId) { setExpanded(null); setRoute(null); return; }
    setExpanded(orderId);
    const res = await fetch(`${API}?resource=routes&order_id=${orderId}`, { headers: { 'X-API-Key': apiKey } });
    const d = await res.json();
    setRoute(d);
  };

  const STATUS_COLOR: Record<string, string> = { processing: C.accent, aml_pending: C.warn, completed: C.green, rejected: C.danger };
  const NET_COLOR: Record<string, string> = { ETH: '#627EEA', BTC: '#F7931A', USDT: '#26A17B', TON: '#0088CC', TRX: '#E50915', BNB: '#F3BA2F' };

  return (
    <div>
      {/* Фильтры */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 20, fontWeight: 700, margin: 0, marginRight: 8 }}>Транзакции</h2>
        <span style={{ fontSize: 11, color: C.dim }}>{total} записей</span>
        <div style={{ flex: 1, minWidth: 20 }} />
        {[
          { key: 'company', placeholder: 'Компания' },
          { key: 'country', placeholder: 'Страна' },
          { key: 'risk_min', placeholder: 'Риск ≥' },
          { key: 'amount_min', placeholder: 'Сумма ≥' },
        ].map(f => (
          <input key={f.key} value={(filters as Record<string,string>)[f.key]} onChange={e => setFilters(prev => ({...prev, [f.key]: e.target.value}))}
            placeholder={f.placeholder}
            style={{ padding: '8px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.05)', border: `1px solid ${C.border}`, color: C.text, fontSize: 12, outline: 'none', fontFamily: "'Rubik', sans-serif", width: 100 }} />
        ))}
        <button onClick={load} style={{ padding: '8px 14px', borderRadius: 8, background: `${C.accent}18`, border: `1px solid ${C.accent}33`, color: C.accent, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
          <Icon name="Filter" size={12} /> Применить
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: C.green }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: C.green, display: 'inline-block', animation: 'pulse 2s infinite' }} />
          LIVE · 20s
        </div>
      </div>

      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr 110px 130px 60px 70px 90px', gap: 8, padding: '11px 20px', borderBottom: `1px solid ${C.border}`, fontSize: 11, color: C.dim, fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.07em' }}>
          <span>ВРЕМЯ</span><span>КОМПАНИЯ</span><span>СУММА</span><span>АДРЕС</span><span>ХОПОВ</span><span>РИСК</span><span>СТАТУС</span>
        </div>

        {loading && !items.length ? (
          <div style={{ padding: 48, textAlign: 'center', color: C.dim }}><Icon name="Loader" size={22} style={{ animation: 'spin 1s linear infinite' }} /></div>
        ) : items.map((tx, i) => (
          <div key={tx.id} style={{ borderBottom: i < items.length - 1 ? `1px solid ${C.border}` : 'none' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr 110px 130px 60px 70px 90px', gap: 8, padding: '12px 20px', alignItems: 'center', cursor: 'pointer', transition: 'background 0.15s' }}
              onClick={() => loadRoute(tx.id)}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
              <span style={{ fontSize: 11, color: C.dim, fontFamily: 'JetBrains Mono, monospace' }}>{fmtDate(tx.created_at)}</span>
              <div>
                <div style={{ fontWeight: 600, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tx.company_name || '—'}</div>
                <div style={{ fontSize: 10, color: C.dim }}>{tx.inn}</div>
              </div>
              <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, fontWeight: 600 }}>{fmtMoney(tx.amount, true)} {tx.from_currency}</span>
              <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: C.dim, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tx.destination_address.slice(0, 14)}…</span>
              <span style={{ fontSize: 12, textAlign: 'center', color: tx.hops > 0 ? C.accent : C.dim }}>{tx.hops || '—'}</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: riskColor(tx.risk_score) }}>{tx.risk_score}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <StatusDot status={tx.status} />
                <span style={{ fontSize: 10, color: STATUS_COLOR[tx.status] || C.dim }}>{tx.status}</span>
              </div>
            </div>

            {/* Раскрытый граф маршрута */}
            {expanded === tx.id && route && (
              <div style={{ padding: '0 20px 18px', marginTop: -4 }}>
                <div style={{ fontSize: 11, color: C.dim, fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.1em', marginBottom: 10 }}>
                  МАРШРУТ РОЯ · {route.agents.length} АГЕНТОВ
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 0, overflowX: 'auto', paddingBottom: 4 }}>
                  {/* Источник */}
                  <div style={{ flexShrink: 0, padding: '8px 14px', borderRadius: 10, background: `${C.accent}15`, border: `1px solid ${C.accent}33`, fontSize: 12 }}>
                    <div style={{ fontSize: 10, color: C.dim, marginBottom: 2 }}>ОТПРАВИТЕЛЬ</div>
                    <div style={{ fontWeight: 600 }}>{String(route.order.company_name ?? '—')}</div>
                    <div style={{ fontSize: 10, color: C.dim }}>{String(route.order.from_currency ?? '')} → {String(route.order.to_currency ?? '')}</div>
                  </div>
                  {route.agents.map((agent, ai) => (
                    <div key={agent.id} style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                      <div style={{ padding: '0 8px', color: C.dim, fontSize: 16 }}>→</div>
                      <div style={{ padding: '8px 12px', borderRadius: 10, background: `${NET_COLOR[agent.network] || C.accent}15`, border: `1px solid ${NET_COLOR[agent.network] || C.accent}33`, fontSize: 11, minWidth: 110 }}>
                        <div style={{ fontSize: 10, color: NET_COLOR[agent.network] || C.accent, marginBottom: 2, fontWeight: 600 }}>АГЕНТ {ai + 1} · {agent.network}</div>
                        <div style={{ color: C.dim, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{agent.from_address.slice(0, 10)}…</div>
                        <div style={{ fontSize: 10, color: agent.status === 'completed' ? C.green : agent.status === 'running' ? C.accent : C.dim, marginTop: 2 }}>{agent.status}</div>
                        {agent.tx_hash && <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.2)', marginTop: 1 }}>{agent.tx_hash.slice(0, 8)}…</div>}
                      </div>
                    </div>
                  ))}
                  {route.agents.length > 0 && (
                    <>
                      <div style={{ padding: '0 8px', color: C.dim, fontSize: 16 }}>→</div>
                      <div style={{ flexShrink: 0, padding: '8px 14px', borderRadius: 10, background: `${C.green}15`, border: `1px solid ${C.green}33`, fontSize: 12 }}>
                        <div style={{ fontSize: 10, color: C.dim, marginBottom: 2 }}>ПОЛУЧАТЕЛЬ</div>
                        <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10 }}>{String(route.order.destination_address ?? '').slice(0, 16)}…</div>
                        {route.order.destination_country && <div style={{ fontSize: 10, color: C.dim }}>{String(route.order.destination_country)}</div>}
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Tab 5: Красная кнопка ────────────────────────────────────────────────────
function TabEmergency({ apiKey }: { apiKey: string }) {
  const [reason, setReason]   = useState('');
  const [code2fa, setCode2fa] = useState('');
  const [step, setStep]       = useState<'idle' | 'confirm' | 'done' | 'resumed'>('idle');
  const [result, setResult]   = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr]         = useState('');
  const [log, setLog]         = useState<EmergencyEntry[]>([]);
  const [platformStopped, setPlatformStopped] = useState(false);

  useEffect(() => {
    fetch(`${API}?resource=emergency_log`, { headers: { 'X-API-Key': apiKey } })
      .then(r => r.json()).then(d => setLog(d.items || []));
  }, [apiKey, result]);

  const doStop = async () => {
    if (code2fa !== '2222') { setErr('Неверный код подтверждения'); return; }
    setLoading(true); setErr('');
    const res = await fetch(API, { method: 'POST', headers: { 'X-API-Key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ resource: 'emergency_stop', reason, confirm: true }) });
    const d = await res.json();
    if (!res.ok) { setErr(d.error || 'Ошибка'); setLoading(false); return; }
    setResult(d); setPlatformStopped(true); setStep('done'); setLoading(false);
  };

  const doResume = async () => {
    setLoading(true);
    const res = await fetch(API, { method: 'POST', headers: { 'X-API-Key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ resource: 'resume_platform', reason: 'Плановое возобновление работы регулятором' }) });
    const d = await res.json();
    setResult(d); setPlatformStopped(false); setStep('resumed'); setLoading(false);
  };

  const ACTION_COLOR: Record<string, string> = {
    'regulator.emergency_stop': C.danger,
    'regulator.resume_platform': C.green,
    'regulator.suspend_participant': C.warn,
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 24 }}>
      {/* Левая часть — кнопка */}
      <div>
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 18, padding: '32px 36px', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24 }}>
            <div style={{ width: 50, height: 50, borderRadius: 12, background: `${C.danger}18`, border: `2px solid ${C.danger}44`, display: 'grid', placeItems: 'center' }}>
              <Icon name="Siren" size={24} style={{ color: C.danger }} />
            </div>
            <div>
              <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 18, fontWeight: 700 }}>Экстренная остановка</div>
              <div style={{ fontSize: 13, color: C.dim }}>Заморозка всех активных роёв платежей</div>
            </div>
          </div>

          {step === 'idle' && (
            <>
              <div style={{ padding: '14px 16px', borderRadius: 12, background: `${C.warn}08`, border: `1px solid ${C.warn}25`, marginBottom: 20, fontSize: 13, color: 'rgba(255,255,255,0.65)', lineHeight: 1.6 }}>
                Это действие <strong style={{ color: C.warn }}>немедленно заморозит</strong> все активные swarm-маршруты и агентов. Платежи в очереди будут приостановлены. Действие записывается в audit_log с IP-адресом.
              </div>
              <button onClick={() => setStep('confirm')} style={{ width: '100%', padding: '16px', borderRadius: 12, background: `linear-gradient(135deg, ${C.danger}, #aa1111)`, color: '#fff', fontWeight: 700, fontSize: 16, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, boxShadow: `0 4px 32px ${C.danger}44` }}>
                <Icon name="OctagonX" size={20} /> Инициировать экстренную остановку
              </button>
            </>
          )}

          {step === 'confirm' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ fontSize: 12, color: C.dim, display: 'block', marginBottom: 6 }}>Официальная причина *</label>
                <textarea value={reason} onChange={e => setReason(e.target.value)} rows={3}
                  placeholder="Например: Обнаружена попытка обхода санкций OFAC, исх. №..."
                  style={{ width: '100%', padding: '10px 14px', borderRadius: 10, fontSize: 13, background: 'rgba(255,255,255,0.05)', border: `1px solid ${C.border}`, color: C.text, resize: 'none', outline: 'none', fontFamily: "'Rubik', sans-serif", boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: 12, color: C.dim, display: 'block', marginBottom: 6 }}>Код подтверждения (2FA) *</label>
                <input value={code2fa} onChange={e => setCode2fa(e.target.value)} placeholder="Введите код из приложения"
                  style={{ width: '100%', padding: '11px 14px', borderRadius: 10, fontSize: 14, background: 'rgba(255,255,255,0.05)', border: `1px solid ${code2fa ? C.danger : C.border}`, color: C.text, outline: 'none', fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.2em', boxSizing: 'border-box' }} />
                <div style={{ fontSize: 11, color: C.dim, marginTop: 4 }}>Демо: введите 2222</div>
              </div>
              {err && <div style={{ fontSize: 13, color: '#ff8888' }}>{err}</div>}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <button onClick={() => { setStep('idle'); setErr(''); setCode2fa(''); }} style={{ padding: '12px', borderRadius: 10, background: 'transparent', border: `1px solid ${C.border}`, color: C.dim, fontSize: 13, cursor: 'pointer' }}>Отмена</button>
                <button onClick={doStop} disabled={!reason.trim() || !code2fa || loading} style={{ padding: '12px', borderRadius: 10, background: C.danger, color: '#fff', fontWeight: 700, fontSize: 14, border: 'none', cursor: 'pointer', opacity: loading ? 0.7 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  {loading ? <><Icon name="Loader" size={14} style={{ animation: 'spin 1s linear infinite' }} />Выполняем</> : <><Icon name="OctagonX" size={15} />Подтвердить</>}
                </button>
              </div>
            </div>
          )}

          {(step === 'done' || step === 'resumed') && result && (
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <Icon name={step === 'done' ? 'OctagonX' : 'Play'} size={42} style={{ color: step === 'done' ? C.danger : C.green, marginBottom: 12 }} />
              <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
                {step === 'done' ? 'Платформа остановлена' : 'Платформа возобновлена'}
              </div>
              {step === 'done' && <div style={{ fontSize: 14, color: C.dim }}>Заморожено роёв: <strong style={{ color: C.danger }}>{String(result.frozen_routes ?? 0)}</strong></div>}
              {step === 'resumed' && <div style={{ fontSize: 14, color: C.dim }}>Возобновлено роёв: <strong style={{ color: C.green }}>{String(result.resumed_routes ?? 0)}</strong></div>}
            </div>
          )}
        </div>

        {/* Кнопка возобновить */}
        {platformStopped && step === 'done' && (
          <button onClick={doResume} disabled={loading} style={{ width: '100%', padding: '14px', borderRadius: 12, background: `${C.green}18`, border: `2px solid ${C.green}44`, color: C.green, fontWeight: 700, fontSize: 15, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
            <Icon name="Play" size={18} /> Возобновить работу платформы
          </button>
        )}
      </div>

      {/* Правая часть — лог */}
      <div>
        <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 15, fontWeight: 600, marginBottom: 14 }}>Лог экстренных действий</div>
        {log.length === 0 ? <div style={{ color: C.dim, fontSize: 13, padding: '20px 0' }}>Действий не зафиксировано</div> :
          log.map((e, i) => (
            <div key={e.id} style={{ padding: '12px 14px', borderRadius: 10, background: C.card, border: `1px solid ${C.border}`, marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 5, background: `${ACTION_COLOR[e.action] || C.dim}18`, color: ACTION_COLOR[e.action] || C.dim, fontFamily: 'JetBrains Mono, monospace' }}>
                  {e.action.replace('regulator.', '')}
                </span>
                <span style={{ fontSize: 11, color: C.dim, marginLeft: 'auto' }}>{fmtDate(e.created_at)}</span>
              </div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>
                {String((e.details as Record<string, unknown>)?.reason ?? '')}
              </div>
              {e.ip_address && <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)', marginTop: 4, fontFamily: 'JetBrains Mono, monospace' }}>IP: {e.ip_address}</div>}
            </div>
          ))}
      </div>
    </div>
  );
}

// ─── Tab 6: Отчёты ────────────────────────────────────────────────────────────
function TabReports({ apiKey }: { apiKey: string }) {
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo,   setDateTo]   = useState('');
  const [data, setData]         = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading]   = useState(false);

  const generate = async () => {
    setLoading(true);
    const p = new URLSearchParams({ resource: 'report' });
    if (dateFrom) p.set('date_from', dateFrom);
    if (dateTo)   p.set('date_to', dateTo);
    const res = await fetch(`${API}?${p}`, { headers: { 'X-API-Key': apiKey } });
    const d = await res.json();
    setData(d); setLoading(false);
  };

  const exportCSV = () => {
    if (!data) return;
    const s = data.summary as Record<string, unknown>;
    const bc = (data.by_country as { country: string; count: number; volume: number }[]) || [];
    const bco = (data.by_company as { company_name: string; inn: string; count: number; volume: number }[]) || [];

    let csv = `MOST Regulator Report\nПериод:,${(data.period as Record<string,string>)?.from || 'last 30 days'},${(data.period as Record<string,string>)?.to || 'now'}\n\n`;
    csv += `СВОДКА\nТранзакций,${s?.tx_count}\nОбъём,$${s?.total_vol}\nОтправителей,${s?.unique_senders}\nСр. риск,${s?.avg_risk}\n\n`;
    csv += `ТОП СТРАН\nСтрана,Транзакций,Объём\n`;
    bc.forEach(r => { csv += `${r.country},${r.count},$${r.volume}\n`; });
    csv += `\nТОП КОМПАНИЙ\nКомпания,ИНН,Транзакций,Объём\n`;
    bco.forEach(r => { csv += `"${r.company_name}",${r.inn},${r.count},$${r.volume}\n`; });

    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `most_report_${dateFrom || 'all'}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const s = data?.summary as Record<string, unknown> | undefined;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
        <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 20, fontWeight: 700, margin: 0 }}>Генерация отчёта</h2>
        <div style={{ flex: 1 }} />
        <label style={{ fontSize: 12, color: C.dim }}>С</label>
        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
          style={{ padding: '9px 12px', borderRadius: 9, background: 'rgba(255,255,255,0.05)', border: `1px solid ${C.border}`, color: C.text, fontSize: 13, outline: 'none', colorScheme: 'dark' }} />
        <label style={{ fontSize: 12, color: C.dim }}>по</label>
        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
          style={{ padding: '9px 12px', borderRadius: 9, background: 'rgba(255,255,255,0.05)', border: `1px solid ${C.border}`, color: C.text, fontSize: 13, outline: 'none', colorScheme: 'dark' }} />
        <button onClick={generate} disabled={loading} style={{ padding: '9px 20px', borderRadius: 9, background: C.accent, color: '#0A0A1A', fontWeight: 700, fontSize: 13, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
          {loading ? <><Icon name="Loader" size={13} style={{ animation: 'spin 1s linear infinite' }} />Генерируем</> : <><Icon name="BarChart3" size={13} />Сформировать</>}
        </button>
        {data && <button onClick={exportCSV} style={{ padding: '9px 18px', borderRadius: 9, background: `${C.green}18`, border: `1px solid ${C.green}33`, color: C.green, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
          <Icon name="Download" size={13} /> CSV
        </button>}
      </div>

      {!data && !loading && (
        <div style={{ padding: 64, textAlign: 'center', color: C.dim, background: C.card, border: `1px solid ${C.border}`, borderRadius: 16 }}>
          <Icon name="BarChart3" size={40} style={{ opacity: 0.3, marginBottom: 12 }} />
          <div>Выберите период и нажмите «Сформировать»</div>
          <div style={{ fontSize: 12, marginTop: 4 }}>По умолчанию — последние 30 дней</div>
        </div>
      )}

      {data && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Сводка */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            {[
              { label: 'Транзакций', value: String(s?.tx_count ?? 0), color: C.accent },
              { label: 'Общий объём', value: fmtMoney(Number(s?.total_vol ?? 0), true), color: C.gold },
              { label: 'Уникальных отправителей', value: String(s?.unique_senders ?? 0), color: C.green },
              { label: 'Средний риск', value: String(s?.avg_risk ?? 0), color: riskColor(Number(s?.avg_risk ?? 0)) },
            ].map(c => (
              <div key={c.label} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '18px 20px', textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: C.dim, marginBottom: 8 }}>{c.label}</div>
                <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 26, fontWeight: 700, color: c.color }}>{c.value}</div>
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            {/* По странам */}
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: '20px 24px' }}>
              <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 14, fontWeight: 600, marginBottom: 14 }}>Объём по странам</div>
              {((data.by_country as { country: string; count: number; volume: number }[]) || []).map((c, i) => (
                <div key={c.country} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '7px 0', borderBottom: i < 9 ? `1px solid ${C.border}` : 'none', fontSize: 13 }}>
                  <span style={{ width: 24, fontSize: 12, color: C.dim }}>{i + 1}.</span>
                  <span style={{ flex: 1 }}>{c.country}</span>
                  <span style={{ color: C.gold, fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }}>{fmtMoney(c.volume, true)}</span>
                  <span style={{ color: C.dim, fontSize: 11 }}>{c.count} тр.</span>
                </div>
              ))}
            </div>

            {/* По компаниям */}
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: '20px 24px' }}>
              <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 14, fontWeight: 600, marginBottom: 14 }}>Топ компаний</div>
              {((data.by_company as { company_name: string; inn: string; count: number; volume: number }[]) || []).map((c, i) => (
                <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '7px 0', borderBottom: i < 9 ? `1px solid ${C.border}` : 'none', fontSize: 12 }}>
                  <span style={{ width: 20, color: C.dim }}>{i + 1}.</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600 }}>{c.company_name}</div>
                    <div style={{ fontSize: 10, color: C.dim, fontFamily: 'JetBrains Mono, monospace' }}>{c.inn}</div>
                  </div>
                  <span style={{ color: C.gold, fontFamily: 'JetBrains Mono, monospace' }}>{fmtMoney(c.volume, true)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Подозрительные */}
          {((data.suspicious as unknown[]) || []).length > 0 && (
            <div style={{ background: C.card, border: `1px solid ${C.danger}33`, borderRadius: 16, padding: '20px 24px' }}>
              <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 14, fontWeight: 600, marginBottom: 4, color: C.danger }}>
                Подозрительные транзакции (риск ≥ 70)
              </div>
              <div style={{ fontSize: 12, color: C.dim, marginBottom: 14 }}>{((data.suspicious as unknown[]) || []).length} транзакций</div>
              <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr 90px 80px 70px', gap: 8, fontSize: 10, color: C.dim, fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.07em', marginBottom: 8 }}>
                <span>ДАТА</span><span>АДРЕС</span><span>СУММА</span><span>СТРАНА</span><span>РИСК</span>
              </div>
              {((data.suspicious as Record<string, unknown>[]) || []).map((t, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '100px 1fr 90px 80px 70px', gap: 8, padding: '8px 0', borderBottom: i < ((data.suspicious as unknown[]) || []).length - 1 ? `1px solid ${C.border}` : 'none', fontSize: 12, alignItems: 'center' }}>
                  <span style={{ fontSize: 10, color: C.dim }}>{fmtDate(String(t.created_at ?? ''))}</span>
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: C.dim, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{String(t.destination_address ?? '').slice(0, 20)}…</span>
                  <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>{fmtMoney(Number(t.amount ?? 0), true)}</span>
                  <span>{String(t.destination_country ?? '—')}</span>
                  <span style={{ color: riskColor(Number(t.risk_score ?? 0)), fontWeight: 700 }}>{Number(t.risk_score ?? 0)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Главный компонент ─────────────────────────────────────────────────────────
export default function RegulatorCabinet() {
  const [apiKey, setApiKey] = useState(() => sessionStorage.getItem('reg_api_key') || '');
  const [tab, setTab]       = useState<Tab>('overview');

  const handleAuth = (key: string) => {
    sessionStorage.setItem('reg_api_key', key);
    setApiKey(key);
  };

  if (!apiKey) return <ApiKeyGate onAuth={handleAuth} />;

  const NAV: { id: Tab; label: string; icon: string; danger?: boolean }[] = [
    { id: 'overview',      label: 'Обзор рынка',     icon: 'LayoutGrid' },
    { id: 'participants',  label: 'Реестр участников', icon: 'Users' },
    { id: 'transactions',  label: 'Транзакции',        icon: 'Activity' },
    { id: 'routes',        label: 'Графы маршрутов',   icon: 'GitBranch' },
    { id: 'emergency',     label: 'Красная кнопка',    icon: 'OctagonX', danger: true },
    { id: 'reports',       label: 'Отчёты',            icon: 'BarChart3' },
  ];

  const TITLES: Record<Tab, string> = {
    overview: 'Обзор рынка', participants: 'Реестр участников',
    transactions: 'Мониторинг транзакций', routes: 'Графы маршрутов',
    emergency: 'Экстренное управление', reports: 'Отчёты',
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: C.bg, color: C.text, fontFamily: "'Rubik', sans-serif" }}>
      {/* Sidebar */}
      <aside style={{ width: 228, flexShrink: 0, background: C.sidebar, borderRight: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', position: 'sticky', top: 0, height: '100vh' }}>
        <div style={{ padding: '22px 18px 18px', borderBottom: `1px solid ${C.border}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: C.gold + '22', border: `1px solid ${C.gold}44`, display: 'grid', placeItems: 'center' }}>
              <Icon name="Landmark" size={18} style={{ color: C.gold }} />
            </div>
            <div>
              <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 16 }}>MOST</div>
              <div style={{ fontSize: 9, color: C.dim, letterSpacing: '0.12em', fontFamily: 'JetBrains Mono, monospace' }}>REGULATORY ACCESS</div>
            </div>
          </div>
        </div>

        <nav style={{ flex: 1, padding: '14px 10px' }}>
          {NAV.map(item => (
            <button key={item.id} onClick={() => setTab(item.id)} style={{
              display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '10px 12px', borderRadius: 10, marginBottom: 4,
              background: tab === item.id ? (item.danger ? `${C.danger}18` : `${C.accent}14`) : 'transparent',
              border: `1px solid ${tab === item.id ? (item.danger ? `${C.danger}44` : `${C.accent}33`) : 'transparent'}`,
              color: tab === item.id ? (item.danger ? C.danger : C.accent) : (item.danger ? `${C.danger}99` : C.dim),
              fontSize: 13, fontWeight: tab === item.id ? 600 : 400, cursor: 'pointer', textAlign: 'left',
              transition: 'all 0.15s', fontFamily: "'Rubik', sans-serif",
            }}>
              <Icon name={item.icon} size={15} style={{ flexShrink: 0 }} />
              {item.label}
            </button>
          ))}
        </nav>

        <div style={{ padding: '12px 10px', borderTop: `1px solid ${C.border}` }}>
          <button onClick={() => { sessionStorage.removeItem('reg_api_key'); setApiKey(''); }}
            style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 12px', borderRadius: 9, background: 'transparent', border: 'none', color: C.dim, fontSize: 12, cursor: 'pointer', fontFamily: "'Rubik', sans-serif" }}
            onMouseEnter={e => (e.currentTarget.style.color = C.danger)}
            onMouseLeave={e => (e.currentTarget.style.color = C.dim)}>
            <Icon name="LogOut" size={14} /> Завершить сессию
          </button>
        </div>
      </aside>

      {/* Main */}
      <main style={{ flex: 1, minWidth: 0, overflow: 'auto' }}>
        <div style={{ padding: '18px 32px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(6,6,26,0.8)', backdropFilter: 'blur(10px)', position: 'sticky', top: 0, zIndex: 10 }}>
          <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 19, fontWeight: 700, margin: 0 }}>{TITLES[tab]}</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: C.gold, fontFamily: 'JetBrains Mono, monospace' }}>
              <Icon name="Landmark" size={12} />
              REGULATOR VIEW
            </div>
          </div>
        </div>

        <div style={{ padding: '28px 32px' }}>
          {tab === 'overview'     && <TabOverview      apiKey={apiKey} />}
          {tab === 'participants' && <TabParticipants   apiKey={apiKey} />}
          {tab === 'transactions' && <TabTransactions   apiKey={apiKey} />}
          {tab === 'routes'       && <TabTransactions   apiKey={apiKey} />}
          {tab === 'emergency'    && <TabEmergency      apiKey={apiKey} />}
          {tab === 'reports'      && <TabReports        apiKey={apiKey} />}
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
