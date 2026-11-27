// Market — рендер каталога акций. Логика загрузки/фильтров — в hooks/useMarket.js.
import { useState } from 'react';
import { Search, AlertTriangle, Loader2, ArrowUpRight, ArrowDownRight, Minus, X, Filter } from 'lucide-react';
import { fmtPrice, fmtChange } from '../utils/format';
import Mascot from '../components/Mascot';
import RiskPill from '../components/ui/RiskPill';
import { useMarket } from '../hooks/useMarket';

export default function Market({ onOpenChat, trackEvent, userData, activeOutfit }) {
  const {
    activeFilter, setActiveFilter, query, setQuery,
    allTickers, visibleCount, displayStocks,
    loading, refreshing, busy, error,
    observerTarget,
  } = useMarket({ userData });

  const [isFilterOpen, setIsFilterOpen] = useState(false);

  return (
    <div className="page-container page-container--wide">
      {/* Хедер */}
      <header className="relative overflow-hidden rounded-3xl mb-6 p-6 md:p-8 bg-gradient-to-br from-yellow-500/10 via-transparent to-transparent border border-yellow-500/20">
        <div className="absolute -top-16 -right-16 w-56 h-56 rounded-full bg-yellow-400/10 blur-3xl pointer-events-none" />
        <div className="relative flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-serif font-bold text-gray-900 dark:text-white tracking-wide">Рынок</h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Реальные котировки и оценка риска.</p>
          </div>
          <div className="flex items-center gap-2 text-xs font-medium text-gray-500 dark:text-gray-400 bg-white/70 dark:bg-[#1a1a1a] border border-gray-100 dark:border-gray-800 px-3 py-1.5 rounded-full backdrop-blur">
            <span className={`w-2 h-2 rounded-full ${busy ? 'bg-yellow-500 animate-pulse' : 'bg-green-500'}`} />
            {busy ? 'Обновление…' : 'Онлайн'}
          </div>
        </div>
      </header>

      {/* Дисклеймер */}
      <div className="flex items-start gap-2 p-3 rounded-xl mb-6 bg-gray-50 dark:bg-[#1a1a1a] text-gray-500 text-[11px] border border-gray-100 dark:border-gray-800">
        <AlertTriangle size={14} className="shrink-0 mt-0.5 text-yellow-500" />
        <p>Не является индивидуальной инвестиционной рекомендацией. Данные API Т-Инвест.</p>
      </div>

      {/* Ошибка загрузки справочника */}
      {error && allTickers.length === 0 && (
        <div className="flex items-start gap-2 p-3 rounded-xl mb-6 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-xs border border-red-200 dark:border-red-900/40">
          <AlertTriangle size={14} className="shrink-0 mt-0.5" />
          <p>Не удалось загрузить список акций ({error}). Попробуй обновить страницу позже.</p>
        </div>
      )}

      {/* Поиск и Фильтры */}
      <div className="flex items-center gap-3 mb-8 mt-2">
        <div className="flex items-center gap-2 p-3 rounded-xl bg-white dark:bg-[#1a1a1a] border border-gray-100 dark:border-gray-800 focus-within:border-yellow-400 focus-within:ring-2 focus-within:ring-yellow-400/20 transition-all flex-1">
          <Search size={18} className="text-gray-400" />
          <input type="text" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Поиск по тикеру или названию" className="bg-transparent outline-none w-full text-sm text-gray-900 dark:text-white placeholder-gray-500" />
        </div>
        <button onClick={() => setIsFilterOpen(true)} className="flex items-center gap-2 px-4 py-3 rounded-xl bg-white dark:bg-[#1a1a1a] border border-gray-100 dark:border-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#222] transition-colors shrink-0">
          <Filter size={18} />
          <span className="hidden sm:inline text-sm font-medium">Фильтры</span>
        </button>
      </div>

      {/* Модалка фильтров */}
      {isFilterOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#1e1e1e] border border-gray-200 dark:border-gray-800 w-full max-w-sm rounded-3xl p-6 shadow-2xl relative">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Фильтры</h2>
              <button onClick={() => setIsFilterOpen(false)} className="p-2 text-gray-400 hover:text-gray-900 dark:hover:text-white bg-gray-100 dark:bg-gray-800 rounded-full transition-colors"><X size={20} /></button>
            </div>
            <div className="flex flex-col gap-2 mb-6">
              {[
                { id: 'all', label: 'Все' },
                { id: 'safe', label: 'Безопасные (Низкий риск)' },
                { id: 'growth', label: 'Растущие' },
                { id: 'closed', label: 'Закрытые (Нет цены)' },
                { id: 'my', label: 'Мои активы' },
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => { setActiveFilter(f.id); setIsFilterOpen(false); trackEvent(`Фильтр ${f.label}`); }}
                  className={`w-full text-left px-4 py-3 rounded-xl text-sm font-medium transition-all ${activeFilter === f.id ? 'bg-yellow-400 text-black' : 'bg-gray-50 dark:bg-[#121212] text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#2a2a2a]'}`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Сетка карточек */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
        {loading && allTickers.length === 0 ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="p-4 rounded-2xl bg-white dark:bg-[#1a1a1a] border border-gray-100 dark:border-gray-800 h-24 skeleton" />
          ))
        ) : (
          displayStocks.map((stock) => (
            <button
              key={stock.ticker}
              onClick={() => trackEvent(`Клик по ${stock.ticker}`)}
              className="group relative overflow-hidden w-full text-left p-4 rounded-2xl bg-white dark:bg-[#1a1a1a] border border-gray-100 dark:border-gray-800 hover:border-yellow-400/80 dark:hover:border-yellow-500/60 transition-all shadow-sm"
            >
              <div className="relative flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center font-bold text-sm bg-gradient-to-br from-yellow-300 to-yellow-500 text-black shrink-0 shadow-inner">
                    {stock.ticker?.[0]}
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-gray-900 dark:text-white truncate">
                      {stock.ticker}
                      <span className="ml-2 text-xs font-normal text-gray-500 dark:text-gray-400 truncate">{stock.name}</span>
                    </p>
                    <div className="mt-1">
                      {stock.price != null ? <RiskPill level={stock.riskLevel} variant="dot" /> : <span className="text-[10px] text-gray-400">Нет данных</span>}
                    </div>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <p className="font-bold text-gray-900 dark:text-white tabular-nums">
                    {stock.price != null ? fmtPrice(stock.price) : <span className="text-gray-400">—</span>}
                  </p>
                  <div className={`mt-1 inline-flex items-center gap-0.5 text-xs font-semibold px-1.5 py-0.5 rounded-md ${
                    stock.change == null ? 'text-gray-400'
                      : stock.change >= 0 ? 'text-green-600 dark:text-green-400 bg-green-500/10'
                        : 'text-red-600 dark:text-red-400 bg-red-500/10'
                  }`}>
                    {stock.change == null ? <Minus size={12} />
                      : stock.change >= 0 ? <ArrowUpRight size={13} />
                        : <ArrowDownRight size={13} />}
                    {stock.change != null ? fmtChange(stock.change) : '—'}
                  </div>
                </div>
              </div>
            </button>
          ))
        )}
      </div>

      {/* Маячок для загрузки (внизу списка) */}
      <div ref={observerTarget} className="h-20 flex items-center justify-center mt-4">
        {refreshing && <Loader2 className="animate-spin text-yellow-500" size={24} />}
        {!refreshing && !loading && visibleCount >= allTickers.length && allTickers.length > 0 && (
          <p className="text-sm text-gray-400">Все активы загружены</p>
        )}
      </div>

      {/* Плавающий маскот */}
      <div className="fixed bottom-24 md:bottom-8 right-6 z-40 flex flex-col items-end">
        <button onClick={onOpenChat} className="w-16 h-16 rounded-full bg-[#fdf8eb] dark:bg-[#2a2416] shadow-[0_8px_30px_rgba(250,204,21,0.4)] flex items-center justify-center hover:scale-105 transition-transform">
          <Mascot outfitId={activeOutfit} size={48} />
        </button>
      </div>
    </div>
  );
}
