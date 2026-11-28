import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, Loader2, Lock, TrendingUp, TrendingDown } from 'lucide-react';
import { createChart } from 'lightweight-charts';
import { fmtPrice, fmtChange } from '../utils/format';
import Mascot from '../components/Mascot';
import { fetchQuotes } from '../api/invest/quotes';
import { fetchCandles } from '../api/invest/candles';
import { fetchBrand } from '../api/invest/brand';

// --- СВЕЧНОЙ ГРАФИК (Lightweight Charts) ---
const CandleChart = ({ data }) => {
  const chartContainerRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    if (!chartContainerRef.current || !data || data.length === 0) return;

    // Создаем график
    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { color: 'transparent' },
        textColor: '#9CA3AF',
      },
      grid: {
        vertLines: { color: 'rgba(255, 255, 255, 0.05)' },
        horzLines: { color: 'rgba(255, 255, 255, 0.05)' },
      },
      width: chartContainerRef.current.clientWidth,
      height: 200,
      timeScale: {
        borderColor: 'rgba(255, 255, 255, 0.1)',
      },
    });

    const candlestickSeries = chart.addCandlestickSeries({
      upColor: '#22c55e',
      downColor: '#ef4444',
      borderVisible: false,
      wickUpColor: '#22c55e',
      wickDownColor: '#ef4444',
    });

    // Преобразуем данные из API в формат Lightweight Charts
    const formattedData = data.map(c => ({
      time: new Date(c.time).toISOString().split('T')[0], // YYYY-MM-DD
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    })).sort((a, b) => new Date(a.time) - new Date(b.time));

    candlestickSeries.setData(formattedData);
    chart.timeScale().fitContent();
    chartRef.current = chart;

    return () => {
      chart.remove();
    };
  }, [data]);

  return <div ref={chartContainerRef} className="w-full" />;
};

