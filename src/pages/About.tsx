import PageLayout from '@/components/PageLayout';
import Icon from '@/components/ui/icon';

const ACCENT = '#00FF88';

const TEAM = [
  { name: 'Александр Воронов', role: 'CEO & Co-founder', bg: '#4D9FFF', desc: 'Экс-VP Goldman Sachs Moscow. 15 лет в международных финансах.' },
  { name: 'Михаил Степанов', role: 'CTO & Co-founder', bg: ACCENT, desc: 'PhD Computer Science, MIT. Разработал protcol-level routing в 3 DeFi-протоколах.' },
  { name: 'Елена Ковалёва', role: 'Chief Compliance Officer', bg: '#FFAA00', desc: 'Экс-глава AML-отдела Сбербанка. Эксперт ЦБ РФ по криптоактивам.' },
  { name: 'Дмитрий Орлов', role: 'Head of Engineering', bg: '#A855F7', desc: '10+ лет в distributed systems. Экс-Binance, экс-Chainlink.' },
];

const TIMELINE = [
  { year: '2022', title: 'Основание', desc: 'Александр и Михаил встретились в Y Combinator. Первый прототип Swarm Router за 48 часов хакатона.' },
  { year: '2023', title: 'Seed раунд', desc: '$4.5M от Andreessen Horowitz и Sequoia Capital. Набрана команда из 15 инженеров.' },
  { year: '2024', title: 'Запуск платформы', desc: 'Первые 50 корпоративных клиентов. Начало работы в 10 блокчейн-сетях.' },
  { year: '2025', title: 'Series A', desc: '$28M. Запуск в 20 блокчейн-сетях. 1 000+ корпоративных клиентов. Объём платежей $2B.' },
  { year: '2026', title: 'Сегодня', desc: 'Расширение в Азиатско-Тихоокеанский регион. Запуск продукта для банков. $147M объём за 24 часа.' },
];

const NUMBERS = [
  { value: '$2B+',   label: 'Обработано платежей' },
  { value: '1,247',  label: 'Корпоративных клиентов' },
  { value: '20+',    label: 'Блокчейн-сетей' },
  { value: '47',     label: 'Стран присутствия' },
  { value: '12 сек', label: 'Средняя скорость доставки' },
  { value: '99.97%', label: 'Uptime за 2025 год' },
];

export default function About() {
  return (
    <PageLayout active="/about">
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '64px 24px' }}>

        {/* Hero */}
        <div style={{ textAlign: 'center', marginBottom: 72 }}>
          <div style={{ display: 'inline-block', padding: '4px 14px', borderRadius: 20, background: 'rgba(0,255,136,0.08)', border: '1px solid rgba(0,255,136,0.2)', fontSize: 12, color: ACCENT, fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.1em', marginBottom: 20 }}>О ПЛАТФОРМЕ</div>
          <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 'clamp(32px,5vw,52px)', fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 20, lineHeight: 1.1 }}>
            Мы строим инфраструктуру<br />для международных платежей
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 18, maxWidth: 620, margin: '0 auto' }}>
            MOST — технологическая компания, создающая платёжную инфраструктуру нового поколения на основе ИИ-маршрутизации и распределённых блокчейн-сетей.
          </p>
        </div>

        {/* Миссия */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 72 }}>
          <div style={{ padding: '32px', background: 'rgba(0,255,136,0.04)', border: '1px solid rgba(0,255,136,0.15)', borderRadius: 20 }}>
            <Icon name="Target" size={28} style={{ color: ACCENT, marginBottom: 14 }} />
            <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 20, fontWeight: 700, marginBottom: 10 }}>Наша миссия</h2>
            <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 15, lineHeight: 1.7 }}>
              Сделать международные платежи такими же простыми, быстрыми и дешёвыми, как отправка email. Мы верим, что географические и политические барьеры не должны мешать бизнесу работать.
            </p>
          </div>
          <div style={{ padding: '32px', background: 'rgba(77,159,255,0.04)', border: '1px solid rgba(77,159,255,0.15)', borderRadius: 20 }}>
            <Icon name="Eye" size={28} style={{ color: '#4D9FFF', marginBottom: 14 }} />
            <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 20, fontWeight: 700, marginBottom: 10 }}>Наше видение</h2>
            <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 15, lineHeight: 1.7 }}>
              К 2030 году обрабатывать $1 трлн в год трансграничных платежей. Стать стандартом де-факто для корпоративных крипто-расчётов в странах с ограниченным доступом к SWIFT.
            </p>
          </div>
        </div>


      </div>
    </PageLayout>
  );
}