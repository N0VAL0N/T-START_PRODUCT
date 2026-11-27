// ===== Бэкенд T-Start =====
// Зачем нужен:
//  1) Токены (DeepSeek AI, T-Invest) не светятся во фронте.
//  2) Песочница T-Invest проксируется с сервера — нет CORS.
//  3) MCP-эндпоинт «инструменты песочницы» + отложенные заявки.
//
// Запуск: node server/index.mjs  (или npm run server; Vite проксирует /api -> :8787)
// Переменные берём из окружения (.env в корне — только для локальной разработки).
//
// БЕЗОПАСНОСТЬ TLS: по умолчанию проверка сертификатов ВКЛЮЧЕНА (rejectUnauthorized: true).
// Локальный костыль под антивирус/прокси (подмена сертификата): TSTART_INSECURE_TLS=1 в .env.
// В проде эту переменную НЕ задавать — там проверка остаётся включённой.

import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, extname } from 'node:path';
import https from 'node:https';
import tls from 'node:tls';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

// ---------- Доверенные CA: Russian Trusted (Минцифры) из certs/ ----------
// Т-Банк перевёл API на сертификаты НУЦ Минцифры (Russian Trusted Root/Sub CA),
// которых нет в стандартном хранилище Node → SELF_SIGNED_CERT_IN_CHAIN на чистом
// сервере (Amvera и т.п.). Добавляем эти ПУБЛИЧНЫЕ CA к доверенным.
// Проверка TLS остаётся ВКЛЮЧЕННОЙ; мы лишь доверяем легитимному CA.
// Также поддерживаем стандартный NODE_EXTRA_CA_CERTS и папку из EXTRA_CA_DIR.
function loadCaFileToBuffers(file) {
  try {
    if (!existsSync(file)) return [];
    return [readFileSync(file)];
  } catch { return []; }
}
function loadExtraCAs() {
  const out = [];
  // 1) стандартная переменная (если задана и читается на старте)
  if (process.env.NODE_EXTRA_CA_CERTS) out.push(...loadCaFileToBuffers(process.env.NODE_EXTRA_CA_CERTS));
  // 2) папки: certs/ в корне и EXTRA_CA_DIR
  const dirs = [join(root, 'certs'), ...(process.env.EXTRA_CA_DIR ? [process.env.EXTRA_CA_DIR] : [])];
  for (const dir of dirs) {
    try {
      if (!existsSync(dir)) continue;
      for (const name of readdirSync(dir)) {
        if (!/\.(pem|cer|crt)$/i.test(name)) continue;
        out.push(...loadCaFileToBuffers(join(dir, name)));
      }
    } catch { /* нет папки */ }
  }
  return out;
}
const EXTRA_CAS = loadExtraCAs();
// Дополняем системные корни нашими (не заменяем!), только если что-то добавили.
const SYSTEM_CAS = tls.rootCertificates.map((pem) => Buffer.from(pem));
const TRUSTED_CA = EXTRA_CAS.length ? [...EXTRA_CAS, ...SYSTEM_CAS] : undefined;

// ---------- .env (загружается ТОЛЬКО при локальном запуске; в prod — process.env) ----------
function loadEnv() {
  const env = {};
  // В проде (Vercel) читаем только реальные переменные окружения, файлы .env игнорируем.
  if (process.env.VERCEL) return { ...process.env };
  for (const name of ['.env', '.env.local']) {
    try {
      const txt = readFileSync(join(root, name), 'utf8');
      for (const line of txt.split('\n')) {
        if (!line.trim() || line.trim().startsWith('#')) continue;
        const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
        if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
      }
    } catch { /* нет файла */ }
  }
  return { ...process.env, ...env };
}
const ENV = loadEnv();

// Порт: приоритет — PORT (платформы: Amvera/Render), затем TSTART_PORT, затем 8787.
const PORT = Number(process.env.PORT || process.env.TSTART_PORT || 8787);

// ---------- AI: DeepSeek (OpenAI-совместимый API) ----------
const AI_URL = ENV.DEEPSEEK_API_URL || 'https://api.deepseek.com';
const AI_KEY = ENV.DEEPSEEK_API_KEY;
const MODEL = ENV.DEEPSEEK_MODEL || 'deepseek-chat';

const INVEST_URL = ENV.TINVEST_SANDBOX_URL || 'https://sandbox-invest-public-api.tbank.ru/rest';
const INVEST_TOKEN = ENV.TINVEST_TOKEN;
const APP_NAME = ENV.TINVEST_APP_NAME || 'T-Start';
const CONTRACT = 'tinkoff.public.invest.api.contract.v1';
// Готовый sandbox-счёт (если задан — переиспользуем, не создаём новый).
const ENV_SANDBOX_ACCOUNT_ID = (ENV.TINVEST_SANDBOX_ACCOUNT_ID || '').trim();

// ЛОКАЛЬНЫЙ костыль под антивирус/прокси (Kaspersky и т.п.), который подменяет
// сертификат TLS → SELF_SIGNED_CERT_IN_CHAIN. Включается ТОЛЬКО явно в .env
// (TSTART_INSECURE_TLS=1). По умолчанию ВЫКЛЮЧЕН, в проде не задаётся.
const INSECURE_TLS = ENV.TSTART_INSECURE_TLS === '1';

// ---------- HTTPS helper (проверка сертификата ВСЕГДА включена) ----------
// Таймаут: у Vercel (Hobby) лимит ~10с на функцию — держим запас.
const HTTP_TIMEOUT_MS = 8500;

function httpsJson(url, { method = 'GET', headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const payload = body ? JSON.stringify(body) : undefined;
    const req = https.request(
      {
        hostname: u.hostname,
        port: u.port || 443,
        path: u.pathname + u.search,
        method,
        headers: {
          ...(payload ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } : {}),
          ...headers,
        },
        // Проверка сертификата включена, КРОМЕ случая, когда явно задан
        // TSTART_INSECURE_TLS=1 (локальный антивирус/прокси). В проде — true.
        rejectUnauthorized: !INSECURE_TLS,
        // Russian Trusted (Минцифры) и прочие CA из certs/ — в ДОПОЛНЕНИЕ к системным.
        ...(TRUSTED_CA ? { ca: TRUSTED_CA } : {}),
      },
      (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          let json;
          try { json = data ? JSON.parse(data) : {}; } catch { json = { raw: data }; }
          if (res.statusCode >= 200 && res.statusCode < 300) resolve(json);
          else reject(new Error(`HTTP ${res.statusCode}: ${data.slice(0, 200)}`));
        });
      }
    );
    // Жёсткий таймаут, чтобы не упираться в лимит платформы.
    req.setTimeout(HTTP_TIMEOUT_MS, () => req.destroy(new Error('TIMEOUT')));
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

