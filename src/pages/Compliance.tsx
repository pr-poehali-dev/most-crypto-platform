import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '@/components/ui/icon';
import { useAuth } from '@/context/AuthContext';

const KYC_LIST_URL    = 'https://functions.poehali.dev/a78bff1e-7153-4cd3-9218-42d4d2a4126e';
const KYC_REVIEW_URL  = 'https://functions.poehali.dev/21910779-f26a-42bf-9426-2b0866291889';
const KYC_NOTIFY_URL  = 'https://functions.poehali.dev/b7cf34c9-30d3-4103-b36b-bce4bd64066e';
const PENDING_PAY_URL = 'https://functions.poehali.dev/30cbda0e-a401-4771-99ae-9526937b05db';
const APPROVE_PAY_URL = 'https://functions.poehali.dev/9cec00cd-a2d5-4d4a-96b8-ddb169426cc6';

const ACCENT   = '#00FF88';
const BG       = '#0A0A1A';
const CARD_BOR = 'rgba(0,255,136,0.18)';
const dimText  = 'rgba(255,255,255,0.5)';

// ─── KYC-типы ─────────────────────────────────────────────────────────────────
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

// ─── AML-типы ─────────────────────────────────────────────────────────────────
interface AmlPayment {
  id: string;
  user_email: string;
  user_company: string | null;
  from_currency: string;
  to_currency: string;
  amount: number;
  destination_country: string | null;
  destination_address: string;
  risk_score: number;
  risk_level: string;
  created_at: string | null;
}

interface AmlListResponse {
  items: AmlPayment[];
  total: number;
  limit: number;
  offset: number;
}

// ─── Константы ────────────────────────────────────────────────────────────────
const VOLUME_LABELS: Record<string, string> = {
  '<100k':   'до $100K/мес',
  '100k-1m': '$100K–$1M/мес',
  '1m-10m':  '$1M–$10M/мес',
  '>10m':    'свыше $10M/мес',
};
const BIZ_LABELS: Record<string, string> = {
  import:     'Импорт товаров',
  export:     'Экспорт товаров',
  services:   'Услуги / IT',
  trading:    'Торговля',
  investment: 'Инвестиции',
  other:      'Другое',
};
const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  pending_review: { label: 'На проверке', color: '#F3BA2F', bg: 'rgba(243,186,47,0.1)' },
  approved:       { label: 'Одобрено',    color: ACCENT,    bg: 'rgba(0,255,136,0.1)'  },
  rejected:       { label: 'Отклонено',   color: '#ff4444', bg: 'rgba(255,68,68,0.1)'  },
};

// ─── Хелперы ──────────────────────────────────────────────────────────────────
function fmtDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('ru-RU', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}

function StatusBadge({ status }: { status: string }) {
  const m = STATUS_META[status] || { label: status, color: '#aaa', bg: 'rgba(255,255,255,0.05)' };
  return (
    <span style={{
      fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20,
      color: m.color, background: m.bg, border: `1px solid ${m.color}44`,
      fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.06em', whiteSpace: 'nowrap',
    }}>
      {m.label}
    </span>
  );
}

function DocViewer({ url, label }: { url: string | null; label: string }) {
  if (!url) {
    return (
      <div style={{
        border: '1px dashed rgba(255,255,255,0.1)', borderRadius: 10, padding: '16px 12px',
        display: 'flex', alignItems: 'center', gap: 10, color: dimText, fontSize: 13,
      }}>
        <Icon name="FileMinus" size={18} style={{ color: 'rgba(255,255,255,0.2)' }} />
        <span>{label} — не загружен</span>
      </div>
    );
  }
  const isPdf = url.toLowerCase().includes('.pdf') || url.includes('pdf');
  return (
    <a href={url} target="_blank" rel="noopener noreferrer"
      style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px',
        background: 'rgba(0,255,136,0.04)', border: '1px solid rgba(0,255,136,0.2)',
        borderRadius: 10, textDecoration: 'none', transition: 'background 0.2s',
        color: '#fff', fontSize: 13,
      }}
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

