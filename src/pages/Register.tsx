import { useState, useRef, useCallback } from 'react';
import Icon from '@/components/ui/icon';

const REGISTER_URL = 'https://functions.poehali.dev/87c9fc22-c382-433c-bec2-eb0103fd9189';

const ACCENT   = '#00FF88';
const BG       = '#0A0A1A';
const CARD_BOR = 'rgba(0,255,136,0.22)';

// ─── Типы ────────────────────────────────────────────────────────────────────
interface DocFile { name: string; data: string; mime: string; size: number }
interface FormData {
  email: string; password: string; confirmPassword: string;
  company_name: string; inn: string; legal_address: string;
  ceo_name: string; phone: string; website: string;
  business_type: string; monthly_volume: string;
  agree_kyc: boolean; agree_terms: boolean;
}
type Step = 1 | 2 | 3 | 4;

const STEPS = [
  { n: 1, label: 'Аккаунт',   icon: 'UserRound' },
  { n: 2, label: 'Компания',  icon: 'Building2' },
  { n: 3, label: 'Документы', icon: 'FileText' },
  { n: 4, label: 'Проверка',  icon: 'ShieldCheck' },
];

const BUSINESS_TYPES = [
  { value: 'import',     label: 'Импорт товаров' },
  { value: 'export',     label: 'Экспорт товаров' },
  { value: 'services',   label: 'Услуги / IT' },
  { value: 'trading',    label: 'Торговля' },
  { value: 'investment', label: 'Инвестиции' },
  { value: 'other',      label: 'Другое' },
];

const VOLUMES = [
  { value: '<100k',  label: 'до $100K / мес' },
  { value: '100k-1m', label: '$100K – $1M / мес' },
  { value: '1m-10m', label: '$1M – $10M / мес' },
  { value: '>10m',   label: 'свыше $10M / мес' },
];

// ─── Стили ───────────────────────────────────────────────────────────────────
const inputStyle = (err?: boolean): React.CSSProperties => ({
  width: '100%', padding: '12px 16px', borderRadius: 10, fontSize: 14,
  background: 'rgba(255,255,255,0.04)',
  border: `1px solid ${err ? '#ff4444' : 'rgba(255,255,255,0.12)'}`,
  color: '#fff', outline: 'none', boxSizing: 'border-box',
  transition: 'border-color 0.2s',
  fontFamily: "'Rubik', sans-serif",
});

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 12, fontWeight: 500,
  color: 'rgba(255,255,255,0.55)', marginBottom: 6, letterSpacing: '0.04em',
};

const errStyle: React.CSSProperties = {
  fontSize: 11, color: '#ff6666', marginTop: 4,
  display: 'flex', alignItems: 'center', gap: 4,
};

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      {children}
      {error && <div style={errStyle}><Icon name="AlertCircle" size={11} />{error}</div>}
    </div>
  );
}

// ─── Загрузчик документов ─────────────────────────────────────────────────────
function DocUploader({ label, hint, value, onChange, required }: {
  label: string; hint: string; value: DocFile | null;
  onChange: (f: DocFile | null) => void; required?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);

  const process = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const b64 = (reader.result as string).split(',')[1];
      onChange({ name: file.name, data: b64, mime: file.type, size: file.size });
    };
    reader.readAsDataURL(file);
  }, [onChange]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDrag(false);
    const f = e.dataTransfer.files[0];
    if (f) process(f);
  };

  const fmtSize = (b: number) => b > 1024*1024 ? `${(b/1024/1024).toFixed(1)} МБ` : `${Math.round(b/1024)} КБ`;

  return (
    <div>
      <label style={labelStyle}>{label}{required && <span style={{ color: ACCENT }}>*</span>}</label>
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={handleDrop}
        style={{
          border: `1px dashed ${value ? ACCENT : drag ? ACCENT : 'rgba(255,255,255,0.18)'}`,
          borderRadius: 10, padding: '18px 16px', cursor: 'pointer',
          background: drag ? 'rgba(0,255,136,0.05)' : value ? 'rgba(0,255,136,0.04)' : 'rgba(255,255,255,0.02)',
          transition: 'all 0.2s', textAlign: 'center',
        }}
      >
        {value ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center' }}>
            <Icon name="FileCheck2" size={20} style={{ color: ACCENT }} />
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: 13, color: '#fff', fontWeight: 500 }}>{value.name}</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>{fmtSize(value.size)}</div>
            </div>
            <button
              type="button"
              onClick={e => { e.stopPropagation(); onChange(null); }}
              style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', padding: 4 }}
            >
              <Icon name="X" size={14} />
            </button>
          </div>
        ) : (
          <>
            <Icon name="Upload" size={22} style={{ color: 'rgba(255,255,255,0.3)', marginBottom: 8 }} />
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', marginBottom: 4 }}>Перетащите или нажмите для выбора</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>{hint}</div>
          </>
        )}
        <input ref={inputRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" style={{ display: 'none' }}
          onChange={e => { const f = e.target.files?.[0]; if (f) process(f); }} />
      </div>
    </div>
  );
}