// ---------- T-Invest sandbox ----------
const investCall = (method, body = {}) =>
  httpsJson(`${INVEST_URL}/${CONTRACT}.${method}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${INVEST_TOKEN}`, 'x-app-name': APP_NAME },
    body,
  });

const toQ = (value) => ({
  currency: 'rub',
  units: String(Math.floor(value)),
  nano: Math.round((value - Math.floor(value)) * 1e9),
});
const fromQ = (q) => (q ? Number(q.units || 0) + Number(q.nano || 0) / 1e9 : 0);

// Флаги готовности интеграций (по наличию ключей в env).
const AI_READY = Boolean(AI_KEY && AI_KEY.startsWith('sk-') && !AI_KEY.startsWith('your-'));
const INVEST_READY = Boolean(INVEST_TOKEN && !INVEST_TOKEN.startsWith('your-'));

// ---------- Валидация входных данных (защита от инъекций/мусора) ----------
/**
 * Строгая валидация тикера: только латиница A-Z, 1..10 символов.
 * Существование тикера у брокера проверяется отдельно (в списке Shares).
 */
function sanitizeTicker(value) {
  const t = String(value ?? '').trim().toUpperCase();
  if (!/^[A-Z]{1,10}$/.test(t)) throw new Error('BAD_TICKER');
  return t;
}

/**
 * Проверка, что тикер реально торгуется у брокера (по справочнику Shares),
 * и получение его инструмента. Так произвольная строка не дойдёт до заявки.
 */
async function resolveTradeableShare(ticker) {
  const clean = sanitizeTicker(ticker);
  const all = await getAllShares();
  const found = all.find((s) => s.ticker === clean);
  if (!found) throw new Error('TICKER_NOT_ALLOWED');
  return found;
}

/** Лоты: целое 1..10000. */
function sanitizeLots(value) {
  const n = Number(value ?? 1);
  if (!Number.isInteger(n) || n < 1 || n > 10000) throw new Error('BAD_LOTS');
  return n;
}

/** Направление: строго BUY/SELL. */
function sanitizeDirection(value) {
  const d = String(value ?? 'BUY').toUpperCase();
  if (d !== 'BUY' && d !== 'SELL') throw new Error('BAD_DIRECTION');
  return d;
}

/** История чата: массив {role,messages}, ограниченный по размеру и длине. */
function sanitizeHistory(history) {
  if (!Array.isArray(history)) return [];
  const MAX_MSGS = 30;
  const MAX_LEN = 4000;
  return history
    .slice(-MAX_MSGS)
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant' || m.role === 'system'))
    .map((m) => ({ role: m.role, content: String(m.content ?? '').slice(0, MAX_LEN) }));
}

// ---------- HTTP helper для внешних JSON-api (AI) ----------
function httpJson(url, { method = 'GET', headers = {}, body } = {}) {
  const payload = body ? JSON.stringify(body) : undefined;
  return fetch(url, {
    method,
    headers: { ...(payload ? { 'Content-Type': 'application/json' } : {}), ...headers },
    body: payload,
    signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
  }).then(async (res) => {
    const text = await res.text();
    const json = text ? JSON.parse(text) : {};
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
    return json;
  });
}

// ---------- In-memory очереди заявок ----------
// PENDING_CONFIRM: заявка подготовлена, ждёт подтверждения пользователя.
// QUEUED: подтверждена, но исполнить сразу не удалось — исполним при первой возможности.
const pendingOrders = new Map(); // id -> order
const queuedOrders = new Map();  // id -> order
let orderSeq = 1;
const nextOrderId = () => `PO-${String(orderSeq++).padStart(4, '0')}`;

// ---------- Лимит пополнений (виртуальные рубли песочницы) ----------
// Ключ — идентификатор пользователя (фронт присылает его в payin/limit).
// Значение — { date: 'YYYY-MM-DD', used: number }.
// Лимит: не более DEPOSIT_DAILY_LIMIT рублей в календарный день.
const DEPOSIT_DAILY_LIMIT = Number(ENV.SANDBOX_DEPOSIT_DAILY_LIMIT || 5000);
const depositUsage = new Map(); // userId -> { date, used }

const todayKey = () => new Date().toISOString().slice(0, 10); // UTC-день

/** Сколько ещё можно пополнить сегодня пользователю. */
function getDepositStatus(userId) {
  const key = String(userId || 'anon');
  const rec = depositUsage.get(key);
  const today = todayKey();
  const used = rec && rec.date === today ? rec.used : 0;
  return { limit: DEPOSIT_DAILY_LIMIT, used, remaining: Math.max(0, DEPOSIT_DAILY_LIMIT - used) };
}

/**
 * Зарегистрировать пополнение с учётом дневного лимита.
 * Бросает DEPOSIT_LIMIT_EXCEEDED, если сумма превышает остаток.
 * Возвращает обновлённый статус.
 */
function registerDeposit(userId, amount) {
  const value = Math.round(Number(amount) || 0);
  if (value <= 0) throw new Error('BAD_AMOUNT');
  const key = String(userId || 'anon');
  const today = todayKey();
  const rec = depositUsage.get(key);
  const used = rec && rec.date === today ? rec.used : 0;
  if (used + value > DEPOSIT_DAILY_LIMIT) {
    const err = new Error('DEPOSIT_LIMIT_EXCEEDED');
    err.remaining = Math.max(0, DEPOSIT_DAILY_LIMIT - used);
    throw err;
  }
  depositUsage.set(key, { date: today, used: used + value });
  return { limit: DEPOSIT_DAILY_LIMIT, used: used + value, remaining: Math.max(0, DEPOSIT_DAILY_LIMIT - (used + value)) };
}

