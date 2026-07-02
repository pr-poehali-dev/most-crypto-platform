import PageLayout from '@/components/PageLayout';
import Icon from '@/components/ui/icon';

const ACCENT = '#00FF88';

const PILLARS = [
  {
    icon: 'Shield',
    title: 'AML / KYC',
    color: '#4D9FFF',
    desc: 'Все клиенты проходят верификацию личности и компании согласно международным стандартам FATF. Платежи проверяются в реальном времени по базам OFAC, EU, UN.',
    points: ['FATF-совместимый KYC', 'Проверка по санкционным спискам OFAC/SDN', 'Мониторинг подозрительных паттернов', 'Автоматическая блокировка высокорисковых адресов'],
  },
  {
    icon: 'Lock',
    title: 'Шифрование данных',
    color: ACCENT,
    desc: 'Все данные передаются и хранятся в зашифрованном виде. Приватные ключи кошельков хранятся в HSM (Hardware Security Module) и никогда не покидают защищённую среду.',
    points: ['TLS 1.3 для всех соединений', 'AES-256 для данных в покое', 'HSM для хранения ключей', 'Zero-knowledge архитектура для маршрутов'],
  },
  {
    icon: 'Eye',
    title: 'Мониторинг 24/7',
    color: '#FFAA00',
    desc: 'Система мониторинга анализирует каждую транзакцию в реальном времени. Аномальная активность немедленно блокируется и эскалируется compliance-офицеру.',
    points: ['Risk Engine работает в реальном времени', 'ML-модели для обнаружения аномалий', 'Автоматическая заморозка при обнаружении угрозы', 'Полный аудит-лог всех действий'],
  },
  {
    icon: 'Building',
    title: 'Регуляторное соответствие',
    color: '#A855F7',
    desc: 'MOST работает в рамках Экспериментального правового режима ЦБ РФ №258-ФЗ. Регулятор имеет полный доступ к данным маршрутизации через выделенный портал.',
    points: ['Лицензия ЦБ РФ (ЭПР №258-ФЗ)', 'Полная прозрачность для регулятора', 'Регуляторный портал с real-time данными', 'Ежеквартальная отчётность'],
  },
];

const CERTS = [
  { name: 'ISO 27001',        desc: 'Информационная безопасность',   color: '#4D9FFF'  },
  { name: 'SOC 2 Type II',    desc: 'Операционный аудит',             color: ACCENT     },
  { name: 'FATF Compliant',   desc: 'Стандарты AML',                  color: '#FFAA00'  },
  { name: 'GDPR',             desc: 'Защита персональных данных',      color: '#A855F7'  },
  { name: 'PCI DSS',          desc: 'Платёжные данные',               color: '#FF6B35'  },
  { name: 'ЦБ РФ ЭПР',        desc: '№258-ФЗ',                       color: '#FF4444'  },
];

const INCIDENT_RESPONSE = [
  { time: '< 30 сек', event: 'Автоматическое обнаружение аномалии Risk Engine' },
  { time: '< 2 мин',  event: 'Заморозка подозрительной транзакции' },
  { time: '< 15 мин', event: 'Уведомление compliance-команды' },
  { time: '< 1 час',  event: 'Расследование и решение' },
  { time: '< 24 час', event: 'Отчёт для регулятора' },
];

