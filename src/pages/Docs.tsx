import { useState } from 'react';
import PageLayout from '@/components/PageLayout';
import Icon from '@/components/ui/icon';

const ACCENT = '#00FF88';

const SECTIONS = [
  {
    id: 'quickstart', title: '🚀 Быстрый старт', items: [
      'Регистрация и KYC', 'Первый платёж', 'Sandbox-режим', 'Webhooks'
    ]
  },
  {
    id: 'payments', title: '💸 Платежи', items: [
      'Создание платежа', 'Статусы платежа', 'Отмена и возврат', 'Лимиты и лимбы'
    ]
  },
  {
    id: 'swarm', title: '🌐 Swarm-маршрутизация', items: [
      'Как работает рой', 'Выбор стратегии', 'Мониторинг агентов', 'Кастомные маршруты'
    ]
  },
  {
    id: 'aml', title: '🛡 AML и Risk Engine', items: [
      'Проверка адресов', 'Интерпретация риск-скора', 'Ручная проверка', 'Апелляция'
    ]
  },
  {
    id: 'api', title: '🔌 API', items: [
      'Аутентификация', 'Rate limiting', 'Обработка ошибок', 'Webhooks'
    ]
  },
];

const QUICKSTART_CODE = `// 1. Установите SDK
npm install @most-network/sdk

// 2. Инициализация
import { MostClient } from '@most-network/sdk';
const client = new MostClient({
  apiKey: 'your_api_key',
  environment: 'sandbox' // или 'production'
});

// 3. Создайте платёж
const payment = await client.payments.create({
  amount: 1000000,
  fromCurrency: 'USD',
  toCurrency:   'USDT',
  destinationAddress: '0xYourTurkishSupplierAddress',
  destinationCountry: 'TR',
});

console.log(payment.id);     // pay_xxx
console.log(payment.status); // processing | aml_pending`;

const WEBHOOK_CODE = `// Пример webhook-события
{
  "event": "payment.completed",
  "timestamp": "2026-07-02T12:00:00Z",
  "data": {
    "id": "pay_01J4XYZ",
    "status": "completed",
    "amount": 1000000,
    "from_currency": "USD",
    "to_currency": "USDT",
    "destination_address": "0x...",
    "tx_hashes": ["0xabc...", "0xdef..."],
    "swarm_agents": 5000,
    "delivery_time_ms": 12400
  }
}`;

const STATUSES = [
  { code: 'processing',   color: '#4D9FFF', desc: 'Платёж принят, рой запущен' },
  { code: 'aml_pending',  color: '#FFAA00', desc: 'Ожидает ручной AML-проверки' },
  { code: 'completed',    color: ACCENT,    desc: 'Средства доставлены' },
  { code: 'rejected',     color: '#FF4444', desc: 'Отклонён compliance-офицером' },
  { code: 'failed',       color: '#FF4444', desc: 'Техническая ошибка маршрутизации' },
];

