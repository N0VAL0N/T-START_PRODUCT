// ChatModal — ТОЛЬКО рендер. Логика в hooks/useChat.js, части UI — в components/chat/*.
// Открытие чата: App.jsx прокидывает onClose/userData/executeTrade/trackEvent.
import { useRef, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Send } from 'lucide-react';
import Mascot from './Mascot';
import MessageBubble from './chat/MessageBubble';
import ThinkingBubble from './chat/ThinkingBubble';
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

  // Портал в <body> + z-[100]: модалку не перекрывает нижняя навигация (z-50).
  return createPortal(
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[100] p-4 backdrop-blur-md">
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
            <MessageBubble
              key={msg.id}
              msg={msg}
              activeOutfit={activeOutfit}
              suggestedStocks={suggestedStocks}
              stockCards={stockCards}
              selectStock={selectStock}
              confirmTrade={confirmTrade}
              cancelStock={cancelStock}
              confirmOrder={confirmOrder}
              dismissOrder={dismissOrder}
            />
          ))}

          {isThinking && <ThinkingBubble activeOutfit={activeOutfit} />}
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
    </div>,
    document.body,
  );
}

