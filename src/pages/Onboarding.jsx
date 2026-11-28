import { useState } from 'react';
import { ArrowRight, BookOpen, BarChart2, Wallet } from 'lucide-react';
import { useUserStore } from '../store/userStore';

// --- ОБЩИЕ КОМПОНЕНТЫ ---

const Logo = () => (
  <div className="flex items-center gap-2">
    <span className="bg-gradient-to-br from-yellow-300 to-yellow-500 text-black px-2 py-1 rounded-lg font-bold">T</span>
    <span className="text-xl font-bold text-gray-900 dark:text-white">T-Start</span>
  </div>
);

const GradientButton = ({ onClick, children, isPrimary = true }) => (
  <button
    onClick={onClick}
    className={`w-full font-bold py-3 rounded-xl transition-all shadow-lg ${
      isPrimary
        ? 'bg-gradient-to-r from-yellow-400 to-orange-500 text-black hover:brightness-110'
        : 'bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-700'
    } flex items-center justify-center gap-2`}
  >
    {children}
  </button>
);

const ProgressDots = ({ current, total, onDotClick }) => (
  <div className="flex gap-2 mt-8 justify-center md:justify-start">
    {Array.from({ length: total }).map((_, idx) => (
      <button
        key={idx}
        onClick={() => onDotClick && onDotClick(idx + 1)}
        className={`rounded-full transition-all focus:outline-none ${
          idx + 1 === current ? 'bg-yellow-400 w-8 h-2' : 'bg-gray-300 dark:bg-gray-700 w-2 h-2 hover:bg-gray-400 dark:hover:bg-gray-600'
        }`}
        aria-label={`Перейти на шаг ${idx + 1}`}
      />
    ))}
  </div>
);

// Общий каркас шага:
// - mobile: картинка сверху, текст под ней (блоки друг под другом);
// - desktop (md+): текст слева, картинка прижата к правому краю (отступ 5–10%).
const StepLayout = ({ image, imageAlt = '', children }) => (
  <div className="flex-1 w-full flex flex-col md:flex-row md:items-center md:justify-between gap-6 md:gap-8">
        <div className="order-2 md:order-1 flex flex-col text-left w-full md:flex-1 md:max-w-2xl md:pl-[6%]">
      {children}
    </div>
    <div className="order-1 md:order-2 flex-shrink-0 flex justify-center md:justify-end md:pr-[6%] w-full md:w-auto">
      <img
        src={image}
        alt={imageAlt}
        className="w-48 h-48 md:w-[clamp(240px,30vw,600px)] md:h-[clamp(240px,30vw,600px)] object-contain"
        loading="eager"
      />
    </div>
  </div>
);

const Step1Content = ({ onNext, onSkip, onDotClick }) => (
  <StepLayout image="/assets/onboarding/cube-hello.png" imageAlt="Hello">
    <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-3 md:mb-4">Приветствуем тебя в T-Start!</h1>
    <p className="text-base md:text-lg text-gray-500 dark:text-gray-400 mb-2">Учись. Анализируй. Инвестируй.</p>
    <p className="text-sm text-gray-400 dark:text-gray-500 mb-6">Образовательная платформа для первых инвестиций</p>
    <div className="flex flex-col gap-3">
      <GradientButton onClick={onNext}>Далее <ArrowRight size={20}/></GradientButton>
      <GradientButton onClick={onSkip} isPrimary={false}>Пропустить</GradientButton>
    </div>
    <ProgressDots current={1} total={7} onDotClick={onDotClick} />
  </StepLayout>
);

const Step2Content = ({ onNext, onDotClick }) => (
  <StepLayout image="/assets/onboarding/cube-learn.png" imageAlt="Learn">
    <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-3 md:mb-4">Учись</h1>
    <p className="text-base md:text-lg text-gray-500 dark:text-gray-400 mb-5 md:mb-6">Короткие уроки про инвестиции — без воды и сложного жаргона.</p>
    <div className="flex flex-col gap-3 mb-6">
      <div className="p-4 rounded-2xl bg-white dark:bg-[#1e1e1e] border border-gray-200 dark:border-gray-800 flex items-center gap-3">
        <BookOpen size={24} className="text-yellow-500 shrink-0" />
        <div><h3 className="font-bold text-gray-900 dark:text-white">Что такое акции</h3><p className="text-xs text-gray-500">Простое объяснение</p></div>
      </div>
      <div className="p-4 rounded-2xl bg-white dark:bg-[#1e1e1e] border border-gray-200 dark:border-gray-800 flex items-center gap-3">
        <BarChart2 size={24} className="text-yellow-500 shrink-0" />
        <div><h3 className="font-bold text-gray-900 dark:text-white">Как читать графики</h3><p className="text-xs text-gray-500">Без сложных терминов</p></div>
      </div>
      <div className="p-4 rounded-2xl bg-white dark:bg-[#1e1e1e] border border-gray-200 dark:border-gray-800 flex items-center gap-3">
        <Wallet size={24} className="text-yellow-500 shrink-0" />
        <div><h3 className="font-bold text-gray-900 dark:text-white">Как купить активы</h3><p className="text-xs text-gray-500">Пошаговый гайд</p></div>
      </div>
    </div>
    <GradientButton onClick={onNext}>Далее <ArrowRight size={20}/></GradientButton>
    <ProgressDots current={2} total={7} onDotClick={onDotClick} />
  </StepLayout>
);

