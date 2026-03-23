import React from 'react';
import { Home, LayoutGrid, ShoppingBag, User } from 'lucide-react';

interface NavItem {
  id: string;
  icon: React.ElementType;
  label: string;
}

interface BottomNavBarProps {
  activeTab: string;
  onTabChange: (tabId: string) => void;
  visible?: boolean;
}

const navItems: NavItem[] = [
  { id: 'home', icon: Home, label: 'Home' },
  { id: 'campus', icon: LayoutGrid, label: 'Tasks' },
  { id: 'shop', icon: ShoppingBag, label: 'Shop' },
  { id: 'profile', icon: User, label: 'Profile' },
];

export const BottomNavBar: React.FC<BottomNavBarProps> = ({
  activeTab,
  onTabChange,
  visible = true,
}) => {
  return (
    <div
      className={`absolute bottom-5 left-5 right-5 h-[76px] bg-white dark:bg-slate-800 rounded-[32px]
        shadow-[0_15px_40px_-5px_rgba(0,0,0,0.1)] flex justify-between items-center
        px-6 z-20 border border-slate-50 dark:border-slate-700
        transition-all duration-300 ${visible ? 'translate-y-0 opacity-100' : 'translate-y-[calc(100%+20px)] opacity-0 pointer-events-none'}`}
    >
      {navItems.map((item) => {
        const isActive = activeTab === item.id;
        return (
          <button
            key={item.id}
            onClick={() => onTabChange(item.id)}
            className={`flex flex-col items-center justify-center gap-1 transition-all duration-300 relative ${
              isActive ? '-translate-y-4' : ''
            }`}
          >
            <div
              className={`
                w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 border-4 border-white dark:border-slate-800
                ${
                  isActive
                    ? 'bg-primary text-white shadow-glow-primary scale-110'
                    : 'bg-transparent text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                }
              `}
            >
              <item.icon size={22} strokeWidth={isActive ? 2.5 : 2} />
            </div>

            <div
              className={`absolute -bottom-5 transition-all duration-300 ${
                isActive ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'
              }`}
            >
              <span className="text-[10px] font-bold text-primary tracking-wide">
                {item.label}
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
};
