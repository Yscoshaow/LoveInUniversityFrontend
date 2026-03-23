import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Plus,
  Search,
  Sparkles,
  Edit2,
  Trash2,
  Loader2,
  Save,
  X,
  Zap,
  Clock,
  Target,
  TrendingUp,
  TrendingDown,
  Award,
} from 'lucide-react';
import {
  CourseSummaryBackend,
  BuffBackend,
  CreateBuffRequest,
  UpdateBuffRequest,
  CategoryBackend,
  ClubBackend,
  BuffTypeBackend,
  BuffTargetScope,
} from '../../types';
import { adminApi } from '../../lib/api';
import { useConfirm } from '@/hooks/useConfirm';

interface BuffEditorPageProps {
  onBack: () => void;
}

interface BuffFormData {
  clubId: number | null;
  name: string;
  description: string;
  buffType: BuffTypeBackend;
  targetScope: BuffTargetScope;
  targetIds: number[];
  value: number;
  isActive: boolean;
}

const initialFormData: BuffFormData = {
  clubId: null,
  name: '',
  description: '',
  buffType: 'TIME_REDUCTION_PERCENT',
  targetScope: 'ALL',
  targetIds: [],
  value: 10,
  isActive: true,
};

const BUFF_TYPES: { value: BuffTypeBackend; label: string; description: string; icon: React.ReactNode; category: 'easy' | 'hard' | 'reward' }[] = [
  // 降低难度（让任务更容易完成）
  { value: 'TIME_REDUCTION_PERCENT', label: '时间减少%', description: '减少任务所需时间', icon: <TrendingDown size={16} className="text-green-500 dark:text-green-400" />, category: 'easy' },
  { value: 'VALUE_REDUCTION_PERCENT', label: '目标值减少%', description: '减少任务目标值', icon: <TrendingDown size={16} className="text-green-500 dark:text-green-400" />, category: 'easy' },
  { value: 'VALUE_BONUS_FLAT', label: '目标值固定减少', description: '目标值减少固定数量', icon: <TrendingDown size={16} className="text-green-500 dark:text-green-400" />, category: 'easy' },
  // 增加难度（让任务更难完成）
  { value: 'TIME_INCREASE_PERCENT', label: '时间增加%', description: '增加任务所需时间', icon: <TrendingUp size={16} className="text-red-500 dark:text-red-400" />, category: 'hard' },
  { value: 'VALUE_INCREASE_PERCENT', label: '目标值增加%', description: '增加任务目标值', icon: <TrendingUp size={16} className="text-red-500 dark:text-red-400" />, category: 'hard' },
  { value: 'VALUE_PENALTY_FLAT', label: '目标值固定增加', description: '目标值增加固定数量', icon: <TrendingUp size={16} className="text-red-500 dark:text-red-400" />, category: 'hard' },
  // 奖励加成
  { value: 'POINTS_BONUS_PERCENT', label: '课程点加成%', description: '完成任务后额外获得课程点', icon: <Award size={16} className="text-amber-500 dark:text-amber-400" />, category: 'reward' },
];

const TARGET_SCOPES: { value: BuffTargetScope; label: string }[] = [
  { value: 'ALL', label: '所有任务' },
  { value: 'CATEGORY', label: '指定分类' },
  { value: 'COURSE', label: '指定课程' },
];

