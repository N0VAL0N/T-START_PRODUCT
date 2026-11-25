import { useState } from 'react';

// Переключатель-тумблер (используется в настройках).
export default function Toggle({ defaultChecked = false }) {
  const [isOn, setIsOn] = useState(defaultChecked);
  return (
    <div
      onClick={() => setIsOn(!isOn)}
      className={`w-12 h-6 rounded-full relative cursor-pointer transition-colors ${isOn ? 'bg-yellow-400' : 'bg-gray-300 dark:bg-gray-600'}`}
    >
      <div className={`w-5 h-5 rounded-full bg-white absolute top-0.5 transition-all ${isOn ? 'right-0.5' : 'left-0.5'}`}></div>
    </div>
  );
}
