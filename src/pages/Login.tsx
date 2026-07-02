import { useState, useEffect, type FormEvent } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth, type AuthUser } from '@/context/AuthContext';
import Icon from '@/components/ui/icon';

const ACCENT = '#00FF88';
const BG     = '#0A0A1A';

// Куда редиректить по роли после входа
function roleDestination(role: AuthUser['role']): string {
  switch (role) {
    case 'superadmin': return '/admin';
    case 'admin':      return '/admin';
    case 'finance':    return '/admin';
    case 'devops':     return '/admin';
    case 'compliance': return '/compliance-officer';
    case 'regulator':  return '/regulator';
    default:           return '/dashboard';
  }
}

export default function Login() {
  const { login, loading, error, clearError, isAuthenticated, user } = useAuth();
  const navigate  = useNavigate();
  const location  = useLocation();

  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [touched,  setTouched]  = useState({ email: false, password: false });

  // Если уже авторизован — редиректим
  useEffect(() => {
    if (isAuthenticated && user) {
      const from = (location.state as { from?: string })?.from;
      navigate(from || roleDestination(user.role), { replace: true });
    }
  }, [isAuthenticated, user, navigate, location.state]);

  const emailErr    = touched.email    && !email.includes('@');
  const passwordErr = touched.password && password.length < 6;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setTouched({ email: true, password: true });
    if (!email.includes('@') || password.length < 6) return;
    clearError();
    try {
      await login(email, password);
      // Редирект произойдёт в useEffect выше
    } catch { /* ошибка уже в state */ }
  };

  const inp = (hasError: boolean): React.CSSProperties => ({
    width: '100%', padding: '13px 16px', borderRadius: 11, fontSize: 15,
    background: 'rgba(255,255,255,0.05)',
    border: `1px solid ${hasError ? '#ff4444' : 'rgba(255,255,255,0.12)'}`,
    color: '#fff', outline: 'none', boxSizing: 'border-box',
    fontFamily: "'Rubik', sans-serif", transition: 'border-color 0.2s',
  });

  return (
    <div style={{ background: BG, minHeight: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', fontFamily: "'Rubik', sans-serif", position: 'relative', overflow: 'hidden' }}>

      {/* Фоновая сетка */}
      <div style={{ position: 'fixed', inset: 0, opacity: 0.09,
        backgroundImage: `linear-gradient(rgba(0,255,136,0.2) 1px, transparent 1px),
                          linear-gradient(90deg, rgba(0,255,136,0.2) 1px, transparent 1px)`,
        backgroundSize: '48px 48px', pointerEvents: 'none' }} />
      <div style={{ position: 'fixed', inset: 0,
        background: `radial-gradient(ellipse 80% 60% at 50% -10%, rgba(0,255,136,0.08) 0%, transparent 60%)`,
        pointerEvents: 'none' }} />

      <div style={{ position: 'relative', width: '100%', maxWidth: 420, padding: 24 }}>

        {/* Логотип */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <a href="/" style={{ display: 'inline-flex', alignItems: 'center', textDecoration: 'none', marginBottom: 8 }}>
            <img src="https://cdn.poehali.dev/projects/573c75be-a606-4ed0-96a4-1601ddf0b628/bucket/6357c7e8-9711-4d17-a842-e36565661a52.png" alt="MOST" style={{ height: 64, width: 'auto', objectFit: 'contain', filter: 'drop-shadow(0 0 16px rgba(0,255,136,0.4))' }} />
          </a>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)', marginTop: 6 }}>
            Платформа трансграничных крипто-платежей
          </p>
        </div>

        {/* Карточка */}
        <div style={{ background: 'rgba(255,255,255,0.025)',
          border: '1px solid rgba(0,255,136,0.15)', borderRadius: 20, padding: '36px 36px 32px' }}>

          <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 22, fontWeight: 700,
            marginBottom: 6, color: '#fff' }}>Вход в кабинет</h1>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginBottom: 28 }}>
            Введите email и пароль для входа
          </p>

          <form onSubmit={handleSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

            {/* Email */}
            <div>
              <label style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', display: 'block', marginBottom: 6 }}>
                Email
              </label>
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onBlur={() => setTouched(t => ({ ...t, email: true }))}
                placeholder="you@company.ru"
                style={inp(emailErr)}
                onFocus={e => (e.target.style.borderColor = ACCENT)}
              />
              {emailErr && (
                <div style={{ fontSize: 12, color: '#ff6666', marginTop: 4,
                  display: 'flex', alignItems: 'center', gap: 5 }}>
                  <Icon name="AlertCircle" size={12} /> Введите корректный email
                </div>
              )}
            </div>

            {/* Пароль */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <label style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>Пароль</label>
                <a href="/forgot-password" style={{ fontSize: 12, color: `${ACCENT}cc`, textDecoration: 'none' }}>
                  Забыли пароль?
                </a>
              </div>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPass ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  onBlur={() => setTouched(t => ({ ...t, password: true }))}
                  placeholder="••••••••"
                  style={{ ...inp(passwordErr), paddingRight: 44 }}
                  onFocus={e => (e.target.style.borderColor = ACCENT)}
                />
                <button
                  type="button"
                  onClick={() => setShowPass(s => !s)}
                  style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)',
                    cursor: 'pointer', padding: 4 }}>
                  <Icon name={showPass ? 'EyeOff' : 'Eye'} size={16} />
                </button>
              </div>
              {passwordErr && (
                <div style={{ fontSize: 12, color: '#ff6666', marginTop: 4,
                  display: 'flex', alignItems: 'center', gap: 5 }}>
                  <Icon name="AlertCircle" size={12} /> Минимум 6 символов
                </div>
              )}
            </div>

            {/* Ошибка сервера */}
            {error && (
              <div style={{ background: 'rgba(255,68,68,0.08)', border: '1px solid rgba(255,68,68,0.25)',
                borderRadius: 10, padding: '12px 14px', display: 'flex', alignItems: 'center',
                gap: 10, fontSize: 13, color: '#ff8888' }}>
                <Icon name="AlertTriangle" size={15} style={{ flexShrink: 0 }} />
                {error}
              </div>
            )}

            {/* Кнопка */}
            <button
              type="submit"
              disabled={loading}
              style={{ padding: '14px', borderRadius: 12, background: loading ? `${ACCENT}88` : ACCENT,
                color: BG, fontWeight: 700, fontSize: 15, border: 'none',
                cursor: loading ? 'not-allowed' : 'pointer',
                boxShadow: loading ? 'none' : `0 0 24px ${ACCENT}44`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                transition: 'all 0.2s', fontFamily: "'Rubik', sans-serif' " }}>
              {loading
                ? <><Icon name="Loader" size={16} style={{ animation: 'spin 1s linear infinite' }} /> Входим...</>
                : <><Icon name="LogIn" size={16} /> Войти</>}
            </button>
          </form>
        </div>

        {/* Ссылки */}
        <div style={{ textAlign: 'center', marginTop: 20, fontSize: 13,
          color: 'rgba(255,255,255,0.35)' }}>
          Нет аккаунта?{' '}
          <a href="/register" style={{ color: ACCENT, textDecoration: 'none', fontWeight: 500 }}>
            Зарегистрироваться
          </a>
        </div>

        {/* Роли-подсказки для демо */}
        <div style={{ marginTop: 28, background: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12,
          padding: '14px 16px' }}>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', letterSpacing: '0.1em',
            fontFamily: 'JetBrains Mono, monospace', marginBottom: 10 }}>ДЕМО-АККАУНТЫ</div>
          {[
            { label: 'Клиент',       email: 'user@most.network',        password: 'User1234!',   role: 'user',       dest: '/dashboard'  },
            { label: 'Compliance',   email: 'compliance@most.network',   password: 'Comp1234!',   role: 'compliance', dest: '/compliance' },
            { label: 'Регулятор',    email: 'regulator@most.network',    password: 'Reg12345!',   role: 'regulator',  dest: '/dashboard'  },
          ].map(acc => (
            <button
              key={acc.email}
              onClick={() => { setEmail(acc.email); setPassword(acc.password); setTouched({ email: false, password: false }); }}
              style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                padding: '8px 10px', borderRadius: 8, background: 'transparent',
                border: 'none', color: 'rgba(255,255,255,0.55)', cursor: 'pointer',
                fontSize: 12, textAlign: 'left', fontFamily: "'Rubik', sans-serif",
                transition: 'background 0.15s, color 0.15s', marginBottom: 2 }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = '#fff'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.55)'; }}>
              <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 5,
                background: 'rgba(0,255,136,0.1)', color: ACCENT,
                fontFamily: 'JetBrains Mono, monospace' }}>{acc.role}</span>
              <span style={{ flex: 1 }}>{acc.label}</span>
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)' }}>→ {acc.dest}</span>
            </button>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        input::placeholder { color: rgba(255,255,255,0.2); }
        input:focus { border-color: ${ACCENT} !important; }
      `}</style>
    </div>
  );
}