// ─── Главный компонент ────────────────────────────────────────────────────────
export default function Register() {
  const [step, setStep] = useState<Step>(1);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [kycId, setKycId] = useState('');
  const [serverError, setServerError] = useState('');
  const [errs, setErrs] = useState<Record<string, string>>({});

  const [form, setForm] = useState<FormData>({
    email: '', password: '', confirmPassword: '',
    company_name: '', inn: '', legal_address: '',
    ceo_name: '', phone: '', website: '',
    business_type: '', monthly_volume: '',
    agree_kyc: false, agree_terms: false,
  });

  const [docs, setDocs] = useState<{ charter: DocFile | null; ceo_id: DocFile | null; extract: DocFile | null }>({
    charter: null, ceo_id: null, extract: null,
  });

  const set = (k: keyof FormData, v: string | boolean) =>
    setForm(p => ({ ...p, [k]: v }));

  const clearErr = (k: string) => setErrs(p => { const n = { ...p }; delete n[k]; return n; });

  // ── Валидация шагов ──────────────────────────────────────────────────────
  const validateStep = (s: Step): boolean => {
    const e: Record<string, string> = {};
    if (s === 1) {
      if (!/^[^@]+@[^@]+\.[^@]+$/.test(form.email))     e.email = 'Некорректный email';
      if (form.password.length < 8)                       e.password = 'Минимум 8 символов';
      if (form.password !== form.confirmPassword)         e.confirmPassword = 'Пароли не совпадают';
    }
    if (s === 2) {
      if (!form.company_name.trim())                      e.company_name = 'Обязательное поле';
      if (!/^\d{10}$|^\d{12}$/.test(form.inn.trim()))    e.inn = '10 или 12 цифр';
      if (!form.legal_address.trim())                     e.legal_address = 'Обязательное поле';
      if (!form.ceo_name.trim())                          e.ceo_name = 'Обязательное поле';
      if (!form.phone.trim())                             e.phone = 'Обязательное поле';
      if (!form.business_type)                            e.business_type = 'Выберите тип деятельности';
      if (!form.monthly_volume)                           e.monthly_volume = 'Выберите объём';
    }
    if (s === 4) {
      if (!form.agree_kyc)   e.agree_kyc   = 'Необходимо согласие';
      if (!form.agree_terms) e.agree_terms = 'Необходимо согласие';
    }
    setErrs(e);
    return Object.keys(e).length === 0;
  };

  const nextStep = () => {
    if (!validateStep(step)) return;
    setStep(s => (s + 1) as Step);
  };

  // ── Отправка ─────────────────────────────────────────────────────────────
  const submit = async () => {
    if (!validateStep(4)) return;
    setLoading(true);
    setServerError('');
    try {
      const body = {
        email:          form.email,
        password:       form.password,
        company_name:   form.company_name,
        inn:            form.inn,
        legal_address:  form.legal_address,
        ceo_name:       form.ceo_name,
        phone:          form.phone,
        website:        form.website || null,
        business_type:  form.business_type,
        monthly_volume: form.monthly_volume,
        doc_charter: docs.charter ? { name: docs.charter.name, data: docs.charter.data, mime: docs.charter.mime } : null,
        doc_ceo_id:  docs.ceo_id  ? { name: docs.ceo_id.name,  data: docs.ceo_id.data,  mime: docs.ceo_id.mime  } : null,
        doc_extract: docs.extract ? { name: docs.extract.name, data: docs.extract.data, mime: docs.extract.mime } : null,
      };
      const res = await fetch(REGISTER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setKycId(data.kyc_id || '');
      setDone(true);
    } catch (e) {
      setServerError(e instanceof Error ? e.message : 'Ошибка сервера');
    } finally {
      setLoading(false);
    }
  };

  // ── Success screen ────────────────────────────────────────────────────────
  if (done) {
    return (
      <div style={{ background: BG, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ maxWidth: 520, width: '100%', textAlign: 'center' }}>
          <div style={{
            width: 96, height: 96, borderRadius: 24,
            background: 'rgba(0,255,136,0.1)', border: `2px solid ${ACCENT}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 32px',
            boxShadow: `0 0 40px rgba(0,255,136,0.25)`,
          }}>
            <Icon name="CheckCircle2" size={44} style={{ color: ACCENT }} />
          </div>
          <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 32, fontWeight: 700, marginBottom: 16 }}>
            Заявка принята!
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 16, lineHeight: 1.7, marginBottom: 32 }}>
            Compliance-офицер проверит вашу заявку в течение <strong style={{ color: '#fff' }}>1 рабочего дня</strong>. Мы отправим уведомление на {form.email}.
          </p>
          {kycId && (
            <div style={{
              background: 'rgba(0,255,136,0.06)', border: `1px solid ${CARD_BOR}`,
              borderRadius: 12, padding: '14px 20px', marginBottom: 32,
            }}>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.12em', marginBottom: 6 }}>НОМЕР ЗАЯВКИ</div>
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 14, color: ACCENT }}>{kycId}</div>
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {[
              { icon: 'Clock', title: 'Срок проверки', desc: '1 рабочий день' },
              { icon: 'Mail', title: 'Уведомление', desc: 'На ваш email' },
              { icon: 'ShieldCheck', title: 'AML-проверка', desc: 'Автоматически' },
              { icon: 'Zap', title: 'Первый платёж', desc: 'Сразу после верификации' },
            ].map(x => (
              <div key={x.title} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '14px 16px', textAlign: 'left' }}>
                <Icon name={x.icon} size={16} style={{ color: ACCENT, marginBottom: 8 }} />
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>{x.title}</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>{x.desc}</div>
              </div>
            ))}
          </div>
          <a href="/" style={{ display: 'inline-block', marginTop: 32, color: 'rgba(255,255,255,0.45)', fontSize: 14, textDecoration: 'none' }}>
            ← На главную
          </a>
        </div>
      </div>
    );
  }

  // ── Layout ────────────────────────────────────────────────────────────────
  return (
    <div style={{ background: BG, minHeight: '100vh', fontFamily: "'Rubik', sans-serif", color: '#fff' }}>

      {/* Фоновая сетка */}
      <div style={{ position: 'fixed', inset: 0, opacity: 0.1, backgroundImage: `linear-gradient(rgba(0,255,136,0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(0,255,136,0.15) 1px, transparent 1px)`, backgroundSize: '48px 48px', pointerEvents: 'none' }} />
      <div style={{ position: 'fixed', inset: 0, background: `radial-gradient(ellipse 70% 60% at 50% 0%, rgba(0,255,136,0.06) 0%, transparent 70%)`, pointerEvents: 'none' }} />

      {/* Nav */}
      <nav style={{ position: 'relative', zIndex: 10, padding: '0 24px', height: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <a href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
          <div style={{ width: 32, height: 32, borderRadius: 9, background: ACCENT, display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 16, color: BG, fontFamily: "'Space Grotesk', sans-serif" }}>M</div>
          <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 18, color: '#fff' }}>MOST</span>
        </a>
        <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>
          Уже есть аккаунт? <a href="/login" style={{ color: ACCENT, textDecoration: 'none' }}>Войти</a>
        </span>
      </nav>

      <div style={{ position: 'relative', zIndex: 1, maxWidth: 680, margin: '0 auto', padding: '48px 24px 80px' }}>

        {/* Заголовок */}
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 32, fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 10 }}>
            Регистрация на платформе
          </h1>
          <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.5)' }}>
            После проверки KYC — доступ к платёжному инструменту без блокировок
          </p>
        </div>

        {/* Степпер */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 40, gap: 0 }}>
          {STEPS.map((s, i) => {
            const isActive   = step === s.n;
            const isComplete = step > s.n;
            return (
              <div key={s.n} style={{ display: 'flex', alignItems: 'center', flex: i < STEPS.length - 1 ? 1 : 0 }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: isComplete ? ACCENT : isActive ? 'rgba(0,255,136,0.15)' : 'rgba(255,255,255,0.05)',
                    border: `2px solid ${isComplete ? ACCENT : isActive ? ACCENT : 'rgba(255,255,255,0.12)'}`,
                    color: isComplete ? BG : isActive ? ACCENT : 'rgba(255,255,255,0.3)',
                    transition: 'all 0.3s',
                    boxShadow: isActive ? `0 0 16px rgba(0,255,136,0.3)` : 'none',
                  }}>
                    {isComplete
                      ? <Icon name="Check" size={16} />
                      : <Icon name={s.icon} size={16} />}
                  </div>
                  <span style={{ fontSize: 11, fontWeight: isActive ? 600 : 400, color: isActive ? ACCENT : isComplete ? '#fff' : 'rgba(255,255,255,0.3)', whiteSpace: 'nowrap' }}>{s.label}</span>
                </div>
                {i < STEPS.length - 1 && (
                  <div style={{ flex: 1, height: 2, background: isComplete ? `${ACCENT}60` : 'rgba(255,255,255,0.08)', margin: '0 8px', marginBottom: 22, transition: 'background 0.3s' }} />
                )}
              </div>
            );
          })}
        </div>

        {/* Карточка формы */}
        <div style={{ background: 'rgba(255,255,255,0.02)', border: `1px solid ${CARD_BOR}`, borderRadius: 20, padding: '36px 40px' }}>

          {/* ── ШАГ 1: Аккаунт ──────────────────────────────────────────── */}
          {step === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20, animation: 'fadeSlide 0.35s ease' }}>
              <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 20, fontWeight: 600, marginBottom: 4 }}>Данные для входа</h2>
              <Field label="Email" error={errs.email}>
                <input style={inputStyle(!!errs.email)} type="email" placeholder="cfo@company.com" value={form.email}
                  onChange={e => { set('email', e.target.value); clearErr('email'); }}
                  onFocus={e => (e.target.style.borderColor = ACCENT)}
                  onBlur={e => (e.target.style.borderColor = errs.email ? '#ff4444' : 'rgba(255,255,255,0.12)')}
                />
              </Field>
              <Field label="Пароль" error={errs.password}>
                <input style={inputStyle(!!errs.password)} type="password" placeholder="Минимум 8 символов" value={form.password}
                  onChange={e => { set('password', e.target.value); clearErr('password'); }}
                  onFocus={e => (e.target.style.borderColor = ACCENT)}
                  onBlur={e => (e.target.style.borderColor = errs.password ? '#ff4444' : 'rgba(255,255,255,0.12)')}
                />
              </Field>
              <Field label="Повторите пароль" error={errs.confirmPassword}>
                <input style={inputStyle(!!errs.confirmPassword)} type="password" placeholder="Повторите пароль" value={form.confirmPassword}
                  onChange={e => { set('confirmPassword', e.target.value); clearErr('confirmPassword'); }}
                  onFocus={e => (e.target.style.borderColor = ACCENT)}
                  onBlur={e => (e.target.style.borderColor = errs.confirmPassword ? '#ff4444' : 'rgba(255,255,255,0.12)')}
                />
              </Field>
              <div style={{ background: 'rgba(0,255,136,0.05)', border: `1px solid rgba(0,255,136,0.15)`, borderRadius: 10, padding: '12px 16px', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <Icon name="ShieldCheck" size={16} style={{ color: ACCENT, flexShrink: 0, marginTop: 1 }} />
                <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', lineHeight: 1.6 }}>
                  Данные для входа защищены. После верификации KYC вы получите полный доступ к платформе.
                </p>
              </div>
            </div>
          )}

          {/* ── ШАГ 2: Компания ─────────────────────────────────────────── */}
          {step === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20, animation: 'fadeSlide 0.35s ease' }}>
              <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 20, fontWeight: 600, marginBottom: 4 }}>Данные компании</h2>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <Field label="Название компании *" error={errs.company_name}>
                  <input style={{ ...inputStyle(!!errs.company_name), gridColumn: 'span 2' }} placeholder='ООО "Пример"' value={form.company_name}
                    onChange={e => { set('company_name', e.target.value); clearErr('company_name'); }}
                    onFocus={e => (e.target.style.borderColor = ACCENT)}
                    onBlur={e => (e.target.style.borderColor = errs.company_name ? '#ff4444' : 'rgba(255,255,255,0.12)')}
                  />
                </Field>
                <Field label="ИНН *" error={errs.inn}>
                  <input style={inputStyle(!!errs.inn)} placeholder="7736123456" maxLength={12} value={form.inn}
                    onChange={e => { set('inn', e.target.value.replace(/\D/g, '')); clearErr('inn'); }}
                    onFocus={e => (e.target.style.borderColor = ACCENT)}
                    onBlur={e => (e.target.style.borderColor = errs.inn ? '#ff4444' : 'rgba(255,255,255,0.12)')}
                  />
                </Field>
              </div>
              <Field label="Юридический адрес *" error={errs.legal_address}>
                <input style={inputStyle(!!errs.legal_address)} placeholder="г. Москва, ул. Примерная, д. 1" value={form.legal_address}
                  onChange={e => { set('legal_address', e.target.value); clearErr('legal_address'); }}
                  onFocus={e => (e.target.style.borderColor = ACCENT)}
                  onBlur={e => (e.target.style.borderColor = errs.legal_address ? '#ff4444' : 'rgba(255,255,255,0.12)')}
                />
              </Field>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <Field label="Генеральный директор *" error={errs.ceo_name}>
                  <input style={inputStyle(!!errs.ceo_name)} placeholder="Иванов Иван Иванович" value={form.ceo_name}
                    onChange={e => { set('ceo_name', e.target.value); clearErr('ceo_name'); }}
                    onFocus={e => (e.target.style.borderColor = ACCENT)}
                    onBlur={e => (e.target.style.borderColor = errs.ceo_name ? '#ff4444' : 'rgba(255,255,255,0.12)')}
                  />
                </Field>
                <Field label="Телефон *" error={errs.phone}>
                  <input style={inputStyle(!!errs.phone)} placeholder="+7 900 000 00 00" value={form.phone}
                    onChange={e => { set('phone', e.target.value); clearErr('phone'); }}
                    onFocus={e => (e.target.style.borderColor = ACCENT)}
                    onBlur={e => (e.target.style.borderColor = errs.phone ? '#ff4444' : 'rgba(255,255,255,0.12)')}
                  />
                </Field>
                <Field label="Сайт компании">
                  <input style={inputStyle()} placeholder="https://company.ru" value={form.website}
                    onChange={e => set('website', e.target.value)}
                    onFocus={e => (e.target.style.borderColor = ACCENT)}
                    onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.12)')}
                  />
                </Field>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <Field label="Тип деятельности *" error={errs.business_type}>
                  <select style={{ ...inputStyle(!!errs.business_type), appearance: 'none' }} value={form.business_type}
                    onChange={e => { set('business_type', e.target.value); clearErr('business_type'); }}
                    onFocus={e => (e.target.style.borderColor = ACCENT)}
                    onBlur={e => (e.target.style.borderColor = errs.business_type ? '#ff4444' : 'rgba(255,255,255,0.12)')}
                  >
                    <option value="" style={{ background: '#1a1a2e' }}>Выберите...</option>
                    {BUSINESS_TYPES.map(t => <option key={t.value} value={t.value} style={{ background: '#1a1a2e' }}>{t.label}</option>)}
                  </select>
                </Field>
                <Field label="Ожидаемый объём *" error={errs.monthly_volume}>
                  <select style={{ ...inputStyle(!!errs.monthly_volume), appearance: 'none' }} value={form.monthly_volume}
                    onChange={e => { set('monthly_volume', e.target.value); clearErr('monthly_volume'); }}
                    onFocus={e => (e.target.style.borderColor = ACCENT)}
                    onBlur={e => (e.target.style.borderColor = errs.monthly_volume ? '#ff4444' : 'rgba(255,255,255,0.12)')}
                  >
                    <option value="" style={{ background: '#1a1a2e' }}>Выберите...</option>
                    {VOLUMES.map(v => <option key={v.value} value={v.value} style={{ background: '#1a1a2e' }}>{v.label}</option>)}
                  </select>
                </Field>
              </div>
            </div>
          )}

          {/* ── ШАГ 3: Документы ────────────────────────────────────────── */}
          {step === 3 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24, animation: 'fadeSlide 0.35s ease' }}>
              <div>
                <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 20, fontWeight: 600, marginBottom: 6 }}>KYC-документы</h2>
                <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', lineHeight: 1.6 }}>
                  Загрузите корпоративные документы. Принимаются PDF, JPG, PNG — до 10 МБ каждый.
                  Документы не обязательны сейчас, но ускорят верификацию.
                </p>
              </div>
              <DocUploader label="Устав компании" hint="PDF · до 10 МБ" value={docs.charter} onChange={v => setDocs(p => ({ ...p, charter: v }))} />
              <DocUploader label="Паспорт генерального директора" hint="PDF, JPG, PNG · до 10 МБ" value={docs.ceo_id} onChange={v => setDocs(p => ({ ...p, ceo_id: v }))} />
              <DocUploader label="Выписка из ЕГРЮЛ (не старше 30 дней)" hint="PDF · до 10 МБ" value={docs.extract} onChange={v => setDocs(p => ({ ...p, extract: v }))} />
              <div style={{ background: 'rgba(0,255,136,0.04)', border: `1px solid rgba(0,255,136,0.15)`, borderRadius: 10, padding: '12px 16px', display: 'flex', gap: 10 }}>
                <Icon name="Lock" size={15} style={{ color: ACCENT, flexShrink: 0, marginTop: 1 }} />
                <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', lineHeight: 1.6 }}>
                  Документы хранятся в зашифрованном S3-хранилище с доступом только для compliance-офицеров. Не передаются третьим лицам.
                </p>
              </div>
            </div>
          )}

          {/* ── ШАГ 4: Подтверждение ────────────────────────────────────── */}
          {step === 4 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24, animation: 'fadeSlide 0.35s ease' }}>
              <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 20, fontWeight: 600, marginBottom: 4 }}>Проверьте данные</h2>

              {/* Сводка */}
              <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, overflow: 'hidden' }}>
                {[
                  { l: 'Email', v: form.email },
                  { l: 'Компания', v: form.company_name },
                  { l: 'ИНН', v: form.inn },
                  { l: 'Адрес', v: form.legal_address },
                  { l: 'Директор', v: form.ceo_name },
                  { l: 'Телефон', v: form.phone },
                  { l: 'Деятельность', v: BUSINESS_TYPES.find(t => t.value === form.business_type)?.label || '—' },
                  { l: 'Объём', v: VOLUMES.find(v => v.value === form.monthly_volume)?.label || '—' },
                ].map((row, i) => (
                  <div key={row.l} style={{ display: 'flex', padding: '11px 16px', borderBottom: i < 7 ? '1px solid rgba(255,255,255,0.05)' : 'none', gap: 12 }}>
                    <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', width: 110, flexShrink: 0 }}>{row.l}</span>
                    <span style={{ fontSize: 13, color: '#fff', fontWeight: 500 }}>{row.v || '—'}</span>
                  </div>
                ))}
                {/* Документы */}
                <div style={{ padding: '11px 16px', display: 'flex', gap: 8, flexWrap: 'wrap', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                  <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', width: 110 }}>Документы</span>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {[
                      { label: 'Устав', v: docs.charter },
                      { label: 'Паспорт', v: docs.ceo_id },
                      { label: 'Выписка', v: docs.extract },
                    ].map(d => (
                      <span key={d.label} style={{
                        fontSize: 11, padding: '3px 10px', borderRadius: 6,
                        background: d.v ? 'rgba(0,255,136,0.1)' : 'rgba(255,255,255,0.05)',
                        color: d.v ? ACCENT : 'rgba(255,255,255,0.3)',
                        border: `1px solid ${d.v ? 'rgba(0,255,136,0.2)' : 'rgba(255,255,255,0.08)'}`,
                      }}>
                        <Icon name={d.v ? 'FileCheck2' : 'FileMinus'} size={10} style={{ marginRight: 4 }} />
                        {d.label}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Согласия */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {[
                  { key: 'agree_kyc',   text: 'Согласен на обработку персональных данных и прохождение KYC/AML-проверки в соответствии с ФЗ №115' },
                  { key: 'agree_terms', text: 'Принимаю условия использования платформы MOST и политику конфиденциальности' },
                ].map(a => (
                  <label key={a.key} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', cursor: 'pointer' }}>
                    <div
                      onClick={() => { set(a.key as keyof FormData, !form[a.key as keyof FormData]); clearErr(a.key); }}
                      style={{
                        width: 20, height: 20, borderRadius: 5, flexShrink: 0, marginTop: 1,
                        background: form[a.key as keyof FormData] ? ACCENT : 'transparent',
                        border: `2px solid ${errs[a.key] ? '#ff4444' : form[a.key as keyof FormData] ? ACCENT : 'rgba(255,255,255,0.25)'}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'all 0.2s', cursor: 'pointer',
                      }}
                    >
                      {form[a.key as keyof FormData] && <Icon name="Check" size={12} style={{ color: BG }} />}
                    </div>
                    <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', lineHeight: 1.6 }}>{a.text}</span>
                  </label>
                ))}
                {(errs.agree_kyc || errs.agree_terms) && (
                  <div style={errStyle}><Icon name="AlertCircle" size={11} />Необходимо принять оба соглашения</div>
                )}
              </div>

              {serverError && (
                <div style={{ background: 'rgba(255,68,68,0.08)', border: '1px solid rgba(255,68,68,0.3)', borderRadius: 10, padding: '12px 16px', fontSize: 13, color: '#ff8888', display: 'flex', gap: 10, alignItems: 'center' }}>
                  <Icon name="AlertTriangle" size={16} />
                  {serverError}
                </div>
              )}
            </div>
          )}

          {/* Кнопки навигации */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 32, gap: 12 }}>
            {step > 1 ? (
              <button type="button" onClick={() => setStep(s => (s - 1) as Step)}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '12px 24px', borderRadius: 10, background: 'transparent', border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.7)', fontSize: 14, cursor: 'pointer', fontFamily: "'Rubik', sans-serif" }}>
                <Icon name="ChevronLeft" size={16} /> Назад
              </button>
            ) : (
              <a href="/" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '12px 24px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.7)', fontSize: 14, textDecoration: 'none' }}>
                <Icon name="ChevronLeft" size={16} /> На главную
              </a>
            )}

            {step < 4 ? (
              <button type="button" onClick={nextStep}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '12px 28px', borderRadius: 10, background: ACCENT, border: 'none', color: BG, fontSize: 14, fontWeight: 700, cursor: 'pointer', boxShadow: `0 0 20px rgba(0,255,136,0.3)`, fontFamily: "'Rubik', sans-serif", transition: 'opacity 0.2s' }}
                onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
                onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
              >
                Далее <Icon name="ChevronRight" size={16} />
              </button>
            ) : (
              <button type="button" onClick={submit} disabled={loading}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 32px', borderRadius: 10, background: loading ? 'rgba(0,255,136,0.5)' : ACCENT, border: 'none', color: BG, fontSize: 14, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', boxShadow: `0 0 20px rgba(0,255,136,0.3)`, fontFamily: "'Rubik', sans-serif" }}>
                {loading ? <><Icon name="Loader" size={16} style={{ animation: 'spin 1s linear infinite' }} /> Отправляем...</> : <><Icon name="Send" size={16} /> Отправить заявку</>}
              </button>
            )}
          </div>
        </div>

        {/* Доверие */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 28, marginTop: 32, flexWrap: 'wrap' }}>
          {[
            { icon: 'Lock', text: 'Данные зашифрованы' },
            { icon: 'ShieldCheck', text: 'FATF Compliant AML' },
            { icon: 'Eye', text: 'Только для compliance' },
          ].map(t => (
            <div key={t.text} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>
              <Icon name={t.icon} size={13} style={{ color: 'rgba(0,255,136,0.5)' }} />
              {t.text}
            </div>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes fadeSlide { from { opacity:0; transform:translateX(12px); } to { opacity:1; transform:translateX(0); } }
        @keyframes spin { to { transform: rotate(360deg); } }
        select option { background: #1a1a2e; color: #fff; }
        input::placeholder { color: rgba(255,255,255,0.25); }
        input:focus, select:focus { outline: none; }
      `}</style>
    </div>
  );
}