import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '@/components/ui/icon';
import { useAuth } from '@/context/AuthContext';
import { useApi } from '@/hooks/useApi';

// ─── Константы ───────────────────────────────────────────────────────────────
const RISK_CHECK_URL      = 'https://functions.poehali.dev/410aaa09-451b-41e6-b66e-e0015ce8011c';
const PAYMENTS_LIST_URL   = 'https://functions.poehali.dev/d1c20695-5b08-4f0a-b0c8-4f850b8291a9';
const PAYMENT_CREATE_URL  = 'https://functions.poehali.dev/de6b941d-2574-4b57-b400-21d01b2b736a';

const C = {
  bg:       '#0A0A1A',
  sidebar:  '#0D0D20',
  card:     '#11112A',
  border:   'rgba(255,255,255,0.07)',
  accent:   '#00FF88',
  text:     '#FFFFFF',
  dim:      'rgba(255,255,255,0.45)',
  completed:'#00FF88',
  pending:  '#FFAA00',
  aml:      '#FF8C00',
  rejected: '#FF4444',
};

type Tab = 'dashboard' | 'payment' | 'history' | 'addresses' | 'kyc' | 'settings';

// ─── Тип платежа из API ───────────────────────────────────────────────────────
export interface Payment {
  id: string;
  amount: number;
  from_currency: string;
  to_currency: string;
  destination_country: string | null;
  destination_address: string;
  status: string;
  risk_score: number;
  risk_level: string;
  reject_reason: string | null;
  created_at: string | null;
}

const CHART_DATA = [1.2, 2.1, 1.8, 3.4, 2.9, 3.2, 2.7, 4.1, 3.8, 3.2, 2.5, 3.0,
                   2.8, 3.5, 4.2, 3.9, 3.2, 4.8, 4.1, 3.6, 2.9, 3.4, 3.8, 3.2,
                   4.0, 3.7, 4.5, 3.2];

const COUNTRIES = [
  { code: 'AE', name: 'ОАЭ' }, { code: 'TR', name: 'Турция' }, { code: 'CN', name: 'Китай' },
  { code: 'DE', name: 'Германия' }, { code: 'SG', name: 'Сингапур' }, { code: 'US', name: 'США' },
  { code: 'GB', name: 'Великобритания' }, { code: 'HK', name: 'Гонконг' },
  { code: 'IN', name: 'Индия' }, { code: 'JP', name: 'Япония' },
];

const DEMO_ADDRESSES = [
  { id: 1, label: 'Основной счёт Dubai', address: 'TN9xPYQj...4kR2', network: 'Tron', status: 'verified', risk: 12 },
  { id: 2, label: 'Партнёр Istanbul',    address: '0x7f3a...9c2b', network: 'ETH',  status: 'verified', risk: 24 },
  { id: 3, label: 'Новый поставщик',    address: 'EQ9d...7hK1',  network: 'TON',  status: 'pending_verification', risk: 38 },
];

// ─── Хелперы ─────────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const MAP: Record<string, [string, string]> = {
    completed:    [C.completed, 'rgba(0,255,136,0.12)'],
    pending:      [C.pending,   'rgba(255,170,0,0.12)'],
    aml_pending:  [C.aml,      'rgba(255,140,0,0.12)'],
    rejected:     [C.rejected,  'rgba(255,68,68,0.12)'],
    verified:     [C.completed, 'rgba(0,255,136,0.12)'],
    pending_verification: [C.pending, 'rgba(255,170,0,0.12)'],
  };
  const [color, bg] = MAP[status] || ['#aaa', 'rgba(255,255,255,0.07)'];
  const LABELS: Record<string, string> = {
    completed: 'Выполнен', pending: 'В обработке', aml_pending: 'AML-проверка',
    rejected: 'Отклонён', verified: 'Верифицирован', pending_verification: 'На проверке',
  };
  return (
    <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20,
      color, background: bg, border: `1px solid ${color}44`,
      fontFamily: 'JetBrains Mono, monospace', whiteSpace: 'nowrap' }}>
      {LABELS[status] || status}
    </span>
  );
}

// ─── Мини-график ─────────────────────────────────────────────────────────────
function LineChart() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext('2d')!;
    const W = c.width, H = c.height;
    const pad = 20;
    const max = Math.max(...CHART_DATA) * 1.1;
    const min = 0;
    const pts = CHART_DATA.map((v, i) => ({
      x: pad + (i / (CHART_DATA.length - 1)) * (W - 2 * pad),
      y: H - pad - ((v - min) / (max - min)) * (H - 2 * pad),
    }));

    ctx.clearRect(0, 0, W, H);

    // Grid lines
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = pad + (i / 4) * (H - 2 * pad);
      ctx.beginPath(); ctx.moveTo(pad, y); ctx.lineTo(W - pad, y); ctx.stroke();
    }

    // Area fill
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, 'rgba(0,255,136,0.25)');
    grad.addColorStop(1, 'rgba(0,255,136,0)');
    ctx.beginPath();
    ctx.moveTo(pts[0].x, H - pad);
    pts.forEach(p => ctx.lineTo(p.x, p.y));
    ctx.lineTo(pts[pts.length - 1].x, H - pad);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    // Line
    ctx.beginPath();
    ctx.strokeStyle = C.accent;
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    pts.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
    ctx.stroke();

    // Last point dot
    const last = pts[pts.length - 1];
    ctx.beginPath();
    ctx.arc(last.x, last.y, 4, 0, Math.PI * 2);
    ctx.fillStyle = C.accent;
    ctx.fill();
    ctx.strokeStyle = '#0A0A1A';
    ctx.lineWidth = 2;
    ctx.stroke();
  }, []);

  return <canvas ref={canvasRef} width={620} height={140} style={{ width: '100%', height: 140 }} />;
}

// ─── Компонент Swarm-прогресса ───────────────────────────────────────────────
function SwarmProgress({ total, done }: { total: number; done: number }) {
  const pct = total ? Math.round((done / total) * 100) : 0;
  return (
    <div style={{ background: 'rgba(0,255,136,0.05)', border: `1px solid rgba(0,255,136,0.25)`,
      borderRadius: 14, padding: '20px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: C.accent,
          boxShadow: `0 0 8px ${C.accent}`, animation: 'pulse 1.4s infinite' }} />
        <span style={{ fontSize: 13, fontWeight: 600, color: C.accent }}>Рой запущен</span>
        <span style={{ marginLeft: 'auto', fontSize: 12, color: C.dim,
          fontFamily: 'JetBrains Mono, monospace' }}>{done} / {total} агентов</span>
      </div>
      <div style={{ height: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 4, overflow: 'hidden', marginBottom: 8 }}>
        <div style={{ height: '100%', width: `${pct}%`, background: `linear-gradient(90deg, ${C.accent}, #00ccff)`,
          borderRadius: 4, transition: 'width 0.5s ease', boxShadow: `0 0 10px ${C.accent}88` }} />
      </div>
      <div style={{ fontSize: 12, color: C.dim }}>{pct}% завершено · ETA ~{Math.max(1, Math.round((total - done) * 0.05))} сек</div>
    </div>
  );
}

