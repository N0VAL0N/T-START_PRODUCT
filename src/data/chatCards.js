// Данные и маппинг для карточек подборки в чате.
// Значения цен/риска приходят строго из /api/quotes — здесь только преобразование.

// Тикеры для карточки-подборки.
export const SUGGEST_TICKERS = ['SBER', 'ROSN', 'LKOH'];

// Нейтральные фразы-реакции на выбор акции (без ИИР-побуждений «купи/отличный выбор»).
export const CHOICE_PHRASES = [
  'Ок, давай посмотрим на этот актив поближе — оценим параметры и риски.',
  'Хорошо, разберём эту бумагу: покажу, на что обратить внимание.',
  'Принято. Дальше — дело за тобой: оцени риски и прими решение осознанно.',
  'Сейчас подниму данные по этой акции, чтобы ты мог оценить риски сам.',
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
