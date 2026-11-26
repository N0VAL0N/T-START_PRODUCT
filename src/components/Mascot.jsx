import { resolveOutfit } from '../data/outfits';

// Универсальный маскот Ти-Стартик.
// Показывает картинку текущего наряда + небольшой декоративный аксессуар (эмодзи),
// чтобы комплекты визуально отличались. size — сторона в px.
//
// Использование: <Mascot outfitId={activeOutfit} size={64} />
export default function Mascot({ outfitId, size = 64, className = '', withBadge = true }) {
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
      />
      {withBadge && outfit.badge && outfit.id !== 'default' && (
        <span
          className="absolute -bottom-1 -right-1 leading-none select-none drop-shadow"
          style={{ fontSize: Math.max(12, Math.round(size * 0.28)) }}
          aria-hidden="true"
        >
          {outfit.badge}
        </span>
      )}
    </div>
  );
}
