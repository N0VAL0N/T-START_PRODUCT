import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createConfig } from './config.mjs';
import { createHttpsJson } from './tls.mjs';
import { createInvest } from './invest.mjs';
import { createAI } from './ai.mjs';
import { createOrders } from './orders.mjs';
import { createDeposit } from './deposit.mjs';
import { createStatic } from './static.mjs';
import { sanitizeHistory, fromQ } from './utils.mjs';
import { sanitizeTicker, sanitizeLots, sanitizeDirection } from './validators.mjs';
import { initDb } from './db.mjs';
import { createAccounts } from './accounts.mjs';

import { buildSessionCookie, buildClearCookie, parseCookies } from './auth.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const config = createConfig(root);
// Cookie с флагом Secure на проде (Vercel/HTTPS) и без — на localhost.
// На Vercel запросы всегда https; локально TSTART_PORT на http.
const IS_SECURE = process.env.VERCEL === '1' || process.env.NODE_ENV === 'production' || !!process.env.TSTART_HTTPS;
const httpsJson = createHttpsJson(root, config);
const invest = createInvest({ httpsJson, config });
const orders = createOrders({ investCall: invest.investCall, fromQ, getQuote: invest.getQuote, resolveTradeableShare: invest.resolveTradeableShare });
const ai = createAI({ config, invest, orders });
const deposit = createDeposit({ config });
const serveStatic = createStatic(root);

// --- Аккаунты (Vercel Postgres / Neon) ---
initDb(config);
const accounts = createAccounts({ config });
if (!accounts.enabled) {
  console.log('[accounts] выключены (нет DATABASE_URL и/или JWT_SECRET) — фичи аккаунтов недоступны.');
}

function send(res, status, obj, extraHeaders = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*', ...extraHeaders });
  res.end(JSON.stringify(obj));
}
function readBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', c => data += c);
    req.on('end', () => { try { resolve(data ? JSON.parse(data) : {}); } catch { resolve({}); } });
  });
}

// Ключ «владельца» песочницы: id залогиненного пользователя, иначе стабильный
// анонимный клиент из cookie tstart_cid (чтобы у каждого был свой счёт).
async function getUserKey(req) {
  try {
    const user = await accounts.currentUser(req);
    if (user?.id) return `u:${user.id}`;
  } catch { /* noop */ }
  const cookies = parseCookies(req.headers?.cookie || '');
  const cid = cookies.tstart_cid;
  if (cid) return `c:${cid}`;
  return null; // нет ключа — попросим клиента получить cookie
}

