import { TrendingUp, TrendingDown, Check, Clock } from 'lucide-react';

// Карточка подготовленной заявки (из metadata ответа AI).
export default function OrderCard({ order, onConfirm, onDismiss }) {
  const isBuy = order.action !== 'sell';
  return (
    <div className="w-full rounded-2xl p-4 bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-[#241f10] dark:to-[#1a1710] border border-yellow-500/30 ring-1 ring-yellow-500/10 shadow-[0_0_24px_rgba(250,204,21,0.1)]">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold ${isBuy ? 'bg-green-500/15 text-green-600 dark:text-green-400' : 'bg-red-500/15 text-red-600 dark:text-red-400'}`}>
            {isBuy ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
            {isBuy ? 'Покупка' : 'Продажа'}
          </span>
          <span className="text-xs text-gray-500 flex items-center gap-1"><Clock size={12} /> {order.id}</span>
        </div>
        <span className="font-bold text-lg text-gray-900 dark:text-white">{order.ticker}</span>
      </div>
      <div className="grid grid-cols-3 gap-2 mb-3 text-center">
        <div className="p-2 rounded-xl bg-white/60 dark:bg-black/20">
          <p className="text-[10px] text-gray-500 uppercase">Лоты</p>
          <p className="font-bold text-gray-900 dark:text-white">{order.lots}</p>
        </div>
        <div className="p-2 rounded-xl bg-white/60 dark:bg-black/20">
          <p className="text-[10px] text-gray-500 uppercase">Штук</p>
          <p className="font-bold text-gray-900 dark:text-white">{order.quantity ?? order.lots}</p>
        </div>
        <div className="p-2 rounded-xl bg-white/60 dark:bg-black/20">
          <p className="text-[10px] text-gray-500 uppercase">≈ Сумма</p>
          <p className="font-bold text-gray-900 dark:text-white">{order.estCost != null ? `${order.estCost} ₽` : (order.price != null ? `${order.price} ₽` : '—')}</p>
        </div>
      </div>
      <div className="flex gap-2">
        <button onClick={onConfirm} className="flex-1 bg-yellow-400 text-black font-bold py-2.5 rounded-xl hover:bg-yellow-500 transition-colors flex items-center justify-center gap-1.5">
          <Check size={16} /> Подтвердить
        </button>
        <button onClick={onDismiss} className="flex-1 bg-gray-200 dark:bg-white/10 text-gray-800 dark:text-white py-2.5 rounded-xl hover:opacity-90 transition-opacity">Позже</button>
      </div>
    </div>
  );
}
