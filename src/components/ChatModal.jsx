// ChatModal — ТОЛЬКО рендер. Вся логика в hooks/useChat.js.
// Открытие чата: App.jsx прокидывает onClose/userData/executeTrade/trackEvent.
import { useRef, useState, useEffect } from 'react';
import { X, Send, ShieldCheck, TrendingUp, TrendingDown, Wallet, Sparkles, Check, Clock } from 'lucide-react';
import Mascot from './Mascot';
import Markdown from './Markdown';
import RiskPill from './ui/RiskPill';
import { useChat } from '../hooks/useChat';

export default function ChatModal({ onClose, userData, executeTrade, trackEvent }) {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef(null);

  const {
    activeOutfit, messages, isThinking, suggestedStocks, stockCards,
    sendMessage, selectStock, confirmTrade, confirmOrder, dismissOrder, cancelStock,
  } = useChat({ userData, executeTrade, trackEvent, open: true });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isThinking]);

  const onSubmit = (e) => {
    e.preventDefault();
    if (!input.trim() || isThinking) return;
    const text = input;
    setInput('');
    sendMessage(text);
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 backdrop-blur-md">
      <div className="w-full max-w-lg rounded-3xl p-5 flex flex-col h-[620px] max-h-[92vh] bg-white dark:bg-[#161616] border border-yellow-500/20 shadow-[0_0_60px_rgba(250,204,21,0.12)] overflow-hidden">

        {/* Шапка */}
        <div className="flex justify-between items-center mb-4 pb-4 border-b border-gray-100 dark:border-white/5">
          <div className="flex items-center gap-3">
            <div className="relative w-11 h-11 rounded-2xl bg-gradient-to-br from-yellow-400/25 to-orange-500/10 flex items-center justify-center shrink-0 ring-1 ring-yellow-500/30 shadow-[0_0_20px_rgba(250,204,21,0.25)]">
              <Mascot outfitId={activeOutfit} size={34} />
            </div>
            <div>
              <h3 className="font-bold text-lg text-gray-900 dark:text-white">Ти-Стартик</h3>
              <p className="text-[11px] text-green-500 flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" /> AI онлайн · песочница
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-700 dark:hover:text-white rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition-colors"><X size={22} /></button>
        </div>

        {/* Лента */}
        <div className="flex-1 overflow-y-auto mb-3 space-y-4 pr-1.5">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex items-start gap-2.5 ${msg.sender === 'user' ? 'justify-end' : ''}`}>
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

              {msg.type === 'detail' && (
                <div className="w-full bg-white dark:bg-[#1f1f1f] border border-gray-200 dark:border-white/8 rounded-2xl p-4 shadow-[0_0_24px_rgba(250,204,21,0.06)]">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h4 className="font-bold text-lg text-gray-900 dark:text-white flex items-center gap-2"><Sparkles size={16} className="text-yellow-500" />{msg.stock.name}</h4>
                      <p className="text-xs text-gray-500">{msg.stock.ticker}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-lg text-gray-900 dark:text-white">{msg.stock.price} ₽</p>
                      <p className="text-[10px] text-gray-500">за 1 акцию</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mb-3 text-xs bg-gray-50 dark:bg-[#141414] p-2 rounded-lg">
                    <TrendingUp size={14} className="text-yellow-500" />
                    <span className="text-gray-600 dark:text-gray-300">Колебания:</span>
                    <span className="font-bold text-gray-900 dark:text-white">{msg.stock.volatility}</span>
                  </div>
                  <div className="mb-3">
                    <p className="text-xs font-bold text-gray-900 dark:text-white mb-1 flex items-center gap-1"><ShieldCheck size={14} className="text-green-500" /> На что обратить внимание:</p>
                    <ul className="text-[11px] text-gray-600 dark:text-gray-400 space-y-1 list-disc pl-4">
                      {msg.stock.reasons.map((r, i) => <li key={i}>{r}</li>)}
                    </ul>
                  </div>
                  <div className="flex justify-between items-center bg-yellow-50 dark:bg-yellow-900/10 p-2 rounded-lg">
                    <span className="text-xs text-yellow-700 dark:text-yellow-500 flex items-center gap-1"><Wallet size={14} /> Цена входа:</span>
                    <span className="text-xs font-bold text-gray-900 dark:text-white">{msg.stock.price} ₽ / {msg.stock.lotPrice} ₽ (лот)</span>
                  </div>
                </div>
              )}

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
          ))}

          {isThinking && (
            <div className="flex items-start gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-[#fdf8eb] dark:bg-[#2a2416] flex items-center justify-center shrink-0 ring-1 ring-yellow-500/20">
                <Mascot outfitId={activeOutfit} size={24} />
              </div>
              <div className="px-4 py-3 rounded-2xl rounded-tl-sm bg-gray-50 dark:bg-[#1f1f1f] text-gray-500 text-sm ring-1 ring-black/5 dark:ring-white/5">
                Ти-Стартик печатает<span className="animate-pulse">…</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Ввод */}
        <form onSubmit={onSubmit} className="flex items-center gap-2 p-1.5 rounded-2xl bg-gray-100 dark:bg-[#1f1f1f] ring-1 ring-black/5 dark:ring-white/5 focus-within:ring-yellow-400/40 transition-all">
          <input
            type="text"
            placeholder="Написать сообщение…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="flex-1 bg-transparent outline-none px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-500"
          />
          <button type="submit" disabled={!input.trim() || isThinking} className="p-2.5 bg-gradient-to-br from-yellow-400 to-yellow-500 text-black rounded-xl hover:brightness-105 disabled:opacity-40 transition-all">
            <Send size={18} />
          </button>
        </form>
      </div>
    </div>
  );
}

// Карточка подготовленной заявки (из metadata).
function OrderCard({ order, onConfirm, onDismiss }) {
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