// --- ОСНОВНОЙ КОМПОНЕНТ ---
export default function AssetDetail({ userData, activeOutfit }) {
  const { ticker } = useParams();
  const navigate = useNavigate();
  const [stock, setStock] = useState(null);
  const [candles, setCandles] = useState(null);
  const [brand, setBrand] = useState(null);
  const [loading, setLoading] = useState(true);
  const [timeframe, setTimeframe] = useState('month');

  const chaptersDone = userData?.chaptersDone || [];
  // Разблокировки
  const riskUnlocked = chaptersDone.includes('safe_harbor');
  const chartUnlocked = chaptersDone.includes('price_changes');
  const portfolioUnlocked = chaptersDone.includes('first_account');
  const companyUnlocked = chaptersDone.includes('money_flows');
  const buyUnlocked = chaptersDone.includes('first_account');
  const sellUnlocked = chaptersDone.includes('when_to_sell');

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        // 1. Котировка
        const quotes = await fetchQuotes([ticker]);
        setStock(quotes?.[0] || null);

        // 2. Свечи (только если разблокировано)
        if (chartUnlocked) {
          const candlesData = await fetchCandles(ticker, timeframe);
          setCandles(candlesData);
        }

        // 3. Бренд (только если разблокировано)
        if (companyUnlocked) {
          const brandData = await fetchBrand(ticker);
          setBrand(brandData);
        }
      } catch (e) {
        console.error('Ошибка загрузки:', e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [ticker, chartUnlocked, companyUnlocked, timeframe]);

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin" /></div>;
  if (!stock) return <div className="min-h-screen flex items-center justify-center">Акция не найдена</div>;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0a0a0a] pb-24">
      {/* Хедер с кнопкой Назад */}
      <header className="sticky top-0 z-40 bg-gray-50/80 dark:bg-[#0a0a0a]/80 backdrop-blur-md px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors">
          <ChevronLeft size={24} className="text-gray-900 dark:text-white" />
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-bold text-gray-900 dark:text-white">{stock.name || stock.ticker}</h1>
          <p className="text-xs text-gray-500">{stock.ticker}</p>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4">
        {/* Блок 1: Цена и Изменение */}
        <div className="flex items-baseline gap-2 mb-2 mt-4">
          <span className="text-4xl font-bold text-gray-900 dark:text-white">{fmtPrice(stock.price)}</span>
          {stock.change != null && (
            <span className={`text-sm font-medium flex items-center gap-1 ${stock.change >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {stock.change >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
              {fmtChange(stock.change)} сегодня
            </span>
          )}
        </div>

        {/* Блок 2: Риск (заглушка) */}
        {riskUnlocked ? (
          <div className="mb-6">
            {/* TODO: Использовать реальное значение риска (riskLevel) */}
            <p className="text-sm text-gray-500">Риск: [TODO: Использовать реальное значение риска]</p>
          </div>
        ) : (
          <div className="mb-6 p-4 rounded-2xl border-2 border-dashed border-yellow-500/30 bg-yellow-50 dark:bg-yellow-900/10 text-center">
            <Lock size={20} className="text-yellow-500 mx-auto mb-1" />
            <p className="text-sm text-gray-500">Откроется после истории «Безопасная гавань»</p>
          </div>
        )}

        {/* Блок 3: График */}
        {chartUnlocked ? (
          <div className="mb-6">
            <div className="flex gap-2 mb-4 overflow-x-auto no-scrollbar">
              {['day', 'week', 'month', 'year'].map((tf) => (
                <button
                  key={tf}
                  onClick={() => setTimeframe(tf)}
                  className={`px-4 py-1.5 rounded-full text-xs font-medium ${
                    timeframe === tf ? 'bg-yellow-400 text-black' : 'bg-white dark:bg-[#1e1e1e] text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-800'
                  }`}
                >
                  {tf === 'day' ? 'День' : tf === 'week' ? 'Неделя' : tf === 'month' ? 'Месяц' : 'Год'}
                </button>
              ))}
            </div>
            <div className="bg-white dark:bg-[#1e1e1e] rounded-2xl border border-gray-100 dark:border-gray-800 p-4">
              {candles && candles.length > 0 ? (
                <CandleChart data={candles} />
              ) : (
                <div className="h-[200px] flex items-center justify-center text-gray-400">Нет данных</div>
              )}
            </div>
          </div>
        ) : (
          <div className="mb-6 p-6 rounded-2xl border-2 border-dashed border-yellow-500/30 bg-yellow-50 dark:bg-yellow-900/10 text-center">
            <Lock size={24} className="text-yellow-500 mx-auto mb-2" />
            <p className="text-sm font-medium text-gray-900 dark:text-white">Откроется после истории</p>
            <p className="text-xs text-gray-500 mb-2">«Почему меняется цена?»</p>
            <button onClick={() => navigate('/story')} className="text-xs font-bold text-yellow-600 underline">Перейти к истории</button>
          </div>
        )}

        {/* Блок 4: У меня в портфеле */}
        {portfolioUnlocked ? (
          <div className="mb-6 p-4 rounded-2xl bg-white dark:bg-[#1e1e1e] border border-gray-100 dark:border-gray-800">
            <p className="text-xs text-gray-500 mb-1">У меня в портфеле</p>
            {userData?.portfolioStocks?.some(s => s.ticker === stock.ticker) ? (
              <>
                <p className="text-lg font-bold text-gray-900 dark:text-white">
                  {userData.portfolioStocks.filter(s => s.ticker === stock.ticker).length} акций
                </p>
                <p className="text-sm text-green-500">Стоимость: {fmtPrice(stock.price * userData.portfolioStocks.filter(s => s.ticker === stock.ticker).length)}</p>
              </>
            ) : (
              <p className="text-sm text-gray-500">У меня в портфеле нет акций</p>
            )}
          </div>
        ) : (
          <div className="mb-6 p-6 rounded-2xl border-2 border-dashed border-yellow-500/30 bg-yellow-50 dark:bg-yellow-900/10 text-center">
            <Lock size={24} className="text-yellow-500 mx-auto mb-2" />
            <p className="text-sm font-medium text-gray-900 dark:text-white">Откроется после истории</p>
            <p className="text-xs text-gray-500 mb-2">«Тайна первого счёта»</p>
            <button onClick={() => navigate('/story')} className="text-xs font-bold text-yellow-600 underline">Перейти к истории</button>
          </div>
        )}

        {/* Блок 5: О компании */}
        {companyUnlocked ? (
          <div className="mb-6 p-4 rounded-2xl bg-white dark:bg-[#1e1e1e] border border-gray-100 dark:border-gray-800">
            <h3 className="font-bold text-gray-900 dark:text-white mb-2">О компании</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {brand?.description || stock.name || 'Описание недоступно'}
            </p>
          </div>
        ) : (
          <div className="mb-6 p-6 rounded-2xl border-2 border-dashed border-yellow-500/30 bg-yellow-50 dark:bg-yellow-900/10 text-center">
            <Lock size={24} className="text-yellow-500 mx-auto mb-2" />
            <p className="text-sm font-medium text-gray-900 dark:text-white">Откроется после истории</p>
            <p className="text-xs text-gray-500 mb-2">«Куда текут реки денег»</p>
            <button onClick={() => navigate('/story')} className="text-xs font-bold text-yellow-600 underline">Перейти к истории</button>
          </div>
        )}

        {/* Блок 6: Кнопки Купить / Продать */}
        <div className="flex gap-3 mt-8">
          {buyUnlocked && (
            <button className="flex-1 bg-gradient-to-r from-yellow-400 to-orange-500 text-black font-bold py-4 rounded-2xl hover:brightness-110 transition-all shadow-lg">
              Купить
            </button>
          )}
          {sellUnlocked && (
            <button className="flex-1 bg-gradient-to-r from-red-500 to-pink-500 text-white font-bold py-4 rounded-2xl hover:brightness-110 transition-all shadow-lg">
              Продать
            </button>
          )}
        </div>
        {(!buyUnlocked || !sellUnlocked) && (
          <div className="mt-4 p-4 rounded-2xl border-2 border-dashed border-yellow-500/30 bg-yellow-50 dark:bg-yellow-900/10 text-center">
            <Lock size={20} className="text-yellow-500 mx-auto mb-1" />
            <p className="text-sm text-gray-500">Кнопки торговли откроются после историй «Тайна первого счёта» и «Как и когда продавать»</p>
          </div>
        )}

        <p className="text-[10px] text-gray-400 text-center mt-3">Демо-данные, не актуальные котировки. Не является ИИР.</p>
      </div>

      {/* Плавающий маскот */}
      <div className="fixed bottom-24 right-6 z-40">
        <Mascot outfitId={activeOutfit} size={64} />
      </div>
    </div>
  );
}