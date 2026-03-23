import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Plus,
  Search,
  Gavel,
  Edit2,
  Trash2,
  Loader2,
  Save,
  X,
  AlertTriangle,
  MinusCircle,
  Ban,
  ListTodo,
} from 'lucide-react';
import {
  CourseSummaryBackend,
  PunishmentBackend,
  CreatePunishmentRequest,
  TaskDefinitionBackend,
  PunishmentTriggerBackend,
  PunishmentTypeBackend,
} from '../../types';
import { adminApi } from '../../lib/api';
import { useConfirm } from '@/hooks/useConfirm';

interface PunishmentEditorPageProps {
  onBack: () => void;
}

interface PunishmentFormData {
  name: string;
  description: string;
  triggerType: PunishmentTriggerBackend;
  triggerCourseId: number | null;
  punishmentType: PunishmentTypeBackend;
  punishmentValue: number;
  taskDefinitionId: number | null;
  deadlineHours: number;
  isActive: boolean;
}

const initialFormData: PunishmentFormData = {
  name: '',
  description: '',
  triggerType: 'TASK_FAIL',
  triggerCourseId: null,
  punishmentType: 'EXTRA_TASK',
  punishmentValue: 0,
  taskDefinitionId: null,
  deadlineHours: 24,
  isActive: true,
};

const TRIGGER_TYPES: { value: PunishmentTriggerBackend; label: string; icon: React.ReactNode }[] = [
  { value: 'TASK_FAIL', label: '任务失败', icon: <AlertTriangle size={16} /> },
  { value: 'TASK_SKIP', label: '任务跳过', icon: <MinusCircle size={16} /> },
  { value: 'EXAM_FAIL', label: '考试失败', icon: <Ban size={16} /> },
];

const PUNISHMENT_TYPES: { value: PunishmentTypeBackend; label: string; description: string }[] = [
  { value: 'EXTRA_TASK', label: '额外任务', description: '完成指定任务' },
  { value: 'POINT_DEDUCTION', label: '扣除点数', description: '扣除校园点数' },
  { value: 'EXAM_BAN', label: '禁止考试', description: '禁止参加考试N天' },
];