export default function Docs() {
  const [activeSection, setActiveSection] = useState('quickstart');

  return (
    <PageLayout active="/docs">
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '40px 24px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 48 }}>

          {/* Sidebar */}
          <nav style={{ position: 'sticky', top: 88, height: 'fit-content' }}>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.12em', fontFamily: 'JetBrains Mono, monospace', marginBottom: 16 }}>ДОКУМЕНТАЦИЯ</div>
            {SECTIONS.map(s => (
              <div key={s.id} style={{ marginBottom: 8 }}>
                <button onClick={() => setActiveSection(s.id)} style={{ width: '100%', textAlign: 'left', padding: '8px 12px', borderRadius: 8, background: activeSection === s.id ? 'rgba(0,255,136,0.1)' : 'transparent', border: `1px solid ${activeSection === s.id ? 'rgba(0,255,136,0.25)' : 'transparent'}`, color: activeSection === s.id ? ACCENT : 'rgba(255,255,255,0.6)', fontSize: 13, fontWeight: activeSection === s.id ? 600 : 400, cursor: 'pointer', transition: 'all 0.15s' }}>
                  {s.title}
                </button>
                {activeSection === s.id && (
                  <div style={{ paddingLeft: 14, marginTop: 4 }}>
                    {s.items.map(item => (
                      <div key={item} style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', padding: '5px 8px', cursor: 'pointer', borderLeft: '1px solid rgba(255,255,255,0.1)', transition: 'color 0.15s' }}
                        onMouseEnter={e => (e.currentTarget.style.color = '#fff')}
                        onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.4)')}>
                        {item}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
            <div style={{ marginTop: 24, padding: '14px', borderRadius: 10, background: 'rgba(0,255,136,0.05)', border: '1px solid rgba(0,255,136,0.15)' }}>
              <div style={{ fontSize: 12, color: ACCENT, fontWeight: 600, marginBottom: 6 }}>Нужна помощь?</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', lineHeight: 1.5 }}>Пишите в Telegram или на support@most.network</div>
              <a href="/contacts" style={{ display: 'block', marginTop: 10, fontSize: 12, color: ACCENT, textDecoration: 'none' }}>Связаться →</a>
            </div>
          </nav>

          {/* Content */}
          <div>
            {/* Quickstart */}
            {activeSection === 'quickstart' && (
              <div>
                <div style={{ display: 'inline-block', padding: '3px 12px', borderRadius: 20, background: 'rgba(0,255,136,0.08)', border: '1px solid rgba(0,255,136,0.2)', fontSize: 11, color: ACCENT, fontFamily: 'JetBrains Mono, monospace', marginBottom: 16 }}>БЫСТРЫЙ СТАРТ</div>
                <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 36, fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 12 }}>Начните за 5 минут</h1>
                <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 16, lineHeight: 1.7, marginBottom: 36 }}>
                  MOST предоставляет REST API и SDK для интеграции трансграничных крипто-платежей в ваш продукт. Поддерживаются Python, JavaScript/TypeScript, Go.
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 36 }}>
                  {[
                    { n: '1', title: 'Получите API-ключ', desc: 'Зарегистрируйтесь и пройдите KYC. Ключ появится в личном кабинете.' },
                    { n: '2', title: 'Установите SDK', desc: 'npm install @most-network/sdk или pip install most-sdk' },
                    { n: '3', title: 'Тестируйте в Sandbox', desc: 'Полный функционал без реальных средств. Бесплатно.' },
                  ].map(step => (
                    <div key={step.n} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: '20px' }}>
                      <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(0,255,136,0.12)', border: '1px solid rgba(0,255,136,0.3)', display: 'grid', placeItems: 'center', fontFamily: 'JetBrains Mono, monospace', fontSize: 14, fontWeight: 700, color: ACCENT, marginBottom: 12 }}>{step.n}</div>
                      <div style={{ fontWeight: 600, marginBottom: 6 }}>{step.title}</div>
                      <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', lineHeight: 1.5 }}>{step.desc}</div>
                    </div>
                  ))}
                </div>

                <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 20, fontWeight: 700, marginBottom: 14 }}>Пример кода</h2>
                <div style={{ background: '#0A0A18', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, overflow: 'hidden', marginBottom: 32 }}>
                  <div style={{ padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', fontFamily: 'JetBrains Mono, monospace' }}>JavaScript</span>
                    <a href="/api-ref" style={{ marginLeft: 'auto', fontSize: 12, color: ACCENT, textDecoration: 'none' }}>API Reference →</a>
                  </div>
                  <pre style={{ margin: 0, padding: '20px', fontSize: 13, color: '#e2e8f0', fontFamily: 'JetBrains Mono, monospace', lineHeight: 1.6, overflow: 'auto', whiteSpace: 'pre-wrap' }}>
                    <code style={{ color: '#94a3b8' }}>{QUICKSTART_CODE}</code>
                  </pre>
                </div>

                <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 20, fontWeight: 700, marginBottom: 14 }}>Статусы платежа</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 32 }}>
                  {STATUSES.map(s => (
                    <div key={s.code} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10 }}>
                      <span style={{ padding: '3px 10px', borderRadius: 6, background: `${s.color}18`, color: s.color, fontSize: 12, fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, whiteSpace: 'nowrap' }}>{s.code}</span>
                      <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.7)' }}>{s.desc}</span>
                    </div>
                  ))}
                </div>

                <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 20, fontWeight: 700, marginBottom: 14 }}>Webhooks</h2>
                <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14, marginBottom: 14, lineHeight: 1.6 }}>
                  MOST отправляет HTTP POST на ваш endpoint при изменении статуса платежа. Подпишитесь на события в настройках аккаунта.
                </p>
                <div style={{ background: '#0A0A18', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, overflow: 'hidden' }}>
                  <div style={{ padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                    <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', fontFamily: 'JetBrains Mono, monospace' }}>JSON</span>
                  </div>
                  <pre style={{ margin: 0, padding: '20px', fontSize: 13, color: '#e2e8f0', fontFamily: 'JetBrains Mono, monospace', lineHeight: 1.6, overflow: 'auto', whiteSpace: 'pre-wrap' }}>
                    <code>{WEBHOOK_CODE}</code>
                  </pre>
                </div>
              </div>
            )}

            {/* Остальные разделы */}
            {activeSection !== 'quickstart' && (
              <div>
                <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 32, fontWeight: 700, marginBottom: 16 }}>
                  {SECTIONS.find(s => s.id === activeSection)?.title}
                </h1>
                <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 16, lineHeight: 1.7, marginBottom: 32 }}>
                  Этот раздел документации в активной разработке. Полная документация будет опубликована вместе с запуском production API.
                </p>
                <div style={{ display: 'flex', gap: 12 }}>
                  <a href="/sandbox" style={{ padding: '10px 22px', borderRadius: 10, background: ACCENT, color: '#0A0A1A', fontWeight: 700, fontSize: 14, textDecoration: 'none' }}>Открыть Sandbox</a>
                  <a href="/contacts" style={{ padding: '10px 22px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.15)', color: '#fff', fontSize: 14, textDecoration: 'none' }}>Задать вопрос</a>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
