import { useState } from 'react';
import Icon from '@/components/ui/icon';

const HERO_BG = 'https://cdn.poehali.dev/projects/573c75be-a606-4ed0-96a4-1601ddf0b628/files/f06d5535-6d56-4b82-8a44-4fa83cef2352.jpg';

const NAV = [
  { id: 'home', label: 'Главная', icon: 'LayoutDashboard' },
  { id: 'send', label: 'Отправить', icon: 'ArrowUpRight' },
  { id: 'receive', label: 'Получить', icon: 'ArrowDownLeft' },
  { id: 'history', label: 'История', icon: 'History' },
  { id: 'wallets', label: 'Кошельки', icon: 'Wallet' },
  { id: 'networks', label: 'Сети', icon: 'Network' },
  { id: 'analytics', label: 'Аналитика', icon: 'BarChart3' },
  { id: 'profile', label: 'Профиль', icon: 'UserRound' },
];

const NETWORKS = [
  { name: 'Ethereum', sym: 'ETH', color: '#8fadff', tps: 32, ok: true },
  { name: 'BNB Chain', sym: 'BSC', color: '#f3ba2f', tps: 148, ok: true },
  { name: 'Polygon', sym: 'MATIC', color: '#a06bff', tps: 210, ok: true },
  { name: 'Tron', sym: 'TRX', color: '#ff3b3b', tps: 96, ok: true },
  { name: 'Solana', sym: 'SOL', color: '#42fff0', tps: 2400, ok: true },
  { name: 'Bitcoin', sym: 'BTC', color: '#ff9d3b', tps: 7, ok: true },
  { name: 'Lightning', sym: 'LN', color: '#f7e35b', tps: 9000, ok: true },
  { name: 'Stellar', sym: 'XLM', color: '#7ee0ff', tps: 1000, ok: true },
  { name: 'TON', sym: 'TON', color: '#39a0ff', tps: 550, ok: true },
  { name: 'Arbitrum', sym: 'ARB', color: '#39c6ff', tps: 340, ok: true },
  { name: 'Optimism', sym: 'OP', color: '#ff5f6d', tps: 300, ok: false },
  { name: 'Avalanche', sym: 'AVAX', color: '#ff5252', tps: 420, ok: true },
];

const TX = [
  { dir: 'out', title: 'Перевод в Solana', net: 'SOL', addr: '0x7a3f…9c2b', amount: '−1 240.00', usd: '$1 240', status: 'Подтверждено', parts: '6/6' },
  { dir: 'in', title: 'Приём из Ethereum', net: 'ETH', addr: '0x1b8e…4f0a', amount: '+0.842', usd: '$2 980', status: 'Подтверждено', parts: '4/4' },
  { dir: 'out', title: 'Swarm-маршрут → TON', net: 'TON', addr: 'EQ9d…7hK1', amount: '−980.50', usd: '$980', status: 'В пути', parts: '3/5' },
  { dir: 'in', title: 'Приём из Lightning', net: 'LN', addr: 'lnbc…q4z', amount: '+0.015', usd: '$640', status: 'Подтверждено', parts: '1/1' },
];

const SECURITY = [
  { icon: 'KeyRound', title: 'Мультиподпись', value: '3 из 5', note: 'Аппаратные ключи активны' },
  { icon: 'Snowflake', title: 'Холодный кошелёк', value: '82%', note: 'Средств в холодном хранении' },
  { icon: 'ShieldAlert', title: 'Риск-анализ', value: 'Low', note: 'Скоринг последней операции 12/100' },
];

