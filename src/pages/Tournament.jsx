import { useMemo, useState, useEffect } from 'react';
import { ArrowLeft, Trophy, TrendingUp, TrendingDown, UserPlus, Copy, Check, Trash2, Link2, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useQuotes } from '../hooks/useQuotes';
import { fmtChange1 } from '../utils/format';
import { useUserStore } from '../store/userStore';

// Соревнование между друзьями, которых приглашаешь сам.
// Доходность: моя — по реальным котировкам портфеля; друзей — по реальной
// дневной доходности «их» тикера (привязка детерминированная, но данные настоящие).
// Приглашённые сохраняются в userData.friendInvites (persist в сторе).

const FRIEND_TICKERS = ['SBER', 'ROSN', 'LKOH', 'GAZP', 'TATN', 'GMKN', 'MTSS', 'PLZL'];

// Простой строковый хеш (djb2) → стабильная часть кода от имени.
// Плюс случайное число, чтобы одноимённые пользователи получали разные коды.
function hashName(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) >>> 0;
  return h;
}

function makeInviteCode(name) {


  const clean = (name || 'TS').replace(/[^a-zA-Zа-яА-Я0-9]/g, '').toUpperCase().slice(0, 4) || 'TS';
  const hash = hashName(name || 'TS') % 900;          // 0..899
  const rand = Math.floor(Math.random() * 90 + 10);   // 10..99
  // Вид: ИВАН-348 (префикс из имени + 3 цифры: часть хеша и случайность).
  return `${clean}-${String(hash + rand).padStart(3, '0').slice(-3)}`;
}

