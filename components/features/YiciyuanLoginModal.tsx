import React, { useState, useCallback, useEffect } from 'react';
import { X, Mail, Phone, Lock, MessageSquare, Loader2, AlertCircle, Copy, Check } from 'lucide-react';
import { yiciyuanApi } from '../../lib/api';

interface YiciyuanLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: () => void;
  /** 诊断信息：凭据查找失败的具体原因，方便用户反馈 */
  diagnosticInfo?: string | null;
}

export const YiciyuanLoginModal: React.FC<YiciyuanLoginModalProps> = ({
  isOpen,
  onClose,
  onLoginSuccess,
  diagnosticInfo,
}) => {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [pcode, setPcode] = useState('');
  const [loginType, setLoginType] = useState<1 | 2>(1); // 1=密码, 2=验证码
  const [accountType, setAccountType] = useState<'email' | 'phone'>('email');
  const [loading, setLoading] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [codeCooldown, setCodeCooldown] = useState(0);
  const [diagCopied, setDiagCopied] = useState(false);

  // 验证码倒计时
  useEffect(() => {
    if (codeCooldown <= 0) return;
    const timer = setTimeout(() => setCodeCooldown(codeCooldown - 1), 1000);
    return () => clearTimeout(timer);
  }, [codeCooldown]);

  const handleSendCode = useCallback(async () => {
    if (!phone || codeCooldown > 0) return;
    setSendingCode(true);
    setError(null);
    try {
      await yiciyuanApi.sendCode(phone);
      setCodeCooldown(60);
    } catch (err) {
      setError(err instanceof Error ? err.message : '验证码发送失败');
    } finally {
      setSendingCode(false);
    }
  }, [phone, codeCooldown]);

  const handleLogin = useCallback(async () => {
    if (!phone) {
      setError(accountType === 'email' ? '请输入邮箱' : '请输入手机号');
      return;
    }
    if (loginType === 1 && !password) {
      setError('请输入密码');
      return;
    }
    if (loginType === 2 && !pcode) {
      setError('请输入验证码');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await yiciyuanApi.login({
        phone,
        password: loginType === 1 ? password : undefined,
        pcode: loginType === 2 ? pcode : undefined,
        type: loginType,
      });
      onLoginSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : '登录失败');
    } finally {
      setLoading(false);
    }
  }, [phone, password, pcode, loginType, onLoginSuccess]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white dark:bg-slate-800 rounded-3xl w-full max-w-sm p-6 space-y-4 shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold">役次元账号登录</h3>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full">
            <X size={20} />
          </button>
        </div>

        <p className="text-xs text-slate-500 dark:text-slate-400">
          请使用役次元 App 的账号登录，用于绑定和控制钥匙盒设备
        </p>

        {/* 诊断信息（凭据查找失败时展示） */}
        {diagnosticInfo && (
          <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-xl p-3 space-y-2">
            <div className="text-xs text-amber-700 dark:text-amber-400 font-medium">凭据获取失败，请将以下信息发送给管理员：</div>
            <div className="text-[10px] text-amber-600 dark:text-amber-500 font-mono bg-amber-100 dark:bg-amber-900 rounded-lg p-2 break-all whitespace-pre-wrap">
              {diagnosticInfo}
            </div>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(diagnosticInfo).then(() => {
                  setDiagCopied(true);
                  setTimeout(() => setDiagCopied(false), 2000);
                }).catch(() => {});
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-200 dark:bg-amber-800 rounded-lg text-[11px] text-amber-800 dark:text-amber-200 font-medium active:scale-[0.97] transition-all"
            >
              {diagCopied ? <><Check size={12} /> 已复制</> : <><Copy size={12} /> 复制诊断信息</>}
            </button>
          </div>
        )}

        {/* 登录方式切换 */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => { setLoginType(1); setError(null); }}
            className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all ${
              loginType === 1
                ? 'bg-primary text-white'
                : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
            }`}
          >
            密码登录
          </button>
          <button
            type="button"
            onClick={() => { setLoginType(2); setError(null); }}
            className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all ${
              loginType === 2
                ? 'bg-primary text-white'
                : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
            }`}
          >
            验证码登录
          </button>
        </div>

        {/* 账号（邮箱/手机号） */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-slate-500 dark:text-slate-400">
              {accountType === 'email' ? '邮箱' : '手机号'}
            </label>
            <button
              type="button"
              onClick={() => { setAccountType(prev => prev === 'email' ? 'phone' : 'email'); setPhone(''); setError(null); }}
              className="text-[10px] text-primary font-medium"
            >
              {accountType === 'email' ? '使用手机号' : '使用邮箱'}
            </button>
          </div>
          <div className="flex items-center gap-2 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5">
            {accountType === 'email' ? (
              <Mail size={16} className="text-slate-400 dark:text-slate-500 shrink-0" />
            ) : (
              <Phone size={16} className="text-slate-400 dark:text-slate-500 shrink-0" />
            )}
            <input
              type={accountType === 'email' ? 'email' : 'tel'}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder={accountType === 'email' ? '请输入邮箱' : '请输入手机号'}
              className="flex-1 text-sm outline-none bg-transparent"
              {...(accountType === 'phone' ? { maxLength: 11 } : {})}
            />
          </div>
        </div>

        {/* 密码 / 验证码 */}
        {loginType === 1 ? (
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-500 dark:text-slate-400">密码</label>
            <div className="flex items-center gap-2 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5">
              <Lock size={16} className="text-slate-400 dark:text-slate-500 shrink-0" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="请输入密码"
                className="flex-1 text-sm outline-none bg-transparent"
              />
            </div>
          </div>
        ) : (
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-500 dark:text-slate-400">验证码</label>
            <div className="flex items-center gap-2">
              <div className="flex-1 flex items-center gap-2 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5">
                <MessageSquare size={16} className="text-slate-400 dark:text-slate-500 shrink-0" />
                <input
                  type="text"
                  value={pcode}
                  onChange={(e) => setPcode(e.target.value)}
                  placeholder="输入验证码"
                  className="flex-1 text-sm outline-none bg-transparent"
                  maxLength={6}
                />
              </div>
              <button
                type="button"
                onClick={handleSendCode}
                disabled={!phone || codeCooldown > 0 || sendingCode}
                className="shrink-0 px-3 py-2.5 bg-primary/10 text-primary rounded-xl text-xs font-medium disabled:opacity-50"
              >
                {sendingCode ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : codeCooldown > 0 ? (
                  `${codeCooldown}s`
                ) : (
                  '发送'
                )}
              </button>
            </div>
          </div>
        )}

        {/* 错误提示 */}
        {error && (
          <div className="flex items-center gap-2 px-3 py-2 bg-red-50 dark:bg-red-950 rounded-xl text-xs text-red-600 dark:text-red-400">
            <AlertCircle size={14} className="shrink-0" />
            {error}
          </div>
        )}

        {/* 登录按钮 */}
        <button
          type="button"
          onClick={handleLogin}
          disabled={loading}
          className="w-full py-3 bg-primary text-white rounded-xl font-semibold text-sm disabled:opacity-50 transition-all active:scale-[0.98]"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 size={16} className="animate-spin" />
              登录中...
            </span>
          ) : (
            '登录'
          )}
        </button>
      </div>
    </div>
  );
};
