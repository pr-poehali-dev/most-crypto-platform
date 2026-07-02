import { useState } from 'react';
import PageLayout from '@/components/PageLayout';
import Icon from '@/components/ui/icon';

const ACCENT = '#00FF88';

const OFFICES = [
  { city: 'Москва', role: 'Штаб-квартира', address: 'Пресненская наб., 6с2, Москва Сити', flag: '🇷🇺', phone: '+7 495 123-45-67', hours: 'Пн–Пт 9:00–19:00' },
];

const CONTACTS = [
  { icon: 'Mail',       label: 'Общие вопросы',   value: 'hello@onemost.ru',      href: 'mailto:hello@onemost.ru' },
  { icon: 'Headphones', label: 'Поддержка',        value: 'support@onemost.ru',    href: 'mailto:support@onemost.ru' },
  { icon: 'Briefcase',  label: 'Продажи',          value: 'sales@onemost.ru',      href: 'mailto:sales@onemost.ru' },
  { icon: 'Bug',        label: 'Безопасность',     value: 'security@onemost.ru',   href: 'mailto:security@onemost.ru' },
  { icon: 'Newspaper',  label: 'Пресса',           value: 'press@onemost.ru',      href: 'mailto:press@onemost.ru' },
  { icon: 'Scale',      label: 'Compliance/Legal', value: 'compliance@onemost.ru', href: 'mailto:compliance@onemost.ru' },
];

