import { useState, useCallback, useEffect, useRef } from 'react';
import SwarmGlobe, { type SwarmStats } from '@/components/SwarmGlobe';
import Icon from '@/components/ui/icon';

// ─── Константы ───────────────────────────────────────────────────────────────
const ACCENT   = '#00FF88';
const BG       = '#0A0A1A';
const CARD_BOR = 'rgba(0,255,136,0.3)';

// ─── Стиль-хелперы ───────────────────────────────────────────────────────────
const cardStyle: React.CSSProperties = {
  background: 'rgba(0,255,136,0.04)',
  border: `1px solid ${CARD_BOR}`,
  borderRadius: 16,
};

const accentText: React.CSSProperties = { color: ACCENT };
const dimText: React.CSSProperties   = { color: 'rgba(255,255,255,0.55)' };

// ─── Анимированный счётчик ───────────────────────────────────────────────────
function Counter({ end, prefix = '', suffix = '', decimals = 0 }: {
  end: number; prefix?: string; suffix?: string; decimals?: number;
}) {
  const [val, setVal] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const started = useRef(false);

  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !started.current) {
        started.current = true;
        const dur = 1800;
        const start = performance.now();
        const tick = (now: number) => {
          const p = Math.min((now - start) / dur, 1);
          const ease = 1 - Math.pow(1 - p, 3);
          setVal(ease * end);
          if (p < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }
    }, { threshold: 0.2 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, [end]);

  return (
    <span ref={ref}>
      {prefix}{val.toFixed(decimals)}{suffix}
    </span>
  );
}