export const BuffEditorPage: React.FC<BuffEditorPageProps> = ({ onBack }) => {
  const confirm = useConfirm();

  const [courses, setCourses] = useState<CourseSummaryBackend[]>([]);
  const [categories, setCategories] = useState<CategoryBackend[]>([]);
  const [clubs, setClubs] = useState<ClubBackend[]>([]);
  const [buffs, setBuffs] = useState<BuffBackend[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingBuff, setEditingBuff] = useState<BuffBackend | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState<BuffFormData>(initialFormData);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [coursesData, categoriesData, clubsData, buffsData] = await Promise.all([
        adminApi.getCourses(true),
        adminApi.getCategories(true),
        adminApi.getClubs(true),
        adminApi.getBuffs(true),
      ]);
      setCourses(coursesData);
      setCategories(categoriesData);
      setClubs(clubsData);
      setBuffs(buffsData);
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

  const filteredBuffs = buffs.filter(b =>
    b.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreate = () => {
    setFormData(initialFormData);
    setIsCreating(true);
    setEditingBuff(null);
  };

  const handleEdit = (buff: BuffBackend) => {
    setFormData({
      clubId: buff.clubId,
      name: buff.name,
      description: buff.description || '',
      buffType: buff.buffType,
      targetScope: buff.targetScope,
      targetIds: buff.targetIds || [],
      value: buff.value,
      isActive: buff.isActive,
    });
    setEditingBuff(buff);
    setIsCreating(false);
  };

  const handleCancel = () => {
    setEditingBuff(null);
    setIsCreating(false);
    setFormData(initialFormData);
    setError(null);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      setError('请输入Buff名称');
      return;
    }

    // Validate targetIds when scope is CATEGORY or COURSE
    if (formData.targetScope === 'CATEGORY' && formData.targetIds.length === 0) {
      setError('请选择至少一个目标分类');
      return;
    }
    if (formData.targetScope === 'COURSE' && formData.targetIds.length === 0) {
      setError('请选择至少一个目标课程');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      if (isCreating) {
        const request: CreateBuffRequest = {
          clubId: formData.clubId || undefined,
          name: formData.name.trim(),
          description: formData.description.trim() || null,
          buffType: formData.buffType,
          targetScope: formData.targetScope,
          targetIds: formData.targetScope === 'ALL' ? [] : formData.targetIds,
          value: formData.value,
        };
        await adminApi.createBuff(request);
      } else if (editingBuff) {
        const request: UpdateBuffRequest = {
          name: formData.name.trim(),
          description: formData.description.trim() || null,
          buffType: formData.buffType,
          targetScope: formData.targetScope,
          targetIds: formData.targetScope === 'ALL' ? [] : formData.targetIds,
          value: formData.value,
          isActive: formData.isActive,
        };
        await adminApi.updateBuff(editingBuff.id, request);
      }

      await fetchData();
      handleCancel();
    } catch (err: any) {
      setError(err.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (buffId: number) => {
    if (!(await confirm({ title: '确认删除', description: '确定要删除这个Buff吗？', destructive: true }))) {
      return;
    }

    try {
      await adminApi.deleteBuff(buffId);
      await fetchData();
    } catch (err: any) {
      setError(err.message || '删除失败');
    }
  };

  const getBuffTypeLabel = (type: BuffTypeBackend) => {
    const found = BUFF_TYPES.find(t => t.value === type);
    return found?.label || type;
  };

  const getBuffTypeIcon = (type: BuffTypeBackend) => {
    const found = BUFF_TYPES.find(t => t.value === type);
    return found?.icon || <Sparkles size={16} />;
  };

  const getBuffTypeCategory = (type: BuffTypeBackend): 'easy' | 'hard' | 'reward' => {
    const found = BUFF_TYPES.find(t => t.value === type);
    return found?.category || 'easy';
  };

  const getBuffTypeCategoryColor = (type: BuffTypeBackend): { bg: string; text: string; border: string } => {
    const category = getBuffTypeCategory(type);
    switch (category) {
      case 'easy':
        return { bg: 'bg-green-50 dark:bg-green-950', text: 'text-green-600 dark:text-green-400', border: 'border-green-100 dark:border-green-900' };
      case 'hard':
        return { bg: 'bg-red-50 dark:bg-red-950', text: 'text-red-600 dark:text-red-400', border: 'border-red-100 dark:border-red-900' };
      case 'reward':
        return { bg: 'bg-amber-50 dark:bg-amber-950', text: 'text-amber-600 dark:text-amber-400', border: 'border-amber-100 dark:border-amber-900' };
    }
  };

  // Get target names helper
  const getTargetNames = (scope: BuffTargetScope, targetIds: number[]): string | null => {
    if (!targetIds || targetIds.length === 0) return null;
    if (scope === 'COURSE') {
      return targetIds.map(id => courses.find(c => c.id === id)?.name || `课程#${id}`).join('、');
    }
    if (scope === 'CATEGORY') {
      return targetIds.map(id => categories.find(c => c.id === id)?.name || `分类#${id}`).join('、');
    }
    return null;
  };

  // Form view
  if (isCreating || editingBuff) {
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
                {isCreating ? '创建Buff' : '编辑Buff'}
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
                Buff名称 <span className="text-red-500 dark:text-red-400">*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-primary focus:outline-none"
                placeholder="输入Buff名称"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
                Buff描述
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-primary focus:outline-none resize-none"
                rows={3}
                placeholder="输入Buff描述"
              />
            </div>

            {/* Club Selection */}
            {/* Club Selection (Optional) */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
                所属社团（可选）
              </label>
              <select
                value={formData.clubId || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, clubId: e.target.value ? parseInt(e.target.value) : null }))}
                className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-primary focus:outline-none"
              >
                <option value="">无（独立Buff）</option>
                {clubs.map(club => (
                  <option key={club.id} value={club.id}>{club.name}</option>
                ))}
              </select>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">如果Buff绑定到道具，可以不选择社团</p>
            </div>

            {/* Buff Type */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">
                增益类型
              </label>

              {/* 降低难度类 */}
              <div className="mb-3">
                <p className="text-xs text-green-600 dark:text-green-400 font-medium mb-2 flex items-center gap-1">
                  <TrendingDown size={12} /> 降低难度（让任务更容易完成）
                </p>
                <div className="space-y-2">
                  {BUFF_TYPES.filter(t => t.category === 'easy').map(type => (
                    <button
                      key={type.value}
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, buffType: type.value }))}
                      className={`w-full p-3 rounded-xl border-2 flex items-center gap-3 transition-all ${
                        formData.buffType === type.value
                          ? 'border-green-500 bg-green-50 dark:bg-green-950'
                          : 'border-slate-200 dark:border-slate-700 hover:border-green-300'
                      }`}
                    >
                      {type.icon}
                      <div className="flex-1 text-left">
                        <span className={`text-sm font-medium ${
                          formData.buffType === type.value ? 'text-green-600 dark:text-green-400' : 'text-slate-600 dark:text-slate-300'
                        }`}>
                          {type.label}
                        </span>
                        <p className="text-xs text-slate-400 dark:text-slate-500">{type.description}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* 增加难度类 */}
              <div className="mb-3">
                <p className="text-xs text-red-600 dark:text-red-400 font-medium mb-2 flex items-center gap-1">
                  <TrendingUp size={12} /> 增加难度（让任务更难完成）
                </p>
                <div className="space-y-2">
                  {BUFF_TYPES.filter(t => t.category === 'hard').map(type => (
                    <button
                      key={type.value}
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, buffType: type.value }))}
                      className={`w-full p-3 rounded-xl border-2 flex items-center gap-3 transition-all ${
                        formData.buffType === type.value
                          ? 'border-red-500 bg-red-50 dark:bg-red-950'
                          : 'border-slate-200 dark:border-slate-700 hover:border-red-300'
                      }`}
                    >
                      {type.icon}
                      <div className="flex-1 text-left">
                        <span className={`text-sm font-medium ${
                          formData.buffType === type.value ? 'text-red-600 dark:text-red-400' : 'text-slate-600 dark:text-slate-300'
                        }`}>
                          {type.label}
                        </span>
                        <p className="text-xs text-slate-400 dark:text-slate-500">{type.description}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* 奖励加成类 */}
              <div>
                <p className="text-xs text-amber-600 dark:text-amber-400 font-medium mb-2 flex items-center gap-1">
                  <Award size={12} /> 奖励加成（增加完成后的收益）
                </p>
                <div className="space-y-2">
                  {BUFF_TYPES.filter(t => t.category === 'reward').map(type => (
                    <button
                      key={type.value}
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, buffType: type.value }))}
                      className={`w-full p-3 rounded-xl border-2 flex items-center gap-3 transition-all ${
                        formData.buffType === type.value
                          ? 'border-amber-500 bg-amber-50 dark:bg-amber-950'
                          : 'border-slate-200 dark:border-slate-700 hover:border-amber-300'
                      }`}
                    >
                      {type.icon}
                      <div className="flex-1 text-left">
                        <span className={`text-sm font-medium ${
                          formData.buffType === type.value ? 'text-amber-600 dark:text-amber-400' : 'text-slate-600 dark:text-slate-300'
                        }`}>
                          {type.label}
                        </span>
                        <p className="text-xs text-slate-400 dark:text-slate-500">{type.description}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Value */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
                增益值
              </label>
              <input
                type="number"
                value={formData.value}
                onChange={(e) => setFormData(prev => ({ ...prev, value: parseFloat(e.target.value) || 0 }))}
                className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-primary focus:outline-none"
                min={0}
                step={0.1}
              />
              <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
                {formData.buffType.includes('PERCENT') ? '百分比值 (如10表示10%)' : '固定数值'}
              </p>
            </div>

            {/* Target Scope */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">
                作用范围
              </label>
              <div className="flex flex-wrap gap-2">
                {TARGET_SCOPES.map(scope => (
                  <button
                    key={scope.value}
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, targetScope: scope.value, targetIds: [] }))}
                    className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                      formData.targetScope === scope.value
                        ? 'bg-primary text-white'
                        : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-primary'
                    }`}
                  >
                    {scope.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Target Categories (if scope is CATEGORY) */}
            {formData.targetScope === 'CATEGORY' && (
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
                  目标分类（可多选） <span className="text-red-500 dark:text-red-400">*</span>
                </label>
                <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 max-h-48 overflow-y-auto space-y-1">
                  {categories.length === 0 ? (
                    <p className="text-[10px] text-amber-500 dark:text-amber-400">暂无分类，请先在分类管理中创建</p>
                  ) : categories.map(category => (
                    <label key={category.id} className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.targetIds.includes(category.id)}
                        onChange={(e) => {
                          setFormData(prev => ({
                            ...prev,
                            targetIds: e.target.checked
                              ? [...prev.targetIds, category.id]
                              : prev.targetIds.filter(id => id !== category.id)
                          }));
                        }}
                        className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-primary focus:ring-primary/30"
                      />
                      <span className="text-sm text-slate-700 dark:text-slate-200">{category.name}</span>
                    </label>
                  ))}
                </div>
                {formData.targetIds.length > 0 && (
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">已选择 {formData.targetIds.length} 个分类</p>
                )}
              </div>
            )}

            {/* Target Courses (if scope is COURSE) */}
            {formData.targetScope === 'COURSE' && (
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
                  目标课程（可多选） <span className="text-red-500 dark:text-red-400">*</span>
                </label>
                <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 max-h-48 overflow-y-auto space-y-1">
                  {courses.length === 0 ? (
                    <p className="text-[10px] text-amber-500 dark:text-amber-400">暂无课程</p>
                  ) : courses.map(course => (
                    <label key={course.id} className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.targetIds.includes(course.id)}
                        onChange={(e) => {
                          setFormData(prev => ({
                            ...prev,
                            targetIds: e.target.checked
                              ? [...prev.targetIds, course.id]
                              : prev.targetIds.filter(id => id !== course.id)
                          }));
                        }}
                        className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-primary focus:ring-primary/30"
                      />
                      <span className="text-sm text-slate-700 dark:text-slate-200">{course.name}</span>
                    </label>
                  ))}
                </div>
                {formData.targetIds.length > 0 && (
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">已选择 {formData.targetIds.length} 个课程</p>
                )}
              </div>
            )}

            {/* Active Status */}
            <div className="flex items-center justify-between bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
              <div>
                <p className="font-medium text-slate-700 dark:text-slate-200">启用状态</p>
                <p className="text-xs text-slate-400 dark:text-slate-500">关闭后Buff不会生效</p>
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
            <h1 className="text-lg font-bold text-slate-800 dark:text-slate-100">Buff管理</h1>
            <p className="text-xs text-slate-400 dark:text-slate-500">{buffs.length} 个Buff</p>
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
            placeholder="搜索Buff..."
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={24} className="animate-spin text-primary" />
          </div>
        ) : filteredBuffs.length === 0 ? (
          <div className="text-center py-12">
            <Sparkles size={48} className="mx-auto text-slate-300 mb-4" />
            <p className="text-slate-500 dark:text-slate-400">暂无Buff</p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">点击新建按钮创建Buff</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredBuffs.map((buff) => {
              const categoryColor = getBuffTypeCategoryColor(buff.buffType);
              return (
                <div
                  key={buff.id}
                  className={`bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border ${categoryColor.border}`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-xl ${categoryColor.bg} flex items-center justify-center shrink-0`}>
                      {getBuffTypeIcon(buff.buffType)}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-slate-800 dark:text-slate-100 truncate">{buff.name}</h3>
                        {!buff.isActive && (
                          <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 text-[10px] rounded-full">
                            已禁用
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                        <span className={categoryColor.text}>{getBuffTypeLabel(buff.buffType)}</span>
                        {' · '}{buff.buffType.includes('INCREASE') || buff.buffType === 'VALUE_PENALTY_FLAT' ? '+' : ''}{buff.value}{buff.buffType.includes('PERCENT') ? '%' : ''}
                        {buff.targetScope !== 'ALL' && ` · ${getTargetNames(buff.targetScope, buff.targetIds) || '未指定'}`}
                        {buff.targetScope === 'ALL' && ' · 所有任务'}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleEdit(buff)}
                        className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                      >
                        <Edit2 size={16} className="text-slate-600 dark:text-slate-300" />
                      </button>
                      <button
                        onClick={() => handleDelete(buff.id)}
                        className="w-8 h-8 rounded-lg bg-red-50 dark:bg-red-950 flex items-center justify-center hover:bg-red-100 dark:hover:bg-red-900 transition-colors"
                      >
                        <Trash2 size={16} className="text-red-500 dark:text-red-400" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default BuffEditorPage;
