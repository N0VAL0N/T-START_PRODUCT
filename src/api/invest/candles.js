// src/api/invest/candles.js

/**
 * Получить свечи для графика.
 * @param {string} ticker - Тикер (SBER)
 * @param {string} timeframe - 'day' | 'week' | 'month' | 'year'
 */
export async function fetchCandles(ticker, timeframe = 'month') {
  const now = new Date();
  let from = new Date();
  let interval = 'CANDLE_INTERVAL_DAY';

  switch (timeframe) {
    case 'day':
      from.setHours(now.getHours() - 24);
      interval = 'CANDLE_INTERVAL_HOUR'; // По часам
      break;
    case 'week':
      from.setDate(now.getDate() - 7);
      interval = 'CANDLE_INTERVAL_DAY'; // По дням
      break;
    case 'month':
      from.setDate(now.getDate() - 30);
      interval = 'CANDLE_INTERVAL_DAY'; // По дням
      break;
    case 'year':
      from.setDate(now.getDate() - 365);
      interval = 'CANDLE_INTERVAL_WEEK'; // По неделям
      break;
    default:
      from.setDate(now.getDate() - 30);
  }

  const res = await fetch(`/api/invest/candles?ticker=${ticker}&from=${from.toISOString()}&to=${now.toISOString()}&interval=${interval}`);
  if (!res.ok) throw new Error('Failed to fetch candles');
  const data = await res.json();
  return data.candles || [];
}