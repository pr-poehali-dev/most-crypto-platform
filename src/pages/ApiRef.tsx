import { useState } from 'react';
import PageLayout from '@/components/PageLayout';

const ACCENT = '#00FF88';

type Method = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
const METHOD_COLORS: Record<Method, string> = { GET: '#4D9FFF', POST: ACCENT, PUT: '#FFAA00', DELETE: '#FF4444', PATCH: '#A855F7' };

interface Endpoint {
  method: Method;
  path: string;
  desc: string;
  auth: boolean;
  params?: { name: string; type: string; req: boolean; desc: string }[];
  response: string;
}

const ENDPOINTS: { group: string; icon: string; items: Endpoint[] }[] = [
  {
    group: 'Аутентификация',
    icon: '🔐',
    items: [
      {
        method: 'POST',
        path: '/auth/login',
        desc: 'Получить JWT-токен по email и паролю',
        auth: false,
        params: [
          { name: 'email', type: 'string', req: true, desc: 'Email пользователя' },
          { name: 'password', type: 'string', req: true, desc: 'Пароль (минимум 8 символов)' },
        ],
        response: `{
  "access_token": "eyJhbGciOiJIUzI1NiJ9...",
  "token_type": "Bearer",
  "expires_in": 86400,
  "user": {
    "id": "uuid",
    "email": "user@company.com",
    "role": "user",
    "status": "active"
  }
}`,
      },
    ],
  },
  {
    group: 'Платежи',
    icon: '💸',
    items: [
      {
        method: 'POST',
        path: '/payments',
        desc: 'Создать новый платёж',
        auth: true,
        params: [
          { name: 'amount', type: 'number', req: true, desc: 'Сумма в from_currency' },
          { name: 'from_currency', type: 'string', req: true, desc: 'USD | EUR | RUB' },
          { name: 'to_currency', type: 'string', req: true, desc: 'USDT | USDC | BTC | ETH | TON' },
          { name: 'destination_address', type: 'string', req: true, desc: 'Адрес кошелька получателя' },
          { name: 'destination_country', type: 'string', req: false, desc: 'ISO-код страны (TR, AE, CN...)' },
        ],
        response: `{
  "id": "pay_01J4XYZ",
  "status": "processing",
  "risk_score": 12,
  "risk_level": "low",
  "created_at": "2026-07-02T12:00:00Z",
  "message": "Платёж принят в обработку"
}`,
      },
      {
        method: 'GET',
        path: '/payments',
        desc: 'Список платежей текущего пользователя',
        auth: true,
        params: [
          { name: 'limit', type: 'integer', req: false, desc: 'Количество записей (1-100, default 20)' },
          { name: 'offset', type: 'integer', req: false, desc: 'Смещение для пагинации' },
          { name: 'status', type: 'string', req: false, desc: 'Фильтр по статусу' },
        ],
        response: `{
  "items": [...],
  "total": 247,
  "limit": 20,
  "offset": 0
}`,
      },
      {
        method: 'GET',
        path: '/payments/{id}',
        desc: 'Получить детали конкретного платежа',
        auth: true,
        params: [],
        response: `{
  "id": "pay_01J4XYZ",
  "status": "completed",
  "amount": 1000000,
  "from_currency": "USD",
  "to_currency": "USDT",
  "destination_address": "0x...",
  "destination_country": "TR",
  "risk_score": 12,
  "swarm_agents": 5000,
  "delivery_time_ms": 12400,
  "created_at": "...",
  "completed_at": "..."
}`,
      },
    ],
  },
  {
    group: 'AML / Risk Engine',
    icon: '🛡',
    items: [
      {
        method: 'POST',
        path: '/risk/check',
        desc: 'Проверить адрес кошелька на риск',
        auth: false,
        params: [
          { name: 'address', type: 'string', req: true, desc: 'Адрес кошелька (0x..., T..., bc1...)' },
          { name: 'network', type: 'string', req: false, desc: 'ETH | BTC | USDT | TRX | TON' },
        ],
        response: `{
  "address": "0x...",
  "network": "USDT",
  "risk_score": 45,
  "is_sanctioned": false,
  "is_mixer": false,
  "recommendation": "MANUAL_REVIEW",
  "reasons": ["Аномальный поведенческий паттерн"]
}`,
      },
    ],
  },
  {
    group: 'Webhooks',
    icon: '🔔',
    items: [
      {
        method: 'POST',
        path: '/webhooks',
        desc: 'Зарегистрировать webhook-endpoint',
        auth: true,
        params: [
          { name: 'url', type: 'string', req: true, desc: 'HTTPS URL для получения событий' },
          { name: 'events', type: 'array', req: true, desc: 'payment.completed | payment.failed | payment.aml_pending' },
          { name: 'secret', type: 'string', req: false, desc: 'Секрет для проверки подписи HMAC-SHA256' },
        ],
        response: `{
  "id": "wh_01J4ABC",
  "url": "https://your-server.com/webhook",
  "events": ["payment.completed"],
  "created_at": "..."
}`,
      },
    ],
  },
];

const ERRORS = [
  { code: '200', label: 'OK', desc: 'Успешно' },
  { code: '201', label: 'Created', desc: 'Ресурс создан' },
  { code: '400', label: 'Bad Request', desc: 'Ошибка валидации параметров' },
  { code: '401', label: 'Unauthorized', desc: 'Токен отсутствует или истёк' },
  { code: '403', label: 'Forbidden', desc: 'Недостаточно прав' },
  { code: '404', label: 'Not Found', desc: 'Ресурс не найден' },
  { code: '409', label: 'Conflict', desc: 'Конфликт (дублирование)' },
  { code: '429', label: 'Too Many Requests', desc: 'Превышен rate limit' },
  { code: '500', label: 'Internal Error', desc: 'Серверная ошибка' },
];

