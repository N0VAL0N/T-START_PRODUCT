// Оценка «реальной готовности» пользователя к торгам в реальных рублях
// на основе аналитики кликов/событий (analytics в userData).
// Идея ментора: не пускать к реальному счёту того, кто просто «тыкал»,
// а предложить его тем, кто показал осмысленное поведение.

// Веса различных событий. Чем «осмысленнее» действие — тем больше вклад.
const EVENT_WEIGHTS = {
  'Открыт чат': 1,
  'Открыт чат ассистента': 1,
  'Таймфрейм': 0,            // просто смотрел — не считаем
  'Фильтр': 0,
  'Кнопка Пополнить': 2,
  'Сделка в песочнице': 5,
  'Глава пройдена': 4,
  'Квиз верно': 3,
  'Квиз неверно': 0,
};

const READINESS_THRESHOLD = 20; // порог для разблокировки «открыть реальный счёт»

/**
 * Считает метрики готовности.
 * @param {Array<{event: string, time: string}>} analytics
 * @param {object} extra  дополнительные признаки (deals, главы и т.п.)
 */
export function computeReadiness(analytics = [], extra = {}) {
  let score = 0;
  const breakdown = {};

  for (const entry of analytics) {
    const base = entry.event in EVENT_WEIGHTS ? entry.event : null;
    // события вида "Сделка в песочнице SBER" матчим по префиксу
    let key = base;
    if (!key) {
      const match = Object.keys(EVENT_WEIGHTS).find(k => entry.event?.startsWith(k));
      key = match || null;
    }
    if (key) {
      const w = EVENT_WEIGHTS[key];
      score += w;
      breakdown[key] = (breakdown[key] || 0) + w;
    }
  }

  // Признаки из данных: реальные демо-сделки и пройденные главы
  const deals = extra.deals || 0;
  const chaptersDone = extra.chaptersDone || 0;
  score += deals * 5 + chaptersDone * 4;

  const ready = score >= READINESS_THRESHOLD;

  return {
    score,
    threshold: READINESS_THRESHOLD,
    progress: Math.min(Math.round((score / READINESS_THRESHOLD) * 100), 100),
    ready,
    breakdown,
    // человекочитаемое объяснение — почему не пускаем / почему пускаем
    reason: ready
      ? 'Похоже, ты реально разобрался и готов к настоящим сделкам.'
      : 'Пока это похоже на «пробу пера». Потренируйся в песочнице и пройди главы, чтобы открыть реальный счёт.',
  };
}
