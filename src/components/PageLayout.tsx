import type { ReactNode } from 'react';

const ACCENT = '#00FF88';
const BG     = '#0A0A1A';

const NAV_LINKS = [
  { label: 'О платформе',  href: '/about'    },
  { label: 'Как работает', href: '/#how'      },
  { label: 'Безопасность', href: '/security'  },
  { label: 'Для банков',   href: '/docs'      },
  { label: 'Контакты',     href: '/contacts'  },
];

const FOOTER_COLS = [
  {
    title: 'Платформа',
    links: [
      { label: 'О платформе',  href: '/about'    },
      { label: 'Как работает', href: '/#how'      },
      { label: 'Безопасность', href: '/security'  },
    ],
  },
  {
    title: 'Разработчикам',
    links: [
      { label: 'Подключение банков', href: '/docs'     },
      { label: 'API Reference',      href: '/api-ref'  },
      { label: 'Sandbox',            href: '/sandbox'  },
    ],
  },
  {
    title: 'Компания',
    links: [
      { label: 'Контакты',               href: '/contacts' },
      { label: 'Политика KYC/AML',       href: '/kyc-aml'  },
      { label: 'Условия использования',  href: '/terms'    },
      { label: 'Пресс-кит',              href: '/press'    },
    ],
  },
];

export default function PageLayout({ children, active }: { children: ReactNode; active?: string }) {
  return (
    <div style={{ background: BG, minHeight: '100vh', color: '#fff', fontFamily: "'Rubik', sans-serif" }}>

      {/* Сетка-фон */}
      <div style={{ position: 'fixed', inset: 0, opacity: 0.05, pointerEvents: 'none',
        backgroundImage: `linear-gradient(rgba(0,255,136,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(0,255,136,0.3) 1px, transparent 1px)`,
        backgroundSize: '48px 48px' }} />

      {/* NAV */}
      <nav style={{ position: 'sticky', top: 0, zIndex: 40, background: 'rgba(10,10,26,0.9)', backdropFilter: 'blur(14px)', borderBottom: '1px solid rgba(0,255,136,0.12)' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px', height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <a href="/" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}>
            <img src="https://cdn.poehali.dev/projects/573c75be-a606-4ed0-96a4-1601ddf0b628/bucket/6357c7e8-9711-4d17-a842-e36565661a52.png" alt="MOST" style={{ height: 40, width: 'auto', objectFit: 'contain', display: 'block' }} />
          </a>
          <div style={{ display: 'flex', gap: 28, alignItems: 'center' }}>
            {NAV_LINKS.map(l => (
              <a key={l.label} href={l.href} style={{ fontSize: 14, textDecoration: 'none', transition: 'color 0.2s', color: active === l.href ? ACCENT : 'rgba(255,255,255,0.55)', fontWeight: active === l.href ? 600 : 400 }}
                onMouseEnter={e => (e.currentTarget.style.color = '#fff')}
                onMouseLeave={e => (e.currentTarget.style.color = active === l.href ? ACCENT : 'rgba(255,255,255,0.55)')}>
                {l.label}
              </a>
            ))}
            <a href="/register" style={{ background: ACCENT, color: BG, padding: '8px 20px', borderRadius: 10, fontWeight: 600, fontSize: 14, textDecoration: 'none' }}
              onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
              onMouseLeave={e => (e.currentTarget.style.opacity = '1')}>
              Подключить
            </a>
          </div>
        </div>
      </nav>

      {/* Content */}
      <main>{children}</main>

      {/* FOOTER */}
      <footer style={{ borderTop: '1px solid rgba(0,255,136,0.12)', padding: '48px 24px', background: 'rgba(0,0,0,0.3)', marginTop: 80 }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 48, marginBottom: 48 }}>
            <div>
              <a href="/" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none', marginBottom: 16 }}>
                <img src="https://cdn.poehali.dev/projects/573c75be-a606-4ed0-96a4-1601ddf0b628/bucket/6357c7e8-9711-4d17-a842-e36565661a52.png" alt="MOST" style={{ height: 36, width: 'auto', objectFit: 'contain', display: 'block' }} />
              </a>
              <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 13, lineHeight: 1.7, maxWidth: 260 }}>
                Платформа трансграничных крипто-платежей с технологией swarm-маршрутизации.
              </p>
              <div style={{ marginTop: 20, display: 'flex', gap: 10 }}>
                {['tg', 'tw', 'gh'].map(s => (
                  <a key={s} href="#" style={{ width: 34, height: 34, borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', display: 'grid', placeItems: 'center', color: 'rgba(255,255,255,0.4)', textDecoration: 'none', fontSize: 12, fontFamily: 'monospace', transition: 'all 0.2s' }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = ACCENT; e.currentTarget.style.color = ACCENT; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = 'rgba(255,255,255,0.4)'; }}>
                    {s}
                  </a>
                ))}
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 32 }}>
              {FOOTER_COLS.map(col => (
                <div key={col.title}>
                  <div style={{ fontSize: 11, letterSpacing: '0.15em', color: 'rgba(255,255,255,0.35)', fontFamily: 'JetBrains Mono, monospace', marginBottom: 16 }}>{col.title.toUpperCase()}</div>
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {col.links.map(l => (
                      <li key={l.label}>
                        <a href={l.href} style={{ color: 'rgba(255,255,255,0.55)', fontSize: 14, textDecoration: 'none', transition: 'color 0.2s' }}
                          onMouseEnter={e => (e.currentTarget.style.color = '#fff')}
                          onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.55)')}>
                          {l.label}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13 }}>MOST © 2026. Все права защищены.</span>
            <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: 12 }}>onemost.ru</span>
          </div>
        </div>
      </footer>

      <style>{`
        * { box-sizing: border-box; }
        ::selection { background: rgba(0,255,136,0.25); }
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-thumb { background: rgba(0,255,136,0.2); border-radius: 3px; }
      `}</style>
    </div>
  );
}