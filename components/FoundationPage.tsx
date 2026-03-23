import React, { useState, useMemo } from 'react';
import {
  ArrowLeft,
  Heart,
  Copy,
  ExternalLink,
  Plus,
  Trash2,
  Check,
  Loader2,
  Send,
  DollarSign,
  Users as UsersIcon,
  FileText,
  Wallet,
  ChevronDown,
  ChevronUp,
  X,
  ArrowDownLeft,
  ArrowUpRight,
  RefreshCw,
  GraduationCap,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { foundationApi, adminFoundationApi } from '@/lib/api';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-client';
import {
  useFoundationBalance,
  useFoundationTransfers,
  FOUNDATION_WALLET,
  type OnChainTransfer,
} from '@/hooks/useFoundationOnChain';
import type {
  FoundationApplicationStatus,
  CreateFoundationApplicationRequest,
  CreateFoundationTransactionRequest,
  CreateFoundationSponsorRequest,
  FoundationTransactionData,
} from '@/types';

interface FoundationPageProps {
  onBack: () => void;
}

const statusConfig: Record<FoundationApplicationStatus, { label: string; color: string; bg: string }> = {
  PENDING: { label: '待审核', color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-950' },
  APPROVED: { label: '已通过', color: 'text-green-600 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-950' },
  REJECTED: { label: '已拒绝', color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-950' },
};

function shortenAddress(addr: string) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function formatUSDC(value: string) {
  const num = parseFloat(value);
  if (isNaN(num)) return value;
  return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export const FoundationPage: React.FC<FoundationPageProps> = ({ onBack }) => {
  const { user: authUser, hasPermission } = useAuth();
  const isAdmin = hasPermission('foundation.manage');
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<'intro' | 'transactions' | 'sponsors' | 'apply'>('intro');
  const [copied, setCopied] = useState(false);

  // Application form state
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [submitSuccess, setSubmitSuccess] = useState(false);

  // Admin form states
  const [showAddTx, setShowAddTx] = useState(false);
  const [txHash, setTxHash] = useState('');
  const [txDescription, setTxDescription] = useState('');
  const [txAmount, setTxAmount] = useState('');
  const [txFromAddress, setTxFromAddress] = useState('');

  const [showAddSponsor, setShowAddSponsor] = useState(false);
  const [sponsorName, setSponsorName] = useState('');
  const [sponsorMessage, setSponsorMessage] = useState('');
  const [sponsorAmount, setSponsorAmount] = useState('');

  // Admin application management
  const [expandedAppId, setExpandedAppId] = useState<number | null>(null);
  const [adminNote, setAdminNote] = useState('');

  // ====== Data Queries ======

  const { data: overview, isLoading: overviewLoading } = useQuery({
    queryKey: queryKeys.foundation.overview,
    queryFn: foundationApi.getOverview,
  });

  const { data: myApplications } = useQuery({
    queryKey: queryKeys.foundation.myApplications,
    queryFn: foundationApi.getMyApplications,
    enabled: activeTab === 'apply',
  });

  const { data: allApplications } = useQuery({
    queryKey: queryKeys.foundation.allApplications,
    queryFn: () => adminFoundationApi.getAllApplications(),
    enabled: activeTab === 'apply' && isAdmin,
  });

  // On-chain data
  const { data: usdcBalance, isLoading: balanceLoading, refetch: refetchBalance } = useFoundationBalance();
  const { data: onChainTransfers, isLoading: transfersLoading, refetch: refetchTransfers } = useFoundationTransfers();

  // Build annotation map from admin-curated transactions (txHash -> annotation)
  const annotationMap = useMemo(() => {
    const map = new Map<string, FoundationTransactionData>();
    if (overview?.transactions) {
      for (const tx of overview.transactions) {
        map.set(tx.txHash.toLowerCase(), tx);
      }
    }
    return map;
  }, [overview?.transactions]);

  // Shuffle sponsors for unranked display
  const shuffledSponsors = useMemo(() => {
    if (!overview?.sponsors) return [];
    const arr = [...overview.sponsors];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }, [overview?.sponsors]);

  // ====== Mutations ======

  const submitAppMutation = useMutation({
    mutationFn: (req: CreateFoundationApplicationRequest) => foundationApi.createApplication(req),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.foundation.myApplications });
      setFormTitle('');
      setFormDescription('');
      setFormAmount('');
      setSubmitSuccess(true);
      setTimeout(() => setSubmitSuccess(false), 3000);
    },
  });

  const addTxMutation = useMutation({
    mutationFn: (req: CreateFoundationTransactionRequest) => adminFoundationApi.createTransaction(req),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.foundation.overview });
      setTxHash(''); setTxDescription(''); setTxAmount(''); setTxFromAddress('');
      setShowAddTx(false);
    },
  });

  const deleteTxMutation = useMutation({
    mutationFn: (id: number) => adminFoundationApi.deleteTransaction(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.foundation.overview }),
  });

  const addSponsorMutation = useMutation({
    mutationFn: (req: CreateFoundationSponsorRequest) => adminFoundationApi.createSponsor(req),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.foundation.overview });
      setSponsorName(''); setSponsorMessage(''); setSponsorAmount('');
      setShowAddSponsor(false);
    },
  });

  const deleteSponsorMutation = useMutation({
    mutationFn: (id: number) => adminFoundationApi.deleteSponsor(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.foundation.overview }),
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status, note }: { id: number; status: FoundationApplicationStatus; note?: string }) =>
      adminFoundationApi.updateApplicationStatus(id, { status, adminNote: note }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.foundation.allApplications });
      setExpandedAppId(null);
      setAdminNote('');
    },
  });

  // ====== Handlers ======

  const handleCopyAddress = async () => {
    try {
      await navigator.clipboard.writeText(FOUNDATION_WALLET);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* ignore */ }
  };

  const handleSubmitApplication = () => {
    if (!formTitle.trim() || !formDescription.trim() || !formAmount.trim()) return;
    submitAppMutation.mutate({
      title: formTitle.trim(),
      description: formDescription.trim(),
      amount: formAmount.trim(),
    });
  };

  const handleAddTransaction = () => {
    if (!txHash.trim() || !txDescription.trim() || !txAmount.trim()) return;
    addTxMutation.mutate({
      txHash: txHash.trim(),
      description: txDescription.trim(),
      amount: txAmount.trim(),
      fromAddress: txFromAddress.trim() || undefined,
    });
  };

  const handleAddSponsor = () => {
    if (!sponsorName.trim()) return;
    addSponsorMutation.mutate({
      name: sponsorName.trim(),
      message: sponsorMessage.trim() || undefined,
      totalAmount: sponsorAmount.trim() || undefined,
    });
  };

  const inputClass = 'w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-rose-200 focus:border-rose-300 transition-all';

  const tabs = [
    { key: 'intro' as const, label: '介绍', icon: Heart },
    { key: 'transactions' as const, label: '链上记录', icon: FileText },
    { key: 'sponsors' as const, label: '赞助者', icon: UsersIcon },
    { key: 'apply' as const, label: '资金申请', icon: Send },
  ];

  return (
    <div className="h-full bg-slate-50 dark:bg-slate-900 flex flex-col">
      {/* Header */}
      <div className="bg-gradient-to-r from-rose-500 to-pink-500 px-4 py-4 flex items-center gap-3 shrink-0">
        <button onClick={onBack} className="p-2 hover:bg-white/20 dark:bg-slate-800/20 rounded-full transition-colors">
          <ArrowLeft size={20} className="text-white" />
        </button>
        <div className="flex items-center gap-2 flex-1">
          <Heart size={20} className="text-white fill-white/80" />
          <h1 className="text-lg font-bold text-white">LoveIn 基金会</h1>
        </div>
      </div>

      {/* Tab Bar */}
      <div className="bg-white dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700 flex shrink-0">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 py-3 text-xs font-medium border-b-2 transition-colors flex items-center justify-center gap-1.5 ${
              activeTab === tab.key
                ? 'text-rose-600 dark:text-rose-400 border-rose-500'
                : 'text-slate-400 dark:text-slate-500 border-transparent hover:text-slate-600 dark:hover:text-slate-300'
            }`}
          >
            <tab.icon size={13} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto pb-32 lg:pb-8">
        {overviewLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="animate-spin text-rose-400" size={32} />
          </div>
        ) : (
          <>
            {/* ================================================ */}
            {/* ====== INTRO TAB ====== */}
            {/* ================================================ */}
            {activeTab === 'intro' && (
              <div className="space-y-0">
                {/* Hero Balance Card */}
                <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-5 pb-6">
                  <div className="flex items-center gap-2 mb-1">
                    <Wallet size={14} className="text-slate-400 dark:text-slate-500" />
                    <span className="text-xs text-slate-400 dark:text-slate-500 font-medium">Base Chain USDC</span>
                    <button
                      onClick={() => { refetchBalance(); refetchTransfers(); }}
                      className="ml-auto p-1 hover:bg-white/10 dark:bg-slate-800/10 rounded-full transition-colors"
                    >
                      <RefreshCw size={12} className={`text-slate-500 dark:text-slate-400 ${balanceLoading ? 'animate-spin' : ''}`} />
                    </button>
                  </div>
                  <div className="flex items-baseline gap-1.5 mb-3">
                    {balanceLoading ? (
                      <div className="h-8 w-24 bg-slate-700 rounded animate-pulse" />
                    ) : (
                      <>
                        <span className="text-3xl font-bold text-white tracking-tight">
                          ${usdcBalance ? formatUSDC(usdcBalance) : '—'}
                        </span>
                        <span className="text-sm text-slate-400 dark:text-slate-500 font-medium">USDC</span>
                      </>
                    )}
                  </div>
                  <div className="flex items-center gap-2 bg-white/5 dark:bg-slate-800/5 rounded-xl px-3 py-2.5">
                    <code className="text-[11px] text-slate-300 flex-1 break-all font-mono leading-relaxed">
                      {FOUNDATION_WALLET}
                    </code>
                    <button
                      onClick={handleCopyAddress}
                      className="p-1.5 hover:bg-white/10 dark:bg-slate-800/10 rounded-lg transition-colors shrink-0"
                    >
                      {copied ? (
                        <Check size={13} className="text-green-400" />
                      ) : (
                        <Copy size={13} className="text-slate-500 dark:text-slate-400" />
                      )}
                    </button>
                  </div>
                  <a
                    href={overview?.baseScanUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-[11px] text-blue-400 hover:text-blue-300 font-medium mt-2.5 transition-colors"
                  >
                    <ExternalLink size={11} />
                    在 BaseScan 上验证
                  </a>
                </div>

                {/* Description */}
                <div className="p-4 space-y-4">
                  <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-100 dark:border-slate-700 shadow-sm">
                    <h2 className="text-base font-bold text-slate-800 dark:text-slate-100 mb-3 flex items-center gap-2">
                      <Sparkles size={16} className="text-rose-400" />
                      关于基金会
                    </h2>
                    <div className="space-y-2.5 text-[13px] text-slate-600 dark:text-slate-300 leading-relaxed">
                      <p>
                        LoveIn 基金会是一个由社区驱动的互助基金，致力于为有需要的成员提供帮助与支持。
                      </p>
                      <p>
                        我们支持所有能让生活更真实、更丰盛的项目。
                        但我们尤其被那些勇敢触碰禁忌、挑战常规、探索人类深层需求的"硬核"想法所打动。
                      </p>
                      <p className="text-xs text-slate-400 dark:text-slate-500">
                        所有资金存储及转移均在 Base 链上公开透明，任何人可验证。
                      </p>
                    </div>
                  </div>

                  {/* Focus Areas */}
                  <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider px-1">// FOCUS_AREAS</h3>
                  <div className="grid grid-cols-1 gap-3">
                    {[
                      { icon: DollarSign, color: 'from-rose-500 to-orange-500', bg: 'bg-rose-50 dark:bg-rose-950', title: 'Essentials in Life', desc: '为你的生活、饮食或住宿提供帮助与资金支持。' },
                      { icon: GraduationCap, color: 'from-blue-500 to-cyan-500', bg: 'bg-blue-50 dark:bg-blue-950', title: 'Self Improve', desc: '学习新技能、考证、买书、上课程 —— 投资自己的成长费用由我们承担。' },
                      { icon: Heart, color: 'from-pink-500 to-rose-500', bg: 'bg-pink-50 dark:bg-pink-950', title: 'Intimate Discovery', desc: '陪伴你安全、自由地探索身体与亲密关系，拥抱真实的自我与愉悦。' },
                    ].map((area, i) => (
                      <div key={i} className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-100 dark:border-slate-700 shadow-sm flex gap-4 items-start">
                        <div className={`w-10 h-10 rounded-xl ${area.bg} flex items-center justify-center shrink-0`}>
                          <area.icon size={18} className="text-slate-600 dark:text-slate-300" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-bold text-sm text-slate-800 dark:text-slate-100 mb-0.5">{area.title}</h4>
                          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{area.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ================================================ */}
            {/* ====== TRANSACTIONS TAB (On-chain) ====== */}
            {/* ================================================ */}
            {activeTab === 'transactions' && (
              <div className="p-4 space-y-3">
                {/* Summary Bar */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                      {onChainTransfers ? `${onChainTransfers.length} 笔链上交易` : '加载中...'}
                    </span>
                  </div>
                  <button
                    onClick={() => refetchTransfers()}
                    className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-lg transition-colors"
                  >
                    <RefreshCw size={13} className={`text-slate-400 dark:text-slate-500 ${transfersLoading ? 'animate-spin' : ''}`} />
                  </button>
                </div>

                {/* Admin: Add Annotation */}
                {isAdmin && (
                  <div className="bg-white dark:bg-slate-800 rounded-2xl border border-dashed border-rose-200 dark:border-rose-800 overflow-hidden">
                    <button
                      onClick={() => setShowAddTx(!showAddTx)}
                      className="w-full px-4 py-3 flex items-center gap-2 text-sm font-medium text-rose-500 dark:text-rose-400 hover:bg-rose-50/50 dark:hover:bg-rose-950/50 transition-colors"
                    >
                      <Plus size={15} />
                      添加交易备注
                      {showAddTx ? <ChevronUp size={13} className="ml-auto" /> : <ChevronDown size={13} className="ml-auto" />}
                    </button>
                    {showAddTx && (
                      <div className="px-4 pb-4 space-y-2.5 border-t border-rose-100 dark:border-rose-900 pt-3">
                        <input className={inputClass} placeholder="交易哈希 (0x...)" value={txHash} onChange={e => setTxHash(e.target.value)} />
                        <input className={inputClass} placeholder="金额 (如: 100 USDC)" value={txAmount} onChange={e => setTxAmount(e.target.value)} />
                        <textarea className={`${inputClass} resize-none`} rows={2} placeholder="备注 (如: 为用户 @xxx 赞助)" value={txDescription} onChange={e => setTxDescription(e.target.value)} />
                        <button
                          onClick={handleAddTransaction}
                          disabled={addTxMutation.isPending || !txHash.trim() || !txDescription.trim() || !txAmount.trim()}
                          className="w-full py-2.5 bg-rose-500 text-white text-sm font-medium rounded-xl hover:bg-rose-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                        >
                          {addTxMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                          保存备注
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* On-chain Transfer List */}
                {transfersLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="animate-spin text-slate-300" size={24} />
                  </div>
                ) : onChainTransfers && onChainTransfers.length > 0 ? (
                  onChainTransfers.map((tx, idx) => {
                    const annotation = annotationMap.get(tx.txHash.toLowerCase());
                    return (
                      <div key={tx.txHash + idx} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden">
                        <div className="p-4">
                          <div className="flex items-start gap-3">
                            {/* Direction Icon */}
                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                              tx.isIncoming
                                ? 'bg-green-50 dark:bg-green-950'
                                : 'bg-orange-50 dark:bg-orange-950'
                            }`}>
                              {tx.isIncoming ? (
                                <ArrowDownLeft size={16} className="text-green-500 dark:text-green-400" />
                              ) : (
                                <ArrowUpRight size={16} className="text-orange-500 dark:text-orange-400" />
                              )}
                            </div>

                            {/* Content */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-0.5">
                                <span className={`text-sm font-bold ${tx.isIncoming ? 'text-green-600 dark:text-green-400' : 'text-orange-600 dark:text-orange-400'}`}>
                                  {tx.isIncoming ? '+' : '-'}{formatUSDC(tx.value)} USDC
                                </span>
                              </div>
                              <div className="text-[11px] text-slate-400 dark:text-slate-500 space-y-0.5">
                                <p>
                                  {tx.isIncoming ? '来自 ' : '发送至 '}
                                  <span className="font-mono">
                                    {shortenAddress(tx.isIncoming ? tx.from : tx.to)}
                                  </span>
                                </p>
                                {tx.timestamp && (
                                  <p>{new Date(tx.timestamp).toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</p>
                                )}
                              </div>
                            </div>

                            {/* BaseScan Link */}
                            <a
                              href={`https://basescan.org/tx/${tx.txHash}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors shrink-0"
                            >
                              <ExternalLink size={13} className="text-slate-400 dark:text-slate-500" />
                            </a>
                          </div>
                        </div>

                        {/* Admin Annotation Banner */}
                        {annotation && (
                          <div className="px-4 py-2.5 bg-rose-50 dark:bg-rose-950 border-t border-rose-100 dark:border-rose-900 flex items-start gap-2">
                            <Heart size={12} className="text-rose-400 mt-0.5 shrink-0 fill-rose-400" />
                            <p className="text-xs text-rose-700 flex-1">{annotation.description}</p>
                            {isAdmin && (
                              <button
                                onClick={() => deleteTxMutation.mutate(annotation.id)}
                                disabled={deleteTxMutation.isPending}
                                className="p-1 text-rose-300 hover:text-red-500 dark:hover:text-red-400 rounded transition-colors shrink-0"
                              >
                                <Trash2 size={11} />
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-16 text-slate-400 dark:text-slate-500 text-sm">
                    暂无链上交易记录
                  </div>
                )}
              </div>
            )}

            {/* ================================================ */}
            {/* ====== SPONSORS TAB ====== */}
            {/* ================================================ */}
            {activeTab === 'sponsors' && (
              <div className="p-4 space-y-3">
                <p className="text-[11px] text-slate-400 dark:text-slate-500 text-center font-medium">排名不分先后，感谢每一位支持者</p>

                {/* Admin: Add Sponsor */}
                {isAdmin && (
                  <div className="bg-white dark:bg-slate-800 rounded-2xl border border-dashed border-rose-200 dark:border-rose-800 overflow-hidden">
                    <button
                      onClick={() => setShowAddSponsor(!showAddSponsor)}
                      className="w-full px-4 py-3 flex items-center gap-2 text-sm font-medium text-rose-500 dark:text-rose-400 hover:bg-rose-50/50 dark:hover:bg-rose-950/50 transition-colors"
                    >
                      <Plus size={15} />
                      添加赞助者
                      {showAddSponsor ? <ChevronUp size={13} className="ml-auto" /> : <ChevronDown size={13} className="ml-auto" />}
                    </button>
                    {showAddSponsor && (
                      <div className="px-4 pb-4 space-y-2.5 border-t border-rose-100 dark:border-rose-900 pt-3">
                        <input className={inputClass} placeholder="赞助者名称" value={sponsorName} onChange={e => setSponsorName(e.target.value)} />
                        <input className={inputClass} placeholder="赞助金额 (可选)" value={sponsorAmount} onChange={e => setSponsorAmount(e.target.value)} />
                        <textarea className={`${inputClass} resize-none`} rows={2} placeholder="赞助者留言 (可选)" value={sponsorMessage} onChange={e => setSponsorMessage(e.target.value)} />
                        <button
                          onClick={handleAddSponsor}
                          disabled={addSponsorMutation.isPending || !sponsorName.trim()}
                          className="w-full py-2.5 bg-rose-500 text-white text-sm font-medium rounded-xl hover:bg-rose-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                        >
                          {addSponsorMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                          添加
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Sponsors Grid */}
                {shuffledSponsors.length > 0 ? (
                  <div className="grid grid-cols-2 gap-3">
                    {shuffledSponsors.map(sponsor => (
                      <div key={sponsor.id} className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-100 dark:border-slate-700 shadow-sm relative group">
                        {isAdmin && (
                          <button
                            onClick={() => deleteSponsorMutation.mutate(sponsor.id)}
                            disabled={deleteSponsorMutation.isPending}
                            className="absolute top-2 right-2 p-1 text-slate-300 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                          >
                            <X size={12} />
                          </button>
                        )}
                        <div className="w-11 h-11 rounded-full bg-gradient-to-br from-rose-100 to-pink-100 dark:to-pink-900 flex items-center justify-center mb-2.5 shadow-sm">
                          {sponsor.avatarUrl ? (
                            <img src={sponsor.avatarUrl} alt="" className="w-full h-full rounded-full object-cover" />
                          ) : (
                            <Heart size={16} className="text-rose-400 fill-rose-200" />
                          )}
                        </div>
                        <h4 className="font-bold text-sm text-slate-800 dark:text-slate-100 truncate">{sponsor.name}</h4>
                        {sponsor.totalAmount && (
                          <p className="text-xs text-green-600 dark:text-green-400 font-semibold mt-0.5">{sponsor.totalAmount}</p>
                        )}
                        {sponsor.message && (
                          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1.5 line-clamp-2 leading-relaxed italic">"{sponsor.message}"</p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-16 text-slate-400 dark:text-slate-500 text-sm">
                    暂无赞助者
                  </div>
                )}
              </div>
            )}

            {/* ================================================ */}
            {/* ====== APPLY TAB ====== */}
            {/* ================================================ */}
            {activeTab === 'apply' && (
              <div className="p-4 space-y-4">
                {/* Application Form */}
                <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-100 dark:border-slate-700 shadow-sm">
                  <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
                    <Send size={14} className="text-rose-400" />
                    提交资金申请
                  </h3>

                  {submitSuccess ? (
                    <div className="text-center py-8">
                      <div className="w-14 h-14 rounded-full bg-green-50 dark:bg-green-950 flex items-center justify-center mx-auto mb-3">
                        <Check size={28} className="text-green-500 dark:text-green-400" />
                      </div>
                      <p className="text-sm font-bold text-green-600 dark:text-green-400">申请已提交</p>
                      <p className="text-xs text-slate-400 dark:text-slate-500 mt-1.5">我们会尽快审核你的申请</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {/* Auto-filled */}
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-[11px] text-slate-400 dark:text-slate-500 mb-1 block font-medium">申请人</label>
                          <input
                            className="w-full px-3 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-700 text-sm text-slate-500 dark:text-slate-400 cursor-not-allowed"
                            value={authUser?.firstName || ''}
                            disabled
                          />
                        </div>
                        <div>
                          <label className="text-[11px] text-slate-400 dark:text-slate-500 mb-1 block font-medium">Telegram</label>
                          <input
                            className="w-full px-3 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-700 text-sm text-slate-500 dark:text-slate-400 cursor-not-allowed"
                            value={authUser?.username ? `@${authUser.username}` : `${authUser?.telegramId || ''}`}
                            disabled
                          />
                        </div>
                      </div>

                      {/* User fills */}
                      <div>
                        <label className="text-[11px] text-slate-400 dark:text-slate-500 mb-1 block font-medium">申请标题 <span className="text-red-400">*</span></label>
                        <input
                          className={inputClass}
                          placeholder="简要描述你的申请"
                          value={formTitle}
                          onChange={e => setFormTitle(e.target.value)}
                          maxLength={300}
                        />
                      </div>
                      <div>
                        <label className="text-[11px] text-slate-400 dark:text-slate-500 mb-1 block font-medium">申请简介 <span className="text-red-400">*</span></label>
                        <textarea
                          className={`${inputClass} resize-none`}
                          rows={5}
                          placeholder="详细说明你的情况和需求..."
                          value={formDescription}
                          onChange={e => setFormDescription(e.target.value)}
                          maxLength={5000}
                        />
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 text-right mt-0.5">{formDescription.length}/5000</p>
                      </div>
                      <div>
                        <label className="text-[11px] text-slate-400 dark:text-slate-500 mb-1 block font-medium">所需金额 <span className="text-red-400">*</span></label>
                        <input
                          className={inputClass}
                          placeholder="如: 200 USDC 或 大约200元左右"
                          value={formAmount}
                          onChange={e => setFormAmount(e.target.value)}
                          maxLength={100}
                        />
                      </div>
                      <button
                        onClick={handleSubmitApplication}
                        disabled={submitAppMutation.isPending || !formTitle.trim() || !formDescription.trim() || !formAmount.trim()}
                        className="w-full py-3 bg-gradient-to-r from-rose-500 to-pink-500 text-white text-sm font-bold rounded-xl hover:from-rose-600 hover:to-pink-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 shadow-sm"
                      >
                        {submitAppMutation.isPending ? (
                          <Loader2 size={16} className="animate-spin" />
                        ) : (
                          <Send size={15} />
                        )}
                        提交申请
                      </button>
                      {submitAppMutation.isError && (
                        <p className="text-xs text-red-500 dark:text-red-400 text-center">提交失败，请稍后重试</p>
                      )}
                    </div>
                  )}
                </div>

                {/* My Applications */}
                {myApplications && myApplications.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="font-bold text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider px-1">我的申请</h3>
                    {myApplications.map(app => (
                      <div key={app.id} className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-100 dark:border-slate-700 shadow-sm">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">{app.title}</p>
                            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{app.amount}</p>
                          </div>
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${statusConfig[app.status].bg} ${statusConfig[app.status].color}`}>
                            {statusConfig[app.status].label}
                          </span>
                        </div>
                        {app.adminNote && (
                          <div className="mt-2.5 p-2.5 bg-blue-50 dark:bg-blue-950 rounded-xl border border-blue-100 dark:border-blue-900">
                            <p className="text-xs text-blue-700 dark:text-blue-400">{app.adminNote}</p>
                          </div>
                        )}
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1.5">
                          {new Date(app.createdAt).toLocaleDateString('zh-CN')}
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Admin: All Applications */}
                {isAdmin && allApplications && allApplications.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="font-bold text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider px-1 flex items-center gap-1.5">
                      <span className="text-[9px] bg-rose-500 text-white px-1.5 py-0.5 rounded font-bold">ADMIN</span>
                      所有申请
                    </h3>
                    {allApplications.map(app => (
                      <div key={app.id} className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-100 dark:border-slate-700 shadow-sm">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{app.title}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                              {app.userName} {app.telegramUsername ? `(@${app.telegramUsername})` : ''}
                            </p>
                            <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 mt-0.5">{app.amount}</p>
                          </div>
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${statusConfig[app.status].bg} ${statusConfig[app.status].color}`}>
                            {statusConfig[app.status].label}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 line-clamp-3 leading-relaxed">{app.description}</p>

                        {expandedAppId === app.id ? (
                          <div className="mt-3 space-y-2 border-t border-slate-100 dark:border-slate-700 pt-3">
                            <textarea
                              className={`${inputClass} resize-none`}
                              rows={2}
                              placeholder="管理员备注 (可选)"
                              value={adminNote}
                              onChange={e => setAdminNote(e.target.value)}
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={() => updateStatusMutation.mutate({ id: app.id, status: 'APPROVED', note: adminNote || undefined })}
                                disabled={updateStatusMutation.isPending}
                                className="flex-1 py-2.5 bg-green-500 text-white text-xs font-bold rounded-xl hover:bg-green-600 disabled:opacity-50 transition-colors"
                              >
                                通过
                              </button>
                              <button
                                onClick={() => updateStatusMutation.mutate({ id: app.id, status: 'REJECTED', note: adminNote || undefined })}
                                disabled={updateStatusMutation.isPending}
                                className="flex-1 py-2.5 bg-red-500 text-white text-xs font-bold rounded-xl hover:bg-red-600 disabled:opacity-50 transition-colors"
                              >
                                拒绝
                              </button>
                              <button
                                onClick={() => { setExpandedAppId(null); setAdminNote(''); }}
                                className="px-4 py-2.5 bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 text-xs font-medium rounded-xl hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                              >
                                取消
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => { setExpandedAppId(app.id); setAdminNote(app.adminNote || ''); }}
                            className="mt-2 text-xs text-rose-500 dark:text-rose-400 hover:text-rose-600 dark:text-rose-400 font-bold"
                          >
                            审核
                          </button>
                        )}

                        <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1.5">
                          {new Date(app.createdAt).toLocaleString('zh-CN')}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
