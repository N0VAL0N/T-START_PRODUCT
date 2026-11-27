// ===== Аккаунты: регистрация, вход, сессия, состояние =====
// Только серверное состояние, физически защищённое БД. Клиент (IndexedDB) — кэш.
//
// Разрешённые поля состояния (whitelist). Всё, что можно накрутить, живёт тут:
//   balance        — виртуальный капитал (в рублях, число; для MVP — рубли, не копейки)
//   portfolio      — вложено в бумаги (₽)
//   portfolioStocks— [{ ticker, qty, avgPrice }]
//   deals          — количество сделок
//   chaptersDone   — пройденные главы (id)
//   achievements   — доп. достижения (строки)
//   champion       — победил в турнире (даёт право носить костюм)
//   unlockedOutfits— реально заработанные наряды (права проверяются сервером)
//   profitability  — доходность, %
//   daysStreak     — серия дней подряд
const STATE_WHITELIST = [
  'balance', 'portfolio', 'portfolioStocks', 'deals', 'chaptersDone',
  'achievements', 'champion', 'unlockedOutfits', 'profitability', 'daysStreak',
];

import { randomUUID } from 'node:crypto';
import { query, ensureSchema, isDbAvailable } from './db.mjs';
import {
  hashPassword, verifyPassword, validateCredentials,
  signToken, verifyToken, getSessionToken,
} from './auth.mjs';

export function createAccounts({ config }) {
  const secret = config.JWT_SECRET;
  const enabled = isDbAvailable() && !!secret;

  function disabled() {
    return { status: 503, body: { error: 'ACCOUNTS_DISABLED', message: 'Аккаунты временно недоступны (нет БД/секрета на сервере).' } };
  }

  function sanitizeState(input) {
    const out = {};
    if (!input || typeof input !== 'object') return out;
    for (const key of STATE_WHITELIST) {
      if (key in input) out[key] = input[key];
    }
    return out;
  }

  async function currentUser(req) {
    if (!enabled) return null;
    const token = getSessionToken(req);
    if (!token) return null;
    const payload = verifyToken(token, secret);
    if (!payload?.uid) return null;
    return { id: payload.uid, username: payload.username };
  }

  async function register({ username, password }) {
    if (!enabled) return disabled();
    const v = validateCredentials(username, password);
    if (!v.ok) return { status: 400, body: { error: v.error, message: v.message } };
    await ensureSchema();

    const existing = await query('SELECT id FROM users WHERE lower(username) = lower($1)', [v.username]);
    if (existing.rows.length) return { status: 409, body: { error: 'USERNAME_TAKEN', message: 'Этот логин уже занят.' } };

    const id = randomUUID();
    const passHash = hashPassword(password);
    await query('INSERT INTO users (id, username, pass_hash) VALUES ($1, $2, $3)', [id, v.username, passHash]);
    return { status: 200, body: { user: { id, username: v.username } }, setSession: { uid: id, username: v.username } };
  }

  async function login({ username, password }) {
    if (!enabled) return disabled();
    const u = typeof username === 'string' ? username.trim() : '';
    if (!u || !password) return { status: 400, body: { error: 'BAD_CREDENTIALS', message: 'Введите логин и пароль.' } };
    await ensureSchema();

    const res = await query('SELECT id, username, pass_hash FROM users WHERE lower(username) = lower($1)', [u]);
    const row = res.rows[0];
    if (!row || !verifyPassword(password, row.pass_hash)) {
      return { status: 401, body: { error: 'INVALID_LOGIN', message: 'Неверный логин или пароль.' } };
    }
    return { status: 200, body: { user: { id: row.id, username: row.username } }, setSession: { uid: row.id, username: row.username } };
  }

  async function getMe(req) {
    if (!enabled) return { ...disabled(), ok: false };
    const user = await currentUser(req);
    if (!user) return { status: 200, body: { user: null } };
    await ensureSchema();
    const res = await query('SELECT data, updated_at FROM user_state WHERE user_id = $1', [user.id]);
    const state = res.rows[0]?.data || {};
    return { status: 200, body: { user, state, updatedAt: res.rows[0]?.updated_at || null } };
  }

  // Частичное обновление состояния: разрешены только ключи из whitelist.
  async function updateState(req, patch) {
    if (!enabled) return disabled();
    const user = await currentUser(req);
    if (!user) return { status: 401, body: { error: 'UNAUTHORIZED', message: 'Требуется вход.' } };
    await ensureSchema();

    const safe = sanitizeState(patch);
    if (!Object.keys(safe).length) return { status: 400, body: { error: 'EMPTY_PATCH', message: 'Нет разрешённых полей.' } };

    // merge JSONB на стороне БД (атомарно)
    const res = await query(
      `INSERT INTO user_state (user_id, data, updated_at)
       VALUES ($1, $2::jsonb, now())
       ON CONFLICT (user_id)
       DO UPDATE SET data = user_state.data || EXCLUDED.data, updated_at = now()
       RETURNING data, updated_at`,
      [user.id, JSON.stringify(safe)],
    );
    return { status: 200, body: { state: res.rows[0].data, updatedAt: res.rows[0].updated_at } };
  }

  function issueToken(session) {
    return signToken(session, secret);
  }

  return { enabled, register, login, getMe, updateState, currentUser, issueToken, sanitizeState };
}
