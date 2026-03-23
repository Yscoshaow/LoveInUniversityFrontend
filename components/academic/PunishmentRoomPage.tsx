import React, { useState } from 'react';
import {
  ChevronLeft,
  Skull,
  Dices,
  RefreshCw,
  Loader2,
  Lock,
  Coins,
  AlertTriangle,
  Check,
} from 'lucide-react';
import { punishmentRoomApi, punishmentsApi } from '../../lib/api';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../../lib/query-client';
import type { PunishmentRoomItem } from '../../types';

interface PunishmentRoomPageProps {
  onBack: () => void;
}

type Severity = 'LIGHT' | 'MODERATE' | 'SEVERE' | 'HARDCORE';

interface SeverityOption {
  id: Severity;
  label: string;
  description: string;
  enabled: boolean;
  gradient: string;
}

const SEVERITY_OPTIONS: SeverityOption[] = [
  {
    id: 'LIGHT',
    label: '轻处分',
    description: '轻度惩罚',
    enabled: true,
    gradient: 'from-amber-400 to-orange-500',
  },
  {
    id: 'MODERATE',
    label: '处分',
    description: '敬请期待',
    enabled: false,
    gradient: 'from-orange-500 to-red-500',
  },
  {
    id: 'SEVERE',
    label: '重处分',
    description: '敬请期待',
    enabled: false,
    gradient: 'from-red-500 to-rose-600',
  },
  {
    id: 'HARDCORE',
    label: '硬核处分',
    description: '敬请期待',
    enabled: false,
    gradient: 'from-rose-600 to-purple-700',
  },
];

