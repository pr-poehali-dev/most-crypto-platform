import PageLayout from '@/components/PageLayout';
import Icon from '@/components/ui/icon';

const ACCENT = '#00FF88';
const BG     = '#0A0A1A';

const PLANS = [
  {
    name: 'Starter',
    price: '0',
    period: '/мес',
    desc: 'Для малого бизнеса и тестирования',
    color: 'rgba(255,255,255,0.15)',
    highlight: false,
    commission: '0.30%',
    limit: '$100 000',
    features: [
      'До 5 платежей в сутки',
      '5 блокчейн-сетей',
      'Базовый Risk Engine',
      'KYC для 1 компании',
      'Email-поддержка',
      'Sandbox-доступ',
    ],
    cta: 'Начать бесплатно',
    href: '/register',
  },
  {
    name: 'Business',
    price: '299',
    period: '/мес',
    desc: 'Для растущего экспортного бизнеса',
    color: ACCENT,
    highlight: true,
    commission: '0.20%',
    limit: '$1 000 000',
    features: [
      'До 100 платежей в сутки',
      '20+ блокчейн-сетей',
      'Full Risk Engine + AML',
      'KYC до 5 компаний',
      'Swarm-маршрутизация',
      'REST API + Webhooks',
      'Приоритетная поддержка',
      'SLA 99.5%',
    ],
    cta: 'Подключить Business',
    href: '/register',
  },
  {
    name: 'Enterprise',
    price: '999',
    period: '/мес',
    desc: 'Для крупного международного бизнеса',
    color: '#FFD700',
    highlight: false,
    commission: '0.15%',
    limit: '$10 000 000',
    features: [
      'Неограниченные платежи',
      'Все 20+ сетей',
      'Выделенный compliance-менеджер',
      'White-label решение',
      'On-premise вариант',
      'SDK (Python, JS, Go)',
      'Кастомные AML-правила',
      'SLA 99.9%',
      '24/7 телефонная поддержка',
    ],
    cta: 'Обсудить условия',
    href: '/contacts',
  },
];

const COMPARE = [
  { feature: 'Дневной лимит',         s: '$100K',    b: '$1M',      e: '$10M' },
  { feature: 'Блокчейн-сети',         s: '5',        b: '20+',      e: 'Все' },
  { feature: 'Комиссия',              s: '0.30%',    b: '0.20%',    e: '0.15%' },
  { feature: 'Платежей в сутки',      s: '5',        b: '100',      e: 'Без лимита' },
  { feature: 'API-доступ',            s: '—',        b: '✓',        e: '✓' },
  { feature: 'SDK',                   s: '—',        b: '—',        e: '✓' },
  { feature: 'Swarm-маршрутизация',   s: '—',        b: '✓',        e: '✓' },
  { feature: 'White-label',           s: '—',        b: '—',        e: '✓' },
  { feature: 'SLA',                   s: '—',        b: '99.5%',    e: '99.9%' },
  { feature: 'Поддержка',             s: 'Email',    b: 'Приоритет', e: '24/7 Phone' },
];

const FAQ = [
  {
    q: 'Есть ли скрытые комиссии?',
    a: 'Нет. Вы платите только указанную абонентскую плату и комиссию с транзакций. Gas-fees включены в комиссию на тарифах Business и Enterprise.',
  },
  {
    q: 'Можно ли сменить тариф в любой момент?',
    a: 'Да, повышение тарифа происходит мгновенно. Понижение — с начала следующего расчётного периода.',
  },
  {
    q: 'Как считается комиссия?',
    a: 'Комиссия берётся от суммы исходящего платежа в момент отправки. Для Enterprise — индивидуальный расчёт от суммарного месячного оборота.',
  },
  {
    q: 'Что такое KYC-лимит?',
    a: 'Количество юридических лиц (компаний), которые можно верифицировать в рамках одного аккаунта. На Enterprise — без ограничений.',
  },
  {
    q: 'Есть ли пробный период для Business?',
    a: 'Да — 14 дней бесплатно при первом подключении. Без привязки карты.',
  },
];

