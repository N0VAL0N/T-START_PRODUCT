import { useEffect, useRef, useState } from 'react';
import { Coins, Plus, Gift, Loader2, AlertTriangle, ShieldCheck } from 'lucide-react';
import SettingsModal from './SettingsModal';
import { useUserStore } from '../store/userStore';
import { fetchDepositLimit, requestDeposit } from '../services/invest';

// Модалка пополнения баланса (виртуальные рубли песочницы).
// Два пути:
//  1) «Получить за задание» — фикс. награда (если задание доступно);
//  2) «Ввести свою сумму» — с дневным лимитом (по умолчанию 5000 ₽/день).
// Лимит проверяется на БЭКЕНДЕ (/api/deposit), здесь — только отображение и UX.
//
// onDeposit(amount) вызывается ТОЛЬКО после успешного прохождения серверной проверки.
// welcomeBonusRupees — награда за квест (задание). Если null — кнопка задания скрыта.

const PRESETS = [500, 1000, 5000];
const QUEST_REWARD = 1000; // «Получить за задание» — фиксированная награда

export default function DepositModal({ open, onClose, onDeposit, userData = null }) {
  const [custom, setCustom] = useState('');
  const [tab, setTab] = useState('own'); // 'own' | 'task'
  const [status, setStatus] = useState(null); // { limit, used, remaining }
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(null); // { amount, remaining }
  const [taskClaimed, setTaskClaimed] = useState(false);

  // Стабильный id пользователя для учёта лимита (имя достаточно для этого демо).
  const userId = userData?.name || 'anon';
  const trackEvent = useUserStore((s) => s.trackEvent);
  // Ключ «эпизода»: не даём повторно дёрнуть сервер при ре-рендерах/StrictMode,
  // пока модалку не закрыли и не открыли заново.
  const loadedKeyRef = useRef(null);

  // Подгружаем статус лимита при открытии (прошлый остаток мог устареть).
  useEffect(() => {
    if (!open) return;
    const key = `${userId}`;
    if (loadedKeyRef.current === key) return;
    loadedKeyRef.current = key;

    let cancelled = false;
    setError('');
    setDone(null);
    setTaskClaimed(false);
    setLoading(true);
    fetchDepositLimit(userId)
      .then((s) => { if (!cancelled) setStatus(s); })
      .catch(() => { if (!cancelled) setStatus({ limit: 5000, used: 0, remaining: 5000 }); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [open, userId]);

  // Сброс «эпизода» — когда модалку закрыли, при следующем открытии перезапросим.
  useEffect(() => {
    if (!open) loadedKeyRef.current = null;
  }, [open]);

  if (!open) return null;

  const remaining = status?.remaining ?? 0;
  const limit = status?.limit ?? 5000;

  const applyDeposit = async (amount, reason) => {
    const value = Math.round(Number(amount) || 0);
    if (value <= 0) return;
    setError('');
    setLoading(true);
    try {
      const res = await requestDeposit(userId, value, reason);
      setStatus({ limit: res.limit, used: res.used, remaining: res.remaining });
      setDone({ amount: value, remaining: res.remaining });
      setCustom('');
      onDeposit?.(value);
      trackEvent?.(`Пополнение ${reason === 'quest' ? 'за задание' : 'вручную'} на ${value} ₽`);
    } catch (e) {
      if (e.code === 'DEPOSIT_LIMIT_EXCEEDED') {
        setStatus((s) => ({ ...(s || { limit }), remaining: e.status?.remaining ?? 0 }));
        setError(e.message || `Дневной лимит исчерпан. Доступно: ${remaining} ₽.`);
      } else {
        setError(e.message || 'Не удалось пополнить баланс.');
      }
    } finally {
      setLoading(false);
    }
  };

  const claimTask = async () => {
    if (taskClaimed) return;
    await applyDeposit(QUEST_REWARD, 'quest');
    setTaskClaimed(true);
  };

  return (
    <SettingsModal title="Пополнение баланса" onClose={onClose}>
      <p className="text-sm text-gray-500 mb-3">
        Виртуальные рубли для тренировки сделок в песочнице. Реальные деньги не используются.
      </p>

      {/* Лимит на сегодня */}
      <div className="flex items-center justify-between text-xs mb-4 px-1">
        <span className="text-gray-500 flex items-center gap-1"><ShieldCheck size={14} className="text-green-500" /> Дневной лимит</span>
        <span className="font-semibold text-gray-700 dark:text-gray-300">{remaining.toLocaleString('ru-RU')} / {limit.toLocaleString('ru-RU')} ₽</span>
      </div>

      {/* Табы: за задание / своя сумма */}
      <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-gray-100 dark:bg-gray-800 mb-4">
        <button
          onClick={() => { setTab('task'); setError(''); setDone(null); }}
          className={`py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-1.5 transition-colors ${tab === 'task' ? 'bg-white dark:bg-[#1e1e1e] text-gray-900 dark:text-white shadow' : 'text-gray-500'}`}
        >
          <Gift size={16} /> За задание
        </button>
        <button
          onClick={() => { setTab('own'); setError(''); setDone(null); }}
          className={`py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-1.5 transition-colors ${tab === 'own' ? 'bg-white dark:bg-[#1e1e1e] text-gray-900 dark:text-white shadow' : 'text-gray-500'}`}
        >
          <Coins size={16} /> Своя сумма
        </button>
      </div>

      {done && (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-green-500/10 text-green-600 dark:text-green-400 text-sm mb-4">
          <ShieldCheck size={18} className="shrink-0 mt-0.5" />
          <span>Баланс пополнен на <strong>{done.amount.toLocaleString('ru-RU')} ₽</strong>. Остаток лимита: {done.remaining.toLocaleString('ru-RU')} ₽.</span>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-red-500/10 text-red-500 text-sm mb-4">
          <AlertTriangle size={18} className="shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {tab === 'task' ? (
        <div>
          <div className="rounded-xl bg-yellow-50 dark:bg-[#2a2416] border border-yellow-500/20 p-4 mb-4">
            <p className="text-sm font-bold text-gray-900 dark:text-white mb-1 flex items-center gap-1.5"><Gift size={16} className="text-yellow-500" /> Награда за задание</p>
            <p className="text-xs text-gray-500">Выполни задание дня и получи <strong>{QUEST_REWARD.toLocaleString('ru-RU')} ₽</strong> на тренировочный счёт.</p>
          </div>
          <button
            onClick={claimTask}
            disabled={loading || taskClaimed || remaining < QUEST_REWARD}
            className="w-full bg-yellow-400 text-black font-bold py-3 rounded-xl hover:bg-yellow-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : <Gift size={18} />}
            {taskClaimed ? 'Награда уже получена' : remaining < QUEST_REWARD ? 'Лимит исчерпан' : `Получить ${QUEST_REWARD.toLocaleString('ru-RU')} ₽`}
          </button>
        </div>
      ) : (
        <div>
          <div className="grid grid-cols-3 gap-2 mb-4">
            {PRESETS.map((p) => (
              <button
                key={p}
                onClick={() => applyDeposit(p, 'manual')}
                disabled={loading || p > remaining}
                className="py-3 rounded-xl bg-gray-100 dark:bg-gray-800 font-bold text-gray-900 dark:text-white hover:bg-yellow-100 dark:hover:bg-[#2a2416] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                +{p.toLocaleString('ru-RU')} ₽
              </button>
            ))}
          </div>

          <div className="flex gap-2">
            <input
              type="number"
              min="1"
              max={remaining || limit}
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              placeholder={`Своя сумма (до ${remaining.toLocaleString('ru-RU')})`}
              className="flex-1 p-3 rounded-xl bg-gray-100 dark:bg-gray-800 border-none outline-none text-gray-900 dark:text-white"
            />
            <button
              onClick={() => applyDeposit(custom, 'manual')}
              disabled={loading || !custom || Number(custom) <= 0 || Number(custom) > remaining}
              className="px-4 py-3 rounded-xl bg-yellow-400 text-black font-bold flex items-center gap-1 disabled:opacity-50 hover:bg-yellow-500 transition-colors"
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />} Пополнить
            </button>
          </div>
          {custom && Number(custom) > remaining && (
            <p className="text-xs text-red-500 mt-2">Больше остатка лимита ({remaining.toLocaleString('ru-RU')} ₽) за сегодня пополнить нельзя.</p>
          )}
        </div>
      )}

      <p className="flex items-center gap-2 text-xs text-gray-400 mt-4">
        <Coins size={14} /> Баланс хранится локально (IndexedDB); лимит проверяется на сервере.
      </p>
    </SettingsModal>
  );
}
