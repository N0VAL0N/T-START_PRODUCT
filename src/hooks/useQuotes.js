// ===== Хук живых котировок =====
// Тянет реальные цены/риск из /api/quotes (T-Invest). Никаких моков.
// Кэширует последние успешные значения в Zustand (только сессия),
// чтобы UI не «мигал» между обновлениями и переживал ре-рендеры.
//
// Использование:
//   const { quotes, byTicker, loading, error, refresh } = useQuotes(['SBER','GAZP']);

import { useEffect, useMemo, useCallback } from 'react';
import { useUserStore } from '../store/userStore';
import { fetchQuotes } from '../services/invest';

const DEFAULT_REFRESH_MS = 60_000; // рынок не дёргаем чаще раза в минуту

export function useQuotes(tickers, { refreshMs = DEFAULT_REFRESH_MS } = {}) {
  const quotesMap = useUserStore((s) => s.quotes);
  const setQuotes = useUserStore((s) => s.setQuotes);
  const setQuotesStatus = useUserStore((s) => s.setQuotesStatus);
  const loading = useUserStore((s) => s.quotesLoading);
  const error = useUserStore((s) => s.quotesError);

  // Стабильный ключ из тикеров — чтобы не перезапускать эффект на новый массив.
  const key = (tickers || []).map((t) => String(t).toUpperCase()).sort().join(',');



  const load = useCallback(async () => {

    const list = key ? key.split(',') : [];
    setQuotesStatus(true, null);
    try {
      const arr = await fetchQuotes(list);
      const next = { ...useUserStore.getState().quotes };
      for (const q of arr) next[q.ticker] = q;
      setQuotes(next);
      setQuotesStatus(false, null);
    } catch (e) {
      // Оставляем последние известные значения (не обнуляем), но фиксируем ошибку.
      setQuotesStatus(false, e.message);
    }

  }, [key, setQuotes, setQuotesStatus]);

  useEffect(() => {
    if (!key) return undefined;
    load();
    const id = setInterval(load, refreshMs);

    // Не опрашиваем котировки, пока вкладка скрыта (экономим API-запросы).
    // При возврате на вкладку — сразу обновляем и возобновляем интервал.
    let intervalId = id;
    const onVisibility = () => {
      if (document.hidden) {
        clearInterval(intervalId);
      } else {
        load();
        intervalId = setInterval(load, refreshMs);
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [key, refreshMs, load]);

  const byTicker = useMemo(() => {
    const out = {};
    for (const t of (tickers || [])) out[String(t).toUpperCase()] = quotesMap[String(t).toUpperCase()] || null;
    return out;
  }, [tickers, quotesMap]);

  return { quotes: quotesMap, byTicker, loading, error, refresh: load };
}
