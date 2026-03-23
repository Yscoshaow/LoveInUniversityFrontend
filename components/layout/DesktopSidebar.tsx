import React from 'react';
import { Home, LayoutGrid, ShoppingBag, User, GraduationCap } from 'lucide-react';
import { useAuth, useUserDisplayName, useUserAvatar } from '../../lib/auth-context';

interface NavItem {
  id: string;
  icon: React.ElementType;
  label: string;
}

interface DesktopSidebarProps {
  activeTab: string;
  onTabChange: (tabId: string) => void;
}

const navItems: NavItem[] = [
  { id: 'home', icon: Home, label: '首页' },
  { id: 'campus', icon: LayoutGrid, label: '校园' },
  { id: 'shop', icon: ShoppingBag, label: '商店' },
  { id: 'profile', icon: User, label: '我的' },
];

export const DesktopSidebar: React.FC<DesktopSidebarProps> = ({
  activeTab,
  onTabChange,
}) => {
  const { user } = useAuth();
  const displayName = useUserDisplayName();
  const avatarUrl = useUserAvatar();

  return (
    <div className="w-full h-full bg-white dark:bg-slate-800 border-r border-slate-100 dark:border-slate-700 flex flex-col">
      {/* Branding */}
      <div className="px-5 pt-6 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-primary to-pink-500 rounded-xl flex items-center justify-center shadow-sm">
            <GraduationCap size={22} className="text-white" />
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-800 dark:text-slate-100 leading-tight">LoveIn</h1>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 leading-tight">University</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-2">
        <ul className="space-y-1">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <li key={item.id}>
                <button
                  onClick={() => onTabChange(item.id)}
                  className={`
                    w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium
                    transition-all duration-200
                    ${isActive
                      ? 'bg-primary/10 text-primary border-l-3 border-primary'
                      : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200'
                    }
                  `}
                >
                  <item.icon size={20} strokeWidth={isActive ? 2.5 : 2} />
                  <span>{item.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* User Info */}
      {user && (
        <div className="px-4 py-4 border-t border-slate-100 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <img
              src={avatarUrl}
              alt={displayName}
              className="w-9 h-9 rounded-full object-cover border border-slate-100 dark:border-slate-700"
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">{displayName}</p>
              {user.username && (
                <p className="text-xs text-slate-400 dark:text-slate-500 truncate">@{user.username}</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
