import { useState } from 'react';
import PageLayout from '@/components/PageLayout';
import Icon from '@/components/ui/icon';

const ACCENT = '#00FF88';

const EXAMPLES = [
  { label: 'Платёж низкого риска', body: JSON.stringify({ amount: 5000, from_currency: 'USD', to_currency: 'USDT', destination_address: '0xABCDEF1234567890abcdef1234567890abcdef12', destination_country: 'AE' }, null, 2), method: 'POST', path: '/payments' },
  { label: 'Платёж высокого риска', body: JSON.stringify({ amount: 500000, from_currency: 'USD', to_currency: 'USDT', destination_address: '0x8589427373D6D84E98730D7795D8f6f8731FDA16', destination_country: 'KP' }, null, 2), method: 'POST', path: '/payments' },
  { label: 'Проверка адреса', body: JSON.stringify({ address: '0x8589427373D6D84E98730D7795D8f6f8731FDA16', network: 'ETH' }, null, 2), method: 'POST', path: '/risk/check' },
];

export default function Sandbox() {
  const [apiKey, setApiKey] = useState('sk_test_sandbox_demo_key');
  const [method, setMethod] = useState('POST');
  const [path, setPath]     = useState('/payments');
  const [body, setBody]     = useState(EXAMPLES[0].body);
  const [response, setResponse] = useState('');
  const [loading, setLoading]   = useState(false);
  const [status, setStatus]     = useState<number | null>(null);

  const BASE = 'https://functions.poehali.dev/de6b941d-2574-4b57-b400-21d01b2b736a';
  const RISK  = 'https://functions.poehali.dev/410aaa09-451b-41e6-b66e-e0015ce8011c';

  const run = async () => {
    setLoading(true); setResponse(''); setStatus(null);
    try {
      let url = BASE;
      if (path.includes('risk')) url = RISK;

      let parsed: Record<string, unknown> = {};
      try { parsed = JSON.parse(body); } catch { setResponse('⚠️ Невалидный JSON в теле запроса'); setLoading(false); return; }

      const token = localStorage.getItem('most_auth_token') || '';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: method !== 'GET' ? JSON.stringify(parsed) : undefined,
      });
      const data = await res.json();
      setStatus(res.status);
      setResponse(JSON.stringify(data, null, 2));
    } catch (e) {
      setResponse(e instanceof Error ? e.message : 'Ошибка соединения');
    } finally {
      setLoading(false);
    }
  };

  const statusColor = status ? (status < 300 ? ACCENT : status < 500 ? '#FFAA00' : '#FF4444') : 'rgba(255,255,255,0.3)';

  return (
    <PageLayout active="/sandbox">
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '48px 24px' }}>

        {/* Header */}
        <div style={{ marginBottom: 40 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '4px 14px', borderRadius: 20, background: 'rgba(0,255,136,0.08)', border: '1px solid rgba(0,255,136,0.2)', fontSize: 12, color: ACCENT, fontFamily: 'JetBrains Mono, monospace', marginBottom: 16 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: ACCENT, animation: 'pulse 2s infinite', display: 'inline-block' }} />
            SANDBOX
          </div>
          <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 40, fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 10 }}>API Sandbox</h1>
          <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 16, maxWidth: 600 }}>
            Тестируйте API в браузере без регистрации. В Sandbox используются реальные эндпоинты, но тестовые данные.
          </p>
        </div>

        {/* Быстрые примеры */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
          {EXAMPLES.map(ex => (
            <button key={ex.label} onClick={() => { setBody(ex.body); setMethod(ex.method); setPath(ex.path); }}
              style={{ padding: '7px 14px', borderRadius: 9, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)', fontSize: 13, cursor: 'pointer', transition: 'all 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = ACCENT; e.currentTarget.style.color = ACCENT; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = 'rgba(255,255,255,0.7)'; }}>
              {ex.label}
            </button>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          {/* Левая — запрос */}
          <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', gap: 10 }}>
              <Icon name="Send" size={14} style={{ color: ACCENT }} />
              <span style={{ fontSize: 13, fontWeight: 600 }}>Запрос</span>
            </div>
            <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', display: 'block', marginBottom: 6, fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.1em' }}>API KEY</label>
                <input value={apiKey} onChange={e => setApiKey(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 9, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: ACCENT, fontSize: 13, outline: 'none', fontFamily: 'JetBrains Mono, monospace', boxSizing: 'border-box' }} />
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 4 }}>Или войдите, чтобы использовать ваш токен автоматически</div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <select value={method} onChange={e => setMethod(e.target.value)}
                  style={{ padding: '9px 12px', borderRadius: 9, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: 13, outline: 'none', cursor: 'pointer' }}>
                  {['GET','POST','PUT','DELETE'].map(m => <option key={m} value={m} style={{ background: '#0A0A1A' }}>{m}</option>)}
                </select>
                <input value={path} onChange={e => setPath(e.target.value)}
                  style={{ flex: 1, padding: '9px 12px', borderRadius: 9, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: 13, outline: 'none', fontFamily: 'JetBrains Mono, monospace', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', display: 'block', marginBottom: 6, fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.1em' }}>REQUEST BODY (JSON)</label>
                <textarea value={body} onChange={e => setBody(e.target.value)} rows={12}
                  style={{ width: '100%', padding: '12px', borderRadius: 10, background: '#050510', border: '1px solid rgba(255,255,255,0.1)', color: '#e2e8f0', fontSize: 12, outline: 'none', fontFamily: 'JetBrains Mono, monospace', lineHeight: 1.6, resize: 'vertical', boxSizing: 'border-box' }} />
              </div>
              <button onClick={run} disabled={loading}
                style={{ padding: '13px', borderRadius: 10, background: loading ? 'rgba(0,255,136,0.5)' : ACCENT, color: '#0A0A1A', fontWeight: 700, fontSize: 14, border: 'none', cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                {loading ? <><Icon name="Loader" size={15} style={{ animation: 'spin 1s linear infinite' }} /> Отправляем...</> : <><Icon name="Play" size={15} /> Отправить запрос</>}
              </button>
            </div>
          </div>

          {/* Правая — ответ */}
          <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', gap: 10 }}>
              <Icon name="Terminal" size={14} style={{ color: ACCENT }} />
              <span style={{ fontSize: 13, fontWeight: 600 }}>Ответ</span>
              {status && (
                <span style={{ marginLeft: 'auto', padding: '2px 10px', borderRadius: 6, background: `${statusColor}18`, color: statusColor, fontSize: 12, fontFamily: 'JetBrains Mono, monospace', fontWeight: 700 }}>
                  HTTP {status}
                </span>
              )}
            </div>
            <div style={{ padding: '16px 20px', height: 'calc(100% - 50px)' }}>
              {response ? (
                <pre style={{ margin: 0, fontSize: 12, color: status && status < 300 ? '#94e2b0' : status && status >= 400 ? '#fca5a5' : '#e2e8f0', fontFamily: 'JetBrains Mono, monospace', lineHeight: 1.6, overflow: 'auto', whiteSpace: 'pre-wrap', height: '100%' }}>
                  {response}
                </pre>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '300px', gap: 12, color: 'rgba(255,255,255,0.2)' }}>
                  <Icon name="Terminal" size={40} />
                  <span style={{ fontSize: 14 }}>Ответ появится здесь</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Примечание */}
        <div style={{ marginTop: 24, padding: '14px 20px', borderRadius: 12, background: 'rgba(255,170,0,0.06)', border: '1px solid rgba(255,170,0,0.2)', display: 'flex', gap: 12, alignItems: 'flex-start', fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>
          <Icon name="AlertCircle" size={16} style={{ color: '#FFAA00', flexShrink: 0, marginTop: 1 }} />
          <span>Sandbox использует реальные API-эндпоинты. Для работы платёжных операций нужна авторизация — <a href="/login" style={{ color: ACCENT }}>войдите в аккаунт</a>. Запросы к Risk Engine работают без авторизации.</span>
        </div>

        <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} } @keyframes spin { to{transform:rotate(360deg)} }`}</style>
      </div>
    </PageLayout>
  );
}
