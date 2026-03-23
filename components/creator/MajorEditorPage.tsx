import React, { useState, useEffect, useCallback } from 'react';
import {
  ArrowLeft,
  Plus,
  Search,
  GraduationCap,
  Edit2,
  Trash2,
  Loader2,
  Save,
  X,
  BookOpen,
  GripVertical,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';
import type {
  MajorSummary,
  MajorDetail,
  CourseSummaryBackend,
  CreateMajorRequest,
  UpdateMajorRequest,
} from '../../types';
import { adminApi } from '../../lib/api';
import { useConfirm } from '@/hooks/useConfirm';

interface MajorEditorPageProps {
  onBack: () => void;
}

interface MajorFormData {
  name: string;
  description: string;
  iconUrl: string;
  isActive: boolean;
  courseIds: number[];
}

const initialFormData: MajorFormData = {
  name: '',
  description: '',
  iconUrl: '',
  isActive: true,
  courseIds: [],
};

export const MajorEditorPage: React.FC<MajorEditorPageProps> = ({ onBack }) => {
  const confirm = useConfirm();

  const [majors, setMajors] = useState<MajorSummary[]>([]);
  const [courses, setCourses] = useState<CourseSummaryBackend[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingMajor, setEditingMajor] = useState<MajorDetail | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState<MajorFormData>(initialFormData);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [courseSearch, setCourseSearch] = useState('');

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [majorsData, coursesData] = await Promise.all([
        adminApi.getMajors(),
        adminApi.getCourses(true),
      ]);
      setMajors(majorsData);
      setCourses(coursesData);
    } catch (err) {
      console.error('Failed to fetch data:', err);
      setError('加载数据失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredMajors = majors.filter(m =>
    m.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredCourses = courses.filter(c =>
    c.name.toLowerCase().includes(courseSearch.toLowerCase())
  );

  const handleCreate = () => {
    setFormData(initialFormData);
    setIsCreating(true);
    setEditingMajor(null);
    setError(null);
  };

  const handleEdit = async (majorId: number) => {
    try {
      setLoading(true);
      const detail = await adminApi.getMajor(majorId);
      setFormData({
        name: detail.name,
        description: detail.description || '',
        iconUrl: detail.iconUrl || '',
        isActive: detail.isActive,
        courseIds: detail.courses
          .sort((a, b) => a.orderIndex - b.orderIndex)
          .map(c => c.courseId),
      });
      setEditingMajor(detail);
      setIsCreating(false);
      setError(null);
    } catch (err: any) {
      setError(err.message || '加载专业详情失败');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setEditingMajor(null);
    setIsCreating(false);
    setFormData(initialFormData);
    setError(null);
    setCourseSearch('');
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      setError('请输入专业名称');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      if (isCreating) {
        const request: CreateMajorRequest = {
          name: formData.name.trim(),
          description: formData.description.trim() || null,
          iconUrl: formData.iconUrl.trim() || null,
          isActive: formData.isActive,
          courseIds: formData.courseIds,
        };
        await adminApi.createMajor(request);
      } else if (editingMajor) {
        const request: UpdateMajorRequest = {
          name: formData.name.trim(),
          description: formData.description.trim() || null,
          iconUrl: formData.iconUrl.trim() || null,
          isActive: formData.isActive,
          courseIds: formData.courseIds,
        };
        await adminApi.updateMajor(editingMajor.id, request);
      }

      await fetchData();
      handleCancel();
    } catch (err: any) {
      setError(err.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (majorId: number) => {
    if (!(await confirm({ title: '确认删除', description: '确定要删除这个专业吗？删除后不可恢复。', destructive: true }))) {
      return;
    }

    try {
      await adminApi.deleteMajor(majorId);
      await fetchData();
    } catch (err: any) {
      setError(err.message || '删除失败');
    }
  };

  const toggleCourse = (courseId: number) => {
    setFormData(prev => {
      const exists = prev.courseIds.includes(courseId);
      return {
        ...prev,
        courseIds: exists
          ? prev.courseIds.filter(id => id !== courseId)
          : [...prev.courseIds, courseId],
      };
    });
  };

  const moveCourse = (index: number, direction: 'up' | 'down') => {
    setFormData(prev => {
      const newIds = [...prev.courseIds];
      const swapIndex = direction === 'up' ? index - 1 : index + 1;
      if (swapIndex < 0 || swapIndex >= newIds.length) return prev;
      [newIds[index], newIds[swapIndex]] = [newIds[swapIndex], newIds[index]];
      return { ...prev, courseIds: newIds };
    });
  };

  const getCourseName = (courseId: number) => {
    return courses.find(c => c.id === courseId)?.name || `课程 #${courseId}`;
  };

  // Form view
  if (isCreating || editingMajor) {
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
                {isCreating ? '创建专业' : '编辑专业'}
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
                专业名称 <span className="text-red-500 dark:text-red-400">*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-primary focus:outline-none"
                placeholder="输入专业名称"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
                专业描述
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-primary focus:outline-none resize-none"
                rows={3}
                placeholder="输入专业描述"
              />
            </div>

            {/* Icon URL */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
                图标 URL
              </label>
              <input
                type="text"
                value={formData.iconUrl}
                onChange={(e) => setFormData(prev => ({ ...prev, iconUrl: e.target.value }))}
                className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-primary focus:outline-none"
                placeholder="输入图标 URL（可选）"
              />
              {formData.iconUrl && (
                <div className="mt-2 flex items-center gap-2">
                  <img
                    src={formData.iconUrl}
                    alt="预览"
                    className="w-10 h-10 rounded-lg object-cover bg-slate-100 dark:bg-slate-700"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                  <span className="text-xs text-slate-400 dark:text-slate-500">图标预览</span>
                </div>
              )}
            </div>

            {/* Active Status */}
            <div className="flex items-center justify-between bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
              <div>
                <p className="font-medium text-slate-700 dark:text-slate-200">启用状态</p>
                <p className="text-xs text-slate-400 dark:text-slate-500">关闭后用户无法选择此专业</p>
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

            {/* Course Selection */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">
                包含课程
              </label>

              {/* Selected courses with ordering */}
              {formData.courseIds.length > 0 && (
                <div className="mb-3 space-y-2">
                  <p className="text-xs text-slate-400 dark:text-slate-500">已选 {formData.courseIds.length} 门课程（可拖拽排序）</p>
                  {formData.courseIds.map((courseId, index) => (
                    <div
                      key={courseId}
                      className="flex items-center gap-2 bg-white dark:bg-slate-800 p-3 rounded-xl border border-primary/20 bg-primary/5"
                    >
                      <GripVertical size={16} className="text-slate-300 shrink-0" />
                      <span className="text-xs font-medium text-slate-400 dark:text-slate-500 w-6">{index + 1}</span>
                      <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950 flex items-center justify-center shrink-0">
                        <BookOpen size={14} className="text-blue-500 dark:text-blue-400" />
                      </div>
                      <span className="flex-1 text-sm font-medium text-slate-700 dark:text-slate-200 truncate">
                        {getCourseName(courseId)}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => moveCourse(index, 'up')}
                          disabled={index === 0}
                          className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-600 disabled:opacity-30 transition-colors"
                        >
                          <ChevronUp size={14} className="text-slate-600 dark:text-slate-300" />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveCourse(index, 'down')}
                          disabled={index === formData.courseIds.length - 1}
                          className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-600 disabled:opacity-30 transition-colors"
                        >
                          <ChevronDown size={14} className="text-slate-600 dark:text-slate-300" />
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleCourse(courseId)}
                          className="w-7 h-7 rounded-lg bg-red-50 dark:bg-red-950 flex items-center justify-center hover:bg-red-100 dark:hover:bg-red-900 transition-colors"
                        >
                          <X size={14} className="text-red-500 dark:text-red-400" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Course search & add */}
              <div className="relative mb-2">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                <input
                  type="text"
                  value={courseSearch}
                  onChange={(e) => setCourseSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-primary focus:outline-none text-sm"
                  placeholder="搜索课程..."
                />
              </div>

              <div className="max-h-60 overflow-y-auto space-y-1 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-2">
                {filteredCourses.length === 0 ? (
                  <p className="text-center text-xs text-slate-400 dark:text-slate-500 py-4">暂无课程</p>
                ) : (
                  filteredCourses.map(course => {
                    const isSelected = formData.courseIds.includes(course.id);
                    return (
                      <button
                        key={course.id}
                        type="button"
                        onClick={() => toggleCourse(course.id)}
                        className={`w-full flex items-center gap-3 p-2.5 rounded-lg transition-all text-left ${
                          isSelected
                            ? 'bg-primary/10 border border-primary/20'
                            : 'hover:bg-slate-50 dark:hover:bg-slate-800'
                        }`}
                      >
                        <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${
                          isSelected ? 'bg-primary border-primary' : 'border-slate-300 dark:border-slate-600'
                        }`}>
                          {isSelected && (
                            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">{course.name}</p>
                          {course.categoryName && (
                            <p className="text-[10px] text-slate-400 dark:text-slate-500">{course.categoryName}</p>
                          )}
                        </div>
                        {!course.isActive && (
                          <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 text-[10px] rounded-full shrink-0">
                            已停用
                          </span>
                        )}
                      </button>
                    );
                  })
                )}
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
            <h1 className="text-lg font-bold text-slate-800 dark:text-slate-100">专业管理</h1>
            <p className="text-xs text-slate-400 dark:text-slate-500">{majors.length} 个专业</p>
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
            placeholder="搜索专业..."
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400 rounded-xl text-sm">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={24} className="animate-spin text-primary" />
          </div>
        ) : filteredMajors.length === 0 ? (
          <div className="text-center py-12">
            <GraduationCap size={48} className="mx-auto text-slate-300 mb-4" />
            <p className="text-slate-500 dark:text-slate-400">暂无专业</p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">点击新建按钮创建专业</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredMajors.map((major) => (
              <div
                key={major.id}
                className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-slate-100 dark:border-slate-700"
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950 flex items-center justify-center shrink-0 overflow-hidden">
                    {major.iconUrl ? (
                      <img
                        src={major.iconUrl}
                        alt={major.name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                          (e.target as HTMLImageElement).parentElement!.innerHTML =
                            '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-indigo-500 dark:text-indigo-400"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>';
                        }}
                      />
                    ) : (
                      <GraduationCap size={20} className="text-indigo-500 dark:text-indigo-400" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-slate-800 dark:text-slate-100 truncate">{major.name}</h3>
                      {!major.isActive && (
                        <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 text-[10px] rounded-full">
                          已停用
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 line-clamp-1">
                      {major.description || '暂无描述'}
                    </p>
                    <div className="flex items-center gap-3 mt-1.5">
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                        <BookOpen size={12} />
                        {major.courseCount} 门课程
                      </span>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400">
                        {major.totalCredits} 总学分
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleEdit(major.id)}
                      className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                    >
                      <Edit2 size={16} className="text-slate-600 dark:text-slate-300" />
                    </button>
                    <button
                      onClick={() => handleDelete(major.id)}
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

export default MajorEditorPage;
