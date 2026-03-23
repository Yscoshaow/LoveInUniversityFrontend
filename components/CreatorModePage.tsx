import React, { useState } from 'react';
import {
  ArrowLeft,
  BookOpen,
  ListTodo,
  Gavel,
  Sparkles,
  Package,
  ListChecks,
  ChevronRight,
  Settings,
  Wand2,
  MessageSquare,
  GraduationCap,
  ScrollText,
  Smile,
  ShieldCheck,
  MapPin,
} from 'lucide-react';
import { useAuth } from '../lib/auth-context';

// Sub-pages
import { CourseEditorPage } from './creator/CourseEditorPage';
import { TaskDefinitionEditorPage } from './creator/TaskDefinitionEditorPage';
import { PunishmentEditorPage } from './creator/PunishmentEditorPage';
import { BuffEditorPage } from './creator/BuffEditorPage';
import { ItemEditorPage } from './creator/ItemEditorPage';
import { OptionalTaskGroupEditorPage } from './creator/OptionalTaskGroupEditorPage';
import { FeedbackEditorPage } from './creator/FeedbackEditorPage';
import { MajorEditorPage } from './creator/MajorEditorPage';
import { ChangelogEditorPage } from './creator/ChangelogEditorPage';
import { BookEditorPage } from './creator/BookEditorPage';
import { StickerEditorPage } from './creator/StickerEditorPage';
import { ContentReviewPage } from './creator/ContentReviewPage';
import { LandmarkEditorPage } from './creator/LandmarkEditorPage';

type CreatorSubPage =
  | 'none'
  | 'courses'
  | 'tasks'
  | 'punishments'
  | 'buffs'
  | 'items'
  | 'optional-groups'
  | 'feedback'
  | 'majors'
  | 'changelog'
  | 'books'
  | 'stickers'
  | 'content-review'
  | 'landmarks';

interface CreatorModePageProps {
  onBack: () => void;
}

// Permission required for each menu item
const menuPermissions: Record<string, string> = {
  'courses': 'course.manage',
  'tasks': 'task.manage',
  'punishments': 'punishment.manage',
  'buffs': 'buff.manage',
  'items': 'item.manage',
  'optional-groups': 'task.manage',
  'feedback': 'feedback.manage',
  'majors': 'major.manage',
  'changelog': 'changelog.manage',
  'books': 'content.review',
  'stickers': 'sticker.manage',
  'content-review': 'content.review',
  'landmarks': 'landmark.manage',
};

