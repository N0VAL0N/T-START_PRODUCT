export function createDeposit({ config }) {
  const DEPOSIT_DAILY_LIMIT = config.DEPOSIT_DAILY_LIMIT;
  const depositUsage = new Map();
  const todayKey = () => new Date().toISOString().slice(0, 10);

  function getDepositStatus(userId) {
    const key = String(userId || 'anon');
    const rec = depositUsage.get(key);
    const today = todayKey();
    const used = rec && rec.date === today ? rec.used : 0;
    return { limit: DEPOSIT_DAILY_LIMIT, used, remaining: Math.max(0, DEPOSIT_DAILY_LIMIT - used) };
  }

  function registerDeposit(userId, amount) {
    const value = Math.round(Number(amount) || 0);
    if (value <= 0) throw new Error('BAD_AMOUNT');
    const key = String(userId || 'anon');
    const today = todayKey();
    const rec = depositUsage.get(key);
    const used = rec && rec.date === today ? rec.used : 0;
    if (used + value > DEPOSIT_DAILY_LIMIT) {
      const err = new Error('DEPOSIT_LIMIT_EXCEEDED');
      err.remaining = Math.max(0, DEPOSIT_DAILY_LIMIT - used);
      throw err;
    }
    depositUsage.set(key, { date: today, used: used + value });
    return { limit: DEPOSIT_DAILY_LIMIT, used: used + value, remaining: Math.max(0, DEPOSIT_DAILY_LIMIT - (used + value)) };
  }

  return { getDepositStatus, registerDeposit };
}