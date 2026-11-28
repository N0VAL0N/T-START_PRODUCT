import Mascot from '../Mascot';

// Индикатор «AI печатает…».
export default function ThinkingBubble({ activeOutfit }) {
  return (
    <div className="flex items-start gap-2.5">
      <div className="w-8 h-8 rounded-xl bg-[#fdf8eb] dark:bg-[#2a2416] flex items-center justify-center shrink-0 ring-1 ring-yellow-500/20">
        <Mascot outfitId={activeOutfit} size={24} />
      </div>
      <div className="px-4 py-3 rounded-2xl rounded-tl-sm bg-gray-50 dark:bg-[#1f1f1f] text-gray-500 text-sm ring-1 ring-black/5 dark:ring-white/5">
        Ти-Стартик печатает<span className="animate-pulse">…</span>
      </div>
    </div>
  );
}
