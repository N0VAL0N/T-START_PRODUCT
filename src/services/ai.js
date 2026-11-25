// Chat-клиент. Все запросы к ассистенту идут через бэкенд (/api/ai/chat):
//  - ключ DeepSeek скрыт на сервере,
//  - бэкенд сам подмешивает контекст песочницы (цены, портфель, заявки)
//    и дополняет ответ в зависимости от слов пользователя.

const API = '/api';

// Считаем настроенным; реальная проверка — /api/health на бэке.
export const isAiConfigured = () => true;

/**
 * Отправить диалог. Возвращает { text, mcp, pending }.
 * pending — если бэкенд подготовил заявку (id/тикер), фронт рисует кнопку подтверждения.
 * @param {Array<{role,content}>} history
 * @param {object} userContext  { accountId }
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
  return data; // { text, mcp, pending }
}
