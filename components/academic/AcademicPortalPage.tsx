import React, { useState } from 'react';
import { toast } from 'sonner';
import { CourseSummaryBackend, UserCourseProgress, EnrollmentStatus, TaskDefinitionDisplay, OptionalTaskGroupOverview } from '../../types';
import { examsApi } from '../../lib/api';
import {
  ArrowLeft,
  BookOpen,
  CalendarDays,
  MapPin,
  ChevronRight,
  CheckCircle,
  Lock,
  Clock,
  Award,
  Loader2,
  AlertCircle,
  GraduationCap,
  ListChecks,
  Dices,
  Target,
} from 'lucide-react';
import {
  useCoursesWithStatus,
  useMyCourseProgress,
  useEnrollCourse,
  useDropCourse,
  useStartExam,
  useCourseTasksOverview,
} from '../../hooks';
import { useUserSettings } from '../../hooks/useUser';

// Display model for unified course view
interface CourseDisplayModel {
  id: number;
  name: string;
  description: string | null;
  iconUrl: string | null;
  categoryName: string | null;
  schedules: number[]; // Days of week: 1-7
  isActive: boolean;
  prerequisites: { courseId: number; courseName: string; isPassed: boolean }[];
  canEnroll: boolean;
  missingPrerequisites: string[];
  // Enrollment info (if enrolled)
  enrollmentStatus: EnrollmentStatus | null;
  currentPoints: number;
  examPointsRequired: number;
  canTakeExam: boolean;
  examPassed: boolean;
  creditsEarned: number;
  creditsOnPass: number; // 通过考试后可获得的学分
  completedTaskCount: number;
  failedTaskCount: number;
  progressPercent: number;
}

interface AcademicPortalPageProps {
  onBack: () => void;
  onNavigateToMajor?: () => void;
}

