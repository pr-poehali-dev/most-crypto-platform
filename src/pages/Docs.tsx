import PageLayout from '@/components/PageLayout';
import Icon from '@/components/ui/icon';

const ACCENT = '#00FF88';

const CAPABILITIES = [
  {
    icon: 'Zap',
    title: 'Мгновенные переводы',
    color: '#4D9FFF',
    desc: 'Подключите API MOST и предлагайте клиентам трансграничные платежи за 12 секунд. Без корреспондентских счетов и задержек на SWIFT-клиринг.',
  },
  {
    icon: 'Globe',
    title: '20+ блокчейн-сетей',
    color: ACCENT,
    desc: 'Один интеграционный слой покрывает Ethereum, Tron, TON, BNB Chain, Solana и другие сети. Банк не занимается технической интеграцией с каждой сетью по отдельности.',
  },
  {
    icon: 'Shield',
    title: 'Встроенный AML/KYC',
    color: '#FFAA00',
    desc: 'Risk Engine проверяет каждую транзакцию в реальном времени. Все подозрительные операции направляются в очередь compliance-офицера. Банк получает полный audit trail.',
  },
  {
    icon: 'BarChart2',
    title: 'Регуляторная отчётность',
    color: '#A855F7',
    desc: 'Автоматическая генерация отчётов в форматах регуляторов. Полная трассировка каждого платежа — от отправителя до получателя.',
  },
  {
    icon: 'Lock',
    title: 'Белый ярлык',
    color: '#FF6B35',
    desc: 'White-label интеграция: клиент банка видит только ваш бренд. MOST работает в фоне как инфраструктурный слой.',
  },
  {
    icon: 'Headphones',
    title: 'Выделенная поддержка',
    color: '#4D9FFF',
    desc: 'Персональный технический менеджер на этапе интеграции. SLA 99.9%. Горячая линия 24/7 для инцидентов.',
  },
];

const STEPS = [
  { n: '01', title: 'Заявка и NDA',       desc: 'Оставьте заявку. Подпишем NDA и передадим техническую документацию.' },
  { n: '02', title: 'Sandbox-тест',        desc: 'Полнофункциональная тестовая среда. Бесплатно, без реальных средств.' },
  { n: '03', title: 'Юридическое оформление', desc: 'Договор о подключении, согласование с юридической службой.' },
  { n: '04', title: 'Техническая интеграция', desc: 'Наш инженер помогает подключить API. Обычно занимает 1–3 дня.' },
  { n: '05', title: 'Пилот',              desc: 'Запуск на ограниченном числе клиентов. Мониторинг метрик.' },
  { n: '06', title: 'Полный запуск',       desc: 'Масштабирование на всю клиентскую базу.' },
];

const CODE_EXAMPLE = `// Инициализация клиента
const most = new MostClient({
  apiKey:      'your_bank_api_key',
  environment: 'production',
});

// Создание платежа от имени клиента банка
const payment = await most.payments.create({
  amount:             1_000_000,   // в копейках / центах
  fromCurrency:       'RUB',
  toCurrency:         'USDT',
  destinationAddress: '0xRecipient...',
  destinationCountry: 'TR',
  // Ваши данные для reconciliation
  externalRef:        'INVOICE-2026-0042',
  clientId:           'your_client_id',
});

// Статус платежа
console.log(payment.status);       // processing
console.log(payment.risk_score);   // 0–100
console.log(payment.swarm_agents); // количество агентов`;