export const CreatorModePage: React.FC<CreatorModePageProps> = ({ onBack }) => {
  const [subPage, setSubPage] = useState<CreatorSubPage>('none');
  const { hasPermission, roleNames } = useAuth();

  const allMenuItems = [
    {
      id: 'courses' as const,
      icon: BookOpen,
      label: '课程管理',
      description: '创建和编辑课程，设置前置课程和学分',
      color: 'text-blue-500 dark:text-blue-400',
      bg: 'bg-blue-50 dark:bg-blue-950',
    },
    {
      id: 'tasks' as const,
      icon: ListTodo,
      label: '任务定义',
      description: '管理课程任务，设置目标值和类型',
      color: 'text-green-500 dark:text-green-400',
      bg: 'bg-green-50 dark:bg-green-950',
    },
    {
      id: 'punishments' as const,
      icon: Gavel,
      label: '惩罚管理',
      description: '配置惩罚池和触发条件',
      color: 'text-red-500 dark:text-red-400',
      bg: 'bg-red-50 dark:bg-red-950',
    },
    {
      id: 'buffs' as const,
      icon: Sparkles,
      label: 'Buff管理',
      description: '创建和编辑增益效果',
      color: 'text-purple-500 dark:text-purple-400',
      bg: 'bg-purple-50 dark:bg-purple-950',
    },
    {
      id: 'items' as const,
      icon: Package,
      label: '道具管理',
      description: '管理商店道具和效果',
      color: 'text-amber-500 dark:text-amber-400',
      bg: 'bg-amber-50 dark:bg-amber-950',
    },
    {
      id: 'optional-groups' as const,
      icon: ListChecks,
      label: '选做任务组',
      description: '配置选做任务组和任务选项',
      color: 'text-cyan-500 dark:text-cyan-400',
      bg: 'bg-cyan-50 dark:bg-cyan-950',
    },
    {
      id: 'feedback' as const,
      icon: MessageSquare,
      label: '反馈管理',
      description: '查看和处理用户反馈',
      color: 'text-teal-500 dark:text-teal-400',
      bg: 'bg-teal-50 dark:bg-teal-950',
    },
    {
      id: 'majors' as const,
      icon: GraduationCap,
      label: '专业管理',
      description: '创建和编辑专业，配置课程组合',
      color: 'text-indigo-500 dark:text-indigo-400',
      bg: 'bg-indigo-50 dark:bg-indigo-950',
    },
    {
      id: 'changelog' as const,
      icon: ScrollText,
      label: '更新日志',
      description: '发布应用更新公告',
      color: 'text-emerald-500 dark:text-emerald-400',
      bg: 'bg-emerald-50 dark:bg-emerald-950',
    },
    {
      id: 'books' as const,
      icon: BookOpen,
      label: '图书管理',
      description: '管理图书馆中的图书和分类',
      color: 'text-blue-500 dark:text-blue-400',
      bg: 'bg-blue-50 dark:bg-blue-950',
    },
    {
      id: 'stickers' as const,
      icon: Smile,
      label: '贴纸管理',
      description: '管理贴纸组和上传贴纸文件',
      color: 'text-pink-500 dark:text-pink-400',
      bg: 'bg-pink-50 dark:bg-pink-950',
    },
    {
      id: 'content-review' as const,
      icon: ShieldCheck,
      label: '内容审核',
      description: '审核美术馆和电影院的用户上传',
      color: 'text-orange-500 dark:text-orange-400',
      bg: 'bg-orange-50 dark:bg-orange-950',
    },
    {
      id: 'landmarks' as const,
      icon: MapPin,
      label: '校园地标',
      description: '管理校园地标打卡点',
      color: 'text-emerald-500 dark:text-emerald-400',
      bg: 'bg-emerald-50 dark:bg-emerald-950',
    },
  ];

  // Filter menu items based on user permissions
  const menuItems = allMenuItems.filter(item => {
    const requiredPermission = menuPermissions[item.id];
    return requiredPermission ? hasPermission(requiredPermission) : true;
  });

  // Determine role display info
  const roleDisplay = roleNames.length > 0
    ? roleNames.join(' / ')
    : '管理员权限';

  // Render sub-pages
  if (subPage === 'courses') {
    return <CourseEditorPage onBack={() => setSubPage('none')} />;
  }
  if (subPage === 'tasks') {
    return <TaskDefinitionEditorPage onBack={() => setSubPage('none')} />;
  }
  if (subPage === 'punishments') {
    return <PunishmentEditorPage onBack={() => setSubPage('none')} />;
  }
  if (subPage === 'buffs') {
    return <BuffEditorPage onBack={() => setSubPage('none')} />;
  }
  if (subPage === 'items') {
    return <ItemEditorPage onBack={() => setSubPage('none')} />;
  }
  if (subPage === 'optional-groups') {
    return <OptionalTaskGroupEditorPage onBack={() => setSubPage('none')} />;
  }
  if (subPage === 'feedback') {
    return <FeedbackEditorPage onBack={() => setSubPage('none')} />;
  }
  if (subPage === 'majors') {
    return <MajorEditorPage onBack={() => setSubPage('none')} />;
  }
  if (subPage === 'changelog') {
    return <ChangelogEditorPage onBack={() => setSubPage('none')} />;
  }
  if (subPage === 'books') {
    return <BookEditorPage onBack={() => setSubPage('none')} />;
  }
  if (subPage === 'stickers') {
    return <StickerEditorPage onBack={() => setSubPage('none')} />;
  }
  if (subPage === 'content-review') {
    return <ContentReviewPage onBack={() => setSubPage('none')} />;
  }
  if (subPage === 'landmarks') {
    return <LandmarkEditorPage onBack={() => setSubPage('none')} />;
  }

  return (
    <div className="h-full bg-slate-50 dark:bg-slate-900 flex flex-col">
      {/* Header */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white p-6 pb-8">
        <div className="flex items-center gap-4 mb-4">
          <button
            onClick={onBack}
            className="w-10 h-10 rounded-full bg-white/10 dark:bg-slate-800/10 flex items-center justify-center hover:bg-white/20 dark:bg-slate-800/20 transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-bold">创作者模式</h1>
            <p className="text-xs text-white/60 mt-0.5">管理游戏内容和配置</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-lg">
            <Wand2 size={24} />
          </div>
        </div>

        {/* Info Card */}
        <div className="bg-white/10 dark:bg-slate-800/10 rounded-2xl p-4 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
              <Settings size={20} className="text-amber-400 dark:text-amber-300" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium">{roleDisplay}</p>
              <p className="text-xs text-white/60">
                {menuItems.length === allMenuItems.length
                  ? '你可以创建、编辑和预览所有内容'
                  : `你可以访问 ${menuItems.length} 个管理功能`}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 -mt-4">
        <div className="space-y-3">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setSubPage(item.id)}
              className="w-full bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-slate-100 dark:border-slate-700 flex items-center gap-4 hover:shadow-md transition-all active:scale-[0.98]"
            >
              <div className={`w-12 h-12 rounded-xl ${item.bg} ${item.color} flex items-center justify-center`}>
                <item.icon size={24} />
              </div>
              <div className="flex-1 text-left">
                <h3 className="font-bold text-slate-800 dark:text-slate-100">{item.label}</h3>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{item.description}</p>
              </div>
              <ChevronRight size={20} className="text-slate-300" />
            </button>
          ))}
        </div>

        {/* Footer */}
        <div className="mt-8 text-center">
          <p className="text-xs text-slate-400 dark:text-slate-500">
            所有更改将立即生效
          </p>
        </div>
      </div>
    </div>
  );
};

export default CreatorModePage;
