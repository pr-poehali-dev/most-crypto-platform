import { useState, useEffect, useCallback } from 'react';
import Icon from '@/components/ui/icon';

const KYC_LIST_URL   = 'https://functions.poehali.dev/a78bff1e-7153-4cd3-9218-42d4d2a4126e';
const KYC_REVIEW_URL = 'https://functions.poehali.dev/21910779-f26a-42bf-9426-2b0866291889';
const KYC_NOTIFY_URL = 'https://functions.poehali.dev/b7cf34c9-30d3-4103-b36b-bce4bd64066e';

const ACCENT   = '#00FF88';
const BG       = '#0A0A1A';
const CARD_BOR = 'rgba(0,255,136,0.18)';

// ─── Типы ────────────────────────────────────────────────────────────────────
interface KycItem {
  id: string;
  user_email: string;
  company_name: string;
  inn: string;
  legal_address: string;
  ceo_name: string;
  phone: string;
  website: string | null;
  business_type: string;
  monthly_volume: string;
  status: string;
  doc_charter_url: string | null;
  doc_ceo_id_url: string | null;
  doc_extract_url: string | null;
  reject_reason: string | null;
  reviewed_by_email: string | null;
  reviewed_at: string | null;
  created_at: string;
}

interface ListResponse {
  total: number;
  limit: number;
  offset: number;
  pages: number;
  stats: Record<string, number>;
  items: KycItem[];
}

type ReviewState = 'idle' | 'loading' | 'done' | 'error';

// ─── Константы ───────────────────────────────────────────────────────────────
const VOLUME_LABELS: Record<string, string> = {
  '<100k': 'до $100K/мес',
  '100k-1m': '$100K–$1M/мес',
  '1m-10m': '$1M–$10M/мес',
  '>10m': 'свыше $10M/мес',
};
const BIZ_LABELS: Record<string, string> = {
  import: 'Импорт товаров',
  export: 'Экспорт товаров',
  services: 'Услуги / IT',
  trading: 'Торговля',
  investment: 'Инвестиции',
  other: 'Другое',
};
const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  pending_review: { label: 'На проверке', color: '#F3BA2F', bg: 'rgba(243,186,47,0.1)' },
  approved:       { label: 'Одобрено',    color: ACCENT,    bg: 'rgba(0,255,136,0.1)' },
  rejected:       { label: 'Отклонено',   color: '#ff4444', bg: 'rgba(255,68,68,0.1)'  },
};

// ─── Хелперы ─────────────────────────────────────────────────────────────────
const dimText = 'rgba(255,255,255,0.5)';

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function StatusBadge({ status }: { status: string }) {
  const m = STATUS_META[status] || { label: status, color: '#aaa', bg: 'rgba(255,255,255,0.05)' };
  return (
    <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20,
      color: m.color, background: m.bg, border: `1px solid ${m.color}44`,
      fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>
      {m.label}
    </span>
  );
}

// ─── Просмотр документа ──────────────────────────────────────────────────────
function DocViewer({ url, label }: { url: string | null; label: string }) {
  if (!url) {
    return (
      <div style={{ border: '1px dashed rgba(255,255,255,0.1)', borderRadius: 10, padding: '16px 12px',
        display: 'flex', alignItems: 'center', gap: 10, color: dimText, fontSize: 13 }}>
        <Icon name="FileMinus" size={18} style={{ color: 'rgba(255,255,255,0.2)' }} />
        <span>{label} — не загружен</span>
      </div>
    );
  }
  const isPdf = url.toLowerCase().includes('.pdf') || url.includes('pdf');
  return (
    <a href={url} target="_blank" rel="noopener noreferrer"
      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px',
        background: 'rgba(0,255,136,0.04)', border: `1px solid rgba(0,255,136,0.2)`,
        borderRadius: 10, textDecoration: 'none', transition: 'background 0.2s',
        color: '#fff', fontSize: 13 }}
      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,255,136,0.08)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'rgba(0,255,136,0.04)')}
    >
      <Icon name={isPdf ? 'FileText' : 'Image'} size={20} style={{ color: ACCENT, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 500, marginBottom: 2 }}>{label}</div>
        <div style={{ fontSize: 11, color: dimText, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {isPdf ? 'PDF-документ' : 'Изображение'} · Открыть в новой вкладке
        </div>
      </div>
      <Icon name="ExternalLink" size={14} style={{ color: dimText, flexShrink: 0 }} />
    </a>
  );
}

