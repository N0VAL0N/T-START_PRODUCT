// ===== useMarket: загрузка рынка + фильтры + ленивая подгрузка =====
// Вынесено из Market.jsx: справочник акций, чанковая загрузка цен,
// IntersectionObserver, стейты (pricesMap, allTickers, visibleCount), фильтрация.
// Компонент Market остаётся только рендером.
import { useEffect, useMemo, useRef, useState } from 'react';
import { fetchQuotes, fetchShares } from '../services/invest';

const CHUNK = 6;          // Размер запроса к API
const MAX_PARALLEL = 3;   // Параллельных запросов
const INITIAL_LIMIT = 30; // Сколько карточек сразу показываем
const LOAD_STEP = 10;     // Сколько карточек добавляем при скролле

export function useMarket({ userData } = {}) {
  const [activeFilter, setActiveFilter] = useState('all');
  const [query, setQuery] = useState('');

  const [allTickers, setAllTickers] = useState([]); // Справочник тикеров
  const [pricesMap, setPricesMap] = useState({});   // Кэш цен по тикерам
  const [visibleCount, setVisibleCount] = useState(INITIAL_LIMIT);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const observerTarget = useRef(null);
  const isLoadingRef = useRef(false);
  const noPriceRef = useRef(new Set());

  // Загрузка цен пачками (CHUNK × MAX_PARALLEL), без дублей.
  const loadPrices = async (tickersToLoad) => {
    // Дёргаем только тикеры без цены, не помеченные как «без цены».
    const toLoad = tickersToLoad.filter((t) => !noPriceRef.current.has(t));
    if (isLoadingRef.current || !toLoad.length) return;
    isLoadingRef.current = true;
    setRefreshing(true);

    try {
      const chunks = [];
      for (let i = 0; i < toLoad.length; i += CHUNK) {
        chunks.push(toLoad.slice(i, i + CHUNK));
      }

      for (let i = 0; i < chunks.length; i += MAX_PARALLEL) {
        const group = chunks.slice(i, i + MAX_PARALLEL);
        const results = await Promise.all(group.map((chunk) => fetchQuotes(chunk)));
        setPricesMap((prev) => {
          const next = { ...prev };
          results.flat().forEach((q) => {
            next[q.ticker] = q;
            if (q.price == null) noPriceRef.current.add(q.ticker);
          });
          return next;
        });
      }
    } catch (e) {
      console.error('Failed to load prices', e);
    } finally {
      isLoadingRef.current = false;
      setRefreshing(false);
    }
  };

  // 1. Справочник (без цен), затем сразу первые цены — одним потоком.
  useEffect(() => {
    let isCancelled = false;
    const loadShares = async () => {
      setLoading(true);
      setError(null);
      try {
        const shares = await fetchShares();
        if (isCancelled) return;
        const validShares = shares.filter((s) => s.ticker.length <= 5 && s.name.length > 2);
        setAllTickers(validShares);
        setLoading(false);
        loadPrices(validShares.slice(0, INITIAL_LIMIT).map((s) => s.ticker));
      } catch (e) {
        if (!isCancelled) { setError(e.message); setLoading(false); }
      }
    };
    loadShares();
    return () => { isCancelled = true; };
  }, []);

  // 2. Ленивая подгрузка при скролле (маячок внизу списка).
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !isLoadingRef.current) {
          const nextVisible = visibleCount + LOAD_STEP;
          setVisibleCount(nextVisible);
          const currentVisibleTickers = allTickers.slice(0, nextVisible);
          const missingTickers = currentVisibleTickers
            .filter((s) => !pricesMap[s.ticker] && !noPriceRef.current.has(s.ticker))
            .map((s) => s.ticker);
          if (missingTickers.length > 0) loadPrices(missingTickers);
        }
      },
      { threshold: 0.1 }
    );
    const target = observerTarget.current;
    if (target) observer.observe(target);
    return () => { if (target) observer.unobserve(target); };
  }, [visibleCount, allTickers, pricesMap]);

  // 3. Список для отрисовки: обогащение ценами + фильтры + поиск + лимит.
  const displayStocks = useMemo(() => {
    let list = allTickers.map((t) => {
      const priceData = pricesMap[t.ticker];
      return {
        ...t,
        ...priceData,
        price: priceData?.price ?? null,
        change: priceData?.change ?? null,
        riskLevel: priceData?.riskLevel || 'Умеренный',
      };
    });

    if (activeFilter === 'safe') list = list.filter((s) => s.riskLevel === 'Низкий');
    if (activeFilter === 'growth') list = list.filter((s) => s.change > 0);
    if (activeFilter === 'closed') list = list.filter((s) => s.price === null);
    if (activeFilter === 'my') list = list.filter((s) => userData?.portfolioStocks?.some((p) => p.ticker === s.ticker));

    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter((s) => s.ticker.toLowerCase().includes(q) || (s.name || '').toLowerCase().includes(q));
    }

    return list.slice(0, visibleCount);
  }, [allTickers, pricesMap, activeFilter, query, userData, visibleCount]);

  const busy = loading || refreshing;

  return {
    // фильтры/поиск
    activeFilter, setActiveFilter, query, setQuery,
    // данные/стейты
    allTickers, pricesMap, visibleCount, displayStocks,
    loading, refreshing, busy, error,
    // реф для маячка подгрузки
    observerTarget,
  };
}