export default function Pricing() {
  return (
    <PageLayout active="/pricing">
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '64px 24px' }}>

        {/* Hero */}
        <div style={{ textAlign: 'center', marginBottom: 64 }}>
          <div style={{ display: 'inline-block', padding: '4px 14px', borderRadius: 20, background: 'rgba(0,255,136,0.08)', border: '1px solid rgba(0,255,136,0.2)', fontSize: 12, color: ACCENT, fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.1em', marginBottom: 20 }}>
            ТАРИФНЫЕ ПЛАНЫ
          </div>
          <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 'clamp(32px,5vw,52px)', fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 16, lineHeight: 1.1 }}>
            Прозрачные цены.<br />Без скрытых комиссий.
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 17, maxWidth: 520, margin: '0 auto' }}>
            Выберите план под объём платежей. Смена тарифа — в один клик.
          </p>
        </div>

        {/* Карточки */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 20, marginBottom: 80 }}>
          {PLANS.map(p => (
            <div key={p.name} style={{ background: p.highlight ? `linear-gradient(135deg, rgba(0,255,136,0.07), rgba(0,255,136,0.02))` : 'rgba(255,255,255,0.02)', border: `1px solid ${p.highlight ? 'rgba(0,255,136,0.35)' : 'rgba(255,255,255,0.08)'}`, borderRadius: 20, padding: '32px 28px', position: 'relative', display: 'flex', flexDirection: 'column' }}>
              {p.highlight && (
                <div style={{ position: 'absolute', top: -13, left: '50%', transform: 'translateX(-50%)', background: ACCENT, color: BG, fontSize: 11, fontWeight: 700, padding: '4px 14px', borderRadius: 20, whiteSpace: 'nowrap' }}>ПОПУЛЯРНЫЙ</div>
              )}
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', marginBottom: 6 }}>{p.name}</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 8 }}>
                  <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 42, fontWeight: 700, color: p.highlight ? ACCENT : '#fff' }}>${p.price}</span>
                  <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>{p.period}</span>
                </div>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: 12 }}>{p.desc}</div>
                <div style={{ display: 'flex', gap: 16 }}>
                  <div style={{ fontSize: 12, padding: '4px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.6)' }}>
                    Комиссия: <strong style={{ color: p.highlight ? ACCENT : '#fff' }}>{p.commission}</strong>
                  </div>
                  <div style={{ fontSize: 12, padding: '4px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.6)' }}>
                    Лимит: <strong style={{ color: p.highlight ? ACCENT : '#fff' }}>{p.limit}/сут</strong>
                  </div>
                </div>
              </div>
              <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 28px', display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
                {p.features.map(f => (
                  <li key={f} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, color: 'rgba(255,255,255,0.8)' }}>
                    <Icon name="Check" size={15} style={{ color: p.highlight ? ACCENT : 'rgba(255,255,255,0.4)', flexShrink: 0 }} />
                    {f}
                  </li>
                ))}
              </ul>
              <a href={p.href} style={{ display: 'block', textAlign: 'center', padding: '13px', borderRadius: 12, background: p.highlight ? ACCENT : 'transparent', border: `1px solid ${p.highlight ? 'transparent' : 'rgba(255,255,255,0.15)'}`, color: p.highlight ? BG : '#fff', fontWeight: 700, fontSize: 15, textDecoration: 'none', transition: 'all 0.2s' }}
                onMouseEnter={e => { if (!p.highlight) e.currentTarget.style.borderColor = ACCENT; }}
                onMouseLeave={e => { if (!p.highlight) e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'; }}>
                {p.cta}
              </a>
            </div>
          ))}
        </div>

        {/* Сравнение */}
        <div style={{ marginBottom: 80 }}>
          <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 28, fontWeight: 700, textAlign: 'center', marginBottom: 32 }}>Сравнение тарифов</h2>
          <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', padding: '14px 24px', background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.08)', fontSize: 12, color: 'rgba(255,255,255,0.4)', fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.08em' }}>
              <span>ПАРАМЕТР</span><span style={{ textAlign: 'center' }}>STARTER</span><span style={{ textAlign: 'center', color: ACCENT }}>BUSINESS</span><span style={{ textAlign: 'center', color: '#FFD700' }}>ENTERPRISE</span>
            </div>
            {COMPARE.map((row, i) => (
              <div key={row.feature} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', padding: '13px 24px', borderBottom: i < COMPARE.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none', alignItems: 'center' }}>
                <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.8)' }}>{row.feature}</span>
                <span style={{ textAlign: 'center', fontSize: 13, color: row.s === '—' ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.6)', fontFamily: 'JetBrains Mono, monospace' }}>{row.s}</span>
                <span style={{ textAlign: 'center', fontSize: 13, color: row.b === '—' ? 'rgba(255,255,255,0.2)' : ACCENT, fontFamily: 'JetBrains Mono, monospace', fontWeight: row.b !== '—' ? 600 : 400 }}>{row.b}</span>
                <span style={{ textAlign: 'center', fontSize: 13, color: '#FFD700', fontFamily: 'JetBrains Mono, monospace', fontWeight: 600 }}>{row.e}</span>
              </div>
            ))}
          </div>
        </div>

        {/* FAQ */}
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 28, fontWeight: 700, textAlign: 'center', marginBottom: 40 }}>Частые вопросы</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {FAQ.map(f => (
              <details key={f.q} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, overflow: 'hidden' }}>
                <summary style={{ padding: '16px 20px', cursor: 'pointer', fontSize: 15, fontWeight: 600, listStyle: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  {f.q}
                  <Icon name="ChevronDown" size={16} style={{ color: 'rgba(255,255,255,0.4)', flexShrink: 0 }} />
                </summary>
                <div style={{ padding: '0 20px 18px', fontSize: 14, color: 'rgba(255,255,255,0.6)', lineHeight: 1.6 }}>{f.a}</div>
              </details>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div style={{ marginTop: 80, textAlign: 'center', padding: '48px', background: 'rgba(0,255,136,0.04)', border: '1px solid rgba(0,255,136,0.15)', borderRadius: 24 }}>
          <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 28, fontWeight: 700, marginBottom: 12 }}>Остались вопросы?</h2>
          <p style={{ color: 'rgba(255,255,255,0.55)', marginBottom: 24 }}>Наша команда подберёт оптимальный тариф под ваш объём.</p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            <a href="/contacts" style={{ padding: '13px 28px', borderRadius: 12, background: ACCENT, color: BG, fontWeight: 700, fontSize: 15, textDecoration: 'none' }}>Связаться с нами</a>
            <a href="/register" style={{ padding: '13px 28px', borderRadius: 12, background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', fontWeight: 600, fontSize: 15, textDecoration: 'none' }}>Попробовать бесплатно</a>
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