// ---------- Инструменты и котировки ----------
// Цены/имена берём строго из API. Список акций — из песочницы (InstrumentsService/Shares).
const sharesCache = new Map(); // ticker -> { ticker, uid, figi, lot, name, classCode }
const quotesCache = new Map(); // ticker -> { at, data }

// Кэш полного списка акций песочницы (обновляем не чаще раза в 6 часов).
let allSharesCache = { at: 0, list: [] };

/**
 * Полный справочник акций из песочницы (InstrumentsService/Shares).
 * Только торгуемые, по одной записи на тикер (берём classCode TQBR в приоритете).
 * Без моков: что вернул API — то и отдаём.
 */
async function getAllShares() {
  if (allSharesCache.list.length && Date.now() - allSharesCache.at < 6 * 60 * 60 * 1000) {
    return allSharesCache.list;
  }
  const data = await investCall('InstrumentsService/Shares', {
    instrumentStatus: 'INSTRUMENT_STATUS_BASE',
  });
  const raw = data?.instruments || [];
  const byTicker = new Map();
  for (const i of raw) {
    if (!i.ticker) continue;
    if (i.apiTradeAvailableFlag === false) continue;
    const key = i.ticker.toUpperCase();
    const item = {
      ticker: key,
      name: i.name || key,
      uid: i.uid,
      figi: i.figi,
      lot: Number(i.lot || 1),
      classCode: i.classCode || null,
      currency: i.currency || 'rub',
    };
    // предпочитаем основной режим TQBR, если по тикеру несколько классов
    const prev = byTicker.get(key);
    if (!prev || (item.classCode === 'TQBR' && prev.classCode !== 'TQBR')) {
      byTicker.set(key, item);
    }
  }
  const list = [...byTicker.values()].sort((a, b) => a.ticker.localeCompare(b.ticker));
  allSharesCache = { at: Date.now(), list };
  return list;
}

/** Найти инструмент (Share) по тикеру. Кэшируем. */
async function getShare(ticker) {
  const key = ticker.toUpperCase();
  if (sharesCache.has(key)) return sharesCache.get(key);

  // 1) ищем в общем справочнике (без отдельного запроса на каждый тикер)
  try {
    const all = await getAllShares();
    const found = all.find((s) => s.ticker === key);
    if (found) { sharesCache.set(key, found); return found; }
  } catch { /* справочник недоступен — пробуем прямой запрос */ }

  // 2) запасной вариант — прямой ShareBy (на случай, если справочник не отдал тикер)
  const data = await investCall('InstrumentsService/ShareBy', {
    idType: 'INSTRUMENT_ID_TYPE_TICKER',
    classCode: 'TQBR',
    id: key,
  });
  const inst = data?.instrument;
  if (!inst) throw new Error(`INSTRUMENT_NOT_FOUND: ${key}`);
  const share = {
    ticker: inst.ticker || key,
    uid: inst.uid,
    figi: inst.figi,
    lot: Number(inst.lot || 1),
    name: inst.name || key,
    classCode: inst.classCode || 'TQBR',
  };
  sharesCache.set(key, share);
  return share;
}

/** Последняя цена инструмента (в рублях). */
async function getLastPrice(instrumentId) {
  const data = await investCall('MarketDataService/GetLastPrices', {
    instrumentId: [instrumentId],
  });
  const p = data?.lastPrices?.[0]?.price;
  return fromQ(p);
}

/**
 * Риск инструмента — РАСЧЁТНАЯ оценка на основе истории свечей (НЕ ИИР).
 * Метрики: годовая волатильность (σ доходностей) + максимальная просадка.
 * Категория: Низкий / Умеренный / Высокий. Если данных нет — null.
 */
async function computeRisk(instrumentId) {
  try {
    const to = new Date();
    const from = new Date(to.getTime() - 90 * 24 * 60 * 60 * 1000); // ~90 дней
    const data = await investCall('MarketDataService/GetCandles', {
      instrumentId,
      from: from.toISOString(),
      to: to.toISOString(),
      interval: 'CANDLE_INTERVAL_DAY',
    });
    const candles = data?.candles || [];
    if (candles.length < 10) {
      return { riskLevel: null, volatility: null, maxDrawdown: null, riskNote: 'нет данных для оценки' };
    }

    const closes = candles.map((c) => fromQ(c.close));
    const rets = [];
    for (let i = 1; i < closes.length; i++) {
      if (closes[i - 1] > 0) rets.push((closes[i] - closes[i - 1]) / closes[i - 1]);
    }
    const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
    const variance = rets.reduce((a, b) => a + (b - mean) ** 2, 0) / rets.length;
    const annualVol = Math.sqrt(variance) * Math.sqrt(252) * 100; // в %

    let peak = closes[0];
    let maxDd = 0;
    for (const c of closes) {
      if (c > peak) peak = c;
      const dd = ((peak - c) / peak) * 100;
      if (dd > maxDd) maxDd = dd;
    }

    let riskLevel = 'Высокий';
    if (annualVol < 25 && maxDd < 20) riskLevel = 'Низкий';
    else if (annualVol < 45 && maxDd < 35) riskLevel = 'Умеренный';

    return {
      riskLevel,
      volatility: Number(annualVol.toFixed(1)),
      maxDrawdown: Number(maxDd.toFixed(1)),
      riskNote: 'Расчётная оценка по истории за 90 дней. Не является ИИР.',
    };
  } catch (e) {
    return { riskLevel: null, volatility: null, maxDrawdown: null, riskNote: `оценка недоступна: ${e.message}` };
  }
}

/** Котировка по тикеру: цена, изменение за день, риск. Только реальные данные. */
async function getQuote(ticker) {
  const key = ticker.toUpperCase();
  const cached = quotesCache.get(key);
  if (cached && Date.now() - cached.at < 15_000) return cached.data;

  const share = await getShare(key);
  const instrumentId = share.uid || share.figi;

  let price = null;
  try { price = await getLastPrice(instrumentId); } catch { price = null; }

  let change = null;
  try {
    const now = new Date();
    const startOfDay = new Date(now); startOfDay.setHours(0, 0, 0, 0);
    const d = await investCall('MarketDataService/GetCandles', {
      instrumentId,
      from: startOfDay.toISOString(),
      to: now.toISOString(),
      interval: 'CANDLE_INTERVAL_DAY',
    });
    const open = d?.candles?.[0] ? fromQ(d.candles[0].open) : null;
    if (price != null && open) change = Number((((price - open) / open) * 100).toFixed(2));
  } catch { change = null; }

  const risk = await computeRisk(instrumentId);

  const quote = {
    ticker: share.ticker,
    name: share.name,
    price: price != null ? Math.round(price) : null,
    priceExact: price,
    change, // % за день, null если нет данных (без рандома)
    lot: share.lot,
    ...risk,
  };
  quotesCache.set(key, { at: Date.now(), data: quote });
  return quote;
}