// ─── KYC-модалка ──────────────────────────────────────────────────────────────
function KycModal({ item, token, onClose, onDone }: {
  item: KycItem; token: string; onClose: () => void; onDone: () => void;
}) {
  const [action, setAction] = useState<'approve' | 'reject' | null>(null);
  const [reason, setReason] = useState('');
  const [state,  setState]  = useState<ReviewState>('idle');
  const [errMsg, setErrMsg] = useState('');
  const [notifyState, setNotifyState] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle');

  const isPending = item.status === 'pending_review';

  const submit = async () => {
    if (!action) return;
    if (action === 'reject' && !reason.trim()) { setErrMsg('Укажите причину отклонения'); return; }
    setState('loading'); setErrMsg('');
    try {
      const res = await fetch(KYC_REVIEW_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ kyc_id: item.id, action, reason: reason.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setState('done');
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
    <div style={{
      position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'flex-start',
      justifyContent: 'center', overflowY: 'auto', padding: '32px 16px',
      background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)',
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        width: '100%', maxWidth: 680, background: '#0f0f1f',
        border: `1px solid ${CARD_BOR}`, borderRadius: 20, overflow: 'hidden',
      }}>
        {/* Шапка */}
        <div style={{
          padding: '20px 28px', display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.07)',
        }}>
          <div>
            <div style={{ fontSize: 11, color: dimText, fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.1em', marginBottom: 4 }}>
              KYC · {item.id.slice(0, 8).toUpperCase()}
            </div>
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
            <div style={{ fontSize: 11, fontFamily: 'JetBrains Mono, monospace', color: dimText, letterSpacing: '0.1em', marginBottom: 14 }}>
              ДАННЫЕ КОМПАНИИ
            </div>
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0,
              border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, overflow: 'hidden',
            }}>
              {[
                { l: 'Email',        v: item.user_email },
                { l: 'ИНН',         v: item.inn },
                { l: 'Руководитель', v: item.ceo_name },
                { l: 'Телефон',      v: item.phone },
                { l: 'Деятельность', v: BIZ_LABELS[item.business_type] || item.business_type },
                { l: 'Объём',        v: VOLUME_LABELS[item.monthly_volume] || item.monthly_volume },
                { l: 'Адрес',        v: item.legal_address },
                { l: 'Сайт',         v: item.website || '—' },
              ].map((f, i) => (
                <div key={f.l} style={{
                  padding: '10px 14px',
                  borderBottom: i < 6 ? '1px solid rgba(255,255,255,0.07)' : 'none',
                  borderRight: i % 2 === 0 ? '1px solid rgba(255,255,255,0.07)' : 'none',
                }}>
                  <div style={{ fontSize: 10, color: dimText, marginBottom: 3, letterSpacing: '0.08em' }}>{f.l.toUpperCase()}</div>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{f.v}</div>
                </div>
              ))}
            </div>
          </section>

          {/* Документы */}
          <section>
            <div style={{ fontSize: 11, fontFamily: 'JetBrains Mono, monospace', color: dimText, letterSpacing: '0.1em', marginBottom: 14 }}>
              ДОКУМЕНТЫ
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <DocViewer url={item.doc_ceo_id_url}  label="Паспорт руководителя" />
              <DocViewer url={item.doc_charter_url} label="Устав / Свидетельство о регистрации" />
              <DocViewer url={item.doc_extract_url} label="Выписка из ЕГРЮЛ" />
            </div>
          </section>

          {/* Уже проверено */}
          {item.status !== 'pending_review' && (
            <div style={{
              padding: '14px 16px', borderRadius: 12,
              background: item.status === 'approved' ? 'rgba(0,255,136,0.06)' : 'rgba(255,68,68,0.06)',
              border: `1px solid ${item.status === 'approved' ? 'rgba(0,255,136,0.2)' : 'rgba(255,68,68,0.2)'}`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: item.reject_reason ? 8 : 0 }}>
                <Icon name={item.status === 'approved' ? 'CheckCircle2' : 'XCircle'} size={16}
                  style={{ color: item.status === 'approved' ? ACCENT : '#ff4444', flexShrink: 0 }} />
                <span style={{ fontSize: 13, fontWeight: 600, color: item.status === 'approved' ? ACCENT : '#ff4444' }}>
                  {item.status === 'approved' ? 'Заявка одобрена' : 'Заявка отклонена'}
                </span>
                {item.reviewed_by_email && (
                  <span style={{ marginLeft: 'auto', fontSize: 11, color: dimText }}>{item.reviewed_by_email} · {fmtDate(item.reviewed_at)}</span>
                )}
              </div>
              {item.reject_reason && (
                <p style={{ margin: 0, fontSize: 13, color: dimText, paddingLeft: 24 }}>{item.reject_reason}</p>
              )}
            </div>
          )}

          {/* Уведомление */}
          {notifyState !== 'idle' && (
            <div style={{ fontSize: 12, color: notifyState === 'sent' ? ACCENT : notifyState === 'failed' ? '#ff8888' : dimText,
              display: 'flex', alignItems: 'center', gap: 6 }}>
              <Icon name={notifyState === 'sending' ? 'Loader' : notifyState === 'sent' ? 'Mail' : 'AlertCircle'} size={13}
                style={{ animation: notifyState === 'sending' ? 'spin 1s linear infinite' : 'none' }} />
              {notifyState === 'sending' ? 'Отправляем уведомление клиенту...' : notifyState === 'sent' ? 'Email-уведомление отправлено' : 'Не удалось отправить уведомление'}
            </div>
          )}

          {/* Форма решения */}
          {isPending && state !== 'done' && (
            <section>
              <div style={{ fontSize: 11, fontFamily: 'JetBrains Mono, monospace', color: dimText, letterSpacing: '0.1em', marginBottom: 14 }}>
                РЕШЕНИЕ
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
                <button onClick={() => setAction('approve')} style={{
                  padding: '12px', borderRadius: 10, fontWeight: 600, fontSize: 14, cursor: 'pointer',
                  border: `2px solid ${action === 'approve' ? ACCENT : 'rgba(255,255,255,0.1)'}`,
                  background: action === 'approve' ? 'rgba(0,255,136,0.1)' : 'transparent',
                  color: action === 'approve' ? ACCENT : dimText,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, transition: 'all 0.15s',
                }}>
                  <Icon name="CheckCircle2" size={17} /> Одобрить
                </button>
                <button onClick={() => setAction('reject')} style={{
                  padding: '12px', borderRadius: 10, fontWeight: 600, fontSize: 14, cursor: 'pointer',
                  border: `2px solid ${action === 'reject' ? '#FF4444' : 'rgba(255,255,255,0.1)'}`,
                  background: action === 'reject' ? 'rgba(255,68,68,0.1)' : 'transparent',
                  color: action === 'reject' ? '#FF4444' : dimText,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, transition: 'all 0.15s',
                }}>
                  <Icon name="XCircle" size={17} /> Отклонить
                </button>
              </div>

              {action === 'reject' && (
                <div style={{ marginBottom: 14 }}>
                  <label style={{ fontSize: 12, color: dimText, display: 'block', marginBottom: 6 }}>Причина отклонения *</label>
                  <textarea value={reason} onChange={e => setReason(e.target.value)} rows={3}
                    placeholder="Укажите причину для клиента..."
                    style={{
                      width: '100%', padding: '10px 14px', borderRadius: 10, fontSize: 13,
                      background: 'rgba(255,255,255,0.04)', border: `1px solid ${errMsg ? '#FF4444' : 'rgba(255,255,255,0.12)'}`,
                      color: '#fff', resize: 'vertical', outline: 'none',
                      fontFamily: "'Rubik', sans-serif", boxSizing: 'border-box',
                    }} />
                </div>
              )}

              {errMsg && (
                <div style={{ fontSize: 13, color: '#ff8888', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Icon name="AlertCircle" size={14} /> {errMsg}
                </div>
              )}

              {action && (
                <button onClick={submit} disabled={state === 'loading'} style={{
                  width: '100%', padding: '13px', borderRadius: 10, fontWeight: 700, fontSize: 15, border: 'none',
                  cursor: state === 'loading' ? 'not-allowed' : 'pointer', transition: 'all 0.2s',
                  background: action === 'approve' ? ACCENT : '#FF4444',
                  color: action === 'approve' ? BG : '#fff',
                  opacity: state === 'loading' ? 0.7 : 1,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                }}>
                  {state === 'loading'
                    ? <><Icon name="Loader" size={15} style={{ animation: 'spin 1s linear infinite' }} /> Применяем решение...</>
                    : action === 'approve'
                    ? <><Icon name="CheckCircle2" size={16} /> Подтвердить одобрение</>
                    : <><Icon name="XCircle" size={16} /> Подтвердить отклонение</>}
                </button>
              )}
            </section>
          )}

          {state === 'done' && (
            <div style={{ textAlign: 'center', padding: '8px 0' }}>
              <Icon name={action === 'approve' ? 'CheckCircle2' : 'XCircle'} size={36}
                style={{ color: action === 'approve' ? ACCENT : '#FF4444', marginBottom: 10 }} />
              <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 18, fontWeight: 700 }}>
                {action === 'approve' ? 'KYC одобрен' : 'KYC отклонён'}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── AML-модалка ──────────────────────────────────────────────────────────────
function AmlModal({ payment, token, onClose, onDone }: {
  payment: AmlPayment; token: string; onClose: () => void; onDone: () => void;
}) {
  const [action,  setAction]  = useState<'approve' | 'reject' | null>(null);
  const [reason,  setReason]  = useState('');
  const [loading, setLoading] = useState(false);
  const [err,     setErr]     = useState('');
  const [done,    setDone]    = useState(false);
  const [result,  setResult]  = useState<{ new_status: string } | null>(null);

  const riskColor = payment.risk_score >= 60 ? '#FF4444' : payment.risk_score >= 30 ? '#FFAA00' : '#00FF88';

  const submit = async () => {
    if (!action) return;
    if (action === 'reject' && !reason.trim()) { setErr('Укажите причину отклонения'); return; }
    setLoading(true); setErr('');
    try {
      const res = await fetch(APPROVE_PAY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ order_id: payment.id, action, reason: reason.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setResult(data);
      setDone(true);
      setTimeout(() => { onClose(); onDone(); }, 1600);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Ошибка');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'flex-start',
      justifyContent: 'center', overflowY: 'auto', padding: '32px 16px',
      background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)',
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        width: '100%', maxWidth: 620, background: '#0f0f1f',
        border: '1px solid rgba(0,255,136,0.18)', borderRadius: 20, overflow: 'hidden',
      }}>
        {/* Шапка */}
        <div style={{
          padding: '20px 28px', borderBottom: '1px solid rgba(255,255,255,0.07)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
        }}>
          <div>
            <div style={{ fontSize: 11, color: dimText, fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.1em', marginBottom: 4 }}>
              AML · {payment.id.slice(0, 8).toUpperCase()}
            </div>
            <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 20, fontWeight: 700, margin: 0 }}>
              {payment.user_company || payment.user_email}
            </h2>
            <div style={{ fontSize: 12, color: dimText, marginTop: 3 }}>{payment.user_email}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: dimText, cursor: 'pointer', padding: 4 }}>
            <Icon name="X" size={20} />
          </button>
        </div>

        <div style={{ padding: '22px 28px', display: 'flex', flexDirection: 'column', gap: 18 }}>
          {/* Детали платежа */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {[
              { l: 'Сумма',    v: `${payment.amount.toLocaleString()} ${payment.from_currency}` },
              { l: 'Получить', v: payment.to_currency },
              { l: 'Страна',   v: payment.destination_country || '—' },
              { l: 'Дата',     v: payment.created_at ? new Date(payment.created_at).toLocaleString('ru') : '—' },
            ].map(f => (
              <div key={f.l} style={{
                background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: 10, padding: '12px 14px',
              }}>
                <div style={{ fontSize: 11, color: dimText, marginBottom: 4 }}>{f.l}</div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{f.v}</div>
              </div>
            ))}
          </div>

          {/* Адрес */}
          <div style={{
            background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 10, padding: '12px 14px',
          }}>
            <div style={{ fontSize: 11, color: dimText, marginBottom: 4 }}>Адрес получателя</div>
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, wordBreak: 'break-all' }}>
              {payment.destination_address}
            </div>
          </div>

          {/* Риск-скор */}
          <div style={{
            borderRadius: 12, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14,
            background: `${riskColor}0d`, border: `1px solid ${riskColor}33`,
          }}>
            <div style={{
              width: 48, height: 48, borderRadius: '50%', flexShrink: 0,
              background: `${riskColor}15`, border: `2px solid ${riskColor}`,
              display: 'grid', placeItems: 'center',
              fontFamily: 'JetBrains Mono, monospace', fontSize: 15, fontWeight: 700, color: riskColor,
            }}>
              {payment.risk_score}
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14, color: riskColor }}>
                Риск-скор: {payment.risk_score}/100 · {payment.risk_level === 'high' ? 'Высокий' : payment.risk_level === 'medium' ? 'Средний' : 'Низкий'} риск
              </div>
              <div style={{ fontSize: 12, color: dimText, marginTop: 2 }}>
                {payment.risk_score >= 60
                  ? 'Возможная связь с санкционными адресами или миксерами'
                  : payment.risk_score >= 30
                  ? 'Требует дополнительной проверки источника средств'
                  : 'Адрес прошёл базовую AML-проверку'}
              </div>
            </div>
          </div>

          {/* Решение */}
          {!done && (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
                <button onClick={() => setAction('approve')} style={{
                  padding: '12px', borderRadius: 10, fontWeight: 600, fontSize: 14, cursor: 'pointer',
                  border: `2px solid ${action === 'approve' ? ACCENT : 'rgba(255,255,255,0.1)'}`,
                  background: action === 'approve' ? 'rgba(0,255,136,0.1)' : 'transparent',
                  color: action === 'approve' ? ACCENT : dimText,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, transition: 'all 0.15s',
                }}>
                  <Icon name="CheckCircle2" size={17} /> Одобрить
                </button>
                <button onClick={() => setAction('reject')} style={{
                  padding: '12px', borderRadius: 10, fontWeight: 600, fontSize: 14, cursor: 'pointer',
                  border: `2px solid ${action === 'reject' ? '#FF4444' : 'rgba(255,255,255,0.1)'}`,
                  background: action === 'reject' ? 'rgba(255,68,68,0.1)' : 'transparent',
                  color: action === 'reject' ? '#FF4444' : dimText,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, transition: 'all 0.15s',
                }}>
                  <Icon name="XCircle" size={17} /> Отклонить
                </button>
              </div>

              {action === 'reject' && (
                <div style={{ marginBottom: 14 }}>
                  <label style={{ fontSize: 12, color: dimText, display: 'block', marginBottom: 6 }}>Причина отклонения *</label>
                  <textarea value={reason} onChange={e => setReason(e.target.value)} rows={3}
                    placeholder="Укажите причину для клиента..."
                    style={{
                      width: '100%', padding: '10px 14px', borderRadius: 10, fontSize: 13,
                      background: 'rgba(255,255,255,0.04)',
                      border: `1px solid ${err ? '#FF4444' : 'rgba(255,255,255,0.12)'}`,
                      color: '#fff', resize: 'vertical', outline: 'none',
                      fontFamily: "'Rubik', sans-serif", boxSizing: 'border-box',
                    }} />
                </div>
              )}

              {err && (
                <div style={{ fontSize: 13, color: '#ff8888', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Icon name="AlertCircle" size={14} /> {err}
                </div>
              )}

              {action && (
                <button onClick={submit} disabled={loading} style={{
                  width: '100%', padding: '13px', borderRadius: 10, fontWeight: 700, fontSize: 15, border: 'none',
                  cursor: loading ? 'not-allowed' : 'pointer', transition: 'all 0.2s',
                  background: action === 'approve' ? ACCENT : '#FF4444',
                  color: action === 'approve' ? BG : '#fff',
                  opacity: loading ? 0.7 : 1,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                }}>
                  {loading
                    ? <><Icon name="Loader" size={15} style={{ animation: 'spin 1s linear infinite' }} /> Применяем решение...</>
                    : action === 'approve'
                    ? <><Icon name="CheckCircle2" size={16} /> Подтвердить одобрение</>
                    : <><Icon name="XCircle" size={16} /> Подтвердить отклонение</>}
                </button>
              )}
            </div>
          )}

          {/* Успех */}
          {done && result && (
            <div style={{ textAlign: 'center', padding: '12px 0' }}>
              <div style={{
                width: 56, height: 56, borderRadius: '50%', margin: '0 auto 14px',
                background: result.new_status === 'processing' ? 'rgba(0,255,136,0.1)' : 'rgba(255,68,68,0.1)',
                border: `2px solid ${result.new_status === 'processing' ? ACCENT : '#FF4444'}`,
                display: 'grid', placeItems: 'center',
              }}>
                <Icon name={result.new_status === 'processing' ? 'CheckCircle2' : 'XCircle'} size={28}
                  style={{ color: result.new_status === 'processing' ? ACCENT : '#FF4444' }} />
              </div>
              <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 17, fontWeight: 700, marginBottom: 4 }}>
                {result.new_status === 'processing' ? 'Платёж одобрен' : 'Платёж отклонён'}
              </div>
              <div style={{ fontSize: 13, color: dimText }}>Статус обновлён в БД. Закрываем...</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── AML-очередь ──────────────────────────────────────────────────────────────
function AmlQueue({ token }: { token: string }) {
  const [data,     setData]     = useState<AmlListResponse | null>(null);
  const [loading,  setLoading]  = useState(false);
  const [err,      setErr]      = useState('');
  const [selected, setSelected] = useState<AmlPayment | null>(null);
  const [sortBy,   setSortBy]   = useState('risk_score');
  const [order,    setOrder]    = useState('desc');

  const fetchData = useCallback(async () => {
    setLoading(true); setErr('');
    try {
      const p = new URLSearchParams({ sort_by: sortBy, order, limit: '50' });
      const res = await fetch(`${PENDING_PAY_URL}?${p}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || `HTTP ${res.status}`);
      setData(d);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  }, [token, sortBy, order]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const items = data?.items || [];
  const total = data?.total  || 0;

  const riskColor = (score: number) =>
    score >= 60 ? '#FF4444' : score >= 30 ? '#FFAA00' : '#00FF88';

  return (
    <div>
      {selected && (
        <AmlModal payment={selected} token={token}
          onClose={() => setSelected(null)}
          onDone={() => { setSelected(null); fetchData(); }} />
      )}

      {/* Заголовок */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 22, fontWeight: 700, marginBottom: 4 }}>
            Очередь AML-платежей
          </h2>
          <div style={{ fontSize: 13, color: dimText }}>
            {loading ? 'Загрузка...' : `${total} платежей ожидают решения`}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select value={sortBy} onChange={e => setSortBy(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff', fontSize: 12, outline: 'none', cursor: 'pointer' }}>
            <option value="risk_score" style={{ background: '#0f0f1f' }}>По риск-скору</option>
            <option value="amount"     style={{ background: '#0f0f1f' }}>По сумме</option>
            <option value="created_at" style={{ background: '#0f0f1f' }}>По дате</option>
          </select>
          <button onClick={() => setOrder(o => o === 'desc' ? 'asc' : 'desc')}
            style={{ padding: '8px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff', cursor: 'pointer', fontSize: 13 }}>
            {order === 'desc' ? '↓' : '↑'}
          </button>
          <button onClick={fetchData}
            style={{ padding: '8px 14px', borderRadius: 8, background: 'rgba(0,255,136,0.08)', border: '1px solid rgba(0,255,136,0.25)', color: ACCENT, fontSize: 12, cursor: 'pointer' }}>
            Обновить
          </button>
        </div>
      </div>

      {err && (
        <div style={{ background: 'rgba(255,68,68,0.08)', border: '1px solid rgba(255,68,68,0.25)', borderRadius: 12, padding: '14px 18px', color: '#ff8888', fontSize: 13, display: 'flex', gap: 10, marginBottom: 16 }}>
          <Icon name="AlertTriangle" size={16} /> {err}
          <button onClick={fetchData} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#ff8888', cursor: 'pointer', textDecoration: 'underline', fontSize: 13 }}>Повторить</button>
        </div>
      )}

      <div style={{ background: 'rgba(255,255,255,0.02)', border: `1px solid ${CARD_BOR}`, borderRadius: 16, overflow: 'hidden' }}>
        <div style={{
          display: 'grid', gridTemplateColumns: '72px 1fr 130px 90px 90px 120px 170px',
          gap: 8, padding: '12px 20px', borderBottom: '1px solid rgba(255,255,255,0.07)',
          fontSize: 11, color: dimText, fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.08em',
        }}>
          <span>РИСК</span><span>КОМПАНИЯ / EMAIL</span><span>СУММА</span>
          <span>ВАЛЮТА</span><span>СТРАНА</span><span>ДАТА</span><span>ДЕЙСТВИЯ</span>
        </div>

        {loading && !items.length ? (
          <div style={{ padding: '48px', textAlign: 'center', color: dimText }}>
            <div style={{ marginBottom: 12 }}><Icon name="Loader" size={24} style={{ animation: 'spin 1s linear infinite' }} /></div>
            <div>Загрузка очереди...</div>
          </div>
        ) : items.length === 0 ? (
          <div style={{ padding: '64px', textAlign: 'center' }}>
            <Icon name="ShieldCheck" size={40} style={{ color: ACCENT, marginBottom: 12, opacity: 0.5 }} />
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>Очередь пуста</div>
            <div style={{ fontSize: 14, color: dimText }}>Нет платежей, ожидающих AML-решения</div>
          </div>
        ) : (
          <div style={{ opacity: loading ? 0.5 : 1, transition: 'opacity 0.2s' }}>
            {items.map((p, i) => (
              <div key={p.id} style={{
                display: 'grid', gridTemplateColumns: '72px 1fr 130px 90px 90px 120px 170px',
                gap: 8, padding: '14px 20px', alignItems: 'center',
                borderBottom: i < items.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                transition: 'background 0.15s',
              }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <div>
                  <div style={{
                    width: 42, height: 42, borderRadius: '50%',
                    background: `${riskColor(p.risk_score)}15`,
                    border: `2px solid ${riskColor(p.risk_score)}`,
                    display: 'grid', placeItems: 'center',
                    fontFamily: 'JetBrains Mono, monospace', fontSize: 12, fontWeight: 700,
                    color: riskColor(p.risk_score),
                  }}>
                    {p.risk_score}
                  </div>
                </div>

                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {p.user_company || '—'}
                  </div>
                  <div style={{ fontSize: 11, color: dimText, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {p.user_email}
                  </div>
                </div>

                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13, fontWeight: 600 }}>
                  {p.amount.toLocaleString('ru')}
                </span>
                <span style={{ fontSize: 12, color: dimText }}>{p.from_currency} → {p.to_currency}</span>
                <span style={{ fontSize: 12, color: dimText }}>{p.destination_country || '—'}</span>
                <span style={{ fontSize: 11, color: dimText, fontFamily: 'JetBrains Mono, monospace' }}>
                  {p.created_at ? new Date(p.created_at).toLocaleDateString('ru') : '—'}
                </span>

                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => setSelected(p)}
                    style={{ flex: 1, padding: '7px 0', borderRadius: 8, fontSize: 12, fontWeight: 600, border: '1px solid rgba(255,255,255,0.12)', background: 'transparent', color: '#fff', cursor: 'pointer' }}>
                    Детали
                  </button>
                  <button onClick={() => setSelected(p)}
                    style={{ padding: '7px 10px', borderRadius: 8, fontSize: 11, fontWeight: 600, border: 'none', background: 'rgba(0,255,136,0.15)', color: ACCENT, cursor: 'pointer' }}
                    title="Одобрить">
                    <Icon name="Check" size={13} />
                  </button>
                  <button onClick={() => setSelected(p)}
                    style={{ padding: '7px 10px', borderRadius: 8, fontSize: 11, fontWeight: 600, border: 'none', background: 'rgba(255,68,68,0.12)', color: '#FF4444', cursor: 'pointer' }}
                    title="Отклонить">
                    <Icon name="X" size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Страница входа для compliance ────────────────────────────────────────────
function LoginGate({ onAuth }: { onAuth: (token: string) => void }) {
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);
  const [err,      setErr]      = useState('');
  const LOGIN_URL = 'https://functions.poehali.dev/038f9a88-6440-49a4-ba7a-c5a0bb4731a6';

  const login = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setErr('');
    try {
      const res  = await fetch(LOGIN_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      if (!['compliance', 'admin', 'superadmin', 'finance'].includes(data.user?.role)) throw new Error('Недостаточно прав для доступа к Compliance-панели');
      onAuth(data.access_token);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Ошибка входа');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ background: BG, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Rubik', sans-serif" }}>
      <div style={{ width: '100%', maxWidth: 380, padding: 24 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: ACCENT, display: 'grid', placeItems: 'center', margin: '0 auto 14px', fontWeight: 700, fontSize: 22, color: BG, fontFamily: "'Space Grotesk', sans-serif" }}>M</div>
          <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 22, fontWeight: 700, marginBottom: 4 }}>MOST Compliance</h1>
          <p style={{ fontSize: 13, color: dimText }}>Вход для сотрудников</p>
        </div>
        <form onSubmit={login} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" required
            style={{ padding: '12px 14px', borderRadius: 10, fontSize: 14, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff', outline: 'none', fontFamily: "'Rubik', sans-serif" }} />
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Пароль" required
            style={{ padding: '12px 14px', borderRadius: 10, fontSize: 14, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff', outline: 'none', fontFamily: "'Rubik', sans-serif" }} />
          {err && <div style={{ fontSize: 13, color: '#ff8888' }}>{err}</div>}
          <button type="submit" disabled={loading}
            style={{ padding: '13px', borderRadius: 10, background: ACCENT, color: BG, fontWeight: 700, fontSize: 15, border: 'none', cursor: 'pointer', opacity: loading ? 0.7 : 1 }}>
            {loading ? 'Входим...' : 'Войти'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── Главная страница ──────────────────────────────────────────────────────────
export default function Compliance() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const handleLogout = useCallback(() => { logout(); navigate('/login', { replace: true }); }, [logout, navigate]);

  const [activeTab,     setActiveTab]     = useState<'aml' | 'kyc'>('aml');
  const [token,         setToken]         = useState(() => localStorage.getItem('compliance_token') || '');
  const [data,          setData]          = useState<ListResponse | null>(null);
  const [loading,       setLoading]       = useState(false);
  const [error,         setError]         = useState('');
  const [selected,      setSelected]      = useState<KycItem | null>(null);
  const [statusFilter,  setStatusFilter]  = useState('pending_review');
  const [search,        setSearch]        = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [offset,        setOffset]        = useState(0);
  const LIMIT = 20;

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
      if (res.status === 401 || res.status === 403) { localStorage.removeItem('compliance_token'); setToken(''); return; }
      if (!res.ok) throw new Error(d.error || `HTTP ${res.status}`);
      setData(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  }, [token, statusFilter, debouncedSearch, offset]);

  useEffect(() => { fetchList(); }, [fetchList]);

  if (!token) {
    return <LoginGate onAuth={t => { setToken(t); localStorage.setItem('compliance_token', t); }} />;
  }

  const stats   = data?.stats || {};
  const items   = data?.items || [];
  const total   = data?.total || 0;
  const pages   = data?.pages || 1;
  const curPage = Math.floor(offset / LIMIT) + 1;

  return (
    <div style={{ background: BG, minHeight: '100vh', color: '#fff', fontFamily: "'Rubik', sans-serif" }}>
      <div style={{ position: 'fixed', inset: 0, opacity: 0.08,
        backgroundImage: `linear-gradient(rgba(0,255,136,0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(0,255,136,0.15) 1px, transparent 1px)`,
        backgroundSize: '48px 48px', pointerEvents: 'none' }} />

      {selected && (
        <KycModal item={selected} token={token} onClose={() => setSelected(null)} onDone={fetchList} />
      )}

      {/* Nav */}
      <nav style={{ position: 'sticky', top: 0, zIndex: 40, padding: '0 24px', height: 60,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: 'rgba(10,10,26,0.9)', backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <a href="/" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: ACCENT, display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 15, color: BG, fontFamily: "'Space Grotesk', sans-serif" }}>M</div>
            <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 17, color: '#fff' }}>MOST</span>
          </a>
          <span style={{ fontSize: 12, color: dimText, padding: '3px 10px', background: 'rgba(0,255,136,0.08)', border: `1px solid ${CARD_BOR}`, borderRadius: 20, fontFamily: 'JetBrains Mono, monospace' }}>
            COMPLIANCE
          </span>
          {/* Переключатель вкладок */}
          <div style={{ display: 'flex', gap: 4, background: 'rgba(255,255,255,0.05)', borderRadius: 10, padding: 3 }}>
            {([
              { id: 'aml' as const, label: 'AML-платежи', icon: 'ShieldAlert' },
              { id: 'kyc' as const, label: 'KYC-заявки',  icon: 'Users' },
            ]).map(t => (
              <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px',
                borderRadius: 8, border: 'none', fontSize: 12, fontWeight: 600,
                cursor: 'pointer', transition: 'all 0.15s',
                background: activeTab === t.id ? 'rgba(0,255,136,0.15)' : 'transparent',
                color: activeTab === t.id ? ACCENT : dimText,
              }}>
                <Icon name={t.icon} size={13} />
                {t.label}
              </button>
            ))}
          </div>
        </div>
        <button onClick={() => { localStorage.removeItem('compliance_token'); setToken(''); handleLogout(); }}
          style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: dimText, cursor: 'pointer', fontSize: 13 }}>
          <Icon name="LogOut" size={15} /> Выйти
        </button>
      </nav>

      <div style={{ position: 'relative', maxWidth: 1100, margin: '0 auto', padding: '32px 24px 64px' }}>

        {/* AML-вкладка */}
        {activeTab === 'aml' && <AmlQueue token={token} />}

        {/* KYC-вкладка */}
        {activeTab === 'kyc' && (
          <div>
            <div style={{ marginBottom: 32 }}>
              <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 28, fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 20 }}>
                Очередь KYC-верификации
              </h1>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                {[
                  { k: 'pending_review', label: 'На проверке', icon: 'Clock',     color: '#F3BA2F' },
                  { k: 'approved',       label: 'Одобрено',    icon: 'UserCheck', color: ACCENT },
                  { k: 'rejected',       label: 'Отклонено',   icon: 'UserX',     color: '#ff6666' },
                ].map(s => (
                  <div key={s.k} style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '12px 20px',
                    background: statusFilter === s.k ? `${s.color}10` : 'rgba(255,255,255,0.02)',
                    border: `1px solid ${statusFilter === s.k ? `${s.color}40` : 'rgba(255,255,255,0.08)'}`,
                    borderRadius: 12, cursor: 'pointer', transition: 'all 0.2s',
                  }} onClick={() => { setStatusFilter(s.k); setOffset(0); }}>
                    <Icon name={s.icon} size={16} style={{ color: s.color }} />
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>{s.label}</span>
                    <span style={{ fontSize: 14, fontWeight: 700, color: s.color, fontFamily: 'JetBrains Mono, monospace' }}>
                      {stats[s.k] ?? 0}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Поиск */}
            <div style={{ position: 'relative', marginBottom: 20 }}>
              <Icon name="Search" size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: dimText, pointerEvents: 'none' }} />
              <input value={search} onChange={e => { setSearch(e.target.value); setOffset(0); }}
                placeholder="Поиск по названию, ИНН, email..."
                style={{ width: '100%', padding: '11px 16px 11px 42px', borderRadius: 12, fontSize: 14, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', outline: 'none', boxSizing: 'border-box', fontFamily: "'Rubik', sans-serif" }}
                onFocus={e => (e.target.style.borderColor = ACCENT)}
                onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.1)')} />
              {search && (
                <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: dimText, cursor: 'pointer', padding: 4 }}>
                  <Icon name="X" size={14} />
                </button>
              )}
            </div>

            {error && (
              <div style={{ background: 'rgba(255,68,68,0.08)', border: '1px solid rgba(255,68,68,0.25)', borderRadius: 12, padding: '14px 18px', color: '#ff8888', fontSize: 13, display: 'flex', gap: 10, marginBottom: 16 }}>
                <Icon name="AlertTriangle" size={16} /> {error}
                <button onClick={fetchList} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#ff8888', cursor: 'pointer', textDecoration: 'underline', fontSize: 13 }}>Повторить</button>
              </div>
            )}

            <div style={{ background: 'rgba(255,255,255,0.02)', border: `1px solid ${CARD_BOR}`, borderRadius: 16, overflow: 'hidden' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px 140px 130px 120px 56px', gap: 8, padding: '12px 20px', borderBottom: '1px solid rgba(255,255,255,0.07)', fontSize: 11, color: dimText, fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.1em' }}>
                <span>КОМПАНИЯ / EMAIL</span><span>ИНН</span><span>ДЕЯТЕЛЬНОСТЬ</span><span>ОБЪЁМ</span><span>ПОДАНО</span><span></span>
              </div>

              {loading && !items.length ? (
                <div style={{ padding: '48px', textAlign: 'center', color: dimText }}>
                  <div style={{ marginBottom: 12 }}><Icon name="Loader" size={24} style={{ animation: 'spin 1s linear infinite' }} /></div>
                  <div>Загрузка заявок...</div>
                </div>
              ) : items.length === 0 ? (
                <div style={{ padding: '64px', textAlign: 'center' }}>
                  <Icon name="CheckCircle2" size={40} style={{ color: ACCENT, marginBottom: 12, opacity: 0.5 }} />
                  <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>Очередь пуста</div>
                  <div style={{ fontSize: 14, color: dimText }}>Нет заявок с выбранным статусом</div>
                </div>
              ) : (
                <div style={{ opacity: loading ? 0.5 : 1, transition: 'opacity 0.2s' }}>
                  {items.map((item, i) => (
                    <div key={item.id} style={{ display: 'grid', gridTemplateColumns: '1fr 120px 140px 130px 120px 56px', gap: 8, padding: '14px 20px', alignItems: 'center', borderBottom: i < items.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none', transition: 'background 0.15s', cursor: 'pointer' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      onClick={() => setSelected(item)}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.company_name}</div>
                        <div style={{ fontSize: 12, color: dimText, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.user_email}</div>
                      </div>
                      <span style={{ fontSize: 12, fontFamily: 'JetBrains Mono, monospace', color: dimText }}>{item.inn}</span>
                      <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{BIZ_LABELS[item.business_type] || item.business_type}</span>
                      <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>{VOLUME_LABELS[item.monthly_volume] || item.monthly_volume}</span>
                      <span style={{ fontSize: 11, color: dimText, fontFamily: 'JetBrains Mono, monospace' }}>{fmtDate(item.created_at)}</span>
                      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <Icon name="ChevronRight" size={16} style={{ color: dimText }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {pages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}>
                <span style={{ fontSize: 12, color: dimText, fontFamily: 'JetBrains Mono, monospace' }}>
                  Страница {curPage} из {pages} · {total} заявок
                </span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => setOffset(o => Math.max(0, o - LIMIT))} disabled={offset === 0}
                    style={{ padding: '8px 14px', borderRadius: 8, background: 'transparent', border: '1px solid rgba(255,255,255,0.12)', color: offset === 0 ? dimText : '#fff', cursor: offset === 0 ? 'not-allowed' : 'pointer', fontSize: 13 }}>
                    ← Пред.
                  </button>
                  <button onClick={() => setOffset(o => o + LIMIT)} disabled={curPage >= pages}
                    style={{ padding: '8px 14px', borderRadius: 8, background: 'transparent', border: '1px solid rgba(255,255,255,0.12)', color: curPage >= pages ? dimText : '#fff', cursor: curPage >= pages ? 'not-allowed' : 'pointer', fontSize: 13 }}>
                    След. →
                  </button>
                </div>
              </div>
            )}
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
