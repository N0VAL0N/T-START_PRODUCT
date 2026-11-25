import { useMemo, useState } from 'react';
import { Search, Bot, ChevronRight, AlertTriangle, Loader2, ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';
import { useQuotes } from '../hooks/useQuotes';
import { fmtPrice, fmtChange } from '../utils/format';

// Список тикеров для экрана Рынок. Цены/риск — только из /api/quotes.
const TICKERS = ['SBER', 'GAZP', 'LKOH', 'YNDX', 'GMKN', 'TATN', 'MTSS', 'PLZL'];

// Риск → аккуратный бейдж с точкой-индикатором (обе темы).
const RISK_STYLE = {
  'Низкий': { dot: 'bg-green-500', text: 'text-green-600 dark:text-green-400', bg: 'bg-green-500/10' },
  'Умеренный': { dot: 'bg-yellow-500', text: 'text-yellow-600 dark:text-yellow-400', bg: 'bg-yellow-500/10' },
  'Высокий': { dot: 'bg-red-500', text: 'text-red-600 dark:text-red-400', bg: 'bg-red-500/10' },
};

function RiskBadge({ level }) {
  const s = RISK_STYLE[level];
  if (!s) {
    return <span className="inline-flex items-center gap-1.5 text-[10px] px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-400">риск н/д</span>;
  }
  return (
    <span className={`inline-flex items-center gap-1.5 text-[10px] font-medium px-2 py-0.5 rounded-full ${s.bg} ${s.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {level}
    </span>
  );
}

// Мини-карточка строки рынка. Премиум-стиль, обе темы.
function MarketCard({ stock, onOpen, index }) {
  const change = stock.change;
  const up = change != null && change >= 0;
  const hasChange = change != null;

  return (
    <button
      onClick={onOpen}
      style={{ animationDelay: `${index * 40}ms` }}
      className="animate-fade-in group relative overflow-hidden w-full text-left p-4 rounded-2xl bg-white dark:bg-[#1a1a1a] border border-gray-100 dark:border-gray-800 hover:border-yellow-400/80 dark:hover:border-yellow-500/60 transition-all shadow-sm hover:shadow-[0_8px_30px_rgba(250,204,21,0.08)]"
    >
      {/* Мягкое свечение в углу при ховере */}
      <div className="absolute -top-10 -right-10 w-24 h-24 rounded-full bg-yellow-400/0 group-hover:bg-yellow-400/10 blur-2xl transition-all pointer-events-none" />

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
            <div className="mt-1"><RiskBadge level={stock.riskLevel} /></div>
          </div>
        </div>

        <div className="text-right shrink-0">
          <p className="font-bold text-gray-900 dark:text-white tabular-nums">
            {stock.price != null ? fmtPrice(stock.price) : <span className="text-gray-400">—</span>}
          </p>
          <div className={`mt-1 inline-flex items-center gap-0.5 text-xs font-semibold px-1.5 py-0.5 rounded-md ${
            !hasChange ? 'text-gray-400'
              : up ? 'text-green-600 dark:text-green-400 bg-green-500/10'
              : 'text-red-600 dark:text-red-400 bg-red-500/10'
          }`}>
            {!hasChange ? <Minus size={12} />
              : up ? <ArrowUpRight size={13} />
              : <ArrowDownRight size={13} />}
            {hasChange ? fmtChange(change) : '—'}
          </div>
        </div>
      </div>
    </button>
  );
}

// Скелетон-заглушка строки на время первой загрузки.
function SkeletonCard() {
  return (
    <div className="p-4 rounded-2xl bg-white dark:bg-[#1a1a1a] border border-gray-100 dark:border-gray-800">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="skeleton w-11 h-11 rounded-xl" />
          <div className="space-y-2">
            <div className="skeleton h-3.5 w-24" />
            <div className="skeleton h-2.5 w-16" />
          </div>
        </div>
        <div className="space-y-2">
          <div className="skeleton h-3.5 w-16 ml-auto" />
          <div className="skeleton h-3 w-12 ml-auto" />
        </div>
      </div>
    </div>
  );
}

export default function Market({ onOpenChat, trackEvent }) {
  const filters = ['Все', 'Безопасные', 'Мои активы'];
  const { byTicker, loading } = useQuotes(TICKERS);
  const [activeFilter, setActiveFilter] = useState('Все');
  const [query, setQuery] = useState('');

  const rows = useMemo(
    () => TICKERS.map((t) => byTicker[t] || { ticker: t, name: t, price: null, change: null, riskLevel: null }),
    [byTicker]
  );

  // Фильтрация: по категории + локальный поиск по тикеру/имени (без доп. запросов).
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((s) => {
      if (activeFilter === 'Безопасные' && s.riskLevel !== 'Низкий') return false;
      if (activeFilter === 'Мои активы') return false; // пока нет привязки — пусто
      if (!q) return true;
      return s.ticker.toLowerCase().includes(q) || (s.name || '').toLowerCase().includes(q);
    });
  }, [rows, activeFilter, query]);

  const firstLoad = loading && rows.every((r) => r.price == null);

  return (
    <div className="max-w-6xl mx-auto w-full">
      {/* Hero-хедер */}
      <header className="relative overflow-hidden rounded-3xl mb-6 p-6 md:p-8 bg-gradient-to-br from-yellow-500/10 via-transparent to-transparent border border-yellow-500/20">
        <div className="absolute -top-16 -right-16 w-56 h-56 rounded-full bg-yellow-400/10 blur-3xl pointer-events-none" />
        <div className="relative flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-serif font-bold text-gray-900 dark:text-white tracking-wide">Рынок</h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Реальные котировки и оценка риска из API Т-Инвест.</p>
          </div>
          <div className="flex items-center gap-2 text-xs font-medium text-gray-500 dark:text-gray-400 bg-white/70 dark:bg-[#1a1a1a] border border-gray-100 dark:border-gray-800 px-3 py-1.5 rounded-full backdrop-blur">
            <span className={`w-2 h-2 rounded-full ${loading ? 'bg-yellow-500 animate-pulse' : 'bg-green-500'}`} />
            {loading ? 'Обновление…' : 'Онлайн'}
          </div>
        </div>
      </header>

      {/* Дисклеймер: данные реальные, но это не ИИР */}
      <div className="flex items-start gap-2 p-3 rounded-xl mb-5 bg-gray-50 dark:bg-[#1a1a1a] text-gray-500 text-[11px] border border-gray-100 dark:border-gray-800">
        <AlertTriangle size={14} className="shrink-0 mt-0.5 text-yellow-500" />
        <p>Цены и оценка риска — из API Т-Инвест (расчёт по истории). Не является индивидуальной инвестиционной рекомендацией.</p>
      </div>

      {/* Фильтры + поиск */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-5">
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {filters.map((f) => (
            <button
              key={f}
              onClick={() => { setActiveFilter(f); trackEvent(`Фильтр ${f}`); }}
              className={`px-4 py-2 rounded-full whitespace-nowrap text-sm font-medium transition-all ${
                activeFilter === f
                  ? 'bg-yellow-400 text-black shadow-[0_4px_16px_rgba(250,204,21,0.4)]'
                  : 'bg-white dark:bg-[#1a1a1a] text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#222] border border-gray-100 dark:border-gray-800'
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 p-2.5 rounded-xl bg-white dark:bg-[#1a1a1a] border border-gray-100 dark:border-gray-800 focus-within:border-yellow-400 focus-within:ring-2 focus-within:ring-yellow-400/20 transition-all sm:ml-auto sm:w-72">
          <Search size={18} className="text-gray-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Поиск по тикеру или названию"
            className="bg-transparent outline-none w-full text-sm text-gray-900 dark:text-white placeholder-gray-500"
          />
          {loading && <Loader2 size={16} className="animate-spin text-yellow-500 shrink-0" />}
        </div>
      </div>

      {/* Сетка карточек */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
        {firstLoad
          ? TICKERS.map((t) => <SkeletonCard key={t} />)
          : visible.map((stock, i) => (
              <MarketCard key={stock.ticker} stock={stock} index={i} onOpen={() => trackEvent(`Клик по ${stock.ticker}`)} />
            ))}
      </div>

      {!firstLoad && visible.length === 0 && (
        <div className="text-center py-16 text-gray-500 dark:text-gray-400 text-sm">
          {activeFilter === 'Мои активы'
            ? 'Здесь появятся твои активы после первой покупки.'
            : 'Ничего не найдено. Попробуй другой тикер или название.'}
        </div>
      )}

      {/* Плавающая CTA «Спросить у ИИ» */}
      <div className="mt-8 md:fixed md:bottom-8 md:right-8">
        <button onClick={onOpenChat} className="w-full md:w-auto bg-yellow-400 text-black font-bold py-3 px-6 rounded-2xl hover:bg-yellow-500 transition-all flex items-center justify-center gap-2 shadow-[0_8px_30px_rgba(250,204,21,0.35)] hover:shadow-[0_10px_36px_rgba(250,204,21,0.5)]">
          <Bot size={20} /> Спросить у ИИ <ChevronRight size={20} />
        </button>
      </div>
    </div>
  );
}
