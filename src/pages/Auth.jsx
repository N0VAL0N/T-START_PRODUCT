import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, LogIn, UserPlus, AlertTriangle, Eye, EyeOff } from 'lucide-react';

import { login, register, getMe } from '../api/auth';
import { useUserStore } from '../store/userStore';


export default function Auth({ onAuthed }) {
  const navigate = useNavigate();
  const [mode, setMode] = useState('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isRegister = mode === 'register';
  const setUser = useUserStore((s) => s.setUser);
  const setOnboardingDone = useUserStore((s) => s.setOnboardingDone);
  const completeOnboarding = useUserStore((s) => s.completeOnboarding);
  const setSandboxAccountId = useUserStore((s) => s.setSandboxAccountId);
  const setUserData = useUserStore((s) => s.setUserData);
  const hasUserData = useUserStore((s) => !!s.userData);

  async function onSubmit(e) {
    e.preventDefault();
    if (loading) return;
    if (isRegister && password !== confirmPassword) {
      setError('Пароли не совпадают');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const fn = isRegister ? register : login;
      const data = await fn(username, password);
      setUser(data.user);
      setOnboardingDone();

      // Подтягиваем «начинку» аккаунта (баланс/цели/песочница/достижения) с сервера.
      let serverState = null;
      try {
        const me = await getMe();
        if (me?.state && Object.keys(me.state).length) serverState = me.state;
      } catch { /* если не удалось — работаем локально */ }

      if (serverState) {
        // У аккаунта уже есть прогресс — восстанавливаем его (в т.ч. на новом устройстве).
        setUserData({
          ...(useUserStore.getState().userData || {}),
          name: data.user?.username || username,
          ...serverState,
        });
      } else if (!hasUserData) {
        // Первый вход, прогресса нет — создаём новое локальное состояние.
        completeOnboarding(data.user?.username || username, 'Просто попробовать');
      } else {
        // Локальные данные есть, серверных нет — сбрасываем счёт песочницы:
        // сервер выдаст персональный под текущего пользователя.
        setSandboxAccountId(null);
      }

      // Переключаем App на основное приложение (не ждём navigate).
      if (typeof onAuthed === 'function') onAuthed();
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.message || 'Не удалось выполнить вход.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0a0a0a]">
      {/* Двухколоночный макет на ПК: слева крупная форма, справа картинка с отступом. */}
      <div className="min-h-screen flex flex-col md:flex-row md:items-stretch">
        {/* Форма. На ПК занимает ~55%, масштаб крупнее. */}
        <div className="w-full md:w-[55%] flex items-center justify-center p-4 md:p-10">
          <div className="w-full max-w-md md:max-w-2xl">
            {/* Логотип */}
            <div className="flex justify-center md:justify-start mb-8">
              <div className="flex items-center gap-2">
                <span className="bg-gradient-to-br from-yellow-300 to-yellow-500 text-black px-2.5 py-1.5 md:px-3 md:py-2 rounded-lg md:rounded-xl font-bold text-lg md:text-2xl">T</span>
                <span className="text-xl md:text-3xl font-bold text-gray-900 dark:text-white">T-Start</span>
              </div>
            </div>

            {/* Приветствие (маскот — только на мобилке, на ПК он справа) */}
            <div className="flex flex-col items-center md:items-start text-center md:text-left mb-8">
              <h1 className="text-2xl md:text-4xl font-bold text-gray-900 dark:text-white mb-2">
                {isRegister ? 'Создай аккаунт' : 'С возвращением'}
              </h1>
              <p className="text-sm md:text-lg text-gray-500 mb-6">Учись. Анализируй. Инвестируй.</p>
              <img src="/assets/onboarding/cube-hello.png" alt="Mascot" className="w-32 h-32 object-contain md:hidden" />
            </div>

            <form onSubmit={onSubmit} className="space-y-3 md:space-y-5">
              <input
                type="text"
                placeholder="Логин"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full p-3 md:p-4 md:text-lg rounded-xl bg-white dark:bg-[#1e1e1e] border border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white outline-none focus:border-yellow-500"
                required
              />
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Пароль"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full p-3 md:p-4 md:text-lg pr-10 rounded-xl bg-white dark:bg-[#1e1e1e] border border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white outline-none focus:border-yellow-500"
                  required
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showPassword ? <EyeOff size={18} className="md:w-5 md:h-5" /> : <Eye size={18} className="md:w-5 md:h-5" />}
                </button>
              </div>

              {isRegister && (
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Подтвердите пароль"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full p-3 md:p-4 md:text-lg rounded-xl bg-white dark:bg-[#1e1e1e] border border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white outline-none focus:border-yellow-500"
                  required
                />
              )}

              {error && (
                <div className="flex items-start gap-2 p-3 md:p-4 rounded-xl bg-red-500/10 text-red-500 text-sm md:text-base">
                  <AlertTriangle size={18} className="shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <button type="submit" disabled={loading} className="w-full bg-gradient-to-r from-yellow-400 to-orange-500 text-black font-bold md:text-lg py-3 md:py-4 rounded-xl hover:brightness-110 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                {loading ? <Loader2 size={18} className="animate-spin md:w-5 md:h-5" /> : isRegister ? <UserPlus size={18} className="md:w-5 md:h-5" /> : <LogIn size={18} className="md:w-5 md:h-5" />}
                {isRegister ? 'Зарегистрироваться' : 'Войти'}
              </button>

              <p className="text-[11px] md:text-xs text-gray-500 text-center mt-4">
                Нажимая кнопку, вы соглашаетесь с условиями обработки персональных данных.
              </p>
            </form>

            <button
              type="button"
              onClick={() => { setMode(isRegister ? 'login' : 'register'); setError(''); }}
              className="w-full mt-4 text-sm md:text-base text-gray-500 hover:text-yellow-600 transition-colors"
            >
              {isRegister ? 'Уже есть аккаунт? Войти' : 'Нет аккаунта? Зарегистрироваться'}
            </button>
          </div>
        </div>

        {/* Картинка справа (только ПК). Прижата к правому краю с отступом ~7%. */}
        <div className="hidden md:flex md:w-[45%] items-center justify-center relative overflow-hidden">
          {/* Мягкое градиентное свечение для глубины */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_40%,rgba(250,204,21,0.18),transparent_60%)]" />
          <div className="relative w-full h-full flex items-center justify-end pr-[7%]">
            <img
              src="/assets/onboarding/cube-hello.png"
              alt="Mascot"
              className="object-contain w-[clamp(220px,28vw,560px)] max-h-[70vh] drop-shadow-[0_0_50px_rgba(250,204,21,0.25)] animate-[float_6s_ease-in-out_infinite]"
            />
          </div>
        </div>
      </div>
    </div>
  );
}