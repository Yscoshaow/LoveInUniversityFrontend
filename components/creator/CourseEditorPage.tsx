import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Plus,
  Search,
  BookOpen,
  Edit2,
  Trash2,
  ChevronRight,
  Loader2,
  Calendar,
  Award,
  Target,
  Save,
  X,
  Check,
} from 'lucide-react';
import { CourseBackend } from '../../types';
import { adminApi } from '../../lib/api';
import { ImageUploadCompact } from '../ui/ImageUpload';
import { useConfirm } from '@/hooks/useConfirm';

interface CourseEditorPageProps {
  onBack: () => void;
}

interface CourseFormData {
  name: string;
  description: string;
  iconUrl: string;
  categoryId: number | null;
  pointsPerCompletion: number;
  examPointsRequired: number;
  creditsOnPass: number;
  campusPointsPerTask: number;
  schedules: number[];
  prerequisiteIds: number[];
  isActive: boolean;
}

const initialFormData: CourseFormData = {
  name: '',
  description: '',
  iconUrl: '',
  categoryId: null,
  pointsPerCompletion: 1,
  examPointsRequired: 10,
  creditsOnPass: 1,
  campusPointsPerTask: 5,
  schedules: [],
  prerequisiteIds: [],
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

export const CourseEditorPage: React.FC<CourseEditorPageProps> = ({ onBack }) => {
  const confirm = useConfirm();

  const [courses, setCourses] = useState<CourseBackend[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingCourse, setEditingCourse] = useState<CourseBackend | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState<CourseFormData>(initialFormData);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCourses = async () => {
    try {
      setLoading(true);
      const data = await adminApi.getCourses(true);
      setCourses(data);
    } catch (err) {
      console.error('Failed to fetch courses:', err);
      setError('加载课程失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCourses();
  }, []);

  const filteredCourses = courses.filter(course =>
    course.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreate = () => {
    setFormData(initialFormData);
    setIsCreating(true);
    setEditingCourse(null);
  };

  const handleEdit = (course: CourseBackend) => {
    setFormData({
      name: course.name,
      description: course.description || '',
      iconUrl: course.iconUrl || '',
      categoryId: course.categoryId,
      pointsPerCompletion: course.pointsPerCompletion,
      examPointsRequired: course.examPointsRequired,
      creditsOnPass: course.creditsOnPass,
      campusPointsPerTask: course.campusPointsPerTask,
      schedules: course.schedules,
      prerequisiteIds: course.prerequisites.map(p => p.courseId),
      isActive: course.isActive,
    });
    setEditingCourse(course);
    setIsCreating(false);
  };

  const handleCancel = () => {
    setEditingCourse(null);
    setIsCreating(false);
    setFormData(initialFormData);
    setError(null);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      setError('请输入课程名称');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      if (isCreating) {
        await adminApi.createCourse({
          name: formData.name,
          description: formData.description || undefined,
          iconUrl: formData.iconUrl || undefined,
          categoryId: formData.categoryId,
          pointsPerCompletion: formData.pointsPerCompletion,
          examPointsRequired: formData.examPointsRequired,
          creditsOnPass: formData.creditsOnPass,
          campusPointsPerTask: formData.campusPointsPerTask,
          schedules: formData.schedules,
          prerequisiteIds: formData.prerequisiteIds,
        });
      } else if (editingCourse) {
        await adminApi.updateCourse(editingCourse.id, {
          name: formData.name,
          description: formData.description || null,
          iconUrl: formData.iconUrl || null,
          categoryId: formData.categoryId,
          pointsPerCompletion: formData.pointsPerCompletion,
          examPointsRequired: formData.examPointsRequired,
          creditsOnPass: formData.creditsOnPass,
          campusPointsPerTask: formData.campusPointsPerTask,
          schedules: formData.schedules,
          prerequisiteIds: formData.prerequisiteIds,
          isActive: formData.isActive,
        });
      }

      handleCancel();
      await fetchCourses();
    } catch (err: any) {
      setError(err.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (courseId: number) => {
    if (!(await confirm({ title: '确认删除', description: '确定要删除这个课程吗？此操作不可撤销。', destructive: true }))) {
      return;
    }

    try {
      await adminApi.deleteCourse(courseId);
      await fetchCourses();
    } catch (err: any) {
      setError(err.message || '删除失败');
    }
  };

  const toggleSchedule = (day: number) => {
    setFormData(prev => ({
      ...prev,
      schedules: prev.schedules.includes(day)
        ? prev.schedules.filter(d => d !== day)
        : [...prev.schedules, day].sort((a, b) => a - b),
    }));
  };

  // Form view
  if (isCreating || editingCourse) {
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
                {isCreating ? '创建课程' : '编辑课程'}
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
                课程名称 <span className="text-red-500 dark:text-red-400">*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-primary focus:outline-none"
                placeholder="输入课程名称"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
                课程描述
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-primary focus:outline-none resize-none"
                rows={3}
                placeholder="输入课程描述"
              />
            </div>

            {/* Icon Upload */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">
                课程图标
              </label>
              <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                <ImageUploadCompact
                  value={formData.iconUrl}
                  onChange={(url) => setFormData(prev => ({ ...prev, iconUrl: url }))}
                  folder="courses"
                />
              </div>
            </div>

            {/* Schedules */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">
                开课日期
              </label>
              <div className="flex flex-wrap gap-2">
                {WEEKDAYS.map(day => (
                  <button
                    key={day.value}
                    type="button"
                    onClick={() => toggleSchedule(day.value)}
                    className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                      formData.schedules.includes(day.value)
                        ? 'bg-primary text-white'
                        : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-primary'
                    }`}
                  >
                    {day.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Points Settings */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
                  每次完成积分
                </label>
                <input
                  type="number"
                  value={formData.pointsPerCompletion}
                  onChange={(e) => setFormData(prev => ({ ...prev, pointsPerCompletion: parseInt(e.target.value) || 0 }))}
                  className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-primary focus:outline-none"
                  min={0}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
                  考试所需积分
                </label>
                <input
                  type="number"
                  value={formData.examPointsRequired}
                  onChange={(e) => setFormData(prev => ({ ...prev, examPointsRequired: parseInt(e.target.value) || 0 }))}
                  className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-primary focus:outline-none"
                  min={0}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
                  通过学分
                </label>
                <input
                  type="number"
                  value={formData.creditsOnPass}
                  onChange={(e) => setFormData(prev => ({ ...prev, creditsOnPass: parseInt(e.target.value) || 0 }))}
                  className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-primary focus:outline-none"
                  min={0}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
                  校园点数/任务
                </label>
                <input
                  type="number"
                  value={formData.campusPointsPerTask}
                  onChange={(e) => setFormData(prev => ({ ...prev, campusPointsPerTask: parseInt(e.target.value) || 0 }))}
                  className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-primary focus:outline-none"
                  min={0}
                />
              </div>
            </div>

            {/* Prerequisite Courses */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">
                前置课程
              </label>
              <p className="text-xs text-slate-400 dark:text-slate-500 mb-2">学生需要先通过这些课程才能报名此课程</p>
              <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 max-h-48 overflow-y-auto">
                {courses
                  .filter(c => c.id !== editingCourse?.id) // 排除当前编辑的课程
                  .map(course => (
                    <label
                      key={course.id}
                      className="flex items-center gap-3 p-3 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer border-b border-slate-100 dark:border-slate-700 last:border-b-0"
                    >
                      <input
                        type="checkbox"
                        checked={formData.prerequisiteIds.includes(course.id)}
                        onChange={(e) => {
                          setFormData(prev => ({
                            ...prev,
                            prerequisiteIds: e.target.checked
                              ? [...prev.prerequisiteIds, course.id]
                              : prev.prerequisiteIds.filter(id => id !== course.id)
                          }));
                        }}
                        className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-primary focus:ring-primary/30"
                      />
                      <span className="text-sm text-slate-700 dark:text-slate-200">{course.name}</span>
                      {!course.isActive && (
                        <span className="text-[10px] text-slate-400 dark:text-slate-500">(已禁用)</span>
                      )}
                    </label>
                  ))}
                {courses.filter(c => c.id !== editingCourse?.id).length === 0 && (
                  <p className="p-3 text-sm text-slate-400 dark:text-slate-500 text-center">暂无其他课程</p>
                )}
              </div>
            </div>

            {/* Active Status */}
            <div className="flex items-center justify-between bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
              <div>
                <p className="font-medium text-slate-700 dark:text-slate-200">启用状态</p>
                <p className="text-xs text-slate-400 dark:text-slate-500">关闭后学生将无法报名此课程</p>
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
            <h1 className="text-lg font-bold text-slate-800 dark:text-slate-100">课程管理</h1>
            <p className="text-xs text-slate-400 dark:text-slate-500">{courses.length} 个课程</p>
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
            placeholder="搜索课程..."
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={24} className="animate-spin text-primary" />
          </div>
        ) : filteredCourses.length === 0 ? (
          <div className="text-center py-12">
            <BookOpen size={48} className="mx-auto text-slate-300 mb-4" />
            <p className="text-slate-500 dark:text-slate-400">暂无课程</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredCourses.map((course) => (
              <div
                key={course.id}
                className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-slate-100 dark:border-slate-700"
              >
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-950 flex items-center justify-center shrink-0">
                    {course.iconUrl ? (
                      <img src={course.iconUrl} alt="" className="w-8 h-8 object-contain" />
                    ) : (
                      <BookOpen size={24} className="text-blue-500 dark:text-blue-400" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-slate-800 dark:text-slate-100 truncate">{course.name}</h3>
                      {!course.isActive && (
                        <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 text-[10px] rounded-full">
                          已禁用
                        </span>
                      )}
                    </div>

                    {course.description && (
                      <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 line-clamp-1">
                        {course.description}
                      </p>
                    )}

                    <div className="flex items-center gap-3 mt-2">
                      <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                        <Calendar size={12} />
                        <span>
                          {course.schedules.length > 0
                            ? course.schedules.map(d => WEEKDAYS.find(w => w.value === d)?.label).join(', ')
                            : '未设置'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                        <Award size={12} />
                        <span>{course.creditsOnPass} 学分</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleEdit(course)}
                      className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                    >
                      <Edit2 size={16} className="text-slate-600 dark:text-slate-300" />
                    </button>
                    <button
                      onClick={() => handleDelete(course.id)}
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

export default CourseEditorPage;
