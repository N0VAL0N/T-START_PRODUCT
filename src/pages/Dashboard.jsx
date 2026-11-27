import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trophy, Plus, TrendingUp, TrendingDown, Flame, Loader2 } from 'lucide-react';
import Mascot from '../components/Mascot';
import { useQuotes } from '../hooks/useQuotes';
import DepositModal from '../components/DepositModal';
import { useUserStore } from '../store/userStore';

export default function Dashboard({ userData, onOpenChat, trackEvent }) {
  const navigate = useNavigate();
  const [depositOpen, setDepositOpen] = useState(false);
  const setBalance = useUserStore((s) => s.setBalance);

  const stocks = useMemo(() => userData.portfolioStocks || [], [userData.portfolioStocks]);

  // Тикеры для котировок — ТОЛЬКО бумаги из портфеля пользователя.
  // Если портфель пуст — ничего не грузим (не дёргаем API «просто так»).
  const tickers = useMemo(
    () => [...new Set(stocks.map((s) => s.ticker).filter(Boolean))],
    [stocks]
  );

  const { byTicker, loading } = useQuotes(tickers);

  // Текущая стоимость портфеля: по реальным ценам (fallback — цена покупки).
  const { portfolioValue, portfolioReturn } = useMemo(() => {
    if (!stocks.length) {
      return { portfolioValue: Number(userData.portfolio) || 0, portfolioReturn: 0 };
    }
    let value = 0;
    let weightedChange = 0;
    let weightSum = 0;
    for (const s of stocks) {
      const q = byTicker[s.ticker];
      const price = q?.priceExact ?? s.price;
      value += price;
      const ch = q?.change;
      if (ch != null) {
        weightedChange += ch * (s.price || 1);
        weightSum += (s.price || 1);
      }
    }
    return {
      portfolioValue: Math.round(value),
      portfolioReturn: weightSum > 0 ? Number((weightedChange / weightSum).toFixed(2)) : 0,
    };
  }, [stocks, byTicker, userData.portfolio]);

  const goalAmount = 5000;
  const goalProgress = Math.min(Math.round((portfolioValue / goalAmount) * 100), 100);

  return (
    <div className="max-w-6xl mx-auto w-full">
      <header className="flex justify-between items-center mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">T-Start</h1>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-900/40">
            <Flame size={18} className="text-orange-500" />
            <span className="font-bold text-sm text-gray-900 dark:text-white">{userData.daysStreak || 0}</span>
            <span className="text-[10px] text-gray-500 hidden sm:inline">дн. подряд</span>
          </div>
          {loading && <Loader2 size={16} className="animate-spin text-yellow-500" />}
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="md:col-span-2 p-6 rounded-3xl bg-white dark:bg-[#1e1e1e] border border-gray-100 dark:border-gray-800">
          <div className="flex justify-between border-b border-gray-100 dark:border-gray-800 pb-4 mb-4">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Свободные средства</p>
              <p className="text-3xl font-bold mt-1 text-gray-900 dark:text-white">{userData.balance} ₽</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-500 dark:text-gray-400">Общий портфель</p>
              <p className="text-3xl font-bold text-yellow-500 mt-1">{portfolioValue} ₽</p>
              <p className={`text-xs font-medium flex items-center justify-end gap-1 ${portfolioReturn >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                {portfolioReturn >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                {portfolioReturn >= 0 ? '+' : ''}{portfolioReturn}% за день
              </p>
            </div>
          </div>

          <div className="mb-6">
            <div className="flex justify-between text-sm mb-1 text-gray-900 dark:text-white">
              <span>Цель: {userData.goal} ({goalAmount} ₽)</span>
              <span>{goalProgress}%</span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div className="bg-yellow-400 h-2 rounded-full transition-all" style={{ width: `${goalProgress}%` }}></div>
            </div>
          </div>

          <div className="mb-4">
            <p className="text-xs text-gray-500 mb-2">В портфеле:</p>
            <div className="space-y-1">
              {stocks.length > 0 ? (
                stocks.slice(0, 5).map((s, i) => {
                  const q = byTicker[s.ticker];
                  const price = q?.price != null ? `${q.price} ₽` : '—';
                  const change = q?.change;
                  return (
                    <div key={i} className="flex justify-between text-xs text-gray-700 dark:text-gray-300">
                      <span>{s.ticker} <span className="text-gray-400">{s.name}</span></span>
                      <span className="flex items-center gap-2">
                        <span>{price}</span>
                        {change != null && (
                          <span className={change >= 0 ? 'text-green-500' : 'text-red-500'}>
                            {change >= 0 ? '+' : ''}{change}%
                          </span>
                        )}
                      </span>
                    </div>
                  );
                })
              ) : (
                <p className="text-xs text-gray-400">Пока пусто. Купи акции через ИИ.</p>
              )}
              {stocks.length > 5 && <p className="text-[10px] text-gray-500">...и еще {stocks.length - 5}</p>}
            </div>
          </div>

          <button
            onClick={() => { trackEvent('Кнопка Пополнить'); setDepositOpen(true); }}
            className="w-full bg-yellow-400 text-black font-bold py-3 rounded-2xl hover:bg-yellow-500 transition-colors flex items-center justify-center gap-2"
          >
            <Plus size={20} /> Пополнить
          </button>
        </div>

        {/* Блок Дружеского вызова */}
        <div onClick={() => navigate('/tournament')} className="p-6 rounded-3xl bg-linear-to-br from-yellow-400 to-orange-500 flex flex-col justify-between text-black cursor-pointer hover:opacity-90 transition-opacity">
          <div>
            <Trophy size={32} className="mb-3" />
            <p className="font-bold text-lg leading-tight mb-1">Дружеский вызов</p>
            <p className="text-xs font-medium opacity-80 mb-4">Пригласи друзей и соревнуйся по доходности.</p>
            <div className="bg-black/10 p-2 rounded-xl text-center">
              <p className="text-[10px] uppercase font-bold opacity-70">Твоя доходность</p>
              <p className="text-2xl font-bold">{portfolioReturn >= 0 ? '+' : ''}{portfolioReturn}%</p>
            </div>
          </div>
        </div>
      </div>

      <div
        onClick={() => { trackEvent('Открыт чат ассистента'); onOpenChat?.(); }}
        className="p-4 rounded-3xl flex items-center gap-4 cursor-pointer hover:opacity-90 transition-opacity bg-[#fdf8eb] dark:bg-[#2a2416] border border-yellow-100 dark:border-yellow-900/30"
      >
        <Mascot outfitId={userData.activeOutfit} size={64} />
        <div className="flex-1">
          <h3 className="font-bold text-lg text-gray-900 dark:text-white">T-Start Ассистент</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">Привет! Я помогу собрать портфель с нуля. Нажми на меня.</p>
        </div>
        <span className="text-yellow-500 text-2xl">›</span>
      </div>

      <div
        onClick={() => { trackEvent('Переход в Историю с героя'); navigate('/story'); }}
        className="flex flex-col items-center justify-center mt-12 mb-8 cursor-pointer hover:scale-105 transition-transform"
      >
        <Mascot outfitId={userData.activeOutfit} size={160} className="animate-bounce" />
        <p className="text-yellow-600 dark:text-yellow-500 font-medium mt-4 text-sm md:text-base">Готов отправиться в путешествие по миру Инвестиций</p>
      </div>

      <DepositModal
        open={depositOpen}
        onClose={() => setDepositOpen(false)}
        userData={userData}
        onDeposit={(amount) => {
          const current = Number(userData.balance) || 0;
          setBalance(current + amount);
        }}
      />
    </div>
  );
}
