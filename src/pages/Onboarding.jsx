import { useState } from 'react';
import { Bot, ArrowRight, Target, BookOpen, MessageSquare, FlaskConical, Wallet } from 'lucide-react';

// Онбординг: 4 шага, чтобы пользователь понимал, что делает каждая кнопка,
// и быстро доходил до первой покупки.
// Шаг 1 — приветствие + что умеет приложение.
// Шаг 2 — имя. Шаг 3 — цель. Шаг 4 — «что здесь есть» + сразу в путь.

const GOALS = [
  { id: 'dream', label: 'Накопить на мечту', icon: '🎯' },
  { id: 'learn', label: 'Разобраться в инвестициях', icon: '📚' },
  { id: 'try', label: 'Просто попробовать', icon: '🚀' },
];

const FEATURES = [
  { icon: BookOpen, title: 'История', desc: 'Короткие главы-путешествия. Проходишь и открываешь доступ к счёту.' },
  { icon: MessageSquare, title: 'Чат с Ти-Стартиком', desc: 'Спроси «что купить на 500 ₽» — он подберёт и поможет с первой сделкой.' },
  { icon: FlaskConical, title: 'Песочница', desc: 'Тренируйся на настоящем API Т-Инвест без риска реальных денег.' },
];

export default function Onboarding({ onComplete, isDark }) {
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [goal, setGoal] = useState(GOALS[0].label);

  return (
    <div className={`min-h-screen flex flex-col items-center justify-center p-6 ${isDark ? 'bg-[#121212] text-white' : 'bg-gray-50 text-gray-900'}`}>

      {/* Прогресс */}
      <div className="flex gap-1.5 mb-8">
        {[1, 2, 3, 4].map(s => (
          <div key={s} className={`h-1.5 rounded-full transition-all ${s <= step ? 'bg-yellow-400 w-8' : 'bg-gray-300 dark:bg-gray-700 w-4'}`} />
        ))}
      </div>

      {/* Шаг 1: Приветствие + что умеет */}
      {step === 1 && (
        <div className="text-center animate-fade-in max-w-sm">
          <div className="w-28 h-28 mx-auto bg-yellow-400 rounded-3xl mb-6 shadow-[0_0_40px_rgba(250,204,21,0.4)] flex items-center justify-center relative">
            <Bot size={56} className="text-black" />
            <div className="absolute -bottom-4 -right-4 text-3xl">🦸‍♂️</div>
          </div>
          <h1 className="text-2xl font-bold mb-2">Привет! Я Ти-Стартик</h1>
          <p className="text-gray-500 mb-6">Проведу тебя от нуля до первой покупки акции — простым языком, без страха.</p>
          <div className="text-left space-y-2 mb-8">
            {['Разберёмся, что такое акции', 'Потренируемся без риска', 'Сделаем первую настоящую сделку'].map(t => (
              <div key={t} className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                <span className="w-5 h-5 rounded-full bg-yellow-400 text-black text-xs font-bold flex items-center justify-center shrink-0">✓</span>
                {t}
              </div>
            ))}
          </div>
          <button onClick={() => setStep(2)} className="w-full bg-yellow-400 text-black font-bold py-3 rounded-xl hover:bg-yellow-500 flex items-center justify-center gap-2">
            Погнали <ArrowRight size={20} />
          </button>
        </div>
      )}

      {/* Шаг 2: Имя */}
      {step === 2 && (
        <div className="w-full max-w-sm animate-fade-in">
          <h2 className="text-xl font-bold mb-2">Как тебя зовут?</h2>
          <p className="text-sm text-gray-500 mb-4">Так я буду к тебе обращаться.</p>
          <input
            type="text"
            placeholder="Твое имя"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && name.trim().length >= 2 && setStep(3)}
            className="w-full p-4 rounded-xl bg-white dark:bg-[#1e1e1e] border border-gray-200 dark:border-gray-800 outline-none focus:border-yellow-400 mb-6 text-gray-900 dark:text-white"
          />
          <button
            disabled={name.trim().length < 2}
            onClick={() => setStep(3)}
            className="w-full bg-yellow-400 text-black font-bold py-3 rounded-xl hover:bg-yellow-500 disabled:opacity-50"
          >
            Далее
          </button>
        </div>
      )}

      {/* Шаг 3: Цель */}
      {step === 3 && (
        <div className="w-full max-w-sm animate-fade-in">
          <h2 className="text-xl font-bold mb-4">Какая у тебя цель?</h2>
          <div className="space-y-3 mb-6">
            {GOALS.map((g) => (
                            <button
                key={g.id}
                onClick={() => { setGoal(g.label); setStep(4); }}
                className="w-full p-4 rounded-xl text-left bg-white dark:bg-[#1e1e1e] border border-gray-200 dark:border-gray-800 hover:border-yellow-400 transition-colors flex items-center gap-3 text-gray-900 dark:text-white"
              >
                <span className="text-xl">{g.icon}</span>
                <span className="flex-1">{g.label}</span>
                <Target size={18} className="text-yellow-500" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Шаг 4: что делает каждая кнопка + сразу к первой покупке */}
      {step === 4 && (
        <div className="w-full max-w-sm animate-fade-in">
          <h2 className="text-xl font-bold mb-2">Что здесь есть</h2>
          <p className="text-sm text-gray-500 mb-4">Три кнопки, которые приведут к первой покупке:</p>
          <div className="space-y-3 mb-6">
            {FEATURES.map((f) => (
              <div key={f.title} className="p-4 rounded-xl bg-white dark:bg-[#1e1e1e] border border-gray-200 dark:border-gray-800 flex items-start gap-3">
                <f.icon size={22} className="text-yellow-500 mt-0.5 shrink-0" />
                <div>
                  <p className="font-bold text-sm text-gray-900 dark:text-white">{f.title}</p>
                  <p className="text-xs text-gray-500">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
          <button
            onClick={() => onComplete(name.trim(), goal)}
            className="w-full bg-yellow-400 text-black font-bold py-3 rounded-xl hover:bg-yellow-500 flex items-center justify-center gap-2"
          >
            <Wallet size={20} /> Начать путь
          </button>
          <p className="text-center text-xs text-gray-400 mt-3">Стартовый баланс — 1000 ₽ для тренировки.</p>
        </div>
      )}
    </div>
  );
}