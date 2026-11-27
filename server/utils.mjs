export const toQ = (value) => ({
  currency: 'rub',
  units: String(Math.floor(value)),
  nano: Math.round((value - Math.floor(value)) * 1e9),
});
export const fromQ = (q) => q ? Number(q.units || 0) + Number(q.nano || 0) / 1e9 : 0;

export async function httpJson(url, { method = 'GET', headers = {}, body } = {}) {
  const payload = body ? JSON.stringify(body) : undefined;
  const res = await fetch(url, {
    method,
    headers: { ...(payload ? { 'Content-Type': 'application/json' } : {}), ...headers },
    body: payload,
    signal: AbortSignal.timeout(8500),
  });
  const text = await res.text();
  const json = text ? JSON.parse(text) : {};
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
  return json;
}

export function sanitizeHistory(history) {
  if (!Array.isArray(history)) return [];
  return history.slice(-30)
    .filter(m => m && (m.role === 'user' || m.role === 'assistant' || m.role === 'system'))
    .map(m => ({ role: m.role, content: String(m.content ?? '').slice(0, 4000) }));
}