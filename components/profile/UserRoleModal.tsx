import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { X, Loader2, Shield, Check, Plus, AlertTriangle } from 'lucide-react';
import { roleApi, RoleInfo, UserRoleAssignment } from '@/lib/api';

interface UserRoleModalProps {
  userId: number;
  userName: string;
  onClose: () => void;
}

// Role color mapping
const ROLE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  '校长': { bg: 'bg-amber-50 dark:bg-amber-950', text: 'text-amber-700 dark:text-amber-300', border: 'border-amber-200 dark:border-amber-800' },
  '老师': { bg: 'bg-blue-50 dark:bg-blue-950', text: 'text-blue-700 dark:text-blue-300', border: 'border-blue-200 dark:border-blue-800' },
  '学生会成员': { bg: 'bg-purple-50 dark:bg-purple-950', text: 'text-purple-700 dark:text-purple-300', border: 'border-purple-200 dark:border-purple-800' },
  '学生': { bg: 'bg-slate-50 dark:bg-slate-800', text: 'text-slate-600 dark:text-slate-300', border: 'border-slate-200 dark:border-slate-700' },
  '封禁': { bg: 'bg-red-50 dark:bg-red-950', text: 'text-red-700 dark:text-red-300', border: 'border-red-300 dark:border-red-800' },
};

const DEFAULT_COLOR = { bg: 'bg-emerald-50 dark:bg-emerald-950', text: 'text-emerald-700 dark:text-emerald-300', border: 'border-emerald-200 dark:border-emerald-800' };

export const UserRoleModal: React.FC<UserRoleModalProps> = ({ userId, userName, onClose }) => {
  const [allRoles, setAllRoles] = useState<RoleInfo[]>([]);
  const [userRoles, setUserRoles] = useState<UserRoleAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [togglingRoleId, setTogglingRoleId] = useState<number | null>(null);

  useEffect(() => {
    const fetch = async () => {
      try {
        const [roles, assignments] = await Promise.all([
          roleApi.getAllRoles(),
          roleApi.getUserRoles(userId),
        ]);
        setAllRoles(roles);
        setUserRoles(assignments);
      } catch (err) {
        toast.error('加载角色数据失败');
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [userId]);

  const userRoleIds = new Set(userRoles.map(r => r.roleId));

  const handleToggleRole = async (role: RoleInfo) => {
    if (togglingRoleId) return;
    const hasRole = userRoleIds.has(role.id);

    // 封禁角色需要二次确认
    if (role.name === '封禁') {
      const action = hasRole ? '解除封禁' : '封禁';
      if (!confirm(`确定要${action}用户「${userName}」吗？${hasRole ? '' : '封禁后该用户将无法使用任何功能。'}`)) return;
    }

    try {
      setTogglingRoleId(role.id);
      const updatedRoles = hasRole
        ? await roleApi.removeRole(userId, role.id)
        : await roleApi.assignRole(userId, role.id);
      setUserRoles(updatedRoles);
      toast.success(hasRole ? `已移除「${role.displayName}」` : `已分配「${role.displayName}」`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '操作失败');
    } finally {
      setTogglingRoleId(null);
    }
  };

  const getColor = (name: string) => ROLE_COLORS[name] || DEFAULT_COLOR;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-50 max-w-md mx-auto bg-white dark:bg-slate-800 rounded-2xl shadow-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-700">
          <div className="flex items-center gap-2.5">
            <Shield size={18} className="text-primary" />
            <h2 className="font-bold text-slate-800 dark:text-slate-100">管理角色</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
            <X size={18} className="text-slate-400" />
          </button>
        </div>

        {/* User info */}
        <div className="px-5 py-3 bg-slate-50 dark:bg-slate-750 border-b border-slate-100 dark:border-slate-700">
          <p className="text-xs text-slate-400 dark:text-slate-500">
            用户：<span className="text-slate-600 dark:text-slate-300 font-medium">{userName}</span>
            <span className="ml-2 text-slate-300 dark:text-slate-600">#{userId}</span>
          </p>
        </div>

        {/* Content */}
        <div className="p-5 max-h-[60vh] overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={24} className="animate-spin text-primary" />
            </div>
          ) : (
            <div className="space-y-2.5">
              {/* Warning if user is banned */}
              {userRoles.some(r => r.roleName === '封禁') && (
                <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-xl mb-1">
                  <AlertTriangle size={16} className="text-red-500 shrink-0" />
                  <p className="text-xs text-red-600 dark:text-red-400">该用户已被封禁，无法使用任何功能</p>
                </div>
              )}
              {allRoles.map(role => {
                const hasRole = userRoleIds.has(role.id);
                const isToggling = togglingRoleId === role.id;
                const color = getColor(role.name);

                return (
                  <button
                    key={role.id}
                    onClick={() => handleToggleRole(role)}
                    disabled={isToggling}
                    className={`w-full p-3.5 rounded-xl border text-left transition-all disabled:opacity-60 ${
                      hasRole
                        ? `${color.bg} ${color.border}`
                        : 'bg-white dark:bg-slate-800 border-slate-150 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-semibold ${hasRole ? color.text : 'text-slate-700 dark:text-slate-200'}`}>
                            {role.displayName}
                          </span>
                          {role.isSystem && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500">
                              系统
                            </span>
                          )}
                        </div>
                        {role.description && (
                          <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 truncate">
                            {role.description}
                          </p>
                        )}
                        {hasRole && (
                          <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
                            {userRoles.find(r => r.roleId === role.id)?.assignedAt &&
                              new Date(userRoles.find(r => r.roleId === role.id)!.assignedAt).toLocaleDateString('zh-CN')} 分配
                          </p>
                        )}
                      </div>
                      <div className="shrink-0 ml-3">
                        {isToggling ? (
                          <Loader2 size={18} className="animate-spin text-slate-400" />
                        ) : hasRole ? (
                          <div className={`w-7 h-7 rounded-lg ${color.bg} ${color.text} flex items-center justify-center border ${color.border}`}>
                            <Check size={14} strokeWidth={3} />
                          </div>
                        ) : (
                          <div className="w-7 h-7 rounded-lg border border-slate-200 dark:border-slate-600 text-slate-300 dark:text-slate-600 flex items-center justify-center">
                            <Plus size={14} />
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-750">
          <p className="text-[10px] text-slate-400 dark:text-slate-500 text-center">
            角色变更即时生效，权限缓存将在数分钟内刷新
          </p>
        </div>
      </div>
    </>
  );
};
