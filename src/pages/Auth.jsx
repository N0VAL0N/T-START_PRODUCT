import { useState } from 'react';
import { Loader2, LogIn, UserPlus, AlertTriangle, Coins } from 'lucide-react';
import { login, register } from '../api/auth';

// Экран входа/регистрации.
// Поля сделаны браузерно-совместимыми: type/name/autoComplete — чтобы менеджеры
// паролей (Chrome/Safari/1Password) распознавали и предлагали сохранить пароль.
export default function Auth({ onAuthed }) {
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isRegister = mode === 'register';

  async function onSubmit(e) {
    e.preventDefault();
    if (loading) return;
    setError('');
    setLoading(true);
    try {
      const fn = isRegister ? register : login;
      const data = await fn(username, password);
      onAuthed?.(data.user);
    } catch (err) {
      setError(err.message || 'Не удалось выполнить вход.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50 dark:bg-[#0a0a0a]">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8 text-center">
          <div className="w-16 h-16 rounded-2xl bg-yellow-400 flex items-center justify-center mb-4 shadow-[0_0_30px_rgba(250,204,21,0.35)]">
            <Coins size={32} className="text-black" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {isRegister ? 'Создай аккаунт' : 'С возвращением'}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {isRegister ? 'Логин и пароль — без личных данных.' : 'Войди, чтобы продолжить путь.'}
          </p>
        </div>

        <form onSubmit={onSubmit} className="space-y-3" autoComplete="on">
          <label className="block">
            <span className="text-xs font-semibold text-gray-500 ml-1">Логин</span>
            <input
              type="text"
              name="username"
              id="username"
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck="false"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              placeholder="например, investor01"
              className="mt-1 w-full p-3 rounded-xl bg-white dark:bg-[#1e1e1e] border border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white outline-none focus:border-yellow-500 transition-colors"
            />
          </label>

          <label className="block">
            <span className="text-xs font-semibold text-gray-500 ml-1">Пароль</span>
            <input
              type="password"
              name="password"
              id="password"
              autoComplete={isRegister ? 'new-password' : 'current-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              placeholder="6+ символов"
              className="mt-1 w-full p-3 rounded-xl bg-white dark:bg-[#1e1e1e] border border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white outline-none focus:border-yellow-500 transition-colors"
            />
          </label>

          {error && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-red-500/10 text-red-500 text-sm">
              <AlertTriangle size={18} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-yellow-400 text-black font-bold py-3 rounded-xl hover:bg-yellow-500 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : isRegister ? <UserPlus size={18} /> : <LogIn size={18} />}
            {isRegister ? 'Зарегистрироваться' : 'Войти'}
          </button>
        </form>

        <button
          type="button"
          onClick={() => { setMode(isRegister ? 'login' : 'register'); setError(''); }}
          className="w-full mt-4 text-sm text-gray-500 hover:text-yellow-600 dark:hover:text-yellow-500 transition-colors"
        >
          {isRegister ? 'Уже есть аккаунт? Войти' : 'Нет аккаунта? Зарегистрироваться'}
        </button>
      </div>
    </div>
  );
}
