import React, { useState, useCallback, useMemo } from 'react';
import {
  GraduationCap,
  Sparkles,
  CheckCircle,
  Loader2,
  AlertCircle,
  Gift,
  Coins,
  Award,
  Globe
} from 'lucide-react';

// Telegram WebApp types
type EnrollmentStep = 'welcome' | 'verifying' | 'success' | 'error';

interface EnrollmentWelcomeProps {
  userName: string;
  onComplete: (timezone: string) => Promise<void>;
  isEnrolling?: boolean;
}

export const EnrollmentWelcome: React.FC<EnrollmentWelcomeProps> = ({
  userName,
  onComplete,
  isEnrolling = false,
}) => {
  const [step, setStep] = useState<EnrollmentStep>('welcome');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Detect user's local timezone
  const detectedTimezone = useMemo(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      return 'UTC';
    }
  }, []);

  // Get display name for timezone
  const getTimezoneDisplayName = (tz: string): string => {
    const timezoneNames: Record<string, string> = {
      'Asia/Shanghai': '中国标准时间 (UTC+8)',
      'Asia/Tokyo': '日本标准时间 (UTC+9)',
      'Asia/Seoul': '韩国标准时间 (UTC+9)',
      'Asia/Singapore': '新加坡时间 (UTC+8)',
      'Asia/Hong_Kong': '香港时间 (UTC+8)',
      'Asia/Taipei': '台北时间 (UTC+8)',
      'America/New_York': '美国东部时间',
      'America/Los_Angeles': '美国西部时间',
      'Europe/London': '英国时间',
      'Europe/Paris': '中欧时间',
      'Australia/Sydney': '澳大利亚东部时间',
      'UTC': '协调世界时 (UTC)',
    };
    return timezoneNames[tz] || tz;
  };

  // Start enrollment (directly verify, no biometric)
  const startEnrollment = useCallback(async () => {
    setStep('verifying');
    try {
      await onComplete(detectedTimezone);
      setStep('success');
    } catch {
      setErrorMessage('入学注册失败，请重试');
      setStep('error');
    }
  }, [onComplete, detectedTimezone]);

  // Retry after error
  const retry = useCallback(() => {
    setErrorMessage(null);
    setStep('welcome');
  }, []);

  // Get current date formatted
  const getCurrentDate = () => {
    const now = new Date();
    return `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日`;
  };

  return (
    <div className="h-dvh-safe w-full bg-white dark:bg-slate-800 flex flex-col overflow-hidden">
      {/* Welcome Step - Enrollment Letter */}
      {step === 'welcome' && (
        <div className="flex-1 overflow-y-auto no-scrollbar p-6 pb-32 lg:pb-8">
          {/* Header */}
          <div className="text-center mb-8 pt-4">
            <div className="w-20 h-20 mx-auto bg-secondary/10 rounded-full flex items-center justify-center mb-4">
              <GraduationCap size={40} className="text-secondary" />
            </div>
            <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">入学通知书</h1>
            <p className="text-slate-400 dark:text-slate-500 text-sm mt-1">ADMISSION LETTER</p>
          </div>

          {/* Letter Content Card */}
          <div className="bg-slate-50 dark:bg-slate-900 rounded-3xl p-6 mb-6">
            <p className="text-slate-400 dark:text-slate-500 text-xs mb-4">{getCurrentDate()}</p>

            <div className="space-y-4 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              <p>
                亲爱的 <span className="font-bold text-slate-800 dark:text-slate-100">{userName}</span> 同学：
              </p>

              <p>
                恭喜您被<span className="font-semibold text-secondary">LoveIn University</span>正式录取！
                我们非常高兴地通知您，经过严格审核，您已成功获得本校的入学资格。
              </p>

              <p>
                作为新生，您将获得以下入学礼包：
              </p>
            </div>
          </div>

          {/* Rewards Cards */}
          <div className="space-y-3 mb-6">
            <div className="flex items-center gap-4 bg-amber-50 dark:bg-amber-950 rounded-2xl p-4">
              <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center">
                <Coins size={24} className="text-amber-500 dark:text-amber-400" />
              </div>
              <div>
                <div className="font-bold text-slate-800 dark:text-slate-100">100 校园积分</div>
                <div className="text-xs text-slate-400 dark:text-slate-500">可用于商店购买道具</div>
              </div>
            </div>

            <div className="flex items-center gap-4 bg-purple-50 dark:bg-purple-950 rounded-2xl p-4">
              <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                <Gift size={24} className="text-purple-500 dark:text-purple-400" />
              </div>
              <div>
                <div className="font-bold text-slate-800 dark:text-slate-100">新生大礼包</div>
                <div className="text-xs text-slate-400 dark:text-slate-500">包含多种实用道具</div>
              </div>
            </div>

            <div className="flex items-center gap-4 bg-blue-50 dark:bg-blue-950 rounded-2xl p-4">
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                <Award size={24} className="text-blue-500 dark:text-blue-400" />
              </div>
              <div>
                <div className="font-bold text-slate-800 dark:text-slate-100">专属学生身份</div>
                <div className="text-xs text-slate-400 dark:text-slate-500">解锁全部校园功能</div>
              </div>
            </div>
          </div>

          {/* Detected Timezone Card */}
          <div className="bg-slate-50 dark:bg-slate-900 rounded-2xl p-4 mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-slate-200 dark:bg-slate-700 rounded-xl flex items-center justify-center">
                <Globe size={20} className="text-slate-500 dark:text-slate-400" />
              </div>
              <div className="flex-1">
                <div className="text-xs text-slate-400 dark:text-slate-500">检测到您的时区</div>
                <div className="font-medium text-sm text-slate-700 dark:text-slate-200">{getTimezoneDisplayName(detectedTimezone)}</div>
              </div>
            </div>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-2 pl-13">
              入学后可在「设置」中修改时区
            </p>
          </div>

          {/* Notice */}
          <div className="text-center text-slate-400 dark:text-slate-500 text-xs">
            <p>点击下方按钮完成入学手续</p>
          </div>
        </div>
      )}

      {/* Verifying Step */}
      {step === 'verifying' && (
        <div className="flex-1 flex flex-col items-center justify-center p-6">
          <div className="w-32 h-32 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center mb-8">
            <Loader2 size={48} className="text-secondary animate-spin" />
          </div>

          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">正在验证身份</h2>
          <p className="text-slate-400 dark:text-slate-500 text-sm">请稍候，正在处理您的入学申请...</p>
        </div>
      )}

      {/* Success Step */}
      {step === 'success' && (
        <div className="flex-1 flex flex-col items-center justify-center p-6">
          <div className="w-32 h-32 bg-green-100 rounded-full flex items-center justify-center mb-8">
            <CheckCircle size={56} className="text-green-500 dark:text-green-400" />
          </div>

          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">🎉 入学成功！</h2>
          <p className="text-slate-400 dark:text-slate-500 text-sm">欢迎加入LoveIn University，{userName}同学！</p>
        </div>
      )}

      {/* Error Step */}
      {step === 'error' && (
        <div className="flex-1 flex flex-col items-center justify-center p-6">
          <div className="w-32 h-32 bg-red-100 rounded-full flex items-center justify-center mb-8">
            <AlertCircle size={56} className="text-red-500 dark:text-red-400" />
          </div>

          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">验证失败</h2>
          <p className="text-slate-400 dark:text-slate-500 text-sm mb-8">{errorMessage || '身份验证未能完成'}</p>

          <div className="w-full max-w-xs space-y-3">
            <button
              onClick={retry}
              className="w-full py-4 bg-secondary text-white font-bold rounded-2xl active:scale-95 transition-transform"
            >
              重新注册
            </button>
          </div>
        </div>
      )}

      {/* Bottom Action Button - Only on Welcome Step */}
      {step === 'welcome' && (
        <div className="absolute bottom-0 left-0 right-0 bg-white dark:bg-slate-800 border-t border-slate-100 dark:border-slate-700 p-6 pb-8">
          <button
            onClick={startEnrollment}
            disabled={isEnrolling}
            className="w-full py-4 bg-secondary text-white font-bold rounded-2xl shadow-lg shadow-secondary/30 active:scale-95 transition-transform flex items-center justify-center gap-2 disabled:opacity-70"
          >
            <Sparkles size={20} />
            确认入学
          </button>
        </div>
      )}
    </div>
  );
};

export default EnrollmentWelcome;
