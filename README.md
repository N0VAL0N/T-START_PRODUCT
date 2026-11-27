# T-Start

Приложение для инвестиций для молодого поколения. Обучение (истории), ИИ-ассистент,
каталог акций, песочница T-Invest, геймификация (наряды, дружеский вызов).

## Как читать код (важно!)

Сначала прочитай **этот README** — здесь описано, что делает каждый файл.
Дальше открывай только те файлы, которые нужны для задачи, а не всё подряд.

Ключевые принципы:
- **Страницы (`src/pages/*`)** — тонкий рендер. Бизнес-логика вынесена в **хуки (`src/hooks/*`)**.
- **Сервер (`server/*`)** — разбит по ответственности; точка входа тонкая.
- Ключи API (DeepSeek, T-Invest) **только на сервере**; фронт токенов не видит.

---

## server/ — бэкенд (Node, без фреймворка)

| Файл | Что делает |
|------|------------|
| `index.mjs` | Точка входа: создаёт HTTP(S)-сервер, связывает роуты (`/api/health`, `/api/ai/chat`, `/api/quotes`, `/api/shares`, `/api/invest/*`, `/api/deposit*`), отдаёт статику. **Тонкий** — бизнес-логика в модулях ниже. |
| `config.mjs` | Загрузка `.env` и переменных окружения (ключи, лимиты, порт, флаги). |
| `tls.mjs` | Настройка HTTPS и сертификатов (Минцифры), если заданы. |
| `ai.mjs` | DeepSeek: системный промпт (без ИИР — «купи/продай» запрещены), запрос к модели, `splitTradeMarkers()` — вырезает `[[TRADE:...]]` из текста в массив `metadata`. |
| `invest.mjs` | Запросы к T-Invest API: котировки, список акций, открытие счёта песочницы, портфель. |
| `orders.mjs` | Логика заявок: `PENDING_CONFIRM` → `QUEUED` → исполнение. Обрабатывает подтверждение/постановку в очередь. |
| `validators.mjs` | Валидация входных данных (тикеры, лоты, суммы). |
| `deposit.mjs` | Пополнение песочницы: учёт дневного лимита на пользователя (по умолчанию 5000 ₽/день). |
| `static.mjs` | Раздача фронтенда (SPA fallback на `index.html`). |
| `utils.mjs` | Вспомогательные функции (чтение JSON-тела, `httpsJson`, ответы). |

---

## src/ — фронтенд (React + Vite)

### Точки входа
| Файл | Что делает |
|------|------------|
| `main.jsx` | Монтирует `<App/>`, подключает стили. |
| `App.jsx` | Корень: роутинг, ленивая загрузка страниц, тема, прокидывает `userData`/`executeTrade`/`trackEvent`/`onOpenChat`. Здесь же `ErrorBoundary` вокруг страниц и чата. |
| `index.css` | Tailwind + премиум-утилиты: `.story-stage`, `.story-panel`, `.skeleton`, **`.page-container`** (+ модификаторы `--narrow/--default/--wide`). |

### pages/ — экраны (тонкий рендер)
| Файл | Что делает |
|------|------------|
| `Dashboard.jsx` | Главная: баланс, стоимость портфеля, цель, мини-список бумаг, кнопка «Пополнить» (`DepositModal`), вход в чат и историю. |
| `Market.jsx` | Каталог акций: поиск, фильтры, ленивая подгрузка. Логика — в `hooks/useMarket.js`. Риск — `components/ui/RiskPill`. |
| `Story.jsx` | «Хроники»: главы, квизы, озвучка и авточтение. Озвучка — `hooks/useSpeech.js`. Защита от петли автоплеера через `spokenStepRef`. |
| `Profile.jsx` | Профиль: аватар/маскот, достижения, переход в гардероб. |
| `SettingsPage.jsx` | Настройки: реальный счёт (форма карты — `components/CardForm`), песочница, аналитика, поддержка, сброс/выход. |
| `Tournament.jsx` | «Дружеский вызов»: лидерборд по реальным котировкам, инвайт-код (хеш имени + случайность). |
| `Wardrobe.jsx` | Гардероб нарядов маскота: превью, разблокировка, надевание. |
| `Onboarding.jsx` | Первый запуск: имя + цель. |

