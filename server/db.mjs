// ===== Доступ к Vercel Postgres / Neon =====
// Работает через стандартный пул pg. Если DATABASE_URL не задан (например, локально
// без БД) — модуль НЕ падает, а сообщает available=false: аккаунты-фичи отключаются,
// остальное приложение живёт как прежде.
//
// Схема (создаётся один раз при первом обращении):
//   users      (id UUID PK, username TEXT UNIQUE, pass_hash TEXT, created_at)
//   user_state (user_id UUID PK REFERENCES users, data JSONB, updated_at)
//
// Разделение «защищаемое/локальное»: в user_state лежит только то, что нужно
// защищать (капитал, портфель, достижения, champion/права на костюмы). Тема,
// аватар и анимации остаются в IndexedDB и тут не хранятся.

import pg from 'pg';

const { Pool } = pg;

let pool = null;
let schemaReady = null;
let available = false;

export function initDb(config) {
  if (pool) return { pool, available };
  const connectionString = config?.DATABASE_URL;
  if (!connectionString) {
    available = false;
    return { pool: null, available };
  }

  pool = new Pool({
    connectionString,
    // Neon/Vercel Postgres отдают сертификат, который Node не всегда знает в цепочке.
    // Подключаемся с отключённой проверкой только на стороне БД (строка из Neon и так приватна).
    ssl: { rejectUnauthorized: false },
    max: 5,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 8_000,
  });

  // Не роняем процесс, если пул сообщит об ошибке простаивающего соединения.
  pool.on('error', (e) => console.warn('[db] pool error:', e.message));

  available = true;
  return { pool, available };
}

export function isDbAvailable() {
  return available;
}

// Ленивая инициализация схемы: один раз на процесс.
export function ensureSchema() {
  if (!available || !pool) return Promise.resolve(false);
  if (schemaReady) return schemaReady;
  schemaReady = (async () => {
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS users (
          id         UUID PRIMARY KEY,
          username   TEXT UNIQUE NOT NULL,
          pass_hash  TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
      `);
      await pool.query(`
        CREATE TABLE IF NOT EXISTS user_state (
          user_id    UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
          data       JSONB NOT NULL DEFAULT '{}'::jsonb,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
      `);
      return true;
    } catch (e) {
      console.warn('[db] ensureSchema failed:', e.message);
      return false;
    }
  })();
  return schemaReady;
}

export function query(text, params) {
  if (!pool) throw new Error('DB_UNAVAILABLE');
  return pool.query(text, params);
}
