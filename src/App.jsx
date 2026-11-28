import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import ErrorBoundary from './components/ErrorBoundary';
import Dashboard from './pages/Dashboard';
import Onboarding from './pages/Onboarding';
import Auth from './pages/Auth';
import { openSandboxAccount } from './services/invest';
import { getMe, putState } from './api/auth';
import { useUserStore } from './store/userStore';

const Market = lazy(() => import('./pages/Market'));
const Profile = lazy(() => import('./pages/Profile'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const Tournament = lazy(() => import('./pages/Tournament'));
const Story = lazy(() => import('./pages/Story'));
const Wardrobe = lazy(() => import('./pages/Wardrobe'));
const ChatModal = lazy(() => import('./components/ChatModal'));

function PageFallback() {
  return (
    <div className="min-h-[40vh] flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

export default function App() {
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [auth, setAuth] = useState('checking');
  const [authChecked, setAuthChecked] = useState(false);

  const userData = useUserStore((s) => s.userData);
  const isDark = useUserStore((s) => s.isDark);
  const setIsDark = useUserStore((s) => s.setIsDark);
  const hasHydrated = useUserStore((s) => s._hasHydrated);
  const onboardingDone = useUserStore((s) => s.onboardingDone);
  const serverUser = useUserStore((s) => s.serverUser);
  const completeOnboarding = useUserStore((s) => s.completeOnboarding);
  const trackEventAction = useUserStore((s) => s.trackEvent);
  const executeTradeAction = useUserStore((s) => s.executeTrade);
  const updateAvatarAction = useUserStore((s) => s.updateAvatar);
  const completeChapterAction = useUserStore((s) => s.completeChapter);
  const setSandboxAccountId = useUserStore((s) => s.setSandboxAccountId);
  const setUserDataAction = useUserStore((s) => s.setUserData);
  const syncOutfits = useUserStore((s) => s.syncOutfits);

  useEffect(() => {
    if (isDark) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [isDark]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await getMe();
        if (cancelled) return;
        if (data?.user) {

          setAuth('ok');
        } else {
          setAuth('required');
        }
      } catch (e) {
        if (e?.code === 'ACCOUNTS_DISABLED' || e?.status === 503) setAuth('disabled');
        else setAuth('required');
      } finally {
        if (!cancelled) setAuthChecked(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (hasHydrated && userData) syncOutfits();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasHydrated]);

  // ---- Авто-синхронизация прогресса с сервером (user_state) ----
  // Сохраняем «начинку» профиля (баланс/цели/песочница/достижения) в БД
  // (debounce), только когда пользователь авторизован. При входе на другом
  // устройстве Auth подтянет этот state из /api/me.
  const SYNC_FIELDS = [
    'balance', 'portfolio', 'portfolioStocks', 'deals', 'chaptersDone',
    'achievements', 'champion', 'unlockedOutfits', 'profitability', 'daysStreak',
    'goal', 'goalSum', 'sandboxAccountId', 'accountMode', 'cardMask',
    'activeOutfit', 'tournamentBestPlace', 'friendInvites', 'analytics',
  ];
  const lastSyncRef = useRef('');
  const syncTimerRef = useRef(null);

  useEffect(() => {
    if (auth !== 'ok' || !hasHydrated || !userData) return;
    const snapshot = {};
    for (const k of SYNC_FIELDS) if (userData[k] !== undefined) snapshot[k] = userData[k];
    const serialized = JSON.stringify(snapshot);
    if (serialized === lastSyncRef.current) return; // ничего не изменилось
    lastSyncRef.current = serialized;

    clearTimeout(syncTimerRef.current);
    syncTimerRef.current = setTimeout(() => {
      putState(snapshot).catch(() => { /* офлайн/ошибка — не мешаем игре */ });
    }, 1200);

    return () => clearTimeout(syncTimerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userData, auth, hasHydrated]);

  // Fallback-создание локального профиля, чтобы НЕ зацикливать онбординг:
  // - auth==='disabled' (аккаунты выключены на сервере): создаём локального игрока;
  // - auth==='ok', но данных нет (вошёл, а IndexedDB пустой): создаём из логина.
  useEffect(() => {
    if (!hasHydrated || !onboardingDone || userData) return;
    if (auth === 'disabled') {
      completeOnboarding('Инвестор', 'Просто попробовать');
    } else if (auth === 'ok') {
      completeOnboarding(serverUser?.username || 'Инвестор', 'Просто попробовать');
    }
  }, [hasHydrated, onboardingDone, userData, auth, serverUser, completeOnboarding]);

  const trackEvent = (eventName) => trackEventAction(eventName);

  const handleChapterComplete = (chapterId) => {
    completeChapterAction(chapterId);
    syncOutfits();
  };

  const openRealAccount = async () => {
    try {
      const accountId = await openSandboxAccount();
      setSandboxAccountId(accountId);
      trackEventAction('Создан счёт песочницы');
      return { ok: true, accountId };
    } catch (e) {
      console.warn('openRealAccount failed:', e.message);
      trackEventAction(`Ошибка открытия счёта: ${e.message}`);
      return { ok: false, reason: e.message };
    }
  };

  const executeTrade = (stock, price) => {
    executeTradeAction(stock, price);
    syncOutfits();
  };
  const updateAvatar = (base64) => updateAvatarAction(base64);

  if (!hasHydrated || !authChecked || auth === 'checking') {
    return (
      <div className={`min-h-screen flex items-center justify-center ${isDark ? 'bg-[#121212]' : 'bg-gray-50'}`}>
        <div className="w-10 h-10 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // === ВСЁ ВНУТРИ BrowserRouter ===
  return (
    <BrowserRouter>
      {/* 1. Если онбординг не пройден — показываем его. */}
      {!onboardingDone ? (
        <Onboarding />
      ) : auth === 'required' ? (
        /* 2. Если онбординг пройден, но не авторизован — Auth. */
        <Auth onAuthed={() => { setAuth('ok'); }} />
      ) : !userData ? (
        /* 3. Данных ещё нет — эффект выше создаст локальный профиль (без цикла онбординга). */
        <div className={`min-h-screen flex items-center justify-center ${isDark ? 'bg-[#121212]' : 'bg-gray-50'}`}>
          <div className="w-10 h-10 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        /* 4. Основное приложение. */
        <Suspense fallback={<PageFallback />}>
          <Routes>
            <Route path="/*" element={
              <Layout isDark={isDark} setIsDark={setIsDark} onOpenChat={() => { trackEvent('Открыт чат'); setIsChatOpen(true); }}>
                <Suspense fallback={<PageFallback />}>
                  <ErrorBoundary>
                    <Routes>
                      <Route path="/" element={<Dashboard userData={userData} onOpenChat={() => setIsChatOpen(true)} trackEvent={trackEvent} />} />
                      <Route path="/market" element={<Market onOpenChat={() => setIsChatOpen(true)} trackEvent={trackEvent} userData={userData} activeOutfit={userData?.activeOutfit} />} />
                      <Route path="/wardrobe" element={<Wardrobe />} />
                      <Route path="/profile" element={<Profile userData={userData} updateAvatar={updateAvatar} />} />
                      <Route path="/settings" element={<SettingsPage userData={userData} />} />
                      <Route path="/tournament" element={<Tournament userData={userData} updateUserData={setUserDataAction} trackEvent={trackEvent} />} />
                      <Route path="/story" element={
                        <Story
                          userData={userData}
                          trackEvent={trackEvent}
                          chaptersDone={userData.chaptersDone || []}
                          onChapterComplete={handleChapterComplete}
                          onOpenRealAccount={openRealAccount}
                        />
                      } />
                    </Routes>
                  </ErrorBoundary>
                </Suspense>
                {isChatOpen && (
                  <ErrorBoundary>
                    <Suspense fallback={null}>
                      <ChatModal onClose={() => setIsChatOpen(false)} userData={userData} executeTrade={executeTrade} trackEvent={trackEvent} />
                    </Suspense>
                  </ErrorBoundary>
                )}
              </Layout>
            } />
          </Routes>
        </Suspense>
      )}
    </BrowserRouter>
  );
}