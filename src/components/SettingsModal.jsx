import { X } from 'lucide-react';
import { createPortal } from 'react-dom';

// Модалка рендерится порталом в <body> и с z-[100] — выше нижней навигации (z-50),
// поэтому её никогда не перекрывает таб-бар (в т.ч. на iOS/Android).
export default function SettingsModal({ title, children, onClose }) {
  return createPortal(
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] p-4 backdrop-blur-sm">
      <div className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-3xl p-6 bg-white dark:bg-[#1e1e1e] border border-gray-100 dark:border-gray-800">
        <div className="flex justify-between items-center mb-6">
          <h3 className="font-bold text-lg text-gray-900 dark:text-white">{title}</h3>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors">
            <X size={24} />
          </button>
        </div>
        <div className="text-gray-700 dark:text-gray-300">
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
}