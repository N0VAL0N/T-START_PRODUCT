// ===== Глобальный стейт пользователя (Zustand + IndexedDB) =====
// - persist в IndexedDB (idb-keyval) вместо localStorage:
//   решает проблему тяжёлого base64-аватара и лимита localStorage (~5 МБ).
// - analytics ограничен последними 50 событиями (растёт бесконечно иначе).
// - инициализация защищена try/catch (битый стор не роняет приложение).
//
// Структура userData (совместима с прежним App.jsx):
//   { name, goal, avatar, balance, portfolio, deals, daysStreak,
//     profitability, analytics[], portfolioStocks[], chaptersDone[],
//     sandboxAccountId, friendInvites[] }
//
// userData === null → пользователь ещё не прошёл онбординг.

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { get, set, del } from 'idb-keyval';
import { initialOutfits, computeUnlocked } from '../data/outfits';

const ANALYTICS_LIMIT = 50;
const STORAGE_KEY = 't-start-data';

// ---------- Безопасное хранилище на основе IndexedDB ----------
// Оборачиваем idb-keyval: если браузер/режим не поддерживает IndexedDB —
// тихо откатываемся (данные просто не переживут перезагрузку, но UI живёт).
const idbStorage = {
  getItem: async (name) => {
    try {
      const value = await get(name);
      return value ?? null;
    } catch (e) {
      console.warn('[store] IndexedDB get failed, fallback to localStorage:', e?.message);
      try { return localStorage.getItem(name); } catch { return null; }
    }
  },
  setItem: async (name, value) => {
    try {
      await set(name, value);
    } catch (e) {
      console.warn('[store] IndexedDB set failed, fallback to localStorage:', e?.message);
      try { localStorage.setItem(name, value); } catch { /* ignore quota */ }
    }
  },
  removeItem: async (name) => {
    try {
      await del(name);
    } catch { /* ignore */ }
    try { localStorage.removeItem(name); } catch { /* ignore */ }
  },
};

// Лимит на размер массива аналитики (оставляем последние N событий).
function capAnalytics(list) {
  if (!Array.isArray(list)) return [];
  return list.length > ANALYTICS_LIMIT ? list.slice(-ANALYTICS_LIMIT) : list;
}

// Безопасно нормализуем userData после загрузки (защита от старого/битого формата).
function normalizeUserData(data) {
  if (!data || typeof data !== 'object') return null;
  // «пустой» онбординг — считаем не пройденным (как было в App.jsx)
  if (data.name === 'Пользователь') return null;
  return {
    name: data.name || 'Инвестор',
    goal: data.goal || 'Накопить на мечту',
    avatar: data.avatar || null,
    balance: Number(data.balance) || 0,
    portfolio: Number(data.portfolio) || 0,
    deals: Number(data.deals) || 0,
    daysStreak: Number(data.daysStreak) || 0,
    profitability: Number(data.profitability) || 0,
    analytics: capAnalytics(data.analytics),
    portfolioStocks: Array.isArray(data.portfolioStocks) ? data.portfolioStocks : [],
    chaptersDone: Array.isArray(data.chaptersDone) ? data.chaptersDone : [],
    sandboxAccountId: data.sandboxAccountId || null,
    friendInvites: Array.isArray(data.friendInvites) ? data.friendInvites : [],
    // 'sandbox' — тренировочный демо-счёт (по умолчанию), 'real' — подключён реальный счёт.
    accountMode: data.accountMode === 'real' ? 'real' : 'sandbox',
    // Маска карты для «реального» режима (напр. «•••• 4242»). Только маскированные данные.
    cardMask: data.cardMask || null,
    // ---------- наряды маскота ----------
    // Надетый сейчас наряд и список открытых (по умолчанию — только базовый).
    activeOutfit: typeof data.activeOutfit === 'string' ? data.activeOutfit : 'default',
    unlockedOutfits: Array.isArray(data.unlockedOutfits) ? data.unlockedOutfits : initialOutfits(),
    // Лучшее место в дружеском вызове (1 = победа → открывает наряд «Чемпион»).
    tournamentBestPlace: Number(data.tournamentBestPlace) || null,
  };
}