export const AcademicPortalPage: React.FC<AcademicPortalPageProps> = ({ onBack, onNavigateToMajor }) => {
  const [courseTab, setCourseTab] = useState<'catalog' | 'my-schedule'>('my-schedule');
  const [selectedCourse, setSelectedCourse] = useState<CourseDisplayModel | null>(null);
  const [startingExam, setStartingExam] = useState(false);
  const [viewingTasksCourseId, setViewingTasksCourseId] = useState<number | null>(null);

  // React Query hooks
  const coursesQuery = useCoursesWithStatus();
  const progressQuery = useMyCourseProgress();
  const enrollMutation = useEnrollCourse();
  const dropMutation = useDropCourse();
  const startExamMutation = useStartExam();
  const userSettingsQuery = useUserSettings();
  const dayStartOffsetHours = userSettingsQuery.data?.dayStartOffsetHours ?? 0;

  const allCourses = coursesQuery.data ?? [];
  const myProgress = progressQuery.data ?? [];
  const loading = coursesQuery.isLoading || progressQuery.isLoading;
  const error = coursesQuery.error?.message || progressQuery.error?.message || null;

  const getDayName = (day: number) => ['周一', '周二', '周三', '周四', '周五', '周六', '周日'][day - 1];
  // Apply dayStartOffsetHours to determine effective "today"
  const effectiveNow = new Date(Date.now() - dayStartOffsetHours * 60 * 60 * 1000);
  const todayDayNum = effectiveNow.getDay() || 7;

  // Build display models from progress data (my courses)
  const myCourses: CourseDisplayModel[] = myProgress
    .filter(p => p.status === 'ACTIVE' || p.status === 'COMPLETED')
    .map(p => ({
      id: p.course.id,
      name: p.course.name,
      description: p.course.description,
      iconUrl: p.course.iconUrl,
      categoryName: p.course.categoryName,
      schedules: p.course.schedules,
      isActive: p.course.isActive,
      prerequisites: p.course.prerequisites,
      canEnroll: false, // Already enrolled
      missingPrerequisites: [],
      enrollmentStatus: p.status,
      currentPoints: p.currentPoints,
      examPointsRequired: p.examPointsRequired,
      canTakeExam: p.canTakeExam,
      examPassed: p.examPassed,
      creditsEarned: p.creditsEarned,
      creditsOnPass: p.course.creditsOnPass || 0,
      completedTaskCount: p.completedTaskCount,
      failedTaskCount: p.failedTaskCount,
      progressPercent: p.examPointsRequired > 0 ? Math.round((p.currentPoints / p.examPointsRequired) * 100) : 0,
    }));

  // Today's active courses
  const todayCourses = myCourses.filter(
    c => c.schedules.includes(todayDayNum) && c.enrollmentStatus === 'ACTIVE'
  );

  // Catalog courses (all available courses with enrollment status)
  const catalogCourses: CourseDisplayModel[] = allCourses.map(course => {
    const enrollment = myProgress.find(p => p.course.id === course.id);
    // 允许重新报名已退出的课程
    const isDropped = enrollment?.status === 'DROPPED';
    const canEnrollCourse = course.canEnroll && (!enrollment || isDropped);
    return {
      id: course.id,
      name: course.name,
      description: course.description,
      iconUrl: course.iconUrl,
      categoryName: course.categoryName,
      schedules: course.schedules,
      isActive: course.isActive,
      prerequisites: course.prerequisites,
      canEnroll: canEnrollCourse,
      missingPrerequisites: course.missingPrerequisites,
      // 对于已退出的课程，显示为 null 以便显示为可选修
      enrollmentStatus: isDropped ? null : (enrollment?.status || null),
      currentPoints: enrollment?.currentPoints || 0,
      examPointsRequired: enrollment?.examPointsRequired || 0,
      canTakeExam: enrollment?.canTakeExam || false,
      examPassed: enrollment?.examPassed || false,
      creditsEarned: enrollment?.creditsEarned || 0,
      creditsOnPass: course.creditsOnPass || 0,
      completedTaskCount: enrollment?.completedTaskCount || 0,
      failedTaskCount: enrollment?.failedTaskCount || 0,
      progressPercent: enrollment && enrollment.examPointsRequired > 0
        ? Math.round((enrollment.currentPoints / enrollment.examPointsRequired) * 100)
        : 0,
    };
  });

  const handleEnroll = async (courseId: number) => {
    try {
      await enrollMutation.mutateAsync(courseId);
      setSelectedCourse(null);
    } catch (err) {
      console.error('Failed to enroll:', err);
      toast.error('报名失败，请重试');
    }
  };

  const handleDrop = async (courseId: number) => {
    try {
      await dropMutation.mutateAsync(courseId);
      setSelectedCourse(null);
    } catch (err) {
      console.error('Failed to drop course:', err);
      toast.error('退课失败，请重试');
    }
  };

  const handleStartExam = async (courseId: number) => {
    try {
      setStartingExam(true);
      // 先检查资格
      const eligibility = await examsApi.checkEligibility(courseId);
      if (!eligibility.eligible) {
        toast.warning(eligibility.reason || '不符合考试条件');
        return;
      }
      // 开始考试
      const tasks = await startExamMutation.mutateAsync(courseId);
      if (tasks && tasks.length > 0) {
        toast.success(`考试已开始！已生成 ${tasks.length} 个考试任务，请在任务列表中查看并完成。`);
        setSelectedCourse(null);
      } else {
        toast.success('考试任务生成成功，请前往任务列表查看');
      }
    } catch (err: unknown) {
      console.error('Failed to start exam:', err);
      const errorMessage = err instanceof Error ? err.message : '申请考试失败，请重试';
      toast.error(errorMessage);
    } finally {
      setStartingExam(false);
    }
  };

  // Get course status for display
  const getCourseStatus = (course: CourseDisplayModel): 'ENROLLED' | 'COMPLETED' | 'AVAILABLE' | 'LOCKED' => {
    if (course.enrollmentStatus === 'ACTIVE') return 'ENROLLED';
    if (course.enrollmentStatus === 'COMPLETED' || course.examPassed) return 'COMPLETED';
    if (course.missingPrerequisites.length > 0) return 'LOCKED';
    return 'AVAILABLE';
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
      <div className="p-6 pb-32 lg:pb-8 lg:max-w-[1100px] lg:mx-auto lg:w-full">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <button onClick={onBack} className="p-2 -ml-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300">
            <ArrowLeft size={24} />
          </button>
          <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100 lg:text-2xl">学术中心</h1>
        </div>

        {/* Tabs */}
        <div className="flex p-1 bg-slate-100 dark:bg-slate-700 rounded-xl mb-6 lg:max-w-xs">
          <button
            onClick={() => setCourseTab('my-schedule')}
            className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-all ${
              courseTab === 'my-schedule' ? 'bg-white dark:bg-slate-800 shadow text-slate-800 dark:text-slate-100' : 'text-slate-400 dark:text-slate-500'
            }`}
          >
            我的课表
          </button>
          <button
            onClick={() => setCourseTab('catalog')}
            className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-all ${
              courseTab === 'catalog' ? 'bg-white dark:bg-slate-800 shadow text-slate-800 dark:text-slate-100' : 'text-slate-400 dark:text-slate-500'
            }`}
          >
            课程目录
          </button>
        </div>

        {/* MY SCHEDULE TAB */}
        {courseTab === 'my-schedule' && (
          <div className="space-y-6">
            {/* Desktop: 2-column layout for Today + My Courses */}
            <div className="lg:grid lg:grid-cols-5 lg:gap-6 space-y-6 lg:space-y-0">
              {/* Today's Classes */}
              <div className="lg:col-span-2">
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-3 flex items-center gap-2">
                  <CalendarDays size={16} className="text-primary" /> 今日课程
                </h3>
                {todayCourses.length > 0 ? (
                  <div className="space-y-3">
                    {todayCourses.map((course) => (
                      <div
                        key={course.id}
                        onClick={() => setSelectedCourse(course)}
                        className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-soft border border-slate-50 dark:border-slate-700 flex justify-between items-center relative overflow-hidden cursor-pointer active:scale-[0.98] transition-transform lg:hover:shadow-md lg:hover:border-primary/20"
                      >
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary"></div>
                        <div className="pl-2">
                          <div className="text-xs font-bold text-primary mb-1">
                            {course.schedules.map(d => getDayName(d)).join('、')}
                          </div>
                          <h4 className="font-bold text-slate-800 dark:text-slate-100 text-sm">{course.name}</h4>
                          {course.categoryName && (
                            <div className="flex items-center gap-1 text-[10px] text-slate-400 dark:text-slate-500 mt-1">
                              <BookOpen size={10} /> {course.categoryName}
                            </div>
                          )}
                        </div>
                        <ChevronRight size={16} className="text-slate-300" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 text-center">
                    <p className="text-xs text-slate-400 dark:text-slate-500">今天没有课程安排</p>
                  </div>
                )}

                {/* Major Center Entry — desktop only (mobile version is below the grid) */}
                {onNavigateToMajor && (
                  <div
                    onClick={onNavigateToMajor}
                    className="hidden lg:flex mt-4 bg-linear-to-r from-secondary/5 to-primary/5 p-4 rounded-2xl border border-secondary/10 cursor-pointer active:scale-[0.98] transition-transform items-center justify-between lg:hover:shadow-md"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-white dark:bg-slate-800 shadow-sm flex items-center justify-center">
                        <GraduationCap size={20} className="text-secondary" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100">专业中心</h4>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500">选择专业，规划学习路径</p>
                      </div>
                    </div>
                    <ChevronRight size={16} className="text-slate-300" />
                  </div>
                )}
              </div>

              {/* Active Courses */}
              <div className="lg:col-span-3">
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-3 flex items-center gap-2">
                  <BookOpen size={16} className="text-secondary" /> 我的课程
                </h3>
                {myCourses.length > 0 ? (
                  <div className="space-y-4">
                    {myCourses.map((course) => {
                      const status = getCourseStatus(course);
                      return (
                        <div
                          key={course.id}
                          onClick={() => setSelectedCourse(course)}
                          className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-soft border border-slate-50 dark:border-slate-700 cursor-pointer active:scale-[0.98] transition-transform lg:hover:shadow-md lg:hover:border-slate-200 dark:border-slate-700"
                        >
                          <div className="flex justify-between items-start mb-3">
                            <div
                              className={`px-2 py-1 rounded-md text-[10px] font-bold ${
                                status === 'COMPLETED' ? 'bg-green-100 text-green-600 dark:text-green-400' : 'bg-secondary/10 text-secondary'
                              }`}
                            >
                              {status === 'ENROLLED' ? '进行中' : status === 'COMPLETED' ? '已完成' : status}
                            </div>
                            <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500">{course.creditsEarned} 学分</div>
                          </div>
                          <h4 className="font-bold text-slate-800 dark:text-slate-100 text-sm mb-1">{course.name}</h4>
                          <p className="text-xs text-slate-400 dark:text-slate-500 mb-4">{course.categoryName || '通用课程'}</p>

                          {status === 'ENROLLED' && (
                            <div>
                              <div className="flex justify-between text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1">
                                <span>学习进度</span>
                                <span>{course.currentPoints}/{course.examPointsRequired} 分 ({course.progressPercent}%)</span>
                              </div>
                              <div className="w-full h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                <div className="h-full bg-secondary rounded-full" style={{ width: `${Math.min(course.progressPercent, 100)}%` }}></div>
                              </div>
                            </div>
                          )}
                          {status === 'COMPLETED' && (
                            <div className="flex items-center gap-1 text-xs font-bold text-green-500 dark:text-green-400">
                              <CheckCircle size={14} /> 课程已完成
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 text-center">
                    <p className="text-xs text-slate-400 dark:text-slate-500">还没有选修任何课程</p>
                    <button
                      onClick={() => setCourseTab('catalog')}
                      className="mt-3 text-xs text-primary font-bold"
                    >
                      去选课 →
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Major Center Entry — mobile only (desktop version is in the left column) */}
            {onNavigateToMajor && (
              <div
                onClick={onNavigateToMajor}
                className="lg:hidden bg-linear-to-r from-secondary/5 to-primary/5 p-4 rounded-2xl border border-secondary/10 cursor-pointer active:scale-[0.98] transition-transform flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white dark:bg-slate-800 shadow-sm flex items-center justify-center">
                    <GraduationCap size={20} className="text-secondary" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100">专业中心</h4>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500">选择专业，规划学习路径</p>
                  </div>
                </div>
                <ChevronRight size={16} className="text-slate-300" />
              </div>
            )}
          </div>
        )}

        {/* CATALOG TAB */}
        {courseTab === 'catalog' && (
          <div className="space-y-4 lg:grid lg:grid-cols-2 lg:gap-4 lg:space-y-0">
            {catalogCourses.length > 0 ? (
              catalogCourses.map((course) => {
                const status = getCourseStatus(course);
                const isLocked = status === 'LOCKED';
                return (
                  <div
                    key={course.id}
                    onClick={() => setSelectedCourse(course)}
                    className={`bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-soft border cursor-pointer active:scale-[0.98] transition-transform relative overflow-hidden lg:hover:shadow-md ${
                      isLocked ? 'border-red-100 dark:border-red-900 opacity-80' : 'border-slate-50 dark:border-slate-700 lg:hover:border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    {isLocked && (
                      <div className="absolute top-0 right-0 bg-red-50 dark:bg-red-950 p-2 rounded-bl-2xl">
                        <Lock size={16} className="text-red-400" />
                      </div>
                    )}

                    <div className="flex gap-4">
                      <div className="w-16 h-16 rounded-xl bg-slate-100 dark:bg-slate-700 overflow-hidden flex-shrink-0 flex items-center justify-center">
                        {course.iconUrl ? (
                          <img src={course.iconUrl} className="w-full h-full object-cover" alt={course.name} />
                        ) : (
                          <BookOpen size={24} className="text-slate-300" />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-bold text-slate-800 dark:text-slate-100 text-sm line-clamp-1">{course.name}</h4>
                          {status === 'ENROLLED' && (
                            <span className="text-[10px] bg-secondary/10 text-secondary px-1.5 py-0.5 rounded font-bold">进行中</span>
                          )}
                          {status === 'COMPLETED' && (
                            <span className="text-[10px] bg-green-100 text-green-600 dark:text-green-400 px-1.5 py-0.5 rounded font-bold">已完成</span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 dark:text-slate-500 mb-2">{course.categoryName || '通用课程'}</p>
                        <div className="flex items-center gap-3">
                          <span className="text-[10px] bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded text-slate-500 dark:text-slate-400 font-medium">
                            {course.schedules.length > 0
                              ? course.schedules.map(d => getDayName(d)).join('、')
                              : '自由安排'}
                          </span>
                          {status === 'COMPLETED' && course.creditsEarned > 0 ? (
                            <span className="text-[10px] font-bold text-green-500 dark:text-green-400">
                              已获 {course.creditsEarned} 学分
                            </span>
                          ) : course.creditsOnPass > 0 && (
                            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500">
                              可获 {course.creditsOnPass} 学分
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 text-center">
                <p className="text-xs text-slate-400 dark:text-slate-500">暂无可选课程</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Course Detail Modal */}
      {selectedCourse && (() => {
        const status = getCourseStatus(selectedCourse);
        return (
          <div
            className="fixed inset-0 z-50 flex flex-col justify-end lg:items-center lg:justify-center bg-black/20 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={() => setSelectedCourse(null)}
          >
            <div
              className="bg-white dark:bg-slate-800 w-full h-[85%] rounded-t-[40px] shadow-2xl relative animate-in slide-in-from-bottom-full duration-300 flex flex-col overflow-hidden lg:max-w-2xl lg:h-auto lg:max-h-[85vh] lg:rounded-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Cover Image Header */}
              <div className="h-40 bg-slate-900 relative shrink-0 lg:rounded-t-2xl overflow-hidden">
                {selectedCourse.iconUrl ? (
                  <img src={selectedCourse.iconUrl} className="w-full h-full object-cover opacity-60" alt="cover" />
                ) : (
                  <div className="w-full h-full bg-linear-to-br from-primary/30 to-secondary/30" />
                )}
                <div className="absolute top-4 right-4">
                  <button
                    onClick={() => setSelectedCourse(null)}
                    className="w-8 h-8 rounded-full bg-black/30 backdrop-blur-md text-white flex items-center justify-center"
                  >
                    <ArrowLeft size={16} className="-rotate-90" />
                  </button>
                </div>
                <div className="absolute bottom-4 left-6">
                  <div
                    className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold text-white mb-2 ${
                      status === 'LOCKED' ? 'bg-red-500' :
                      status === 'COMPLETED' ? 'bg-green-500' :
                      status === 'ENROLLED' ? 'bg-secondary' : 'bg-primary'
                    }`}
                  >
                    {status === 'ENROLLED' ? '学习中' :
                     status === 'COMPLETED' ? '已完成' :
                     status === 'LOCKED' ? '未解锁' : '可选修'}
                  </div>
                  <h2 className="text-2xl font-bold text-white leading-none">{selectedCourse.name}</h2>
                </div>
              </div>

              {/* Info Body */}
              <div className="flex-1 overflow-y-auto p-6">
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="bg-slate-50 dark:bg-slate-900 p-3 rounded-2xl flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-white dark:bg-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-400 shadow-sm">
                      <BookOpen size={14} />
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-400 dark:text-slate-500">分类</div>
                      <div className="text-xs font-bold text-slate-800 dark:text-slate-100">{selectedCourse.categoryName || '通用'}</div>
                    </div>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-900 p-3 rounded-2xl flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-white dark:bg-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-400 shadow-sm">
                      <Award size={14} />
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-400 dark:text-slate-500">
                        {status === 'COMPLETED' ? '已获学分' : '通过可获'}
                      </div>
                      <div className="text-xs font-bold text-slate-800 dark:text-slate-100">
                        {status === 'COMPLETED' ? selectedCourse.creditsEarned : selectedCourse.creditsOnPass} 学分
                      </div>
                    </div>
                  </div>
                </div>

                {/* Progress (if enrolled) */}
                {status === 'ENROLLED' && (
                  <div className="mb-6 bg-secondary/5 p-4 rounded-2xl">
                    <h3 className="text-xs font-bold text-slate-800 dark:text-slate-100 mb-3">学习进度</h3>
                    <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 mb-2">
                      <span>当前积分：{selectedCourse.currentPoints}/{selectedCourse.examPointsRequired}</span>
                      <span>{selectedCourse.progressPercent}%</span>
                    </div>
                    <div className="w-full h-3 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-secondary rounded-full transition-all"
                        style={{ width: `${Math.min(selectedCourse.progressPercent, 100)}%` }}
                      />
                    </div>
                    <div className="flex justify-between mt-3 text-[10px] text-slate-400 dark:text-slate-500">
                      <span>已完成任务：{selectedCourse.completedTaskCount}</span>
                      <span>失败任务：{selectedCourse.failedTaskCount}</span>
                    </div>
                    {selectedCourse.canTakeExam && (
                      <div className="mt-3 text-xs text-green-600 dark:text-green-400 font-bold flex items-center gap-1">
                        <CheckCircle size={12} /> 可以参加考试
                      </div>
                    )}
                  </div>
                )}

                <div className="mb-6">
                  <h3 className="text-xs font-bold text-slate-800 dark:text-slate-100 mb-2">上课时间</h3>
                  <div className="flex items-center gap-4 text-sm text-slate-600 dark:text-slate-300 font-medium flex-wrap">
                    <div className="flex items-center gap-2">
                      <CalendarDays size={16} className="text-primary" />
                      {selectedCourse.schedules.length > 0
                        ? selectedCourse.schedules.map(d => getDayName(d)).join('、')
                        : '自由安排'}
                    </div>
                  </div>
                </div>

                {selectedCourse.description && (
                  <div className="mb-6">
                    <h3 className="text-xs font-bold text-slate-800 dark:text-slate-100 mb-2">课程简介</h3>
                    <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed bg-slate-50 dark:bg-slate-900 p-4 rounded-2xl">{selectedCourse.description}</p>
                  </div>
                )}

                {selectedCourse.prerequisites.length > 0 && (
                  <div className="mb-6">
                    <h3 className="text-xs font-bold text-slate-800 dark:text-slate-100 mb-2">前置课程</h3>
                    <div className="flex flex-wrap gap-2">
                      {selectedCourse.prerequisites.map((pre) => (
                        <span
                          key={pre.courseId}
                          className={`text-xs font-bold px-3 py-1.5 rounded-lg border flex items-center gap-1 ${
                            pre.isPassed
                              ? 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950 border-green-100 dark:border-green-900'
                              : 'text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-950 border-red-100 dark:border-red-900'
                          }`}
                        >
                          {pre.isPassed ? <CheckCircle size={10} /> : <Lock size={10} />} {pre.courseName}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {selectedCourse.missingPrerequisites.length > 0 && (
                  <div className="mb-6 bg-red-50 dark:bg-red-950 p-4 rounded-2xl">
                    <h3 className="text-xs font-bold text-red-600 dark:text-red-400 mb-2">缺少前置课程</h3>
                    <ul className="text-xs text-red-500 dark:text-red-400 space-y-1">
                      {selectedCourse.missingPrerequisites.map((name, idx) => (
                        <li key={idx} className="flex items-center gap-1">
                          <Lock size={10} /> {name}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="p-6 border-t border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800">
                {status === 'AVAILABLE' && selectedCourse.canEnroll && (
                  <div className="flex gap-3">
                    <button
                      onClick={() => setViewingTasksCourseId(selectedCourse.id)}
                      className="flex-1 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold h-14 rounded-3xl hover:bg-slate-200 dark:hover:bg-slate-600 active:scale-95 transition-colors flex items-center justify-center gap-2"
                    >
                      <ListChecks size={16} /> 查看任务
                    </button>
                    <button
                      onClick={() => handleEnroll(selectedCourse.id)}
                      disabled={enrollMutation.isPending}
                      className="flex-2 bg-slate-900 text-white font-bold h-14 rounded-3xl shadow-xl active:scale-95 transition-transform disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {enrollMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
                      {enrollMutation.isPending ? '报名中...' : '立即报名'}
                    </button>
                  </div>
                )}
                {status === 'ENROLLED' && (
                  <div className="flex flex-col gap-3">
                    {selectedCourse.canTakeExam && (
                      <button
                        onClick={() => handleStartExam(selectedCourse.id)}
                        disabled={startingExam}
                        className="w-full bg-green-500 text-white font-bold h-14 rounded-3xl shadow-xl active:scale-95 transition-transform disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {startingExam ? <Loader2 className="w-5 h-5 animate-spin" /> : <Award size={18} />}
                        {startingExam ? '申请中...' : '申请参加考试'}
                      </button>
                    )}
                    <div className="flex gap-3">
                      <button
                        onClick={() => handleDrop(selectedCourse.id)}
                        disabled={dropMutation.isPending}
                        className="flex-1 bg-red-50 dark:bg-red-950 text-red-500 dark:text-red-400 font-bold h-14 rounded-3xl hover:bg-red-100 dark:hover:bg-red-900 active:scale-95 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {dropMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                        {dropMutation.isPending ? '退课中...' : '退出课程'}
                      </button>
                      <button
                        onClick={() => setViewingTasksCourseId(selectedCourse.id)}
                        className="flex-2 bg-slate-900 text-white font-bold h-14 rounded-3xl shadow-xl active:scale-95 transition-transform flex items-center justify-center gap-2"
                      >
                        <ListChecks size={16} /> 查看任务
                      </button>
                    </div>
                  </div>
                )}
                {status === 'LOCKED' && (
                  <div className="flex gap-3">
                    <button
                      onClick={() => setViewingTasksCourseId(selectedCourse.id)}
                      className="flex-1 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold h-14 rounded-3xl hover:bg-slate-200 dark:hover:bg-slate-600 active:scale-95 transition-colors flex items-center justify-center gap-2"
                    >
                      <ListChecks size={16} /> 查看任务
                    </button>
                    <button
                      disabled
                      className="flex-2 bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500 font-bold h-14 rounded-3xl flex items-center justify-center gap-2 cursor-not-allowed"
                    >
                      <Lock size={16} /> 请先完成前置课程
                    </button>
                  </div>
                )}
                {status === 'COMPLETED' && (
                  <div className="flex gap-3">
                    <button
                      onClick={() => setViewingTasksCourseId(selectedCourse.id)}
                      className="flex-1 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold h-14 rounded-3xl hover:bg-slate-200 dark:hover:bg-slate-600 active:scale-95 transition-colors flex items-center justify-center gap-2"
                    >
                      <ListChecks size={16} /> 查看任务
                    </button>
                    <button className="flex-2 bg-green-500 text-white font-bold h-14 rounded-3xl shadow-xl active:scale-95 transition-transform flex items-center justify-center gap-2">
                      <CheckCircle size={16} /> 课程已完成
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Course Tasks Overview Overlay */}
      {viewingTasksCourseId !== null && (
        <CourseTasksView
          courseId={viewingTasksCourseId}
          onBack={() => setViewingTasksCourseId(null)}
        />
      )}
    </div>
  );
};

// --- CourseTasksView sub-component ---

const TASK_TYPE_LABELS: Record<string, string> = {
  DURATION: '时长',
  COUNT: '次数',
  MANUAL: '手动确认',
  LOCK: '锁定',
};

const TARGET_UNIT_LABELS: Record<string, string> = {
  KILOMETERS: 'km',
  METERS: 'm',
  MINUTES: '分钟',
  HOURS: '小时',
  TIMES: '次',
  NONE: '',
};

const DAY_NAMES = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];

function CourseTasksView({ courseId, onBack }: { courseId: number; onBack: () => void }) {
  const { data, isLoading, error } = useCourseTasksOverview(courseId);

  return (
    <div className="fixed inset-0 z-50 bg-white dark:bg-slate-800 flex flex-col lg:bg-black/50 lg:items-center lg:justify-center">
      <div className="flex flex-col w-full h-full lg:max-w-2xl lg:max-h-[85vh] lg:rounded-2xl lg:overflow-hidden lg:shadow-2xl lg:bg-white dark:bg-slate-800 lg:h-auto">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 lg:rounded-t-2xl">
        <button onClick={onBack} className="p-1 -ml-1 active:scale-90 transition-transform">
          <ArrowLeft size={22} className="text-slate-700 dark:text-slate-200" />
        </button>
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">课程任务</h2>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto pb-8">
        {isLoading && (
          <div className="flex flex-col items-center justify-center h-48 gap-2">
            <Loader2 className="w-6 h-6 animate-spin text-slate-400 dark:text-slate-500" />
            <span className="text-sm text-slate-400 dark:text-slate-500">加载中...</span>
          </div>
        )}

        {error && (
          <div className="flex flex-col items-center justify-center h-48 gap-2 text-red-400">
            <AlertCircle size={24} />
            <span className="text-sm">加载失败</span>
          </div>
        )}

        {data && (
          <div className="px-4 pt-4 space-y-6">
            {/* Course name */}
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">{data.courseName}</h3>

            {/* Daily Tasks */}
            {data.dailyTasks.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <ListChecks size={16} className="text-blue-500 dark:text-blue-400" />
                  <span className="text-sm font-bold text-slate-700 dark:text-slate-200">每日任务</span>
                  <span className="text-xs text-slate-400 dark:text-slate-500 ml-auto">{data.dailyTasks.length} 个</span>
                </div>
                <div className="space-y-2">
                  {data.dailyTasks.map(task => (
                    <TaskCard key={task.id} task={task} />
                  ))}
                </div>
              </section>
            )}

            {/* Exam Tasks */}
            {data.examTasks.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <Target size={16} className="text-amber-500 dark:text-amber-400" />
                  <span className="text-sm font-bold text-slate-700 dark:text-slate-200">考试任务</span>
                  <span className="text-xs text-slate-400 dark:text-slate-500 ml-auto">{data.examTasks.length} 个</span>
                </div>
                <div className="space-y-2">
                  {data.examTasks.map(task => (
                    <TaskCard key={task.id} task={task} accent="amber" />
                  ))}
                </div>
              </section>
            )}

            {/* Optional Task Groups */}
            {data.optionalTaskGroups.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <Dices size={16} className="text-purple-500 dark:text-purple-400" />
                  <span className="text-sm font-bold text-slate-700 dark:text-slate-200">选做任务组</span>
                  <span className="text-xs text-slate-400 dark:text-slate-500 ml-auto">{data.optionalTaskGroups.length} 组</span>
                </div>
                <div className="space-y-4">
                  {data.optionalTaskGroups.map(group => (
                    <OptionalGroupCard key={group.id} group={group} />
                  ))}
                </div>
              </section>
            )}

            {data.dailyTasks.length === 0 && data.examTasks.length === 0 && data.optionalTaskGroups.length === 0 && (
              <div className="flex flex-col items-center justify-center h-32 text-slate-400 dark:text-slate-500 text-sm">
                暂无任务安排
              </div>
            )}
          </div>
        )}
      </div>
      </div>
    </div>
  );
}

const TaskCard: React.FC<{ task: TaskDefinitionDisplay; accent?: 'blue' | 'amber' }> = ({ task, accent = 'blue' }) => {
  const typeLabel = TASK_TYPE_LABELS[task.taskType] || task.taskType;
  const unitLabel = TARGET_UNIT_LABELS[task.targetUnit] || task.targetUnit;
  const accentColors = accent === 'amber'
    ? 'bg-amber-50 dark:bg-amber-950 border-amber-100 dark:border-amber-900 text-amber-600 dark:text-amber-400'
    : 'bg-blue-50 dark:bg-blue-950 border-blue-100 dark:border-blue-900 text-blue-600 dark:text-blue-400';
  const badgeBg = accent === 'amber' ? 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400' : 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-400';

  return (
    <div className={`rounded-xl border p-3 ${accentColors}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm text-slate-800 dark:text-slate-100">{task.name}</div>
          {task.description && (
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">{task.description}</div>
          )}
        </div>
        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0 ${badgeBg}`}>
          {typeLabel}
        </span>
      </div>
      {task.targetValue > 0 && unitLabel && (
        <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
          目标: <span className="font-medium text-slate-700 dark:text-slate-200">{task.targetValue} {unitLabel}</span>
        </div>
      )}
    </div>
  );
};

const OptionalGroupCard: React.FC<{ group: OptionalTaskGroupOverview }> = ({ group }) => {
  const scheduleDaysText = group.scheduleDays?.length
    ? group.scheduleDays.map(d => DAY_NAMES[d - 1]).join('、')
    : '每天';

  return (
    <div className="rounded-xl border border-purple-100 dark:border-purple-900 bg-purple-50 dark:bg-purple-950 p-3">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm text-slate-800 dark:text-slate-100">{group.name}</div>
          {group.description && (
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">{group.description}</div>
          )}
        </div>
        <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-400 shrink-0">
          {group.requiredCount}/{group.totalCount} 必选
        </span>
      </div>
      <div className="text-xs text-slate-400 dark:text-slate-500 mb-2">
        <CalendarDays size={12} className="inline mr-1" />{scheduleDaysText}
      </div>
      {group.tasks.length > 0 && (
        <div className="space-y-1.5 mt-2 pl-2 border-l-2 border-purple-200 dark:border-purple-800">
          {group.tasks.map(task => (
            <div key={task.id} className="text-xs">
              <span className="font-medium text-slate-700 dark:text-slate-200">{task.name}</span>
              {task.targetValue > 0 && (
                <span className="text-slate-400 dark:text-slate-500 ml-1">
                  ({task.targetValue} {TARGET_UNIT_LABELS[task.targetUnit] || task.targetUnit})
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