export const PunishmentRoomPage: React.FC<PunishmentRoomPageProps> = ({ onBack }) => {
  const queryClient = useQueryClient();
  const [rolling, setRolling] = useState(false);
  const [rerolling, setRerolling] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [result, setResult] = useState<PunishmentRoomItem | null>(null);
  const [userPunishmentId, setUserPunishmentId] = useState<number | null>(null);
  const [campusPoints, setCampusPoints] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [animating, setAnimating] = useState(false);
  const [claimed, setClaimed] = useState(false);

  const handleRoll = async (severity: Severity) => {
    setRolling(true);
    setError(null);
    setResult(null);
    setUserPunishmentId(null);
    setAnimating(true);
    setClaimed(false);

    try {
      await new Promise((r) => setTimeout(r, 800));
      const data = await punishmentRoomApi.roll(severity);
      setResult(data.punishment);
      setUserPunishmentId(data.userPunishmentId);
      setCampusPoints(data.campusPoints);
    } catch (err: any) {
      console.error('Roll failed:', err);
      setError(err?.message || '抽取失败，请重试');
    } finally {
      setRolling(false);
      setTimeout(() => setAnimating(false), 300);
    }
  };

  const handleReroll = async () => {
    if (!result || userPunishmentId === null) return;
    setRerolling(true);
    setError(null);
    setAnimating(true);

    try {
      await new Promise((r) => setTimeout(r, 800));
      const data = await punishmentRoomApi.reroll('LIGHT', userPunishmentId);
      setResult(data.punishment);
      setUserPunishmentId(data.userPunishmentId);
      setCampusPoints(data.campusPoints);
    } catch (err: any) {
      console.error('Reroll failed:', err);
      setError(err?.message || '重新抽取失败');
    } finally {
      setRerolling(false);
      setTimeout(() => setAnimating(false), 300);
    }
  };

  const handleClaim = async () => {
    if (userPunishmentId === null) return;
    setClaiming(true);
    setError(null);

    try {
      await punishmentsApi.claim(userPunishmentId);
      setClaimed(true);
      // Invalidate so ProfilePage's 纪律处分 count refreshes
      queryClient.invalidateQueries({ queryKey: queryKeys.behavior.penalties() });
      // Invalidate tasks so Dashboard schedule refreshes (punishment may create tasks)
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
    } catch (err: any) {
      console.error('Claim failed:', err);
      setError(err?.message || '确认执行失败');
    } finally {
      setClaiming(false);
    }
  };

  const handleReset = () => {
    setResult(null);
    setUserPunishmentId(null);
    setCampusPoints(null);
    setError(null);
    setClaimed(false);
  };

  return (
    <div className="h-full flex flex-col bg-slate-50 dark:bg-slate-900 lg:max-w-[900px] lg:mx-auto lg:w-full">
      {/* Header */}
      <div className="bg-gradient-to-br from-slate-800 via-slate-900 to-black text-white px-4 pt-12 lg:pt-8 pb-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/10 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-red-500/10 rounded-full translate-y-1/2 -translate-x-1/2" />

        <button
          onClick={onBack}
          className="absolute top-4 left-4 p-2 hover:bg-white/10 dark:bg-slate-800/10 rounded-full transition-colors"
        >
          <ChevronLeft size={24} />
        </button>

        <div className="text-center relative z-10">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-red-500/20 rounded-2xl mb-3">
            <Skull size={32} className="text-red-400" />
          </div>
          <h1 className="text-2xl font-bold mb-1">惩罚室</h1>
          <p className="text-white/60 text-sm">违反校规者在此接受惩罚</p>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* Campus Points Display */}
        {campusPoints !== null && (
          <div className="mb-4 bg-white dark:bg-slate-800 rounded-2xl p-3 flex items-center gap-3 shadow-sm border border-slate-100 dark:border-slate-700">
            <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950 flex items-center justify-center">
              <Coins size={20} className="text-amber-500 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">校园点余额</p>
              <p className="font-bold text-slate-800 dark:text-slate-100">{campusPoints}</p>
            </div>
          </div>
        )}

        {/* Result Card */}
        {result && (
          <div className={`mb-4 bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border transition-all duration-300 ${
            claimed ? 'border-green-200 dark:border-green-800' : 'border-red-100 dark:border-red-900'
          } ${animating ? 'scale-95 opacity-70' : 'scale-100 opacity-100'}`}>
            <div className="flex items-start gap-3 mb-4">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                claimed ? 'bg-green-50 dark:bg-green-950' : 'bg-red-50 dark:bg-red-950'
              }`}>
                {claimed ? (
                  <Check size={24} className="text-green-500 dark:text-green-400" />
                ) : (
                  <AlertTriangle size={24} className="text-red-500 dark:text-red-400" />
                )}
              </div>
              <div className="flex-1">
                <p className={`text-xs font-medium mb-1 ${claimed ? 'text-green-500 dark:text-green-400' : 'text-red-400'}`}>
                  {claimed ? '已确认执行' : '抽取结果'}
                </p>
                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">{result.name}</h3>
                {result.description && (
                  <p className="text-sm text-slate-600 dark:text-slate-300 mt-1 whitespace-pre-wrap">{result.description}</p>
                )}
              </div>
            </div>

            {/* Action buttons */}
            {claimed ? (
              <div className="flex gap-2">
                <p className="flex-1 text-sm text-green-600 dark:text-green-400 text-center py-2">
                  惩罚已生效，可在纪律处分中查看
                </p>
                <button
                  onClick={handleReset}
                  className="px-4 py-2.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl font-medium hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                >
                  完成
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={handleReroll}
                  disabled={rerolling || claiming}
                  className="flex-1 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl font-medium flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.98] transition-all shadow-sm"
                >
                  {rerolling ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <RefreshCw size={16} />
                  )}
                  重抽 (1 校园点)
                </button>
                <button
                  onClick={handleClaim}
                  disabled={claiming || rerolling}
                  className="flex-1 py-2.5 bg-red-500 text-white rounded-xl font-medium flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.98] transition-all shadow-sm hover:bg-red-600"
                >
                  {claiming ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Check size={16} />
                  )}
                  确认执行
                </button>
              </div>
            )}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mb-4 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-2xl p-4">
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}

        {/* Severity Buttons */}
        <div className="space-y-3 lg:grid lg:grid-cols-2 lg:gap-3 lg:space-y-0">
          <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 px-1 lg:col-span-2">选择处分等级</h2>
          {SEVERITY_OPTIONS.map((option) => (
            <button
              key={option.id}
              onClick={() => option.enabled && handleRoll(option.id)}
              disabled={!option.enabled || rolling || (result !== null && !claimed)}
              className={`w-full flex items-center gap-4 p-4 rounded-2xl border transition-all ${
                option.enabled && !result
                  ? 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700 active:scale-[0.98] hover:shadow-md'
                  : 'bg-slate-50 dark:bg-slate-900 border-slate-100 dark:border-slate-700 opacity-50 cursor-not-allowed'
              }`}
            >
              <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${option.gradient} flex items-center justify-center text-white shadow-lg`}>
                {rolling && option.enabled ? (
                  <Loader2 size={28} className="animate-spin" />
                ) : (
                  <Dices size={28} />
                )}
              </div>
              <div className="flex-1 text-left">
                <h3 className="font-semibold text-slate-800 dark:text-slate-100">{option.label}</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{option.description}</p>
              </div>
              {!option.enabled && (
                <Lock size={18} className="text-slate-400 dark:text-slate-500" />
              )}
            </button>
          ))}
        </div>

        {/* Info */}
        <div className="mt-6 bg-slate-100 dark:bg-slate-700 rounded-2xl p-4">
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            抽取惩罚后，可以花费 1 校园点重新随机。确认执行后惩罚将生效，可在纪律处分页面查看。
          </p>
        </div>
      </div>
    </div>
  );
};

export default PunishmentRoomPage;
