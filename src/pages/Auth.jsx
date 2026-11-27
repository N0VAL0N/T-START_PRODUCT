import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, LogIn, UserPlus, AlertTriangle, Eye, EyeOff } from 'lucide-react';
import { login, register } from '../api/auth';
import { useUserStore } from '../store/userStore';

export default function Auth() {
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
      // Создаём локальное состояние игрока только при первом входе,
      // чтобы не затирать уже существующий прогресс.
      if (!hasUserData) completeOnboarding(data.user?.username || username, 'Просто попробовать');
      navigate('/');
    } catch (err) {
      setError(err.message || 'Не удалось выполнить вход.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50 dark:bg-[#0a0a0a]">
      <div className="w-full max-w-md">
        {/* Логотип сверху по центру */}
        <div className="flex justify-center mb-8">
          <div className="flex items-center gap-2">
            <span className="bg-gradient-to-br from-yellow-300 to-yellow-500 text-black px-2 py-1 rounded-lg font-bold">T</span>
            <span className="text-xl font-bold text-gray-900 dark:text-white">T-Start</span>
          </div>
        </div>

        {/* Приветствие и маскот */}
        <div className="flex flex-col items-center text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            {isRegister ? 'Создай аккаунт' : 'С возвращением'}
          </h1>
          <p className="text-sm text-gray-500 mb-6">
            Учись. Анализируй. Инвестируй.
          </p>
          <img src="/assets/onboarding/cube-hello.png" alt="Mascot" className="w-32 h-32 object-contain" />
        </div>

        <form onSubmit={onSubmit} className="space-y-3">
          <input
            type="text"
            placeholder="Логин"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full p-3 rounded-xl bg-white dark:bg-[#1e1e1e] border border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white outline-none focus:border-yellow-500"
            required
          />
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="Пароль"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-3 pr-10 rounded-xl bg-white dark:bg-[#1e1e1e] border border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white outline-none focus:border-yellow-500"
              required
            />
            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          {isRegister && (
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="Подтвердите пароль"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full p-3 rounded-xl bg-white dark:bg-[#1e1e1e] border border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white outline-none focus:border-yellow-500"
              required
            />
          )}

          {error && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-red-500/10 text-red-500 text-sm">
              <AlertTriangle size={18} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <button type="submit" disabled={loading} className="w-full bg-gradient-to-r from-yellow-400 to-orange-500 text-black font-bold py-3 rounded-xl hover:brightness-110 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
            {loading ? <Loader2 size={18} className="animate-spin" /> : isRegister ? <UserPlus size={18} /> : <LogIn size={18} />}
            {isRegister ? 'Зарегистрироваться' : 'Войти'}
          </button>

          {/* Согласие на обработку */}
          <p className="text-[11px] text-gray-500 text-center mt-4">
            Нажимая кнопку, вы соглашаетесь с условиями обработки персональных данных.
          </p>
        </form>

        <button
          type="button"
          onClick={() => { setMode(isRegister ? 'login' : 'register'); setError(''); }}
          className="w-full mt-4 text-sm text-gray-500 hover:text-yellow-600 transition-colors"
        >
          {isRegister ? 'Уже есть аккаунт? Войти' : 'Нет аккаунта? Зарегистрироваться'}
        </button>
      </div>
    </div>
  );
}