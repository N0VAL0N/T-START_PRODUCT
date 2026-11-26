import { useState, useEffect, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import ErrorBoundary from './components/ErrorBoundary';
import Dashboard from './pages/Dashboard';
import Onboarding from './pages/Onboarding';
import { openSandboxAccount } from './services/invest';
import { useUserStore } from './store/userStore';

// Тяжёлые страницы и чат грузим лениво — стартовый бандл меньше, первый экран быстрее.
const Market = lazy(() => import('./pages/Market'));
const Profile = lazy(() => import('./pages/Profile'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const Tournament = lazy(() => import('./pages/Tournament'));
const Story = lazy(() => import('./pages/Story'));
const Wardrobe = lazy(() => import('./pages/Wardrobe'));
const ChatModal = lazy(() => import('./components/ChatModal'));

// Плейсхолдер на время подгрузки ленивого чанка.
function PageFallback() {
  return (
    <div className="min-h-[40vh] flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

export default function App() {
  const [isChatOpen, setIsChatOpen] = useState(false);

  // Глобальный стейт из Zustand (persist в IndexedDB).
  const userData = useUserStore((s) => s.userData);
  const isDark = useUserStore((s) => s.isDark);
  const setIsDark = useUserStore((s) => s.setIsDark);
  const hasHydrated = useUserStore((s) => s._hasHydrated);

  // Действия — стабильные селекторы (Zustand возвращает те же ссылки).
  const completeOnboarding = useUserStore((s) => s.completeOnboarding);
  const trackEventAction = useUserStore((s) => s.trackEvent);
  const executeTradeAction = useUserStore((s) => s.executeTrade);
  const updateAvatarAction = useUserStore((s) => s.updateAvatar);
  const completeChapterAction = useUserStore((s) => s.completeChapter);
  const setSandboxAccountId = useUserStore((s) => s.setSandboxAccountId);
  const setUserDataAction = useUserStore((s) => s.setUserData);
  const resetAccountAction = useUserStore((s) => s.resetAccount);
  const syncOutfits = useUserStore((s) => s.syncOutfits);

  // Тема → класс на <html>.
  useEffect(() => {
    if (isDark) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [isDark]);

  // После загрузки данных — пересчитать открытые наряды по уже заработанным
  // достижениям (сделки/портфель/главы могли быть получены до появления нарядов).
  useEffect(() => {
    if (hasHydrated && userData) syncOutfits();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasHydrated]);

  // Событие аналитики (лимит 50 событий — внутри стора).
  const trackEvent = (eventName) => trackEventAction(eventName);
  const handleOnboardingComplete = (name, goal) => {
    completeOnboarding(name, goal);
    // После регистрации сразу создаём (или переиспользуем) демо-счёт песочницы.
    // Не блокируем UI: если бэкенд недоступен — просто попробуем позже из настроек.
    openSandboxAccount()
      .then((accountId) => {
        setSandboxAccountId(accountId);
        trackEventAction('Счёт песочницы создан при регистрации');
      })
      .catch((e) => {
        console.warn('auto sandbox on onboarding failed:', e.message);
        trackEventAction(`Не удалось создать счёт при регистрации: ${e.message}`);
      });
  };

  const handleChapterComplete = (chapterId) => {
    completeChapterAction(chapterId);
    // Прохождение главы может открыть наряд — пересчитываем.
    syncOutfits();
  };

  // Открытие счёта Т-Инвест (песочница): бэкенд переиспользует существующий счёт.
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

  // Сброс аккаунта: чистит данные и возвращает онбординг (без перезагрузки страницы).
  const resetAccount = () => {
    resetAccountAction();
  };

  const executeTrade = (stock, price) => {
    executeTradeAction(stock, price);
    // Сделка может открыть наряд «Трейдер» и др.
    syncOutfits();
  };
  const updateAvatar = (base64) => updateAvatarAction(base64);

  // Пока IndexedDB не прочитан — показываем экран загрузки, а НЕ онбординг,
  // иначе при обновлении страницы мелькает онбординг и «пропадает».
  if (!hasHydrated) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${isDark ? 'bg-[#121212]' : 'bg-gray-50'}`}>
        <div className="w-10 h-10 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!userData) {
    return <Onboarding onComplete={handleOnboardingComplete} isDark={isDark} setIsDark={setIsDark} />;
  }

  return (
    <BrowserRouter>
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
                    <Route path="/settings" element={<SettingsPage userData={userData} onResetAccount={resetAccount} />} />
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
    </BrowserRouter>
  );
}