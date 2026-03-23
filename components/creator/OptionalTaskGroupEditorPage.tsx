import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Plus,
  Search,
  ListChecks,
  Edit2,
  Trash2,
  Loader2,
  Save,
  X,
  Calendar,
  Target,
  CheckSquare,
} from 'lucide-react';
import { CourseBackend, TaskDefinitionBackend } from '../../types';
import { adminApi } from '../../lib/api';
import { useConfirm } from '@/hooks/useConfirm';

interface OptionalTaskGroupEditorPageProps {
  onBack: () => void;
}

interface OptionalTaskGroupBackend {
  id: number;
  name: string;
  description: string | null;
  courseId: number;
  requiredCount: number;
  totalCount: number;
  scheduleDays: number[] | null;
  isActive: boolean;
  items?: { taskDefinitionId: number }[];
}

interface OptionalTaskGroupFormData {
  courseId: number | null;
  name: string;
  description: string;
  requiredCount: number;
  taskDefinitionIds: number[];
  scheduleDays: number[];
  isActive: boolean;
}

const initialFormData: OptionalTaskGroupFormData = {
  courseId: null,
  name: '',
  description: '',
  requiredCount: 2,
  taskDefinitionIds: [],
  scheduleDays: [],
  isActive: true,
};

const WEEKDAYS = [
  { value: 1, label: '周一' },
  { value: 2, label: '周二' },
  { value: 3, label: '周三' },
  { value: 4, label: '周四' },
  { value: 5, label: '周五' },
  { value: 6, label: '周六' },
  { value: 7, label: '周日' },
];

