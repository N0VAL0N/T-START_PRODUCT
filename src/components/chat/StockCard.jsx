import { Sparkles, TrendingUp, ShieldCheck, Wallet } from 'lucide-react';

// Карточка выбранной акции (сообщение типа 'detail').
export default function StockCard({ stock }) {
  return (
    <div className="w-full bg-white dark:bg-[#1f1f1f] border border-gray-200 dark:border-white/8 rounded-2xl p-4 shadow-[0_0_24px_rgba(250,204,21,0.06)]">
      <div className="flex justify-between items-start mb-2">
        <div>
          <h4 className="font-bold text-lg text-gray-900 dark:text-white flex items-center gap-2"><Sparkles size={16} className="text-yellow-500" />{stock.name}</h4>
          <p className="text-xs text-gray-500">{stock.ticker}</p>
        </div>
        <div className="text-right">
          <p className="font-bold text-lg text-gray-900 dark:text-white">{stock.price} ₽</p>
          <p className="text-[10px] text-gray-500">за 1 акцию</p>
        </div>
      </div>
      <div className="flex items-center gap-2 mb-3 text-xs bg-gray-50 dark:bg-[#141414] p-2 rounded-lg">
        <TrendingUp size={14} className="text-yellow-500" />
        <span className="text-gray-600 dark:text-gray-300">Колебания:</span>
        <span className="font-bold text-gray-900 dark:text-white">{stock.volatility}</span>
      </div>
      <div className="mb-3">
        <p className="text-xs font-bold text-gray-900 dark:text-white mb-1 flex items-center gap-1"><ShieldCheck size={14} className="text-green-500" /> На что обратить внимание:</p>
        <ul className="text-[11px] text-gray-600 dark:text-gray-400 space-y-1 list-disc pl-4">
          {stock.reasons.map((r, i) => <li key={i}>{r}</li>)}
        </ul>
      </div>
      <div className="flex justify-between items-center bg-yellow-50 dark:bg-yellow-900/10 p-2 rounded-lg">
        <span className="text-xs text-yellow-700 dark:text-yellow-500 flex items-center gap-1"><Wallet size={14} /> Цена входа:</span>
        <span className="text-xs font-bold text-gray-900 dark:text-white">{stock.price} ₽ / {stock.lotPrice} ₽ (лот)</span>
      </div>
    </div>
  );
}
