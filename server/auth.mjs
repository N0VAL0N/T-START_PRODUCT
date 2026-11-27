// ===== Аутентификация =====
// - Пароли: scrypt (node:crypto), хранится соль+хэш в одной строке.
// - Сессия: JWT (HS256) в httpOnly-cookie. Фронт пароль не хранит.
// Без доп. зависимостей — только node:crypto.
//
// Формат cookie: tstart_session=<jwt>; HttpOnly; SameSite=Lax; Path=/; [Secure]

import { randomBytes, scryptSync, timingSafeEqual, createHmac } from 'node:crypto';

const COOKIE_NAME = 'tstart_session';
const SESSION_TTL_SEC = 60 * 60 * 24 * 30; // 30 дней

// ---------- Пароль ----------
export function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `scrypt:${salt}:${hash}`;
}

export function verifyPassword(password, stored) {
  try {
    const [algo, salt, hash] = String(stored).split(':');
    if (algo !== 'scrypt' || !salt || !hash) return false;
    const derived = scryptSync(password, salt, 64);
    const expected = Buffer.from(hash, 'hex');
    return derived.length === expected.length && timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

export function validateCredentials(username, password) {
  const u = typeof username === 'string' ? username.trim() : '';
  if (!/^[a-zA-Z0-9_.-]{3,24}$/.test(u)) {
    return { ok: false, error: 'BAD_USERNAME', message: 'Логин: 3–24 символа (латиница, цифры, . _ -).' };
  }
  if (typeof password !== 'string' || password.length < 6 || password.length > 72) {
    return { ok: false, error: 'BAD_PASSWORD', message: 'Пароль: 6–72 символа.' };
  }
  return { ok: true, username: u };
}

// ---------- JWT (HS256) ----------
function b64url(buf) {
  return Buffer.from(buf).toString('base64url');
}
function sign(data, secret) {
  return createHmac('sha256', secret).update(data).digest('base64url');
}

export function signToken(payload, secret, ttlSec = SESSION_TTL_SEC) {
  const now = Math.floor(Date.now() / 1000);
  const body = { ...payload, iat: now, exp: now + ttlSec };
  const head = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const data = b64url(JSON.stringify(body));
  const sig = sign(`${head}.${data}`, secret);
  return `${head}.${data}.${sig}`;
}

export function verifyToken(token, secret) {
  try {
    const [head, data, sig] = String(token).split('.');
    if (!head || !data || !sig) return null;
    const expected = sign(`${head}.${data}`, secret);
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    const payload = JSON.parse(Buffer.from(data, 'base64url').toString('utf8'));
    if (!payload?.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

// ---------- Cookie ----------
export function parseCookies(header = '') {
  const out = {};
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i === -1) continue;
    const k = part.slice(0, i).trim();
    const v = part.slice(i + 1).trim();
    if (k) out[k] = decodeURIComponent(v);
  }
  return out;
}

export function buildSessionCookie(token, { secure = true, maxAge = SESSION_TTL_SEC } = {}) {
  const parts = [`${COOKIE_NAME}=${encodeURIComponent(token)}`, 'HttpOnly', 'SameSite=Lax', 'Path=/', `Max-Age=${maxAge}`];
  if (secure) parts.push('Secure');
  return parts.join('; ');
}

export function buildClearCookie({ secure = true } = {}) {
  const parts = [`${COOKIE_NAME}=`, 'HttpOnly', 'SameSite=Lax', 'Path=/', 'Max-Age=0'];
  if (secure) parts.push('Secure');
  return parts.join('; ');
}

export function getSessionToken(req) {
  const cookies = parseCookies(req.headers?.cookie || '');
  return cookies[COOKIE_NAME] || null;
}

export { COOKIE_NAME, SESSION_TTL_SEC };
