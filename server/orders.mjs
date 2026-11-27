import { sanitizeTicker, sanitizeLots, sanitizeDirection } from './validators.mjs';

export function createOrders({ investCall, fromQ, getQuote, resolveTradeableShare }) {
  const pendingOrders = new Map();
  const queuedOrders = new Map();
  let orderSeq = 1;
  const nextOrderId = () => `PO-${String(orderSeq++).padStart(4, '0')}`;

  async function prepareOrder({ ticker, lots = 1, direction = 'BUY' }) {
    const share = await resolveTradeableShare(ticker);
    const price = await getQuote(share.ticker).then(q => q.priceExact);
    const quantity = share.lot * Number(lots || 1);
    const id = nextOrderId();
    const order = { id, status: 'PENDING_CONFIRM', accountId: null, ticker: share.ticker, instrumentId: share.uid || share.figi, lots: Number(lots || 1), quantity, direction, price, createdAt: Date.now() };
    pendingOrders.set(id, order);
    return order;
  }

  async function executeSandboxOrder(accountId, order) {
    try {
      const resp = await investCall('SandboxService/PostSandboxOrder', {
        accountId, instrumentId: order.instrumentId, quantity: String(order.quantity),
        direction: order.direction === 'SELL' ? 'ORDER_DIRECTION_SELL' : 'ORDER_DIRECTION_BUY',
        orderType: 'ORDER_TYPE_MARKET',
      });
      return { executed: true, tradeAvailable: true, order: { ...order, status: 'EXECUTED', accountId, orderId: resp?.orderId || null } };
    } catch (e) {
      return { executed: false, tradeAvailable: false, reason: e.message, order: { ...order, status: 'FAILED_TEMP', accountId } };
    }
  }

  async function executeMcpOrder() {
    throw new Error('MCP_NOT_CONFIGURED');
  }

  async function confirmOrder(accountId, orderId) {
    const order = pendingOrders.get(orderId);
    if (!order) throw new Error('ORDER_NOT_FOUND');
    pendingOrders.delete(orderId);
    const result = await executeSandboxOrder(accountId, order);
    if (result.executed) return result;
    return { executed: false, tradeAvailable: false, reason: result.reason, order: { ...order, status: 'COULD_QUEUE', accountId } };
  }

  function queueOrder(order) {
    const q = { ...order, status: 'QUEUED', queuedAt: Date.now() };
    queuedOrders.set(q.id, q);
    return q;
  }

  function cancelOrder(orderId) {
    pendingOrders.delete(orderId);
    queuedOrders.delete(orderId);
    return { ok: true };
  }

  async function retryQueued() {
    const results = [];
    for (const [id, order] of [...queuedOrders.entries()]) {
      const res = await executeSandboxOrder(order.accountId, order);
      if (res.executed) { queuedOrders.delete(id); results.push({ id, executed: true }); }
      else { results.push({ id, executed: false }); }
    }
    return results;
  }

  return { prepareOrder, confirmOrder, queueOrder, cancelOrder, retryQueued, pendingOrders, queuedOrders };
}