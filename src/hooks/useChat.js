// ===== useChat: вся логика ИИ-чата =====
// Вынесено из ChatModal.jsx. Здесь: сообщения, отправка (askAssistant),
// обработка metadata-заявок (handleOrderConfirm), детерминированный fallback,
// ручная покупка из карточки (confirmTrade), подбор карточек (handleSelectStock).
// Компонент ChatModal остаётся только рендером.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useUserStore } from '../store/userStore';
import { askAssistant, isAiConfigured } from '../services/ai';
import { tradeByTicker, openSandboxAccount } from '../services/invest';
import { useQuotes } from './useQuotes';
import { SUGGEST_TICKERS, CHOICE_PHRASES, toStockCard } from '../data/chatCards';

// Уникальный id сообщений (Date.now() может совпасть при пакетной вставке).
let __msgSeq = 0;
const nextMsgId = () => `${Date.now()}-${__msgSeq++}`;

const WANTS_STOCKS_RE = /куп|рубл|акци|вложить|лот/i;

export function useChat({ userData, executeTrade, trackEvent, open = true }) {
  const activeOutfit = useUserStore((s) => s.userData?.activeOutfit);
  const [messages, setMessages] = useState([
    { id: 1, sender: 'ai', type: 'text', text: 'Привет! Я **Ти-Стартик**. Помогу разобраться с акциями и рисками. Спроси, например: «Расскажи про SBER» или «Хочу взять 1 лот GAZP».' },
  ]);
  const [isThinking, setIsThinking] = useState(false);
  const [selectedStock, setSelectedStock] = useState(null);
  const [suggestedStocks, setSuggestedStocks] = useState([]);
  const [suggestActive, setSuggestActive] = useState(false);

  // Котировки для подборки — грузим ТОЛЬКО когда нужны (suggestActive).
  const { byTicker } = useQuotes(suggestActive ? SUGGEST_TICKERS : []);
  const stockCards = useMemo(
    () => SUGGEST_TICKERS.map((t) => toStockCard(byTicker[t])).filter((s) => s.price != null),
    [byTicker]
  );

  // При закрытии чата — сбрасываем подборку (и прекращаем лишние запросы котировок).
  const prevOpen = useRef(open);
  useEffect(() => {
    if (prevOpen.current && !open) setSuggestActive(false);
    prevOpen.current = open;
  }, [open]);

  const pushAiText = (text) =>
    setMessages((prev) => [...prev, { id: nextMsgId(), sender: 'ai', type: 'text', text }]);

  // --- Детерминированный fallback (без AI или при сбое) ---
  const runFallback = (userText) => {
    const lower = userText.toLowerCase();
    setSuggestActive(true);
    setTimeout(() => {
      if (WANTS_STOCKS_RE.test(lower)) {
        pushAiText('Вот пара бумаг с реального рынка — можно посмотреть на параметры и риски. Детали ниже.');
        setTimeout(() => {
          setSuggestedStocks(stockCards);
          setMessages((prev) => [...prev, { id: nextMsgId(), sender: 'ai', type: 'stocks' }]);
        }, 800);
      } else {
        pushAiText('Я помогаю разобраться с акциями и сделками в песочнице. Спроси что угодно — например, «что такое риск?» или «хочу взять SBER».');
      }
    }, 500);
  };

  // --- Отправка сообщения ---
  const sendMessage = async (rawText) => {
    const userText = String(rawText ?? '').trim();
    if (!userText || isThinking) return;

    const userMsg = { id: nextMsgId(), sender: 'user', type: 'text', text: userText };
    setMessages((prev) => [...prev, userMsg]);

    const wantsStocks = WANTS_STOCKS_RE.test(userText);
    if (wantsStocks) setSuggestActive(true);

    if (!isAiConfigured()) { runFallback(userText); return; }

    setIsThinking(true);
    try {
      const history = [...messages.filter((m) => m.type === 'text'), userMsg]
        .map((m) => ({ role: m.sender === 'user' ? 'user' : 'assistant', content: m.text }));

      const result = await askAssistant(history, {
        accountId: userData?.sandboxAccountId,
        balance: Number(userData?.balance) || 0,
      });

      if (result?.text) pushAiText(result.text);

      const orders = Array.isArray(result?.metadata) ? result.metadata : [];
      if (orders.length) {
        setMessages((prev) => [
          ...prev,
          ...orders.map((o) => ({ id: nextMsgId(), sender: 'ai', type: 'pendingConfirm', order: o })),
        ]);
      } else if (wantsStocks && stockCards.length) {
        setSuggestedStocks(stockCards);
        setMessages((prev) => [...prev, { id: nextMsgId(), sender: 'ai', type: 'stocks' }]);
      }
    } catch (err) {
      console.warn('AI unavailable, fallback:', err.message);
      runFallback(userText);
    } finally {
      setIsThinking(false);
    }
  };

  // --- Выбор акции из подборки (карточка + предложение купить) ---
  const selectStock = (stock) => {
    setSelectedStock(stock);
    setMessages((prev) => [...prev, { id: nextMsgId(), sender: 'user', type: 'text', text: `Расскажи про ${stock.ticker}` }]);

    setTimeout(() => {
      pushAiText(CHOICE_PHRASES[Math.floor(Math.random() * CHOICE_PHRASES.length)]);
      setTimeout(() => {
        setMessages((prev) => [...prev, { id: nextMsgId(), sender: 'ai', type: 'detail', stock }]);
      }, 700);
      setTimeout(() => {
        setMessages((prev) => [...prev, { id: nextMsgId(), sender: 'ai', type: 'confirm', stock }]);
      }, 1800);
    }, 400);
  };

  // --- Ручная покупка из карточки (confirm) ---
  const confirmTrade = async () => {
    const stock = selectedStock;
    if (!stock) return;

    if (userData.balance < stock.price) {
      pushAiText(`**Недостаточно средств.** У тебя ${userData.balance} ₽, а акция стоит ~${stock.price} ₽. Это не рекомендация — просто факт по балансу.`);
      setSelectedStock(null);
      return;
    }

    executeTrade(stock, stock.price);
    trackEvent?.(`Сделка в песочнице ${stock.ticker}`);

    let note = '';
    if (userData.sandboxAccountId) {
      try {
        const r = await tradeByTicker(userData.sandboxAccountId, { ticker: stock.ticker, lots: 1, direction: 'BUY', confirm: true });
        note = r.executed ? ' Заявка исполнена в песочнице T-Invest.' : ' Заявка сохранена и уйдёт, когда появится возможность.';
      } catch (e) {
        console.warn('sandbox order failed:', e.message);
        note = ' (песочница недоступна, прогресс сохранён локально).';
      }
    }
    pushAiText(`✅ Сделка совершена: 1 акция **${stock.ticker}** за ~${stock.price} ₽.${note}`);
    setSelectedStock(null);
  };

  // --- Подтверждение заявки из metadata (без требования регистрации) ---
  const confirmOrder = async (order) => {
    if (!order) return;
    let accountId = userData?.sandboxAccountId;

    if (!accountId) {
      try {
        accountId = await openSandboxAccount();
        useUserStore.getState().setSandboxAccountId(accountId);
      } catch (e) {
        pushAiText(`Не удалось открыть демо-счёт (${e.message}). Попробуй позже.`);
        return;
      }
    }

    try {
      const r = await tradeByTicker(accountId, {
        ticker: order.ticker,
        lots: order.lots,
        direction: order.action === 'sell' ? 'SELL' : 'BUY',
        confirm: true,
      });
      if (r.executed) {
        if (order.action !== 'sell') {
          executeTrade({ ticker: order.ticker, name: order.ticker }, order.estCost || 0);
        }
        trackEvent?.(`Сделка в песочнице ${order.ticker}`);
        pushAiText(`✅ Заявка **${order.id}** исполнена: ${order.action === 'buy' ? 'куплено' : 'продано'} ${order.lots} лот(а) ${order.ticker}.`);
      } else {
        pushAiText(`Заявку **${order.id}** сейчас выполнить не удалось, но она сохранена и уйдёт автоматически, когда появится возможность.`);
      }
    } catch (e) {
      pushAiText(`Не получилось отправить заявку (${e.message}). Она сохранена — повторим позже.`);
    }
  };

  const dismissOrder = (order) => {
    pushAiText(`Ок, заявку ${order?.ticker ? `по ${order.ticker} ` : ''}не отправляю. Если передумаешь — просто скажи.`);
  };

  const cancelStock = () => setSelectedStock(null);

  return {
    activeOutfit,
    messages,
    isThinking,
    selectedStock,
    suggestedStocks,
    stockCards,
    sendMessage,
    selectStock,
    confirmTrade,
    confirmOrder,
    dismissOrder,
    cancelStock,
  };
}