// ---------- Песочница: счёт и сделки ----------
// Кэш активного счёта (чтобы не открывать новый на каждый запрос — у песочницы есть лимит).
let activeAccountId = ENV_SANDBOX_ACCOUNT_ID || null;

/** Перечислить существующие sandbox-счета. */
async function listSandboxAccounts() {
  const data = await investCall('SandboxService/GetSandboxAccounts', {});
  return (data?.accounts || []).filter((a) => a.status === 'ACCOUNT_STATUS_OPEN');
}

/** Сколько рублей свободно на счёте (через лимиты вывода). */
async function getRubBalance(accountId) {
  try {
    const data = await investCall('SandboxService/GetSandboxWithdrawLimits', { accountId });
    const rub = (data?.money || []).find((m) => m.currency === 'rub');
    return rub ? fromQ(rub) : 0;
  } catch {
    return 0;
  }
}

/**
 * Убедиться, что на счёте есть тренировочные рубли. Если пусто — пополняем.
 * Идемпотентно: пополняем только когда баланс ниже порога.
 */
async function ensureSandboxFunds(accountId, minRub = 1000, topUpRub = 100000) {
  const bal = await getRubBalance(accountId);
  if (bal < minRub) {
    await investCall('SandboxService/SandboxPayIn', {
      accountId,
      amount: { currency: 'rub', units: String(topUpRub), nano: 0 },
    });
    return { toppedUp: true, balance: bal };
  }
  return { toppedUp: false, balance: bal };
}

/**
 * Получить рабочий счёт: переиспользовать существующий, иначе создать один.
 * ВАЖНО: у песочницы лимит аккаунтов ("Sandbox accounts limit reached"),
 * поэтому НЕ создаём новый при каждом вызове.
 */
async function openSandbox() {
  // 1) уже известный счёт — только убеждаемся, что на нём есть деньги
  if (activeAccountId) {
    await ensureSandboxFunds(activeAccountId);
    return activeAccountId;
  }

  // 2) счёт из .env
  if (ENV_SANDBOX_ACCOUNT_ID) {
    activeAccountId = ENV_SANDBOX_ACCOUNT_ID;
    await ensureSandboxFunds(activeAccountId);
    return activeAccountId;
  }

  // 3) любой открытый существующий счёт
  try {
    const accounts = await listSandboxAccounts();
    if (accounts.length > 0) {
      activeAccountId = accounts[0].id;
      await ensureSandboxFunds(activeAccountId);
      return activeAccountId;
    }
  } catch { /* нет доступа к списку — пробуем создать */ }

  // 4) создать новый ТОЛЬКО если ни одного нет
  const data = await investCall('SandboxService/OpenSandboxAccount', {});
  const accountId = data?.accountId;
  if (!accountId) throw new Error('SANDBOX_ACCOUNT_NOT_CREATED');
  activeAccountId = accountId;
  // Пополняем только что созданный счёт виртуальными рублями.
  await investCall('SandboxService/SandboxPayIn', {
    accountId,
    amount: { currency: 'rub', units: '100000', nano: 0 },
  });
  return accountId;
}

async function sandboxPayIn(accountId, rub) {
  const amount = Number(rub) || 0;
  if (amount <= 0) throw new Error('BAD_AMOUNT');
  await investCall('SandboxService/SandboxPayIn', { accountId, amount: toQ(amount) });
  return { ok: true };
}

async function getPortfolio(accountId) {
  const p = await investCall('SandboxService/GetSandboxPortfolio', { accountId, currency: 'rub' });
  return {
    accountId,
    totalAmountShares: fromQ(p?.totalAmountShares),
    positions: (p?.positions || []).map((pos) => ({
      instrumentUid: pos.instrumentUid,
      figi: pos.figi,
      quantity: Number(pos.quantity?.units || 0),
      currentPrice: fromQ(pos.currentPrice),
    })),
  };
}

/**
 * Готовит заявку (PENDING). Не отправляет в стакан.
 * Валидирует инструмент, считает примерную стоимость лота.
 */
async function prepareOrder({ ticker, lots = 1, direction = 'BUY' }) {
  // Резолвим инструмент ТОЛЬКО из торгуемого справочника брокера.
  const share = await resolveTradeableShare(ticker);
  const price = await getLastPrice(share.uid || share.figi);
  const quantity = share.lot * Number(lots || 1);
  const id = nextOrderId();
  const order = {
    id,
    status: 'PENDING_CONFIRM',
    accountId: null,
    ticker: share.ticker,
    instrumentId: share.uid || share.figi,
    lots: Number(lots || 1),
    quantity,
    direction,
    price,
    createdAt: Date.now(),
  };
  pendingOrders.set(id, order);
  return order;
}

/**
 * Исполнение в песочнице: весь объём по одной цене (sandbox так позволяет).
 * Возвращает { executed, tradeAvailable, order }.
 */
async function executeSandboxOrder(accountId, order) {
  try {
    const resp = await investCall('SandboxService/PostSandboxOrder', {
      accountId,
      instrumentId: order.instrumentId,
      quantity: String(order.quantity),
      direction: order.direction === 'SELL' ? 'ORDER_DIRECTION_SELL' : 'ORDER_DIRECTION_BUY',
      orderType: 'ORDER_TYPE_MARKET',
    });
    return {
      executed: true,
      tradeAvailable: true,
      order: { ...order, status: 'EXECUTED', accountId, orderId: resp?.orderId || null },
    };
  } catch (e) {
    // Торги недоступны / нет ликвидности / сессия закрыта — предложим QUEUED.
    return {
      executed: false,
      tradeAvailable: false,
      reason: e.message,
      order: { ...order, status: 'FAILED_TEMP', accountId },
    };
  }
}

