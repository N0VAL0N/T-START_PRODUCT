import { toQ, fromQ } from './utils.mjs';

export function createInvest({ httpsJson, config }) {
  const INVEST_URL = config.INVEST_URL;
  const INVEST_TOKEN = config.INVEST_TOKEN;
  const APP_NAME = config.APP_NAME;
  const CONTRACT = config.CONTRACT;

  const investCall = (method, body = {}) =>
    httpsJson(`${INVEST_URL}/${CONTRACT}.${method}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${INVEST_TOKEN}`, 'x-app-name': APP_NAME },
      body,
    });

    const sharesCache = new Map();
  const quotesCache = new Map();
  let allSharesCache = { at: 0, list: [] };
  // accountId персональной песочницы на каждого пользователя (ключ — userKey).
  // Раньше была ОДНА глобальная переменная → все юзеры делили один счёт. Теперь — у каждого свой.
  const accountByUser = new Map();
  const FIXED_ACCOUNT_ID = config.ENV.TINVEST_SANDBOX_ACCOUNT_ID || null;

  async function getAllShares() {
    if (allSharesCache.list.length && Date.now() - allSharesCache.at < 6 * 60 * 60 * 1000) {
      return allSharesCache.list;
    }
    const data = await investCall('InstrumentsService/Shares', { instrumentStatus: 'INSTRUMENT_STATUS_BASE' });
    const raw = data?.instruments || [];
    const byTicker = new Map();
    for (const i of raw) {
      if (!i.ticker) continue;
      if (i.apiTradeAvailableFlag === false) continue;
      const key = i.ticker.toUpperCase();
      const item = {
        ticker: key, name: i.name || key, uid: i.uid, figi: i.figi,
        lot: Number(i.lot || 1), classCode: i.classCode || null, currency: i.currency || 'rub',
      };
      const prev = byTicker.get(key);
      if (!prev || (item.classCode === 'TQBR' && prev.classCode !== 'TQBR')) byTicker.set(key, item);
    }
    const list = [...byTicker.values()].sort((a, b) => a.ticker.localeCompare(b.ticker));
    allSharesCache = { at: Date.now(), list };
    return list;
  }

  async function getShare(ticker) {
    const key = ticker.toUpperCase();
    if (sharesCache.has(key)) return sharesCache.get(key);
    try {
      const all = await getAllShares();
      const found = all.find(s => s.ticker === key);
      if (found) { sharesCache.set(key, found); return found; }
    } catch {}
    const data = await investCall('InstrumentsService/ShareBy', { idType: 'INSTRUMENT_ID_TYPE_TICKER', classCode: 'TQBR', id: key });
    const inst = data?.instrument;
    if (!inst) throw new Error(`INSTRUMENT_NOT_FOUND: ${key}`);
    const share = { ticker: inst.ticker || key, uid: inst.uid, figi: inst.figi, lot: Number(inst.lot || 1), name: inst.name || key, classCode: inst.classCode || 'TQBR' };
    sharesCache.set(key, share);
    return share;
  }

  async function getLastPrice(instrumentId) {
    const data = await investCall('MarketDataService/GetLastPrices', { instrumentId: [instrumentId] });
    return fromQ(data?.lastPrices?.[0]?.price);
  }

  async function computeRisk(instrumentId) {
    try {
      const to = new Date();
      const from = new Date(to.getTime() - 90 * 24 * 60 * 60 * 1000);
      const data = await investCall('MarketDataService/GetCandles', { instrumentId, from: from.toISOString(), to: to.toISOString(), interval: 'CANDLE_INTERVAL_DAY' });
      const candles = data?.candles || [];
      if (candles.length < 10) return { riskLevel: null, volatility: null, maxDrawdown: null, riskNote: 'нет данных для оценки' };
      const closes = candles.map(c => fromQ(c.close));
      const rets = [];
      for (let i = 1; i < closes.length; i++) if (closes[i - 1] > 0) rets.push((closes[i] - closes[i - 1]) / closes[i - 1]);
      const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
      const variance = rets.reduce((a, b) => a + (b - mean) ** 2, 0) / rets.length;
      const annualVol = Math.sqrt(variance) * Math.sqrt(252) * 100;
      let peak = closes[0]; let maxDd = 0;
      for (const c of closes) { if (c > peak) peak = c; const dd = ((peak - c) / peak) * 100; if (dd > maxDd) maxDd = dd; }
      let riskLevel = 'Высокий';
      if (annualVol < 25 && maxDd < 20) riskLevel = 'Низкий';
      else if (annualVol < 45 && maxDd < 35) riskLevel = 'Умеренный';
      return { riskLevel, volatility: Number(annualVol.toFixed(1)), maxDrawdown: Number(maxDd.toFixed(1)), riskNote: 'Расчётная оценка по истории за 90 дней. Не является ИИР.' };
    } catch (e) {
      return { riskLevel: null, volatility: null, maxDrawdown: null, riskNote: `оценка недоступна: ${e.message}` };
    }
  }

  async function getQuote(ticker) {
    const key = ticker.toUpperCase();
    const cached = quotesCache.get(key);
    if (cached && Date.now() - cached.at < 15000) return cached.data;
    const share = await getShare(key);
    const instrumentId = share.uid || share.figi;
    let price = null;
    try { price = await getLastPrice(instrumentId); } catch { price = null; }
    let change = null;
    try {
      const now = new Date(); const startOfDay = new Date(now); startOfDay.setHours(0, 0, 0, 0);
      const d = await investCall('MarketDataService/GetCandles', { instrumentId, from: startOfDay.toISOString(), to: now.toISOString(), interval: 'CANDLE_INTERVAL_DAY' });
      const open = d?.candles?.[0] ? fromQ(d.candles[0].open) : null;
      if (price != null && open) change = Number((((price - open) / open) * 100).toFixed(2));
    } catch { change = null; }
    const risk = await computeRisk(instrumentId);
    const quote = { ticker: share.ticker, name: share.name, price: price != null ? Math.round(price) : null, priceExact: price, change, lot: share.lot, ...risk };
    quotesCache.set(key, { at: Date.now(), data: quote });
    return quote;
  }

  async function listSandboxAccounts() {
    const data = await investCall('SandboxService/GetSandboxAccounts', {});
    return (data?.accounts || []).filter(a => a.status === 'ACCOUNT_STATUS_OPEN');
  }

  async function getRubBalance(accountId) {
    try {
      const data = await investCall('SandboxService/GetSandboxWithdrawLimits', { accountId });
      const rub = (data?.money || []).find(m => m.currency === 'rub');
      return rub ? fromQ(rub) : 0;
    } catch { return 0; }
  }

  async function ensureSandboxFunds(accountId, minRub = 1000, topUpRub = 100000) {
    const bal = await getRubBalance(accountId);
    if (bal < minRub) {
      await investCall('SandboxService/SandboxPayIn', { accountId, amount: { currency: 'rub', units: String(topUpRub), nano: 0 } });
      return { toppedUp: true, balance: bal };
    }
    return { toppedUp: false, balance: bal };
  }

    // Открывает (или возвращает уже открытый) ПЕРСОНАЛЬНЫЙ счёт песочницы для userKey.
  // Ключ userKey = id пользователя (или стабильный clientId для анонимов).
  async function openSandbox(userKey = 'anon') {
    // Если в env зафиксирован один счёт — используем его (демо-режим, общий).
    if (FIXED_ACCOUNT_ID) {
      accountByUser.set(userKey, FIXED_ACCOUNT_ID);
      await ensureSandboxFunds(FIXED_ACCOUNT_ID);
      return FIXED_ACCOUNT_ID;
    }
    const cached = accountByUser.get(userKey);
    if (cached) {
      await ensureSandboxFunds(cached);
      return cached;
    }
    // Новый пользователь → свой собственный счёт песочницы.
    const data = await investCall('SandboxService/OpenSandboxAccount', {});
    const accountId = data?.accountId;
    if (!accountId) throw new Error('SANDBOX_ACCOUNT_NOT_CREATED');
    accountByUser.set(userKey, accountId);
    await investCall('SandboxService/SandboxPayIn', { accountId, amount: { currency: 'rub', units: '100000', nano: 0 } });
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
      positions: (p?.positions || []).map(pos => ({
        instrumentUid: pos.instrumentUid, figi: pos.figi,
        quantity: Number(pos.quantity?.units || 0),
        currentPrice: fromQ(pos.currentPrice),
      })),
    };
  }

  async function resolveTradeableShare(ticker) {
    const clean = ticker.toUpperCase();
    const all = await getAllShares();
    const found = all.find(s => s.ticker === clean);
    if (!found) throw new Error('TICKER_NOT_ALLOWED');
    return found;
  }

  return {
    investCall, getAllShares, getShare, getLastPrice, computeRisk, getQuote,
    listSandboxAccounts, getRubBalance, ensureSandboxFunds, openSandbox,
    sandboxPayIn, getPortfolio, resolveTradeableShare,
  };
}