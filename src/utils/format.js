// Общие форматтеры и валидаторы. Убирают дублирование по страницам.

/** Цена в рублях с разделителями: 5831 → "5 831 ₽". null → "—". */
export const fmtPrice = (price) =>
  price != null ? `${Number(price).toLocaleString('ru-RU')} ₽` : '—';

/** Изменение в процентах со знаком: 1.4 → "+1.4%", null → null. */
export const fmtChange = (change) =>
  change != null ? `${change >= 0 ? '+' : ''}${change}%` : null;

/** Изменение с округлением до 1 знака: 1.44 → "+1.4%". */
export const fmtChange1 = (change) =>
  `${change >= 0 ? '+' : ''}${Number(change).toFixed(1)}%`;

// ---------- Банковская карта ----------
/** Группировка номера по 4 цифры: 4276123456789012 → "4276 1234 5678 9012". */
export const formatCardNumber = (v) =>
  v.replace(/\D/g, '').slice(0, 16).replace(/(.{4})/g, '$1 ').trim();

/** Срок действия: 1226 → "12/26". */
export const formatExpiry = (v) => {
  const d = v.replace(/\D/g, '').slice(0, 4);
  return d.length >= 3 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
};

/** Проверка контрольной суммы номера карты (алгоритм Луна). */
export const luhnValid = (num) => {
  const digits = num.replace(/\D/g, '');
  if (digits.length < 13) return false;
  let sum = 0;
  let alt = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = Number(digits[i]);
    if (alt) { n *= 2; if (n > 9) n -= 9; }
    sum += n;
    alt = !alt;
  }
  return sum % 10 === 0;
};
