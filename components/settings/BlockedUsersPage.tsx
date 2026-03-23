import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { ArrowLeft, ShieldOff, Loader2, UserX } from 'lucide-react';
import { blockApi, BlockedUser } from '@/lib/api';

interface BlockedUsersPageProps {
  onBack: () => void;
}

export const BlockedUsersPage: React.FC<BlockedUsersPageProps> = ({ onBack }) => {
  const [users, setUsers] = useState<BlockedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [unblockingId, setUnblockingId] = useState<number | null>(null);

  useEffect(() => {
    const fetchBlockedUsers = async () => {
      try {
        const data = await blockApi.getBlockedUsers();
        setUsers(data.users);
      } catch (err) {
        toast.error('加载拉黑列表失败');
      } finally {
        setLoading(false);
      }
    };
    fetchBlockedUsers();
  }, []);

  const handleUnblock = async (userId: number) => {
    if (unblockingId) return;
    try {
      setUnblockingId(userId);
      await blockApi.unblock(userId);
      setUsers(prev => prev.filter(u => u.id !== userId));
      toast.success('已取消拉黑');
    } catch (err) {
      toast.error('操作失败');
    } finally {
      setUnblockingId(null);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('zh-CN', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white dark:from-slate-900 dark:to-slate-800">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white/80 dark:bg-slate-900/80 backdrop-blur-lg border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center justify-between px-4 py-3">
          <button onClick={onBack} className="p-2 -ml-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
            <ArrowLeft size={22} className="text-slate-600 dark:text-slate-300" />
          </button>
          <h1 className="font-bold text-lg text-slate-800 dark:text-slate-100">拉黑列表</h1>
          <div className="w-10" />
        </div>
      </div>

      <div className="p-4">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={32} className="animate-spin text-primary" />
          </div>
        ) : users.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400 dark:text-slate-500">
            <ShieldOff size={48} className="mb-3 opacity-50" />
            <p className="text-sm">没有拉黑任何用户</p>
          </div>
        ) : (
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-soft border border-slate-50 dark:border-slate-700 overflow-hidden">
            {users.map((user, index) => (
              <div
                key={user.id}
                className={`p-4 flex items-center justify-between ${
                  index < users.length - 1 ? 'border-b border-slate-50 dark:border-slate-700' : ''
                }`}
              >
                <div className="flex items-center gap-3">
                  <img
                    src={user.photoUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.firstName)}&background=EE5A7C&color=fff`}
                    alt={user.firstName}
                    className="w-10 h-10 rounded-full object-cover"
                  />
                  <div>
                    <div className="font-medium text-sm text-slate-800 dark:text-slate-100">
                      {user.firstName}{user.lastName ? ` ${user.lastName}` : ''}
                    </div>
                    <div className="text-xs text-slate-400 dark:text-slate-500">
                      {formatDate(user.blockedAt)} 拉黑
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => handleUnblock(user.id)}
                  disabled={unblockingId === user.id}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors disabled:opacity-50"
                >
                  {unblockingId === user.id ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    '取消拉黑'
                  )}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default BlockedUsersPage;
