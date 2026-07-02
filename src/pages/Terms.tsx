import PageLayout from '@/components/PageLayout';
import Icon from '@/components/ui/icon';

const ACCENT = '#00FF88';

const SECTIONS = [
  {
    n: '1', title: 'Предмет соглашения',
    text: 'Настоящие Условия использования регулируют отношения между MOST Network («Компания», «Платформа») и пользователем («Клиент») в части использования сервисов трансграничных платежей, предоставляемых через веб-платформу most.network и API Платформы.',
  },
  {
    n: '2', title: 'Условия использования',
    text: 'Для использования Платформы Клиент обязан: (а) быть юридическим лицом или индивидуальным предпринимателем; (б) успешно пройти процедуру KYC-верификации; (в) соблюдать применимое законодательство; (г) не использовать Платформу для операций, нарушающих санкционное законодательство.',
  },
  {
    n: '3', title: 'Тарификация и оплата',
    text: 'Стоимость услуг определяется выбранным тарифным планом. Абонентская плата списывается в начале расчётного периода. Комиссия за транзакции взимается в момент проведения платежа. Возврат абонентской платы не производится.',
  },
  {
    n: '4', title: 'Права и обязанности сторон',
    text: 'Компания обязуется: обеспечивать доступность Платформы в соответствии с SLA; уведомлять Клиента о плановых технических работах не менее чем за 24 часа; хранить данные транзакций не менее 5 лет. Клиент обязуется: соблюдать настоящие Условия; обеспечивать безопасность своих учётных данных; незамедлительно уведомлять Компанию о несанкционированном доступе.',
  },
  {
    n: '5', title: 'Ограничение ответственности',
    text: 'Компания не несёт ответственности за: задержки, вызванные действиями блокчейн-сетей третьих сторон; убытки, возникшие вследствие введения санкций после создания платежа; технические сбои форс-мажорного характера. Максимальная ответственность Компании по одному инциденту не превышает суммы комиссий, уплаченных Клиентом за последние 30 дней.',
  },
  {
    n: '6', title: 'Конфиденциальность',
    text: 'Компания обрабатывает персональные данные в соответствии с Политикой конфиденциальности и требованиями GDPR/ФЗ-152. Данные транзакций могут быть раскрыты регуляторным органам по запросу в рамках действующего законодательства.',
  },
  {
    n: '7', title: 'Интеллектуальная собственность',
    text: 'Все права на Платформу, включая программный код, дизайн, торговые марки и документацию, принадлежат MOST Network. Клиент получает ограниченную, неисключительную, непередаваемую лицензию на использование Платформы в соответствии с настоящими Условиями.',
  },
  {
    n: '8', title: 'Прекращение действия',
    text: 'Каждая из сторон вправе расторгнуть соглашение, уведомив другую сторону за 30 дней. Компания вправе немедленно приостановить доступ при нарушении настоящих Условий или применимого законодательства.',
  },
  {
    n: '9', title: 'Применимое право',
    text: 'Настоящие Условия регулируются законодательством Российской Федерации. Споры разрешаются в Арбитражном суде города Москвы.',
  },
];

export default function Terms() {
  return (
    <PageLayout active="/terms">
      <div style={{ maxWidth: 800, margin: '0 auto', padding: '64px 24px' }}>

        {/* Header */}
        <div style={{ marginBottom: 48 }}>
          <div style={{ display: 'inline-block', padding: '3px 12px', borderRadius: 20, background: 'rgba(0,255,136,0.08)', border: '1px solid rgba(0,255,136,0.2)', fontSize: 11, color: ACCENT, fontFamily: 'JetBrains Mono, monospace', marginBottom: 16 }}>ЮРИДИЧЕСКИЕ ДОКУМЕНТЫ</div>
          <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 40, fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 14 }}>Условия использования</h1>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 20 }}>
            <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>Версия: 3.0</span>
            <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>Действует с: 1 января 2026</span>
          </div>
          <div style={{ padding: '14px 18px', borderRadius: 12, background: 'rgba(255,170,0,0.06)', border: '1px solid rgba(255,170,0,0.2)', fontSize: 13, color: 'rgba(255,255,255,0.6)', lineHeight: 1.6, display: 'flex', gap: 10 }}>
            <Icon name="AlertCircle" size={16} style={{ color: '#FFAA00', flexShrink: 0, marginTop: 1 }} />
            Используя Платформу, вы соглашаетесь с настоящими Условиями. Пожалуйста, внимательно прочитайте их перед регистрацией.
          </div>
        </div>

        {/* Sections */}
        {SECTIONS.map(s => (
          <section key={s.n} style={{ marginBottom: 36 }}>
            <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 18, fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ width: 30, height: 30, borderRadius: 8, background: 'rgba(0,255,136,0.08)', border: '1px solid rgba(0,255,136,0.2)', display: 'grid', placeItems: 'center', fontSize: 13, color: ACCENT, fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, flexShrink: 0 }}>{s.n}</span>
              {s.title}
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 15, lineHeight: 1.8, paddingLeft: 42 }}>{s.text}</p>
          </section>
        ))}

        {/* Контакт */}
        <div style={{ marginTop: 32, padding: '20px 24px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, display: 'flex', gap: 16, alignItems: 'center' }}>
          <Icon name="Mail" size={18} style={{ color: ACCENT, flexShrink: 0 }} />
          <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)', lineHeight: 1.6 }}>
            Вопросы по условиям использования: <a href="mailto:legal@most.network" style={{ color: ACCENT, textDecoration: 'none' }}>legal@most.network</a><br />
            MOST Network LLC · ИНН 9999999999 · 123456, г. Москва, Пресненская наб. 6с2
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
