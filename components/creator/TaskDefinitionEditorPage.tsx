import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Plus,
  Search,
  ListTodo,
  Edit2,
  Trash2,
  Loader2,
  Save,
  X,
  Timer,
  Target,
  CheckCircle,
  Lock,
} from 'lucide-react';
import { CourseBackend, TaskDefinitionBackend, TaskTypeBackend, TargetUnitBackend } from '../../types';
import { adminApi } from '../../lib/api';
import { ImageUploadCompact } from '../ui/ImageUpload';
import { useConfirm } from '@/hooks/useConfirm';

interface TaskDefinitionEditorPageProps {
  onBack: () => void;
}

interface TaskFormData {
  courseId: number | null;
  isExamTask: boolean;
  name: string;
  description: string;
  iconUrl: string;
  taskType: TaskTypeBackend;
  targetValue: number;
  targetUnit: TargetUnitBackend;
  orderIndex: number;
  allowPartial: boolean;
  timeoutMinutes: number;
  isActive: boolean;
}

const initialFormData: TaskFormData = {
  courseId: null,
  isExamTask: false,
  name: '',
  description: '',
  iconUrl: '',
  taskType: 'MANUAL',
  targetValue: 1,
  targetUnit: 'NONE',
  orderIndex: 0,
  allowPartial: false,
  timeoutMinutes: 0,
  isActive: true,
};

const TASK_TYPES: { value: TaskTypeBackend; label: string; icon: React.ReactNode }[] = [
  { value: 'MANUAL', label: '手动完成', icon: <CheckCircle size={16} /> },
  { value: 'DURATION', label: '时长任务', icon: <Timer size={16} /> },
  { value: 'COUNT', label: '计数任务', icon: <Target size={16} /> },
  { value: 'LOCK', label: '锁任务', icon: <Lock size={16} /> },
];

const TARGET_UNITS: { value: TargetUnitBackend; label: string }[] = [
  { value: 'NONE', label: '无' },
  { value: 'MINUTES', label: '分钟' },
  { value: 'HOURS', label: '小时' },
  { value: 'TIMES', label: '次' },
  { value: 'KILOMETERS', label: '公里' },
  { value: 'METERS', label: '米' },
];