const Step3Content = ({ onNext, onDotClick }) => (
  <StepLayout image="/assets/onboarding/cube-journey.png" imageAlt="Journey">
    <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-3 md:mb-4">Путешествуй</h1>
    <p className="text-base md:text-lg text-gray-500 dark:text-gray-400 mb-6">Учись инвестициям, как в игре.</p>
    <GradientButton onClick={onNext}>Далее <ArrowRight size={20}/></GradientButton>
    <ProgressDots current={3} total={7} onDotClick={onDotClick} />
  </StepLayout>
);

const Step4Content = ({ onNext, onDotClick }) => (
  <StepLayout image="/assets/onboarding/cube-analyze.png" imageAlt="Analyze">
    <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-3 md:mb-4">Анализируй</h1>
    <p className="text-base md:text-lg text-gray-500 dark:text-gray-400 mb-5 md:mb-6">Смотри рынок, сравнивай идеи и учись читать графики на понятных примерах.</p>
    <div className="bg-white dark:bg-[#1e1e1e] p-4 rounded-2xl border border-gray-200 dark:border-gray-800 mb-6 w-full">
      <p className="text-xs text-gray-500 mb-2">SBER</p>
      <div className="h-24 flex items-end gap-1 w-full">
        <div className="flex-1 bg-green-500 h-1/4 rounded"></div>
        <div className="flex-1 bg-green-500 h-1/2 rounded"></div>
        <div className="flex-1 bg-red-500 h-1/3 rounded"></div>
        <div className="flex-1 bg-green-500 h-2/3 rounded"></div>
        <div className="flex-1 bg-green-500 h-3/4 rounded"></div>
        <div className="flex-1 bg-red-500 h-1/2 rounded"></div>
        <div className="flex-1 bg-green-500 h-full rounded"></div>
      </div>
    </div>
    <GradientButton onClick={onNext}>Далее <ArrowRight size={20}/></GradientButton>
    <ProgressDots current={4} total={7} onDotClick={onDotClick} />
  </StepLayout>
);

const Step5Content = ({ onNext, onDotClick }) => (
  <StepLayout image="/assets/onboarding/cube-compete.png" imageAlt="Compete">
    <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-3 md:mb-4">Соревнуйся</h1>
    <p className="text-base md:text-lg text-gray-500 dark:text-gray-400 mb-5 md:mb-6">Участвуй в соревнованиях с другими игроками, выполняй задания и поднимайся в рейтинге.</p>
    <div className="bg-white dark:bg-[#1e1e1e] p-4 rounded-2xl border border-gray-200 dark:border-gray-800 space-y-2 mb-6">
      <div className="flex justify-between text-sm"><span className="text-gray-900 dark:text-white font-bold">1. Алексей</span><span className="text-green-500">+12%</span></div>
      <div className="flex justify-between text-sm bg-yellow-100 dark:bg-yellow-900/30 -mx-4 px-4 py-2 rounded-lg"><span className="text-yellow-700 dark:text-yellow-400 font-bold">2. Ты</span><span className="text-yellow-700 dark:text-yellow-400">+8%</span></div>
      <div className="flex justify-between text-sm"><span className="text-gray-900 dark:text-white font-bold">3. Максим</span><span className="text-green-500">+5%</span></div>
    </div>
    <GradientButton onClick={onNext}>Далее <ArrowRight size={20}/></GradientButton>
    <ProgressDots current={5} total={7} onDotClick={onDotClick} />
  </StepLayout>
);