export default function Contacts() {
  const [name,    setName]    = useState('');
  const [email,   setEmail]   = useState('');
  const [company, setCompany] = useState('');
  const [topic,   setTopic]   = useState('Подключение к платформе');
  const [message, setMessage] = useState('');
  const [sent,    setSent]    = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => { setSent(true); setLoading(false); }, 1200);
  };

  const inp: React.CSSProperties = { width: '100%', padding: '11px 14px', borderRadius: 10, fontSize: 14, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', outline: 'none', fontFamily: "'Rubik', sans-serif", boxSizing: 'border-box' };

  return (
    <PageLayout active="/contacts">
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '64px 24px' }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 64 }}>
          <div style={{ display: 'inline-block', padding: '3px 12px', borderRadius: 20, background: 'rgba(0,255,136,0.08)', border: '1px solid rgba(0,255,136,0.2)', fontSize: 11, color: ACCENT, fontFamily: 'JetBrains Mono, monospace', marginBottom: 16 }}>КОНТАКТЫ</div>
          <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 44, fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 12 }}>Свяжитесь с нами</h1>
          <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 17, maxWidth: 500, margin: '0 auto' }}>
            Мы отвечаем в течение 1 рабочего дня. Для срочных вопросов — Telegram.
          </p>
        </div>

        {/* Email контакты */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 56 }}>
          {CONTACTS.map(c => (
            <a key={c.label} href={c.href} style={{ padding: '18px 20px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 14, transition: 'all 0.2s' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(0,255,136,0.3)'; e.currentTarget.style.background = 'rgba(0,255,136,0.04)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(0,255,136,0.1)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                <Icon name={c.icon} size={17} style={{ color: ACCENT }} />
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 3 }}>{c.label}</div>
                <div style={{ fontSize: 13, color: ACCENT, fontFamily: 'JetBrains Mono, monospace' }}>{c.value}</div>
              </div>
            </a>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 36, marginBottom: 56 }}>
          {/* Форма */}
          <div>
            <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 22, fontWeight: 700, marginBottom: 24 }}>Написать нам</h2>
            {sent ? (
              <div style={{ padding: '36px', textAlign: 'center', background: 'rgba(0,255,136,0.05)', border: '1px solid rgba(0,255,136,0.2)', borderRadius: 16 }}>
                <Icon name="CheckCircle2" size={44} style={{ color: ACCENT, marginBottom: 14 }} />
                <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Сообщение отправлено!</div>
                <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 14 }}>Мы ответим на {email} в течение 1 рабочего дня.</div>
                <button onClick={() => { setSent(false); setName(''); setEmail(''); setCompany(''); setMessage(''); }} style={{ marginTop: 20, padding: '10px 22px', borderRadius: 9, background: 'transparent', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', cursor: 'pointer', fontSize: 13 }}>
                  Отправить ещё
                </button>
              </div>
            ) : (
              <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', display: 'block', marginBottom: 6 }}>Имя *</label>
                    <input value={name} onChange={e => setName(e.target.value)} placeholder="Иван Иванов" required style={inp} onFocus={e => (e.target.style.borderColor = ACCENT)} onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.1)')} />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', display: 'block', marginBottom: 6 }}>Email *</label>
                    <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="ivan@company.ru" required style={inp} onFocus={e => (e.target.style.borderColor = ACCENT)} onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.1)')} />
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', display: 'block', marginBottom: 6 }}>Компания</label>
                  <input value={company} onChange={e => setCompany(e.target.value)} placeholder="ООО «Экспорт»" style={inp} onFocus={e => (e.target.style.borderColor = ACCENT)} onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.1)')} />
                </div>
                <div>
                  <label style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', display: 'block', marginBottom: 6 }}>Тема</label>
                  <select value={topic} onChange={e => setTopic(e.target.value)} style={{ ...inp, cursor: 'pointer', appearance: 'none' }}>
                    {['Подключение к платформе','Технические вопросы','Тарифы и оплата','KYC/Compliance','Партнёрство','Пресс-запрос','Другое'].map(t => <option key={t} value={t} style={{ background: '#0A0A1A' }}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', display: 'block', marginBottom: 6 }}>Сообщение *</label>
                  <textarea value={message} onChange={e => setMessage(e.target.value)} rows={5} placeholder="Опишите ваш запрос..." required style={{ ...inp, resize: 'vertical', lineHeight: 1.5 }} onFocus={e => (e.target.style.borderColor = ACCENT)} onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.1)')} />
                </div>
                <button type="submit" disabled={loading} style={{ padding: '13px', borderRadius: 11, background: ACCENT, color: '#0A0A1A', fontWeight: 700, fontSize: 15, border: 'none', cursor: 'pointer', opacity: loading ? 0.7 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  {loading ? 'Отправляем...' : <><Icon name="Send" size={15} /> Отправить</>}
                </button>
              </form>
            )}
          </div>

          {/* Офисы */}
          <div>
            <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 22, fontWeight: 700, marginBottom: 24 }}>Офисы</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {OFFICES.map(o => (
                <div key={o.city} style={{ padding: '20px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                    <span style={{ fontSize: 22 }}>{o.flag}</span>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 16 }}>{o.city}</div>
                      <div style={{ fontSize: 12, color: ACCENT, fontFamily: 'JetBrains Mono, monospace' }}>{o.role}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {[{ icon: 'MapPin', v: o.address }, { icon: 'Phone', v: o.phone }, { icon: 'Clock', v: o.hours }].map(f => (
                      <div key={f.icon} style={{ display: 'flex', gap: 8, fontSize: 13, color: 'rgba(255,255,255,0.6)', alignItems: 'center' }}>
                        <Icon name={f.icon} size={13} style={{ color: 'rgba(255,255,255,0.3)', flexShrink: 0 }} />
                        {f.v}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Telegram */}
        <div style={{ padding: '32px', background: 'linear-gradient(135deg, rgba(0,136,204,0.08), rgba(0,136,204,0.03))', border: '1px solid rgba(0,136,204,0.25)', borderRadius: 20, display: 'flex', alignItems: 'center', gap: 20 }}>
          <div style={{ width: 56, height: 56, borderRadius: 14, background: 'rgba(0,136,204,0.15)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
            <Icon name="MessageCircle" size={26} style={{ color: '#0088CC' }} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Telegram-поддержка</div>
            <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.55)' }}>Для быстрых вопросов — напишите нам в Telegram. Ответ за 30 минут в рабочее время.</div>
          </div>
          <a href="https://t.me/onemost_ru" target="_blank" rel="noopener noreferrer" style={{ padding: '12px 22px', borderRadius: 10, background: '#0088CC', color: '#fff', fontWeight: 700, fontSize: 14, textDecoration: 'none', flexShrink: 0 }}>
            Написать в Telegram
          </a>
        </div>
      </div>
    </PageLayout>
  );
}