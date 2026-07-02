import PageLayout from '@/components/PageLayout';
import Icon from '@/components/ui/icon';

const ACCENT = '#00FF88';

const SDKS = [
  {
    lang: 'JavaScript / TypeScript',
    icon: '⚡',
    color: '#F3BA2F',
    install: 'npm install @most-network/sdk',
    version: '1.2.4',
    code: `import { MostClient } from '@most-network/sdk';

const client = new MostClient({
  apiKey: process.env.MOST_API_KEY,
  environment: 'production',
});

// Создать платёж
const payment = await client.payments.create({
  amount: 50000,
  fromCurrency: 'USD',
  toCurrency: 'USDT',
  destinationAddress: '0xYour...Address',
  destinationCountry: 'AE',
});

// Подписка на события
client.webhooks.on('payment.completed', (event) => {
  console.log('Доставлено:', event.data.id);
});

// Проверить адрес
const risk = await client.risk.check('0xAddress...');
console.log(risk.recommendation); // APPROVE | MANUAL_REVIEW | REJECT`,
    features: ['Полная типизация TypeScript', 'Автоматический retry', 'Встроенный rate-limiter', 'Webhook-сервер из коробки'],
  },
  {
    lang: 'Python',
    icon: '🐍',
    color: '#4D9FFF',
    install: 'pip install most-sdk',
    version: '1.1.2',
    code: `from most_sdk import MostClient

client = MostClient(
    api_key=os.environ['MOST_API_KEY'],
    environment='production'
)

# Создать платёж
payment = client.payments.create(
    amount=50000,
    from_currency='USD',
    to_currency='USDT',
    destination_address='0xYour...Address',
    destination_country='AE'
)

print(payment.id)      # pay_01J4XYZ
print(payment.status)  # processing

# Async поддержка
async with MostAsyncClient(api_key=...) as c:
    payment = await c.payments.create(...)`,
    features: ['Sync и Async клиент', 'Pydantic-модели', 'Поддержка Python 3.9+', 'Полное логирование'],
  },
  {
    lang: 'Go',
    icon: '🔵',
    color: '#00C7E4',
    install: 'go get github.com/most-network/most-go',
    version: '0.9.1',
    code: `package main

import (
    "github.com/most-network/most-go"
)

func main() {
    client := most.NewClient(most.Config{
        APIKey:      os.Getenv("MOST_API_KEY"),
        Environment: most.Production,
    })

    payment, err := client.Payments.Create(most.PaymentParams{
        Amount:             50000,
        FromCurrency:       "USD",
        ToCurrency:         "USDT",
        DestinationAddress: "0xYour...Address",
        DestinationCountry: "AE",
    })

    if err != nil {
        log.Fatal(err)
    }
    fmt.Println(payment.ID)
}`,
    features: ['Нативные Go-типы', 'Context поддержка', 'HTTP/2', 'Минимальные зависимости'],
  },
];

export default function Sdk() {
  return (
    <PageLayout active="/sdk">
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '64px 24px' }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 64 }}>
          <div style={{ display: 'inline-block', padding: '3px 12px', borderRadius: 20, background: 'rgba(0,255,136,0.08)', border: '1px solid rgba(0,255,136,0.2)', fontSize: 11, color: ACCENT, fontFamily: 'JetBrains Mono, monospace', marginBottom: 16 }}>SDK</div>
          <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 44, fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 16 }}>Официальные SDK</h1>
          <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 17, maxWidth: 560, margin: '0 auto' }}>
            Интегрируйте MOST в несколько строк кода. Поддерживаемые языки: JavaScript, Python, Go.
          </p>
        </div>

        {/* SDKs */}
        {SDKS.map(sdk => (
          <div key={sdk.lang} style={{ marginBottom: 48, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 20, overflow: 'hidden' }}>
            {/* Header */}
            <div style={{ padding: '20px 28px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', gap: 14 }}>
              <span style={{ fontSize: 28 }}>{sdk.icon}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 18, fontWeight: 700, marginBottom: 4 }}>{sdk.lang}</div>
                <code style={{ fontSize: 13, color: sdk.color, fontFamily: 'JetBrains Mono, monospace', background: `${sdk.color}15`, padding: '3px 10px', borderRadius: 6 }}>{sdk.install}</code>
              </div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <span style={{ padding: '4px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.06)', fontSize: 12, fontFamily: 'JetBrains Mono, monospace', color: 'rgba(255,255,255,0.4)' }}>v{sdk.version}</span>
                <a href="/docs" style={{ padding: '8px 16px', borderRadius: 9, background: `${sdk.color}18`, border: `1px solid ${sdk.color}44`, color: sdk.color, fontSize: 13, fontWeight: 600, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Icon name="BookOpen" size={13} /> Документация
                </a>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 200px', gap: 0 }}>
              {/* Code */}
              <div style={{ borderRight: '1px solid rgba(255,255,255,0.07)' }}>
                <pre style={{ margin: 0, padding: '24px 28px', fontSize: 13, color: '#e2e8f0', fontFamily: 'JetBrains Mono, monospace', lineHeight: 1.65, overflow: 'auto', whiteSpace: 'pre-wrap' }}>
                  <code>{sdk.code}</code>
                </pre>
              </div>
              {/* Features */}
              <div style={{ padding: '24px 20px' }}>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.1em', fontFamily: 'JetBrains Mono, monospace', marginBottom: 12 }}>ВОЗМОЖНОСТИ</div>
                {sdk.features.map(f => (
                  <div key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13, color: 'rgba(255,255,255,0.7)', marginBottom: 10, lineHeight: 1.4 }}>
                    <Icon name="Check" size={13} style={{ color: sdk.color, flexShrink: 0, marginTop: 1 }} />
                    {f}
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}

        {/* CTA */}
        <div style={{ textAlign: 'center', padding: '48px', background: 'rgba(0,255,136,0.04)', border: '1px solid rgba(0,255,136,0.15)', borderRadius: 24 }}>
          <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 24, fontWeight: 700, marginBottom: 10 }}>Нет вашего языка?</h2>
          <p style={{ color: 'rgba(255,255,255,0.5)', marginBottom: 20 }}>Используйте REST API напрямую или напишите нам — добавим ваш язык в приоритет.</p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            <a href="/api-ref" style={{ padding: '12px 24px', borderRadius: 10, background: ACCENT, color: '#0A0A1A', fontWeight: 700, fontSize: 14, textDecoration: 'none' }}>API Reference</a>
            <a href="/contacts" style={{ padding: '12px 24px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.15)', color: '#fff', fontSize: 14, textDecoration: 'none' }}>Предложить язык</a>
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