// ─── Модалка-детальная карточка ───────────────────────────────────────────────
function KycModal({ item, token, onClose, onDone }: {
  item: KycItem; token: string; onClose: () => void; onDone: () => void;
}) {
  const [action, setAction]       = useState<'approve' | 'reject' | null>(null);
  const [reason, setReason]       = useState('');
  const [state, setState]         = useState<ReviewState>('idle');
  const [errMsg, setErrMsg]       = useState('');
  const [confirmed, setConfirmed] = useState(false);

  const isPending = item.status === 'pending_review';

  const [notifyState, setNotifyState] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle');

  const submit = async () => {
    if (!action) return;
    if (action === 'reject' && !reason.trim()) { setErrMsg('Укажите причину отклонения'); return; }
    setState('loading');
    setErrMsg('');
    try {
      // 1. Записываем решение
      const res = await fetch(KYC_REVIEW_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ kyc_id: item.id, action, reason: reason.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);

      setState('done');

      // 2. Отправляем email-уведомление (fire-and-forget, не блокируем UI)
      setNotifyState('sending');
      fetch(KYC_NOTIFY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ kyc_id: item.id, action, reason: reason.trim() || undefined }),
      })
        .then(r => r.json())
        .then(d => setNotifyState(d.sent ? 'sent' : 'failed'))
        .catch(() => setNotifyState('failed'));

      setTimeout(() => { onClose(); onDone(); }, 1800);
    } catch (e) {
      setState('error');
      setErrMsg(e instanceof Error ? e.message : 'Ошибка');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto py-8 px-4"
      style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ width: '100%', maxWidth: 680, background: '#0f0f1f',
        border: `1px solid ${CARD_BOR}`, borderRadius: 20, overflow: 'hidden' }}>

        {/* Шапка */}
        <div style={{ padding: '20px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <div>
            <div style={{ fontSize: 11, color: dimText, fontFamily: 'JetBrains Mono, monospace',
              letterSpacing: '0.1em', marginBottom: 4 }}>KYC · {item.id.slice(0, 8).toUpperCase()}</div>
            <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 20, fontWeight: 700, margin: 0 }}>
              {item.company_name}
            </h2>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <StatusBadge status={item.status} />
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: dimText, cursor: 'pointer', padding: 4 }}>
              <Icon name="X" size={20} />
            </button>
          </div>
        </div>

        <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 24 }}>

          {/* Данные компании */}
          <section>
            <div style={{ fontSize: 11, fontFamily: 'JetBrains Mono, monospace', color: dimText,
              letterSpacing: '0.1em', marginBottom: 14 }}>ДАННЫЕ КОМПАНИИ</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0,
              border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, overflow: 'hidden' }}>
              {[
                { l: 'Email', v: item.user_email },
                { l: 'ИНН', v: item.inn },
                { l: 'Гендиректор', v: item.ceo_name },
                { l: 'Телефон', v: item.phone },
                { l: 'Адрес', v: item.legal_address },
                { l: 'Сайт', v: item.website || '—' },
                { l: 'Деятельность', v: BIZ_LABELS[item.business_type] || item.business_type },
                { l: 'Объём/мес', v: VOLUME_LABELS[item.monthly_volume] || item.monthly_volume },
                { l: 'Подано', v: fmtDate(item.created_at) },
                { l: 'Проверяющий', v: item.reviewed_by_email || '—' },
              ].map((row, i) => (
                <div key={row.l} style={{ padding: '10px 16px', display: 'flex', gap: 10, alignItems: 'flex-start',
                  borderBottom: i < 8 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                  borderRight: i % 2 === 0 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                  background: i % 4 < 2 ? 'rgba(255,255,255,0.01)' : 'transparent' }}>
                  <span style={{ fontSize: 12, color: dimText, width: 100, flexShrink: 0 }}>{row.l}</span>
                  <span style={{ fontSize: 13, color: '#fff', fontWeight: 500, wordBreak: 'break-all' }}>{row.v}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Документы */}
          <section>
            <div style={{ fontSize: 11, fontFamily: 'JetBrains Mono, monospace', color: dimText,
              letterSpacing: '0.1em', marginBottom: 14 }}>ДОКУМЕНТЫ KYC</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <DocViewer url={item.doc_charter_url}  label="Устав компании" />
              <DocViewer url={item.doc_ceo_id_url}   label="Паспорт генерального директора" />
              <DocViewer url={item.doc_extract_url}  label="Выписка из ЕГРЮЛ" />
            </div>
            {!item.doc_charter_url && !item.doc_ceo_id_url && !item.doc_extract_url && (
              <div style={{ marginTop: 8, fontSize: 12, color: dimText, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Icon name="AlertCircle" size={13} style={{ color: '#F3BA2F' }} />
                Компания не загрузила документы — запросите перед одобрением
              </div>
            )}
          </section>

          {/* Причина отклонения (если уже отклонена) */}
          {item.reject_reason && (
            <div style={{ background: 'rgba(255,68,68,0.07)', border: '1px solid rgba(255,68,68,0.25)',
              borderRadius: 10, padding: '14px 16px' }}>
              <div style={{ fontSize: 11, color: '#ff8888', fontFamily: 'JetBrains Mono, monospace',
                marginBottom: 6 }}>ПРИЧИНА ОТКЛОНЕНИЯ</div>
              <div style={{ fontSize: 13, color: '#ffaaaa' }}>{item.reject_reason}</div>
            </div>
          )}

          {/* Действия — только для pending */}
          {isPending && state !== 'done' && (
            <section>
              <div style={{ fontSize: 11, fontFamily: 'JetBrains Mono, monospace', color: dimText,
                letterSpacing: '0.1em', marginBottom: 14 }}>РЕШЕНИЕ</div>

              {/* Кнопки выбора действия */}
              {!action && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <button onClick={() => setAction('approve')} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    padding: '14px', borderRadius: 12, border: `1px solid rgba(0,255,136,0.3)`,
                    background: 'rgba(0,255,136,0.06)', color: ACCENT, fontSize: 15, fontWeight: 600,
                    cursor: 'pointer', transition: 'all 0.2s', fontFamily: "'Rubik', sans-serif",
                  }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,255,136,0.14)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'rgba(0,255,136,0.06)')}>
                    <Icon name="UserCheck" size={18} /> Верифицировать
                  </button>
                  <button onClick={() => setAction('reject')} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    padding: '14px', borderRadius: 12, border: '1px solid rgba(255,68,68,0.3)',
                    background: 'rgba(255,68,68,0.06)', color: '#ff6666', fontSize: 15, fontWeight: 600,
                    cursor: 'pointer', transition: 'all 0.2s', fontFamily: "'Rubik', sans-serif",
                  }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,68,68,0.14)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,68,68,0.06)')}>
                    <Icon name="UserX" size={18} /> Отклонить
                  </button>
                </div>
              )}

              {/* Подтверждение одобрения */}
              {action === 'approve' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14,
                  background: 'rgba(0,255,136,0.05)', border: `1px solid rgba(0,255,136,0.2)`,
                  borderRadius: 12, padding: '20px' }}>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <Icon name="ShieldCheck" size={18} style={{ color: ACCENT, flexShrink: 0, marginTop: 1 }} />
                    <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', lineHeight: 1.6, margin: 0 }}>
                      Компания получит статус <strong style={{ color: ACCENT }}>active</strong> и доступ к платформе. Действие записывается в аудит-лог.
                    </p>
                  </div>
                  <label style={{ display: 'flex', gap: 10, alignItems: 'center', cursor: 'pointer', fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>
                    <div onClick={() => setConfirmed(c => !c)} style={{
                      width: 18, height: 18, borderRadius: 4, border: `2px solid ${confirmed ? ACCENT : 'rgba(255,255,255,0.25)'}`,
                      background: confirmed ? ACCENT : 'transparent', display: 'grid', placeItems: 'center',
                      cursor: 'pointer', flexShrink: 0, transition: 'all 0.2s',
                    }}>
                      {confirmed && <Icon name="Check" size={11} style={{ color: BG }} />}
                    </div>
                    Я проверил документы и подтверждаю верификацию
                  </label>
                  {errMsg && <div style={{ fontSize: 12, color: '#ff8888', display: 'flex', gap: 6 }}><Icon name="AlertCircle" size={13} />{errMsg}</div>}
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button onClick={() => { setAction(null); setConfirmed(false); }}
                      style={{ flex: 1, padding: '11px', borderRadius: 10, background: 'transparent', border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontFamily: "'Rubik', sans-serif" }}>
                      Назад
                    </button>
                    <button onClick={submit} disabled={!confirmed || state === 'loading'}
                      style={{ flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                        padding: '11px', borderRadius: 10, background: confirmed ? ACCENT : 'rgba(0,255,136,0.3)',
                        color: confirmed ? BG : 'rgba(255,255,255,0.4)', border: 'none',
                        fontWeight: 700, fontSize: 14, cursor: confirmed ? 'pointer' : 'not-allowed',
                        fontFamily: "'Rubik', sans-serif", transition: 'all 0.2s' }}>
                      {state === 'loading' ? <><Icon name="Loader" size={16} style={{ animation: 'spin 1s linear infinite' }} /> Сохраняем...</> : <><Icon name="UserCheck" size={16} /> Верифицировать</>}
                    </button>
                  </div>
                </div>
              )}

              {/* Форма отклонения */}
              {action === 'reject' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14,
                  background: 'rgba(255,68,68,0.05)', border: '1px solid rgba(255,68,68,0.2)',
                  borderRadius: 12, padding: '20px' }}>
                  <label style={{ fontSize: 12, color: dimText, letterSpacing: '0.05em' }}>
                    ПРИЧИНА ОТКЛОНЕНИЯ <span style={{ color: '#ff6666' }}>*</span>
                  </label>
                  <textarea
                    value={reason}
                    onChange={e => { setReason(e.target.value); setErrMsg(''); }}
                    placeholder="Опишите причину: недостаточно документов, несоответствие ИНН, санкционные риски..."
                    rows={3}
                    style={{ width: '100%', padding: '12px 14px', borderRadius: 10, fontSize: 13,
                      background: 'rgba(255,255,255,0.04)', border: `1px solid ${errMsg ? '#ff4444' : 'rgba(255,255,255,0.1)'}`,
                      color: '#fff', resize: 'vertical', outline: 'none', boxSizing: 'border-box',
                      fontFamily: "'Rubik', sans-serif" }}
                  />
                  {errMsg && <div style={{ fontSize: 12, color: '#ff8888', display: 'flex', gap: 6 }}><Icon name="AlertCircle" size={13} />{errMsg}</div>}
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button onClick={() => { setAction(null); setReason(''); setErrMsg(''); }}
                      style={{ flex: 1, padding: '11px', borderRadius: 10, background: 'transparent', border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontFamily: "'Rubik', sans-serif" }}>
                      Назад
                    </button>
                    <button onClick={submit} disabled={state === 'loading'}
                      style={{ flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                        padding: '11px', borderRadius: 10, background: '#cc3333', color: '#fff',
                        border: 'none', fontWeight: 700, fontSize: 14, cursor: 'pointer',
                        fontFamily: "'Rubik', sans-serif" }}>
                      {state === 'loading' ? <><Icon name="Loader" size={16} style={{ animation: 'spin 1s linear infinite' }} /> Сохраняем...</> : <><Icon name="UserX" size={16} /> Отклонить заявку</>}
                    </button>
                  </div>
                </div>
              )}
            </section>
          )}

          {state === 'done' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 20px',
                background: 'rgba(0,255,136,0.08)', border: `1px solid rgba(0,255,136,0.3)`, borderRadius: 12 }}>
                <Icon name="CheckCircle2" size={20} style={{ color: ACCENT }} />
                <span style={{ fontSize: 14, color: ACCENT, fontWeight: 600 }}>
                  {action === 'approve' ? 'Компания верифицирована!' : 'Заявка отклонена'}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px',
                background: notifyState === 'sent' ? 'rgba(0,255,136,0.05)'
                          : notifyState === 'failed' ? 'rgba(255,68,68,0.05)'
                          : 'rgba(255,255,255,0.03)',
                border: `1px solid ${notifyState === 'sent' ? 'rgba(0,255,136,0.2)'
                                    : notifyState === 'failed' ? 'rgba(255,68,68,0.2)'
                                    : 'rgba(255,255,255,0.08)'}`,
                borderRadius: 10 }}>
                {notifyState === 'sending' && <Icon name="Loader" size={15} style={{ color: 'rgba(255,255,255,0.4)', animation: 'spin 1s linear infinite' }} />}
                {notifyState === 'sent'    && <Icon name="Mail" size={15} style={{ color: ACCENT }} />}
                {notifyState === 'failed'  && <Icon name="MailX" size={15} style={{ color: '#ff8888' }} />}
                {notifyState === 'idle'    && <Icon name="Mail" size={15} style={{ color: 'rgba(255,255,255,0.3)' }} />}
                <span style={{ fontSize: 13, color: notifyState === 'sent' ? ACCENT
                                                   : notifyState === 'failed' ? '#ff8888'
                                                   : 'rgba(255,255,255,0.45)' }}>
                  {notifyState === 'sending' ? 'Отправляем уведомление клиенту...'
                  : notifyState === 'sent'   ? `Email отправлен: ${item.user_email}`
                  : notifyState === 'failed' ? 'Уведомление не отправлено (проверьте SMTP_URL)'
                  : 'Подготовка уведомления...'}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Форма логина (auth-gate) ─────────────────────────────────────────────────
