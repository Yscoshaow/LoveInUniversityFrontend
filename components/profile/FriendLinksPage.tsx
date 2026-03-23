import React from 'react';
import { ArrowLeft, ExternalLink, Users, MessageCircle } from 'lucide-react';
import { LinkPreview } from '@/src/components/ui/link-preview';

interface FriendLinksPageProps {
  onBack: () => void;
}

interface TelegramLink {
  name: string;
  url: string;
  description: string;
}

interface WebLink {
  name: string;
  url: string;
  description: string;
}

const telegramLinks: TelegramLink[] = [
  {
    name: 'LoveIn! University 官方群',
    url: 'https://t.me/lovein_university',
    description: '官方 Telegram 社区群组',
  },
  {
    name: '抖喵家',
    url: 'https://t.me/+IlzHq9003HpkMTc1',
    description: 'Telegram 社区',
  },
  {
    name: '美少女改造部',
    url: 'https://t.me/+ne52B9qJAQljY2Jh',
    description: 'Telegram 社区',
  }
];

const webLinks: WebLink[] = [
  {
    name: '郊狼 DG-Lab',
    url: 'https://dungeon-lab.com',
    description: '智能硬件与应用',
  },
  {
    name: 'Cloudflare',
    url: 'https://cloudflare.com',
    description: '全球网络基础设施',
  },
  {
    name: 'Ktor',
    url: 'https://ktor.io',
    description: 'Kotlin 异步 Web 框架',
  },
  {
    name: 'React',
    url: 'https://react.dev',
    description: 'UI 构建库',
  },
  {
    name: 'Tailwind CSS',
    url: 'https://tailwindcss.com',
    description: '实用优先的 CSS 框架',
  },
  {
    name: 'Mux',
    url: 'https://www.mux.com',
    description: '视频流媒体基础设施',
  },
  {
    name: 'Fap Roulette',
    url: 'https://faproulette.co',
    description: '轮盘游戏平台',
  },
  {
    name: 'Sissy Game',
    url: 'https://sissy.game/',
    description: '抖喵轮盘游戏库',
  },
  {
    name: 'ASMR One',
    url: 'https://asmr.one/works',
    description: 'ASMR 仓库 本站ASMR 提供者'
  }
];

export const FriendLinksPage: React.FC<FriendLinksPageProps> = ({ onBack }) => {
  return (
    <div className="h-full bg-slate-50 dark:bg-slate-900 flex flex-col overflow-y-auto no-scrollbar">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl border-b border-slate-100 dark:border-slate-700">
        <div className="flex items-center gap-3 px-4 py-3">
          <button
            onClick={onBack}
            className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          >
            <ArrowLeft size={20} className="text-slate-600 dark:text-slate-300" />
          </button>
          <h1 className="text-lg font-bold text-slate-800 dark:text-slate-100">友情链接</h1>
        </div>
      </div>

      <div className="p-4 pb-32 space-y-6">
        {/* Telegram Groups */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <MessageCircle size={16} className="text-blue-500 dark:text-blue-400" />
            <h2 className="text-sm font-semibold text-slate-600 dark:text-slate-300">Telegram 群组</h2>
          </div>
          <div className="space-y-2">
            {telegramLinks.map((link) => (
              <a
                key={link.url}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-3.5 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 hover:border-blue-200 dark:border-blue-800 hover:shadow-sm transition-all active:scale-[0.98]"
              >
                <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950 flex items-center justify-center shrink-0">
                  <Users size={18} className="text-blue-500 dark:text-blue-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-slate-800 dark:text-slate-100">{link.name}</div>
                  <div className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{link.description}</div>
                </div>
                <ExternalLink size={14} className="text-slate-300 shrink-0" />
              </a>
            ))}
          </div>
        </section>

        {/* Website Links with Preview */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <ExternalLink size={16} className="text-purple-500 dark:text-purple-400" />
            <h2 className="text-sm font-semibold text-slate-600 dark:text-slate-300">技术与友链</h2>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {webLinks.map((link) => (
              <LinkPreview key={link.url} url={link.url}>
                <div className="flex flex-col items-center gap-2 p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 hover:border-purple-200 dark:border-purple-800 hover:shadow-sm transition-all active:scale-[0.98] cursor-pointer">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-50 dark:from-purple-950 to-indigo-50 dark:to-indigo-950 flex items-center justify-center">
                    <img
                      src={`https://www.google.com/s2/favicons?domain=${new URL(link.url).hostname}&sz=32`}
                      alt=""
                      className="w-4 h-4"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  </div>
                  <div className="text-center">
                    <div className="text-xs font-medium text-slate-800 dark:text-slate-100">{link.name}</div>
                    <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">{link.description}</div>
                  </div>
                </div>
              </LinkPreview>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};

export default FriendLinksPage;
