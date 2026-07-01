import { useState, useEffect, useCallback, useRef } from 'react';
import Icon from '@/components/ui/icon';

// ---------------------------------------------------------------------------
// Типы
// ---------------------------------------------------------------------------
interface Summary {
  payments: {
    total_orders: number;
    total_volume: number;
    avg_risk_score: number;
    by_status: Record<string, number>;
    by_risk: { high_risk: number; medium_risk: number; low_risk: number };
  };
  swarm: {
    total_agents: number;
    completed: number;
    dead: number;
    success_rate: number;
    top_networks: { network: string; count: number }[];
  };
  users: { total: number };
}

interface AuditEntry {
  id: number;
  user_email: string;
  company_name: string;
  action: string;
  details: Record<string, unknown>;
  ip_address: string;
  created_at: string;
}

interface RiskBucket {
  range: string;
  count: number;
  volume: number;
}

interface GraphNode { id: string; network: string; x: number; y: number }
interface GraphEdge { from: string; to: string; status: string }

// ---------------------------------------------------------------------------
// Фейковые данные для ПМЭФ-демо (offline — не требуют реального API)
// ---------------------------------------------------------------------------
const DEMO_SUMMARY: Summary = {
  payments: {
    total_orders: 14_832,
    total_volume: 298_440_120,
    avg_risk_score: 22.4,
    by_status: { completed: 12_104, processing: 1_840, aml_pending: 488, rejected: 400 },
    by_risk: { high_risk: 612, medium_risk: 2_104, low_risk: 12_116 },
  },
  swarm: {
    total_agents: 1_284_000,
    completed: 1_261_480,
    dead: 22_520,
    success_rate: 98.24,
    top_networks: [
      { network: 'solana',   count: 312_000 },
      { network: 'tron',     count: 248_000 },
      { network: 'ethereum', count: 198_000 },
      { network: 'ton',      count: 187_000 },
      { network: 'arbitrum', count: 142_000 },
      { network: 'polygon',  count: 98_000  },
      { network: 'bsc',      count: 79_000  },
      { network: 'stellar',  count: 20_000  },
    ],
  },
  users: { total: 1_204 },
};

const DEMO_RISK_DIST: RiskBucket[] = [
  { range: '0-9',   count: 6_200,  volume: 88_000_000 },
  { range: '10-19', count: 3_800,  volume: 52_000_000 },
  { range: '20-29', count: 2_116,  volume: 38_000_000 },
  { range: '30-39', count: 1_204,  volume: 26_000_000 },
  { range: '40-49', count: 800,    volume: 14_000_000 },
  { range: '50-59', count: 604,    volume: 11_000_000 },
  { range: '60-69', count: 412,    volume: 9_200_000  },
  { range: '70-79', count: 200,    volume: 4_800_000  },
  { range: '80-89', count: 312,    volume: 5_600_000  },
  { range: '90-100',count: 184,    volume: 3_400_000  },
];

const DEMO_AUDIT: AuditEntry[] = Array.from({ length: 40 }, (_, i) => {
  const actions = ['payment.approve','payment.reject','risk.check','auth.login','payment.new'];
  const companies = ['ООО ТрейдПро','АО Меркурий','FinBridge Ltd','ООО Горизонт','AE Capital'];
  const emails = ['trader@finco.ru','cfo@mercury.ae','ops@bridge.io','ceo@horizon.ru','mgr@aecap.ae'];
  const action = actions[i % actions.length];
  const ms = Date.now() - i * 47_000;
  return {
    id: 9900 - i,
    user_email: emails[i % emails.length],
    company_name: companies[i % companies.length],
    action,
    details: action.startsWith('payment') ? { order_id: `ORD-${(1000 + i).toString(36).toUpperCase()}`, risk_score: Math.round(Math.random() * 80) } : { network: 'ethereum' },
    ip_address: `185.${120 + (i % 30)}.${10 + (i % 15)}.${i % 255}`,
    created_at: new Date(ms).toISOString(),
  };
});

