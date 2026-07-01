/**
 * useApi — централизованный fetch с JWT Bearer-токеном.
 * Автоматически добавляет Authorization: Bearer <token> из localStorage.
 * При 401 — чистит токен и редиректит на /login.
 */
import { useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';

const TOKEN_KEY = 'most_auth_token';

export function useApi() {
  const { logout } = useAuth();

  const apiFetch = useCallback(async (
    url: string,
    options: RequestInit = {},
  ): Promise<Response> => {
    const token = localStorage.getItem(TOKEN_KEY);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {}),
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(url, { ...options, headers });

    if (res.status === 401) {
      logout();
      window.location.href = '/login';
    }

    return res;
  }, [logout]);

  return { apiFetch };
}
