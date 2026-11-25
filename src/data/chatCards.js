// Данные и маппинг для карточек подборки в чате.
// Значения цен/риска приходят строго из /api/quotes — здесь только преобразование.

// Тикеры для карточки-подборки.
export const SUGGEST_TICKERS = ['SBER', 'ROSN', 'LKOH'];

// Фразы-реакции на выбор акции (лёгкий «человеческий» тон).
export const CHOICE_PHRASES = [
  'Отличный выбор! Эта акция показывает рекордные результаты в последнее время.',
  'Интересный вариант! Компания демонстрирует уверенный рост и хорошие дивиденды.',
  'Хорошее решение! Сейчас у этой бумаги сильные позиции на рынке.',
  'Неплохой выбор! Аналитики отмечают положительную динамику этой акции.',
];

const RISK_MAP = {
  'Низкий': { risk: 'Низкие', riskColor: 'text-green-500' },
  'Умеренный': { risk: 'Умеренные', riskColor: 'text-yellow-500' },
  'Высокий': { risk: 'Высокие', riskColor: 'text-red-500' },
};

/** Превращает реальную котировку API в «карточку» для чата. */
export function toStockCard(q) {
  const r = RISK_MAP[q?.riskLevel] || { risk: 'не оценён', riskColor: 'text-gray-400' };
  const price = q?.priceExact != null ? Math.round(q.priceExact) : (q?.price ?? null);
  return {
    ticker: q?.ticker,
    name: q?.name || q?.ticker,
    price,
    lot: q?.lot || 1,
    lotPrice: price != null && q?.lot ? Math.round(price * q.lot) : null,
    risk: r.risk,
    riskColor: r.riskColor,
    volatility: q?.volatility != null ? `±${q.volatility}%` : 'н/д',
    volatilityDesc: q?.riskNote || '',
    change: q?.change,
    reasons: [
      q?.volatility != null ? `Годовая волатильность ≈ ${q.volatility}%.` : 'Данных по волатильности нет.',
      q?.maxDrawdown != null ? `Максимальная просадка за 90 дней ≈ ${q.maxDrawdown}%.` : '',
      'Расчёт по истории цен, не является инвестиционной рекомендацией.',
    ].filter(Boolean),
  };
}
