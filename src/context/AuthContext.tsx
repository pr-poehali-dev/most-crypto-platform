import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';

const LOGIN_URL = 'https://functions.poehali.dev/038f9a88-6440-49a4-ba7a-c5a0bb4731a6';
const TOKEN_KEY = 'most_auth_token';
const USER_KEY  = 'most_auth_user';

// ─── Типы ─────────────────────────────────────────────────────────────────────
export interface AuthUser {
  id:           string;
  email:        string;
  company_name: string | null;
  inn:          string | null;
  role:         'superadmin' | 'admin' | 'finance' | 'compliance' | 'devops' | 'user' | 'regulator';
  status:       'active' | 'pending_kyc' | 'blocked' | 'suspended';
}

interface AuthState {
  user:    AuthUser | null;
  token:   string | null;
  loading: boolean;
  error:   string | null;
}

interface AuthContextValue extends AuthState {
  login:  (email: string, password: string) => Promise<void>;
  logout: () => void;
  clearError: () => void;
  isAuthenticated: boolean;
  hasRole: (...roles: AuthUser['role'][]) => boolean;
}

// ─── Хелперы ──────────────────────────────────────────────────────────────────
function parseJwtExpiry(token: string): number | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.exp ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

function isTokenExpired(token: string): boolean {
  const exp = parseJwtExpiry(token);
  if (!exp) return true;
  return Date.now() >= exp - 60_000; // 60 сек запас
}

// ─── Context ──────────────────────────────────────────────────────────────────
const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(() => {
    // Восстанавливаем из localStorage при старте
    try {
      const token = localStorage.getItem(TOKEN_KEY);
      const user  = localStorage.getItem(USER_KEY);
      if (token && user && !isTokenExpired(token)) {
        return { token, user: JSON.parse(user), loading: false, error: null };
      }
    } catch { /* ignore */ }
    return { token: null, user: null, loading: false, error: null };
  });

  // Авто-очистка истёкших токенов
  useEffect(() => {
    if (!state.token) return;
    const exp = parseJwtExpiry(state.token);
    if (!exp) return;
    const ms = exp - Date.now() - 60_000;
    if (ms <= 0) { logout(); return; }
    const t = setTimeout(logout, ms);
    return () => clearTimeout(t);
  }, [state.token]);

  const login = useCallback(async (email: string, password: string) => {
    setState(s => ({ ...s, loading: true, error: null }));
    try {
      const res  = await fetch(LOGIN_URL, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email: email.trim().toLowerCase(), password }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }

      const { access_token, user } = data;

      localStorage.setItem(TOKEN_KEY, access_token);
      localStorage.setItem(USER_KEY,  JSON.stringify(user));

      setState({ token: access_token, user, loading: false, error: null });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Ошибка входа';
      setState(s => ({ ...s, loading: false, error: msg }));
      throw e; // пробрасываем для обработки в UI
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setState({ token: null, user: null, loading: false, error: null });
  }, []);

  const clearError = useCallback(() => {
    setState(s => ({ ...s, error: null }));
  }, []);

  const hasRole = useCallback((...roles: AuthUser['role'][]) => {
    return state.user ? roles.includes(state.user.role) : false;
  }, [state.user]);

  return (
    <AuthContext.Provider value={{
      ...state,
      login,
      logout,
      clearError,
      isAuthenticated: !!state.user && !!state.token,
      hasRole,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}