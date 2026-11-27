import { useState } from 'react';
import { CreditCard, AlertCircle } from 'lucide-react';
import { formatCardNumber, formatExpiry, luhnValid } from '../utils/format';

// Форма привязки банковской карты (реальный счёт).
// Полностью автономна: локальный стейт полей + валидация.
// onSubmit(mask, raw) вызывается при валидных данных; mask — «•••• 4242».
// error — внешняя ошибка (например, с сервера), показывается сверху.
export default function CardForm({ onSubmit, error = '', submitLabel = 'Подключить реальный счёт' }) {
  const [form, setForm] = useState({ number: '', expiry: '', cvv: '', holder: '' });
  const [localError, setLocalError] = useState('');

  const submit = (e) => {
    e?.preventDefault?.();
    setLocalError('');
    const digits = form.number.replace(/\D/g, '');
    if (!luhnValid(digits)) return setLocalError('Проверь номер карты — он введён неверно.');
    if (!/^\d{2}\/\d{2}$/.test(form.expiry)) return setLocalError('Срок действия в формате ММ/ГГ.');
    if (!/^\d{3}$/.test(form.cvv)) return setLocalError('CVV — 3 цифры.');
    if (form.holder.trim().length < 2) return setLocalError('Укажи имя держателя карты.');

    // Храним ТОЛЬКО маску (никогда не CVV/полный номер).
    const mask = `•••• ${digits.slice(-4)}`;
    onSubmit?.(mask, { ...form, number: digits });
    setForm({ number: '', expiry: '', cvv: '', holder: '' });
  };

  const shownError = localError || error;

  return (
    <form onSubmit={submit}>
      <div className="space-y-3">
        <div>
          <label className="text-xs font-bold text-gray-500 mb-1 block">Номер карты</label>
          <input
            inputMode="numeric"
            value={form.number}
            onChange={(e) => setForm((f) => ({ ...f, number: formatCardNumber(e.target.value) }))}
            placeholder="0000 0000 0000 0000"
            className="w-full p-3 rounded-xl bg-gray-100 dark:bg-gray-800 outline-none text-gray-900 dark:text-white"
          />
        </div>
        <div className="flex gap-2">
          <div className="flex-1">
            <label className="text-xs font-bold text-gray-500 mb-1 block">Срок</label>
            <input
              inputMode="numeric"
              value={form.expiry}
              onChange={(e) => setForm((f) => ({ ...f, expiry: formatExpiry(e.target.value) }))}
              placeholder="ММ/ГГ"
              className="w-full p-3 rounded-xl bg-gray-100 dark:bg-gray-800 outline-none text-gray-900 dark:text-white"
            />
          </div>
          <div className="flex-1">
            <label className="text-xs font-bold text-gray-500 mb-1 block">CVV</label>
            <input
              inputMode="numeric"
              type="password"
              value={form.cvv}
              onChange={(e) => setForm((f) => ({ ...f, cvv: e.target.value.replace(/\D/g, '').slice(0, 3) }))}
              placeholder="•••"
              className="w-full p-3 rounded-xl bg-gray-100 dark:bg-gray-800 outline-none text-gray-900 dark:text-white"
            />
          </div>
        </div>
        <div>
          <label className="text-xs font-bold text-gray-500 mb-1 block">Имя держателя</label>
          <input
            value={form.holder}
            onChange={(e) => setForm((f) => ({ ...f, holder: e.target.value }))}
            placeholder="IVAN IVANOV"
            className="w-full p-3 rounded-xl bg-gray-100 dark:bg-gray-800 outline-none text-gray-900 dark:text-white"
          />
        </div>
      </div>

      {shownError && (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-red-500/10 text-red-500 text-sm mt-3">
          <AlertCircle size={18} className="shrink-0 mt-0.5" />
          <span>{shownError}</span>
        </div>
      )}

      <button
        type="submit"
        className="w-full bg-yellow-400 text-black font-bold py-3 rounded-xl hover:bg-yellow-500 transition-colors mt-4 flex items-center justify-center gap-2"
      >
        <CreditCard size={18} /> {submitLabel}
      </button>
      <p className="text-center text-[10px] text-gray-400 mt-3">
        Демонстрационный поток: реальное подключение к брокеру требует OAuth в проде.
      </p>
    </form>
  );
}