export default function ApiRef() {
  const [expanded, setExpanded] = useState<string | null>('POST /payments');

  return (
    <PageLayout active="/api-ref">
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '48px 24px' }}>

        {/* Header */}
        <div style={{ marginBottom: 48 }}>
          <div style={{ display: 'inline-block', padding: '3px 12px', borderRadius: 20, background: 'rgba(0,255,136,0.08)', border: '1px solid rgba(0,255,136,0.2)', fontSize: 11, color: ACCENT, fontFamily: 'JetBrains Mono, monospace', marginBottom: 16 }}>REST API</div>
          <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 40, fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 12 }}>API Reference</h1>
          <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 16, lineHeight: 1.7, maxWidth: 600, marginBottom: 24 }}>
            Base URL: <code style={{ background: 'rgba(255,255,255,0.07)', padding: '2px 8px', borderRadius: 6, fontSize: 14, fontFamily: 'JetBrains Mono, monospace', color: ACCENT }}>https://api.most.network/v1</code>
          </p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {[
              { label: 'Аутентификация', desc: 'Bearer JWT в заголовке Authorization' },
              { label: 'Content-Type', desc: 'application/json' },
              { label: 'Rate Limit', desc: '100 req/min (Starter), 1000 (Business+)' },
            ].map(i => (
              <div key={i.label} style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', fontSize: 12 }}>
                <span style={{ color: 'rgba(255,255,255,0.4)' }}>{i.label}: </span>
                <span style={{ color: 'rgba(255,255,255,0.75)', fontFamily: 'JetBrains Mono, monospace' }}>{i.desc}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Endpoints */}
        {ENDPOINTS.map(group => (
          <div key={group.group} style={{ marginBottom: 40 }}>
            <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 20, fontWeight: 700, marginBottom: 16 }}>
              {group.icon} {group.group}
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {group.items.map(ep => {
                const key = `${ep.method} ${ep.path}`;
                const isOpen = expanded === key;
                const mc = METHOD_COLORS[ep.method];
                return (
                  <div key={key} style={{ border: `1px solid ${isOpen ? mc + '44' : 'rgba(255,255,255,0.08)'}`, borderRadius: 12, overflow: 'hidden', transition: 'border-color 0.2s' }}>
                    <button onClick={() => setExpanded(isOpen ? null : key)} style={{ width: '100%', padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 14, background: isOpen ? `${mc}0a` : 'rgba(255,255,255,0.02)', border: 'none', cursor: 'pointer', textAlign: 'left', transition: 'background 0.2s' }}>
                      <span style={{ padding: '3px 10px', borderRadius: 6, background: `${mc}20`, color: mc, fontSize: 11, fontWeight: 700, fontFamily: 'JetBrains Mono, monospace', flexShrink: 0 }}>{ep.method}</span>
                      <code style={{ fontSize: 14, color: '#fff', fontFamily: 'JetBrains Mono, monospace', flex: 1 }}>{ep.path}</code>
                      <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)' }}>{ep.desc}</span>
                      {ep.auth && <span style={{ padding: '2px 8px', borderRadius: 5, background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.35)', fontSize: 11, fontFamily: 'JetBrains Mono, monospace', flexShrink: 0 }}>AUTH</span>}
                    </button>

                    {isOpen && (
                      <div style={{ padding: '0 20px 20px', background: 'rgba(0,0,0,0.15)' }}>
                        {ep.params && ep.params.length > 0 && (
                          <>
                            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.1em', fontFamily: 'JetBrains Mono, monospace', margin: '16px 0 10px' }}>ПАРАМЕТРЫ</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                              {ep.params.map(p => (
                                <div key={p.name} style={{ display: 'grid', gridTemplateColumns: '160px 80px 60px 1fr', gap: 12, padding: '8px 12px', background: 'rgba(255,255,255,0.02)', borderRadius: 8, fontSize: 13, alignItems: 'center' }}>
                                  <code style={{ fontFamily: 'JetBrains Mono, monospace', color: mc }}>{p.name}</code>
                                  <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }}>{p.type}</span>
                                  <span style={{ fontSize: 11, color: p.req ? '#FF4444' : 'rgba(255,255,255,0.3)' }}>{p.req ? 'required' : 'optional'}</span>
                                  <span style={{ color: 'rgba(255,255,255,0.6)' }}>{p.desc}</span>
                                </div>
                              ))}
                            </div>
                          </>
                        )}
                        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.1em', fontFamily: 'JetBrains Mono, monospace', margin: '16px 0 10px' }}>ОТВЕТ 200</div>
                        <pre style={{ margin: 0, padding: '14px 16px', background: '#050510', borderRadius: 10, fontSize: 12, color: '#94e2b0', fontFamily: 'JetBrains Mono, monospace', lineHeight: 1.6, overflow: 'auto', whiteSpace: 'pre-wrap' }}>{ep.response}</pre>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {/* Коды ошибок */}
        <div style={{ marginTop: 48 }}>
          <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 20, fontWeight: 700, marginBottom: 16 }}>⚠️ Коды ошибок</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
            {ERRORS.map(e => (
              <div key={e.code} style={{ padding: '12px 16px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, display: 'flex', gap: 12, alignItems: 'center' }}>
                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 14, fontWeight: 700, color: e.code.startsWith('2') ? ACCENT : e.code.startsWith('4') ? '#FFAA00' : '#FF4444', flexShrink: 0 }}>{e.code}</span>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 2 }}>{e.label}</div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>{e.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </PageLayout>
  );
}