function StatusChip({ ok }: { ok: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs mono ${ok ? 'neon-lime' : 'text-destructive'}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${ok ? 'bg-[hsl(var(--neon-lime))]' : 'bg-destructive'} ${ok ? 'animate-pulse-glow' : ''}`} />
      {ok ? 'online' : 'degraded'}
    </span>
  );
}

const Index = () => {
  const [active, setActive] = useState('home');

  return (
    <div className="min-h-screen flex text-foreground">
      {/* Sidebar */}
      <aside className="hidden lg:flex flex-col w-64 shrink-0 glass sticky top-0 h-screen px-4 py-6 gap-2">
        <div className="flex items-center gap-3 px-2 mb-8">
          <div className="w-10 h-10 rounded-xl grid place-items-center bg-primary text-primary-foreground font-display font-bold text-lg glow-cyan">M</div>
          <div>
            <div className="font-display font-bold text-xl tracking-tight leading-none">MOST</div>
            <div className="text-[10px] mono text-muted-foreground tracking-widest">SWARM NETWORK</div>
          </div>
        </div>
        <nav className="flex flex-col gap-1">
          {NAV.map((n) => (
            <button
              key={n.id}
              onClick={() => setActive(n.id)}
              className={`group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
                active === n.id
                  ? 'bg-primary/10 text-primary border border-primary/30'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60 border border-transparent'
              }`}
            >
              <Icon name={n.icon} size={18} />
              <span className="font-medium">{n.label}</span>
              {active === n.id && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-primary animate-pulse-glow" />}
            </button>
          ))}
        </nav>
        <div className="mt-auto glass rounded-xl p-4">
          <div className="flex items-center gap-2 text-xs mono neon-lime mb-1">
            <Icon name="Zap" size={14} /> SWARM АКТИВЕН
          </div>
          <div className="text-xs text-muted-foreground">3 агента маршрутизируют платежи по 20 сетям</div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 min-w-0">
        {/* Top ticker */}
        <div className="overflow-hidden border-b border-border/60 bg-background/40 backdrop-blur">
          <div className="flex whitespace-nowrap animate-ticker py-2">
            {[...NETWORKS, ...NETWORKS].map((n, i) => (
              <span key={i} className="mx-6 text-xs mono text-muted-foreground">
                <span style={{ color: n.color }}>●</span> {n.sym} <span className="text-foreground">{n.tps} tps</span>
              </span>
            ))}
          </div>
        </div>

        <div className="p-5 sm:p-8 max-w-[1200px] mx-auto">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-3 mb-6">
            <div className="w-9 h-9 rounded-lg grid place-items-center bg-primary text-primary-foreground font-display font-bold glow-cyan">M</div>
            <span className="font-display font-bold text-lg">MOST</span>
          </div>

          {/* Hero */}
          <section className="relative overflow-hidden rounded-3xl border border-primary/25 grid-noise animate-scale-in mb-6">
            <img src={HERO_BG} alt="" className="absolute inset-0 w-full h-full object-cover opacity-40" />
            <div className="absolute inset-0 bg-gradient-to-r from-background via-background/85 to-background/30" />
            <div className="relative p-7 sm:p-10">
              <div className="text-xs mono neon-cyan tracking-widest mb-3 animate-fade-in">● МУЛЬТИСЕТЕВОЙ БАЛАНС</div>
              <div className="flex flex-wrap items-end gap-4 animate-fade-in" style={{ animationDelay: '0.1s' }}>
                <h1 className="font-display text-5xl sm:text-6xl font-bold tracking-tight text-glow">$184 920</h1>
                <span className="mono text-sm neon-lime mb-2">+4.8% за 24ч</span>
              </div>
              <p className="text-muted-foreground mt-3 max-w-md animate-fade-in" style={{ animationDelay: '0.2s' }}>
                Единый счёт для отправки и приёма крипто-платежей в 20 сетях с интеллектуальной swarm-маршрутизацией.
              </p>
              <div className="flex flex-wrap gap-3 mt-6 animate-fade-in" style={{ animationDelay: '0.3s' }}>
                <button className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-primary text-primary-foreground font-semibold glow-cyan hover-scale">
                  <Icon name="ArrowUpRight" size={18} /> Отправить
                </button>
                <button className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-secondary text-foreground font-semibold border border-border hover-scale">
                  <Icon name="ArrowDownLeft" size={18} /> Получить
                </button>
                <button className="inline-flex items-center gap-2 px-5 py-3 rounded-xl glass text-foreground font-semibold hover-scale">
                  <Icon name="Repeat" size={18} /> Обмен
                </button>
              </div>
            </div>
          </section>

          {/* Stat cards */}
          <section className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {[
              { icon: 'Network', label: 'Активных сетей', value: '20', accent: 'neon-cyan' },
              { icon: 'Boxes', label: 'Swarm-агентов', value: '3', accent: 'neon-lime' },
              { icon: 'ArrowLeftRight', label: 'Транзакций 24ч', value: '1 284', accent: 'neon-cyan' },
              { icon: 'Gauge', label: 'Средняя комиссия', value: '0.12%', accent: 'neon-lime' },
            ].map((s, i) => (
              <div key={s.label} className="glass rounded-2xl p-5 hover-scale animate-fade-in" style={{ animationDelay: `${0.1 * i}s` }}>
                <div className="flex items-center justify-between mb-4">
                  <Icon name={s.icon} size={20} className={s.accent} />
                  <Icon name="TrendingUp" size={14} className="text-muted-foreground" />
                </div>
                <div className={`font-display text-2xl font-bold ${s.accent}`}>{s.value}</div>
                <div className="text-xs text-muted-foreground mt-1">{s.label}</div>
              </div>
            ))}
          </section>

          <div className="grid lg:grid-cols-3 gap-6">
            {/* Swarm visualization */}
            <section className="lg:col-span-2 glass rounded-2xl p-6 grid-noise relative overflow-hidden animate-fade-in">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="font-display text-lg font-semibold">Swarm-маршрутизация</h2>
                  <p className="text-xs text-muted-foreground mono">платёж разбит на 5 частей · 3 в пути</p>
                </div>
                <span className="text-xs mono neon-lime flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[hsl(var(--neon-lime))] animate-pulse-glow" /> LIVE
                </span>
              </div>

              <svg viewBox="0 0 520 220" className="w-full h-auto">
                <line x1="60" y1="110" x2="460" y2="110" stroke="hsl(var(--border))" strokeWidth="1" />
                {([[210, 40], [300, 80], [250, 150], [360, 170]] as [number, number][]).map(([x, y], i) => (
                  <g key={i}>
                    <path
                      d={`M60 110 Q ${x} ${y} 460 110`}
                      fill="none"
                      stroke="hsl(var(--neon-cyan))"
                      strokeWidth="1.5"
                      strokeDasharray="6 8"
                      opacity={0.55}
                      style={{ animation: `dash-flow ${1.6 + i * 0.4}s linear infinite` }}
                    />
                  </g>
                ))}
                {([[210, 40], [300, 80], [250, 150], [360, 170]] as [number, number][]).map(([x, y], i) => (
                  <circle key={i} cx={x} cy={y} r="6" fill="hsl(var(--neon-lime))" opacity="0.9">
                    <animate attributeName="r" values="5;8;5" dur={`${2 + i * 0.3}s`} repeatCount="indefinite" />
                  </circle>
                ))}
                <g>
                  <circle cx="60" cy="110" r="16" fill="hsl(var(--primary))" />
                  <text x="60" y="115" textAnchor="middle" fontSize="11" fontWeight="700" fill="hsl(var(--primary-foreground))">SRC</text>
                </g>
                <g>
                  <circle cx="460" cy="110" r="16" fill="hsl(var(--accent))" />
                  <text x="460" y="115" textAnchor="middle" fontSize="11" fontWeight="700" fill="hsl(var(--accent-foreground))">DST</text>
                </g>
              </svg>

              <div className="grid grid-cols-3 gap-3 mt-4">
                {[
                  { l: 'Всего частей', v: '5' },
                  { l: 'Завершено', v: '3' },
                  { l: 'ETA', v: '~42 сек' },
                ].map((x) => (
                  <div key={x.l} className="bg-secondary/50 rounded-xl p-3 text-center">
                    <div className="font-display text-xl font-bold neon-cyan">{x.v}</div>
                    <div className="text-[11px] text-muted-foreground">{x.l}</div>
                  </div>
                ))}
              </div>
            </section>

            {/* Security */}
            <section className="glass rounded-2xl p-6 animate-fade-in" style={{ animationDelay: '0.1s' }}>
              <h2 className="font-display text-lg font-semibold mb-1">Безопасность</h2>
              <p className="text-xs text-muted-foreground mono mb-5">защита средств в реальном времени</p>
              <div className="flex flex-col gap-3">
                {SECURITY.map((s) => (
                  <div key={s.title} className="flex items-start gap-3 p-3 rounded-xl bg-secondary/40 border border-border/60 hover-scale">
                    <div className="w-9 h-9 rounded-lg grid place-items-center bg-primary/10 text-primary shrink-0">
                      <Icon name={s.icon} size={18} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{s.title}</span>
                        <span className="mono text-xs neon-lime">{s.value}</span>
                      </div>
                      <div className="text-xs text-muted-foreground truncate">{s.note}</div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* History */}
            <section className="lg:col-span-2 glass rounded-2xl p-6 animate-fade-in">
              <div className="flex items-center justify-between mb-5">
                <h2 className="font-display text-lg font-semibold">История транзакций</h2>
                <button className="text-xs mono neon-cyan hover:underline flex items-center gap-1">
                  все <Icon name="ChevronRight" size={14} />
                </button>
              </div>
              <div className="flex flex-col divide-y divide-border/50">
                {TX.map((t, i) => (
                  <div key={i} className="flex items-center gap-3 py-3 hover:bg-secondary/30 -mx-2 px-2 rounded-lg transition-colors">
                    <div className={`w-9 h-9 rounded-lg grid place-items-center shrink-0 ${t.dir === 'in' ? 'bg-[hsl(var(--neon-lime))]/10 neon-lime' : 'bg-primary/10 text-primary'}`}>
                      <Icon name={t.dir === 'in' ? 'ArrowDownLeft' : 'ArrowUpRight'} size={18} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium truncate">{t.title}</div>
                      <div className="text-xs mono text-muted-foreground truncate">{t.addr} · {t.parts} частей</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className={`mono text-sm font-semibold ${t.dir === 'in' ? 'neon-lime' : 'text-foreground'}`}>{t.amount}</div>
                      <div className="text-[11px] text-muted-foreground">{t.usd}</div>
                    </div>
                    <span className={`hidden sm:inline text-[11px] mono px-2 py-1 rounded-md ${t.status === 'В пути' ? 'bg-primary/10 text-primary' : 'bg-[hsl(var(--neon-lime))]/10 neon-lime'}`}>
                      {t.status}
                    </span>
                  </div>
                ))}
              </div>
            </section>

            {/* Networks */}
            <section className="glass rounded-2xl p-6 animate-fade-in" style={{ animationDelay: '0.1s' }}>
              <div className="flex items-center justify-between mb-5">
                <h2 className="font-display text-lg font-semibold">Сети</h2>
                <span className="text-xs mono text-muted-foreground">20 активно</span>
              </div>
              <div className="flex flex-col gap-2.5 max-h-[320px] overflow-y-auto pr-1">
                {NETWORKS.map((n) => (
                  <div key={n.sym} className="flex items-center gap-3 p-2 rounded-lg hover:bg-secondary/40 transition-colors">
                    <span className="w-7 h-7 rounded-full grid place-items-center text-[10px] mono font-bold shrink-0" style={{ background: `${n.color}22`, color: n.color }}>
                      {n.sym.slice(0, 3)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium truncate">{n.name}</div>
                      <div className="text-[11px] mono text-muted-foreground">{n.tps} tps</div>
                    </div>
                    <StatusChip ok={n.ok} />
                  </div>
                ))}
              </div>
            </section>
          </div>

          <footer className="mt-10 pb-6 text-center">
            <div className="text-xs mono text-muted-foreground">MOST · SWARM PAYMENT NETWORK · 20 CHAINS · v0.1</div>
          </footer>
        </div>
      </main>
    </div>
  );
};

export default Index;