// Swarm-граф: 1 источник → N нод → 1 получатель
const buildGraph = (): { nodes: GraphNode[]; edges: GraphEdge[] } => {
  const nets = ['ETH','SOL','TON','TRX','ARB','MATIC','BSC','XLM'];
  const cols = 4; const rows = 2;
  const nodes: GraphNode[] = [
    { id: 'SRC', network: 'SRC', x: 40, y: 50 },
    { id: 'DST', network: 'DST', x: 560, y: 50 },
  ];
  const edges: GraphEdge[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      const id = `N${i}`;
      nodes.push({ id, network: nets[i % nets.length], x: 140 + c * 110, y: 16 + r * 68 });
      edges.push({ from: 'SRC', to: id,    status: i < 6 ? 'completed' : 'active' });
      edges.push({ from: id,    to: 'DST', status: i < 6 ? 'completed' : 'active' });
    }
  }
  return { nodes, edges };
};
const GRAPH = buildGraph();

// ---------------------------------------------------------------------------
// Вспомогательные компоненты
// ---------------------------------------------------------------------------
function StatCard({ icon, label, value, sub, accent = 'neon-cyan', delay = '0s' }: {
  icon: string; label: string; value: string; sub?: string; accent?: string; delay?: string;
}) {
  return (
    <div className="glass rounded-2xl p-5 animate-fade-in hover-scale" style={{ animationDelay: delay }}>
      <div className="flex items-center justify-between mb-3">
        <Icon name={icon} size={18} className={accent} />
        <span className="text-[10px] mono text-muted-foreground">LIVE</span>
      </div>
      <div className={`font-display text-2xl font-bold ${accent}`}>{value}</div>
      <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
      {sub && <div className={`text-[11px] mono mt-1 ${accent} opacity-70`}>{sub}</div>}
    </div>
  );
}

function ActionBadge({ action }: { action: string }) {
  const map: Record<string, string> = {
    'payment.approve': 'neon-lime',
    'payment.reject':  'text-destructive',
    'payment.new':     'text-primary',
    'risk.check':      'text-yellow-400',
    'auth.login':      'text-muted-foreground',
  };
  const cls = map[action] || 'text-muted-foreground';
  return <span className={`mono text-[11px] ${cls}`}>{action}</span>;
}

function fmtNum(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

function fmtUSD(n: number) {
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000)     return `$${(n / 1_000_000).toFixed(1)}M`;
  return `$${n.toLocaleString()}`;
}

function timeSince(iso: string) {
  const d = (Date.now() - new Date(iso).getTime()) / 1000;
  if (d < 60)    return `${Math.round(d)}с назад`;
  if (d < 3600)  return `${Math.round(d/60)}мин назад`;
  return `${Math.round(d/3600)}ч назад`;
}

const NET_COLORS: Record<string, string> = {
  solana:'#42fff0', tron:'#ff3b3b', ethereum:'#8fadff', ton:'#39a0ff',
  arbitrum:'#39c6ff', polygon:'#a06bff', bsc:'#f3ba2f', stellar:'#7ee0ff',
};