function LoginGate({ onAuth }: { onAuth: (token: string) => void }) {
  const [email, setEmail]     = useState('');
  const [password, setPass]   = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr]         = useState('');

  const LOGIN_URL = 'https://functions.poehali.dev/9cec00cd-a2d5-4d4a-96b8-ddb169426cc6';

  const login = async () => {
    setLoading(true); setErr('');
    try {
      const res = await fetch(LOGIN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Ошибка входа');
      if (!data.access_token) throw new Error('Нет токена в ответе');
      localStorage.setItem('compliance_token', data.access_token);
      onAuth(data.access_token);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Ошибка');
    } finally {
      setLoading(false);
    }
  };

  const inputSt: React.CSSProperties = {
    width: '100%', padding: '12px 16px', borderRadius: 10, fontSize: 14,
    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)',
    color: '#fff', outline: 'none', boxSizing: 'border-box', fontFamily: "'Rubik', sans-serif",
  };

  return (
    <div style={{ background: BG, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, background: 'rgba(0,255,136,0.1)',
            border: `1px solid ${CARD_BOR}`, display: 'grid', placeItems: 'center', margin: '0 auto 16px' }}>
            <Icon name="ShieldCheck" size={26} style={{ color: ACCENT }} />
          </div>
          <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 26, fontWeight: 700, marginBottom: 6, color: '#fff' }}>
            Compliance Panel
          </h1>
          <p style={{ fontSize: 14, color: dimText }}>MOST · Верификация KYC-заявок</p>
        </div>
        <div style={{ background: 'rgba(255,255,255,0.02)', border: `1px solid ${CARD_BOR}`,
          borderRadius: 16, padding: '28px 28px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, color: dimText, marginBottom: 6 }}>Email</label>
            <input style={inputSt} type="email" placeholder="compliance@most.network"
              value={email} onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && login()}
              onFocus={e => (e.target.style.borderColor = ACCENT)}
              onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.12)')} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, color: dimText, marginBottom: 6 }}>Пароль</label>
            <input style={inputSt} type="password" placeholder="••••••••"
              value={password} onChange={e => setPass(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && login()}
              onFocus={e => (e.target.style.borderColor = ACCENT)}
              onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.12)')} />
          </div>
          {err && <div style={{ fontSize: 13, color: '#ff8888', display: 'flex', gap: 6 }}><Icon name="AlertCircle" size={14} />{err}</div>}
          <button onClick={login} disabled={loading} style={{
            padding: '12px', borderRadius: 10, background: ACCENT, border: 'none',
            color: BG, fontWeight: 700, fontSize: 15, cursor: 'pointer',
            boxShadow: `0 0 20px rgba(0,255,136,0.3)`, fontFamily: "'Rubik', sans-serif",
          }}>
            {loading ? 'Входим...' : 'Войти в панель'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Главная страница ─────────────────────────────────────────────────────────
export default function Compliance() {
  const [token, setToken]       = useState(() => localStorage.getItem('compliance_token') || '');
  const [data, setData]         = useState<ListResponse | null>(null);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [selected, setSelected] = useState<KycItem | null>(null);
  const [statusFilter, setStatusFilter] = useState('pending_review');
  const [search, setSearch]     = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [offset, setOffset]     = useState(0);
  const LIMIT = 20;

  // Дебаунс поиска
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  const fetchList = useCallback(async () => {
    if (!token) return;
    setLoading(true); setError('');
    try {
      const params = new URLSearchParams({
        status: statusFilter, limit: String(LIMIT), offset: String(offset),
        ...(debouncedSearch ? { search: debouncedSearch } : {}),
      });
      const res = await fetch(`${KYC_LIST_URL}?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const d = await res.json();
      if (res.status === 401 || res.status === 403) {
        localStorage.removeItem('compliance_token');
        setToken('');
        return;
      }
      if (!res.ok) throw new Error(d.error || `HTTP ${res.status}`);
      setData(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  }, [token, statusFilter, debouncedSearch, offset]);

  useEffect(() => { fetchList(); }, [fetchList]);

  if (!token) return <LoginGate onAuth={t => { setToken(t); localStorage.setItem('compliance_token', t); }} />;

  const stats   = data?.stats || {};
  const items   = data?.items || [];
  const total   = data?.total || 0;
  const pages   = data?.pages || 1;
  const curPage = Math.floor(offset / LIMIT) + 1;

  return (
    <div style={{ background: BG, minHeight: '100vh', color: '#fff', fontFamily: "'Rubik', sans-serif" }}>
      {/* Фон */}
      <div style={{ position: 'fixed', inset: 0, opacity: 0.08,
        backgroundImage: `linear-gradient(rgba(0,255,136,0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(0,255,136,0.15) 1px, transparent 1px)`,
        backgroundSize: '48px 48px', pointerEvents: 'none' }} />

      {selected && (
        <KycModal item={selected} token={token}
          onClose={() => setSelected(null)}
          onDone={fetchList} />
      )}

      {/* Nav */}
      <nav style={{ position: 'sticky', top: 0, zIndex: 40, padding: '0 24px', height: 60,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: 'rgba(10,10,26,0.9)', backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <a href="/" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: ACCENT, display: 'grid',
              placeItems: 'center', fontWeight: 700, fontSize: 15, color: BG,
              fontFamily: "'Space Grotesk', sans-serif" }}>M</div>
            <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 17, color: '#fff' }}>MOST</span>
          </a>
          <span style={{ fontSize: 12, color: dimText, padding: '3px 10px',
            background: 'rgba(0,255,136,0.08)', border: `1px solid ${CARD_BOR}`,
            borderRadius: 20, fontFamily: 'JetBrains Mono, monospace' }}>COMPLIANCE</span>
        </div>
        <button onClick={() => { localStorage.removeItem('compliance_token'); setToken(''); }}
          style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none',
            border: 'none', color: dimText, cursor: 'pointer', fontSize: 13 }}>
          <Icon name="LogOut" size={15} /> Выйти
        </button>
      </nav>

      <div style={{ position: 'relative', maxWidth: 1100, margin: '0 auto', padding: '32px 24px 64px' }}>

        {/* Заголовок + статистика */}
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 28, fontWeight: 700,
            letterSpacing: '-0.02em', marginBottom: 20 }}>Очередь KYC-верификации</h1>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {[
              { k: 'pending_review', label: 'На проверке', icon: 'Clock', color: '#F3BA2F' },
              { k: 'approved',       label: 'Одобрено',    icon: 'UserCheck', color: ACCENT },
              { k: 'rejected',       label: 'Отклонено',   icon: 'UserX',     color: '#ff6666' },
            ].map(s => (
              <div key={s.k} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 20px',
                background: statusFilter === s.k ? `${s.color}10` : 'rgba(255,255,255,0.02)',
                border: `1px solid ${statusFilter === s.k ? `${s.color}40` : 'rgba(255,255,255,0.08)'}`,
                borderRadius: 12, cursor: 'pointer', transition: 'all 0.2s' }}
                onClick={() => { setStatusFilter(s.k); setOffset(0); }}>
                <Icon name={s.icon} size={16} style={{ color: s.color }} />
                <span style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>{s.label}</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: s.color,
                  fontFamily: 'JetBrains Mono, monospace' }}>{stats[s.k] ?? 0}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Поиск */}
        <div style={{ position: 'relative', marginBottom: 20 }}>
          <Icon name="Search" size={16} style={{ position: 'absolute', left: 14, top: '50%',
            transform: 'translateY(-50%)', color: dimText, pointerEvents: 'none' }} />
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setOffset(0); }}
            placeholder="Поиск по названию, ИНН, email..."
            style={{ width: '100%', padding: '11px 16px 11px 42px', borderRadius: 12, fontSize: 14,
              background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)',
              color: '#fff', outline: 'none', boxSizing: 'border-box', fontFamily: "'Rubik', sans-serif" }}
            onFocus={e => (e.target.style.borderColor = ACCENT)}
            onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.1)')}
          />
          {search && (
            <button onClick={() => setSearch('')}
              style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', color: dimText, cursor: 'pointer', padding: 4 }}>
              <Icon name="X" size={14} />
            </button>
          )}
        </div>

        {/* Таблица */}
        {error && (
          <div style={{ background: 'rgba(255,68,68,0.08)', border: '1px solid rgba(255,68,68,0.25)',
            borderRadius: 12, padding: '14px 18px', color: '#ff8888', fontSize: 13,
            display: 'flex', gap: 10, marginBottom: 16 }}>
            <Icon name="AlertTriangle" size={16} /> {error}
            <button onClick={fetchList} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#ff8888', cursor: 'pointer', textDecoration: 'underline', fontSize: 13 }}>Повторить</button>
          </div>
        )}

        <div style={{ background: 'rgba(255,255,255,0.02)', border: `1px solid ${CARD_BOR}`,
          borderRadius: 16, overflow: 'hidden' }}>

          {/* Шапка таблицы */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px 140px 130px 120px 56px',
            gap: 8, padding: '12px 20px', borderBottom: '1px solid rgba(255,255,255,0.07)',
            fontSize: 11, color: dimText, fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.1em' }}>
            <span>КОМПАНИЯ / EMAIL</span>
            <span>ИНН</span>
            <span>ДЕЯТЕЛЬНОСТЬ</span>
            <span>ОБЪЁМ</span>
            <span>ПОДАНО</span>
            <span></span>
          </div>

          {/* Строки */}
          {loading && !items.length ? (
            <div style={{ padding: '48px', textAlign: 'center', color: dimText }}>
              <Icon name="Loader" size={24} style={{ animation: 'spin 1s linear infinite', marginBottom: 12 }} />
              <div>Загрузка заявок...</div>
            </div>
          ) : items.length === 0 ? (
            <div style={{ padding: '64px', textAlign: 'center' }}>
              <Icon name="CheckCircle2" size={40} style={{ color: ACCENT, marginBottom: 12, opacity: 0.5 }} />
              <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>Очередь пуста</div>
              <div style={{ fontSize: 14, color: dimText }}>Нет заявок со статусом «{statusFilter === 'pending_review' ? 'На проверке' : statusFilter}»</div>
            </div>
          ) : (
            <div style={{ opacity: loading ? 0.5 : 1, transition: 'opacity 0.2s' }}>
              {items.map((item, i) => (
                <div key={item.id}
                  style={{ display: 'grid', gridTemplateColumns: '1fr 120px 140px 130px 120px 56px',
                    gap: 8, padding: '14px 20px', alignItems: 'center',
                    borderBottom: i < items.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                    transition: 'background 0.15s', cursor: 'pointer' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  onClick={() => setSelected(item)}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 3, overflow: 'hidden',
                      textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.company_name}</div>
                    <div style={{ fontSize: 12, color: dimText, overflow: 'hidden',
                      textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.user_email}</div>
                  </div>
                  <span style={{ fontSize: 12, fontFamily: 'JetBrains Mono, monospace', color: dimText }}>{item.inn}</span>
                  <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {BIZ_LABELS[item.business_type] || item.business_type}
                  </span>
                  <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>
                    {VOLUME_LABELS[item.monthly_volume] || item.monthly_volume}
                  </span>
                  <span style={{ fontSize: 11, color: dimText, fontFamily: 'JetBrains Mono, monospace' }}>
                    {fmtDate(item.created_at)}
                  </span>
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <Icon name="ChevronRight" size={16} style={{ color: dimText }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Пагинация */}
        {pages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}>
            <span style={{ fontSize: 12, color: dimText, fontFamily: 'JetBrains Mono, monospace' }}>
              Страница {curPage} из {pages} · {total} заявок
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setOffset(o => Math.max(0, o - LIMIT))} disabled={offset === 0}
                style={{ padding: '8px 14px', borderRadius: 8, background: 'transparent',
                  border: '1px solid rgba(255,255,255,0.12)', color: offset === 0 ? dimText : '#fff',
                  cursor: offset === 0 ? 'not-allowed' : 'pointer', fontSize: 13 }}>
                ← Пред.
              </button>
              <button onClick={() => setOffset(o => o + LIMIT)} disabled={curPage >= pages}
                style={{ padding: '8px 14px', borderRadius: 8, background: 'transparent',
                  border: '1px solid rgba(255,255,255,0.12)', color: curPage >= pages ? dimText : '#fff',
                  cursor: curPage >= pages ? 'not-allowed' : 'pointer', fontSize: 13 }}>
                След. →
              </button>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        input::placeholder { color: rgba(255,255,255,0.2); }
        textarea::placeholder { color: rgba(255,255,255,0.2); }
      `}</style>
    </div>
  );
}