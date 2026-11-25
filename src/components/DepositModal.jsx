import { useState } from 'react';
import { Coins, Plus } from 'lucide-react';
import SettingsModal from './SettingsModal';

// Модалка пополнения баланса (виртуальные рубли песочницы).
// Кнопки-пресеты + кнопка "пополнить на 1000 ₽". Пополнение — через колбэк onDeposit(amount).
const PRESETS = [500, 1000, 5000];

export default function DepositModal({ open, onClose, onDeposit }) {
  const [custom, setCustom] = useState('');

  if (!open) return null;

  const deposit = (amount) => {
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) return;
    onDeposit?.(Math.round(value));
    setCustom('');
  };

  return (
    <SettingsModal title="Пополнение баланса" onClose={onClose}>
      <p className="text-sm text-gray-500 mb-4">
        Виртуальные рубли для тренировки сделок в песочнице. Реальные деньги не используются.
      </p>

      <div className="grid grid-cols-3 gap-2 mb-4">
        {PRESETS.map((p) => (
          <button
            key={p}
            onClick={() => deposit(p)}
            className="py-3 rounded-xl bg-gray-100 dark:bg-gray-800 font-bold text-gray-900 dark:text-white hover:bg-yellow-100 dark:hover:bg-[#2a2416] transition-colors"
          >
            +{p.toLocaleString('ru-RU')} ₽
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        <input
          type="number"
          min="1"
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          placeholder="Своя сумма"
          className="flex-1 p-3 rounded-xl bg-gray-100 dark:bg-gray-800 border-none outline-none text-gray-900 dark:text-white"
        />
        <button
          onClick={() => deposit(custom)}
          disabled={!custom || Number(custom) <= 0}
          className="px-4 py-3 rounded-xl bg-yellow-400 text-black font-bold flex items-center gap-1 disabled:opacity-50 hover:bg-yellow-500 transition-colors"
        >
          <Plus size={18} /> Пополнить
        </button>
      </div>

      <p className="flex items-center gap-2 text-xs text-gray-400 mt-4">
        <Coins size={14} /> Баланс хранится локально (IndexedDB).
      </p>
    </SettingsModal>
  );
}
