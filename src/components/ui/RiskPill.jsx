// Единый индикатор риска. Используется в Market (вариант "dot") и ChatModal ("solid").
// Принимает нормализованный level: 'Низкий' | 'Умеренный' | 'Высокий' (или null/undefined).
//
// variant:
//  - 'dot'   — маленькая точка + подпись (как в списке рынка);
//  - 'solid' — залитая пилюля (как в карточках чата).
const LEVELS = {
  'Низкий': { dot: 'bg-green-500', text: 'text-green-600 dark:text-green-400', bg: 'bg-green-500/10', solid: 'bg-green-500/15 text-green-600 dark:text-green-400' },
  'Умеренный': { dot: 'bg-yellow-500', text: 'text-yellow-600 dark:text-yellow-400', bg: 'bg-yellow-500/10', solid: 'bg-yellow-500/15 text-yellow-600 dark:text-yellow-400' },
  'Высокий': { dot: 'bg-red-500', text: 'text-red-600 dark:text-red-400', bg: 'bg-red-500/10', solid: 'bg-red-500/15 text-red-600 dark:text-red-400' },
};

// Плюральные формы из toStockCard («Низкие/Умеренные/Высокие») → единственное число.
const NORMALIZE = {
  'Низкие': 'Низкий', 'Умеренные': 'Умеренный', 'Высокие': 'Высокий',
  'Низкий': 'Низкий', 'Умеренный': 'Умеренный', 'Высокий': 'Высокий',
};

export default function RiskPill({ level, variant = 'dot' }) {
  const key = NORMALIZE[level] || null;
  const s = key ? LEVELS[key] : null;

  if (variant === 'solid') {
    const cls = s ? s.solid : 'bg-gray-500/15 text-gray-500 dark:text-gray-400';
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${cls}`}>
        {key || 'риск н/д'}
      </span>
    );
  }

  const d = s || { dot: 'bg-gray-400', text: 'text-gray-500 dark:text-gray-400', bg: 'bg-gray-500/10' };
  return (
    <span className={`inline-flex items-center gap-1.5 text-[10px] font-medium px-2 py-0.5 rounded-full ${d.bg} ${d.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${d.dot}`} />
      {level || 'Риск н/д'}
    </span>
  );
}
