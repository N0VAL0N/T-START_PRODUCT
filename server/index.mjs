import { createServer } from 'node:http';
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

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const config = createConfig(root);
const httpsJson = createHttpsJson(root, config);
const invest = createInvest({ httpsJson, config });
const orders = createOrders({ investCall: invest.investCall, fromQ, getQuote: invest.getQuote, resolveTradeableShare: invest.resolveTradeableShare });
const ai = createAI({ config, invest, orders });
const deposit = createDeposit({ config });
const serveStatic = createStatic(root);

function send(res, status, obj) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
  res.end(JSON.stringify(obj));
}
function readBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', c => data += c);
    req.on('end', () => { try { resolve(data ? JSON.parse(data) : {}); } catch { resolve({}); } });
  });
}

async function handler(req, res) {
  const url = new URL(req.url, `http://localhost:${config.PORT}`);
  const path = url.pathname;
  if (req.method === 'OPTIONS') return send(res, 204, {});

  try {
    if (path === '/api/health') {
      return send(res, 200, { ok: true, ai: !!config.AI_KEY, invest: !!config.INVEST_TOKEN });
    }

    if (path === '/api/invest/account' && req.method === 'POST') {
      const accountId = await invest.openSandbox();
      return send(res, 200, { accountId });
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