import { httpJson } from './utils.mjs';
import { sanitizeLots } from './validators.mjs';

export function createAI({ config, invest }) {
  const AI_URL = config.AI_URL;
  const AI_KEY = config.AI_KEY;
  const MODEL = config.MODEL;

  const SYSTEM_PROMPT = `Ты — «Ти-Стартик», дружелюбный и живой ассистент-просветитель по инвестициям для новичков в приложении T-Start.
Общайся по-человечески, простым языком, дружелюбно и с лёгким юмором. Отвечай на вопросы про акции, риск, диверсификацию, как устроен рынок, помогай разобраться. Не будь сухим роботом: поддерживай беседу, задавай уточняющие вопросы, объясняй на понятных примерах. Пиши по-русски.

ФОРМАТ ОТВЕТА: пиши живым текстом. Можно использовать markdown для читаемости: **жирный** для важного, списки через «- » для перечислений. Без таблиц и без HTML.

ЖЁСТКОЕ ПРАВИЛО — НИКАКИХ ИНВЕСТИЦИОННЫХ РЕКОМЕНДАЦИЙ:
- НИКОГДА не говори «купи», «продай», «бери», «стоит купить», «лучше вложись в…» и любые побуждения к сделке.
- Вместо этого нейтрально просвещай: «ты можешь ознакомиться с активом, оценить риски и принять решение сам».
- Ты помогаешь РАЗОБРАТЬСЯ (что это за бумага, какие риски, как работает диверсификация), но выбор и ответственность — всегда за пользователем.
- Не давай прогнозов цены и не обещай доходность. Всегда уместно напоминать: «это не индивидуальная инвестиционная рекомендация».

Доступные в песочнице тикеры: SBER, GAZP, LKOH, YNDX, GMKN, TATN, MTSS, PLZL.

СЛУЖЕБНЫЙ МАРКЕР (только если САМ пользователь явно выразил намерение купить/продать, например: «купи SBER», «хочу взять 2 лота GAZP», «продай YNDX»):
в самом конце ответа добавь отдельной строкой служебный маркер СТРОГО в таком виде (без пояснений вокруг):
[[TRADE:{"action":"buy","ticker":"SBER","lots":1}]]
где action — "buy" или "sell", ticker — один из тикеров выше, lots — целое (если не указано — 1).
Это НЕ твоя рекомендация, а техническая фиксация желания пользователя. Точную цену НЕ называй — её подставит система.
Если пользователь просто спрашивает совета, обсуждает или болтает — маркер НЕ добавляй.
На «что купить?» отвечай без маркера и без побуждений: перечисли, как оценить актив, риски, диверсификацию — решение за пользователем.`;

  const TRADE_MARKER_G = /\[\[TRADE:\s*(\{[\s\S]*?\})\s*\]\]/gi;

  function splitTradeMarkers(raw) {
    if (!raw) return { text: '', metadata: [] };
    const metadata = [];
    for (const m of raw.matchAll(TRADE_MARKER_G)) {
      try {
        const parsed = JSON.parse(m[1]);
        if (parsed && parsed.ticker) {
          metadata.push({ action: parsed.action === 'sell' ? 'sell' : 'buy', ticker: String(parsed.ticker).toUpperCase(), lots: Number(parsed.lots) || 1 });
        }
      } catch {}
    }
    const text = raw.replace(TRADE_MARKER_G, '').replace(/\[\[\s*TRADE:[\s\S]*?\]\]/gi, '').replace(/\n{3,}/g, '\n\n').trim();
    return { text, metadata };
  }

  function fallbackIntent(text) {
    const lower = String(text || '').toLowerCase();
    const wanted = /куп|buy|взять|приобрест/.test(lower) ? 'buy' : /прод|sell|сбыть/.test(lower) ? 'sell' : null;
    const tk = lower.match(/\b(sber|gazp|lkoh|yndx|gmkn|tatn|mtss|plzl)\b/i);
    const ticker = tk ? tk[1].toUpperCase() : null;
    const lotsMatch = lower.match(/(\d+)\s*(лот|шт|акци)/);
    const lots = lotsMatch ? Number(lotsMatch[1]) : 1;
    if (wanted && ticker) return { action: wanted, ticker, lots };
    return null;
  }

  async function askAI(history) {
    const messages = [{ role: 'system', content: SYSTEM_PROMPT }, ...history];
    const data = await httpJson(`${AI_URL}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${AI_KEY}` },
      body: { model: MODEL, messages, max_tokens: 700, temperature: 0.6, stream: false },
    });
    const msg = data?.choices?.[0]?.message;
    return ((msg?.content ?? '').trim() || (msg?.reasoning_content ?? '').trim());
  }

  async function handleChat({ history = [], userContext = {} }) {
    const balance = Number(userContext?.balance);
    if (!AI_KEY || AI_KEY.startsWith('your-')) {
      return { text: 'ИИ временно недоступен (нет ключей на сервере). Попробуй позже.', metadata: [] };
    }
    let raw;
    try { raw = await askAI(history); }
    catch (e) { return { text: `Не получилось получить ответ ассистента (${e.message.slice(0, 80)}). Попробуй ещё раз.`, metadata: [] }; }

    const { text: cleanText, metadata: modelIntents } = splitTradeMarkers(raw);
    let intents = modelIntents;
    if (!intents.length) {
      const lastUser = [...history].reverse().find(m => m.role === 'user');
      const fb = fallbackIntent(lastUser?.content || '');
      if (fb) intents = [fb];
    }

    if (!intents.length) {
      return { text: cleanText || 'Привет! Я Ти-Стартик. Расскажу про акции и риски, помогу разобраться. Спрашивай!', metadata: [] };
    }

    const prepared = [];
    const notes = [];
    for (const intent of intents.slice(0, 5)) {
      let share, lots, action;
      try {
        share = await invest.resolveTradeableShare(intent.ticker);
        lots = sanitizeLots(intent.lots ?? 1);
        action = intent.action === 'sell' ? 'sell' : 'buy';
      } catch (e) {
        if (e.message === 'TICKER_NOT_ALLOWED') notes.push(`Бумаги ${String(intent.ticker).toUpperCase()} нет в списке торгуемых.`);
        else notes.push('Не понял, о какой бумаге речь — уточни тикер.');
        continue;
      }
      let quote;
      try { quote = await invest.getQuote(share.ticker); }
      catch { notes.push(`Не нашёл инструмент ${share.ticker}.`); continue; }
      if (quote.priceExact == null) { notes.push(`По ${share.ticker} сейчас нет данных по цене.`); continue; }
      const estCost = Math.round(quote.priceExact * quote.lot * lots);
      if (action === 'buy' && Number.isFinite(balance) && balance < estCost) {
        notes.push(`На ${share.ticker} не хватает: ${lots} лот(а) ~${estCost} ₽, а у тебя ${balance} ₽.`);
        continue;
      }
      const order = await prepareOrder({ ticker: share.ticker, lots, direction: action === 'buy' ? 'BUY' : 'SELL' });
      prepared.push({ id: order.id, action, ticker: order.ticker, lots: order.lots, lot: share.lot, quantity: order.quantity, price: quote.price, priceExact: quote.priceExact, estCost, direction: order.direction });
    }

    if (prepared.length) {
      const list = prepared.map(o => `- **${o.action === 'buy' ? 'Покупка' : 'Продажа'}** ${o.ticker}: ${o.lots} лот(а) (~${o.estCost} ₽)`).join('\n');
      const intro = cleanText ? `${cleanText}\n\n` : '';
      const notePart = notes.length ? `\n\n_${notes.join(' ')}_` : '';
      return {
        text: `${intro}Подготовил заявку на подтверждение:\n${list}${notePart}\n\nПроверь детали и подтверди — решение и ответственность за тобой. Это не индивидуальная инвестиционная рекомендация.`,
        metadata: prepared,
        pending: `${prepared[0].id} ${prepared[0].ticker} ${prepared[0].lots} лот(а)`,
        orderId: prepared[0].id, ticker: prepared[0].ticker, lots: prepared[0].lots,
      };
    }

    const reason = notes.length ? notes.join(' ') : 'Не получилось подготовить заявку.';
    return { text: `${cleanText ? cleanText + '\n\n' : ''}${reason}`, metadata: [] };
  }

  // Вспомогательная функция для orders
  async function prepareOrder({ ticker, lots, direction }) {
    return invest.resolveTradeableShare(ticker).then(() => {
      // В реальности здесь вызов orders.prepareOrder, но чтобы не было циклической зависимости,
      // мы импортируем orders снаружи. Пока используем заглушку.
      return { id: 'PO-0000', ticker, lots, direction };
    });
  }

  return { handleChat };
}