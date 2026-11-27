import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BookOpen, Lock, Check, ChevronRight, ArrowLeft, 
  ShieldCheck, Play, RotateCcw, Loader2, CheckCircle2,
  Volume2, VolumeX, History, X, FastForward, PauseCircle
} from 'lucide-react';
import { CHAPTERS } from '../data/chapters';
import { computeReadiness } from '../utils/readiness';
import { isInvestConfigured } from '../services/invest';
import Mascot from '../components/Mascot';
import { useSpeech } from '../hooks/useSpeech';
import { useUserStore } from '../store/userStore';

export default function Story({ userData, trackEvent, chaptersDone = [], onChapterComplete, onOpenRealAccount }) {
  const navigate = useNavigate();
  const activeOutfit = useUserStore((s) => s.userData?.activeOutfit);
  
  const [expanded, setExpanded] = useState(null);
  const [chapter, setChapter] = useState(null);
  const [currentNodeId, setCurrentNodeId] = useState(null);
  const [answered, setAnswered] = useState(null);
  const [regState, setRegState] = useState('idle');
  const [regMessage, setRegMessage] = useState('');

  const [history, setHistory] = useState([]);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isAutoPlay, setIsAutoPlay] = useState(false);

  // Озвучка — в хуке (Web Speech API).
  const { speak, stop: stopSpeech, isSpeaking } = useSpeech();
  // Ref «шаг уже озвучен» — гарантирует, что автовоспроизведение на текущей
  // ноде запускается РОВНО ОДИН раз (не зацикливается на ре-рендерах от isSpeaking).
  const spokenStepRef = useRef(null);

  const completedSet = new Set(chaptersDone);
  const allDone = CHAPTERS.every(c => completedSet.has(c.id));
  const readiness = computeReadiness(userData.analytics || [], {
    deals: userData.deals,
    chaptersDone: chaptersDone.length,
  });

  const isLocked = (idx) => idx > 0 && !completedSet.has(CHAPTERS[idx - 1].id);

  // Сброс речи при смене ноды и обнуление флага «шаг озвучен».
  useEffect(() => {
    stopSpeech();
    spokenStepRef.current = null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentNodeId, chapter]);

  // Автовоспроизведение объявлено ниже (после handleNext), чтобы ссылаться
  // на функцию без обращения к переменной до её объявления.

  const openChapter = (ch) => {
    setChapter(ch);
    setCurrentNodeId(ch.nodes[0].id);
    setAnswered(null);
    setHistory([]);
    setIsAutoPlay(false); 
    trackEvent(`Открыта глава ${ch.id}`);
  };

  const closeChapter = () => { 
    setChapter(null); 
    setAnswered(null); 
    setIsAutoPlay(false);
    stopSpeech();
  };

  const handleNext = () => {
    if (!chapter) return;
    const currentNode = chapter.nodes.find(n => n.id === currentNodeId);
    if (!currentNode) return;
    if (currentNode.type === 'question') return;

    setHistory(prev => [...prev, { type: 'dialogue', text: currentNode.text }]);

    if (currentNode.next) {
      setCurrentNodeId(currentNode.next);
    } else {
      if (!completedSet.has(chapter.id)) {
        onChapterComplete?.(chapter.id);
        trackEvent(`Глава пройдена ${chapter.id}`);
      }
      closeChapter();
    }
  };

  const handleAnswer = (option) => {
    setAnswered(option);
    setIsAutoPlay(false); // на вопросе авточтение останавливаем
    setHistory(prev => [...prev, { type: 'question', text: option.text, isCorrect: option.correct }]);
    
    if (option.correct) trackEvent('Квиз верно');
    else trackEvent('Квиз неверно');
    
    if (option.next) {
      setTimeout(() => {
        setCurrentNodeId(option.next);
        setAnswered(null);
      }, 1000);
    }
  };

  // Автовоспроизведение: эффект — только побочные действия (речь), без setState.
  // spokenStepRef гарантирует, что на текущей ноде speak() вызывается РОВНО ОДИН раз
  // (ре-рендеры от isSpeaking не должны перезапускать озвучку → петля устранена).
  useEffect(() => {
    if (!isAutoPlay || !chapter) return;

    const currentNode = chapter.nodes.find((n) => n.id === currentNodeId);
    if (!currentNode || !currentNode.text) return;

    // На вопросе — озвучиваем один раз и не листаем дальше.
    if (currentNode.type === 'question') {
      if (spokenStepRef.current !== currentNodeId) {
        spokenStepRef.current = currentNodeId;
        speak(currentNode.text);
      }
      return;
    }

    if (spokenStepRef.current !== currentNodeId) {
      spokenStepRef.current = currentNodeId;
      speak(currentNode.text, () => {
        if (currentNode.next) {
          setTimeout(() => { if (isAutoPlay) handleNext(); }, 2000);
        }
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentNodeId, isAutoPlay, chapter]);

  const toggleSpeech = () => {
    if (isSpeaking) { stopSpeech(); return; }

    const currentNode = chapter?.nodes.find(n => n.id === currentNodeId);
    if (!currentNode?.text) return;

    // Ручное озвучивание не должно потом «дёргать» автоперелистывание.
    spokenStepRef.current = currentNodeId;
    speak(currentNode.text);
  };

  const toggleAutoPlay = () => {
    if (isAutoPlay) {
      setIsAutoPlay(false);
      stopSpeech();
    } else {
      // Сброс флага, чтобы автоплеер заново озвучил текущий шаг.
      spokenStepRef.current = null;
      setIsAutoPlay(true);
    }
  };

  const registerRealProfile = async () => {
    if (!isInvestConfigured()) {
      setRegState('error');
      setRegMessage('API Т-Инвест не настроен.');
      return;
    }
    setRegState('loading');
    setRegMessage('');
    try {
      const res = await onOpenRealAccount?.();
      if (res?.ok) {
        setRegState('done');
        setRegMessage(`Профиль создан! Демо-счёт ${res.accountId?.slice(0, 8)}… пополнен.`);
      } else {
        setRegState('error');
        setRegMessage(res?.reason === 'not-configured' ? 'API Т-Инвест не настроен.' : `Ошибка: ${res?.reason}`);
      }
    } catch (e) {
      setRegState('error');
      setRegMessage(`Ошибка: ${e.message}`);
    }
  };

  // ===== Экран главы =====
  if (chapter) {
    const currentNode = chapter.nodes.find(n => n.id === currentNodeId);

    return (
      <div className="story-stage fixed inset-0 flex flex-col justify-end p-4 md:p-8 z-50 overflow-hidden">
        <div className="absolute inset-0 opacity-[0.03] bg-[url('https://www.transparenttextures.com/patterns/p6.png')] pointer-events-none mix-blend-screen"></div>
        
        <div className="absolute top-6 left-6 right-6 flex justify-between items-center z-20">
          <button onClick={closeChapter} className="text-gray-600 dark:text-gray-400 hover:text-black dark:hover:text-white transition-colors p-2 bg-black/5 dark:bg-black/40 rounded-full backdrop-blur-sm">
            <ArrowLeft size={24} />
          </button>
          
          <div className="flex gap-2">
            <button onClick={toggleAutoPlay} className={`transition-colors p-2 rounded-full backdrop-blur-sm ${isAutoPlay ? 'bg-yellow-500 text-black' : 'bg-black/5 dark:bg-black/40 text-gray-600 dark:text-gray-400 hover:text-black dark:hover:text-white'}`} title="Авточтение">
              {isAutoPlay ? <PauseCircle size={20} /> : <FastForward size={20} />}
            </button>
            <button onClick={() => setIsHistoryOpen(true)} className="text-gray-600 dark:text-gray-400 hover:text-yellow-600 dark:hover:text-yellow-500 transition-colors p-2 bg-black/5 dark:bg-black/40 rounded-full backdrop-blur-sm" title="История">
              <History size={20} />
            </button>
            <button onClick={toggleSpeech} className={`transition-colors p-2 bg-black/5 dark:bg-black/40 rounded-full backdrop-blur-sm ${isSpeaking ? 'text-yellow-600 dark:text-yellow-500 animate-pulse' : 'text-gray-600 dark:text-gray-400 hover:text-black dark:hover:text-white'}`} title="Озвучить">
              {isSpeaking ? <VolumeX size={20} /> : <Volume2 size={20} />}
            </button>
          </div>
        </div>

        <div className="relative z-10 max-w-3xl mx-auto w-full mb-4">
           <AnimatePresence mode="wait">
            <motion.div 
              key={currentNodeId}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4 }}
              className="story-panel p-6 md:p-8 rounded-3xl shadow-2xl relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-yellow-600/50 to-transparent"></div>

              <div className="flex items-start gap-4 mb-6">
                <div className="w-14 h-14 bg-[#fdf8eb] rounded-2xl flex items-center justify-center shrink-0 shadow-[0_0_20px_rgba(250,204,21,0.2)]">
                  <Mascot outfitId={activeOutfit} size={40} />
                </div>
                <div>
                   <h2 className="text-yellow-600 dark:text-yellow-500 font-serif text-xl font-bold tracking-wide">{chapter.title}</h2>
                   <p className="text-xs text-gray-500 mt-1 uppercase tracking-wider font-medium">Глава {chapter.id}</p>
                </div>
              </div>

              {currentNode.type !== 'question' && (
                <div className="text-gray-800 dark:text-gray-200 text-lg leading-relaxed font-light mb-8">{currentNode.text}</div>
              )}

              {currentNode.type === 'question' && (
                <div className="mb-8">
                  <p className="text-gray-900 dark:text-gray-100 font-bold mb-4 text-lg">{currentNode.text}</p>
                  <div className="space-y-3">
                    {currentNode.options.map((opt, idx) => {
                      const isChosen = answered?.text === opt.text;
                      const isCorrect = opt.correct;
                      let btnClass = "bg-gray-50 dark:bg-[#222] border-gray-300 dark:border-gray-700 hover:border-yellow-500 hover:bg-white dark:hover:bg-[#2a2a2a] text-gray-700 dark:text-gray-300";
                      if (isChosen) btnClass = isCorrect ? "bg-green-50 dark:bg-green-900/40 border-green-500 text-green-800 dark:text-green-100" : "bg-red-50 dark:bg-red-900/40 border-red-500 text-red-800 dark:text-red-100";
                      return (
                        <button key={idx} disabled={!!answered} onClick={() => handleAnswer(opt)} className={`w-full text-left p-4 rounded-xl border transition-all text-sm ${btnClass}`}>
                          {opt.text}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {(currentNode.type !== 'question' || answered) && (
                <button onClick={handleNext} className="w-full bg-yellow-500 text-black font-bold py-4 rounded-xl hover:bg-yellow-400 transition-colors flex items-center justify-center gap-2 text-lg shadow-[0_0_20px_rgba(250,204,21,0.15)]">
                  {currentNode.next ? 'Дальше' : 'Завершить главу'}
                  <ChevronRight size={22} />
                </button>
              )}
            </motion.div>
           </AnimatePresence>
        </div>

        <AnimatePresence>
          {isHistoryOpen && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
              <div className="bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-800 rounded-3xl w-full max-w-lg max-h-[80vh] flex flex-col overflow-hidden">
                <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center">
                  <h3 className="font-bold text-gray-900 dark:text-gray-100">История диалога</h3>
                  <button onClick={() => setIsHistoryOpen(false)} className="text-gray-400 hover:text-black dark:hover:text-white"><X size={20}/></button>
                </div>
                <div className="p-4 overflow-y-auto space-y-3 flex-1">
                  {history.length === 0 ? (
                    <p className="text-gray-500 text-sm text-center italic">Пока пусто. Начни диалог!</p>
                  ) : (
                    history.map((item, i) => (
                      <div key={i} className={`p-3 rounded-xl text-sm ${item.type === 'question' ? (item.isCorrect ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200' : 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200') : 'bg-gray-100 dark:bg-[#222] text-gray-700 dark:text-gray-300'}`}>
                        <p className="text-[10px] uppercase text-gray-500 mb-1">{item.type === 'question' ? 'Ваш выбор' : 'Ти-Стартик'}</p>
                        {item.text}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // ===== Экран карточек (Вертикальный зигзаг) =====
  return (
    <div className="page-container page-container--default relative px-4">
      <header className="flex flex-col items-center justify-center mb-12 pt-10 text-center">
        <div className="p-3 bg-yellow-500/10 rounded-full mb-4 border border-yellow-500/20 shadow-[0_0_20px_rgba(250,204,21,0.15)]">
          <BookOpen size={32} className="text-yellow-500" />
        </div>
        <h1 className="text-4xl font-serif font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-600 to-yellow-500 dark:from-yellow-200 dark:to-yellow-600 tracking-wide mb-2">
          Хроники T-Start
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 font-light italic max-w-md">
          Каждая глава — шаг к пониманию рынка. Ошибаться здесь не страшно.
        </p>
      </header>

      <div className="relative">
        {/* Линия времени: на мобилке смещена влево, на ПК по центру */}
        <div className="hidden md:block absolute left-1/2 top-0 bottom-0 w-px bg-gradient-to-b from-yellow-500/40 via-gray-300 dark:via-gray-700 to-transparent -translate-x-1/2"></div>

        <div className="space-y-10 md:space-y-20">
          {CHAPTERS.map((ch, idx) => {
            const done = completedSet.has(ch.id);
            const locked = isLocked(idx);
            const isEven = idx % 2 === 0;

            return (
              <div key={ch.id} className={`relative flex items-center ${isEven ? 'flex-row' : 'flex-row-reverse'} md:flex-row ${isEven ? 'md:flex-row' : 'md:flex-row-reverse'}`}>
                
                {/* Точки на мобилке убрали, на ПК оставили */}
                <div className={`absolute left-[20%] md:left-1/2 -translate-x-1/2 hidden md:flex items-center justify-center w-8 h-8 rounded-full bg-white dark:bg-[#0a0a0a] border-2 border-gray-300 dark:border-gray-700 z-10`}>
                   <div className={`w-2.5 h-2.5 rounded-full ${done ? 'bg-green-500' : locked ? 'bg-gray-400 dark:bg-gray-600' : 'bg-yellow-500 animate-pulse'}`}></div>
                </div>

                {/* 
                  Карточка: 
                  На мобилке: ширина 70%, отступ от линии (20% + отступ).
                  На ПК: 50% ширины с отступами в стороны.
                */}
                <div className={`w-[70%] ${isEven ? 'ml-[25%]' : 'mr-[25%] ml-auto'} md:w-1/2 md:ml-0 md:mr-0 ${isEven ? 'md:pr-16 text-left' : 'md:pl-16'}`}>
                  <div
                    onClick={() => !locked && setExpanded(expanded === ch.id ? null : ch.id)}
                    className={`relative group rounded-2xl border transition-all duration-500 overflow-hidden ${
                      locked
                        ? 'bg-white/50 dark:bg-[#121212]/50 border-gray-200 dark:border-gray-800 opacity-50 grayscale'
                        : done 
                          ? 'bg-green-50/80 dark:bg-[#121a14]/80 border-green-300 dark:border-green-900/50 hover:border-green-500/50 cursor-pointer' 
                          : 'bg-white dark:bg-[#1e1e1e]/90 border-yellow-300 dark:border-yellow-900/30 hover:border-yellow-500/80 cursor-pointer shadow-[0_0_30px_rgba(250,204,21,0.05)]'
                    }`}
                  >
                    <div className={`absolute inset-0 opacity-20 pointer-events-none ${done ? 'bg-gradient-to-br from-green-900/50 to-transparent' : 'bg-gradient-to-br from-yellow-900/30 to-transparent'}`}></div>

                    <div className="p-5 md:p-6 relative z-10">
                      <div className="flex items-start justify-between mb-2">
                        <div className={`inline-flex items-center justify-center px-3 py-1 rounded-full text-xs font-bold tracking-wider ${
                          done ? 'bg-green-500/20 text-green-600 dark:text-green-400' : locked ? 'bg-gray-200 dark:bg-gray-800 text-gray-500' : 'bg-yellow-500/20 text-yellow-600 dark:text-yellow-500'
                        }`}>
                          ГЛАВА {ch.id}
                        </div>
                        {done && <Check size={18} className="text-green-500" />}
                        {locked && <Lock size={18} className="text-gray-500 dark:text-gray-600" />}
                      </div>

                      <h3 className={`font-serif text-xl md:text-2xl font-bold mb-1 ${locked ? 'text-gray-500' : 'text-gray-900 dark:text-gray-100'}`}>
                        {ch.title}
                      </h3>
                      <p className={`text-xs md:text-sm ${locked ? 'text-gray-500 dark:text-gray-600' : 'text-gray-500 dark:text-gray-400'}`}>
                        {locked ? 'Сначала заверши предыдущую главу' : ch.short}
                      </p>

                      <div className={`grid transition-all duration-300 ${expanded === ch.id ? 'grid-rows-[1fr] opacity-100 mt-4' : 'grid-rows-[0fr] opacity-0'}`}>
                        <div className="overflow-hidden">
                          <div className="pt-4 border-t border-gray-200 dark:border-gray-700/50">
                            <button
                              onClick={(e) => { e.stopPropagation(); openChapter(ch); }}
                              className={`w-full font-bold py-2.5 rounded-xl flex items-center justify-center gap-2 transition-all text-sm ${
                                done 
                                  ? 'bg-gray-200 dark:bg-gray-800 text-gray-900 dark:text-white hover:bg-gray-300 dark:hover:bg-gray-700' 
                                  : 'bg-yellow-500 text-black hover:bg-yellow-400 shadow-[0_0_15px_rgba(250,204,21,0.3)]'
                              }`}
                            >
                              {done ? <><RotateCcw size={16} /> Перечитать</> : <><Play size={16} /> Начать</>}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Пустая половина для ПК */}
                <div className="hidden md:block w-1/2"></div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Финальный блок */}
      <div className="mt-16 md:mt-24 relative overflow-hidden rounded-3xl border border-yellow-500/30 bg-white dark:bg-[#121212]">
        <div className="absolute inset-0 bg-gradient-to-br from-yellow-600/20 via-transparent to-transparent"></div>
        <div className="relative p-8 md:p-10 flex flex-col items-center text-center">
          <ShieldCheck size={48} className={`mb-4 ${allDone ? 'text-yellow-500' : 'text-gray-400 dark:text-gray-600'}`} />
          <h2 className="text-2xl font-serif font-bold text-gray-900 dark:text-gray-100 mb-2">{allDone ? 'Испытание завершено' : 'Путь продолжается'}</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md mb-8">{allDone ? 'Ты прошел все главы. Теперь готов к реальному профилю Т-Инвест.' : 'Пройди все главы путешествия, чтобы открыть доступ к реальному профилю.'}</p>
          <div className="w-full max-w-sm bg-gray-50 dark:bg-black/50 rounded-2xl p-5 mb-8 border border-gray-200 dark:border-gray-800 backdrop-blur-sm">
            <div className="flex justify-between text-xs font-bold mb-2 text-gray-700 dark:text-gray-300">
              <span>Готовность</span>
              <span className="text-yellow-600 dark:text-yellow-500">{readiness.progress}%</span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-800 rounded-full h-2 mb-3 overflow-hidden">
              <div className="bg-gradient-to-r from-yellow-600 to-yellow-400 h-2 rounded-full transition-all duration-1000 ease-out" style={{ width: `${readiness.progress}%` }} />
            </div>
            <p className="text-[11px] text-gray-500 text-left">{readiness.reason}</p>
          </div>
          <button disabled={!(allDone && readiness.ready) || regState === 'loading' || regState === 'done'} onClick={registerRealProfile} className="w-full max-w-sm bg-yellow-500 text-black font-bold py-4 rounded-2xl disabled:opacity-30 disabled:cursor-not-allowed hover:bg-yellow-400 transition-all shadow-[0_0_20px_rgba(250,204,21,0.2)] hover:shadow-[0_0_30px_rgba(250,204,21,0.4)] flex items-center justify-center gap-2">
            {regState === 'loading' && <><Loader2 size={20} className="animate-spin" /> Создаём профиль…</>}
            {regState === 'done' && <><CheckCircle2 size={20} /> Профиль создан</>}
            {(regState === 'idle' || regState === 'error') && (allDone && readiness.ready ? 'Открыть реальный профиль' : 'Продолжай путешествие')}
          </button>

          {/* Статус регистрации: успех / ошибка */}
          {regState === 'done' && (
            <div className="w-full max-w-sm mt-4 flex items-start gap-2 p-3 rounded-xl bg-green-500/10 text-green-400 text-sm text-left">
              <CheckCircle2 size={18} className="shrink-0 mt-0.5" />
              <span className="flex-1">
                {regMessage}{' '}
                <button onClick={() => navigate('/settings')} className="underline font-bold hover:text-green-300">
                  К настройкам счёта →
                </button>
              </span>
            </div>
          )}
          {regState === 'error' && (
            <div className="w-full max-w-sm mt-4 flex items-start gap-2 p-3 rounded-xl bg-red-500/10 text-red-400 text-sm text-left">
              <X size={18} className="shrink-0 mt-0.5" />
              <span className="flex-1">{regMessage}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}