/**
 * ЗАГОТОВКА для реального счёта (MCP). Здесь эффект проскальзывания:
 * цена растёт при выкупе уровней стакана → исполняем по VWAP уровней.
 * Сейчас не используется (MCP ещё не подключён), но контракт зафиксирован.
 */
async function executeMcpOrder(/* accountId, order */) {
  // TODO(этап MCP): GetOrderBook → съесть уровни → VWAP → средняя цена с проскальзыванием.
  throw new Error('MCP_NOT_CONFIGURED');
}

/**
 * Подтверждение заявки: пробуем исполнить, при неудаче — НЕ молчим,
 * а отдаём tradeAvailable:false, чтобы UI предложил пользователю выбор:
 * оставить в очереди или отменить.
 */
async function confirmOrder(accountId, orderId) {
  const order = pendingOrders.get(orderId);
  if (!order) throw new Error('ORDER_NOT_FOUND');
  pendingOrders.delete(orderId);

  const result = await executeSandboxOrder(accountId, order);
  if (result.executed) return result;

  return {
    executed: false,
    tradeAvailable: false,
    reason: result.reason,
    order: { ...order, status: 'COULD_QUEUE', accountId },
  };
}

/** Пользователь выбрал «оставить в очереди». */
function queueOrder(order) {
  const q = { ...order, status: 'QUEUED', queuedAt: Date.now() };
  queuedOrders.set(q.id, q);
  return q;
}

/** Пользователь выбрал «отменить». */
function cancelOrder(orderId) {
  pendingOrders.delete(orderId);
  queuedOrders.delete(orderId);
  return { ok: true };
}

/** Периодическая попытка исполнить очередь (когда откроется сессия/ликвидность). */
async function retryQueued() {
  const results = [];
  for (const [id, order] of [...queuedOrders.entries()]) {
    const res = await executeSandboxOrder(order.accountId, order);
    if (res.executed) {
      queuedOrders.delete(id);
      results.push({ id, executed: true });
    } else {
      results.push({ id, executed: false });
    }
  }
  return results;
}

// ---------- AI (DeepSeek) ----------
/**
 * Промпт: модель — ЖИВОЙ разговорный ассистент «Ти-Стартик».
 * Она свободно общается (объясняет, отвечает на вопросы, поддерживает диалог),
 * а когда распознаёт намерение купить/продать — добавляет в КОНЦЕ ответа
 * скрытую служебную строку-маркер, которую бэкенд вырезает из видимого текста:
 *   [[TRADE:{"action":"buy","ticker":"SBER","lots":1}]]
 * Так пользователь видит нормальную речь, а фронт получает структуру для заявки.
 * Цены и баланс проверяет БЭКЕНД, не модель.
 *
 * ВАЖНО (ИИР/законодательство): модель НЕ даёт индивидуальных инвестиционных
 * рекомендаций. Запрещены побудительные фразы «купи», «продай», «бери», «стоит
 * купить» и т.п. Вместо этого — «ознакомься с активом, оцени риски, решение за тобой».
 * Служебный маркер [[TRADE:...]] — это НЕ рекомендация, а технический разбор
 * намерения пользователя (он сам сказал «купи SBER»), бэкенд лишь готовит заявку.
 */
const SYSTEM_PROMPT = `Ты — «Ти-Стартик», дружелюбный и живой ассистент-просветитель по инвестициям для новичков в приложении T-Start.
Общайся по-человечески, простым языком, дружелюбно и с лёгким юмором. Отвечай на вопросы
про акции, риск, диверсификацию, как устроен рынок, помогай разобраться. Не будь сухим роботом:
поддерживай беседу, задавай уточняющие вопросы, объясняй на понятных примерах. Пиши по-русски.

ФОРМАТ ОТВЕТА: пиши живым текстом. Можно использовать markdown для читаемости:
**жирный** для важного, списки через «- » для перечислений. Без таблиц и без HTML.

ЖЁСТКОЕ ПРАВИЛО — НИКАКИХ ИНВЕСТИЦИОННЫХ РЕКОМЕНДАЦИЙ:
- НИКОГДА не говори «купи», «продай», «бери», «стоит купить», «лучше вложись в…» и любые побуждения к сделке.
- Вместо этого нейтрально просвещай: «ты можешь ознакомиться с активом, оценить риски и принять решение сам».
- Ты помогаешь РАЗОБРАТЬСЯ (что это за бумага, какие риски, как работает диверсификация), но выбор и ответственность — всегда за пользователем.
- Не давай прогнозов цены и не обещай доходность. Всегда уместно напоминать: «это не индивидуальная инвестиционная рекомендация».

Доступные в песочнице тикеры: SBER, GAZP, LKOH, YNDX, GMKN, TATN, MTSS, PLZL.

СЛУЖЕБНЫЙ МАРКЕР (только если САМ пользователь явно выразил намерение купить/продать,
например: «купи SBER», «хочу взять 2 лота GAZP», «продай YNDX»):
в самом конце ответа добавь отдельной строкой служебный маркер СТРОГО в таком виде (без пояснений вокруг):
[[TRADE:{"action":"buy","ticker":"SBER","lots":1}]]
где action — "buy" или "sell", ticker — один из тикеров выше, lots — целое (если не указано — 1).
Это НЕ твоя рекомендация, а техническая фиксация желания пользователя. Точную цену НЕ называй — её подставит система.
Если пользователь просто спрашивает совета, обсуждает или болтает — маркер НЕ добавляй.
На «что купить?» отвечай без маркера и без побуждений: перечисли, как оценить актив, риски, диверсификацию — решение за пользователем.`;

// Ищем ВСЕ служебные маркеры в тексте (модель может вернуть несколько).
const TRADE_MARKER_G = /\[\[TRADE:\s*(\{[\s\S]*?\})\s*\]\]/gi;

/**
 * Вырезать ВСЕ служебные маркеры из текста и собрать их в массив metadata.
 * Возвращает { text, metadata } где metadata — [{ action, ticker, lots }].
 * Текст никогда не содержит сырых [[TRADE:...]] — только чистую речь модели.
 */