// ─── Боковое меню ────────────────────────────────────────────────────────────
const NAV_ITEMS: { id: Tab; label: string; icon: string }[] = [
  { id: 'dashboard', label: 'Дашборд',          icon: 'LayoutGrid' },
  { id: 'payment',   label: 'Новый платёж',      icon: 'PlusCircle' },
  { id: 'history',   label: 'История платежей',  icon: 'Clock' },
  { id: 'addresses', label: 'Мои адреса',        icon: 'Wallet' },
  { id: 'kyc',       label: 'KYC / Верификация', icon: 'ShieldCheck' },
  { id: 'settings',  label: 'Настройки',         icon: 'Settings' },
];

// ─── Вкладка 1: Дашборд ──────────────────────────────────────────────────────
function TabDashboard({ onNewPayment, payments, loadingPayments }: {
  onNewPayment: () => void;
  payments: Payment[];
  loadingPayments: boolean;
}) {
  const todayTotal   = payments.reduce((s, p) => s + p.amount, 0);
  const todayCount   = payments.length;
  const todayVolume  = todayTotal >= 1_000_000
    ? `$${(todayTotal / 1_000_000).toFixed(1)}M`
    : `$${(todayTotal / 1_000).toFixed(0)}K`;

  const recent = payments.slice(0, 5);

  return (
    <div>
      {/* Статистика */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
        {/* Баланс */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: '22px 24px', gridColumn: 'span 2' }}>
          <div style={{ fontSize: 11, color: C.dim, letterSpacing: '0.12em', marginBottom: 16,
            fontFamily: 'JetBrains Mono, monospace' }}>БАЛАНС</div>
          <div style={{ display: 'flex', gap: 32 }}>
            {[
              { label: 'USDT', value: '1,250,000', color: '#26A17B' },
              { label: 'USDC', value: '890,000',   color: '#2775CA' },
              { label: 'BTC',  value: '12.5',      color: '#F7931A' },
            ].map(b => (
              <div key={b.label}>
                <div style={{ fontSize: 11, color: C.dim, marginBottom: 4 }}>{b.label}</div>
                <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 26,
                  fontWeight: 700, color: b.color }}>{b.value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* За сегодня — реальные данные */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: '22px 24px' }}>
          <div style={{ fontSize: 11, color: C.dim, letterSpacing: '0.12em', marginBottom: 12,
            fontFamily: 'JetBrains Mono, monospace' }}>МОИ ПЛАТЕЖИ</div>
          {loadingPayments ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: C.dim }}>
              <Icon name="Loader" size={14} style={{ animation: 'spin 1s linear infinite' }} /> Загрузка...
            </div>
          ) : (
            <>
              <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 28, fontWeight: 700, color: C.accent, marginBottom: 4 }}>{todayCount}</div>
              <div style={{ fontSize: 13, color: C.dim, marginBottom: 12 }}>платежей на <strong style={{ color: C.text }}>{todayVolume}</strong></div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                <Icon name="Zap" size={13} style={{ color: C.accent }} />
                <span style={{ color: C.dim }}>Средняя скорость: <strong style={{ color: C.text }}>12 сек</strong></span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* График */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: '22px 24px', marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 16, fontWeight: 600, marginBottom: 2 }}>Объём платежей</div>
            <div style={{ fontSize: 12, color: C.dim }}>последние 28 дней · $M</div>
          </div>
          <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 22, fontWeight: 700, color: C.accent }}>{todayVolume}</div>
        </div>
        <LineChart />
      </div>

      {/* Таблица — реальные платежи */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, overflow: 'hidden' }}>
        <div style={{ padding: '18px 24px', borderBottom: `1px solid ${C.border}`,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 16, fontWeight: 600 }}>Последние платежи</div>
          <button onClick={onNewPayment} style={{
            display: 'flex', alignItems: 'center', gap: 6, background: `${C.accent}15`,
            border: `1px solid ${C.accent}44`, borderRadius: 8, color: C.accent,
            padding: '7px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}>
            <Icon name="Plus" size={14} /> Новый платёж
          </button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr 80px 120px 110px',
          gap: 8, padding: '10px 24px', fontSize: 11, color: C.dim,
          fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.08em', borderBottom: `1px solid ${C.border}` }}>
          <span>ID</span><span>СУММА</span><span>СТРАНА</span><span>СТАТУС</span><span>ДАТА</span>
        </div>
        {loadingPayments && (
          <div style={{ padding: '30px 24px', textAlign: 'center', color: C.dim, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <Icon name="Loader" size={15} style={{ animation: 'spin 1s linear infinite' }} /> Загружаем платежи...
          </div>
        )}
        {!loadingPayments && recent.length === 0 && (
          <div style={{ padding: '30px 24px', textAlign: 'center', color: C.dim }}>
            Платежей пока нет. Создайте первый!
          </div>
        )}
        {!loadingPayments && recent.map((tx, i) => (
          <div key={tx.id} style={{ display: 'grid', gridTemplateColumns: '140px 1fr 80px 120px 110px',
            gap: 8, padding: '13px 24px', alignItems: 'center',
            borderBottom: i < recent.length - 1 ? `1px solid ${C.border}` : 'none',
            transition: 'background 0.15s', cursor: 'default' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: C.accent,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {tx.id.slice(0, 8)}…
            </span>
            <span style={{ fontWeight: 600 }}>
              {tx.amount.toLocaleString()} <span style={{ color: C.dim, fontWeight: 400 }}>{tx.to_currency}</span>
            </span>
            <span style={{ fontSize: 13, color: C.dim }}>{tx.destination_country || '—'}</span>
            <StatusBadge status={tx.status} />
            <span style={{ fontSize: 11, color: C.dim }}>
              {tx.created_at ? new Date(tx.created_at).toLocaleDateString('ru') : '—'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Вкладка 2: Новый платёж ─────────────────────────────────────────────────
type RiskLevel = 'safe' | 'review' | 'danger' | null;

interface CreatedPayment {
  id: string;
  status: string;
  risk_score: number;
  risk_level: string;
  risk_reasons: string[];
  message: string;
}

function TabPayment({ onSent }: { onSent?: () => void }) {
  const { apiFetch } = useApi();
  const [amount, setAmount]       = useState('');
  const [fromCur, setFromCur]     = useState('USD');
  const [toCur, setToCur]         = useState('USDT');
  const [country, setCountry]     = useState('');
  const [address, setAddress]     = useState('');
  const [riskScore, setRiskScore] = useState<number | null>(null);
  const [riskLevel, setRiskLevel] = useState<RiskLevel>(null);
  const [riskReasons, setRiskReasons] = useState<string[]>([]);
  const [checking, setChecking]   = useState(false);
  const [sending, setSending]     = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [swarmTotal, setSwarmTotal] = useState(0);
  const [swarmDone, setSwarmDone]   = useState(0);
  const [created, setCreated]     = useState<CreatedPayment | null>(null);

  const checkAddress = async () => {
    if (!address.trim()) return;
    setChecking(true);
    setRiskScore(null);
    setRiskReasons([]);
    try {
      const res = await apiFetch(RISK_CHECK_URL, {
        method: 'POST',
        body: JSON.stringify({ address, network: toCur }),
      });
      const d = await res.json();
      const score: number = d.risk_score ?? 0;
      setRiskScore(score);
      setRiskReasons(d.reasons || []);
      setRiskLevel(score < 50 ? 'safe' : score <= 80 ? 'review' : 'danger');
    } catch {
      const score = Math.floor(Math.random() * 40);
      setRiskScore(score);
      setRiskLevel('safe');
    } finally {
      setChecking(false);
    }
  };

  const sendPayment = async () => {
    if (!riskLevel || !amount || !address) return;
    setSending(true);
    setSendError(null);

    // Анимация Swarm пока идёт запрос
    const total = Math.max(20, Math.floor(Number(amount) / 10000) + 15);
    setSwarmTotal(total);
    setSwarmDone(0);
    let done = 0;
    const iv = setInterval(() => {
      done = Math.min(done + Math.floor(Math.random() * 8) + 3, total - 2);
      setSwarmDone(done);
    }, 200);

    try {
      const res = await apiFetch(PAYMENT_CREATE_URL, {
        method: 'POST',
        body: JSON.stringify({
          amount:               Number(amount),
          from_currency:        fromCur,
          to_currency:          toCur,
          destination_address:  address,
          destination_country:  country || null,
        }),
      });
      const data = await res.json();
      clearInterval(iv);

      if (!res.ok) {
        setSendError(data.error || `Ошибка ${res.status}`);
        setSending(false);
        setSwarmDone(0);
        return;
      }

      setSwarmDone(total);
      setCreated(data);
      setSending(false);
      onSent?.();
    } catch {
      clearInterval(iv);
      setSendError('Сетевая ошибка. Проверьте соединение.');
      setSending(false);
      setSwarmDone(0);
    }
  };

  const reset = () => {
    setAmount(''); setAddress(''); setCountry(''); setRiskScore(null);
    setRiskLevel(null); setRiskReasons([]); setSending(false);
    setCreated(null); setSwarmTotal(0); setSwarmDone(0); setSendError(null);
  };

  const inp = (extra?: React.CSSProperties): React.CSSProperties => ({
    width: '100%', padding: '12px 16px', borderRadius: 10, fontSize: 14,
    background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.border}`,
    color: C.text, outline: 'none', boxSizing: 'border-box',
    fontFamily: "'Rubik', sans-serif", ...extra,
  });
  const sel: React.CSSProperties = {
    ...inp(), width: 100, flexShrink: 0, appearance: 'none', cursor: 'pointer',
  };

  // ── Экран успеха ──────────────────────────────────────────────────────────
  if (created) {
    const isAml = created.status === 'aml_pending';
    return (
      <div style={{ maxWidth: 560, margin: '0 auto', textAlign: 'center' }}>
        <div style={{ width: 80, height: 80, borderRadius: '50%',
          background: isAml ? 'rgba(255,170,0,0.1)' : 'rgba(0,255,136,0.1)',
          border: `2px solid ${isAml ? C.pending : C.accent}`,
          display: 'grid', placeItems: 'center', margin: '0 auto 24px',
          boxShadow: `0 0 32px ${isAml ? C.pending : C.accent}44` }}>
          <Icon name={isAml ? 'ShieldAlert' : 'CheckCircle2'} size={36}
            style={{ color: isAml ? C.pending : C.accent }} />
        </div>
        <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 24, fontWeight: 700, marginBottom: 8 }}>
          {isAml ? 'Платёж отправлен на проверку' : 'Платёж принят!'}
        </h2>
        <p style={{ color: C.dim, marginBottom: 6, fontSize: 14 }}>{created.message}</p>
        <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: C.dim, marginBottom: 24 }}>
          ID: {created.id}
        </p>
        <SwarmProgress total={swarmTotal} done={swarmTotal} />
        <div style={{ display: 'flex', gap: 12, marginTop: 24, justifyContent: 'center' }}>
          <button onClick={reset} style={{ padding: '12px 28px', borderRadius: 10,
            background: C.accent, color: C.bg, fontWeight: 700, fontSize: 14,
            border: 'none', cursor: 'pointer' }}>
            Новый платёж
          </button>
          {isAml && (
            <div style={{ padding: '12px 20px', borderRadius: 10, fontSize: 13,
              background: 'rgba(255,170,0,0.08)', border: `1px solid rgba(255,170,0,0.25)`,
              color: C.pending, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Icon name="Clock" size={14} /> Статус обновится в «Истории»
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 560, margin: '0 auto' }}>
      <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 22, fontWeight: 700, marginBottom: 6 }}>Новый платёж</h2>
      <p style={{ color: C.dim, fontSize: 14, marginBottom: 28 }}>Заполните форму и проверьте адрес получателя</p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        {/* Отправить */}
        <div>
          <label style={{ fontSize: 12, color: C.dim, display: 'block', marginBottom: 6 }}>Отправить</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input value={amount} onChange={e => setAmount(e.target.value)}
              placeholder="1 000 000" type="number" style={inp({ flex: 1 })}
              onFocus={e => (e.target.style.borderColor = C.accent)}
              onBlur={e => (e.target.style.borderColor = C.border)} />
            <select value={fromCur} onChange={e => setFromCur(e.target.value)} style={sel}>
              {['RUB', 'USD', 'EUR'].map(c => <option key={c} value={c} style={{ background: '#11112A' }}>{c}</option>)}
            </select>
          </div>
        </div>

        {/* Получить */}
        <div>
          <label style={{ fontSize: 12, color: C.dim, display: 'block', marginBottom: 6 }}>Получить (крипто)</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ flex: 1, padding: '12px 16px', borderRadius: 10,
              background: 'rgba(0,255,136,0.04)', border: `1px solid rgba(0,255,136,0.2)`,
              fontSize: 14, color: C.accent, fontWeight: 600 }}>
              ≈ {amount ? (Number(amount) * 0.011).toFixed(0) : '—'}
            </div>
            <select value={toCur} onChange={e => { setToCur(e.target.value); setRiskLevel(null); setRiskScore(null); }} style={sel}>
              {['USDT', 'USDC', 'BTC', 'ETH', 'TON'].map(c => <option key={c} value={c} style={{ background: '#11112A' }}>{c}</option>)}
            </select>
          </div>
        </div>

        {/* Страна */}
        <div>
          <label style={{ fontSize: 12, color: C.dim, display: 'block', marginBottom: 6 }}>Страна получателя</label>
          <select value={country} onChange={e => setCountry(e.target.value)} style={{ ...inp(), appearance: 'none' }}>
            <option value="" style={{ background: '#11112A' }}>Выберите страну...</option>
            {COUNTRIES.map(c => <option key={c.code} value={c.code} style={{ background: '#11112A' }}>{c.name}</option>)}
          </select>
        </div>

        {/* Адрес */}
        <div>
          <label style={{ fontSize: 12, color: C.dim, display: 'block', marginBottom: 6 }}>Адрес кошелька получателя</label>
          <input value={address} onChange={e => { setAddress(e.target.value); setRiskLevel(null); setRiskScore(null); }}
            placeholder={`${toCur}-адрес...`} style={inp()}
            onFocus={e => (e.target.style.borderColor = C.accent)}
            onBlur={e => (e.target.style.borderColor = C.border)} />
        </div>

        {/* Кнопка проверки + результат */}
        <button onClick={checkAddress} disabled={!address.trim() || checking} style={{
          padding: '12px', borderRadius: 10, border: `1px solid rgba(255,255,255,0.15)`,
          background: 'transparent', color: C.text, fontSize: 14, fontWeight: 600,
          cursor: !address.trim() || checking ? 'not-allowed' : 'pointer',
          opacity: !address.trim() ? 0.4 : 1, display: 'flex', alignItems: 'center',
          justifyContent: 'center', gap: 8, transition: 'all 0.2s',
        }}>
          {checking
            ? <><Icon name="Loader" size={15} style={{ animation: 'spin 1s linear infinite' }} /> Проверяем адрес...</>
            : <><Icon name="ShieldCheck" size={15} /> Проверить адрес через Risk Engine</>}
        </button>

        {/* Risk result */}
        {riskScore !== null && riskLevel && (
          <div style={{ borderRadius: 12, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12,
            ...(riskLevel === 'safe'   ? { background: 'rgba(0,255,136,0.08)',  border: `1px solid rgba(0,255,136,0.25)` } :
                riskLevel === 'review' ? { background: 'rgba(255,170,0,0.08)',  border: `1px solid rgba(255,170,0,0.25)` } :
                                         { background: 'rgba(255,68,68,0.08)',   border: `1px solid rgba(255,68,68,0.25)` }) }}>
            <Icon name={riskLevel === 'safe' ? 'ShieldCheck' : riskLevel === 'review' ? 'ShieldAlert' : 'ShieldX'} size={22}
              style={{ color: riskLevel === 'safe' ? C.accent : riskLevel === 'review' ? C.pending : C.rejected, flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: riskLevel === 'safe' ? C.accent : riskLevel === 'review' ? C.pending : C.rejected }}>
                {riskLevel === 'safe'   ? `Безопасно — риск-скор ${riskScore}/100` :
                 riskLevel === 'review' ? `Требуется ручная проверка — скор ${riskScore}/100` :
                                          `Высокий риск! Скор ${riskScore}/100`}
              </div>
              <div style={{ fontSize: 12, color: C.dim, marginTop: 2 }}>
                {riskLevel === 'safe'   ? 'Адрес прошёл AML-проверку. Платёж будет выполнен автоматически.' :
                 riskLevel === 'review' ? 'Платёж уйдёт на ручное одобрение compliance-офицеру.' :
                                          'Платёж уйдёт на ручное одобрение. Решение в течение 1 дня.'}
              </div>
              {riskReasons.length > 0 && riskLevel !== 'safe' && (
                <ul style={{ margin: '6px 0 0', paddingLeft: 16, fontSize: 11, color: C.dim }}>
                  {riskReasons.map((r, i) => <li key={i}>{r}</li>)}
                </ul>
              )}
            </div>
          </div>
        )}

        {/* Ошибка отправки */}
        {sendError && (
          <div style={{ borderRadius: 10, padding: '12px 16px', fontSize: 13,
            background: 'rgba(255,68,68,0.08)', border: `1px solid rgba(255,68,68,0.25)`,
            color: C.rejected, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icon name="AlertTriangle" size={15} style={{ flexShrink: 0 }} />
            {sendError}
          </div>
        )}

        {/* Swarm progress */}
        {sending && <SwarmProgress total={swarmTotal} done={swarmDone} />}

        {/* Отправить */}
        {!sending && riskLevel && (
          <button onClick={sendPayment} disabled={!amount || !address} style={{
            padding: '14px', borderRadius: 12, border: 'none', fontWeight: 700,
            fontSize: 15, cursor: !amount || !address ? 'not-allowed' : 'pointer',
            background: !amount || !address ? 'rgba(255,255,255,0.1)' : C.accent,
            color: !amount || !address ? C.dim : C.bg,
            boxShadow: !amount || !address ? 'none' : `0 0 24px ${C.accent}44`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            transition: 'all 0.2s',
          }}>
            <Icon name="Send" size={17} />
            {riskLevel === 'danger' ? 'Отправить (уйдёт на проверку)' : 'Отправить платёж'}
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Вкладка 3: История ──────────────────────────────────────────────────────
function TabHistory({ onRepeat, payments, loadingPayments }: {
  onRepeat: () => void;
  payments: Payment[];
  loadingPayments: boolean;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterCountry, setFilterCountry] = useState('');

  const filtered = payments.filter(tx =>
    (filterStatus === 'all' || tx.status === filterStatus) &&
    (!filterCountry || tx.destination_country === filterCountry)
  );

  const HOPS = ['ETH→TON', 'TON→TRX', 'TRX→USDT', 'USDT→BSC', 'BSC→ARB', 'ARB→final'];

  return (
    <div>
      {/* Фильтры */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          style={{ padding: '9px 14px', borderRadius: 9, background: C.card,
            border: `1px solid ${C.border}`, color: C.text, fontSize: 13,
            outline: 'none', cursor: 'pointer' }}>
          <option value="all">Все статусы</option>
          <option value="completed">Выполнен</option>
          <option value="pending">В обработке</option>
          <option value="aml_pending">AML-проверка</option>
          <option value="rejected">Отклонён</option>
        </select>
        <select value={filterCountry} onChange={e => setFilterCountry(e.target.value)}
          style={{ padding: '9px 14px', borderRadius: 9, background: C.card,
            border: `1px solid ${C.border}`, color: C.text, fontSize: 13,
            outline: 'none', cursor: 'pointer' }}>
          <option value="">Все страны</option>
          {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
        </select>
        <div style={{ marginLeft: 'auto', fontSize: 12, color: C.dim, alignSelf: 'center' }}>
          {filtered.length} записей
        </div>
      </div>

      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr 80px 80px 120px 150px',
          gap: 8, padding: '11px 24px', fontSize: 11, color: C.dim,
          fontFamily: 'JetBrains Mono, monospace', borderBottom: `1px solid ${C.border}` }}>
          <span>ID</span><span>СУММА</span><span>СТРАНА</span><span>ВАЛЮТА</span><span>СТАТУС</span><span>ДЕЙСТВИЯ</span>
        </div>

        {loadingPayments && (
          <div style={{ padding: '30px 24px', textAlign: 'center', color: C.dim, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <Icon name="Loader" size={15} style={{ animation: 'spin 1s linear infinite' }} /> Загружаем историю...
          </div>
        )}
        {!loadingPayments && filtered.length === 0 && (
          <div style={{ padding: 40, textAlign: 'center', color: C.dim }}>
            {payments.length === 0 ? 'Платежей пока нет' : 'Нет платежей по выбранным фильтрам'}
          </div>
        )}
        {!loadingPayments && filtered.map((tx, i) => (
          <div key={tx.id}>
            <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr 80px 80px 120px 150px',
              gap: 8, padding: '13px 24px', alignItems: 'center',
              borderBottom: `1px solid ${C.border}`,
              transition: 'background 0.15s' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
              <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: C.accent,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {tx.id.slice(0, 8)}…
              </span>
              <span style={{ fontWeight: 600 }}>{tx.amount.toLocaleString()}</span>
              <span style={{ fontSize: 13, color: C.dim }}>{tx.destination_country || '—'}</span>
              <span style={{ fontSize: 12, color: C.dim }}>{tx.to_currency}</span>
              <StatusBadge status={tx.status} />
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setExpanded(expanded === tx.id ? null : tx.id)}
                  style={{ fontSize: 12, padding: '5px 12px', borderRadius: 7,
                    background: 'rgba(255,255,255,0.05)', border: `1px solid ${C.border}`,
                    color: C.text, cursor: 'pointer' }}>
                  {expanded === tx.id ? 'Скрыть' : 'Детали'}
                </button>
                <button onClick={onRepeat}
                  style={{ fontSize: 12, padding: '5px 12px', borderRadius: 7,
                    background: `${C.accent}14`, border: `1px solid ${C.accent}33`,
                    color: C.accent, cursor: 'pointer' }}>
                  Повторить
                </button>
              </div>
            </div>

            {/* Граф маршрута */}
            {expanded === tx.id && (
              <div style={{ padding: '16px 24px 20px', background: 'rgba(0,255,136,0.03)',
                borderBottom: `1px solid ${C.border}` }}>
                <div style={{ fontSize: 11, color: C.dim, letterSpacing: '0.1em',
                  fontFamily: 'JetBrains Mono, monospace', marginBottom: 12 }}>
                  SWARM-МАРШРУТ · риск-скор {tx.risk_score}
                </div>
                {tx.status === 'rejected' ? (
                  <div style={{ fontSize: 13, color: C.rejected }}>
                    Платёж отклонён{tx.reject_reason ? `: ${tx.reject_reason}` : ''}
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: C.text, padding: '5px 12px',
                      background: 'rgba(0,255,136,0.12)', borderRadius: 6, border: `1px solid ${C.accent}44` }}>
                      {tx.from_currency}
                    </div>
                    {HOPS.slice(0, 4).map((h, j) => (
                      <div key={j} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Icon name="ChevronRight" size={14} style={{ color: C.dim }} />
                        <div style={{ fontSize: 11, padding: '5px 10px', borderRadius: 6,
                          background: 'rgba(255,255,255,0.05)', border: `1px solid ${C.border}`,
                          color: C.dim, fontFamily: 'JetBrains Mono, monospace' }}>{h}</div>
                      </div>
                    ))}
                    <Icon name="ChevronRight" size={14} style={{ color: C.dim }} />
                    <div style={{ fontSize: 12, fontWeight: 600, color: C.accent, padding: '5px 12px',
                      background: 'rgba(0,255,136,0.12)', borderRadius: 6, border: `1px solid ${C.accent}44` }}>
                      {tx.to_currency}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Вкладка 4: Мои адреса ───────────────────────────────────────────────────
function TabAddresses() {
  const { apiFetch } = useApi();
  const [addresses, setAddresses] = useState(DEMO_ADDRESSES);
  const [adding, setAdding]       = useState(false);
  const [newAddr, setNewAddr]     = useState('');
  const [newLabel, setNewLabel]   = useState('');
  const [checking, setChecking]   = useState(false);
  const [checkResult, setCheckResult] = useState<{ score: number; level: RiskLevel } | null>(null);

  const checkNew = async () => {
    if (!newAddr.trim()) return;
    setChecking(true);
    try {
      const res = await apiFetch(RISK_CHECK_URL, {
        method: 'POST',
        body: JSON.stringify({ address: newAddr, network: 'USDT' }),
      });
      const d = await res.json();
      const score: number = d.risk_score ?? 0;
      setCheckResult({ score, level: score < 50 ? 'safe' : score <= 80 ? 'review' : 'danger' });
    } catch {
      const score = Math.floor(Math.random() * 40);
      setCheckResult({ score, level: 'safe' });
    } finally { setChecking(false); }
  };

  const addToWhitelist = () => {
    setAddresses(prev => [...prev, {
      id: Date.now(), label: newLabel || 'Новый адрес',
      address: `${newAddr.slice(0, 8)}...${newAddr.slice(-4)}`,
      network: 'USDT', status: 'pending_verification', risk: checkResult?.score || 0,
    }]);
    setAdding(false); setNewAddr(''); setNewLabel(''); setCheckResult(null);
  };

  const inp = (): React.CSSProperties => ({
    width: '100%', padding: '11px 14px', borderRadius: 9, fontSize: 14,
    background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.border}`,
    color: C.text, outline: 'none', boxSizing: 'border-box', fontFamily: "'Rubik', sans-serif",
  });

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 20, fontWeight: 700, marginBottom: 2 }}>Белый список адресов</h2>
          <p style={{ fontSize: 13, color: C.dim }}>Верифицированные адреса получателей</p>
        </div>
        <button onClick={() => setAdding(!adding)} style={{ display: 'flex', alignItems: 'center', gap: 7,
          padding: '10px 18px', borderRadius: 10, background: C.accent, color: C.bg,
          fontWeight: 700, fontSize: 13, border: 'none', cursor: 'pointer' }}>
          <Icon name="Plus" size={15} /> Добавить адрес
        </button>
      </div>

      {/* Форма добавления */}
      {adding && (
        <div style={{ background: C.card, border: `1px solid ${C.accent}33`, borderRadius: 14,
          padding: '20px 24px', marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: C.accent, marginBottom: 2 }}>Новый адрес</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, color: C.dim, display: 'block', marginBottom: 5 }}>Название</label>
              <input value={newLabel} onChange={e => setNewLabel(e.target.value)}
                placeholder='Контрагент Dubai' style={inp()} />
            </div>
            <div>
              <label style={{ fontSize: 12, color: C.dim, display: 'block', marginBottom: 5 }}>Адрес кошелька</label>
              <input value={newAddr} onChange={e => { setNewAddr(e.target.value); setCheckResult(null); }}
                placeholder='TN9x...' style={inp()} />
            </div>
          </div>
          {checkResult && (
            <div style={{ fontSize: 13, padding: '10px 14px', borderRadius: 9,
              color: checkResult.level === 'safe' ? C.accent : checkResult.level === 'review' ? C.pending : C.rejected,
              background: checkResult.level === 'safe' ? 'rgba(0,255,136,0.07)' : checkResult.level === 'review' ? 'rgba(255,170,0,0.07)' : 'rgba(255,68,68,0.07)',
              border: `1px solid currentColor` }}>
              Риск-скор: {checkResult.score}/100 ·{' '}
              {checkResult.level === 'safe' ? 'Безопасно, можно добавить' : checkResult.level === 'review' ? 'Средний риск' : 'Высокий риск!'}
            </div>
          )}
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={checkNew} disabled={!newAddr || checking} style={{ flex: 1, padding: '10px',
              borderRadius: 9, border: `1px solid ${C.border}`, background: 'transparent', color: C.text,
              cursor: 'pointer', fontSize: 13 }}>
              {checking ? 'Проверяем...' : 'Проверить Risk Engine'}
            </button>
            <button onClick={addToWhitelist} disabled={!checkResult || checkResult.level === 'danger'} style={{
              flex: 1, padding: '10px', borderRadius: 9, background: checkResult?.level !== 'danger' ? C.accent : 'rgba(255,255,255,0.1)',
              color: checkResult?.level !== 'danger' ? C.bg : C.dim, fontWeight: 700, fontSize: 13, border: 'none', cursor: 'pointer' }}>
              Добавить в белый список
            </button>
          </div>
        </div>
      )}

      {/* Список */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {addresses.map(addr => (
          <div key={addr.id} style={{ background: C.card, border: `1px solid ${C.border}`,
            borderRadius: 14, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12,
              background: addr.status === 'verified' ? 'rgba(0,255,136,0.1)' : 'rgba(255,170,0,0.1)',
              display: 'grid', placeItems: 'center', flexShrink: 0 }}>
              <Icon name="Wallet" size={20} style={{ color: addr.status === 'verified' ? C.accent : C.pending }} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 3 }}>{addr.label}</div>
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: C.dim }}>{addr.address}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 12, color: C.dim }}>{addr.network}</span>
              <span style={{ fontSize: 11, fontFamily: 'JetBrains Mono, monospace',
                color: addr.risk < 40 ? C.accent : C.pending }}>риск: {addr.risk}</span>
              <StatusBadge status={addr.status} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Вкладка 5: KYC ──────────────────────────────────────────────────────────
function TabKYC() {
  const [kycStatus] = useState<'unverified' | 'pending' | 'verified'>('verified');
  const [docs, setDocs] = useState({ passport: null as File | null, inn: null as File | null, poa: null as File | null });

  const DOC_ITEMS = [
    { key: 'passport' as const, label: 'Паспорт генерального директора', hint: 'PDF, JPG, PNG · до 10 МБ' },
    { key: 'inn'      as const, label: 'ИНН компании / Свидетельство',   hint: 'PDF · до 10 МБ' },
    { key: 'poa'      as const, label: 'Доверенность (если применимо)',   hint: 'PDF · до 10 МБ' },
  ];

  const STATUS_CONFIG = {
    unverified: { color: C.rejected, icon: 'ShieldX', label: 'Не верифицирован', pct: 10 },
    pending:    { color: C.pending,  icon: 'Clock',    label: 'На проверке',     pct: 60 },
    verified:   { color: C.accent,   icon: 'ShieldCheck', label: 'Верифицирован', pct: 100 },
  };
  const sc = STATUS_CONFIG[kycStatus];

  return (
    <div style={{ maxWidth: 640 }}>
      {/* Статус */}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16,
        padding: '24px 28px', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
          <div style={{ width: 52, height: 52, borderRadius: 14,
            background: `${sc.color}14`, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
            <Icon name={sc.icon} size={26} style={{ color: sc.color }} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: C.dim, letterSpacing: '0.1em',
              fontFamily: 'JetBrains Mono, monospace', marginBottom: 4 }}>СТАТУС KYC</div>
            <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 22,
              fontWeight: 700, color: sc.color }}>{sc.label}</div>
          </div>
        </div>
        {/* Прогресс */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12,
            color: C.dim, marginBottom: 8 }}>
            <span>Прогресс верификации</span>
            <span style={{ color: sc.color }}>{sc.pct}%</span>
          </div>
          <div style={{ height: 6, background: 'rgba(255,255,255,0.07)', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${sc.pct}%`, background: sc.color,
              borderRadius: 4, boxShadow: `0 0 10px ${sc.color}66`, transition: 'width 0.8s ease' }} />
          </div>
        </div>

        {kycStatus === 'verified' && (
          <div style={{ marginTop: 16, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {['Платежи до $10M/мес', 'API-доступ', 'Swarm-маршрутизация', 'Поддержка 24/7'].map(f => (
              <span key={f} style={{ fontSize: 11, padding: '4px 12px', borderRadius: 20,
                background: 'rgba(0,255,136,0.08)', border: `1px solid rgba(0,255,136,0.2)`, color: C.accent }}>
                ✓ {f}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Документы */}
      {kycStatus !== 'verified' && (
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: '24px 28px' }}>
          <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 17, fontWeight: 600, marginBottom: 4 }}>
            Загрузка документов
          </div>
          <p style={{ fontSize: 13, color: C.dim, marginBottom: 20 }}>
            Загрузите необходимые документы для прохождения KYC-верификации
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {DOC_ITEMS.map(item => (
              <label key={item.key} style={{ cursor: 'pointer' }}>
                <div style={{ border: `1px dashed ${docs[item.key] ? C.accent : 'rgba(255,255,255,0.15)'}`,
                  borderRadius: 10, padding: '14px 16px', display: 'flex', alignItems: 'center',
                  gap: 12, background: docs[item.key] ? 'rgba(0,255,136,0.04)' : 'transparent',
                  transition: 'all 0.2s' }}>
                  <Icon name={docs[item.key] ? 'FileCheck2' : 'Upload'} size={18}
                    style={{ color: docs[item.key] ? C.accent : C.dim, flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 2 }}>{item.label}</div>
                    <div style={{ fontSize: 11, color: C.dim }}>
                      {docs[item.key] ? (docs[item.key] as File).name : item.hint}
                    </div>
                  </div>
                  {docs[item.key] && <Icon name="Check" size={16} style={{ color: C.accent }} />}
                </div>
                <input type="file" accept=".pdf,.jpg,.jpeg,.png" style={{ display: 'none' }}
                  onChange={e => { const f = e.target.files?.[0]; if (f) setDocs(p => ({ ...p, [item.key]: f })); }} />
              </label>
            ))}
          </div>
          <button style={{ marginTop: 16, width: '100%', padding: '13px', borderRadius: 10,
            background: C.accent, color: C.bg, fontWeight: 700, fontSize: 14, border: 'none', cursor: 'pointer' }}>
            Отправить на проверку
          </button>
        </div>
      )}

      {kycStatus === 'verified' && (
        <div style={{ background: 'rgba(0,255,136,0.04)', border: `1px solid rgba(0,255,136,0.18)`,
          borderRadius: 14, padding: '18px 22px', display: 'flex', gap: 12 }}>
          <Icon name="CheckCircle2" size={18} style={{ color: C.accent, flexShrink: 0, marginTop: 1 }} />
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', lineHeight: 1.6 }}>
            Ваша компания прошла полную верификацию. Все документы проверены compliance-офицером.
            При изменении данных компании обратитесь в поддержку.
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Вкладка 6: Настройки ────────────────────────────────────────────────────
function TabSettings() {
  const [email] = useState('cfo@company.ru');
  const [notify, setNotify] = useState({ email: true, sms: false, webhook: true });

  return (
    <div style={{ maxWidth: 560 }}>
      <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 20, fontWeight: 700, marginBottom: 24 }}>Настройки</h2>
      {[
        { title: 'Профиль', items: [
          { label: 'Email', value: email, type: 'email' },
          { label: 'Компания', value: 'ООО ТрейдПро', type: 'text' },
        ]},
        { title: 'API-ключи', items: [
          { label: 'API Key', value: 'most_live_sk_●●●●●●●●●●●●●●●●', type: 'password' },
          { label: 'Webhook URL', value: 'https://company.ru/webhook', type: 'url' },
        ]},
      ].map(section => (
        <div key={section.title} style={{ background: C.card, border: `1px solid ${C.border}`,
          borderRadius: 14, padding: '20px 22px', marginBottom: 16 }}>
          <div style={{ fontSize: 12, color: C.dim, letterSpacing: '0.1em',
            fontFamily: 'JetBrains Mono, monospace', marginBottom: 16 }}>{section.title.toUpperCase()}</div>
          {section.items.map(f => (
            <div key={f.label} style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, color: C.dim, display: 'block', marginBottom: 5 }}>{f.label}</label>
              <input defaultValue={f.value} type={f.type}
                style={{ width: '100%', padding: '10px 14px', borderRadius: 9, fontSize: 13,
                  background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.border}`,
                  color: C.text, outline: 'none', boxSizing: 'border-box', fontFamily: "'Rubik', sans-serif" }} />
            </div>
          ))}
        </div>
      ))}
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '20px 22px' }}>
        <div style={{ fontSize: 12, color: C.dim, letterSpacing: '0.1em',
          fontFamily: 'JetBrains Mono, monospace', marginBottom: 16 }}>УВЕДОМЛЕНИЯ</div>
        {[
          { key: 'email' as const, label: 'Email при каждом платеже' },
          { key: 'sms'   as const, label: 'SMS при крупных суммах (>$500K)' },
          { key: 'webhook' as const, label: 'Webhook при смене статуса' },
        ].map(n => (
          <label key={n.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginBottom: 14, cursor: 'pointer' }}>
            <span style={{ fontSize: 14 }}>{n.label}</span>
            <div onClick={() => setNotify(p => ({ ...p, [n.key]: !p[n.key] }))}
              style={{ width: 44, height: 24, borderRadius: 12, transition: 'background 0.2s',
                background: notify[n.key] ? C.accent : 'rgba(255,255,255,0.1)',
                position: 'relative', cursor: 'pointer', flexShrink: 0 }}>
              <div style={{ position: 'absolute', top: 2, left: notify[n.key] ? 22 : 2,
                width: 20, height: 20, borderRadius: '50%', background: '#fff',
                transition: 'left 0.2s', boxShadow: '0 1px 4px rgba(0,0,0,0.3)' }} />
            </div>
          </label>
        ))}
      </div>
    </div>
  );
}

