import { NavLink } from 'react-router-dom';
import { Home, BarChart2, User, Settings, Sun, Moon, BookOpen, Shirt } from 'lucide-react';

export default function Layout({ children, isDark, setIsDark }) {
  const navItems = [
    { path: '/', label: 'Главная', icon: Home },
    { path: '/story', label: 'Путешествие', icon: BookOpen },
    { path: '/market', label: 'Рынок', icon: BarChart2 },
    { path: '/wardrobe', label: 'Гардероб', icon: Shirt },
    { path: '/profile', label: 'Профиль', icon: User },
    { path: '/settings', label: 'Настройки', icon: Settings },
  ];

  return (
    <div className={`min-h-screen flex ${isDark ? 'bg-[#121212] text-white' : 'bg-[#f3f4f6] text-gray-900'} transition-colors`}>
      
      {/* 💻 ПК: Боковой Сайдбар */}
      <aside className={`hidden md:flex flex-col w-64 p-6 border-r ${isDark ? 'border-gray-800 bg-[#1a1a1a]' : 'border-gray-200 bg-white'}`}>
        <div className="flex items-center gap-2 text-xl font-bold mb-10">
          <span className="bg-yellow-400 text-black px-2 py-1 rounded-lg">T</span>
          <span>T-Start</span>
        </div>
        
        <nav className="flex flex-col gap-2 flex-1">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => `flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                isActive 
                  ? 'bg-yellow-400 text-black font-bold' 
                  : `hover:bg-gray-100 dark:hover:bg-gray-800 ${isDark ? 'text-gray-400' : 'text-gray-600'}`
              }`}
            >
              <item.icon size={20} />
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* Кнопка темы (внизу сайдбара) */}
        <button 
          onClick={() => setIsDark(!isDark)} 
          className={`mt-4 flex items-center gap-3 px-4 py-3 rounded-xl transition-all w-full hover:bg-gray-100 dark:hover:bg-gray-800 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}
        >
          {isDark ? <Sun size={20} /> : <Moon size={20} />}
          <span>Сменить тему</span>
        </button>
      </aside>

      {/* Контентная часть */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden relative">
        <div className="flex-1 overflow-y-auto p-4 md:p-8 pb-24 md:pb-8">
          {children}
        </div>

        {/* 📱 Мобилка: Нижняя навигация */}
        <nav className={`md:hidden fixed bottom-0 w-full flex justify-around items-center py-3 px-2 border-t ${isDark ? 'bg-[#1a1a1a] border-gray-800' : 'bg-white border-gray-200'}`}>
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
                            className={({ isActive }) => `flex flex-col items-center gap-1 flex-1 min-w-0 py-2 rounded-xl transition-all ${
                isActive ? 'text-yellow-500' : 'text-gray-400'
              }`}
            >
              <item.icon size={22} />
              <span className="text-[10px] font-medium truncate">{item.label}</span>
            </NavLink>
          ))}
          {/* Кнопка темы на мобилке (вместо настроек) */}
          <button onClick={() => setIsDark(!isDark)} className="flex flex-col items-center gap-1 flex-1 min-w-0 py-2 rounded-xl text-gray-400">
             {isDark ? <Sun size={22} /> : <Moon size={22} />}
             <span className="text-[10px]">Тема</span>
          </button>
        </nav>
      </main>
    </div>
  );
}