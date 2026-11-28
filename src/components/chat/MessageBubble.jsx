import { ShieldCheck } from 'lucide-react';
import Mascot from '../Mascot';
import Markdown from '../Markdown';
import RiskPill from '../ui/RiskPill';
import StockCard from './StockCard';
import OrderCard from './OrderCard';

// Один пузырь сообщения в чате. Разные типы рендерятся по-разному.
export default function MessageBubble({
  msg, activeOutfit, suggestedStocks, stockCards,
  selectStock, confirmTrade, cancelStock, confirmOrder, dismissOrder,
}) {
  return (
    <div className={`flex items-start gap-2.5 ${msg.sender === 'user' ? 'justify-end' : ''}`}>
      {msg.sender === 'ai' && (
        <div className="w-8 h-8 rounded-xl bg-[#fdf8eb] dark:bg-[#2a2416] flex items-center justify-center shrink-0 ring-1 ring-yellow-500/20">
          <Mascot outfitId={activeOutfit} size={24} />
        </div>
      )}

      {msg.type === 'text' && (
        <div className={`px-4 py-3 rounded-2xl max-w-[85%] text-sm shadow-sm ${
          msg.sender === 'user'
            ? 'bg-gradient-to-br from-yellow-400 to-yellow-500 text-black font-medium rounded-tr-sm'
            : 'bg-gray-50 dark:bg-[#1f1f1f] text-gray-800 dark:text-gray-100 rounded-tl-sm ring-1 ring-black/5 dark:ring-white/5'
        }`}>
          <Markdown text={msg.text} />
        </div>
      )}

      {msg.type === 'stocks' && (
        <div className="w-full">
          <div className="grid grid-cols-1 gap-2 mb-2">
            {(suggestedStocks.length ? suggestedStocks : stockCards).map((s) => (
              <button key={s.ticker} onClick={() => selectStock(s)} className="text-left p-3 bg-white dark:bg-[#1f1f1f] border border-gray-200 dark:border-white/8 rounded-xl hover:border-yellow-400 hover:shadow-[0_0_18px_rgba(250,204,21,0.15)] transition-all flex justify-between items-center gap-2">
                <div className="min-w-0">
                  <p className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    {s.ticker}
                    <span className="text-xs text-gray-500 font-normal truncate">{s.name}</span>
                  </p>
                  <div className="mt-1"><RiskPill level={s.risk} variant="solid" /></div>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-bold text-gray-900 dark:text-white">{s.price} ₽</p>
                  {s.change != null && (
                    <p className={`text-[10px] font-medium ${s.change >= 0 ? 'text-green-500' : 'text-red-500'}`}>{s.change >= 0 ? '+' : ''}{s.change}%</p>
                  )}
                </div>
              </button>
            ))}
          </div>
          <div className="bg-gray-50 dark:bg-[#141414] p-3 rounded-xl border border-gray-100 dark:border-white/5">
            <p className="text-[10px] text-gray-500 leading-tight mb-2">
              <strong className="text-gray-700 dark:text-gray-300 block mb-1">Не является индивидуальной инвестиционной рекомендацией (ИИР).</strong>
              Подборка собрана по открытым данным и не учитывает твои цели и склонность к риску. Решение принимаешь сам — любая бумага может как вырасти, так и упасть.
            </p>
            <div className="flex flex-wrap gap-2 text-[10px] text-gray-500">
              <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-green-500" /> Низкий</span>
              <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-yellow-500" /> Умеренный</span>
              <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-red-500" /> Высокий</span>
            </div>
          </div>
        </div>
      )}

      {msg.type === 'detail' && <StockCard stock={msg.stock} />}

      {msg.type === 'confirm' && (
        <div className="p-4 rounded-2xl bg-gray-50 dark:bg-[#1f1f1f] text-sm w-full ring-1 ring-black/5 dark:ring-white/5">
          <p className="mb-3 text-gray-800 dark:text-gray-200">
            Подтверждаешь покупку 1 акции <strong>{msg.stock.ticker}</strong> за <strong>~{msg.stock.price} ₽</strong>?
          </p>
          <span className="text-xs text-gray-500 mb-3 flex items-center gap-1"><ShieldCheck size={12} /> Решение за тобой. Это не ИИР.</span>
          <div className="flex gap-2 mt-2">
            <button onClick={confirmTrade} className="flex-1 bg-yellow-400 text-black font-bold py-2 rounded-xl hover:bg-yellow-500 transition-colors">Подтверждаю</button>
            <button onClick={cancelStock} className="flex-1 bg-gray-200 dark:bg-white/10 text-gray-800 dark:text-white py-2 rounded-xl hover:opacity-90 transition-opacity">Отмена</button>
          </div>
        </div>
      )}

      {msg.type === 'pendingConfirm' && msg.order && (
        <OrderCard order={msg.order} onConfirm={() => confirmOrder(msg.order)} onDismiss={() => dismissOrder(msg.order)} />
      )}
    </div>
  );
}
