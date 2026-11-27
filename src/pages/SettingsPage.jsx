import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Lock, Newspaper, Trophy, LogOut, FlaskConical, Headphones, Activity, Coins, CreditCard, ShieldCheck } from 'lucide-react';
import SettingsModal from '../components/SettingsModal';
import Toggle from '../components/Toggle';
import CardForm from '../components/CardForm';
import { useUserStore } from '../store/userStore';
import { logout as apiLogout } from '../api/auth';

export default function SettingsPage({ userData }) {
  const navigate = useNavigate();
  const [modalType, setModalType] = useState(null);

  const setBalance = useUserStore((s) => s.setBalance);
  const resetStoreAccount = useUserStore((s) => s.resetAccount);
  const setAccountMode = useUserStore((s) => s.setAccountMode);

  const isReal = userData.accountMode === 'real';

  // Пополнение баланса без перезагрузки страницы (через стор).
  const addBalance = (amount) => {
    setBalance((Number(userData.balance) || 0) + amount);
  };

  // Выход: закрываем серверную сессию (cookie), чистим локальный кэш и
  // возвращаемся к экрану входа. Перезагрузка нужна, чтобы App перечитал /api/me.
  const handleLogout = async () => {
    try { await apiLogout(); } catch { /* даже если сеть отвалилась — выходим локально */ }
    resetStoreAccount();
    window.location.assign('/');
  };

  // CardForm отдаёт (mask, raw) после собственной валидации — здесь только применяем режим.
  const activateRealAccount = (_mask, raw) => {
    const mask = `•••• ${raw.number.slice(-4)}`;
    setAccountMode('real', mask);
    setModalType(null);
  };

  const switchToSandbox = () => {
    setAccountMode('sandbox', null);
    setModalType(null);
  };

  return (
    <div className="page-container page-container--narrow">
      <header className="flex items-center gap-4 mb-8">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-full transition-colors text-gray-900 dark:text-white">
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Настройки</h1>
      </header>

      <div className="space-y-6">
        <div>
          <p className="text-xs font-bold text-gray-500 mb-2 px-2">АККАУНТ</p>
          <div onClick={() => setModalType('account')} className="p-4 rounded-2xl flex justify-between items-center bg-white dark:bg-[#1e1e1e] border border-gray-100 dark:border-gray-800 cursor-pointer hover:border-yellow-400 transition-colors">
            <div className="flex items-center gap-3 text-gray-900 dark:text-white">
              <CreditCard size={20} className="text-yellow-500" />
              <div>
                <p className="font-medium text-sm">Реальный счёт</p>
                <p className="text-xs text-gray-500">
                  {isReal ? `Подключён: ${userData.cardMask || 'реальный счёт'}` : 'Подключить Т-Инвестиции'}
                </p>
              </div>
            </div>
            <ChevronRight size={20} className="text-gray-400" />
          </div>
        </div>

        <div>
          <p className="text-xs font-bold text-gray-500 mb-2 px-2">БЕЗОПАСНОСТЬ</p>
          <div className="p-4 rounded-2xl flex justify-between items-center bg-white dark:bg-[#1e1e1e] border border-gray-100 dark:border-gray-800">
            <div className="flex items-center gap-3 text-gray-900 dark:text-white">
              <Lock size={20} />
              <div>
                <p className="font-medium text-sm">Face ID / Touch ID</p>
                <p className="text-xs text-gray-500">Вход по биометрии</p>
              </div>
            </div>
            <Toggle defaultChecked={true} />
          </div>
        </div>

        <div>
          <p className="text-xs font-bold text-gray-500 mb-2 px-2">УВЕДОМЛЕНИЯ</p>
          <div className="rounded-2xl overflow-hidden bg-white dark:bg-[#1e1e1e] border border-gray-100 dark:border-gray-800">
            <div className="p-4 flex justify-between items-center border-b border-gray-100 dark:border-gray-800">
              <div className="flex items-center gap-3 text-gray-900 dark:text-white">
                <Newspaper size={20} />
                <p className="font-medium text-sm">Новости рынка</p>
              </div>
              <Toggle defaultChecked={true} />
            </div>
            <div className="p-4 flex justify-between items-center">
              <div className="flex items-center gap-3 text-gray-900 dark:text-white">
                <Trophy size={20} />
                <p className="font-medium text-sm">Достижения</p>
              </div>
              <Toggle defaultChecked={true} />
            </div>
          </div>
        </div>

        <div>
          <p className="text-xs font-bold text-gray-500 mb-2 px-2">ПЕСОЧНИЦА (SANDBOX)</p>
          <div onClick={() => setModalType('sandbox')} className="p-4 rounded-2xl flex justify-between items-center bg-white dark:bg-[#1e1e1e] border border-gray-100 dark:border-gray-800 cursor-pointer hover:border-yellow-400 transition-colors">
            <div className="flex items-center gap-3 text-gray-900 dark:text-white">
              <FlaskConical size={20} />
              <div>
                <p className="font-medium text-sm">Демо-счёт</p>
                <p className="text-xs text-gray-500">Управление виртуальными средствами</p>
              </div>
            </div>
            <ChevronRight size={20} className="text-gray-400" />
          </div>
        </div>

        <div>
          <p className="text-xs font-bold text-gray-500 mb-2 px-2">АНАЛИТИКА</p>
          <div onClick={() => setModalType('analytics')} className="p-4 rounded-2xl flex justify-between items-center bg-white dark:bg-[#1e1e1e] border border-gray-100 dark:border-gray-800 cursor-pointer hover:border-yellow-400 transition-colors">
            <div className="flex items-center gap-3 text-gray-900 dark:text-white">
              <Activity size={20} />
              <div>
                <p className="font-medium text-sm">Лог действий</p>
                <p className="text-xs text-gray-500">Проверить, куда кликают пользователи</p>
              </div>
            </div>
            <ChevronRight size={20} className="text-gray-400" />
          </div>
        </div>

        <div>
          <p className="text-xs font-bold text-gray-500 mb-2 px-2">ПОМОЩЬ</p>
          <div onClick={() => setModalType('support')} className="p-4 rounded-2xl flex justify-between items-center bg-white dark:bg-[#1e1e1e] border border-gray-100 dark:border-gray-800 cursor-pointer hover:border-yellow-400 transition-colors">
            <div className="flex items-center gap-3 text-gray-900 dark:text-white">
              <Headphones size={20} />
              <div>
                <p className="font-medium text-sm">Написать в поддержку</p>
              </div>
            </div>
            <ChevronRight size={20} className="text-gray-400" />
          </div>
        </div>

        <button onClick={handleLogout} className="w-full p-4 rounded-2xl bg-red-500/10 text-red-500 font-bold flex items-center gap-3 hover:bg-red-500/20 transition-colors">
          <LogOut size={20} /> Выйти из аккаунта
        </button>
      </div>

      {modalType === 'account' && (
        <SettingsModal title={isReal ? 'Реальный счёт подключён' : 'Подключение реального счёта'} onClose={() => setModalType(null)}>
          {isReal ? (
            <>
              <div className="flex items-start gap-2 p-3 rounded-xl bg-green-500/10 text-green-600 dark:text-green-400 text-sm mb-4">
                <ShieldCheck size={18} className="shrink-0 mt-0.5" />
                <span>Реальный режим активен. Привязанная карта: <strong>{userData.cardMask || '•••• ••••'}</strong>. Сделки идут по реальным котировкам.</span>
              </div>
              <button onClick={switchToSandbox} className="w-full bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white font-bold py-3 rounded-xl hover:opacity-90 transition-colors">
                Вернуться в песочницу (демо)
              </button>
            </>
          ) : (
            <>
              <p className="text-sm text-gray-500 mb-4">
                Чтобы торговать реальными деньгами, привяжи банковскую карту. Данные карты проверяются и не хранятся на сервере — сохраняется только последние 4 цифры.
              </p>
              <CardForm onSubmit={activateRealAccount} />
            </>
          )}
        </SettingsModal>
      )}

      {modalType === 'sandbox' && (
        <SettingsModal title="Песочница" onClose={() => setModalType(null)}>
          <div className="text-center mb-6">
            <p className="text-sm text-gray-500 mb-2">Текущий баланс:</p>
            <p className="text-4xl font-bold text-yellow-500">{userData.balance} ₽</p>
          </div>
          <button onClick={() => {
            addBalance(1000);
            setModalType(null);
          }} className="w-full flex items-center justify-center gap-2 bg-yellow-400 text-black font-bold py-3 rounded-xl hover:bg-yellow-500 transition-colors">
            <Coins size={20} /> Получить 1000 ₽
          </button>
        </SettingsModal>
      )}

      {modalType === 'analytics' && (
        <SettingsModal title="Аналитика действий" onClose={() => setModalType(null)}>
          <div className="max-h-60 overflow-y-auto bg-gray-100 dark:bg-gray-800 p-3 rounded-xl text-xs space-y-2">
            {(userData.analytics || []).length === 0 ? <p className="text-gray-500">Пока пусто.</p> : null}
            {(userData.analytics || []).map((log, i) => (
              <div key={i} className="flex justify-between border-b border-gray-200 dark:border-gray-700 pb-1">
                <span className="font-medium text-gray-900 dark:text-gray-300">{log.event}</span>
                <span className="text-gray-500">{log.time}</span>
              </div>
            ))}
          </div>
        </SettingsModal>
      )}

      {modalType === 'support' && (
        <SettingsModal title="Поддержка" onClose={() => setModalType(null)}>
          <textarea placeholder="Ваше сообщение..." className="w-full h-32 p-3 rounded-xl bg-gray-100 dark:bg-gray-800 border-none outline-none resize-none mb-4 text-gray-900 dark:text-white"></textarea>
          <button className="w-full bg-yellow-400 text-black font-bold py-3 rounded-xl hover:bg-yellow-500 transition-colors" onClick={() => setModalType(null)}>Отправить</button>
        </SettingsModal>
      )}
    </div>
  );
}
