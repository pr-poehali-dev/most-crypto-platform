import PageLayout from '@/components/PageLayout';
import Icon from '@/components/ui/icon';

const ACCENT = '#00FF88';

const NEWS = [
  { date: '15 июня 2026', source: 'Forbes Russia',    title: 'MOST обработал $2 млрд платежей за первый год: как стартап строит инфраструктуру обхода санкций',       tag: 'Финансы'    },
  { date: '3 мая 2026',   source: 'RBC',              title: 'ЦБ РФ включил MOST в экспериментальный режим: что это значит для бизнеса',                                tag: 'Регуляторика' },
  { date: '20 апр 2026',  source: 'CoinDesk',         title: 'Russian FinTech MOST Raises $28M Series A to Expand Cross-Border Crypto Payments',                       tag: 'Инвестиции'  },
  { date: '7 фев 2026',   source: 'Коммерсантъ',     title: 'Как технология роёв помогает российскому бизнесу платить турецким поставщикам за 12 секунд',              tag: 'Технологии'  },
  { date: '15 янв 2026',  source: 'TechCrunch',       title: 'Inside MOST: The AI Swarm That\'s Routing Around Sanctions',                                              tag: 'Технологии'  },
];

const FACTS = [
  '$2B+ обработано транзакций',
  '1,247 корпоративных клиентов',
  '20+ поддерживаемых блокчейн-сетей',
  'Лицензия ЦБ РФ (ЭПР №258-ФЗ)',
  'Поддержка a16z и Sequoia',
  '12 секунд — средняя скорость доставки',
  'Команда из 80+ специалистов',
  'Офисы в Москве, Дубае, Гонконге',
];

export default function Press() {
  return (
    <PageLayout active="/press">
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '64px 24px' }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 64 }}>
          <div style={{ display: 'inline-block', padding: '3px 12px', borderRadius: 20, background: 'rgba(0,255,136,0.08)', border: '1px solid rgba(0,255,136,0.2)', fontSize: 11, color: ACCENT, fontFamily: 'JetBrains Mono, monospace', marginBottom: 16 }}>ПРЕСС-КИТ</div>
          <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 44, fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 12 }}>Медиа-кит MOST</h1>
          <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 16, maxWidth: 500, margin: '0 auto 24px' }}>
            Все материалы для публикаций, брифинги и пресс-контакт.
          </p>
          <a href="mailto:press@most.network" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 24px', borderRadius: 11, background: ACCENT, color: '#0A0A1A', fontWeight: 700, fontSize: 14, textDecoration: 'none' }}>
            <Icon name="Mail" size={15} /> press@most.network
          </a>
        </div>

        {/* Загрузки */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 56 }}>
          {[
            { icon: 'Image',     label: 'Логотипы',        desc: 'SVG, PNG, тёмный / светлый фон',   size: '2.4 MB' },
            { icon: 'Palette',   label: 'Брендбук',        desc: 'Цвета, шрифты, правила использования', size: '8.1 MB' },
            { icon: 'FileText',  label: 'One-pager',       desc: 'PDF, русский и английский',           size: '1.2 MB' },
            { icon: 'Video',     label: 'B-roll видео',    desc: 'Промо-ролики 4K, .mov',               size: '240 MB' },
            { icon: 'User',      label: 'Фото команды',    desc: 'Профессиональные фотографии, PNG',    size: '18 MB'  },
            { icon: 'BarChart2', label: 'Инфографика',     desc: 'Схемы работы Swarm, PNG/SVG',         size: '4.7 MB' },
          ].map(d => (
            <div key={d.label} style={{ padding: '20px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, display: 'flex', gap: 14, alignItems: 'flex-start', transition: 'all 0.2s', cursor: 'pointer' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(0,255,136,0.3)'; e.currentTarget.style.background = 'rgba(0,255,136,0.04)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(0,255,136,0.1)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                <Icon name={d.icon} size={18} style={{ color: ACCENT }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 3 }}>{d.label}</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginBottom: 8 }}>{d.desc}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', fontFamily: 'JetBrains Mono, monospace' }}>{d.size}</span>
                  <span style={{ fontSize: 11, color: ACCENT, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Icon name="Download" size={11} /> Скачать
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32 }}>
          {/* Ключевые факты */}
          <div>
            <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 22, fontWeight: 700, marginBottom: 20 }}>Ключевые факты</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {FACTS.map(f => (
                <div key={f} style={{ display: 'flex', gap: 10, padding: '10px 14px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 9, fontSize: 14, color: 'rgba(255,255,255,0.8)', alignItems: 'center' }}>
                  <Icon name="Check" size={14} style={{ color: ACCENT, flexShrink: 0 }} />
                  {f}
                </div>
              ))}
            </div>
          </div>

          {/* Упоминания */}
          <div>
            <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 22, fontWeight: 700, marginBottom: 20 }}>В СМИ</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {NEWS.map(n => (
                <div key={n.title} style={{ padding: '14px 16px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: 'rgba(0,255,136,0.1)', color: ACCENT, fontFamily: 'JetBrains Mono, monospace' }}>{n.source}</span>
                    <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>{n.date}</span>
                    <span style={{ marginLeft: 'auto', fontSize: 11, padding: '2px 8px', borderRadius: 6, background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.4)' }}>{n.tag}</span>
                  </div>
                  <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', lineHeight: 1.5 }}>{n.title}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Пресс-контакт */}
        <div style={{ marginTop: 48, padding: '32px 36px', background: 'rgba(0,255,136,0.04)', border: '1px solid rgba(0,255,136,0.15)', borderRadius: 20, display: 'flex', gap: 24, alignItems: 'center' }}>
          <div style={{ width: 52, height: 52, borderRadius: 13, background: 'rgba(0,255,136,0.12)', border: '1px solid rgba(0,255,136,0.25)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
            <Icon name="Newspaper" size={24} style={{ color: ACCENT }} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Пресс-служба MOST</div>
            <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.55)' }}>Татьяна Морозова, Head of PR · Ответ на запросы в течение 2 часов в рабочее время</div>
          </div>
          <div style={{ display: 'flex', flex: 'column', gap: 10, flexDirection: 'column' }}>
            <a href="mailto:press@most.network" style={{ padding: '10px 20px', borderRadius: 9, background: ACCENT, color: '#0A0A1A', fontWeight: 700, fontSize: 13, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
              <Icon name="Mail" size={13} /> press@most.network
            </a>
            <a href="https://t.me/most_press" target="_blank" rel="noopener noreferrer" style={{ padding: '10px 20px', borderRadius: 9, border: '1px solid rgba(255,255,255,0.15)', color: '#fff', fontSize: 13, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
              <Icon name="MessageCircle" size={13} /> Telegram
            </a>
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
