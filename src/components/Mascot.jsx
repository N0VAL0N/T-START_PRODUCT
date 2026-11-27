import { resolveOutfit } from '../data/outfits';

// Универсальный маскот Ти-Стартик — ТОЛЬКО картинка текущего наряда.
// size — сторона в px (или строка вроде "100%").
// Бейдж/аксессуар рисуется отдельно там, где нужен (см. Wardrobe), а не здесь.
//
// Использование: <Mascot outfitId={activeOutfit} size={64} />
export default function Mascot({ outfitId, size = 64, className = '' }) {
  const outfit = resolveOutfit(outfitId);

  return (
    <div
      className={`relative inline-flex items-center justify-center ${className}`}
      style={{ width: size, height: size }}
    >
      <img
        src={outfit.image}
        alt={outfit.name}
        className="w-full h-full object-contain"
        draggable={false}
        onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }}
      />
    </div>
  );
}