### hooks/ — бизнес-логика (вынесена из компонентов)
| Файл | Что делает |
|------|------------|
| `useChat.js` | Вся логика ИИ-чата: отправка (`sendMessage` → `askAssistant`), `runFallback`, обработка `metadata`-заявок (`confirmOrder`), ручная покупка из карточки (`confirmTrade`), `selectStock`. Возвращает `messages, isThinking, sendMessage, …`. |
| `useMarket.js` | Загрузка рынка: справочник акций, чанковая загрузка цен, `IntersectionObserver`, стейты `pricesMap/allTickers/visibleCount`, фильтрация+поиск. Возвращает `displayStocks, …`. |
| `useSpeech.js` | Web Speech API: `{ speak, stop, isSpeaking, supported }`. Токен гасит устаревшие `onend` (защита от «озвучил→перерисовал→озвучил»). |
| `useQuotes.js` | Живые котировки с кэшем в сторе: `{ quotes, byTicker, loading, error, refresh }`. Пустой список тикеров → запросов нет. |

### components/ — переиспользуемые UI
| Файл | Что делает |
|------|------------|
| `Layout.jsx` | Каркас: сайдбар (ПК) + нижняя навигация (моб., `z-50`). Контент в `.page-container` не перекрывается панелью. |
| `ChatModal.jsx` | Модалка чата — **только рендер** (логика в `useChat`). Пузыри, Markdown, карточки бумаг, заявки `OrderCard`. |
| `Markdown.jsx` | Безопасный мини-Markdown (**жирный**, *курсив*, `код`, списки). Без `dangerouslySetInnerHTML`. |
| `DepositModal.jsx` | Пополнение песочницы: табы «за задание»/«своя сумма», дневной лимит (проверка на бэке). Защита от повторного запроса лимита (`loadedKeyRef`). |
| `CardForm.jsx` | Форма банковской карты (номер/срок/CVV/имя) + валидация (Луна). `onSubmit(mask, raw)`. |
| `ErrorBoundary.jsx` | Ловит ошибки рендера. Кнопки «Обновить» и «Вернуться на главную». |
| `Mascot.jsx` | Только картинка маскота по наряду (`outfitId, size`). Бейдж рисуется отдельно, где нужен (см. `Wardrobe`). |
| `SettingsModal.jsx`, `Toggle.jsx` | Базовая модалка и переключатель. |
| `ui/RiskPill.jsx` | Единый индикатор риска (`variant="dot"` \| `"solid"`). Используется в `Market` и `ChatModal`. |

### data/, store/, services/, utils/
| Файл | Что делает |
|------|------------|
| `data/chapters.js` | Главы истории (объединяет `story.json`). |
| `data/story.json` | Текст глав/вопросов истории. |
| `data/chatCards.js` | `SUGGEST_TICKERS`, `CHOICE_PHRASES`, `toStockCard()` — маппинг котировки в карточку чата. |
| `data/outfits.js` | Наряды маскота и правила разблокировки (`resolveOutfit`, `computeUnlocked`, `unlockLabel`). |
| `store/userStore.js` | Zustand + IndexedDB (persist): `userData`, тема, котировки-кэш. Действия: `executeTrade` (уменьшает баланс, увеличивает портфель), `setBalance`, `completeChapter`, `syncOutfits`, `resetAccount` и др. Аналитика ограничена 50 событиями. |
| `services/ai.js` | Клиент чата: `askAssistant(history, ctx)` → `{ text, metadata }`, `isAiConfigured()`. |
| `services/invest.js` | Клиент песочницы через бэкенд: `openSandboxAccount`, `tradeByTicker`, `fetchQuotes`, `fetchShares`, `fetchDepositLimit`, `requestDeposit`. |
| `utils/format.js` | Форматтеры: `fmtPrice`, `fmtChange(1)`, `formatCardNumber`, `formatExpiry`, `luhnValid`. |
| `utils/readiness.js` | `computeReadiness` — готовность к реальному профилю (по достижениям/главам). |

---

## Запуск
```bash
npm install
npm run dev             # фронт (Vite)
node server/index.mjs   # бэкенд (порт из .env, по умолчанию 8787)
```

Переменные окружения (сервер): `DEEPSEEK_API_KEY`, `TINVEST_TOKEN`,
`SANDBOX_DEPOSIT_DAILY_LIMIT`, `PORT` и др. — см. `server/config.mjs`.

 