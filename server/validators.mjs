export function sanitizeTicker(value) {
  const t = String(value ?? '').trim().toUpperCase();
  if (!/^[A-Z]{1,10}$/.test(t)) throw new Error('BAD_TICKER');
  return t;
}
export function sanitizeLots(value) {
  const n = Number(value ?? 1);
  if (!Number.isInteger(n) || n < 1 || n > 10000) throw new Error('BAD_LOTS');
  return n;
}
export function sanitizeDirection(value) {
  const d = String(value ?? 'BUY').toUpperCase();
  if (d !== 'BUY' && d !== 'SELL') throw new Error('BAD_DIRECTION');
  return d;
}