// ---------------------------------------------------------------------------
// Компонент «Граф роя»
// ---------------------------------------------------------------------------
function SwarmGraph({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-background/85 backdrop-blur-md" />
      <div
        className="relative glass rounded-3xl border border-primary/30 w-full max-w-2xl p-6 animate-scale-in"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-[10px] mono neon-cyan mb-0.5">SWARM TOPOLOGY · LIVE</div>
            <h3 className="font-display text-lg font-bold">Граф маршрутизации платежа</h3>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <Icon name="X" size={20} />
          </button>
        </div>

        <svg viewBox="0 0 600 110" className="w-full h-auto mb-4">
          {/* Edges */}
          {GRAPH.edges.map((e, i) => {
            const from = GRAPH.nodes.find(n => n.id === e.from)!;
            const to   = GRAPH.nodes.find(n => n.id === e.to)!;
            return (
              <line key={i}
                x1={from.x} y1={from.y} x2={to.x} y2={to.y}
                stroke={e.status === 'completed' ? 'hsl(var(--neon-lime))' : 'hsl(var(--primary))'}
                strokeWidth="1.2"
                strokeDasharray={e.status === 'active' ? '4 4' : undefined}
                opacity="0.55"
                style={e.status === 'active' ? { animation: 'dash-flow 1.4s linear infinite' } : undefined}
              />
            );
          })}
          {/* Nodes */}
          {GRAPH.nodes.map(n => {
            const isSrc = n.id === 'SRC', isDst = n.id === 'DST';
            const r = isSrc || isDst ? 16 : 12;
            const fill = isSrc ? 'hsl(var(--primary))' : isDst ? 'hsl(var(--accent))' : 'hsl(var(--neon-lime))';
            return (
              <g key={n.id}>
                <circle cx={n.x} cy={n.y} r={r} fill={fill} opacity="0.9">
                  {!isSrc && !isDst && (
                    <animate attributeName="r" values={`${r};${r+3};${r}`} dur="2s" repeatCount="indefinite" />
                  )}
                </circle>
                <text x={n.x} y={n.y + 4} textAnchor="middle" fontSize="8" fontWeight="700"
                  fill={isSrc || isDst ? 'hsl(var(--primary-foreground))' : 'hsl(var(--background))'}>{n.network}</text>
              </g>
            );
          })}
        </svg>

        <div className="grid grid-cols-4 gap-3">
          {[
            { l: 'Агентов',    v: '8', cls: 'neon-cyan' },
            { l: 'Сетей',      v: '8', cls: 'neon-cyan' },
            { l: 'Завершено',  v: '6', cls: 'neon-lime' },
            { l: 'Успешность', v: '75%', cls: 'neon-lime' },
          ].map(x => (
            <div key={x.l} className="bg-secondary/40 rounded-xl p-3 text-center">
              <div className={`font-display text-xl font-bold ${x.cls}`}>{x.v}</div>
              <div className="text-[11px] text-muted-foreground">{x.l}</div>
            </div>
          ))}
        </div>

        <div className="mt-4 p-3 rounded-xl bg-primary/5 border border-primary/20 text-xs text-muted-foreground">
          <span className="neon-cyan font-medium">MOST</span> раскрывает полный граф маршрутизации.{' '}
          <span className="text-muted-foreground/60">Chainalysis видит только входную и выходную точки — без топологии.</span>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Основной дашборд
// ---------------------------------------------------------------------------
export default function RegulatorDashboard() {
  const [keyInput, setKeyInput]   = useState('');
  const [authed, setAuthed]       = useState(false);
  const [authErr, setAuthErr]     = useState('');
  const [graphOpen, setGraphOpen] = useState(false);
  const [liveLog, setLiveLog]     = useState<AuditEntry[]>(DEMO_AUDIT.slice(0, 12));
  const tickRef = useRef(0);

  // Имитация живой ленты
  useEffect(() => {
    if (!authed) return;
    const interval = setInterval(() => {
      tickRef.current += 1;
      const idx = tickRef.current % DEMO_AUDIT.length;
      const entry = { ...DEMO_AUDIT[idx], id: 99000 + tickRef.current, created_at: new Date().toISOString() };
      setLiveLog(prev => [entry, ...prev.slice(0, 19)]);
    }, 2800);
    return () => clearInterval(interval);
  }, [authed]);

  function handleAuth() {
    if (keyInput.trim().length >= 4) {
      setAuthed(true);
      setAuthErr('');
    } else {
      setAuthErr('Введите ключ (минимум 4 символа)');
    }
  }

  const maxRisk   = Math.max(...DEMO_RISK_DIST.map(b => b.count));
  const maxNet    = Math.max(...DEMO_SUMMARY.swarm.top_networks.map(n => n.count));
  const totalOrd  = DEMO_SUMMARY.payments.total_orders;
  const byStatus  = DEMO_SUMMARY.payments.by_status;

  // ── Auth screen ──────────────────────────────────────────────────────────
  if (!authed) {
    return (
      <div className="animate-fade-in max-w-md mx-auto pt-16">
        <div className="glass rounded-3xl border border-border/60 p-8">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 grid place-items-center mx-auto mb-6">
            <Icon name="ShieldCheck" size={32} className="text-primary" />
          </div>
          <div className="text-center mb-6">
            <div className="text-[10px] mono text-muted-foreground mb-1 tracking-widest">MOST · REGULATOR ACCESS</div>
            <h2 className="font-display text-2xl font-bold">Золотая нода</h2>
            <p className="text-sm text-muted-foreground mt-2">
              Supervisory read-only node. Введите ключ регулятора для доступа к полной прозрачности транзакций.
            </p>
          </div>
          <div className="space-y-3">
            <input
              type="password"
              value={keyInput}
              onChange={e => setKeyInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAuth()}
              placeholder="X-Regulator-Key"
              className="w-full bg-secondary/50 border border-border/60 rounded-xl px-4 py-3 mono text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/60 transition-colors"
            />
            {authErr && (
              <p className="text-xs text-destructive flex items-center gap-1.5">
                <Icon name="AlertCircle" size={12} /> {authErr}
              </p>
            )}
            <button
              onClick={handleAuth}
              className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold glow-cyan hover-scale"
            >
              Войти в регуляторную ноду
            </button>
            <p className="text-center text-[11px] mono text-muted-foreground">
              Для демо введите любой ключ длиной ≥ 4 символов
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── Main dashboard ───────────────────────────────────────────────────────
  return (
    <div className="animate-fade-in">
      {graphOpen && <SwarmGraph onClose={() => setGraphOpen(false)} />}

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 text-[10px] mono text-muted-foreground mb-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[hsl(var(--neon-lime))] animate-pulse-glow" />
            MOST REGULATOR NODE · READ-ONLY · TRANSPARENCY 100%
          </div>
          <h1 className="font-display text-2xl font-bold">Золотая нода</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Полная прозрачность транзакций платформы для надзорного органа</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setGraphOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary/10 text-primary border border-primary/30 text-sm font-medium hover-scale glow-cyan"
          >
            <Icon name="GitFork" size={16} /> Раскрыть граф роя
          </button>
          <div className="text-[10px] mono text-muted-foreground px-3 py-2 glass rounded-xl border border-border/40">
            vs Chainalysis →<span className="text-destructive ml-1">black box</span>
          </div>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard icon="DollarSign"    label="Общий объём"       value={fmtUSD(DEMO_SUMMARY.payments.total_volume)} sub="+12.4% за 30д"   accent="neon-cyan"      delay="0s"    />
        <StatCard icon="FileText"      label="Платёжных поручений" value={fmtNum(totalOrd)}                        sub="за всё время"     accent="neon-lime"      delay="0.06s" />
        <StatCard icon="Users"         label="Компаний"           value={fmtNum(DEMO_SUMMARY.users.total)}         sub="верифицировано"   accent="neon-cyan"      delay="0.12s" />
        <StatCard icon="Zap"           label="Swarm-агентов"      value={fmtNum(DEMO_SUMMARY.swarm.total_agents)}  sub={`${DEMO_SUMMARY.swarm.success_rate}% успех`} accent="neon-lime" delay="0.18s" />
      </div>

      <div className="grid lg:grid-cols-3 gap-6 mb-6">

        {/* Статусы платежей */}
        <div className="glass rounded-2xl p-6 animate-fade-in">
          <h2 className="font-display text-base font-semibold mb-4">Статусы поручений</h2>
          <div className="space-y-3">
            {([
              { k: 'completed',   l: 'Завершено',       c: 'neon-lime'        },
              { k: 'processing',  l: 'В обработке',     c: 'text-primary'     },
              { k: 'aml_pending', l: 'AML — ожидание',  c: 'text-yellow-400'  },
              { k: 'rejected',    l: 'Отклонено',       c: 'text-destructive' },
            ] as const).map(({ k, l, c }) => {
              const val = byStatus[k] ?? 0;
              const pct = totalOrd ? (val / totalOrd) * 100 : 0;
              return (
                <div key={k}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-muted-foreground">{l}</span>
                    <span className={`mono font-medium ${c}`}>{fmtNum(val)}</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-secondary/50 overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${
                      c === 'neon-lime' ? 'bg-[hsl(var(--neon-lime))]' :
                      c === 'text-primary' ? 'bg-primary' :
                      c === 'text-yellow-400' ? 'bg-yellow-400' : 'bg-destructive'
                    }`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Риски */}
          <div className="mt-6 pt-4 border-t border-border/40">
            <div className="text-xs mono text-muted-foreground mb-3">РАСПРЕДЕЛЕНИЕ РИСКА</div>
            <div className="grid grid-cols-3 gap-2 text-center">
              {[
                { l: 'Низкий',  v: DEMO_SUMMARY.payments.by_risk.low_risk,    c: 'neon-lime'        },
                { l: 'Средний', v: DEMO_SUMMARY.payments.by_risk.medium_risk,  c: 'text-yellow-400'  },
                { l: 'Высокий', v: DEMO_SUMMARY.payments.by_risk.high_risk,    c: 'text-destructive' },
              ].map(x => (
                <div key={x.l} className="bg-secondary/30 rounded-xl p-2">
                  <div className={`font-display text-lg font-bold ${x.c}`}>{fmtNum(x.v)}</div>
                  <div className="text-[10px] text-muted-foreground">{x.l}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Гистограмма риск-скоров */}
        <div className="glass rounded-2xl p-6 animate-fade-in" style={{ animationDelay: '0.06s' }}>
          <h2 className="font-display text-base font-semibold mb-4">Гистограмма риск-скоров</h2>
          <div className="flex items-end gap-1.5 h-36">
            {DEMO_RISK_DIST.map((b, i) => {
              const pct = (b.count / maxRisk) * 100;
              const isHigh = i >= 6;
              return (
                <div key={b.range} className="flex-1 flex flex-col items-center gap-1" title={`${b.range}: ${fmtNum(b.count)} платежей`}>
                  <div
                    className={`w-full rounded-t-sm transition-all ${isHigh ? 'bg-destructive/70' : i >= 4 ? 'bg-yellow-400/70' : 'bg-[hsl(var(--neon-lime))]/70'}`}
                    style={{ height: `${pct}%`, minHeight: 3 }}
                  />
                </div>
              );
            })}
          </div>
          <div className="flex justify-between mt-2 text-[9px] mono text-muted-foreground">
            <span>0</span><span>40</span><span>80</span><span>100</span>
          </div>
          <div className="flex gap-3 mt-3 text-[10px] mono">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-[hsl(var(--neon-lime))]/70" />0–39</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-yellow-400/70" />40–59</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-destructive/70" />60+</span>
          </div>
        </div>

        {/* Топ сетей */}
        <div className="glass rounded-2xl p-6 animate-fade-in" style={{ animationDelay: '0.12s' }}>
          <h2 className="font-display text-base font-semibold mb-4">Активность по сетям</h2>
          <div className="space-y-2.5">
            {DEMO_SUMMARY.swarm.top_networks.map(n => {
              const pct = (n.count / maxNet) * 100;
              const color = NET_COLORS[n.network] || '#8fadff';
              return (
                <div key={n.network}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-medium capitalize">{n.network}</span>
                    <span className="mono text-muted-foreground">{fmtNum(n.count)}</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-secondary/50 overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Live audit feed */}
      <div className="glass rounded-2xl p-6 animate-fade-in" style={{ animationDelay: '0.18s' }}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-display text-base font-semibold">Живая лента аудит-лога</h2>
            <p className="text-xs text-muted-foreground mono">append-only · не редактируется · не удаляется</p>
          </div>
          <div className="flex items-center gap-1.5 text-xs mono neon-lime">
            <span className="w-1.5 h-1.5 rounded-full bg-[hsl(var(--neon-lime))] animate-pulse-glow" /> LIVE
          </div>
        </div>

        {/* Table header */}
        <div className="hidden lg:grid grid-cols-[60px_1fr_160px_120px_160px_120px] gap-3 px-4 py-2 rounded-xl bg-secondary/30 text-[10px] mono text-muted-foreground mb-2">
          <span>#ID</span>
          <span>Компания / Email</span>
          <span>Действие</span>
          <span>IP-адрес</span>
          <span>Детали</span>
          <span className="text-right">Время</span>
        </div>

        <div className="flex flex-col divide-y divide-border/30 max-h-96 overflow-y-auto">
          {liveLog.map((e, idx) => (
            <div
              key={`${e.id}-${idx}`}
              className="grid lg:grid-cols-[60px_1fr_160px_120px_160px_120px] gap-3 items-center px-4 py-3 hover:bg-secondary/20 transition-colors animate-fade-in text-sm"
              style={{ animationDelay: `${idx * 0.02}s` }}
            >
              <span className="mono text-[11px] text-muted-foreground">#{e.id}</span>
              <div className="min-w-0">
                <div className="font-medium text-sm truncate">{e.company_name}</div>
                <div className="text-xs text-muted-foreground truncate">{e.user_email}</div>
              </div>
              <ActionBadge action={e.action} />
              <span className="mono text-[11px] text-muted-foreground hidden lg:block">{e.ip_address}</span>
              <div className="hidden lg:block text-[11px] mono text-muted-foreground truncate">
                {e.details && typeof e.details === 'object'
                  ? Object.entries(e.details).map(([k,v]) => `${k}: ${v}`).join(' · ')
                  : '—'}
              </div>
              <span className="mono text-[11px] text-muted-foreground text-right hidden lg:block">{timeSince(e.created_at)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Transparency comparison */}
      <div className="grid sm:grid-cols-2 gap-4 mt-6 animate-fade-in" style={{ animationDelay: '0.24s' }}>
        <div className="glass rounded-2xl p-6 border border-primary/20">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-primary/15 grid place-items-center">
              <Icon name="Eye" size={16} className="text-primary" />
            </div>
            <span className="font-display font-semibold">MOST — Золотая нода</span>
          </div>
          <ul className="space-y-2.5">
            {[
              'Полный граф маршрута каждого платежа',
              'tx_hash каждого агента роя',
              'Append-only аудит-лог (нельзя изменить)',
              'Открытая методология риск-скоринга',
              'Реальный IP и ИНН отправителя',
              'Детализация до отдельного свап-агента',
            ].map(t => (
              <li key={t} className="flex items-start gap-2 text-sm">
                <Icon name="CheckCircle2" size={14} className="neon-lime mt-0.5 shrink-0" />
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="glass rounded-2xl p-6 border border-destructive/20 opacity-70">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-destructive/15 grid place-items-center">
              <Icon name="EyeOff" size={16} className="text-destructive" />
            </div>
            <span className="font-display font-semibold text-muted-foreground">Chainalysis — внешний анализ</span>
          </div>
          <ul className="space-y-2.5">
            {[
              'Только входная и выходная точки',
              'Нет данных о маршруте',
              'Закрытая (black-box) методология',
              'Нет доступа к внутренним агентам',
              'Нет привязки к юрлицу / ИНН',
              'Ретроспективный анализ (не real-time)',
            ].map(t => (
              <li key={t} className="flex items-start gap-2 text-sm text-muted-foreground">
                <Icon name="XCircle" size={14} className="text-destructive/70 mt-0.5 shrink-0" />
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