// ─── Видео-модалка ───────────────────────────────────────────────────────────
function VideoModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(12px)' }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-3xl rounded-2xl overflow-hidden"
        style={{ border: `1px solid ${CARD_BOR}` }}
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.6)', color: '#fff' }}
        >
          <Icon name="X" size={16} />
        </button>
        <div style={{ aspectRatio: '16/9', background: '#0d0d1a', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
          <div style={{ width: 72, height: 72, borderRadius: '50%', background: `${ACCENT}22`, border: `2px solid ${ACCENT}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="Play" size={28} style={{ color: ACCENT, marginLeft: 4 }} />
          </div>
          <p style={{ ...dimText, fontSize: 14 }}>Видеодемо платформы MOST</p>
          <p style={{ ...dimText, fontSize: 12 }}>3 минуты · Полный user flow</p>
        </div>
      </div>
    </div>
  );
}

// ─── Данные ──────────────────────────────────────────────────────────────────
const STEPS = [
  {
    n: '01',
    icon: 'FilePlus',
    title: 'Вы создаёте платёж',
    desc: 'Укажите сумму, валюту и адрес получателя. MOST проверяет KYC/AML автоматически за секунды.',
  },
  {
    n: '02',
    icon: 'GitBranch',
    title: 'MOST разбивает на 1000+ микротранзакций',
    desc: 'Swarm-рой агентов маршрутизирует платёж через 20+ блокчейн-сетей параллельно. Снаружи — некоррелированный шум.',
  },
  {
    n: '03',
    icon: 'CheckCircle2',
    title: 'Получатель видит обычный перевод',
    desc: 'Деньги приходят за <30 секунд в удобной валюте. Без блокировок, без задержек, без объяснений банкам.',
  },
];

const BENEFITS = [
  {
    icon: 'EyeOff',
    title: 'Невидимость для Chainalysis',
    desc: 'Внешний аналитик видит тысячи некоррелированных микротранзакций — паттерн неразличим на фоне рыночного шума.',
  },
  {
    icon: 'Eye',
    title: 'Прозрачность для регулятора',
    desc: 'Золотая нода раскрывает ЦБ полный граф маршрута, tx_hash каждого агента и аудит-лог всех действий.',
  },
  {
    icon: 'Network',
    title: '20+ сетей одновременно',
    desc: 'Ethereum, BSC, Tron, Solana, Bitcoin Lightning, Stellar, TON, Arbitrum, Polygon и ещё 11 сетей.',
  },
  {
    icon: 'Zap',
    title: 'Скорость < 30 секунд',
    desc: 'Любая сумма — от $1K до $100M — доставляется за одинаковое время благодаря параллельной маршрутизации.',
  },
  {
    icon: 'ShieldCheck',
    title: 'AML/KYC встроен',
    desc: 'Автоматическая проверка адресов по санкционным спискам OFAC/SDN. Compliance-офицер одобряет пограничные случаи.',
  },
  {
    icon: 'KeyRound',
    title: 'Безопасность MPC',
    desc: 'Приватные ключи существуют только в момент подписания транзакции. Не хранятся нигде. Мультиподпись 3-из-5.',
  },
];

const PLANS = [
  {
    name: 'Стартовый',
    price: '0.5%',
    priceNote: 'от суммы',
    limit: 'до $1M / мес',
    features: [
      '20+ блокчейн-сетей',
      'AML/KYC автоматический',
      'Поддержка email 24/7',
      'Документация API',
      'Sandbox-среда',
    ],
    cta: 'Начать бесплатно',
    highlight: false,
  },
  {
    name: 'Бизнес',
    price: '0.3%',
    priceNote: 'от суммы',
    limit: 'до $10M / мес',
    features: [
      'Всё из Стартового',
      'Персональный менеджер',
      'SLA 99.9%',
      'Выделенный compliance',
      'Webhook-уведомления',
    ],
    cta: 'Подключить',
    highlight: true,
  },
  {
    name: 'Enterprise',
    price: '0.1%',
    priceNote: 'от суммы',
    limit: 'Без лимита',
    features: [
      'Всё из Бизнес',
      'On-premise установка',
      'Золотая регуляторная нода',
      'Индивидуальный SLA',
      'Аудит безопасности',
    ],
    cta: 'Обсудить условия',
    highlight: false,
  },
];

// ─── Главная страница ─────────────────────────────────────────────────────────
export default function Index() {
  const [swarmStats, setSwarmStats] = useState<SwarmStats>({ active: 55, completed: 0, pct: 0 });
  const [videoOpen, setVideoOpen]   = useState(false);
  const handleStats = useCallback((s: SwarmStats) => setSwarmStats(s), []);

  return (
    <div style={{ background: BG, color: '#fff', minHeight: '100vh', fontFamily: "'Rubik', sans-serif", overflowX: 'hidden' }}>
      {videoOpen && <VideoModal onClose={() => setVideoOpen(false)} />}

      {/* ── NAV ──────────────────────────────────────────────────────────────── */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 40,
        background: 'rgba(10,10,26,0.85)', backdropFilter: 'blur(14px)',
        borderBottom: '1px solid rgba(0,255,136,0.12)',
      }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px', height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: ACCENT, display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 18, color: BG, fontFamily: "'Space Grotesk', sans-serif" }}>M</div>
            <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 20, letterSpacing: '-0.02em' }}>MOST</span>
          </div>
          <div style={{ display: 'flex', gap: 32, alignItems: 'center' }}>
            {['Как работает', 'Преимущества', 'Тарифы'].map(l => (
              <a key={l} href={`#${l}`} style={{ ...dimText, fontSize: 14, textDecoration: 'none', transition: 'color 0.2s' }}
                onMouseEnter={e => (e.currentTarget.style.color = '#fff')}
                onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.55)')}
              >{l}</a>
            ))}
            <a href="/register" style={{
              background: ACCENT, color: BG, padding: '8px 20px', borderRadius: 10,
              fontWeight: 600, fontSize: 14, textDecoration: 'none', transition: 'opacity 0.2s',
            }}
              onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
              onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
            >Подключить</a>
          </div>
        </div>
      </nav>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* 1. HERO                                                               */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <section style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', position: 'relative', overflow: 'hidden' }}>

        {/* Фоновая сетка */}
        <div style={{
          position: 'absolute', inset: 0, opacity: 0.18,
          backgroundImage: `linear-gradient(rgba(0,255,136,0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(0,255,136,0.15) 1px, transparent 1px)`,
          backgroundSize: '48px 48px',
          pointerEvents: 'none',
        }} />

        {/* Радиальные glow */}
        <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse 60% 80% at 70% 50%, rgba(0,255,136,0.07) 0%, transparent 70%)`, pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse 40% 60% at 10% 30%, rgba(98,126,234,0.08) 0%, transparent 60%)`, pointerEvents: 'none' }} />

        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 48, alignItems: 'center', width: '100%', paddingTop: 64, paddingBottom: 64 }}>

          {/* Текст слева */}
          <div style={{ animation: 'fadeUp 0.7s ease both' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(0,255,136,0.1)', border: `1px solid rgba(0,255,136,0.25)`, borderRadius: 24, padding: '6px 14px', marginBottom: 28 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: ACCENT, boxShadow: `0 0 8px ${ACCENT}`, animation: 'pulse 2s infinite' }} />
              <span style={{ fontSize: 11, letterSpacing: '0.18em', ...accentText, fontFamily: 'JetBrains Mono, monospace' }}>
                {swarmStats.active} АГЕНТОВ · {swarmStats.completed.toLocaleString()} TX ВЫПОЛНЕНО
              </span>
            </div>

            <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 'clamp(32px, 4.5vw, 58px)', fontWeight: 700, lineHeight: 1.08, letterSpacing: '-0.03em', marginBottom: 24 }}>
              Международные<br />
              <span style={accentText}>платежи</span><br />
              без блокировок
            </h1>

            <p style={{ fontSize: 17, lineHeight: 1.7, ...dimText, maxWidth: 480, marginBottom: 36 }}>
              MOST разбивает ваш платёж на тысячи микротранзакций через <strong style={{ color: '#fff' }}>20+ блокчейн-сетей</strong>. Внешний наблюдатель видит шум. Ваш контрагент получает деньги за секунды.
            </p>

            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 40 }}>
              <a href="/register" style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                background: ACCENT, color: BG, padding: '14px 28px', borderRadius: 12,
                fontWeight: 700, fontSize: 15, textDecoration: 'none',
                boxShadow: `0 0 24px rgba(0,255,136,0.35)`, transition: 'transform 0.2s, box-shadow 0.2s',
              }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = `0 0 36px rgba(0,255,136,0.5)`; }}
                onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = `0 0 24px rgba(0,255,136,0.35)`; }}
              >
                <Icon name="ArrowUpRight" size={18} /> Подключить платформу
              </a>
              <button
                onClick={() => setVideoOpen(true)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  background: 'transparent', border: `1px solid rgba(255,255,255,0.2)`, color: '#fff',
                  padding: '14px 28px', borderRadius: 12, fontWeight: 600, fontSize: 15, cursor: 'pointer',
                  transition: 'border-color 0.2s, background 0.2s',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = ACCENT; e.currentTarget.style.background = 'rgba(0,255,136,0.06)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'; e.currentTarget.style.background = 'transparent'; }}
              >
                <Icon name="Play" size={18} /> Посмотреть демо
              </button>
            </div>

            {/* Счётчики */}
            <div style={{ display: 'flex', gap: 32, alignItems: 'center' }}>
              <div>
                <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 28, fontWeight: 700, ...accentText }}>
                  $<Counter end={2.4} decimals={1} />B
                </div>
                <div style={{ fontSize: 12, ...dimText, fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.1em' }}>ПРОВЕДЕНО</div>
              </div>
              <div style={{ width: 1, height: 40, background: 'rgba(255,255,255,0.1)' }} />
              <div>
                <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 28, fontWeight: 700, color: '#fff' }}>
                  <Counter end={18.5} decimals={1} />M
                </div>
                <div style={{ fontSize: 12, ...dimText, fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.1em' }}>ТРАНЗАКЦИЙ</div>
              </div>
              <div style={{ width: 1, height: 40, background: 'rgba(255,255,255,0.1)' }} />
              <div>
                <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 28, fontWeight: 700, color: '#fff' }}>
                  20+
                </div>
                <div style={{ fontSize: 12, ...dimText, fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.1em' }}>СЕТЕЙ</div>
              </div>
            </div>
          </div>

          {/* 3D Глобус справа */}
          <div style={{ height: 520, position: 'relative', animation: 'fadeUp 0.9s ease 0.15s both' }}>
            {/* Свечение под глобусом */}
            <div style={{ position: 'absolute', inset: '10%', borderRadius: '50%', background: `radial-gradient(ellipse, rgba(0,255,136,0.12) 0%, transparent 70%)`, filter: 'blur(20px)', pointerEvents: 'none' }} />
            <SwarmGlobe onStats={handleStats} className="w-full h-full" />
          </div>
        </div>

        {/* Скролл-индикатор */}
        <div style={{ position: 'absolute', bottom: 32, left: '50%', transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, animation: 'bounce 2s ease-in-out infinite' }}>
          <span style={{ fontSize: 10, letterSpacing: '0.15em', ...dimText }}>ПРОКРУТИТЬ</span>
          <Icon name="ChevronDown" size={16} style={{ color: ACCENT }} />
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* 2. КАК ЭТО РАБОТАЕТ                                                  */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <section id="Как работает" style={{ padding: '120px 24px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 72 }}>
            <div style={{ fontSize: 11, letterSpacing: '0.2em', ...accentText, fontFamily: 'JetBrains Mono, monospace', marginBottom: 16 }}>КАК ЭТО РАБОТАЕТ</div>
            <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 'clamp(28px, 3.5vw, 44px)', fontWeight: 700, letterSpacing: '-0.02em' }}>
              Три шага до получателя
            </h2>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 32, position: 'relative' }}>
            {/* Соединительная линия */}
            <div style={{
              position: 'absolute', top: 56, left: '20%', right: '20%', height: 1,
              background: `linear-gradient(90deg, transparent, ${ACCENT}40, ${ACCENT}40, transparent)`,
              pointerEvents: 'none',
            }} />

            {STEPS.map((s, i) => (
              <div key={s.n} style={{ ...cardStyle, padding: 36, textAlign: 'center', position: 'relative' }}>
                {/* Номер */}
                <div style={{ position: 'absolute', top: -14, left: 24, background: BG, padding: '0 8px', fontSize: 11, fontFamily: 'JetBrains Mono, monospace', ...accentText }}>{s.n}</div>

                {/* Иконка */}
                <div style={{
                  width: 64, height: 64, borderRadius: 18,
                  background: 'rgba(0,255,136,0.1)', border: `1px solid ${CARD_BOR}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto 24px',
                  boxShadow: i === 1 ? `0 0 24px rgba(0,255,136,0.25)` : 'none',
                }}>
                  <Icon name={s.icon} size={28} style={{ color: ACCENT }} />
                </div>

                <h3 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 18, fontWeight: 600, marginBottom: 12, lineHeight: 1.3 }}>{s.title}</h3>
                <p style={{ ...dimText, fontSize: 14, lineHeight: 1.7 }}>{s.desc}</p>

                {i === 1 && (
                  <div style={{ marginTop: 20, display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap' }}>
                    {['ETH', 'SOL', 'TON', 'TRX', '+17'].map(n => (
                      <span key={n} style={{ fontSize: 10, fontFamily: 'JetBrains Mono, monospace', background: 'rgba(0,255,136,0.1)', border: `1px solid rgba(0,255,136,0.2)`, borderRadius: 6, padding: '3px 8px', ...accentText }}>{n}</span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* 3. ПРЕИМУЩЕСТВА                                                       */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <section id="Преимущества" style={{ padding: '0 24px 120px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 72 }}>
            <div style={{ fontSize: 11, letterSpacing: '0.2em', ...accentText, fontFamily: 'JetBrains Mono, monospace', marginBottom: 16 }}>ПОЧЕМУ MOST</div>
            <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 'clamp(28px, 3.5vw, 44px)', fontWeight: 700, letterSpacing: '-0.02em' }}>
              Одновременно невидим<br />и прозрачен
            </h2>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 24 }}>
            {BENEFITS.map((b, i) => (
              <div
                key={b.title}
                style={{
                  ...cardStyle,
                  padding: '32px 36px',
                  display: 'flex', gap: 24, alignItems: 'flex-start',
                  transition: 'transform 0.25s, box-shadow 0.25s',
                  cursor: 'default',
                }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = `0 8px 32px rgba(0,255,136,0.12)`; }}
                onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; }}
              >
                <div style={{
                  width: 52, height: 52, borderRadius: 14, flexShrink: 0,
                  background: i < 2 ? 'rgba(0,255,136,0.12)' : 'rgba(0,255,136,0.06)',
                  border: `1px solid ${CARD_BOR}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Icon name={b.icon} size={22} style={{ color: ACCENT }} />
                </div>
                <div>
                  <h3 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 17, fontWeight: 600, marginBottom: 8 }}>{b.title}</h3>
                  <p style={{ ...dimText, fontSize: 14, lineHeight: 1.7 }}>{b.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* 4. ТАРИФЫ                                                             */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <section id="Тарифы" style={{ padding: '0 24px 120px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 72 }}>
            <div style={{ fontSize: 11, letterSpacing: '0.2em', ...accentText, fontFamily: 'JetBrains Mono, monospace', marginBottom: 16 }}>ТАРИФЫ</div>
            <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 'clamp(28px, 3.5vw, 44px)', fontWeight: 700, letterSpacing: '-0.02em' }}>
              Прозрачные условия
            </h2>
            <p style={{ ...dimText, fontSize: 16, marginTop: 12 }}>Комиссия только от фактически переведённой суммы</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24 }}>
            {PLANS.map((p) => (
              <div
                key={p.name}
                style={{
                  ...cardStyle,
                  padding: '40px 32px',
                  position: 'relative',
                  border: p.highlight ? `1px solid ${ACCENT}` : `1px solid ${CARD_BOR}`,
                  boxShadow: p.highlight ? `0 0 40px rgba(0,255,136,0.18)` : 'none',
                  transition: 'transform 0.25s',
                }}
                onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-4px)')}
                onMouseLeave={e => (e.currentTarget.style.transform = '')}
              >
                {p.highlight && (
                  <div style={{
                    position: 'absolute', top: -13, left: '50%', transform: 'translateX(-50%)',
                    background: ACCENT, color: BG, fontSize: 11, fontWeight: 700,
                    padding: '4px 16px', borderRadius: 20, whiteSpace: 'nowrap',
                    letterSpacing: '0.08em',
                  }}>ПОПУЛЯРНЫЙ</div>
                )}

                <div style={{ marginBottom: 8, fontSize: 13, ...dimText, letterSpacing: '0.1em', fontFamily: 'JetBrains Mono, monospace' }}>{p.name.toUpperCase()}</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 4 }}>
                  <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 48, fontWeight: 700, ...accentText, lineHeight: 1 }}>{p.price}</span>
                </div>
                <div style={{ fontSize: 13, ...dimText, marginBottom: 6 }}>{p.priceNote}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#fff', marginBottom: 28, padding: '6px 12px', background: 'rgba(255,255,255,0.05)', borderRadius: 8, display: 'inline-block' }}>{p.limit}</div>

                <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 32px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {p.features.map(f => (
                    <li key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 14 }}>
                      <Icon name="Check" size={15} style={{ color: ACCENT, flexShrink: 0, marginTop: 2 }} />
                      <span style={{ color: 'rgba(255,255,255,0.8)' }}>{f}</span>
                    </li>
                  ))}
                </ul>

                <a
                  href="/register"
                  style={{
                    display: 'block', textAlign: 'center', padding: '13px 24px',
                    borderRadius: 12, fontWeight: 600, fontSize: 15, textDecoration: 'none',
                    transition: 'transform 0.2s, opacity 0.2s',
                    background: p.highlight ? ACCENT : 'transparent',
                    color: p.highlight ? BG : '#fff',
                    border: p.highlight ? 'none' : `1px solid rgba(255,255,255,0.25)`,
                  }}
                  onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
                  onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
                >{p.cta}</a>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA-полоса ─────────────────────────────────────────────────────── */}
      <section style={{ padding: '0 24px 120px' }}>
        <div style={{
          maxWidth: 900, margin: '0 auto',
          background: `linear-gradient(135deg, rgba(0,255,136,0.1) 0%, rgba(98,126,234,0.08) 100%)`,
          border: `1px solid ${CARD_BOR}`,
          borderRadius: 24, padding: '64px 48px', textAlign: 'center',
        }}>
          <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 'clamp(24px, 3vw, 38px)', fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 16 }}>
            Готовы к первому платежу?
          </h2>
          <p style={{ ...dimText, fontSize: 16, marginBottom: 36, maxWidth: 480, margin: '0 auto 36px' }}>
            Подключитесь за 15 минут. Первый месяц — без комиссии на сумму до $500K.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <a href="/register" style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              background: ACCENT, color: BG, padding: '14px 32px', borderRadius: 12,
              fontWeight: 700, fontSize: 15, textDecoration: 'none',
              boxShadow: `0 0 28px rgba(0,255,136,0.4)`,
            }}>
              <Icon name="ArrowUpRight" size={18} /> Подключить платформу
            </a>
            <a href="mailto:sales@most.network" style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              border: '1px solid rgba(255,255,255,0.2)', color: '#fff', padding: '14px 32px',
              borderRadius: 12, fontWeight: 600, fontSize: 15, textDecoration: 'none',
            }}>
              <Icon name="Mail" size={18} /> Написать в sales
            </a>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* 5. ФУТЕР                                                              */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <footer style={{
        borderTop: '1px solid rgba(0,255,136,0.12)',
        padding: '48px 24px',
        background: 'rgba(0,0,0,0.3)',
      }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 48, marginBottom: 48 }}>
            {/* Лого */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: ACCENT, display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 18, color: BG, fontFamily: "'Space Grotesk', sans-serif" }}>M</div>
                <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 20 }}>MOST</span>
              </div>
              <p style={{ ...dimText, fontSize: 13, lineHeight: 1.7, maxWidth: 260 }}>
                Платформа трансграничных крипто-платежей с технологией swarm-маршрутизации.
              </p>
            </div>

            {/* Ссылки */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 32 }}>
              {[
                {
                  title: 'Платформа',
                  links: ['О платформе', 'Как работает', 'Безопасность', 'Тарифы'],
                },
                {
                  title: 'Разработчикам',
                  links: ['Документация', 'API Reference', 'SDK', 'Sandbox'],
                },
                {
                  title: 'Компания',
                  links: ['Контакты', 'Политика KYC/AML', 'Условия использования', 'Пресс-кит'],
                },
              ].map(col => (
                <div key={col.title}>
                  <div style={{ fontSize: 11, letterSpacing: '0.15em', ...dimText, fontFamily: 'JetBrains Mono, monospace', marginBottom: 16 }}>{col.title.toUpperCase()}</div>
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {col.links.map(l => (
                      <li key={l}>
                        <a href="#" style={{ ...dimText, fontSize: 14, textDecoration: 'none', transition: 'color 0.2s' }}
                          onMouseEnter={e => (e.currentTarget.style.color = '#fff')}
                          onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.55)')}
                        >{l}</a>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>

          {/* Нижняя строка */}
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <span style={{ ...dimText, fontSize: 13 }}>MOST © 2026. Все права защищены.</span>
            <span style={{
              fontSize: 11, fontFamily: 'JetBrains Mono, monospace',
              background: 'rgba(0,255,136,0.08)', border: `1px solid rgba(0,255,136,0.2)`,
              borderRadius: 6, padding: '4px 12px', ...accentText,
            }}>Лицензировано в рамках ЭПР ЦБ РФ №258-ФЗ</span>
          </div>
        </div>
      </footer>

      {/* ── CSS анимации ─────────────────────────────────────────────────────── */}
      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(24px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.4; }
        }
        @keyframes bounce {
          0%, 100% { transform: translateX(-50%) translateY(0); }
          50%       { transform: translateX(-50%) translateY(6px); }
        }
        @media (max-width: 900px) {
          section > div > div[style*="grid-template-columns: 1fr 1fr"] {
            grid-template-columns: 1fr !important;
          }
          section > div > div[style*="grid-template-columns: repeat(3"] {
            grid-template-columns: 1fr !important;
          }
          section > div > div[style*="grid-template-columns: repeat(2"] {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}
