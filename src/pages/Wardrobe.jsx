import { useState } from 'react';
import { Check, Lock, Sparkles, ArrowLeft, Trophy } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { OUTFITS, resolveOutfit, unlockLabel } from '../data/outfits';
import { useUserStore } from '../store/userStore';
import Mascot from '../components/Mascot';

// Гардероб Ти-Стартика. Наряды и условия открытия — из data/outfits.js.
// Открытые наряды можно надеть; закрытые показывают, как их получить.
export default function Wardrobe() {
  const navigate = useNavigate();

  // userData и действия берём прямо из стора (страница подключена к роутеру).
  const userData = useUserStore((s) => s.userData);
  const equipOutfit = useUserStore((s) => s.equipOutfit);
  const trackEvent = useUserStore((s) => s.trackEvent);

  const activeOutfitId = userData?.activeOutfit || 'default';
  const unlockedIds = Array.isArray(userData?.unlockedOutfits) ? userData.unlockedOutfits : ['default'];

  const [selectedOutfit, setSelectedOutfit] = useState(activeOutfitId);
  const currentOutfit = resolveOutfit(selectedOutfit);
  const isCurrentSelectedActive = activeOutfitId === selectedOutfit;
  const currentUnlocked = unlockedIds.includes(currentOutfit.id);

  // Клик по карточке = предпросмотр (в т.ч. закрытого наряда).
  const handleSelect = (outfit) => {
    setSelectedOutfit(outfit.id);
    trackEvent?.(`Предпросмотр наряда: ${outfit.name}`);
  };

  const handleApply = () => {
    if (!unlockedIds.includes(currentOutfit.id)) return;
    equipOutfit(currentOutfit.id);
    trackEvent?.(`Надет наряд: ${currentOutfit.name}`);
  };

  return (
    <div className="page-container page-container--default px-4">
      {/* Кнопка Назад */}
      <button
        onClick={() => navigate(-1)}
        className="mb-6 p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors text-gray-900 dark:text-white"
        aria-label="Назад"
      >
        <ArrowLeft size={24} />
      </button>

      <header className="text-center mb-8">
        <h1 className="text-3xl font-serif font-bold text-gray-900 dark:text-white mb-2">Гардероб</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">Выбери образ для своего Ти-Стартика</p>
      </header>

      {/* --- Витрина выбранного образа --- */}
      <div className="relative mb-12">
        <div className="absolute inset-0 bg-gradient-to-br from-yellow-400/20 via-orange-500/10 to-transparent rounded-3xl blur-2xl pointer-events-none" />

        <div className="relative flex flex-col items-center justify-center p-8 rounded-3xl bg-white/50 dark:bg-[#1e1e1e]/50 border border-yellow-500/30 dark:border-yellow-500/20 backdrop-blur-md shadow-[0_0_40px_rgba(250,204,21,0.1)]">
          <div className="relative w-48 h-48 md:w-64 md:h-64 mb-4">
            <Mascot outfitId={currentOutfit.id} size="100%" className="!w-full !h-full" />
            <Sparkles className="absolute top-0 right-0 text-yellow-500 w-6 h-6 animate-pulse" />
            <Sparkles className="absolute bottom-4 left-0 text-orange-500 w-4 h-4 animate-pulse delay-150" />
          </div>

          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">{currentOutfit.name}</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-6 text-center max-w-sm">{currentOutfit.desc}</p>

          {/* Действие: надето / надеть / заблокировано (предпросмотр) */}
          {isCurrentSelectedActive ? (
            <div className="bg-yellow-500 text-black text-sm font-bold px-4 py-2 rounded-full flex items-center gap-1.5 shadow-lg">
              <Check size={16} /> Надето
            </div>
          ) : currentUnlocked ? (
            <button
              onClick={handleApply}
              className="bg-yellow-400 text-black font-bold px-6 py-2.5 rounded-full hover:bg-yellow-500 transition-colors flex items-center gap-1.5"
            >
              <Check size={16} /> Надеть
            </button>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <div className="bg-gray-200 dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-sm font-bold px-4 py-2 rounded-full flex items-center gap-1.5">
                <Lock size={16} /> Заблокировано
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 text-center max-w-xs">
                {unlockLabel(currentOutfit)}
              </p>
            </div>
          )}

          {/* Плашка «Надето сейчас» в правом верхнем углу витрины */}
          {isCurrentSelectedActive && (
            <div className="absolute top-4 right-4 bg-yellow-500 text-black text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1 shadow-lg">
              <Check size={14} /> Надето
            </div>
          )}
        </div>
      </div>

      {/* --- Сетка комплектов --- */}
      <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 px-2">
        Комплекты {unlockedIds.length}/{OUTFITS.length}
      </h3>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {OUTFITS.map((outfit) => {
          const isUnlocked = unlockedIds.includes(outfit.id);
          const isSelected = selectedOutfit === outfit.id;
          const isActive = activeOutfitId === outfit.id;

          return (
            <div
              key={outfit.id}
              onClick={() => handleSelect(outfit)}
              className={`
                relative group rounded-2xl p-4 flex flex-col items-center transition-all duration-300 cursor-pointer
                ${isUnlocked
                  ? 'bg-white dark:bg-[#1e1e1e] hover:-translate-y-1'
                  : 'bg-gray-100 dark:bg-[#121212] hover:-translate-y-0.5'
                }
                ${isSelected
                  ? 'border-2 border-yellow-500 shadow-[0_0_20px_rgba(250,204,21,0.2)]'
                  : 'border border-gray-200 dark:border-gray-800 hover:border-yellow-500/50'
                }
              `}
            >
              <div className={`w-20 h-20 mb-2 relative ${!isUnlocked ? 'grayscale' : ''}`}>
                <Mascot outfitId={outfit.id} size={80} />
                {/* Бейдж наряда рисуем отдельно (только для открытых, кроме базового). */}
                {isUnlocked && outfit.badge && outfit.id !== 'default' && (
                  <span
                    className="absolute -bottom-1 -right-1 leading-none select-none drop-shadow"
                    style={{ fontSize: 22 }}
                    aria-hidden="true"
                  >
                    {outfit.badge}
                  </span>
                )}
                {!isUnlocked && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-xl backdrop-blur-sm">
                    <Lock className="text-white w-6 h-6" />
                  </div>
                )}
              </div>

              <p className="text-xs font-bold text-gray-900 dark:text-white text-center leading-tight mb-1">
                {outfit.name}
              </p>

              {!isUnlocked && (
                <p className="text-[10px] text-gray-500 dark:text-gray-400 text-center leading-tight">
                  {unlockLabel(outfit)}
                </p>
              )}

              {isActive && (
                <div className="absolute top-2 right-2 w-3 h-3 bg-green-500 rounded-full border-2 border-white dark:border-[#1e1e1e]" />
              )}
            </div>
          );
        })}
      </div>

      {/* Подсказка о способах получения */}
      <div className="mt-12 p-6 rounded-2xl bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border border-yellow-500/20">
        <p className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-2 flex items-center gap-2">
          <Trophy size={16} className="text-yellow-500" /> Как открыть новые наряды
        </p>
        <ul className="text-xs text-gray-600 dark:text-gray-300 space-y-1 list-disc list-inside">
          <li>Проходи главы в <strong>Путешествии</strong>;</li>
          <li>Совершай сделки и собирай портфель;</li>
          <li>Побеждай в <strong>Дружеском вызове</strong>.</li>
        </ul>
      </div>
    </div>
  );
}