const Step6Content = ({ onNext, onSkip, onDotClick }) => {
  const [goalName, setGoalName] = useState('');
  const [goalSum, setGoalSum] = useState('');

    const handleSumChange = (e) => {
    // Только неотрицательные цифры (и точка/запятая). Минус отбрасываем сразу.
    let val = e.target.value.replace(/-/g, '').replace(',', '.');
    if (val === '' || (/^\d*\.?\d*$/.test(val) && Number(val) >= 0)) setGoalSum(val);
  };

  return (
    <StepLayout image="/assets/onboarding/cube-goal.png" imageAlt="Goal">
      <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-3 md:mb-4">Какова твоя цель?</h1>
      <p className="text-base md:text-lg text-gray-500 dark:text-gray-400 mb-5 md:mb-6">Назови к чему идёшь и сумму, так проще следить за прогрессом.</p>
      <div className="space-y-4 mb-6">
        <div>
          <label className="text-xs text-gray-500 ml-1">Название</label>
          <input type="text" placeholder="Например, Наушники" value={goalName} onChange={(e) => setGoalName(e.target.value)} className="w-full p-3 rounded-xl bg-white dark:bg-[#1e1e1e] border border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white outline-none focus:border-yellow-500" />
        </div>
        <div>
          <label className="text-xs text-gray-500 ml-1">Сумма</label>
          <input
            type="text"
            inputMode="decimal"
            placeholder="Например, 5000"
            value={goalSum}
            onChange={handleSumChange}
            className="w-full p-3 rounded-xl bg-white dark:bg-[#1e1e1e] border border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white outline-none focus:border-yellow-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
        </div>
      </div>
      <div className="flex flex-col gap-3">
        <GradientButton onClick={() => onNext({ name: goalName.trim(), sum: goalSum })}>Сохранить цель</GradientButton>
        <GradientButton onClick={onSkip} isPrimary={false}>Позже</GradientButton>
      </div>
      <ProgressDots current={6} total={7} onDotClick={onDotClick} />
    </StepLayout>
  );
};

const Step7Content = ({ onNext, onDotClick }) => (
  <StepLayout image="/assets/onboarding/cube-invest.png" imageAlt="Invest">
    <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-3 md:mb-4">Инвестируй</h1>
    <p className="text-base md:text-lg text-gray-500 dark:text-gray-400 mb-6">Пробуй в игровом формате и копи навыки — потом переходи к реальным шагам в Т-Инвестициях.</p>
    <GradientButton onClick={onNext}>Начать</GradientButton>
    <ProgressDots current={7} total={7} onDotClick={onDotClick} />
  </StepLayout>
);

// --- ГЛАВНЫЙ КОМПОНЕНТ ---




export default function Onboarding() {
  const [step, setStep] = useState(1);
  const setOnboardingDone = useUserStore((s) => s.setOnboardingDone);
  const setOnboardingGoal = useUserStore((s) => s.setOnboardingGoal);

  // Завершение онбординга: только ставим флаг. App увидит onboardingDone=true
  // и покажет экран входа — без ручной навигации (раньше navigate('/auth') давал
  // «битый» URL и падал, т.к. роута /auth нет).

    const finish = () => {
    setOnboardingDone();
  };

  const handleNext = (payload) => {
    // Шаг 6 присылает объект цели { name, sum } — сохраняем его в стор.
    if (step === 6 && payload && typeof payload === 'object') {
      setOnboardingGoal({ name: payload.name, sum: payload.sum });
    }
    if (step < 7) setStep(step + 1);
    else finish();
  };

  const handleSkip = () => {
    finish();
  };

  const handleDotClick = (targetStep) => {
    if (targetStep <= step) setStep(targetStep);
  };

    // Рендер текущего шага
  const renderStep = () => {
    switch (step) {
      case 1: return <Step1Content onNext={handleNext} onSkip={handleSkip} onDotClick={handleDotClick} />;
      case 2: return <Step2Content onNext={handleNext} onDotClick={handleDotClick} />;
      case 3: return <Step3Content onNext={handleNext} onDotClick={handleDotClick} />;
      case 4: return <Step4Content onNext={handleNext} onDotClick={handleDotClick} />;
      case 5: return <Step5Content onNext={handleNext} onDotClick={handleDotClick} />;
      case 6: return <Step6Content onNext={handleNext} onSkip={handleSkip} onDotClick={handleDotClick} />;
      case 7: return <Step7Content onNext={handleNext} onDotClick={handleDotClick} />;
      default: return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#121212] flex flex-col relative">
      {/* Логотип на всех шагах */}
      <div className="absolute top-6 left-4 md:top-8 md:left-8 z-10">
        <Logo />
      </div>

            {/* Один адаптивный контейнер на всю ширину:
          - mobile: контент в колонку (картинка сверху, текст под ней);
          - desktop: текст слева, картинка прижата к правому краю (отступ ~6%). */}
      <div className="flex-1 flex items-center pt-20 pb-10 px-4 md:px-0">
        <div className="w-full">
          {renderStep()}
        </div>
      </div>
    </div>
  );
}