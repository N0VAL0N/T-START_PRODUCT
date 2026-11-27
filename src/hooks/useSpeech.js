// ===== useSpeech: озвучка (Web Speech API) =====
// Вынесено из Story.jsx. Возвращает { speak, stop, isSpeaking, supported }.
// Аккуратно с жизненным циклом: отменяем речь при размонтировании и новом speak(),
// чтобы не было «наложений» и бесконечных циклов автовоспроизведения.
//
// speak(text, { onEnd }) — озвучить текст; onEnd вызовется по завершении (если не отменено).
// stop() — прервать текущую озвучку.
import { useCallback, useEffect, useRef, useState } from 'react';

function getRussianVoice() {
  if (typeof window === 'undefined' || !window.speechSynthesis) return null;
  const voices = window.speechSynthesis.getVoices();
  return voices.find((v) => v.lang && v.lang.toLowerCase().includes('ru')) || voices[0] || null;
}

export function useSpeech() {
  const [isSpeaking, setIsSpeaking] = useState(false);
  // Токен текущей озвучки: инвалидирует старые async-колбэки (onend/onerror),
  // чтобы отменённая/устаревшая речь не слала onEnd и не запускала автопереход.
  const tokenRef = useRef(0);
  const supported = typeof window !== 'undefined' && !!window.speechSynthesis;

  const stop = useCallback(() => {
    tokenRef.current += 1;
    if (supported) window.speechSynthesis.cancel();
    setIsSpeaking(false);
  }, [supported]);

  const speak = useCallback((text, { onEnd } = {}) => {
    if (!supported || !text) return;
    // Каждый вызов получает свой токен — старые utterance перестают «слышать» onend.
    const myToken = ++tokenRef.current;

    // Фикс для хромоподобных (Яндекс): сброс очереди + «разбудить» движок.
    window.speechSynthesis.cancel();

    // Небольшая задержка, чтобы движок успел проснуться.
    setTimeout(() => {
      if (myToken !== tokenRef.current) return; // отменено, пока ждали

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'ru-RU';
      const voice = getRussianVoice();
      if (voice) utterance.voice = voice;
      utterance.rate = 1;

      utterance.onstart = () => {
        if (myToken === tokenRef.current) setIsSpeaking(true);
      };
      utterance.onend = () => {
        if (myToken !== tokenRef.current) return; // устаревшая речь
        setIsSpeaking(false);
        onEnd?.();
      };
      utterance.onerror = (e) => {
        if (myToken !== tokenRef.current) return;
        console.error('Speech error:', e?.error || e);
        setIsSpeaking(false);
        // Ретрай для Яндекса при synthesis-failed (чуть медленнее, без голоса).
        if (e?.error === 'synthesis-failed') {
          const retry = new SpeechSynthesisUtterance(text);
          retry.lang = 'ru-RU';
          retry.rate = 0.9;
          retry.onend = () => { if (myToken === tokenRef.current) { setIsSpeaking(false); onEnd?.(); } };
          window.speechSynthesis.speak(retry);
        }
      };

      window.speechSynthesis.speak(utterance);
    }, 50);
  }, [supported]);

  // При размонтировании — глушим речь (иначе она «переживёт» экран).
  useEffect(() => () => {
    tokenRef.current += 1;
    if (supported) window.speechSynthesis.cancel();
  }, [supported]);

  return { speak, stop, isSpeaking, supported };
}
