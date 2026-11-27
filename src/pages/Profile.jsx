import { useRef } from 'react';
import { Settings, Pencil, Trophy, Coins, BookOpen, Star, Shirt } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Mascot from '../components/Mascot';

export default function Profile({ userData, updateAvatar }) {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        updateAvatar(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="page-container page-container--default">
      <header className="flex justify-between items-center mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">Профиль</h1>
        <button onClick={() => navigate('/settings')} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors">
          <Settings size={24} className="text-gray-900 dark:text-white" />
        </button>
      </header>

      <div className="p-6 rounded-3xl mb-6 bg-white dark:bg-[#1e1e1e] border border-gray-100 dark:border-gray-800 shadow-sm dark:shadow-none">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-2xl relative overflow-hidden bg-yellow-400 flex items-center justify-center">
                              {userData.avatar ? (
                 <img src={userData.avatar} alt="Avatar" className="w-full h-full object-cover" />
               ) : (
                 <Mascot outfitId={userData.activeOutfit} size={64} />
               )}
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{userData.name}</h2>
              <p className="text-sm text-gray-500">Новичок</p>
            </div>
          </div>
          <button onClick={() => fileInputRef.current?.click()} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors">
            <Pencil size={20} className="text-gray-400" />
          </button>
          <input type="file" ref={fileInputRef} onChange={handleImageUpload} accept="image/*" className="hidden" />
        </div>
        
        <div className="inline-block px-3 py-1 rounded-md text-sm font-medium mb-4 bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400">
          Уровень 1 - Новичок
        </div>

                <div>
          <div className="flex justify-between text-xs mb-1 text-gray-500">
            <span>Путь к следующему уровню</span>
            <span className="font-bold text-gray-900 dark:text-white">0%</span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div className="bg-yellow-400 h-2 rounded-full" style={{ width: '0%' }}></div>
          </div>
        </div>

        <button
          onClick={() => navigate('/wardrobe')}
          className="mt-4 w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-yellow-400 text-black font-bold hover:bg-yellow-500 transition-colors"
        >
          <Shirt size={18} /> Гардероб
        </button>
      </div>

      <div className="flex justify-between items-center mb-3">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white">Мои достижения</h3>
      </div>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        {[
          { icon: Trophy, name: 'Первая сделка', status: userData.deals > 0 ? 'Получено' : 'Не получено', done: userData.deals > 0 },
          { icon: Coins, name: 'Купил на все 500 ₽', status: userData.portfolio >= 500 ? 'Получено' : 'Не получено', done: userData.portfolio >= 500 },
          { icon: BookOpen, name: '5 уроков', status: 'Не получено', done: false },
          { icon: Star, name: '7 дней подряд', status: 'Не получено', done: false },
        ].map((ach, i) => (
          <div key={i} className={`p-4 rounded-2xl flex flex-col items-center text-center bg-white dark:bg-[#1e1e1e] border border-gray-100 dark:border-gray-800 shadow-sm dark:shadow-none ${!ach.done && 'opacity-50'}`}>
             <ach.icon size={32} className={`mb-2 ${ach.done ? 'text-yellow-500' : 'text-gray-400'}`} />
             <p className="text-xs font-bold leading-tight text-gray-900 dark:text-white">{ach.name}</p>
             <p className={`text-[10px] mt-1 ${ach.done ? 'text-green-500' : 'text-gray-400'}`}>{ach.status}</p>
          </div>
        ))}
            </div>
    </div>
  );
}