export const OptionalTaskGroupEditorPage: React.FC<OptionalTaskGroupEditorPageProps> = ({ onBack }) => {
  const confirm = useConfirm();

  const [courses, setCourses] = useState<CourseBackend[]>([]);
  const [tasks, setTasks] = useState<TaskDefinitionBackend[]>([]);
  const [groups, setGroups] = useState<OptionalTaskGroupBackend[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCourseId, setSelectedCourseId] = useState<number | null>(null);
  const [editingGroup, setEditingGroup] = useState<OptionalTaskGroupBackend | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState<OptionalTaskGroupFormData>(initialFormData);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [coursesData, tasksData, groupsData] = await Promise.all([
        adminApi.getCourses(true),
        adminApi.getTaskDefinitions(true),
        adminApi.getOptionalTaskGroups(),
      ]);
      setCourses(coursesData);
      setTasks(tasksData);
      setGroups(groupsData);
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

  const filteredGroups = groups.filter(group => {
    const matchesSearch = group.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCourse = selectedCourseId ? group.courseId === selectedCourseId : true;
    return matchesSearch && matchesCourse;
  });

  // 根据选择的课程筛选可用任务
  const availableTasks = tasks.filter(t =>
    formData.courseId ? t.courseId === formData.courseId : true
  );

  const getCourseName = (courseId: number) => {
    return courses.find(c => c.id === courseId)?.name || '未知课程';
  };

  const handleCreate = () => {
    setFormData({
      ...initialFormData,
      courseId: selectedCourseId,
    });
    setIsCreating(true);
    setEditingGroup(null);
  };

  const handleEdit = (group: OptionalTaskGroupBackend) => {
    setFormData({
      courseId: group.courseId,
      name: group.name,
      description: group.description || '',
      requiredCount: group.requiredCount,
      taskDefinitionIds: group.items?.map(i => i.taskDefinitionId) || [],
      scheduleDays: group.scheduleDays || [],
      isActive: group.isActive,
    });
    setEditingGroup(group);
    setIsCreating(false);
  };

  const handleCancel = () => {
    setEditingGroup(null);
    setIsCreating(false);
    setFormData(initialFormData);
    setError(null);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      setError('请输入任务组名称');
      return;
    }
    if (!formData.courseId) {
      setError('请选择课程');
      return;
    }
    if (formData.scheduleDays.length === 0) {
      setError('请选择至少一个开放日期');
      return;
    }
    if (formData.taskDefinitionIds.length === 0) {
      setError('请选择至少一个任务');
      return;
    }
    if (formData.requiredCount > formData.taskDefinitionIds.length) {
      setError('需完成数量不能超过可选任务数');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      const request = {
        name: formData.name,
        description: formData.description || undefined,
        courseId: formData.courseId!,
        requiredCount: formData.requiredCount,
        taskDefinitionIds: formData.taskDefinitionIds,
        scheduleDays: formData.scheduleDays,
      };

      if (isCreating) {
        await adminApi.createOptionalTaskGroup(request);
      } else if (editingGroup) {
        await adminApi.updateOptionalTaskGroup(editingGroup.id, {
          ...request,
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

  const handleDelete = async (groupId: number) => {
    if (!(await confirm({ title: '确认删除', description: '确定要删除这个选做任务组吗？', destructive: true }))) {
      return;
    }

    try {
      await adminApi.deleteOptionalTaskGroup(groupId);
      await fetchData();
    } catch (err: any) {
      setError(err.message || '删除失败');
    }
  };

  const toggleScheduleDay = (day: number) => {
    setFormData(prev => ({
      ...prev,
      scheduleDays: prev.scheduleDays.includes(day)
        ? prev.scheduleDays.filter(d => d !== day)
        : [...prev.scheduleDays, day].sort((a, b) => a - b),
    }));
  };

  const toggleTask = (taskId: number) => {
    setFormData(prev => ({
      ...prev,
      taskDefinitionIds: prev.taskDefinitionIds.includes(taskId)
        ? prev.taskDefinitionIds.filter(id => id !== taskId)
        : [...prev.taskDefinitionIds, taskId],
    }));
  };

  // Form view
  if (isCreating || editingGroup) {
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
                {isCreating ? '创建选做任务组' : '编辑选做任务组'}
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
                onChange={(e) => {
                  const newCourseId = e.target.value ? parseInt(e.target.value) : null;
                  setFormData(prev => ({
                    ...prev,
                    courseId: newCourseId,
                    taskDefinitionIds: [] // 清空任务选择
                  }));
                }}
                className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-primary focus:outline-none"
              >
                <option value="">选择课程</option>
                {courses.map(course => (
                  <option key={course.id} value={course.id}>{course.name}</option>
                ))}
              </select>
            </div>

            {/* Group Name */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
                任务组名称 <span className="text-red-500 dark:text-red-400">*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-primary focus:outline-none"
                placeholder="输入任务组名称"
              />
            </div>

            {/* Group Description */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
                任务组描述
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-primary focus:outline-none resize-none"
                rows={3}
                placeholder="输入任务组描述"
              />
            </div>

            {/* Task Selection */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">
                可选任务 <span className="text-red-500 dark:text-red-400">*</span>
                <span className="text-xs text-slate-400 dark:text-slate-500 ml-2">
                  (已选 {formData.taskDefinitionIds.length} 个)
                </span>
              </label>
              {!formData.courseId ? (
                <div className="bg-slate-50 dark:bg-slate-900 rounded-xl p-4 text-center text-sm text-slate-400 dark:text-slate-500">
                  请先选择课程
                </div>
              ) : availableTasks.length === 0 ? (
                <div className="bg-slate-50 dark:bg-slate-900 rounded-xl p-4 text-center text-sm text-slate-400 dark:text-slate-500">
                  该课程暂无任务定义
                </div>
              ) : (
                <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 max-h-48 overflow-y-auto">
                  {availableTasks.map(task => (
                    <label
                      key={task.id}
                      className="flex items-center gap-3 p-3 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer border-b border-slate-100 dark:border-slate-700 last:border-b-0"
                    >
                      <input
                        type="checkbox"
                        checked={formData.taskDefinitionIds.includes(task.id)}
                        onChange={() => toggleTask(task.id)}
                        className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-primary focus:ring-primary/30"
                      />
                      <div className="flex-1 min-w-0">
                        <span className="text-sm text-slate-700 dark:text-slate-200">{task.name}</span>
                        <span className="text-xs text-slate-400 dark:text-slate-500 ml-2">
                          ({task.taskType} · {task.targetValue}{task.targetUnit !== 'NONE' ? ` ${task.targetUnit}` : ''})
                        </span>
                      </div>
                      {!task.isActive && (
                        <span className="text-[10px] text-slate-400 dark:text-slate-500">(已禁用)</span>
                      )}
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* Required Count */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
                需完成任务数
              </label>
              <input
                type="number"
                value={formData.requiredCount}
                onChange={(e) => setFormData(prev => ({ ...prev, requiredCount: parseInt(e.target.value) || 1 }))}
                className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-primary focus:outline-none"
                min={1}
                max={formData.taskDefinitionIds.length || 99}
              />
              <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
                用户需要从 {formData.taskDefinitionIds.length} 个可选任务中选择并完成 {formData.requiredCount} 个
              </p>
            </div>

            {/* Schedule Days */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">
                开放日期 <span className="text-red-500 dark:text-red-400">*</span>
              </label>
              <div className="flex flex-wrap gap-2">
                {WEEKDAYS.map(day => (
                  <button
                    key={day.value}
                    type="button"
                    onClick={() => toggleScheduleDay(day.value)}
                    className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                      formData.scheduleDays.includes(day.value)
                        ? 'bg-primary text-white'
                        : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-primary'
                    }`}
                  >
                    {day.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Active Status */}
            <div className="flex items-center justify-between bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
              <div>
                <p className="font-medium text-slate-700 dark:text-slate-200">启用状态</p>
                <p className="text-xs text-slate-400 dark:text-slate-500">关闭后不会生成此任务组</p>
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
            <h1 className="text-lg font-bold text-slate-800 dark:text-slate-100">选做任务组</h1>
            <p className="text-xs text-slate-400 dark:text-slate-500">{groups.length} 个任务组</p>
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
            placeholder="搜索任务组..."
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={24} className="animate-spin text-primary" />
          </div>
        ) : filteredGroups.length === 0 ? (
          <div className="text-center py-12">
            <ListChecks size={48} className="mx-auto text-slate-300 mb-4" />
            <p className="text-slate-500 dark:text-slate-400">暂无选做任务组</p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">点击新建按钮创建任务组</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredGroups.map((group) => (
              <div
                key={group.id}
                className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-slate-100 dark:border-slate-700"
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-cyan-50 dark:bg-cyan-950 flex items-center justify-center shrink-0 text-cyan-500 dark:text-cyan-400">
                    <ListChecks size={20} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-slate-800 dark:text-slate-100 truncate">{group.name}</h3>
                      {!group.isActive && (
                        <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 text-[10px] rounded-full">
                          已禁用
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                      {getCourseName(group.courseId)}
                    </p>

                    <div className="flex items-center gap-3 mt-2">
                      <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                        <Target size={12} />
                        <span>选{group.requiredCount}/{group.totalCount}</span>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                        <Calendar size={12} />
                        <span>
                          {group.scheduleDays?.map(d => WEEKDAYS.find(w => w.value === d)?.label).join(', ') || '未设置'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleEdit(group)}
                      className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                    >
                      <Edit2 size={16} className="text-slate-600 dark:text-slate-300" />
                    </button>
                    <button
                      onClick={() => handleDelete(group.id)}
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

export default OptionalTaskGroupEditorPage;
