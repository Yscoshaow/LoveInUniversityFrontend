import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Save,
  Loader2,
  Timer,
  Target,
  Lock,
  CheckCircle,
  Calendar,
  Repeat,
  Clock,
  AlertCircle,
} from 'lucide-react';
import {
  useCreateTaskDefinition,
  useUpdateTaskDefinition,
} from '../../hooks';
import { ImageUploadCompact } from '../ui/ImageUpload';
import type {
  SupervisorTaskDefinition,
  TaskType,
  TargetUnit,
  TaskRepeatType,
  CreateSupervisorTaskDefinitionRequest,
  UpdateSupervisorTaskDefinitionRequest,
} from '../../types';
import { DatePickerSheet } from '@/components/ui/mobile-picker';

interface SupervisorTaskEditorPageProps {
  superviseeId: number;
  superviseeName: string;
  existingDefinition?: SupervisorTaskDefinition | null;
  onBack: () => void;
  onSuccess?: () => void;
}

interface TaskFormData {
  name: string;
  description: string;
  iconUrl: string;
  taskType: TaskType;
  targetValue: number;
  targetUnit: TargetUnit;
  allowPartial: boolean;
  requireReview: boolean;
  timeoutMinutes: number;
  repeatType: TaskRepeatType;
  repeatDays: string;
  scheduledDate: string;
  isActive: boolean;
}

const initialFormData: TaskFormData = {
  name: '',
  description: '',
  iconUrl: '',
  taskType: 'MANUAL',
  targetValue: 1,
  targetUnit: 'NONE',
  allowPartial: false,
  requireReview: false,
  timeoutMinutes: 0,
  repeatType: 'DAILY',
  repeatDays: '',
  scheduledDate: '',
  isActive: true,
};

const TASK_TYPES: { value: TaskType; label: string; description: string; icon: React.ReactNode }[] = [
  { value: 'MANUAL', label: '手动完成', description: '点击即可完成', icon: <CheckCircle size={20} /> },
  { value: 'DURATION', label: '时长任务', description: '需要持续一定时间', icon: <Timer size={20} /> },
  { value: 'COUNT', label: '计数任务', description: '需要完成一定次数', icon: <Target size={20} /> },
  { value: 'LOCK', label: '锁任务', description: '根据当天锁定时长自动判定', icon: <Lock size={20} /> },
];

const TARGET_UNITS: { value: TargetUnit; label: string; taskTypes: TaskType[] }[] = [
  { value: 'NONE', label: '无', taskTypes: ['MANUAL'] },
  { value: 'MINUTES', label: '分钟', taskTypes: ['DURATION', 'LOCK'] },
  { value: 'HOURS', label: '小时', taskTypes: ['DURATION', 'LOCK'] },
  { value: 'TIMES', label: '次', taskTypes: ['COUNT'] },
];

const REPEAT_TYPES: { value: TaskRepeatType; label: string; description: string }[] = [
  { value: 'ONCE', label: '单次', description: '只执行一次' },
  { value: 'DAILY', label: '每天', description: '每天重复' },
  { value: 'WEEKLY', label: '每周', description: '每周指定天数重复' },
];

const WEEKDAYS = [
  { value: '1', label: '一' },
  { value: '2', label: '二' },
  { value: '3', label: '三' },
  { value: '4', label: '四' },
  { value: '5', label: '五' },
  { value: '6', label: '六' },
  { value: '7', label: '日' },
];