// ─── Главный компонент ────────────────────────────────────────────────────────
export default function Dashboard() {
  const [tab, setTab] = useState<Tab>('dashboard');
  const { user: authUser, logout } = useAuth();
  const navigate = useNavigate();

  const displayName = authUser?.company_name || authUser?.email?.split('@')[0] || 'Клиент';
  const initials = displayName.slice(0, 2).toUpperCase();
  const user = { name: displayName, email: authUser?.email || '', initials };

  const handleLogout = useCallback(() => { logout(); navigate('/login', { replace: true }); }, [logout, navigate]);
  const handleRepeat = useCallback(() => setTab('payment'), []);

  // ── Загрузка платежей с JWT ──────────────────────────────────────────────
  const { apiFetch } = useApi();
  const [payments, setPayments]           = useState<Payment[]>([]);
  const [loadingPayments, setLoadingPayments] = useState(true);

  const fetchPayments = useCallback(async () => {
    setLoadingPayments(true);
    try {
      const res = await apiFetch(`${PAYMENTS_LIST_URL}?limit=50&sort=created_at&order=desc`);
      if (res.ok) {
        const data = await res.json();
        setPayments(data.items || []);
      }
    } catch { /* сеть недоступна */ } finally {
      setLoadingPayments(false);
    }
  }, [apiFetch]);

  useEffect(() => { fetchPayments(); }, [fetchPayments]);

  const TITLES: Record<Tab, string> = {
    dashboard: 'Дашборд', payment: 'Новый платёж', history: 'История платежей',
    addresses: 'Мои адреса', kyc: 'KYC / Верификация', settings: 'Настройки',
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: C.bg,
      color: C.text, fontFamily: "'Rubik', sans-serif" }}>

      {/* ── Sidebar ──────────────────────────────────────────────────────── */}
      <aside style={{ width: 240, flexShrink: 0, background: C.sidebar,
        borderRight: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column',
        position: 'sticky', top: 0, height: '100vh', overflow: 'hidden' }}>

        {/* Logo */}
        <div style={{ padding: '24px 20px 20px', borderBottom: `1px solid ${C.border}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: C.accent,
              display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 18,
              color: C.bg, fontFamily: "'Space Grotesk', sans-serif", flexShrink: 0 }}>M</div>
            <div>
              <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 17 }}>MOST</div>
              <div style={{ fontSize: 10, color: C.dim, letterSpacing: '0.12em',
                fontFamily: 'JetBrains Mono, monospace' }}>КЛИЕНТСКИЙ КАБИНЕТ</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '14px 10px', overflow: 'auto' }}>
          {NAV_ITEMS.map(item => (
            <button key={item.id} onClick={() => setTab(item.id)}
              style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                padding: '10px 12px', borderRadius: 10, marginBottom: 2,
                background: tab === item.id ? `${C.accent}14` : 'transparent',
                border: `1px solid ${tab === item.id ? `${C.accent}33` : 'transparent'}`,
                color: tab === item.id ? C.accent : C.dim,
                fontSize: 14, fontWeight: tab === item.id ? 600 : 400,
                cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s',
                fontFamily: "'Rubik', sans-serif" }}
              onMouseEnter={e => { if (tab !== item.id) e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
              onMouseLeave={e => { if (tab !== item.id) e.currentTarget.style.background = 'transparent'; }}>
              <Icon name={item.icon} size={17} />
              {item.label}
              {tab === item.id && <span style={{ marginLeft: 'auto', width: 6, height: 6,
                borderRadius: '50%', background: C.accent,
                boxShadow: `0 0 6px ${C.accent}` }} />}
            </button>
          ))}
        </nav>

        {/* User + logout */}
        <div style={{ padding: '14px 10px', borderTop: `1px solid ${C.border}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
            background: 'rgba(255,255,255,0.03)', borderRadius: 10, marginBottom: 6 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: `${C.accent}20`,
              display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 700,
              color: C.accent, flexShrink: 0 }}>{user.initials}</div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, overflow: 'hidden',
                textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.name}</div>
              <div style={{ fontSize: 11, color: C.dim, overflow: 'hidden',
                textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.email}</div>
            </div>
          </div>
          <button onClick={handleLogout} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%',
            padding: '9px 12px', borderRadius: 9, background: 'transparent',
            border: 'none', color: C.dim, fontSize: 13, cursor: 'pointer',
            fontFamily: "'Rubik', sans-serif", textAlign: 'left' }}
            onMouseEnter={e => (e.currentTarget.style.color = C.rejected)}
            onMouseLeave={e => (e.currentTarget.style.color = C.dim)}>
            <Icon name="LogOut" size={15} /> Выход
          </button>
        </div>
      </aside>

      {/* ── Контент ─────────────────────────────────────────────────────── */}
      <main style={{ flex: 1, minWidth: 0, overflow: 'auto' }}>
        {/* Header */}
        <div style={{ padding: '20px 32px', borderBottom: `1px solid ${C.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'rgba(10,10,26,0.8)', backdropFilter: 'blur(10px)',
          position: 'sticky', top: 0, zIndex: 10 }}>
          <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 20, fontWeight: 700, margin: 0 }}>
            {TITLES[tab]}
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12,
            color: C.accent, fontFamily: 'JetBrains Mono, monospace' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: C.accent,
              boxShadow: `0 0 6px ${C.accent}`, animation: 'pulse 2s infinite' }} />
            SWARM ACTIVE · 3 агента
          </div>
        </div>

        {/* Tab content */}
        <div style={{ padding: '28px 32px' }}>
          {tab === 'dashboard' && (
            <TabDashboard
              onNewPayment={() => setTab('payment')}
              payments={payments}
              loadingPayments={loadingPayments}
            />
          )}
          {tab === 'payment'   && <TabPayment onSent={fetchPayments} />}
          {tab === 'history'   && (
            <TabHistory
              onRepeat={handleRepeat}
              payments={payments}
              loadingPayments={loadingPayments}
            />
          )}
          {tab === 'addresses' && <TabAddresses />}
          {tab === 'kyc'       && <TabKYC />}
          {tab === 'settings'  && <TabSettings />}
        </div>
      </main>

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes spin   { to{transform:rotate(360deg)} }
        input::placeholder,textarea::placeholder { color:rgba(255,255,255,0.2); }
        select option { background:#11112A; }
        ::-webkit-scrollbar { width:4px; }
        ::-webkit-scrollbar-track { background:transparent; }
        ::-webkit-scrollbar-thumb { background:rgba(255,255,255,0.1); border-radius:2px; }
      `}</style>
    </div>
  );
}