export default function Docs() {
  return (
    <PageLayout active="/docs">
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '64px 24px' }}>

        {/* Hero */}
        <div style={{ textAlign: 'center', marginBottom: 72 }}>
          <div style={{ display: 'inline-block', padding: '4px 14px', borderRadius: 20, background: 'rgba(0,255,136,0.08)', border: '1px solid rgba(0,255,136,0.2)', fontSize: 12, color: ACCENT, fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.1em', marginBottom: 20 }}>ДЛЯ БАНКОВ</div>
          <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 'clamp(30px,5vw,50px)', fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 16, lineHeight: 1.1 }}>
            Подключите трансграничные<br />платежи к вашему банку
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 17, maxWidth: 560, margin: '0 auto 32px' }}>
            MOST — инфраструктурный слой для банков и финтех-компаний, который добавляет крипто-платежи в 20+ сетях за 1–3 дня интеграции.
          </p>
          <div style={{ display: 'flex', gap: 14, justifyContent: 'center' }}>
            <a href="/contacts" style={{ padding: '14px 30px', borderRadius: 12, background: ACCENT, color: '#0A0A1A', fontWeight: 700, fontSize: 15, textDecoration: 'none' }}>
              Оставить заявку
            </a>
            <a href="/sandbox" style={{ padding: '14px 30px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.2)', color: '#fff', fontWeight: 600, fontSize: 15, textDecoration: 'none' }}>
              Открыть Sandbox
            </a>
          </div>
        </div>

        {/* Что получает банк */}
        <div style={{ marginBottom: 80 }}>
          <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 28, fontWeight: 700, textAlign: 'center', marginBottom: 40 }}>
            Что получает банк
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 18 }}>
            {CAPABILITIES.map(cap => (
              <div key={cap.title} style={{ background: `${cap.color}06`, border: `1px solid ${cap.color}20`, borderRadius: 18, padding: '24px' }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: `${cap.color}18`, display: 'grid', placeItems: 'center', marginBottom: 14 }}>
                  <Icon name={cap.icon} size={20} style={{ color: cap.color }} />
                </div>
                <h3 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 16, fontWeight: 700, marginBottom: 10 }}>{cap.title}</h3>
                <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)', lineHeight: 1.65, margin: 0 }}>{cap.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Этапы подключения */}
        <div style={{ marginBottom: 80 }}>
          <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 28, fontWeight: 700, textAlign: 'center', marginBottom: 40 }}>
            Как проходит подключение
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16 }}>
            {STEPS.map((s, i) => (
              <div key={s.n} style={{ padding: '22px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, position: 'relative' }}>
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 28, fontWeight: 700, color: i < 3 ? ACCENT : 'rgba(255,255,255,0.15)', marginBottom: 12 }}>{s.n}</div>
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 8 }}>{s.title}</div>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', lineHeight: 1.6 }}>{s.desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Пример API */}
        <div style={{ marginBottom: 80 }}>
          <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 28, fontWeight: 700, marginBottom: 16 }}>Пример интеграции</h2>
          <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 15, marginBottom: 24, lineHeight: 1.6, maxWidth: 600 }}>
            REST API с простой аутентификацией по API-ключу. SDK для JavaScript, Python, Go. Время на первый тестовый платёж — около 15 минут.
          </p>
          <div style={{ background: '#050510', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14, overflow: 'hidden' }}>
            <div style={{ padding: '12px 20px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', fontFamily: 'JetBrains Mono, monospace' }}>JavaScript · Bank Integration Example</span>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 10 }}>
                <a href="/api-ref" style={{ fontSize: 12, color: ACCENT, textDecoration: 'none' }}>API Reference →</a>
                <a href="/sandbox" style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', textDecoration: 'none' }}>Открыть Sandbox →</a>
              </div>
            </div>
            <pre style={{ margin: 0, padding: '22px', fontSize: 13, color: '#e2e8f0', fontFamily: 'JetBrains Mono, monospace', lineHeight: 1.65, overflow: 'auto', whiteSpace: 'pre-wrap' }}>
              <code>{CODE_EXAMPLE}</code>
            </pre>
          </div>
        </div>

        {/* Параметры для банков */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 80 }}>
          {[
            { label: 'Скорость интеграции', value: '1–3 дня', icon: 'Zap', color: ACCENT },
            { label: 'Поддержка сетей',     value: '20+',     icon: 'Globe', color: '#4D9FFF' },
            { label: 'Скорость платежа',    value: '12 сек',  icon: 'Timer', color: '#FFAA00' },
            { label: 'Uptime SLA',          value: '99.9%',   icon: 'Activity', color: '#A855F7' },
          ].map(m => (
            <div key={m.label} style={{ padding: '22px', background: `${m.color}08`, border: `1px solid ${m.color}22`, borderRadius: 16, textAlign: 'center' }}>
              <Icon name={m.icon} size={24} style={{ color: m.color, marginBottom: 10 }} />
              <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 26, fontWeight: 700, color: m.color, marginBottom: 6 }}>{m.value}</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>{m.label}</div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div style={{ padding: '48px', background: 'rgba(0,255,136,0.04)', border: '1px solid rgba(0,255,136,0.15)', borderRadius: 24, textAlign: 'center' }}>
          <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 26, fontWeight: 700, marginBottom: 12 }}>
            Готовы обсудить подключение?
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.55)', marginBottom: 28, fontSize: 15, maxWidth: 480, margin: '0 auto 28px' }}>
            Оставьте заявку — технический менеджер свяжется в течение 1 рабочего дня и ответит на все вопросы.
          </p>
          <div style={{ display: 'flex', gap: 14, justifyContent: 'center' }}>
            <a href="/contacts" style={{ padding: '14px 32px', borderRadius: 12, background: ACCENT, color: '#0A0A1A', fontWeight: 700, fontSize: 15, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <Icon name="Mail" size={16} /> Оставить заявку
            </a>
            <a href="/sandbox" style={{ padding: '14px 28px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.2)', color: '#fff', fontWeight: 600, fontSize: 15, textDecoration: 'none' }}>
              Попробовать Sandbox
            </a>
          </div>
          <div style={{ marginTop: 20, fontSize: 13, color: 'rgba(255,255,255,0.35)' }}>
            Или напишите напрямую: <a href="mailto:banks@onemost.ru" style={{ color: ACCENT, textDecoration: 'none' }}>banks@onemost.ru</a>
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