// Format date to YYYY-MM-DD using local timezone
const formatDateKey = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const SupervisorTaskEditorPage: React.FC<SupervisorTaskEditorPageProps> = ({
  superviseeId,
  superviseeName,
  existingDefinition,
  onBack,
  onSuccess,
}) => {
  const [formData, setFormData] = useState<TaskFormData>(initialFormData);
  const [error, setError] = useState<string | null>(null);

  const isEditing = !!existingDefinition;

  // Mutations
  const createMutation = useCreateTaskDefinition();
  const updateMutation = useUpdateTaskDefinition();

  const isSaving = createMutation.isPending || updateMutation.isPending;

  // Initialize form data from existing definition
  useEffect(() => {
    if (existingDefinition) {
      setFormData({
        name: existingDefinition.name,
        description: existingDefinition.description || '',
        iconUrl: existingDefinition.iconUrl || '',
        taskType: existingDefinition.taskType,
        targetValue: existingDefinition.targetValue,
        targetUnit: existingDefinition.targetUnit,
        allowPartial: existingDefinition.allowPartial,
        requireReview: existingDefinition.requireReview,
        timeoutMinutes: existingDefinition.timeoutMinutes,
        repeatType: existingDefinition.repeatType,
        repeatDays: existingDefinition.repeatDays || '',
        scheduledDate: '',
        isActive: existingDefinition.isActive,
      });
    } else {
      // Set default scheduled date for new tasks
      setFormData(prev => ({
        ...prev,
        scheduledDate: formatDateKey(new Date()),
      }));
    }
  }, [existingDefinition]);

  // Handle task type change - auto-select appropriate unit
  const handleTaskTypeChange = (taskType: TaskType) => {
    let defaultUnit: TargetUnit = 'NONE';
    let defaultValue = 1;

    switch (taskType) {
      case 'DURATION':
        defaultUnit = 'MINUTES';
        defaultValue = 30;
        break;
      case 'COUNT':
        defaultUnit = 'TIMES';
        defaultValue = 10;
        break;
      case 'LOCK':
        defaultUnit = 'MINUTES';
        defaultValue = 60;
        break;
      default:
        defaultUnit = 'NONE';
        defaultValue = 1;
    }

    setFormData(prev => ({
      ...prev,
      taskType,
      targetUnit: defaultUnit,
      targetValue: defaultValue,
    }));
  };

  // Handle weekday toggle for weekly repeat
  const toggleWeekday = (day: string) => {
    const days = formData.repeatDays ? formData.repeatDays.split(',') : [];
    const index = days.indexOf(day);
    if (index >= 0) {
      days.splice(index, 1);
    } else {
      days.push(day);
      days.sort((a, b) => parseInt(a) - parseInt(b));
    }
    setFormData(prev => ({
      ...prev,
      repeatDays: days.join(','),
    }));
  };

  // Validate form
  const validateForm = (): boolean => {
    if (!formData.name.trim()) {
      setError('请输入任务名称');
      return false;
    }
    if (formData.repeatType === 'ONCE' && !formData.scheduledDate && !isEditing) {
      setError('单次任务请选择执行日期');
      return false;
    }
    if (formData.repeatType === 'WEEKLY' && !formData.repeatDays) {
      setError('请选择每周执行的天数');
      return false;
    }
    setError(null);
    return true;
  };

  // Handle save
  const handleSave = async () => {
    if (!validateForm()) return;

    try {
      if (isEditing && existingDefinition) {
        const updateRequest: UpdateSupervisorTaskDefinitionRequest = {
          name: formData.name,
          description: formData.description || undefined,
          iconUrl: formData.iconUrl || undefined,
          taskType: formData.taskType,
          targetValue: formData.targetValue,
          targetUnit: formData.targetUnit,
          allowPartial: formData.allowPartial,
          requireReview: formData.requireReview,
          timeoutMinutes: formData.timeoutMinutes,
          repeatType: formData.repeatType,
          repeatDays: formData.repeatType === 'WEEKLY' ? formData.repeatDays : undefined,
          isActive: formData.isActive,
        };
        await updateMutation.mutateAsync({
          definitionId: existingDefinition.id,
          request: updateRequest,
        });
      } else {
        const createRequest: CreateSupervisorTaskDefinitionRequest = {
          superviseeId,
          name: formData.name,
          description: formData.description || undefined,
          iconUrl: formData.iconUrl || undefined,
          taskType: formData.taskType,
          targetValue: formData.targetValue,
          targetUnit: formData.targetUnit,
          allowPartial: formData.allowPartial,
          requireReview: formData.requireReview,
          timeoutMinutes: formData.timeoutMinutes,
          repeatType: formData.repeatType,
          repeatDays: formData.repeatType === 'WEEKLY' ? formData.repeatDays : undefined,
          scheduledDate: formData.repeatType === 'ONCE' ? formData.scheduledDate : undefined,
        };
        await createMutation.mutateAsync(createRequest);
      }
      onSuccess?.();
      onBack();
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败');
    }
  };

  // Get available units for current task type
  const availableUnits = TARGET_UNITS.filter(
    u => u.taskTypes.includes(formData.taskType) || u.value === 'NONE'
  );

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900 lg:max-w-[900px] lg:mx-auto lg:w-full">
      {/* Header */}
      <div className="bg-white dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="p-1 -ml-1">
              <ArrowLeft size={24} className="text-slate-600 dark:text-slate-300" />
            </button>
            <div>
              <h1 className="text-lg font-bold text-slate-800 dark:text-slate-100">
                {isEditing ? '编辑任务' : '创建任务'}
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">为 {superviseeName} 创建</p>
            </div>
          </div>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-1 px-4 py-2 bg-indigo-500 text-white rounded-xl text-sm font-medium hover:bg-indigo-600 transition-colors disabled:opacity-50"
          >
            {isSaving ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Save size={16} />
            )}
            保存
          </button>
        </div>
      </div>

      {/* Form */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Error Message */}
        {error && (
          <div className="p-3 bg-rose-50 dark:bg-rose-950 border border-rose-200 dark:border-rose-800 rounded-xl flex items-center gap-2 text-rose-600 dark:text-rose-400 text-sm">
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        {/* Task Name */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-soft">
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">
            任务名称 <span className="text-rose-500 dark:text-rose-400">*</span>
          </label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            placeholder="例如：每日运动30分钟"
            className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
          />
        </div>

        {/* Task Description */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-soft">
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">
            任务描述
          </label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
            placeholder="详细描述任务要求..."
            rows={3}
            className="w-full px-4 py-3 border border-slate-200 dark:border-slate-700 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
          />
        </div>

        {/* Task Icon */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-soft">
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">
            任务图标
          </label>
          <ImageUploadCompact
            value={formData.iconUrl}
            onChange={(url) => setFormData(prev => ({ ...prev, iconUrl: url || '' }))}
          />
        </div>

        {/* Task Type */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-soft">
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-3">
            任务类型 <span className="text-rose-500 dark:text-rose-400">*</span>
          </label>
          <div className="grid grid-cols-2 gap-2">
            {TASK_TYPES.map((type) => (
              <button
                key={type.value}
                onClick={() => handleTaskTypeChange(type.value)}
                className={`p-3 rounded-xl border-2 transition-all text-left ${
                  formData.taskType === type.value
                    ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950'
                    : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:border-slate-600'
                }`}
              >
                <div className={`mb-1 ${
                  formData.taskType === type.value ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400 dark:text-slate-500'
                }`}>
                  {type.icon}
                </div>
                <div className={`text-sm font-medium ${
                  formData.taskType === type.value ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-700 dark:text-slate-200'
                }`}>
                  {type.label}
                </div>
                <div className="text-[10px] text-slate-400 dark:text-slate-500">
                  {type.description}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Target Value & Unit (for non-manual tasks) */}
        {formData.taskType !== 'MANUAL' && (
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-soft">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">
              目标值
            </label>
            <div className="flex gap-2">
              <input
                type="number"
                value={formData.targetValue}
                onChange={(e) => setFormData(prev => ({ ...prev, targetValue: parseFloat(e.target.value) || 0 }))}
                min={1}
                className="flex-1 px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
              <select
                value={formData.targetUnit}
                onChange={(e) => setFormData(prev => ({ ...prev, targetUnit: e.target.value as TargetUnit }))}
                className="px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              >
                {availableUnits.map((unit) => (
                  <option key={unit.value} value={unit.value}>
                    {unit.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Allow Partial */}
            <label className="flex items-center gap-2 mt-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.allowPartial}
                onChange={(e) => setFormData(prev => ({ ...prev, allowPartial: e.target.checked }))}
                className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-indigo-600 dark:text-indigo-400 focus:ring-indigo-500"
              />
              <span className="text-sm text-slate-600 dark:text-slate-300">允许部分完成</span>
            </label>
          </div>
        )}

        {/* Require Review */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-soft">
          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <span className="text-sm font-medium text-slate-700 dark:text-slate-200">完成后需要审核</span>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                开启后，被监督者完成任务需你审核通过才算完成
              </p>
            </div>
            <input
              type="checkbox"
              checked={formData.requireReview}
              onChange={(e) => setFormData(prev => ({ ...prev, requireReview: e.target.checked }))}
              className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-indigo-600 dark:text-indigo-400 focus:ring-indigo-500"
            />
          </label>
        </div>

        {/* Timeout */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-soft">
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">
            <Clock size={14} className="inline mr-1" />
            超时时间（分钟）
          </label>
          <input
            type="number"
            value={formData.timeoutMinutes}
            onChange={(e) => setFormData(prev => ({ ...prev, timeoutMinutes: parseInt(e.target.value) || 0 }))}
            min={0}
            placeholder="0 表示当天结束前"
            className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
          />
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
            设置为 0 表示需在当天结束前完成
          </p>
        </div>

        {/* Repeat Type */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-soft">
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-3">
            <Repeat size={14} className="inline mr-1" />
            重复方式 <span className="text-rose-500 dark:text-rose-400">*</span>
          </label>
          <div className="space-y-2">
            {REPEAT_TYPES.map((type) => (
              <button
                key={type.value}
                onClick={() => setFormData(prev => ({ ...prev, repeatType: type.value }))}
                className={`w-full p-3 rounded-xl border-2 transition-all text-left flex items-center justify-between ${
                  formData.repeatType === type.value
                    ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950'
                    : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:border-slate-600'
                }`}
              >
                <div>
                  <div className={`text-sm font-medium ${
                    formData.repeatType === type.value ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-700 dark:text-slate-200'
                  }`}>
                    {type.label}
                  </div>
                  <div className="text-[10px] text-slate-400 dark:text-slate-500">
                    {type.description}
                  </div>
                </div>
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                  formData.repeatType === type.value
                    ? 'border-indigo-500 bg-indigo-500'
                    : 'border-slate-300 dark:border-slate-600'
                }`}>
                  {formData.repeatType === type.value && (
                    <CheckCircle size={12} className="text-white" />
                  )}
                </div>
              </button>
            ))}
          </div>

          {/* Weekly day selector */}
          {formData.repeatType === 'WEEKLY' && (
            <div className="mt-4">
              <label className="block text-xs text-slate-500 dark:text-slate-400 mb-2">选择执行日期</label>
              <div className="flex gap-1">
                {WEEKDAYS.map((day) => {
                  const isSelected = formData.repeatDays.split(',').includes(day.value);
                  return (
                    <button
                      key={day.value}
                      onClick={() => toggleWeekday(day.value)}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                        isSelected
                          ? 'bg-indigo-500 text-white'
                          : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                      }`}
                    >
                      {day.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Single date selector */}
          {formData.repeatType === 'ONCE' && !isEditing && (
            <div className="mt-4">
              <label className="block text-xs text-slate-500 dark:text-slate-400 mb-2">
                <Calendar size={12} className="inline mr-1" />
                执行日期
              </label>
              <DatePickerSheet
                value={formData.scheduledDate}
                onChange={(v) => setFormData(prev => ({ ...prev, scheduledDate: v }))}
                min={formatDateKey(new Date())}
              />
            </div>
          )}
        </div>

        {/* Active Toggle (only for editing) */}
        {isEditing && (
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-soft">
            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <div className="text-sm font-medium text-slate-700 dark:text-slate-200">启用任务</div>
                <div className="text-xs text-slate-400 dark:text-slate-500">停用后将不再生成新任务</div>
              </div>
              <div className="relative">
                <input
                  type="checkbox"
                  checked={formData.isActive}
                  onChange={(e) => setFormData(prev => ({ ...prev, isActive: e.target.checked }))}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white dark:bg-slate-800 after:border-slate-300 dark:border-slate-600 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-500"></div>
              </div>
            </label>
          </div>
        )}

        {/* Bottom padding for safe area */}
        <div className="h-8" />
      </div>
    </div>
  );
};