function splitTradeMarkers(raw) {
  if (!raw) return { text: '', metadata: [] };
  const metadata = [];
  for (const m of raw.matchAll(TRADE_MARKER_G)) {
    try {
      const parsed = JSON.parse(m[1]);
      if (parsed && parsed.ticker) {
        metadata.push({
          action: parsed.action === 'sell' ? 'sell' : 'buy',
          ticker: String(parsed.ticker).toUpperCase(),
          lots: Number(parsed.lots) || 1,
        });
      }
    } catch { /* битый маркер — просто вырежем */ }
  }
  // Убираем любые остатки маркеров (на случай «кривого» JSON) и лишние пустые строки.
  const text = raw
    .replace(TRADE_MARKER_G, '')
    .replace(/\[\[\s*TRADE:[\s\S]*?\]\]/gi, '') // добить невалидные хвосты
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return { text, metadata };
}

/**
 * Резервный детерминированный разбор интента покупки/продажи из текста пользователя.
 */
function fallbackIntent(text) {
  const lower = String(text || '').toLowerCase();
  const wanted = /куп|buy|взять|приобрест/.test(lower) ? 'buy'
    : /прод|sell|сбыть/.test(lower) ? 'sell'
    : null;
  const tk = lower.match(/\b(sber|gazp|lkoh|yndx|gmkn|tatn|mtss|plzl)\b/i);
  const ticker = tk ? tk[1].toUpperCase() : null;
  const lotsMatch = lower.match(/(\d+)\s*(лот|шт|акци)/);
  const lots = lotsMatch ? Number(lotsMatch[1]) : 1;
  if (wanted && ticker) return { action: wanted, ticker, lots };
  return null;
}

async function askAI(history) {
  const messages = [{ role: 'system', content: SYSTEM_PROMPT }, ...history];
  // DeepSeek совместим с OpenAI: POST {base}/chat/completions, Bearer sk-...
  const data = await httpJson(`${AI_URL}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${AI_KEY}` },
    body: { model: MODEL, messages, max_tokens: 700, temperature: 0.6, stream: false },
  });
  const msg = data?.choices?.[0]?.message;
  return ((msg?.content ?? '').trim() || (msg?.reasoning_content ?? '').trim());
}

/**
 * Обработка чата:
 *  1) Обычный разговор: возвращаем естественный ответ модели (Markdown допустим).
 *  2) Есть намерение купить/продать (маркер модели ИЛИ fallback по словам юзера):
 *     подтягиваем РЕАЛЬНУЮ цену, валидируем баланс, готовим заявку(и) (PENDING).
 *
 * ВАЖНО: в режиме Sandbox НЕ требуем профиль/регистрацию — счёт создаётся бэкендом
 * лениво (execution происходит только по подтверждению, accountId подставит confirm).
 *
 * Ответ: { text, metadata: [order...], pending?, orderId?, ticker?, lots? }
 *  - text      — ЧИСТЫЙ текст без сырых [[TRADE:...]] (см. splitTradeMarkers);
 *  - metadata  — массив подготовленных заявок (для рендера кнопок на фронте);
 *  - pending / orderId / ticker / lots — обратная совместимость (первая заявка).
 */
async function handleChat({ history = [], userContext = {} }) {
  const balance = Number(userContext?.balance);

  if (!AI_READY) {
    return { text: 'ИИ временно недоступен (нет ключей на сервере). Попробуй позже.', metadata: [] };
  }

  let raw;
  try {
    raw = await askAI(history);
  } catch (e) {
    return { text: `Не получилось получить ответ ассистента (${e.message.slice(0, 80)}). Попробуй ещё раз.`, metadata: [] };
  }

  // Вырезаем ВСЕ маркеры из видимого текста и собираем их в metadata.
  const { text: cleanText, metadata: modelIntents } = splitTradeMarkers(raw);

  // Намерения: сначала из маркеров модели; если их нет — пробуем fallback по словам юзера.
  let intents = modelIntents;
  if (!intents.length) {
    const lastUser = [...history].reverse().find((m) => m.role === 'user');
    const fb = fallbackIntent(lastUser?.content || '');
    if (fb) intents = [fb];
  }

  // 1) Нет намерений торговать — обычный разговорный ответ.
  if (!intents.length) {
    return {
      text: cleanText || 'Привет! Я Ти-Стартик. Расскажу про акции и риски, помогу разобраться. Спрашивай!',
      metadata: [],
    };
  }

  // 2) По каждому намерению готовим заявку (не более 5, чтобы не спамить).
  const prepared = [];
  const notes = [];
  for (const intent of intents.slice(0, 5)) {
    let share, lots, action;
    try {
      share = await resolveTradeableShare(intent.ticker);
      lots = sanitizeLots(intent.lots ?? 1);
      action = intent.action === 'sell' ? 'sell' : 'buy';
    } catch (e) {
      if (e.message === 'TICKER_NOT_ALLOWED') {
        notes.push(`Бумаги ${String(intent.ticker).toUpperCase()} нет в списке торгуемых.`);
      } else {
        notes.push('Не понял, о какой бумаге речь — уточни тикер.');
      }
      continue;
    }

    let quote;
    try {
      quote = await getQuote(share.ticker);
    } catch {
      notes.push(`Не нашёл инструмент ${share.ticker}.`);
      continue;
    }
    if (quote.priceExact == null) {
      notes.push(`По ${share.ticker} сейчас нет данных по цене.`);
      continue;
    }

  const estCost = Math.round(quote.priceExact * quote.lot * lots);

    // Валидация баланса (только для покупки, если фронт прислал баланс).
    if (action === 'buy' && Number.isFinite(balance) && balance < estCost) {
      notes.push(`На ${share.ticker} не хватает: ${lots} лот(а) ~${estCost} ₽, а у тебя ${balance} ₽.`);
      continue;
    }

    // Готовим заявку (в стакан НЕ шлём — ждём подтверждения).
    const order = await prepareOrder({ ticker: share.ticker, lots, direction: action === 'buy' ? 'BUY' : 'SELL' });
    prepared.push({
      id: order.id,
      action,
      ticker: order.ticker,
      lots: order.lots,
      lot: share.lot,
      quantity: order.quantity,
      price: quote.price,
      priceExact: quote.priceExact,
      estCost,
      direction: order.direction,
    });
  }

  // Есть готовые заявки — формируем ответ с призывом подтвердить (без ИИР-побуждений).
  if (prepared.length) {
    const list = prepared
      .map((o) => `- **${o.action === 'buy' ? 'Покупка' : 'Продажа'}** ${o.ticker}: ${o.lots} лот(а) (~${o.estCost} ₽)`)
      .join('\n');
    const intro = cleanText ? `${cleanText}\n\n` : '';
    const notePart = notes.length ? `\n\n_${notes.join(' ')}_` : '';
    return {
      text: `${intro}Подготовил заявку на подтверждение:\n${list}${notePart}\n\nПроверь детали и подтверди — решение и ответственность за тобой. Это не индивидуальная инвестиционная рекомендация.`,
      metadata: prepared,
      // Обратная совместимость (первая заявка).
      pending: `${prepared[0].id} ${prepared[0].ticker} ${prepared[0].lots} лот(а)`,
      orderId: prepared[0].id,
      ticker: prepared[0].ticker,
      lots: prepared[0].lots,
    };
  }

  // Намерения были, но ни одну заявку подготовить не удалось.
  const reason = notes.length ? notes.join(' ') : 'Не получилось подготовить заявку.';
  return {
    text: `${cleanText ? cleanText + '\n\n' : ''}${reason}`,
    metadata: [],
  };
}