export default function Security() {
  return (
    <PageLayout active="/security">
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '64px 24px' }}>

        {/* Hero */}
        <div style={{ textAlign: 'center', marginBottom: 72 }}>
          <div style={{ display: 'inline-block', padding: '4px 14px', borderRadius: 20, background: 'rgba(0,255,136,0.08)', border: '1px solid rgba(0,255,136,0.2)', fontSize: 12, color: ACCENT, fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.1em', marginBottom: 20 }}>БЕЗОПАСНОСТЬ</div>
          <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 'clamp(32px,5vw,52px)', fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 16, lineHeight: 1.1 }}>
            Безопасность —<br />наш главный продукт
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 17, maxWidth: 560, margin: '0 auto' }}>
            MOST построен на принципе security-first: каждый слой архитектуры спроектирован с учётом защиты данных и противодействия финансовым преступлениям.
          </p>
        </div>

        {/* 4 столпа */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 20, marginBottom: 72 }}>
          {PILLARS.map(p => (
            <div key={p.title} style={{ background: `${p.color}06`, border: `1px solid ${p.color}22`, borderRadius: 20, padding: '28px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: `${p.color}18`, border: `1px solid ${p.color}33`, display: 'grid', placeItems: 'center' }}>
                  <Icon name={p.icon} size={20} style={{ color: p.color }} />
                </div>
                <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 20, fontWeight: 700, margin: 0 }}>{p.title}</h2>
              </div>
              <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14, lineHeight: 1.7, marginBottom: 16 }}>{p.desc}</p>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {p.points.map(pt => (
                  <li key={pt} style={{ display: 'flex', gap: 9, fontSize: 13, color: 'rgba(255,255,255,0.75)', alignItems: 'flex-start' }}>
                    <Icon name="Check" size={14} style={{ color: p.color, flexShrink: 0, marginTop: 1 }} />
                    {pt}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Сертификаты */}
        <div style={{ marginBottom: 72 }}>
          <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 28, fontWeight: 700, textAlign: 'center', marginBottom: 32 }}>Сертификаты и лицензии</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14 }}>
            {CERTS.map(c => (
              <div key={c.name} style={{ padding: '20px 24px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: `${c.color}18`, border: `1px solid ${c.color}33`, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                  <Icon name="Award" size={18} style={{ color: c.color }} />
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 3 }}>{c.name}</div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>{c.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Incident Response */}
        <div style={{ marginBottom: 72 }}>
          <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 28, fontWeight: 700, textAlign: 'center', marginBottom: 32 }}>Реакция на инциденты</h2>
          <div style={{ maxWidth: 640, margin: '0 auto' }}>
            {INCIDENT_RESPONSE.map((ir, i) => (
              <div key={i} style={{ display: 'flex', gap: 20, marginBottom: 16, alignItems: 'flex-start' }}>
                <div style={{ width: 72, flexShrink: 0, padding: '6px 10px', borderRadius: 8, background: 'rgba(0,255,136,0.08)', border: '1px solid rgba(0,255,136,0.2)', textAlign: 'center', fontSize: 12, fontWeight: 700, color: ACCENT, fontFamily: 'JetBrains Mono, monospace' }}>{ir.time}</div>
                <div style={{ flex: 1, padding: '6px 0', fontSize: 14, color: 'rgba(255,255,255,0.75)', display: 'flex', alignItems: 'center', borderBottom: i < INCIDENT_RESPONSE.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none', paddingBottom: 16 }}>
                  {ir.event}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Ответственное раскрытие */}
        <div style={{ padding: '36px', background: 'rgba(0,255,136,0.04)', border: '1px solid rgba(0,255,136,0.15)', borderRadius: 20, textAlign: 'center' }}>
          <Icon name="Bug" size={36} style={{ color: ACCENT, marginBottom: 14 }} />
          <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 22, fontWeight: 700, marginBottom: 10 }}>Нашли уязвимость?</h2>
          <p style={{ color: 'rgba(255,255,255,0.55)', maxWidth: 480, margin: '0 auto 20px', lineHeight: 1.6 }}>
            У нас есть программа Bug Bounty. Сообщите об уязвимости — мы вознаградим вас за ответственное раскрытие.
          </p>
          <a href="mailto:security@most.network" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 24px', borderRadius: 12, background: ACCENT, color: '#0A0A1A', fontWeight: 700, fontSize: 14, textDecoration: 'none' }}>
            <Icon name="Mail" size={15} /> security@most.network
          </a>
        </div>
      </div>
    </PageLayout>
  );
}
