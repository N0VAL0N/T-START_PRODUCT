// Chat-клиент. Все запросы к ассистенту идут через бэкенд (/api/ai/chat):
//  - ключ DeepSeek скрыт на сервере,
//  - бэкенд сам подмешивает контекст песочницы (цены, портфель, заявки)
//    и дополняет ответ в зависимости от слов пользователя.

const API = '/api';

// Считаем настроенным; реальная проверка — /api/health на бэке.
export const isAiConfigured = () => true;

/**
 * Отправить диалог. Возвращает { text, metadata, pending? }.
 *  - text     — чистый текст без служебных [[TRADE:...]] (бэкенд их вырезает);
 *  - metadata — массив подготовленных заявок: [{ id, action, ticker, lots, price, estCost, ... }];
 *  - pending/orderId/ticker/lots — обратная совместимость (первая заявка).
 * userContext: { accountId, balance } — баланс нужен бэкенду для проверки средств.
 * @param {Array<{role,content}>} history
 * @param {object} userContext
 */
export async function askAssistant(history, userContext = {}) {
  const res = await fetch(`${API}/ai/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ history, userContext }),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`AI_ERROR_${res.status}: ${errText.slice(0, 200)}`);
  }
  const data = await res.json();
  if (!data?.text) throw new Error('AI_EMPTY_RESPONSE');
  // Нормализуем metadata к массиву (на случай старого бэка).
  if (!Array.isArray(data.metadata)) data.metadata = [];
  return data;
}
