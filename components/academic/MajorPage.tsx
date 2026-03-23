import React, { useState } from 'react';
import { toast } from 'sonner';
import {
  ArrowLeft,
  GraduationCap,
  BookOpen,
  ChevronRight,
  CheckCircle,
  Lock,
  Loader2,
  AlertCircle,
  Clock,
  Award,
  XCircle,
} from 'lucide-react';
import {
  useMajorsWithStatus,
  useMyMajorProgress,
  useMajorHistory,
  useEnrollMajor,
  useDropMajor,
} from '../../hooks';
import type {
  MajorSummary,
  UserMajorProgress,
  MajorCourseProgress,
  UserMajor,
} from '../../types';

interface MajorPageProps {
  onBack: () => void;
}

export const MajorPage: React.FC<MajorPageProps> = ({ onBack }) => {
  const [tab, setTab] = useState<'current' | 'catalog' | 'history'>('current');
  const [selectedMajor, setSelectedMajor] = useState<MajorSummary | null>(null);
  const [showDropConfirm, setShowDropConfirm] = useState(false);

  const majorsQuery = useMajorsWithStatus();
  const progressQuery = useMyMajorProgress();
  const historyQuery = useMajorHistory();
  const enrollMutation = useEnrollMajor();
  const dropMutation = useDropMajor();

  const allMajors = majorsQuery.data ?? [];
  const progress = progressQuery.data as UserMajorProgress | null;
  const hasActiveMajor = progress && 'userMajor' in progress;
  const history = (historyQuery.data ?? []) as UserMajor[];

  const loading = majorsQuery.isLoading || progressQuery.isLoading;
  const error = majorsQuery.error?.message || progressQuery.error?.message || null;

  const handleEnroll = async (majorId: number) => {
    try {
      await enrollMutation.mutateAsync({ majorId });
      setSelectedMajor(null);
    } catch (err) {
      console.error('Failed to enroll:', err);
      const msg = err instanceof Error ? err.message : '选择专业失败';
      toast.error(msg);
    }
  };

  const handleDrop = async () => {
    try {
      await dropMutation.mutateAsync();
      setShowDropConfirm(false);
    } catch (err) {
      console.error('Failed to drop major:', err);
      const msg = err instanceof Error ? err.message : '退出专业失败';
      toast.error(msg);
    }
  };

  const getCourseStatusLabel = (course: MajorCourseProgress) => {
    if (course.examPassed) return { text: '已通过', color: 'bg-green-100 text-green-600 dark:text-green-400' };
    if (course.enrollmentStatus === 'ACTIVE') return { text: '进行中', color: 'bg-secondary/10 text-secondary' };
    if (!course.prerequisitesMet) return { text: '待解锁', color: 'bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500' };
    return { text: '待选课', color: 'bg-amber-100 text-amber-600 dark:text-amber-400' };
  };

  if (loading) {
    return (
      <div className="h-full bg-slate-50 dark:bg-slate-900 flex flex-col items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">加载中...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full bg-slate-50 dark:bg-slate-900 flex flex-col items-center justify-center p-6">
        <AlertCircle className="w-12 h-12 text-red-400 mb-4" />
        <p className="text-sm text-red-500 dark:text-red-400 text-center">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-4 px-4 py-2 bg-primary text-white rounded-lg text-sm"
        >
          重试
        </button>
      </div>
    );
  }

  return (
    <div className="h-full bg-slate-50 dark:bg-slate-900 flex flex-col relative overflow-y-auto no-scrollbar">
      <div className="p-6 pb-32 lg:pb-8 lg:max-w-[900px] lg:mx-auto lg:w-full">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <button onClick={onBack} className="p-2 -ml-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300">
            <ArrowLeft size={24} />
          </button>
          <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">专业中心</h1>
        </div>

        {/* Tabs */}
        <div className="flex p-1 bg-slate-100 dark:bg-slate-700 rounded-xl mb-6">
          <button
            onClick={() => setTab('current')}
            className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-all ${
              tab === 'current' ? 'bg-white dark:bg-slate-800 shadow text-slate-800 dark:text-slate-100' : 'text-slate-400 dark:text-slate-500'
            }`}
          >
            我的专业
          </button>
          <button
            onClick={() => setTab('catalog')}
            className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-all ${
              tab === 'catalog' ? 'bg-white dark:bg-slate-800 shadow text-slate-800 dark:text-slate-100' : 'text-slate-400 dark:text-slate-500'
            }`}
          >
            专业目录
          </button>
          <button
            onClick={() => setTab('history')}
            className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-all ${
              tab === 'history' ? 'bg-white dark:bg-slate-800 shadow text-slate-800 dark:text-slate-100' : 'text-slate-400 dark:text-slate-500'
            }`}
          >
            历史
          </button>
        </div>

        {/* CURRENT MAJOR TAB */}
        {tab === 'current' && (
          <div className="space-y-6">
            {hasActiveMajor ? (
              <>
                {/* Major Overview Card */}
                <div className="bg-gradient-to-br from-secondary/10 to-primary/10 p-5 rounded-2xl border border-secondary/20">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 rounded-xl bg-white dark:bg-slate-800 shadow-sm flex items-center justify-center">
                      {progress.majorIconUrl ? (
                        <img src={progress.majorIconUrl} className="w-full h-full object-cover rounded-xl" alt="" />
                      ) : (
                        <GraduationCap size={24} className="text-secondary" />
                      )}
                    </div>
                    <div>
                      <h2 className="font-bold text-slate-800 dark:text-slate-100">{progress.majorName}</h2>
                      {progress.majorDescription && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">{progress.majorDescription}</p>
                      )}
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="mb-3">
                    <div className="flex justify-between text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                      <span>完成进度</span>
                      <span>{progress.completedCount}/{progress.totalCount} 门课程</span>
                    </div>
                    <div className="w-full h-3 bg-white/50 dark:bg-slate-800/50 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-secondary rounded-full transition-all"
                        style={{ width: `${progress.totalCount > 0 ? Math.round((progress.completedCount / progress.totalCount) * 100) : 0}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      已获 <span className="font-bold text-secondary">{progress.totalCreditsEarned}</span> 学分
                    </div>
                    {progress.isGraduationReady && (
                      <div className="flex items-center gap-1 text-xs font-bold text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950 px-2 py-1 rounded-lg">
                        <Award size={12} /> 可以毕业！
                      </div>
                    )}
                  </div>
                </div>

                {/* Course Progress List */}
                <div>
                  <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-3 flex items-center gap-2">
                    <BookOpen size={16} className="text-secondary" /> 专业课程
                  </h3>
                  <div className="space-y-3">
                    {progress.courses
                      .sort((a, b) => a.orderIndex - b.orderIndex)
                      .map((course) => {
                        const status = getCourseStatusLabel(course);
                        const progressPercent = course.examPointsRequired > 0
                          ? Math.round((course.currentPoints / course.examPointsRequired) * 100)
                          : 0;

                        return (
                          <div key={course.courseId} className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-soft border border-slate-50 dark:border-slate-700">
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center flex-shrink-0">
                                  {course.courseIconUrl ? (
                                    <img src={course.courseIconUrl} className="w-full h-full object-cover rounded-lg" alt="" />
                                  ) : (
                                    <BookOpen size={16} className="text-slate-300" />
                                  )}
                                </div>
                                <div>
                                  <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100">{course.courseName}</h4>
                                  <span className="text-[10px] text-slate-400 dark:text-slate-500">{course.creditsOnPass} 学分</span>
                                </div>
                              </div>
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${status.color}`}>
                                {status.text}
                              </span>
                            </div>

                            {course.enrollmentStatus === 'ACTIVE' && !course.examPassed && (
                              <div className="mt-2">
                                <div className="flex justify-between text-[10px] text-slate-500 dark:text-slate-400 mb-1">
                                  <span>{course.currentPoints}/{course.examPointsRequired} 分</span>
                                  <span>{progressPercent}%</span>
                                </div>
                                <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-secondary rounded-full"
                                    style={{ width: `${Math.min(progressPercent, 100)}%` }}
                                  />
                                </div>
                              </div>
                            )}

                            {!course.prerequisitesMet && !course.examPassed && course.enrollmentStatus !== 'ACTIVE' && (
                              <div className="mt-2 flex items-center gap-1 text-[10px] text-slate-400 dark:text-slate-500">
                                <Lock size={10} /> 需完成前置课程
                              </div>
                            )}
                          </div>
                        );
                      })}
                  </div>
                </div>

                {/* Drop Major Button */}
                <div className="pt-2">
                  <button
                    onClick={() => setShowDropConfirm(true)}
                    className="w-full bg-red-50 dark:bg-red-950 text-red-500 dark:text-red-400 font-bold h-12 rounded-2xl hover:bg-red-100 dark:hover:bg-red-900 active:scale-95 transition-all text-sm"
                  >
                    退出专业
                  </button>
                </div>
              </>
            ) : (
              <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 text-center">
                <GraduationCap size={48} className="text-slate-200 mx-auto mb-4" />
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">还没有选择专业</p>
                <p className="text-xs text-slate-400 dark:text-slate-500 mb-4">选择专业后，系统会自动帮你规划课程学习路径</p>
                <button
                  onClick={() => setTab('catalog')}
                  className="text-sm text-primary font-bold"
                >
                  浏览专业目录 →
                </button>
              </div>
            )}
          </div>
        )}

        {/* CATALOG TAB */}
        {tab === 'catalog' && (
          <div className="space-y-4">
            {allMajors.length > 0 ? (
              allMajors.map((major) => (
                <div
                  key={major.id}
                  onClick={() => setSelectedMajor(major)}
                  className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-soft border border-slate-50 dark:border-slate-700 cursor-pointer active:scale-[0.98] transition-transform"
                >
                  <div className="flex gap-4">
                    <div className="w-14 h-14 rounded-xl bg-slate-100 dark:bg-slate-700 overflow-hidden flex-shrink-0 flex items-center justify-center">
                      {major.iconUrl ? (
                        <img src={major.iconUrl} className="w-full h-full object-cover" alt={major.name} />
                      ) : (
                        <GraduationCap size={24} className="text-slate-300" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-bold text-slate-800 dark:text-slate-100 text-sm truncate">{major.name}</h4>
                      </div>
                      {major.description && (
                        <p className="text-xs text-slate-400 dark:text-slate-500 mb-2 line-clamp-2">{major.description}</p>
                      )}
                      <div className="flex items-center gap-3 text-[10px]">
                        <span className="bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded text-slate-500 dark:text-slate-400 font-medium">
                          {major.courseCount} 门课程
                        </span>
                        <span className="bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded text-slate-500 dark:text-slate-400 font-medium">
                          {major.totalCredits} 学分
                        </span>
                        {major.canEnroll ? (
                          <span className="text-green-500 dark:text-green-400 font-bold">可选</span>
                        ) : (
                          <span className="text-slate-400 dark:text-slate-500 font-bold">不可选</span>
                        )}
                      </div>
                    </div>
                    <ChevronRight size={16} className="text-slate-300 self-center flex-shrink-0" />
                  </div>
                </div>
              ))
            ) : (
              <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 text-center">
                <p className="text-xs text-slate-400 dark:text-slate-500">暂无可选专业</p>
              </div>
            )}
          </div>
        )}

        {/* HISTORY TAB */}
        {tab === 'history' && (
          <div className="space-y-3">
            {history.length > 0 ? (
              history.map((record) => (
                <div key={record.id} className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-soft border border-slate-50 dark:border-slate-700">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-bold text-slate-800 dark:text-slate-100">专业 #{record.majorId}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                      record.status === 'GRADUATED' ? 'bg-green-100 text-green-600 dark:text-green-400' :
                      record.status === 'DROPPED' ? 'bg-red-100 text-red-500 dark:text-red-400' :
                      'bg-secondary/10 text-secondary'
                    }`}>
                      {record.status === 'GRADUATED' ? '已毕业' :
                       record.status === 'DROPPED' ? '已退出' : '进行中'}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-[10px] text-slate-400 dark:text-slate-500">
                    <span className="flex items-center gap-1">
                      <Clock size={10} /> 入学: {new Date(record.enrolledAt).toLocaleDateString()}
                    </span>
                    {record.graduatedAt && (
                      <span className="flex items-center gap-1">
                        <Award size={10} /> 毕业: {new Date(record.graduatedAt).toLocaleDateString()}
                      </span>
                    )}
                    {record.droppedAt && (
                      <span className="flex items-center gap-1">
                        <XCircle size={10} /> 退出: {new Date(record.droppedAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 text-center">
                <p className="text-xs text-slate-400 dark:text-slate-500">暂无专业历史记录</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Major Detail Modal */}
      {selectedMajor && (
        <div
          className="fixed inset-0 z-50 flex flex-col justify-end bg-black/20 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setSelectedMajor(null)}
        >
          <div
            className="bg-white dark:bg-slate-800 w-full max-h-[75%] rounded-t-[40px] shadow-2xl relative animate-in slide-in-from-bottom-full duration-300 flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-6 pb-4 border-b border-slate-100 dark:border-slate-700">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-xl bg-slate-100 dark:bg-slate-700 overflow-hidden flex-shrink-0 flex items-center justify-center">
                  {selectedMajor.iconUrl ? (
                    <img src={selectedMajor.iconUrl} className="w-full h-full object-cover" alt="" />
                  ) : (
                    <GraduationCap size={28} className="text-slate-300" />
                  )}
                </div>
                <div className="flex-1">
                  <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">{selectedMajor.name}</h2>
                  <div className="flex items-center gap-3 text-xs text-slate-400 dark:text-slate-500 mt-1">
                    <span>{selectedMajor.courseCount} 门课程</span>
                    <span>{selectedMajor.totalCredits} 学分</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6">
              {selectedMajor.description && (
                <div className="mb-4">
                  <h3 className="text-xs font-bold text-slate-800 dark:text-slate-100 mb-2">专业简介</h3>
                  <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed bg-slate-50 dark:bg-slate-900 p-4 rounded-2xl">
                    {selectedMajor.description}
                  </p>
                </div>
              )}

              {!selectedMajor.canEnroll && selectedMajor.enrollmentBlockReason && (
                <div className="mb-4 bg-amber-50 dark:bg-amber-950 p-4 rounded-2xl">
                  <div className="flex items-center gap-2 text-xs font-bold text-amber-600 dark:text-amber-400">
                    <AlertCircle size={14} />
                    <span>{selectedMajor.enrollmentBlockReason}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Action */}
            <div className="p-6 border-t border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800">
              {selectedMajor.canEnroll ? (
                <button
                  onClick={() => handleEnroll(selectedMajor.id)}
                  disabled={enrollMutation.isPending}
                  className="w-full bg-slate-900 text-white font-bold h-14 rounded-3xl shadow-xl active:scale-95 transition-transform disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {enrollMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <GraduationCap size={18} />}
                  {enrollMutation.isPending ? '报名中...' : '选择此专业'}
                </button>
              ) : (
                <button
                  disabled
                  className="w-full bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500 font-bold h-14 rounded-3xl flex items-center justify-center gap-2 cursor-not-allowed"
                >
                  {selectedMajor.enrollmentBlockReason || '暂不可选'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Drop Confirmation Dialog */}
      {showDropConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setShowDropConfirm(false)}
        >
          <div
            className="bg-white dark:bg-slate-800 w-[85%] max-w-sm rounded-3xl shadow-2xl p-6 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center mb-4">
              <div className="w-16 h-16 rounded-full bg-red-50 dark:bg-red-950 flex items-center justify-center mx-auto mb-3">
                <AlertCircle size={32} className="text-red-500 dark:text-red-400" />
              </div>
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-2">确认退出专业？</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                退出专业将<span className="text-red-500 dark:text-red-400 font-bold">清除所有专业课程的学分和进度</span>，
                并在<span className="text-red-500 dark:text-red-400 font-bold">7天内不能重新选择专业</span>。此操作不可撤销。
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDropConfirm(false)}
                className="flex-1 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold h-12 rounded-2xl active:scale-95 transition-transform"
              >
                取消
              </button>
              <button
                onClick={handleDrop}
                disabled={dropMutation.isPending}
                className="flex-1 bg-red-500 text-white font-bold h-12 rounded-2xl active:scale-95 transition-transform disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {dropMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {dropMutation.isPending ? '退出中...' : '确认退出'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
