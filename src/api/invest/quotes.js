// src/api/invest/quotes.js

export async function fetchQuotes(tickers) {
  if (!tickers || tickers.length === 0) return [];
  const res = await fetch(`/api/invest/quotes?tickers=${tickers.join(',')}`);
  if (!res.ok) throw new Error('Failed to fetch quotes');
  const data = await res.json();
  return data.quotes || [];
}