// ---------- HTTP server ----------
function send(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
  });
  res.end(body);
}
function readBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (c) => (data += c));
    req.on('end', () => {
      try { resolve(data ? JSON.parse(data) : {}); } catch { resolve({}); }
    });
  });
}

async function handleQuotes(url, res) {
  let tickers;
  const param = url.searchParams.get('tickers');
  if (param) {
    // Явно запрошенные тикеры: валидируем формат (латиница), ≤24 за запрос.
    const raw = param.split(',').map((t) => t.trim()).filter(Boolean);
    tickers = [];
    for (const t of raw) {
      try {
        const clean = sanitizeTicker(t);
        if (!tickers.includes(clean)) tickers.push(clean);
      } catch { /* пропускаем невалидный тикер */ }
      if (tickers.length >= 24) break;
    }
  } else {
    // Без параметра — берём реальный список акций песочницы (без моков).
    const all = await getAllShares();
    // Ограничиваем одним батчем, чтобы не превысить таймаут функции.
    tickers = all.slice(0, 24).map((s) => s.ticker);
  }
  const quotes = await Promise.all(tickers.map(async (t) => {
    try { return await getQuote(t); }
    catch { return { ticker: t, name: t, price: null, priceExact: null, change: null, riskLevel: null, riskNote: 'нет данных' }; }
  }));
  return send(res, 200, { quotes });
}

// ---------- Раздача статики (прод: собранный фронт из dist/) ----------
// Один сервис: отдаём и API, и SPA. В dev статику раздаёт Vite, сюда не доходит.
const DIST_DIR = join(root, 'dist');
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
};

function serveStatic(path, res) {
  // Защита от выхода за пределы dist/ (path traversal).
  let rel = decodeURIComponent(path).replace(/^\/+/, '');
  if (rel.includes('..')) { send(res, 400, { error: 'BAD_PATH' }); return true; }
  let file = join(DIST_DIR, rel);
  try {
    if (!rel || !existsSync(file) || statSync(file).isDirectory()) {
      file = join(DIST_DIR, 'index.html'); // SPA fallback (client-side routing)
    }
    if (!existsSync(file)) return false; // фронт не собран — пусть ответит 404
    const ext = extname(file).toLowerCase();
    const body = readFileSync(file);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(body);
    return true;
  } catch {
    return false;
  }
}

