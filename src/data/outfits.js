// ===== Наряды маскота (Ти-Стартик) =====
// Единый источник правды о комплектах и правилах их разблокировки.
// Используется: гардеробом (Wardrobe), страницами (Market/Dashboard/Story/Profile),
// компонентом <Mascot/>, и стором для авторасчёта открытых нарядов.
//
// Картинки нарядов — PNG в public/assets/cube/cube-<id>.png.
// Их можно заменить, не трогая код: просто положи файл с тем же именем.
// Путь через BASE_URL, чтобы работало и на вложенном деплое.
const CUBE_DIR = `${import.meta.env.BASE_URL}assets/cube`;
const png = (id) => `${CUBE_DIR}/cube-${id}.png`;

// badge — декоративный оверлей (эмодзи), accent — цвет подсветки плашки.
export const OUTFITS = [
  {
    id: 'default',
    name: 'Базовый',
    desc: 'Стартовый вид. С этого всё начинается.',
    image: png('default'),
    accent: 'from-yellow-300 to-yellow-500',
    badge: '⭐',
    unlock: { type: 'always', label: 'Доступен по умолчанию' },
  },
  {
    id: 'hero',
    name: 'Супергерой',
    desc: 'Плащ и уверенность. За первый шаг в путешествии.',
    image: png('hero'),
    accent: 'from-red-400 to-orange-500',
    badge: '🦸',
    unlock: { type: 'chapter', chapterId: 1, label: 'Пройди главу 1 «Тайна первого счёта»' },
  },
  {
    id: 'trader',
    name: 'Трейдер',
    desc: 'Строгий костюм стратега. За первую сделку.',
    image: png('trader'),
    accent: 'from-emerald-400 to-teal-500',
    badge: '📈',
    unlock: { type: 'deals', min: 1, label: 'Соверши первую сделку' },
  },
  {
    id: 'winter',
    name: 'Инвестор-зимородок',
    desc: 'Тёплая шапка и шарф. Собери портфель на 500 ₽.',
    image: png('winter'),
    accent: 'from-sky-400 to-blue-600',
    badge: '🧣',
    unlock: { type: 'portfolio', min: 500, label: 'Собери портфель на сумму от 500 ₽' },
  },
  {
    id: 'smart',
    name: 'Умник',
    desc: 'Очки и лупа. Пройди все главы путешествия.',
    image: png('smart'),
    accent: 'from-violet-400 to-purple-600',
    badge: '🤓',
    unlock: { type: 'chaptersCount', min: 3, label: 'Пройди все 3 главы путешествия' },
  },
  {
    id: 'champion',
    name: 'Чемпион',
    desc: 'Золотая корона лидера. Победи в Дружеском вызове.',
    image: png('champion'),
    accent: 'from-amber-300 to-yellow-500',
    badge: '👑',
    unlock: { type: 'tournamentWin', label: 'Победи в соревновании (1-е место)' },
  },
];

const OUTFIT_BY_ID = new Map(OUTFITS.map((o) => [o.id, o]));

/** Вернуть наряд по id (с безопасным фолбэком на «default»). */
export function resolveOutfit(id) {
  return OUTFIT_BY_ID.get(id) || OUTFITS[0];
}

/** Всегда открытый набор на старте. */
export function initialOutfits() {
  return ['default'];
}

/**
 * Открыт ли наряд по текущим данным пользователя.
 * @param {object} outfit
 * @param {object} userData
 */
export function isOutfitUnlocked(outfit, userData) {
  if (!outfit) return false;
  const u = userData || {};
  switch (outfit.unlock.type) {
    case 'always':
      return true;
    case 'chapter':
      return Array.isArray(u.chaptersDone) && u.chaptersDone.includes(outfit.unlock.chapterId);
    case 'chaptersCount':
      return (u.chaptersDone?.length || 0) >= (outfit.unlock.min || 1);
    case 'deals':
      return (Number(u.deals) || 0) >= (outfit.unlock.min || 1);
    case 'portfolio':
      return (Number(u.portfolio) || 0) >= (outfit.unlock.min || 0);
    case 'tournamentWin':
      // Турнир пишет в userData.tournamentBestPlace = 1 при победе.
      return Number(u.tournamentBestPlace) === 1;
    default:
      return false;
  }
}

/**
 * Полный список открытых нарядов для пользователя (включая ранее полученные).
 * Объединяем уже сохранённые unlockedOutfits и то, что заработано по условиям.
 * Возвращает { unlocked: string[], newlyUnlocked: string[] }.
 */
export function computeUnlocked(userData) {
  const stored = Array.isArray(userData?.unlockedOutfits) ? userData.unlockedOutfits : [];
  const set = new Set([...initialOutfits(), ...stored]);
  const newlyUnlocked = [];
  for (const o of OUTFITS) {
    if (!set.has(o.id) && isOutfitUnlocked(o, userData)) {
      set.add(o.id);
      newlyUnlocked.push(o.id);
    }
  }
  return { unlocked: [...set], newlyUnlocked };
}

/** Человекочитаемое условие разблокировки наряда. */
export function unlockLabel(outfit) {
  return outfit?.unlock?.label || '';
}
