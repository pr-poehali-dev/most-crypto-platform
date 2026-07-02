import PageLayout from '@/components/PageLayout';
import Icon from '@/components/ui/icon';

const ACCENT = '#00FF88';

export default function KycAml() {
  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <section style={{ marginBottom: 48 }}>
      <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 22, fontWeight: 700, marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>{title}</h2>
      {children}
    </section>
  );

  const P = ({ children }: { children: React.ReactNode }) => (
    <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 15, lineHeight: 1.8, marginBottom: 14 }}>{children}</p>
  );

  const Li = ({ children }: { children: React.ReactNode }) => (
    <li style={{ display: 'flex', gap: 10, marginBottom: 10, fontSize: 15, color: 'rgba(255,255,255,0.65)', alignItems: 'flex-start' }}>
      <Icon name="ChevronRight" size={16} style={{ color: ACCENT, flexShrink: 0, marginTop: 3 }} />
      {children}
    </li>
  );

  return (
    <PageLayout active="/kyc-aml">
      <div style={{ maxWidth: 800, margin: '0 auto', padding: '64px 24px' }}>

        {/* Header */}
        <div style={{ marginBottom: 56 }}>
          <div style={{ display: 'inline-block', padding: '3px 12px', borderRadius: 20, background: 'rgba(0,255,136,0.08)', border: '1px solid rgba(0,255,136,0.2)', fontSize: 11, color: ACCENT, fontFamily: 'JetBrains Mono, monospace', marginBottom: 16 }}>ПОЛИТИКА</div>
          <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 40, fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 14 }}>Политика KYC/AML</h1>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>Версия: 2.1</span>
            <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>Действует с: 1 января 2026</span>
            <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>Последнее обновление: 2 июля 2026</span>
          </div>
        </div>

        <Section title="1. Общие положения">
          <P>MOST Network (далее — «Платформа») обязуется соблюдать все применимые требования в области противодействия легализации (отмыванию) доходов, полученных преступным путём, и финансированию терроризма (ПОД/ФТ).</P>
          <P>Настоящая политика разработана в соответствии с требованиями Федерального закона №115-ФЗ «О противодействии легализации (отмыванию) доходов», рекомендациями FATF и нормами международного права в области финансового мониторинга.</P>
        </Section>

        <Section title="2. Процедура идентификации клиентов (KYC)">
          <P>Все клиенты Платформы обязаны пройти процедуру верификации личности перед началом использования платёжных сервисов.</P>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            <Li>Для физических лиц: паспорт или иной документ, удостоверяющий личность, с фотографией</Li>
            <Li>Для юридических лиц: свидетельство о регистрации, устав, документы CEO/бенефициарного владельца</Li>
            <Li>Подтверждение адреса: выписка из банка или счёт за коммунальные услуги не старше 3 месяцев</Li>
            <Li>Для объёмов свыше $100 000/мес: расширенная проверка (Enhanced Due Diligence)</Li>
          </ul>
          <div style={{ marginTop: 20, padding: '16px 20px', borderRadius: 12, background: 'rgba(0,255,136,0.05)', border: '1px solid rgba(0,255,136,0.15)', fontSize: 14, color: 'rgba(255,255,255,0.7)', lineHeight: 1.6 }}>
            <strong style={{ color: ACCENT }}>Срок проверки:</strong> Стандартная — 1–2 рабочих дня. Ускоренная (тариф Business+) — 4 часа.
          </div>
        </Section>

        <Section title="3. Мониторинг транзакций (AML)">
          <P>Платформа осуществляет непрерывный мониторинг всех транзакций на предмет признаков подозрительной деятельности.</P>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            <Li>Автоматическая проверка адресов по базам OFAC SDN, EU Consolidated List, UN Security Council</Li>
            <Li>Анализ транзакций на признаки работы миксеров, darknet-маркетплейсов</Li>
            <Li>Поведенческий анализ: структурирование (смурфинг), необычные паттерны активности</Li>
            <Li>Транзакции с высоким риском (Risk Score ≥ 40) направляются на ручную проверку</Li>
            <Li>Транзакции с критическим риском (Risk Score ≥ 80) блокируются автоматически</Li>
          </ul>
        </Section>

        <Section title="4. Санкционный комплаенс">
          <P>Платформа строго соблюдает все применимые санкционные ограничения. Транзакции с участием лиц или организаций, включённых в санкционные списки, запрещены.</P>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 12 }}>
            {['OFAC SDN List', 'EU Consolidated List', 'UN Security Council', 'UK HM Treasury', 'Росфинмониторинг', 'ЦБ РФ'].map(list => (
              <div key={list} style={{ padding: '10px 14px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 9, display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                <Icon name="Shield" size={13} style={{ color: ACCENT }} /> {list}
              </div>
            ))}
          </div>
        </Section>

        <Section title="5. Замороженные активы и блокировка аккаунтов">
          <P>Платформа вправе заморозить аккаунт и/или средства в следующих случаях:</P>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            <Li>Обнаружение транзакций, связанных с санкционными лицами</Li>
            <Li>Подозрение на использование Платформы для легализации доходов</Li>
            <Li>Запрос правоохранительных органов</Li>
            <Li>Выявление некорректных данных при KYC-верификации</Li>
          </ul>
          <P>В случае заморозки клиент уведомляется по email. Для разблокировки необходимо обратиться на compliance@most.network.</P>
        </Section>

        <Section title="6. Обязанности клиентов">
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            <Li>Предоставлять достоверные данные при регистрации и KYC</Li>
            <Li>Незамедлительно уведомлять Платформу об изменении данных</Li>
            <Li>Не использовать Платформу для незаконных целей</Li>
            <Li>Содействовать Платформе при проведении проверок</Li>
          </ul>
        </Section>

        <Section title="7. Хранение данных">
          <P>Данные KYC-верификации хранятся в течение 5 лет с момента прекращения деловых отношений в соответствии с требованиями ФЗ №115 и GDPR.</P>
        </Section>

        <div style={{ padding: '20px 24px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, display: 'flex', gap: 16, alignItems: 'center' }}>
          <Icon name="FileText" size={20} style={{ color: ACCENT, flexShrink: 0 }} />
          <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)' }}>
            По вопросам KYC/AML обращайтесь: <a href="mailto:compliance@most.network" style={{ color: ACCENT, textDecoration: 'none' }}>compliance@most.network</a>
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
