import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ChevronLeft,
  Trophy,
  Medal,
  Crown,
  Star,
  Loader2,
  User as UserIcon,
  TrendingUp,
  EyeOff,
  ScrollText,
  Tag,
} from 'lucide-react';
import { userProfileApi, changelogApi } from '../../lib/api';
import { LeaderboardEntry, ChangelogData } from '../../types';
import { useUserProfileNavigation } from '../layout/MainLayout';

interface AuditoriumPageProps {
  onBack: () => void;
}

export const AuditoriumPage: React.FC<AuditoriumPageProps> = ({ onBack }) => {
  const { viewUserProfile } = useUserProfileNavigation();

  // Fetch leaderboard data
  const { data: leaderboardData, isLoading, error } = useQuery({
    queryKey: ['credits-leaderboard'],
    queryFn: () => userProfileApi.getCreditsLeaderboard(20),
  });

  // Fetch changelogs
  const { data: changelogs, isLoading: changelogsLoading } = useQuery({
    queryKey: ['changelogs'],
    queryFn: () => changelogApi.getAll(20),
  });

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Crown size={20} className="text-yellow-500" />;
      case 2:
        return <Medal size={20} className="text-slate-400 dark:text-slate-500" />;
      case 3:
        return <Medal size={20} className="text-amber-600 dark:text-amber-400" />;
      default:
        return null;
    }
  };

  const getRankBgColor = (rank: number) => {
    switch (rank) {
      case 1:
        return 'bg-gradient-to-r from-yellow-50 dark:from-yellow-950 to-amber-50 dark:to-amber-950 border-yellow-200';
      case 2:
        return 'bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 border-slate-200 dark:border-slate-700';
      case 3:
        return 'bg-gradient-to-r from-amber-50 dark:from-amber-950 to-orange-50 dark:to-orange-950 border-amber-200 dark:border-amber-800';
      default:
        return 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700';
    }
  };

  const handleUserClick = (userId: number) => {
    viewUserProfile(userId);
  };

  return (
    <div className="h-full flex flex-col bg-slate-50 dark:bg-slate-900 lg:max-w-[1200px] lg:mx-auto lg:w-full">
      {/* Header */}
      <div className="bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700 text-white px-4 pt-12 lg:pt-8 pb-6 relative overflow-hidden">
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 dark:bg-slate-800/10 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 dark:bg-slate-800/10 rounded-full translate-y-1/2 -translate-x-1/2" />

        {/* Back button */}
        <button
          onClick={onBack}
          className="absolute top-4 left-4 p-2 hover:bg-white/10 dark:bg-slate-800/10 rounded-full transition-colors"
        >
          <ChevronLeft size={24} />
        </button>

        {/* Title */}
        <div className="text-center relative z-10">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white/20 dark:bg-slate-800/20 rounded-2xl mb-3">
            <Trophy size={32} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold mb-1">礼堂</h1>
          <p className="text-white/70 text-sm">学分排行榜</p>
        </div>

        {/* My Rank Badge */}
        {leaderboardData?.myRank && (
          <div className="absolute top-4 right-4 bg-white/20 dark:bg-slate-800/20 backdrop-blur-sm rounded-xl px-3 py-2">
            <div className="text-[10px] text-white/70 uppercase tracking-wide">我的排名</div>
            <div className="text-lg font-bold text-center">#{leaderboardData.myRank}</div>
          </div>
        )}
        {leaderboardData && !leaderboardData.myRank && (
          <div className="absolute top-4 right-4 bg-white/20 dark:bg-slate-800/20 backdrop-blur-sm rounded-xl px-3 py-2 flex items-center gap-1.5">
            <EyeOff size={14} className="text-white/70" />
            <span className="text-xs text-white/70">未参与</span>
          </div>
        )}
      </div>

      {/* Stats Bar */}
      <div className="bg-white dark:bg-slate-800 px-4 py-3 border-b border-slate-100 dark:border-slate-700 flex justify-around">
        <div className="text-center">
          <div className="text-lg font-bold text-violet-600 dark:text-violet-400">
            {leaderboardData?.totalParticipants || 0}
          </div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wide">参与人数</div>
        </div>
        <div className="w-px bg-slate-200 dark:bg-slate-700" />
        <div className="text-center">
          <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
            {leaderboardData?.entries[0]?.credits || 0}
          </div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wide">最高学分</div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="p-4 space-y-3">
            {/* Podium skeleton */}
            <div className="flex items-end justify-center gap-2 mb-6 pt-4">
              {[14, 18, 14].map((size, i) => (
                <div key={i} className="flex flex-col items-center">
                  <div className={`bg-slate-200 dark:bg-slate-700 animate-pulse rounded-full ${i === 1 ? 'w-[72px] h-[72px]' : 'w-14 h-14'}`} />
                  <div className="bg-slate-200 dark:bg-slate-700 animate-pulse rounded-xl h-3 w-16 mt-2" />
                  <div className="bg-slate-200 dark:bg-slate-700 animate-pulse rounded-xl h-2 w-12 mt-1" />
                  <div className={`bg-slate-200 dark:bg-slate-700 animate-pulse rounded-t-lg w-16 mt-2 ${i === 1 ? 'h-24' : i === 0 ? 'h-16' : 'h-12'}`} />
                </div>
              ))}
            </div>

            {/* Leaderboard row skeletons */}
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700">
                <div className="bg-slate-200 dark:bg-slate-700 animate-pulse rounded-full w-8 h-8" />
                <div className="bg-slate-200 dark:bg-slate-700 animate-pulse rounded-full w-10 h-10" />
                <div className="flex-1">
                  <div className="bg-slate-200 dark:bg-slate-700 animate-pulse rounded-xl h-4 w-24 mb-1" />
                  <div className="bg-slate-200 dark:bg-slate-700 animate-pulse rounded-xl h-3 w-12" />
                </div>
                <div className="text-right">
                  <div className="bg-slate-200 dark:bg-slate-700 animate-pulse rounded-xl h-4 w-10 mb-1 ml-auto" />
                  <div className="bg-slate-200 dark:bg-slate-700 animate-pulse rounded-xl h-2 w-8 ml-auto" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-64 px-4">
            <div className="text-slate-400 dark:text-slate-500 text-center">
              <p className="mb-2">加载失败</p>
              <p className="text-sm">{(error as Error).message}</p>
            </div>
          </div>
        ) : leaderboardData?.entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 px-4">
            <Trophy size={48} className="text-slate-300 mb-3" />
            <p className="text-slate-500 dark:text-slate-400 text-center">暂无排行数据</p>
            <p className="text-slate-400 dark:text-slate-500 text-sm text-center mt-1">完成课程获取学分参与排名</p>
          </div>
        ) : (
          <div className="p-4 space-y-3 lg:grid lg:grid-cols-3 lg:gap-6 lg:space-y-0">
            {/* Leaderboard Column */}
            <div className="lg:col-span-2 space-y-3">
            {/* Top 3 Podium (special display) */}
            {leaderboardData && leaderboardData.entries.length >= 3 && (
              <div className="flex items-end justify-center gap-2 mb-6 pt-4">
                {/* 2nd Place */}
                <div className="flex flex-col items-center">
                  <button
                    onClick={() => handleUserClick(leaderboardData.entries[1].id)}
                    className="relative"
                  >
                    {leaderboardData.entries[1].photoUrl ? (
                      <img
                        src={leaderboardData.entries[1].photoUrl}
                        className="w-14 h-14 rounded-full object-cover border-2 border-slate-300 dark:border-slate-600"
                        alt=""
                      />
                    ) : (
                      <div className="w-14 h-14 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center border-2 border-slate-300 dark:border-slate-600">
                        <UserIcon size={24} className="text-slate-400 dark:text-slate-500" />
                      </div>
                    )}
                    <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-slate-400 rounded-full flex items-center justify-center text-white text-xs font-bold">
                      2
                    </div>
                  </button>
                  <div className="mt-2 text-center">
                    <div className="text-sm font-semibold text-slate-700 dark:text-slate-200 truncate max-w-[80px]">
                      {leaderboardData.entries[1].firstName}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">{leaderboardData.entries[1].credits} 学分</div>
                  </div>
                  <div className="w-16 h-16 bg-slate-200 dark:bg-slate-700 rounded-t-lg mt-2" />
                </div>

                {/* 1st Place */}
                <div className="flex flex-col items-center -mt-4">
                  <button
                    onClick={() => handleUserClick(leaderboardData.entries[0].id)}
                    className="relative"
                  >
                    {leaderboardData.entries[0].photoUrl ? (
                      <img
                        src={leaderboardData.entries[0].photoUrl}
                        className="w-18 h-18 w-[72px] h-[72px] rounded-full object-cover border-3 border-yellow-400 shadow-lg"
                        alt=""
                      />
                    ) : (
                      <div className="w-18 h-18 w-[72px] h-[72px] rounded-full bg-yellow-100 flex items-center justify-center border-3 border-yellow-400 shadow-lg">
                        <UserIcon size={32} className="text-yellow-500" />
                      </div>
                    )}
                    <div className="absolute -bottom-1 -right-1 w-7 h-7 bg-yellow-500 rounded-full flex items-center justify-center shadow-md">
                      <Crown size={16} className="text-white" />
                    </div>
                  </button>
                  <div className="mt-2 text-center">
                    <div className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate max-w-[80px]">
                      {leaderboardData.entries[0].firstName}
                    </div>
                    <div className="text-xs text-yellow-600 font-semibold">{leaderboardData.entries[0].credits} 学分</div>
                  </div>
                  <div className="w-16 h-24 bg-yellow-200 rounded-t-lg mt-2" />
                </div>

                {/* 3rd Place */}
                <div className="flex flex-col items-center">
                  <button
                    onClick={() => handleUserClick(leaderboardData.entries[2].id)}
                    className="relative"
                  >
                    {leaderboardData.entries[2].photoUrl ? (
                      <img
                        src={leaderboardData.entries[2].photoUrl}
                        className="w-14 h-14 rounded-full object-cover border-2 border-amber-400"
                        alt=""
                      />
                    ) : (
                      <div className="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center border-2 border-amber-400">
                        <UserIcon size={24} className="text-amber-500 dark:text-amber-400" />
                      </div>
                    )}
                    <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-amber-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
                      3
                    </div>
                  </button>
                  <div className="mt-2 text-center">
                    <div className="text-sm font-semibold text-slate-700 dark:text-slate-200 truncate max-w-[80px]">
                      {leaderboardData.entries[2].firstName}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">{leaderboardData.entries[2].credits} 学分</div>
                  </div>
                  <div className="w-16 h-12 bg-amber-200 rounded-t-lg mt-2" />
                </div>
              </div>
            )}

            {/* Rest of the list (4th onwards) */}
            {leaderboardData?.entries.slice(3).map((entry) => (
              <button
                key={entry.id}
                onClick={() => handleUserClick(entry.id)}
                className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all active:scale-[0.98] ${getRankBgColor(entry.rank)}`}
              >
                {/* Rank */}
                <div className="w-8 h-8 flex items-center justify-center">
                  {getRankIcon(entry.rank) || (
                    <span className="text-slate-500 dark:text-slate-400 font-bold">{entry.rank}</span>
                  )}
                </div>

                {/* Avatar */}
                <div className="relative">
                  {entry.photoUrl ? (
                    <img
                      src={entry.photoUrl}
                      className="w-10 h-10 rounded-full object-cover"
                      alt=""
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center">
                      <UserIcon size={18} className="text-slate-400 dark:text-slate-500" />
                    </div>
                  )}
                  {entry.isPremium && (
                    <Star size={12} className="absolute -top-1 -right-1 text-amber-500 dark:text-amber-400 fill-amber-500" />
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0 text-left">
                  <div className="font-semibold text-slate-800 dark:text-slate-100 truncate">
                    {entry.firstName}
                    {entry.lastName && ` ${entry.lastName}`}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    Lv.{entry.level}
                  </div>
                </div>

                {/* Credits */}
                <div className="text-right">
                  <div className="font-bold text-violet-600 dark:text-violet-400">{entry.credits}</div>
                  <div className="text-[10px] text-slate-400 dark:text-slate-500">学分</div>
                </div>
              </button>
            ))}
          </div>{/* end leaderboard column */}

          {/* Changelog Column */}
          <div className="pb-6 lg:col-span-1">
          <div className="flex items-center gap-2 mb-3 mt-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center">
              <ScrollText size={16} className="text-emerald-600 dark:text-emerald-400" />
            </div>
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">更新日志</h2>
          </div>

          {changelogsLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-100 dark:border-slate-700">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="bg-slate-200 dark:bg-slate-700 animate-pulse rounded-full h-5 w-12" />
                      <div className="bg-slate-200 dark:bg-slate-700 animate-pulse rounded-xl h-4 w-28" />
                    </div>
                    <div className="bg-slate-200 dark:bg-slate-700 animate-pulse rounded-xl h-3 w-16" />
                  </div>
                  <div className="space-y-1.5">
                    <div className="bg-slate-200 dark:bg-slate-700 animate-pulse rounded-xl h-3 w-full" />
                    <div className="bg-slate-200 dark:bg-slate-700 animate-pulse rounded-xl h-3 w-5/6" />
                    <div className="bg-slate-200 dark:bg-slate-700 animate-pulse rounded-xl h-3 w-2/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : !changelogs || changelogs.length === 0 ? (
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 text-center border border-slate-100 dark:border-slate-700">
              <ScrollText size={36} className="text-slate-300 mx-auto mb-2" />
              <p className="text-slate-400 dark:text-slate-500 text-sm">暂无更新日志</p>
            </div>
          ) : (
            <div className="space-y-3">
              {changelogs.map((log) => (
                <div
                  key={log.id}
                  className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-100 dark:border-slate-700 shadow-sm"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      {log.version && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded-full flex-shrink-0">
                          <Tag size={10} />
                          {log.version}
                        </span>
                      )}
                      <h3 className="font-semibold text-slate-800 dark:text-slate-100 truncate">{log.title}</h3>
                    </div>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 flex-shrink-0 ml-2">
                      {new Date(log.createdAt).toLocaleDateString('zh-CN')}
                    </span>
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                    {log.content}
                  </p>
                </div>
              ))}
            </div>
          )}
          </div>
        </div>
      )}
      </div>
    </div>
  );
};

export default AuditoriumPage;