export default function Tournament({ userData, updateUserData, trackEvent }) {
  const navigate = useNavigate();
  const [input, setInput] = useState('');
  const [copied, setCopied] = useState(false);

  const friends = useMemo(() => userData.friendInvites || [], [userData.friendInvites]);
  // Код стабилен на сессию для одного имени: рандомный суффикс считаем ОДИН раз,
  // иначе код менялся бы на каждом ре-рендере. useMemo ключ — имя.
  const myCode = useMemo(() => makeInviteCode(userData.name), [userData.name]);
  const stocks = useMemo(() => userData.portfolioStocks || [], [userData.portfolioStocks]);

  // Тикеры для котировок: только портфель пользователя + тикеры друзей.
  // Ничего лишнего не грузим; если пусто — запрос не уходит.
  const tickers = useMemo(() => {
    const set = new Set();
    stocks.forEach((s) => s.ticker && set.add(s.ticker));
    friends.forEach((_, i) => set.add(FRIEND_TICKERS[i % FRIEND_TICKERS.length]));
    return [...set];
  }, [stocks, friends]);

  const { byTicker, loading } = useQuotes(tickers);

  // Моя дневная доходность: средневзвешенная change по бумагам портфеля.
  const myReturn = useMemo(() => {
    if (!stocks.length) return userData.profitability || 0;
    let weighted = 0;
    let wsum = 0;
    for (const s of stocks) {
      const ch = byTicker[s.ticker]?.change;
      if (ch != null) {
        weighted += ch * (s.price || 1);
        wsum += (s.price || 1);
      }
    }
    return wsum > 0 ? Number((weighted / wsum).toFixed(2)) : 0;
  }, [stocks, byTicker, userData.profitability]);

  const leaderboard = useMemo(() => {
    const all = [
      ...friends.map((f, i) => {
        const ticker = FRIEND_TICKERS[i % FRIEND_TICKERS.length];
        const ch = byTicker[ticker]?.change;
        return { name: f.name, ticker, return: ch != null ? ch : 0, isYou: false };
      }),
      { name: userData.name, return: myReturn, isYou: true },
    ].sort((a, b) => b.return - a.return);
    return all.map((u, i) => ({ ...u, place: i + 1 }));
  }, [friends, myReturn, userData.name, byTicker]);

  const myPlace = leaderboard.find((u) => u.isYou)?.place ?? '—';
  const fmt = fmtChange1;

  // Победа (1-е место при ≥2 участниках) открывает наряд «Чемпион».
  const setTournamentBestPlace = useUserStore((s) => s.setTournamentBestPlace);
  const syncOutfits = useUserStore((s) => s.syncOutfits);
  useEffect(() => {
    if (leaderboard.length >= 2 && myPlace === 1) {
      setTournamentBestPlace(1);
      syncOutfits();
    }
  }, [myPlace, leaderboard.length, setTournamentBestPlace, syncOutfits]);

  const addFriend = (e) => {
    e.preventDefault();
    const name = input.trim();
    if (name.length < 2) return;
    if (friends.some((f) => f.name.toLowerCase() === name.toLowerCase())) {
      setInput('');
      return;
    }
    updateUserData?.({ ...userData, friendInvites: [...friends, { name, joinedAt: Date.now() }] });
    trackEvent?.(`Приглашён друг: ${name}`);
    setInput('');
  };

  const removeFriend = (name) => {
    updateUserData?.({ ...userData, friendInvites: friends.filter((f) => f.name !== name) });
    trackEvent?.(`Удалён друг: ${name}`);
  };

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(myCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
      trackEvent?.('Скопирован инвайт-код');
    } catch {
      // clipboard может быть недоступен — молча игнорируем
    }
  };

  return (
    <div className="page-container page-container--narrow">
      <header className="flex items-center gap-4 mb-6">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-full transition-colors text-gray-900 dark:text-white">
          <ArrowLeft size={24} />
        </button>
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">Дружеский вызов</h1>
        {loading && <Loader2 size={16} className="animate-spin text-yellow-500" />}
      </header>

      <div className="bg-linear-to-br from-yellow-400 to-orange-500 rounded-3xl p-6 text-black mb-6 text-center">
        <Trophy size={48} className="mx-auto mb-3 opacity-80" />
        <h2 className="text-xl font-bold mb-1">Пригласи друзей и соревнуйся</h2>
        <p className="text-sm font-medium opacity-90">Соревнование только между теми, кого пригласил ты сам.</p>
        <div className="mt-4 bg-black/10 rounded-2xl p-4 inline-block">
          <p className="text-xs uppercase font-bold opacity-70 mb-1">Твое место</p>
          <p className="text-4xl font-bold">{myPlace} <span className="text-base font-normal">/ {leaderboard.length}</span></p>
        </div>
      </div>

      <div className="p-4 rounded-2xl bg-white dark:bg-[#1e1e1e] border border-gray-100 dark:border-gray-800 mb-4">
        <p className="text-xs font-bold text-gray-500 mb-2 flex items-center gap-1"><Link2 size={14} /> Твой инвайт-код</p>
        <div className="flex items-center gap-2">
          <code className="flex-1 px-3 py-2 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white font-bold tracking-wider text-sm">{myCode}</code>
          <button onClick={copyCode} className="px-3 py-2 rounded-xl bg-yellow-400 text-black font-bold text-sm flex items-center gap-1 hover:bg-yellow-500 transition-colors">
            {copied ? <><Check size={16} /> Ок</> : <><Copy size={16} /> Копировать</>}
          </button>
        </div>
      </div>

      <form onSubmit={addFriend} className="flex gap-2 mb-6">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Имя друга или инвайт-код"
          className="flex-1 p-3 rounded-xl bg-white dark:bg-[#1e1e1e] border border-gray-200 dark:border-gray-800 outline-none focus:border-yellow-400 text-sm text-gray-900 dark:text-white"
        />
        <button type="submit" disabled={input.trim().length < 2} className="px-4 py-3 rounded-xl bg-yellow-400 text-black font-bold text-sm flex items-center gap-1 disabled:opacity-50 hover:bg-yellow-500 transition-colors">
          <UserPlus size={18} /> Пригласить
        </button>
      </form>

      <h3 className="text-lg font-bold mb-3 text-gray-900 dark:text-white">
        Участники ({leaderboard.length})
      </h3>
      <div className="space-y-2">
        {leaderboard.map((user) => (
          <div
            key={user.name + user.place}
            className={`flex justify-between items-center p-4 rounded-2xl border ${
              user.isYou
                ? 'bg-yellow-50 dark:bg-[#2a2416] border-yellow-400 dark:border-yellow-500/50'
                : 'bg-white dark:bg-[#1e1e1e] border-gray-100 dark:border-gray-800'
            }`}
          >
            <div className="flex items-center gap-4 min-w-0">
              <span className={`font-bold w-6 text-center shrink-0 ${user.place <= 3 ? 'text-yellow-500' : 'text-gray-400'}`}>
                {user.place}
              </span>
              <span className={`font-medium truncate ${user.isYou ? 'text-yellow-700 dark:text-yellow-400' : 'text-gray-900 dark:text-white'}`}>
                {user.name} {user.isYou && '(Вы)'}
                {user.ticker && <span className="text-xs text-gray-400 ml-1">{user.ticker}</span>}
              </span>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <div className={`flex items-center gap-1 font-bold ${user.return >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                {user.return >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                {fmt(user.return)}
              </div>
              {!user.isYou && (
                <button onClick={() => removeFriend(user.name)} className="p-1 text-gray-300 hover:text-red-500 transition-colors" aria-label="Удалить">
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {friends.length === 0 && (
        <p className="text-center text-sm text-gray-400 mt-6">
          Пока никого нет. Скопируй инвайт-код и отправь другу — добавь его выше, когда он согласится.
        </p>
      )}
    </div>
  );
}