export const useUserStore = create(
  persist(
    (set) => ({
      userData: null,
      isDark: true,
      // true, когда persist закончил читать IndexedDB. До этого UI не должен
      // показывать онбординг — иначе будет «мигание» при обновлении страницы.
      _hasHydrated: false,
      setHasHydrated: (v) => set({ _hasHydrated: v }),

      // Кэш живых котировок (НЕ персистится — только текущая сессия).
      // Структура: { [ticker]: quote }. Источник — /api/quotes (реальный API).
      quotes: {},
      quotesLoading: false,
      quotesError: null,
      setQuotes: (quotes) => set({ quotes }),
      setQuotesStatus: (quotesLoading, quotesError = null) => set({ quotesLoading, quotesError }),

      // ---------- тема ----------
      setIsDark: (isDark) => set({ isDark }),
      toggleTheme: () => set((s) => ({ isDark: !s.isDark })),

      // ---------- онбординг ----------
      completeOnboarding: (name, goal) =>
        set({
          userData: {
            name,
            goal,
            avatar: null,
            balance: 1000,
            portfolio: 0,
            deals: 0,
            daysStreak: 0,
            profitability: 0,
            analytics: [],
            portfolioStocks: [],
            chaptersDone: [],
            sandboxAccountId: null,
            friendInvites: [],
            accountMode: 'sandbox',
            cardMask: null,
            activeOutfit: 'default',
            unlockedOutfits: initialOutfits(),
            tournamentBestPlace: null,
          },
        }),

      // ---------- аналитика (с лимитом) ----------
      trackEvent: (eventName) =>
        set((s) => {
          if (!s.userData) return s;
          const entry = { time: new Date().toLocaleTimeString(), event: eventName };
          return {
            userData: {
              ...s.userData,
              analytics: capAnalytics([...(s.userData.analytics || []), entry]),
            },
          };
        }),

      // ---------- сделки ----------
      executeTrade: (stock, price) =>
        set((s) => {
          if (!s.userData) return s;
          if (s.userData.balance < price) return s;
          return {
            userData: {
              ...s.userData,
              balance: s.userData.balance - price,
              portfolio: s.userData.portfolio + price,
              deals: s.userData.deals + 1,
              portfolioStocks: [...s.userData.portfolioStocks, { ...stock, price }],
              analytics: capAnalytics([
                ...(s.userData.analytics || []),
                { time: new Date().toLocaleTimeString(), event: `Куплена акция ${stock.ticker}` },
              ]),
            },
          };
        }),

      // ---------- профиль / главы / счёт ----------
      updateAvatar: (base64) =>
        set((s) => (s.userData ? { userData: { ...s.userData, avatar: base64 } } : s)),

      setBalance: (balance) =>
        set((s) => (s.userData ? { userData: { ...s.userData, balance } } : s)),

      setSandboxAccountId: (accountId) =>
        set((s) => (s.userData ? { userData: { ...s.userData, sandboxAccountId: accountId } } : s)),

      // Переключение режима счёта: 'sandbox' (демо) или 'real' (реальный, после ввода карты).
      setAccountMode: (mode, cardMask = null) =>
        set((s) => (s.userData
          ? { userData: { ...s.userData, accountMode: mode === 'real' ? 'real' : 'sandbox', cardMask } }
          : s)),

      completeChapter: (chapterId) =>
        set((s) => {
          if (!s.userData) return s;
          const done = s.userData.chaptersDone || [];
          if (done.includes(chapterId)) return s;
          return {
            userData: {
              ...s.userData,
              chaptersDone: [...done, chapterId],
              analytics: capAnalytics([
                ...(s.userData.analytics || []),
                { time: new Date().toLocaleTimeString(), event: `Глава пройдена ${chapterId}` },
              ]),
            },
          };
        }),

      // Замена части userData (для Tournament и точечных обновлений).
      patchUserData: (patch) =>
        set((s) => (s.userData ? { userData: { ...s.userData, ...patch } } : s)),

      // ---------- наряды маскота ----------
      // Надеть наряд (только если открыт).
      equipOutfit: (outfitId) =>
        set((s) => {
          if (!s.userData) return s;
          const unlocked = s.userData.unlockedOutfits || initialOutfits();
          if (!unlocked.includes(outfitId)) return s;
          return { userData: { ...s.userData, activeOutfit: outfitId } };
        }),

      // Пересчитать открытые наряды по достижениям и вернуть список новых.
      // Вызывается после значимых событий (глава, сделка, пополнение, турнир).
      syncOutfits: () => {
        let newly = [];
        set((s) => {
          if (!s.userData) return s;
          const { unlocked, newlyUnlocked } = computeUnlocked(s.userData);
          newly = newlyUnlocked;
          if (!newlyUnlocked.length) return s;
          return { userData: { ...s.userData, unlockedOutfits: unlocked } };
        });
        return newly;
      },

      // Сохранить лучшее место в турнире (1 = победа).
      setTournamentBestPlace: (place) =>
        set((s) => {
          if (!s.userData) return s;
          const prev = Number(s.userData.tournamentBestPlace) || null;
          const best = place && (!prev || place < prev) ? place : prev;
          return { userData: { ...s.userData, tournamentBestPlace: best } };
        }),

      // Полная замена (используется Tournament/Story, где передаётся весь объект).
      setUserData: (userData) => set({ userData: normalizeUserData(userData) }),

      // ---------- сброс ----------
      resetAccount: () => set({ userData: null }),
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => idbStorage),
      // Восстанавливаем только userData и тему; котировки не персистим.
      partialize: (state) => ({ userData: state.userData, isDark: state.isDark }),
      // Миграция/нормализация при загрузке + защита от битого стора.
      merge: (persisted, current) => {
        try {
          const p = persisted || {};
          return {
            ...current,
            isDark: typeof p.isDark === 'boolean' ? p.isDark : current.isDark,
            userData: normalizeUserData(p.userData),
          };
        } catch (e) {
          console.warn('[store] merge failed, resetting:', e?.message);
          return current;
        }
      },
      version: 1,
      // Флаг готовности persist: ставим true после чтения IndexedDB (успех или ошибка).
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated?.(true);
      },
    }
  )
);

export { ANALYTICS_LIMIT };