export const TaskDefinitionEditorPage: React.FC<TaskDefinitionEditorPageProps> = ({ onBack }) => {
  const confirm = useConfirm();

  const [courses, setCourses] = useState<CourseBackend[]>([]);
  const [tasks, setTasks] = useState<TaskDefinitionBackend[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCourseId, setSelectedCourseId] = useState<number | null>(null);
  const [editingTask, setEditingTask] = useState<TaskDefinitionBackend | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState<TaskFormData>(initialFormData);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [coursesData, tasksData] = await Promise.all([
        adminApi.getCourses(true),
        adminApi.getTaskDefinitions(true),
      ]);
      setCourses(coursesData);
      setTasks(tasksData);
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

  const filteredTasks = tasks.filter(task => {
    const matchesSearch = task.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCourse = selectedCourseId ? task.courseId === selectedCourseId : true;
    return matchesSearch && matchesCourse;
  });

  const getCourseName = (courseId: number) => {
    return courses.find(c => c.id === courseId)?.name || '未知课程';
  };

  const handleCreate = () => {
    setFormData({
      ...initialFormData,
      courseId: selectedCourseId,
    });
    setIsCreating(true);
    setEditingTask(null);
  };

  const handleEdit = (task: TaskDefinitionBackend) => {
    setFormData({
      courseId: task.courseId,
      isExamTask: task.isExamTask,
      name: task.name,
      description: task.description || '',
      iconUrl: task.iconUrl || '',
      taskType: task.taskType,
      targetValue: task.targetValue,
      targetUnit: task.targetUnit,
      orderIndex: task.orderIndex,
      allowPartial: task.allowPartial,
      timeoutMinutes: task.timeoutMinutes,
      isActive: task.isActive,
    });
    setEditingTask(task);
    setIsCreating(false);
  };

  const handleCancel = () => {
    setEditingTask(null);
    setIsCreating(false);
    setFormData(initialFormData);
    setError(null);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      setError('请输入任务名称');
      return;
    }
    if (!formData.courseId) {
      setError('请选择课程');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      if (isCreating) {
        await adminApi.createTaskDefinition({
          courseId: formData.courseId!,
          isExamTask: formData.isExamTask,
          name: formData.name,
          description: formData.description || undefined,
          iconUrl: formData.iconUrl || undefined,
          taskType: formData.taskType,
          targetValue: formData.targetValue,
          targetUnit: formData.targetUnit,
          orderIndex: formData.orderIndex,
          allowPartial: formData.allowPartial,
          timeoutMinutes: formData.timeoutMinutes,
        });
      } else if (editingTask) {
        await adminApi.updateTaskDefinition(editingTask.id, {
          name: formData.name,
          description: formData.description || null,
          iconUrl: formData.iconUrl || null,
          taskType: formData.taskType,
          targetValue: formData.targetValue,
          targetUnit: formData.targetUnit,
          orderIndex: formData.orderIndex,
          allowPartial: formData.allowPartial,
          timeoutMinutes: formData.timeoutMinutes,
          isActive: formData.isActive,
        });
      }

      handleCancel();
      await fetchData();
    } catch (err: any) {
      setError(err.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (taskId: number) => {
    if (!(await confirm({ title: '确认删除', description: '确定要删除这个任务定义吗？', destructive: true }))) {
      return;
    }

    try {
      await adminApi.deleteTaskDefinition(taskId);
      await fetchData();
    } catch (err: any) {
      setError(err.message || '删除失败');
    }
  };

  const getTaskTypeIcon = (type: TaskTypeBackend) => {
    const found = TASK_TYPES.find(t => t.value === type);
    return found?.icon || <Target size={16} />;
  };

  // Form view
  if (isCreating || editingTask) {
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
                {isCreating ? '创建任务定义' : '编辑任务定义'}
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
            {/* Course Selection */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
                所属课程 <span className="text-red-500 dark:text-red-400">*</span>
              </label>
              <select
                value={formData.courseId || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, courseId: e.target.value ? parseInt(e.target.value) : null }))}
                className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-primary focus:outline-none"
              >
                <option value="">选择课程</option>
                {courses.map(course => (
                  <option key={course.id} value={course.id}>{course.name}</option>
                ))}
              </select>
            </div>

            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
                任务名称 <span className="text-red-500 dark:text-red-400">*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-primary focus:outline-none"
                placeholder="输入任务名称"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
                任务描述
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-primary focus:outline-none resize-none"
                rows={3}
                placeholder="输入任务描述"
              />
            </div>

            {/* Icon Upload */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">
                任务图标
              </label>
              <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                <ImageUploadCompact
                  value={formData.iconUrl}
                  onChange={(url) => setFormData(prev => ({ ...prev, iconUrl: url }))}
                  folder="tasks"
                />
              </div>
            </div>

            {/* Task Type */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">
                任务类型
              </label>
              <div className="grid grid-cols-2 gap-2">
                {TASK_TYPES.map(type => (
                  <button
                    key={type.value}
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, taskType: type.value }))}
                    className={`p-3 rounded-xl border-2 flex items-center gap-2 transition-all ${
                      formData.taskType === type.value
                        ? 'border-primary bg-primary/5'
                        : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:border-slate-600'
                    }`}
                  >
                    <span className={formData.taskType === type.value ? 'text-primary' : 'text-slate-400 dark:text-slate-500'}>
                      {type.icon}
                    </span>
                    <span className={`text-sm font-medium ${
                      formData.taskType === type.value ? 'text-primary' : 'text-slate-600 dark:text-slate-300'
                    }`}>
                      {type.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Target Value & Unit */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
                  目标值
                </label>
                <input
                  type="number"
                  value={formData.targetValue}
                  onChange={(e) => setFormData(prev => ({ ...prev, targetValue: parseFloat(e.target.value) || 0 }))}
                  className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-primary focus:outline-none"
                  min={0}
                  step={0.1}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
                  目标单位
                </label>
                <select
                  value={formData.targetUnit}
                  onChange={(e) => setFormData(prev => ({ ...prev, targetUnit: e.target.value as TargetUnitBackend }))}
                  className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-primary focus:outline-none"
                >
                  {TARGET_UNITS.map(unit => (
                    <option key={unit.value} value={unit.value}>{unit.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Order Index & Timeout */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
                  排序顺序
                </label>
                <input
                  type="number"
                  value={formData.orderIndex}
                  onChange={(e) => setFormData(prev => ({ ...prev, orderIndex: parseInt(e.target.value) || 0 }))}
                  className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-primary focus:outline-none"
                  min={0}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
                  超时（分钟）
                </label>
                <input
                  type="number"
                  value={formData.timeoutMinutes}
                  onChange={(e) => setFormData(prev => ({ ...prev, timeoutMinutes: parseInt(e.target.value) || 0 }))}
                  className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-primary focus:outline-none"
                  min={0}
                />
                <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">0 表示当天结束前</p>
              </div>
            </div>

            {/* Toggles */}
            <div className="space-y-3">
              <div className="flex items-center justify-between bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                <div>
                  <p className="font-medium text-slate-700 dark:text-slate-200">考试任务</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500">标记为考试任务</p>
                </div>
                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, isExamTask: !prev.isExamTask }))}
                  className={`w-12 h-7 rounded-full transition-colors ${
                    formData.isExamTask ? 'bg-primary' : 'bg-slate-300'
                  }`}
                >
                  <div className={`w-5 h-5 bg-white dark:bg-slate-800 rounded-full shadow-sm transform transition-transform ${
                    formData.isExamTask ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </button>
              </div>

              <div className="flex items-center justify-between bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                <div>
                  <p className="font-medium text-slate-700 dark:text-slate-200">允许部分完成</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500">适用于时长类任务</p>
                </div>
                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, allowPartial: !prev.allowPartial }))}
                  className={`w-12 h-7 rounded-full transition-colors ${
                    formData.allowPartial ? 'bg-primary' : 'bg-slate-300'
                  }`}
                >
                  <div className={`w-5 h-5 bg-white dark:bg-slate-800 rounded-full shadow-sm transform transition-transform ${
                    formData.allowPartial ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </button>
              </div>

              <div className="flex items-center justify-between bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                <div>
                  <p className="font-medium text-slate-700 dark:text-slate-200">启用状态</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500">关闭后不会生成此任务</p>
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
            <h1 className="text-lg font-bold text-slate-800 dark:text-slate-100">任务定义</h1>
            <p className="text-xs text-slate-400 dark:text-slate-500">{tasks.length} 个任务</p>
          </div>
          <button
            onClick={handleCreate}
            className="px-4 py-2 bg-primary text-white rounded-xl font-medium flex items-center gap-2 hover:bg-primary/90"
          >
            <Plus size={18} />
            新建
          </button>
        </div>

        {/* Course Filter */}
        <div className="mb-3">
          <select
            value={selectedCourseId || ''}
            onChange={(e) => setSelectedCourseId(e.target.value ? parseInt(e.target.value) : null)}
            className="w-full px-4 py-2.5 bg-slate-100 dark:bg-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            <option value="">所有课程</option>
            {courses.map(course => (
              <option key={course.id} value={course.id}>{course.name}</option>
            ))}
          </select>
        </div>

        {/* Search */}
        <div className="relative">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-100 dark:bg-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/30"
            placeholder="搜索任务..."
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={24} className="animate-spin text-primary" />
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className="text-center py-12">
            <ListTodo size={48} className="mx-auto text-slate-300 mb-4" />
            <p className="text-slate-500 dark:text-slate-400">暂无任务定义</p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">点击新建按钮创建任务</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredTasks.map((task) => (
              <div
                key={task.id}
                className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-slate-100 dark:border-slate-700"
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-green-50 dark:bg-green-950 flex items-center justify-center shrink-0 text-green-500 dark:text-green-400">
                    {getTaskTypeIcon(task.taskType)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-slate-800 dark:text-slate-100 truncate">{task.name}</h3>
                      {task.isExamTask && (
                        <span className="px-2 py-0.5 bg-amber-100 text-amber-600 dark:text-amber-400 text-[10px] rounded-full">
                          考试
                        </span>
                      )}
                      {!task.isActive && (
                        <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 text-[10px] rounded-full">
                          已禁用
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                      {task.courseName} · 目标: {task.targetValue} {TARGET_UNITS.find(u => u.value === task.targetUnit)?.label || ''}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleEdit(task)}
                      className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                    >
                      <Edit2 size={16} className="text-slate-600 dark:text-slate-300" />
                    </button>
                    <button
                      onClick={() => handleDelete(task.id)}
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

export default TaskDefinitionEditorPage;