async function handler(req, res) {
  const url = new URL(req.url, `http://localhost:${config.PORT}`);
  const path = url.pathname;
  if (req.method === 'OPTIONS') return send(res, 204, {});

  try {
    if (path === '/api/health') {
      return send(res, 200, { ok: true, ai: !!config.AI_KEY, invest: !!config.INVEST_TOKEN, accounts: accounts.enabled });
    }

    // ---------- Аккаунты ----------
    if (path === '/api/auth/register' && req.method === 'POST') {
      const body = await readBody(req);
      const r = await accounts.register({ username: body.username, password: body.password });
      if (r.setSession) {
        const cookie = buildSessionCookie(accounts.issueToken(r.setSession), { secure: IS_SECURE });
        return send(res, r.status, r.body, { 'Set-Cookie': cookie });
      }
      return send(res, r.status, r.body);
    }

    if (path === '/api/auth/login' && req.method === 'POST') {
      const body = await readBody(req);
      const r = await accounts.login({ username: body.username, password: body.password });
      if (r.setSession) {
        const cookie = buildSessionCookie(accounts.issueToken(r.setSession), { secure: IS_SECURE });
        return send(res, r.status, r.body, { 'Set-Cookie': cookie });
      }
      return send(res, r.status, r.body);
    }

    if (path === '/api/auth/logout' && req.method === 'POST') {
      const cookie = buildClearCookie({ secure: IS_SECURE });
      return send(res, 200, { ok: true }, { 'Set-Cookie': cookie });
    }

    if (path === '/api/me' && req.method === 'GET') {
      const r = await accounts.getMe(req);
      return send(res, r.status, r.body);
    }

    // Частичное обновление защищаемого состояния (баланс, портфель, достижения…).
    if (path === '/api/state' && req.method === 'PUT') {
      const body = await readBody(req);
      const r = await accounts.updateState(req, body);
      return send(res, r.status, r.body);
    }

    if (path === '/api/invest/account' && req.method === 'POST') {
      // Ключ пользователя; если аноним без cookie — выдаём стабильный clientId.
      let userKey = await getUserKey(req);
      let extraHeaders = {};
      if (!userKey) {
        const cid = randomUUID();
        userKey = `c:${cid}`;
        const secure = IS_SECURE ? '; Secure' : '';
        extraHeaders = { 'Set-Cookie': `tstart_cid=${cid}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${60 * 60 * 24 * 365}${secure}` };
      }
      const accountId = await invest.openSandbox(userKey);
      return send(res, 200, { accountId }, extraHeaders);
    }

    if (path === '/api/invest/accounts') {
      const accounts = await invest.listSandboxAccounts();
      return send(res, 200, { accounts });
    }

    if (path === '/api/instruments' || path === '/api/quotes') {
      // Упрощенная версия handleQuotes
      const param = url.searchParams.get('tickers');
      let tickers = [];
      if (param) {
        tickers = param.split(',').map(t => t.trim().toUpperCase()).filter(t => /^[A-Z]{1,10}$/.test(t)).slice(0, 24);
      } else {
        const all = await invest.getAllShares();
        tickers = all.slice(0, 24).map(s => s.ticker);
      }
      const quotes = await Promise.all(tickers.map(async (t) => {
        try { return await invest.getQuote(t); }
        catch { return { ticker: t, name: t, price: null, priceExact: null, change: null, riskLevel: null, riskNote: 'нет данных' }; }
      }));
      return send(res, 200, { quotes });
    }

    if (path === '/api/shares') {
      const all = await invest.getAllShares();
      return send(res, 200, { count: all.length, shares: all.map(s => ({ ticker: s.ticker, name: s.name, lot: s.lot, classCode: s.classCode })) });
    }

    if (path === '/api/ai/chat' && req.method === 'POST') {
      const body = await readBody(req);
      const result = await ai.handleChat({ ...body, history: sanitizeHistory(body?.history) });
      return send(res, 200, result);
    }

    if (path === '/api/invest/payin' && req.method === 'POST') {
      const { accountId, rub } = await readBody(req);
      const r = await invest.sandboxPayIn(accountId, rub);
      return send(res, 200, r);
    }

    if (path === '/api/deposit/limit') {
      const userId = url.searchParams.get('userId') || 'anon';
      return send(res, 200, deposit.getDepositStatus(userId));
    }

    if (path === '/api/deposit' && req.method === 'POST') {
      const body = await readBody(req);
      const userId = body?.userId || 'anon';
      const amount = Math.round(Number(body?.amount) || 0);
      if (amount <= 0) return send(res, 400, { ok: false, error: 'BAD_AMOUNT', ...deposit.getDepositStatus(userId) });
      try {
        const status = deposit.registerDeposit(userId, amount);
        return send(res, 200, { ok: true, amount, ...status });
      } catch (e) {
        if (e.message === 'DEPOSIT_LIMIT_EXCEEDED') {
          return send(res, 429, { ok: false, error: 'DEPOSIT_LIMIT_EXCEEDED', message: `Дневной лимит пополнений (${config.DEPOSIT_DAILY_LIMIT} ₽) исчерпан. Доступно сегодня: ${e.remaining} ₽.`, ...deposit.getDepositStatus(userId) });
        }
        throw e;
      }
    }

    if (path === '/api/invest/portfolio' && req.method === 'POST') {
      const { accountId } = await readBody(req);
      const p = await invest.getPortfolio(accountId);
      return send(res, 200, p);
    }

    if (path === '/api/invest/order' && req.method === 'POST') {
      const body = await readBody(req);
      let ticker, lots, direction;
      try {
        ticker = sanitizeTicker(body.ticker);
        lots = sanitizeLots(body.lots);
        direction = sanitizeDirection(body.direction);
      } catch (e) {
        return send(res, 400, { executed: false, error: e.message });
      }
      const { accountId, confirm = true } = body;
      if (!confirm) {
        const order = await orders.prepareOrder({ ticker, lots, direction });
        return send(res, 200, { executed: false, pending: `${order.id} ${order.ticker} ${order.lots} лот(а) к ${direction === 'SELL' ? 'продаже' : 'покупке'}`, orderId: order.id, ticker: order.ticker, order });
      }
      if (!accountId) return send(res, 400, { executed: false, error: 'NO_ACCOUNT' });
      const order = await orders.prepareOrder({ ticker, lots, direction });
      const result = await orders.confirmOrder(accountId, order.id);
      return send(res, 200, result);
    }

    if (path === '/api/invest/confirm' && req.method === 'POST') {
      const { accountId, orderId } = await readBody(req);
      if (!accountId) return send(res, 400, { executed: false, error: 'NO_ACCOUNT' });
      const result = await orders.confirmOrder(accountId, orderId);
      return send(res, 200, result);
    }

    if (path === '/api/invest/queue' && req.method === 'POST') {
      const { order } = await readBody(req);
      return send(res, 200, { order: orders.queueOrder(order) });
    }

    if (path === '/api/invest/cancel' && req.method === 'POST') {
      const { orderId } = await readBody(req);
      return send(res, 200, orders.cancelOrder(orderId));
    }

    if (path === '/api/pending') {
      return send(res, 200, { pending: [...orders.pendingOrders.values()], queued: [...orders.queuedOrders.values()] });
    }

    if (path === '/api/pending/retry' && req.method === 'POST') {
      const results = await orders.retryQueued();
      return send(res, 200, { results, queued: [...orders.queuedOrders.values()] });
    }

    if (path === '/api/mcp' && req.method === 'POST') {
      return send(res, 501, { error: 'MCP_NOT_CONFIGURED', note: 'Реальный счёт (MCP) будет добавлен отдельным этапом.' });
    }

    // Эндпоинт для свечей
    if (path === '/api/invest/candles') {
      const ticker = url.searchParams.get('ticker');
      const from = url.searchParams.get('from');
      const to = url.searchParams.get('to');
      const interval = url.searchParams.get('interval') || 'CANDLE_INTERVAL_DAY';
      const candles = await invest.getCandles(ticker, from, to, interval);
      return send(res, 200, { candles });
    }

    // Эндпоинт для бренда
    if (path.startsWith('/api/invest/brand/')) {
      const ticker = path.split('/').pop();
      const brand = await invest.getBrand(ticker);
      return send(res, 200, brand || {});
    }

    // Обновленный эндпоинт для списка акций (только торгуемые)
    if (path === '/api/shares') {
      const all = await invest.getTradableShares();
      return send(res, 200, {
        count: all.length,
        shares: all.map(s => ({ ticker: s.ticker, name: s.name, lot: s.lot, classCode: s.classCode })),
      });
    }

    if (!path.startsWith('/api/') && serveStatic(path, res)) return;

    return send(res, 404, { error: 'NOT_FOUND', path });
  } catch (e) {
    console.error('[api error]', path, e.message);
    return send(res, 500, { error: e.message });
  }

}

const isDirectRun = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isDirectRun) {
  createServer(handler).listen(config.PORT, () => {
    console.log(`T-Start backend on port ${config.PORT}`);
    console.log(`  AI ready:     ${!!config.AI_KEY}`);
    console.log(`  Invest ready: ${!!config.INVEST_TOKEN}`);
  });
}

export { handler };