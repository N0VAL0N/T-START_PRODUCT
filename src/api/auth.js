// ===== Клиент аккаунтов =====
// Все запросы идут с cookies (credentials: 'include') — сессия в httpOnly-cookie,
// пароль/токен во фронте НЕ хранятся.

const API = '/api';

async function call(path, { method = 'GET', body } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    credentials: 'include',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = {};
  try { data = await res.json(); } catch { /* пусто */ }
  if (!res.ok) {
    const err = new Error(data?.message || data?.error || `AUTH_ERROR_${res.status}`);
    err.code = data?.error;
    err.status = res.status;
    throw err;
  }
  return data;
}

export const register = (username, password) => call('/auth/register', { method: 'POST', body: { username, password } });
export const login = (username, password) => call('/auth/login', { method: 'POST', body: { username, password } });
export const logout = () => call('/auth/logout', { method: 'POST' });
export const getMe = () => call('/me');
export const putState = (patch) => call('/state', { method: 'PUT', body: patch });
