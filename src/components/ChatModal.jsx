import { useState, useRef, useEffect, useMemo } from 'react';
import { X, Send, ShieldCheck, TrendingUp, Wallet } from 'lucide-react';
import Mascot from './Mascot';
import { useUserStore } from '../store/userStore';
import { askAssistant, isAiConfigured } from '../services/ai';
import { tradeByTicker } from '../services/invest';
import { useQuotes } from '../hooks/useQuotes';
import { SUGGEST_TICKERS, CHOICE_PHRASES, toStockCard } from '../data/chatCards';

// Уникальный id для сообщений. Date.now() мог совпадать при вставке нескольких
// сообщений в одном тике (React ругался на одинаковые key), поэтому добавляем счётчик.
let __msgSeq = 0;
const nextMsgId = () => `${Date.now()}-${__msgSeq++}`;

export default function ChatModal({ onClose, userData, executeTrade, trackEvent }) {
  const activeOutfit = useUserStore((s) => s.userData?.activeOutfit);
  const [messages, setMessages] = useState([
    { id: 1, sender: 'ai', type: 'text', text: 'Привет! Я Ти-Стартик. Помогу собрать портфель. Спроси, например: "У меня есть 500 рублей, что купить?"' }
  ]);
  const [input, setInput] = useState('');

  const [selectedStock, setSelectedStock] = useState(null);
  const [suggestedStocks, setSuggestedStocks] = useState([]);
  const [isThinking, setIsThinking] = useState(false);
  const [suggestActive, setSuggestActive] = useState(false);
  const messagesEndRef = useRef(null);

  // Реальные котировки для карточки-подборки. Грузим ТОЛЬКО когда пользователь
  // реально попросил подобрать акции (suggestActive), а не при каждом открытии чата.
  const { byTicker } = useQuotes(suggestActive ? SUGGEST_TICKERS : []);
  const stockCards = useMemo(
    () => SUGGEST_TICKERS.map((t) => toStockCard(byTicker[t])).filter((s) => s.price != null),
    [byTicker]
  );

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  useEffect(() => { scrollToBottom(); }, [messages]);

  // Резервный детерминированный ответ (работает без AI и при его сбое)
  const runFallback = (userText) => {
    const lower = userText.toLowerCase();
    setSuggestActive(true);
    setTimeout(() => {
      if (lower.includes('купить') || lower.includes('рубл') || lower.includes('акци')) {
        // Карточку показываем сразу; данные подтянутся по мере загрузки котировок.
        setMessages(prev => [...prev, {
          id: nextMsgId(), sender: 'ai', type: 'text',
          text: 'Вот пара бумаг с реального рынка — можно потренироваться. Подробности по цене и риску ниже.'
        }]);
        setTimeout(() => {
          setSuggestedStocks(stockCards);
          setMessages(prev => [...prev, { id: nextMsgId(), sender: 'ai', type: 'stocks' }]);
        }, 800);
      } else {
        setMessages(prev => [...prev, { id: nextMsgId(), sender: 'ai', type: 'text', text: 'Я помогаю разобраться с акциями и сделками в песочнице. Спроси что угодно — например, «что такое риск?» или «купи SBER».' }]);
      }
    }, 500);
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim() || isThinking) return;

    const userText = input;
    const userMsg = { id: nextMsgId(), sender: 'user', type: 'text', text: userText };
    setMessages(prev => [...prev, userMsg]);
    setInput('');

    const wantsStocks = /купить|рубл|акци|вложить/i.test(userText);
    if (wantsStocks) setSuggestActive(true);

    // AI не настроен — сразу детерминированный сценарий
    if (!isAiConfigured()) {
      runFallback(userText);
      return;
    }

    // Запрос к модели через бэкенд (он сам подмешивает контекст песочницы)
    setIsThinking(true);
    try {
      const history = [...messages.filter(m => m.type === 'text'), userMsg]
        .map(m => ({ role: m.sender === 'user' ? 'user' : 'assistant', content: m.text }));

      const result = await askAssistant(history, { accountId: userData.sandboxAccountId });

      setMessages(prev => [...prev, { id: nextMsgId(), sender: 'ai', type: 'text', text: result.text }]);

      // Бэкенд подготовил заявку — показываем кнопку подтверждения
      if (result?.pending) {
        const m = result.pending.match(/(PO-\d+)/);
        const orderId = m ? m[1] : null;
        const tkMatch = result.pending.match(/\b(SBER|GAZP|LKOH|YNDX|GMKN|TATN|MTSS|PLZL)\b/i);
        const ticker = tkMatch ? tkMatch[1].toUpperCase() : null;
        setMessages(prev => [...prev, { id: nextMsgId(), sender: 'ai', type: 'pendingConfirm', text: result.pending, orderId, ticker }]);
      }

      if (wantsStocks && !result?.pending && stockCards.length) {
        setSuggestedStocks(stockCards);
        setMessages(prev => [...prev, { id: nextMsgId(), sender: 'ai', type: 'stocks' }]);
      }
    } catch (err) {
      console.warn('AI unavailable, fallback:', err.message);
      runFallback(userText);
    } finally {
      setIsThinking(false);
    }
  };

  const handleSelectStock = (stock) => {
    setSelectedStock(stock);
    setMessages(prev => [...prev, { id: nextMsgId(), sender: 'user', type: 'text', text: `Хочу купить ${stock.ticker}` }]);

    setTimeout(() => {
      const randomPhrase = CHOICE_PHRASES[Math.floor(Math.random() * CHOICE_PHRASES.length)];
      setMessages(prev => [...prev, { id: nextMsgId(), sender: 'ai', type: 'text', text: randomPhrase }]);

      setTimeout(() => {
        setMessages(prev => [...prev, { id: nextMsgId(), sender: 'ai', type: 'detail', stock }]);
      }, 800);

      setTimeout(() => {
        setMessages(prev => [...prev, { id: nextMsgId(), sender: 'ai', type: 'confirm', stock }]);
      }, 2000);
    }, 500);
  };

  const confirmTrade = async () => {
    const stock = selectedStock;
    if (!stock) return;

    if (userData.balance < stock.price) {
      setMessages(prev => [...prev, { id: nextMsgId(), sender: 'ai', type: 'text', text: `❌ Недостаточно средств. У тебя ${userData.balance} ₽, а акция стоит ${stock.price} ₽.` }]);
      setSelectedStock(null);
      return;
    }

    // Локальное списание (баланс приложения) + лог события
    executeTrade(stock, stock.price);
    trackEvent?.(`Сделка в песочнице ${stock.ticker}`);

    // Отправляем сделку на бэкенд → песочница T-Invest (если есть счёт)
    let sandboxNote = '';
    if (userData.sandboxAccountId) {
      try {
        const r = await tradeByTicker(userData.sandboxAccountId, { ticker: stock.ticker, lots: 1, direction: 'BUY', confirm: true });
        if (r.executed) {
          sandboxNote = ' Заказ отправлен в песочницу T-Invest.';
        } else {
          sandboxNote = ` Сейчас выполнить не удалось, но заявка ${r.order?.id || ''} сохранена и уйдёт, как только появится возможность.`;
          trackEvent?.(`Заявка отложена ${stock.ticker}`);
        }
      } catch (e) {
        console.warn('sandbox order failed:', e.message);
        sandboxNote = ' (песочница недоступна, но прогресс сохранён локально).';
      }
    }

    setMessages(prev => [...prev, { id: nextMsgId(), sender: 'ai', type: 'text', text: `✅ Сделка совершена! Ты купил 1 акцию ${stock.ticker} за ${stock.price} ₽.${sandboxNote}` }]);
    setSelectedStock(null);
  };

  // Подтверждение заявки, подготовленной моделью
  const handlePendingConfirm = async (orderId, ticker) => {
    if (!userData.sandboxAccountId) {
      setMessages(prev => [...prev, { id: nextMsgId(), sender: 'ai', type: 'text', text: 'Сначала нужно зарегистрировать профиль в Т-Инвест (песочница). Сделай это в разделе «Путешествие» или в настройках.' }]);
      return;
    }
    if (!ticker) {
      setMessages(prev => [...prev, { id: nextMsgId(), sender: 'ai', type: 'text', text: 'Не понял, какую акцию покупать. Напиши тикер, например: «купи SBER».' }]);
      return;
    }
    try {
      const r = await tradeByTicker(userData.sandboxAccountId, { ticker, lots: 1, direction: 'BUY', confirm: true });
      if (r.executed) {
        setMessages(prev => [...prev, { id: nextMsgId(), sender: 'ai', type: 'text', text: `✅ Заявка ${orderId || ''} исполнена в песочнице T-Invest.` }]);
      } else {
        setMessages(prev => [...prev, { id: nextMsgId(), sender: 'ai', type: 'text', text: `Заявку ${orderId || ''} сейчас выполнить не удалось, но она сохранена и уйдёт автоматически, когда появится возможность.` }]);
      }
    } catch (e) {
      setMessages(prev => [...prev, { id: nextMsgId(), sender: 'ai', type: 'text', text: `Не получилось отправить заявку (${e.message}). Она сохранена — повторим позже.` }]);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-3xl p-6 flex flex-col h-[600px] max-h-[90vh] bg-white dark:bg-[#1e1e1e] border border-gray-100 dark:border-gray-800">

        <div className="flex justify-between items-center mb-4 border-b pb-4 border-gray-100 dark:border-gray-800">
                    <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#fdf8eb] dark:bg-[#2a2416] rounded-xl flex items-center justify-center shrink-0">
              <Mascot outfitId={activeOutfit} size={32} />
            </div>
            <div>
              <h3 className="font-bold text-lg text-gray-900 dark:text-white">Ти-Стартик</h3>
              <p className="text-xs text-green-500 flex items-center gap-1"><span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span> AI Online</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"><X size={24} /></button>
        </div>

        <div className="flex-1 overflow-y-auto mb-4 space-y-4 pr-2">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex items-start gap-3 ${msg.sender === 'user' ? 'justify-end' : ''}`}>
              {msg.sender === 'ai' && (
                <div className="w-8 h-8 bg-[#fdf8eb] dark:bg-[#2a2416] rounded-lg flex items-center justify-center shrink-0">
                  <Mascot outfitId={activeOutfit} size={24} />
                </div>
              )}

              {msg.type === 'text' && (
                <div className={`p-4 rounded-2xl max-w-[85%] text-sm whitespace-pre-line ${msg.sender === 'user' ? 'bg-yellow-50 dark:bg-[#2a2416] text-gray-800 dark:text-yellow-100 rounded-tr-none' : 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded-tl-none'}`}>
                  {msg.text}
                </div>
              )}

              {/* Карточка со списком акций */}
              {msg.type === 'stocks' && (
                <div className="w-full">
                   <div className="grid grid-cols-1 gap-2 mb-2">
                     {(suggestedStocks.length ? suggestedStocks : stockCards).map(s => (
                       <div key={s.ticker} onClick={() => handleSelectStock(s)} className="p-3 bg-white dark:bg-[#2a2a2a] border border-gray-200 dark:border-gray-700 rounded-xl cursor-pointer hover:border-yellow-400 transition-colors flex justify-between items-center">
                         <div>
                           <p className="font-bold text-gray-900 dark:text-white">{s.ticker} <span className="text-xs text-gray-500 font-normal">{s.name}</span></p>
                           <p className={`text-[10px] ${s.riskColor}`}>Риск: {s.risk}</p>
                         </div>
                         <p className="font-bold text-gray-900 dark:text-white">{s.price} ₽</p>
                       </div>
                     ))}
                   </div>
                   <div className="bg-gray-50 dark:bg-[#1a1a1a] p-3 rounded-xl border border-gray-100 dark:border-gray-800">
                     <p className="text-[10px] text-gray-500 leading-tight mb-2">
                       <strong className="text-gray-700 dark:text-gray-300 block mb-1">Не является индивидуальной инвестиционной рекомендацией (ИИР).</strong>
                       Подборка собрана алгоритмом на основе открытых данных и не учитывает твои личные цели или склонность к риску. Решение о покупке ты принимаешь сам — любая бумага на бирже может как вырасти, так и упасть в цене.
                     </p>
                     <div className="flex gap-2 text-[10px] text-gray-500">
                       <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-green-500"></span> До 3% — Низкие</span>
                       <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-yellow-500"></span> 3-7% — Умеренные</span>
                       <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-orange-500"></span> &gt;7% — Заметные</span>
                     </div>
                   </div>
                </div>
              )}

              {/* Детальная карточка выбранной акции */}
              {msg.type === 'detail' && (
                <div className="w-full bg-white dark:bg-[#2a2a2a] border border-gray-200 dark:border-gray-700 rounded-2xl p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h4 className="font-bold text-lg text-gray-900 dark:text-white">{msg.stock.name}</h4>
                      <p className="text-xs text-gray-500">{msg.stock.ticker}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-lg text-gray-900 dark:text-white">{msg.stock.price} ₽</p>
                      <p className="text-[10px] text-gray-500">за 1 акцию</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 mb-3 text-xs bg-gray-50 dark:bg-[#1e1e1e] p-2 rounded-lg">
                    <TrendingUp size={14} className="text-gray-400" />
                    <span className="text-gray-600 dark:text-gray-300">Колебания:</span>
                    <span className="font-bold text-gray-900 dark:text-white">{msg.stock.volatility}</span>
                    <span className="text-gray-400">({msg.stock.volatilityDesc})</span>
                  </div>

                  <div className="mb-3">
                    <p className="text-xs font-bold text-gray-900 dark:text-white mb-1 flex items-center gap-1"><ShieldCheck size={14} className="text-green-500"/> Почему такой риск:</p>
                    <ul className="text-[11px] text-gray-600 dark:text-gray-400 space-y-1 list-disc pl-4">
                      {msg.stock.reasons.map((r, i) => <li key={i}>{r}</li>)}
                    </ul>
                  </div>

                  <div className="flex justify-between items-center bg-yellow-50 dark:bg-yellow-900/10 p-2 rounded-lg">
                    <span className="text-xs text-yellow-700 dark:text-yellow-500 flex items-center gap-1"><Wallet size={14}/> Цена входа:</span>
                    <span className="text-xs font-bold text-gray-900 dark:text-white">{msg.stock.price} ₽ / {msg.stock.lotPrice} ₽ (лот)</span>
                  </div>
                </div>
              )}

              {msg.type === 'confirm' && (
                <div className="p-4 rounded-2xl bg-gray-100 dark:bg-gray-800 text-sm w-full">
                  <p className="mb-3 text-gray-800 dark:text-gray-200">Подтверждаешь покупку 1 акции <strong>{msg.stock.ticker}</strong> за <strong>{msg.stock.price} ₽</strong>?<br/><span className="text-xs text-red-500 mt-2 block">Вы соглашаетесь со всеми рисками.</span></p>
                  <div className="flex gap-2">
                    <button onClick={confirmTrade} className="flex-1 bg-yellow-400 text-black font-bold py-2 rounded-xl">Подтверждаю</button>
                    <button onClick={() => setSelectedStock(null)} className="flex-1 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white py-2 rounded-xl">Отмена</button>
                  </div>
                </div>
              )}

              {/* Заявка, подготовленная моделью (ждёт подтверждения) */}
              {msg.type === 'pendingConfirm' && (
                <div className="p-4 rounded-2xl bg-yellow-50 dark:bg-[#2a2416] border border-yellow-200 dark:border-yellow-900/40 text-sm w-full">
                  <p className="mb-3 text-gray-800 dark:text-gray-200">{msg.text}</p>
                  <div className="flex gap-2">
                    <button onClick={() => handlePendingConfirm(msg.orderId, msg.ticker)} className="flex-1 bg-yellow-400 text-black font-bold py-2 rounded-xl">Подтвердить заявку</button>
                    <button onClick={() => setMessages(prev => [...prev, { id: nextMsgId(), sender: 'ai', type: 'text', text: 'Хорошо, заявку не отправляю. Если передумаешь — просто скажи.' }])} className="flex-1 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white py-2 rounded-xl">Позже</button>
                  </div>
                </div>
              )}
            </div>
          ))}
          {isThinking && (
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-[#fdf8eb] dark:bg-[#2a2416] rounded-lg flex items-center justify-center shrink-0">
                <Mascot outfitId={activeOutfit} size={24} />
              </div>
              <div className="p-4 rounded-2xl rounded-tl-none bg-gray-100 dark:bg-gray-800 text-gray-500 text-sm">
                Ти-Стартик печатает<span className="animate-pulse">...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <form onSubmit={handleSend} className="flex items-center gap-2 p-2 rounded-2xl bg-gray-100 dark:bg-gray-800">
          <input
            type="text"
            placeholder="Написать сообщение..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="flex-1 bg-transparent outline-none px-3 text-sm text-gray-900 dark:text-white placeholder-gray-500"
          />
          <button type="submit" className="p-2 bg-yellow-400 text-black rounded-xl hover:bg-yellow-500">
            <Send size={18} />
          </button>
        </form>
      </div>
    </div>
  );
}
