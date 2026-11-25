// Клиент песочницы T-Invest. Все вызовы идут через наш бэкенд (/api/invest/*),
// который держит токен и решает CORS/TLS. Фронт токенов НЕ видит.
// isInvestConfigured() на фронте всегда true — реальная конфигурация проверяется на бэке
// (health: /api/health). Если бэк не запущен — вызов бросит ошибку, UI это обработает.

const API = '/api';

// Оптимистично считаем настроенным; health-проверка уточнит на бэке.
export const isInvestConfigured = () => true;

async function call(path, body = {}) {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`INVEST_ERROR_${res.status}: ${data?.error || 'unknown'}`);
  return data;
}

/** Открыть счёт песочницы + пополнить (на бэке). Возвращает accountId. */
export async function openSandboxAccount() {
  const data = await call('/invest/open');
  if (!data?.accountId) throw new Error('SANDBOX_ACCOUNT_NOT_CREATED');
  return data.accountId;
}

/**
 * Сделка по тикеру.
 * confirm=false → заявка только готовится (сохраняется на бэке как PENDING_CONFIRM).
 * confirm=true  → немедленная попытка исполнения (если не вышло — заявка QUEUED).
 */
export async function tradeByTicker(accountId, { ticker, lots = 1, direction = 'BUY', confirm = true }) {
  return call('/invest/order', { accountId, ticker, lots, direction, confirm });
}

/**
 * Реальные котировки с бэкенда (/api/quotes). Цены/риск — из T-Invest API.
 * Возвращает массив: [{ ticker, name, price, priceExact, change, lot, riskLevel, volatility, maxDrawdown, riskNote }]
 * Если по тикеру нет данных — поля null (без выдуманных значений).
 */
export async function fetchQuotes(tickers) {
  const qs = Array.isArray(tickers) && tickers.length
    ? `?tickers=${encodeURIComponent(tickers.join(','))}`
    : '';
  const res = await fetch(`${API}/quotes${qs}`);
  if (!res.ok) throw new Error(`QUOTES_ERROR_${res.status}`);
  const data = await res.json();
  return data.quotes || [];
}