// ---------- HTTP приложение (переиспользуется локальным сервером и Vercel-функцией) ----------
export async function handler(req, res) {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const path = url.pathname;

  if (req.method === 'OPTIONS') return send(res, 204, {});

  try {
    // Health без утечек: только флаги готовности интеграций (без токенов/счёта).
    if (path === '/api/health') {
      return send(res, 200, { ok: true, ai: AI_READY, invest: INVEST_READY });
    }

    // Переиспользуемый счёт песочницы (без создания новых при каждом вызове).
    if (path === '/api/invest/account' && req.method === 'POST') {
      const accountId = await openSandbox();
      return send(res, 200, { accountId });
    }

    // Список существующих sandbox-счетов (для диагностики).
    if (path === '/api/invest/accounts') {
      const accounts = await listSandboxAccounts();
      return send(res, 200, { accounts });
    }

    if (path === '/api/instruments' || path === '/api/quotes') {
      return await handleQuotes(url, res);
    }

    // Полный список акций песочницы (справочник, без цен) — для каталога на фронте.
    if (path === '/api/shares') {
      const all = await getAllShares();
      return send(res, 200, {
        count: all.length,
        shares: all.map((s) => ({ ticker: s.ticker, name: s.name, lot: s.lot, classCode: s.classCode })),
      });
    }

    // ДИАГНОСТИКА (безопасно: токен НЕ выводим). Показывает шаги запроса к T-Invest.
    if (path === '/api/debug/invest') {
      const out = { investReady: INVEST_READY, investUrl: INVEST_URL, insecureTls: INSECURE_TLS, steps: [] };
      // Кто подписал сертификат T-Invest (читаем БЕЗ проверки — только для диагностики,
      // чтобы увидеть issuer при MITM-прокси). Никаких данных не меняет.
      try {
        const u = new URL(INVEST_URL);
        const certInfo = await new Promise((resolve) => {
          const r = https.request(
            { hostname: u.hostname, port: 443, path: '/', method: 'GET', rejectUnauthorized: false },
            (res) => {
              const c = res.socket.getPeerCertificate();
              res.destroy();
              resolve({ issuer: c?.issuer || null, subject: c?.subject || null });
            }
          );
          r.setTimeout(6000, () => r.destroy(new Error('CERT_TIMEOUT')));
          r.on('error', (e) => resolve({ error: e.code || e.message }));
          r.end();
        });
        out.cert = certInfo;
      } catch (e) {
        out.cert = { error: e.message };
      }
      const step = async (name, fn) => {
        const t0 = Date.now();
        try {
          const v = await fn();
          out.steps.push({ name, ok: true, ms: Date.now() - t0, value: v });
          return v;
        } catch (e) {
          out.steps.push({ name, ok: false, ms: Date.now() - t0, code: e.code || null, error: e.message });
          throw e;
        }
      };
      try {
        const share = await step('ShareBy(SBER)', () => getShare('SBER'));
        const id = share.uid || share.figi;
        await step('GetLastPrices', () => getLastPrice(id));
        out.ok = true;
      } catch {
        out.ok = false;
      }
      return send(res, 200, out);
    }

    if (path === '/api/ai/chat' && req.method === 'POST') {
      const body = await readBody(req);
      const result = await handleChat({ ...body, history: sanitizeHistory(body?.history) });
      return send(res, 200, result);
    }

    if (path === '/api/invest/open' && req.method === 'POST') {
      const accountId = await openSandbox();
      return send(res, 200, { accountId });
    }

    if (path === '/api/invest/payin' && req.method === 'POST') {
      const { accountId, rub } = await readBody(req);
      const r = await sandboxPayIn(accountId, rub);
      return send(res, 200, r);
    }

    // ---- Лимит пополнений: проверка дневного остатка ----
    // GET /api/deposit/limit?userId=... — сколько ещё можно пополнить сегодня.
    if (path === '/api/deposit/limit') {
      const userId = url.searchParams.get('userId') || 'anon';
      return send(res, 200, getDepositStatus(userId));
    }

    // POST /api/deposit — заявка на пополнение с серверной проверкой лимита.
    // Тело: { userId, amount, reason? }. При превышении → 429 + remaining.
    if (path === '/api/deposit' && req.method === 'POST') {
      const body = await readBody(req);
      const userId = body?.userId || 'anon';
      const amount = Math.round(Number(body?.amount) || 0);
      if (amount <= 0) return send(res, 400, { ok: false, error: 'BAD_AMOUNT', ...getDepositStatus(userId) });
      try {
        const status = registerDeposit(userId, amount);
        return send(res, 200, { ok: true, amount, ...status });
      } catch (e) {
        if (e.message === 'DEPOSIT_LIMIT_EXCEEDED') {
          return send(res, 429, {
            ok: false,
            error: 'DEPOSIT_LIMIT_EXCEEDED',
            message: `Дневной лимит пополнений (${DEPOSIT_DAILY_LIMIT} ₽) исчерпан. Доступно сегодня: ${e.remaining} ₽.`,
            ...getDepositStatus(userId),
          });
        }
        throw e;
      }
    }

    if (path === '/api/invest/portfolio' && req.method === 'POST') {
      const { accountId } = await readBody(req);
      const p = await getPortfolio(accountId);
      return send(res, 200, p);
    }

    if (path === '/api/invest/order' && req.method === 'POST') {
      const body = await readBody(req);
      // Строгая валидация ДО любого обращения к брокеру.
      let ticker, lots, direction;
      try {
        // Валидация формата; реальное существование проверит prepareOrder (по справочнику).
        ticker = sanitizeTicker(body.ticker);
        lots = sanitizeLots(body.lots);
        direction = sanitizeDirection(body.direction);
      } catch (e) {
        return send(res, 400, { executed: false, error: e.message });
      }
      const { accountId, confirm = true } = body;

      if (!confirm) {
        const order = await prepareOrder({ ticker, lots, direction });
        return send(res, 200, {
          executed: false,
          pending: `${order.id} ${order.ticker} ${order.lots} лот(а) к ${direction === 'SELL' ? 'продаже' : 'покупке'}`,
          orderId: order.id,
          ticker: order.ticker,
          order,
        });
      }

      if (!accountId) return send(res, 400, { executed: false, error: 'NO_ACCOUNT' });
      const order = await prepareOrder({ ticker, lots, direction });
      const result = await confirmOrder(accountId, order.id);
      return send(res, 200, result);
    }

    if (path === '/api/invest/confirm' && req.method === 'POST') {
      const { accountId, orderId } = await readBody(req);
      if (!accountId) return send(res, 400, { executed: false, error: 'NO_ACCOUNT' });
      const result = await confirmOrder(accountId, orderId);
      return send(res, 200, result);
    }

    if (path === '/api/invest/queue' && req.method === 'POST') {
      const { order } = await readBody(req);
      return send(res, 200, { order: queueOrder(order) });
    }

    if (path === '/api/invest/cancel' && req.method === 'POST') {
      const { orderId } = await readBody(req);
      return send(res, 200, cancelOrder(orderId));
    }

    if (path === '/api/pending') {
      return send(res, 200, {
        pending: [...pendingOrders.values()],
        queued: [...queuedOrders.values()],
      });
    }

    if (path === '/api/pending/retry' && req.method === 'POST') {
      const results = await retryQueued();
      return send(res, 200, { results, queued: [...queuedOrders.values()] });
    }

    if (path === '/api/mcp' && req.method === 'POST') {
      return send(res, 501, { error: 'MCP_NOT_CONFIGURED', note: 'Реальный счёт (MCP) будет добавлен отдельным этапом.' });
    }

    // Всё, что не /api — отдаём как статику (SSR-нет, SPA-да). Один сервис: фронт+API.
    if (!path.startsWith('/api/') && serveStatic(path, res)) {
      return;
    }

    return send(res, 404, { error: 'NOT_FOUND', path });
  } catch (e) {
    console.error('[api error]', path, e.message);
    return send(res, 500, { error: e.message });
  }
}

// ---------- Локальный запуск (только когда файл запущен напрямую, не при импорте Vercel) ----------
const isDirectRun =
  process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];

if (isDirectRun) {
  createServer(handler).listen(PORT, () => {
    console.log(`T-Start backend on port ${PORT}`);
    console.log(`  static dir:   ${DIST_DIR} (exists=${existsSync(DIST_DIR)})`);
    console.log(`  AI ready:     ${AI_READY} (DeepSeek, model=${MODEL})`);
    console.log(`  Invest ready: ${INVEST_READY}`);
    console.log(`  insecure TLS: ${INSECURE_TLS} (должно быть false в проде)`);
    console.log(`  extra CAs:    ${EXTRA_CAS.length} (Минцифры/локальные из certs/)`);
    if (!AI_READY) console.log('  [!] Нет ключа DeepSeek (DEEPSEEK_API_KEY=sk-...) — AI-чат вернёт заглушку');
    if (!INVEST_READY) console.log('  [!] Нет токена T-Invest (TINVEST_TOKEN=...) — цены будут «н/д»');
  });
}