export const PunishmentEditorPage: React.FC<PunishmentEditorPageProps> = ({ onBack }) => {
  const confirm = useConfirm();

  const [courses, setCourses] = useState<CourseSummaryBackend[]>([]);
  const [tasks, setTasks] = useState<TaskDefinitionBackend[]>([]);
  const [punishments, setPunishments] = useState<PunishmentBackend[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingPunishment, setEditingPunishment] = useState<PunishmentBackend | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState<PunishmentFormData>(initialFormData);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [coursesData, tasksData, punishmentsData] = await Promise.all([
        adminApi.getCourses(true),
        adminApi.getTaskDefinitions(true),
        adminApi.getPunishments(true),
      ]);
      setCourses(coursesData);
      setTasks(tasksData);
      setPunishments(punishmentsData);
    } catch (err) {
      console.error('Failed to fetch data:', err);
      setError('加载数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filteredPunishments = punishments.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreate = () => {
    setFormData(initialFormData);
    setIsCreating(true);
    setEditingPunishment(null);
  };

  const handleEdit = (punishment: PunishmentBackend) => {
    setFormData({
      name: punishment.name,
      description: punishment.description || '',
      triggerType: punishment.triggerType,
      triggerCourseId: punishment.triggerCourseId,
      punishmentType: punishment.punishmentType,
      punishmentValue: punishment.punishmentValue,
      taskDefinitionId: punishment.taskDefinitionId,
      deadlineHours: punishment.deadlineHours,
      isActive: punishment.isActive,
    });
    setEditingPunishment(punishment);
    setIsCreating(false);
  };

  const handleCancel = () => {
    setEditingPunishment(null);
    setIsCreating(false);
    setFormData(initialFormData);
    setError(null);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      setError('请输入惩罚名称');
      return;
    }

    // Validate taskDefinitionId is set for EXTRA_TASK type
    if (formData.punishmentType === 'EXTRA_TASK' && !formData.taskDefinitionId) {
      setError('额外任务类型必须选择要执行的任务');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      const request: CreatePunishmentRequest = {
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        triggerType: formData.triggerType,
        triggerCourseId: formData.triggerCourseId,
        punishmentType: formData.punishmentType,
        punishmentValue: formData.punishmentType !== 'EXTRA_TASK' ? formData.punishmentValue : undefined,
        taskDefinitionId: formData.punishmentType === 'EXTRA_TASK' ? formData.taskDefinitionId : null,
        deadlineHours: formData.deadlineHours,
      };

      if (isCreating) {
        await adminApi.createPunishment(request);
      } else if (editingPunishment) {
        await adminApi.updatePunishment(editingPunishment.id, request);
        // Also update active status if changed
        if (formData.isActive !== editingPunishment.isActive) {
          await adminApi.setPunishmentActive(editingPunishment.id, formData.isActive);
        }
      }

      await fetchData();
      handleCancel();
    } catch (err: any) {
      setError(err.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (punishmentId: number) => {
    if (!(await confirm({ title: '确认删除', description: '确定要删除这个惩罚配置吗？', destructive: true }))) {
      return;
    }

    try {
      await adminApi.deletePunishment(punishmentId);
      await fetchData();
    } catch (err: any) {
      setError(err.message || '删除失败');
    }
  };

  const getTriggerIcon = (type: PunishmentTriggerBackend) => {
    const found = TRIGGER_TYPES.find(t => t.value === type);
    return found?.icon || <AlertTriangle size={16} />;
  };

  const getPunishmentTypeLabel = (type: PunishmentTypeBackend) => {
    const found = PUNISHMENT_TYPES.find(t => t.value === type);
    return found?.label || type;
  };

  // Get task name helper
  const getTaskName = (taskId: number | null) => {
    if (!taskId) return null;
    const task = tasks.find(t => t.id === taskId);
    return task?.name || `任务 #${taskId}`;
  };

  // Form view
  if (isCreating || editingPunishment) {
    return (
      <div className="h-full bg-slate-50 dark:bg-slate-900 flex flex-col lg:max-w-[900px] lg:mx-auto lg:w-full">
        {/* Header */}
        <div className="bg-white dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700 p-4">
          <div className="flex items-center gap-4">
            <button
              onClick={handleCancel}
              className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
            >
              <X size={20} className="text-slate-600 dark:text-slate-300" />
            </button>
            <div className="flex-1">
              <h1 className="text-lg font-bold text-slate-800 dark:text-slate-100">
                {isCreating ? '创建惩罚' : '编辑惩罚'}
              </h1>
            </div>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 bg-primary text-white rounded-xl font-medium flex items-center gap-2 hover:bg-primary/90 disabled:opacity-50"
            >
              {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
              保存
            </button>
          </div>
        </div>

        {/* Form */}
        <div className="flex-1 overflow-y-auto p-4">
          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400 rounded-xl text-sm">
              {error}
            </div>
          )}

          <div className="space-y-4">
            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
                惩罚名称 <span className="text-red-500 dark:text-red-400">*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-primary focus:outline-none"
                placeholder="输入惩罚名称"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
                惩罚描述
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-primary focus:outline-none resize-none"
                rows={3}
                placeholder="输入惩罚描述"
              />
            </div>

            {/* Trigger Type */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">
                触发条件
              </label>
              <div className="space-y-2">
                {TRIGGER_TYPES.map(type => (
                  <button
                    key={type.value}
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, triggerType: type.value }))}
                    className={`w-full p-3 rounded-xl border-2 flex items-center gap-3 transition-all ${
                      formData.triggerType === type.value
                        ? 'border-primary bg-primary/5'
                        : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:border-slate-600'
                    }`}
                  >
                    <span className={formData.triggerType === type.value ? 'text-primary' : 'text-slate-400 dark:text-slate-500'}>
                      {type.icon}
                    </span>
                    <span className={`text-sm font-medium ${
                      formData.triggerType === type.value ? 'text-primary' : 'text-slate-600 dark:text-slate-300'
                    }`}>
                      {type.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Trigger Course (optional) */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
                触发课程（可选）
              </label>
              <select
                value={formData.triggerCourseId || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, triggerCourseId: e.target.value ? parseInt(e.target.value) : null }))}
                className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-primary focus:outline-none"
              >
                <option value="">所有课程</option>
                {courses.map(course => (
                  <option key={course.id} value={course.id}>{course.name}</option>
                ))}
              </select>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">留空则适用于所有课程</p>
            </div>

            {/* Punishment Type */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">
                惩罚类型
              </label>
              <div className="space-y-2">
                {PUNISHMENT_TYPES.map(type => (
                  <button
                    key={type.value}
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, punishmentType: type.value }))}
                    className={`w-full p-3 rounded-xl border-2 flex flex-col items-start transition-all ${
                      formData.punishmentType === type.value
                        ? 'border-primary bg-primary/5'
                        : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:border-slate-600'
                    }`}
                  >
                    <span className={`text-sm font-medium ${
                      formData.punishmentType === type.value ? 'text-primary' : 'text-slate-600 dark:text-slate-300'
                    }`}>
                      {type.label}
                    </span>
                    <span className="text-xs text-slate-400 dark:text-slate-500">{type.description}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Task Selection for EXTRA_TASK type */}
            {formData.punishmentType === 'EXTRA_TASK' && (
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
                  惩罚任务 <span className="text-red-500 dark:text-red-400">*</span>
                </label>
                <select
                  value={formData.taskDefinitionId || ''}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    taskDefinitionId: e.target.value ? parseInt(e.target.value) : null
                  }))}
                  className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-primary focus:outline-none"
                >
                  <option value="">选择任务...</option>
                  {tasks.map(task => (
                    <option key={task.id} value={task.id}>
                      {task.name} ({courses.find(c => c.id === task.courseId)?.name || '未知课程'})
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">被惩罚者需要完成的额外任务</p>
              </div>
            )}

            {/* Punishment Value */}
            {formData.punishmentType !== 'EXTRA_TASK' && (
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
                  惩罚值
                </label>
                <input
                  type="number"
                  value={formData.punishmentValue}
                  onChange={(e) => setFormData(prev => ({ ...prev, punishmentValue: parseInt(e.target.value) || 0 }))}
                  className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-primary focus:outline-none"
                  min={0}
                />
                <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
                  {formData.punishmentType === 'POINT_DEDUCTION' ? '扣除的校园点数' : '禁考天数'}
                </p>
              </div>
            )}

            {/* Deadline Hours */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
                完成期限（小时）
              </label>
              <input
                type="number"
                value={formData.deadlineHours}
                onChange={(e) => setFormData(prev => ({ ...prev, deadlineHours: parseInt(e.target.value) || 0 }))}
                className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-primary focus:outline-none"
                min={0}
              />
              <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">0 表示无期限</p>
            </div>

            {/* Active Status */}
            <div className="flex items-center justify-between bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
              <div>
                <p className="font-medium text-slate-700 dark:text-slate-200">启用状态</p>
                <p className="text-xs text-slate-400 dark:text-slate-500">关闭后不会触发此惩罚</p>
              </div>
              <button
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, isActive: !prev.isActive }))}
                className={`w-12 h-7 rounded-full transition-colors ${
                  formData.isActive ? 'bg-primary' : 'bg-slate-300'
                }`}
              >
                <div className={`w-5 h-5 bg-white dark:bg-slate-800 rounded-full shadow-sm transform transition-transform ${
                  formData.isActive ? 'translate-x-6' : 'translate-x-1'
                }`} />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // List view
  return (
    <div className="h-full bg-slate-50 dark:bg-slate-900 flex flex-col lg:max-w-[900px] lg:mx-auto lg:w-full">
      {/* Header */}
      <div className="bg-white dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700 p-4">
        <div className="flex items-center gap-4 mb-4">
          <button
            onClick={onBack}
            className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
          >
            <ArrowLeft size={20} className="text-slate-600 dark:text-slate-300" />
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-slate-800 dark:text-slate-100">惩罚管理</h1>
            <p className="text-xs text-slate-400 dark:text-slate-500">{punishments.length} 个惩罚配置</p>
          </div>
          <button
            onClick={handleCreate}
            className="px-4 py-2 bg-primary text-white rounded-xl font-medium flex items-center gap-2 hover:bg-primary/90"
          >
            <Plus size={18} />
            新建
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-100 dark:bg-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/30"
            placeholder="搜索惩罚..."
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={24} className="animate-spin text-primary" />
          </div>
        ) : filteredPunishments.length === 0 ? (
          <div className="text-center py-12">
            <Gavel size={48} className="mx-auto text-slate-300 mb-4" />
            <p className="text-slate-500 dark:text-slate-400">暂无惩罚配置</p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">点击新建按钮创建惩罚</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredPunishments.map((punishment) => (
              <div
                key={punishment.id}
                className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-slate-100 dark:border-slate-700"
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-950 flex items-center justify-center shrink-0 text-red-500 dark:text-red-400">
                    {getTriggerIcon(punishment.triggerType)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-slate-800 dark:text-slate-100 truncate">{punishment.name}</h3>
                      {!punishment.isActive && (
                        <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 text-[10px] rounded-full">
                          已禁用
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                      {getPunishmentTypeLabel(punishment.punishmentType)}
                      {punishment.punishmentType === 'EXTRA_TASK' && punishment.taskDefinitionId && (
                        <span className="text-slate-500 dark:text-slate-400"> · {getTaskName(punishment.taskDefinitionId)}</span>
                      )}
                      {punishment.triggerCourseId && (
                        <span> · 触发课程: {courses.find(c => c.id === punishment.triggerCourseId)?.name || '未知'}</span>
                      )}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleEdit(punishment)}
                      className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                    >
                      <Edit2 size={16} className="text-slate-600 dark:text-slate-300" />
                    </button>
                    <button
                      onClick={() => handleDelete(punishment.id)}
                      className="w-8 h-8 rounded-lg bg-red-50 dark:bg-red-950 flex items-center justify-center hover:bg-red-100 dark:hover:bg-red-900 transition-colors"
                    >
                      <Trash2 size={16} className="text-red-500 dark:text-red-400" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default PunishmentEditorPage;
