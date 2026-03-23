import React, { useState, useEffect, useCallback } from 'react';
import {
  ArrowLeft,
  Loader2,
  CheckCircle,
  XCircle,
  Clock,
  User,
  Film,
  ImageIcon,
  Coins,
  Eye,
  Play,
  ChevronUp,
  RefreshCw,
  ClipboardList,
  Inbox,
  Ribbon,
  MapPin,
} from 'lucide-react';
import { adminGalleryApi, adminCinemaApi, reviewAssignmentApi, ropeArtistApi } from '../../lib/api';
import type { ReviewAssignmentResponse, ReviewAssignmentWithContent } from '../../lib/api';
import type { GalleryReviewItem, CinemaVideoSummary, RopeArtistData } from '../../types';
import { useAuth } from '../../lib/auth-context';

type ReviewTab = 'gallery' | 'cinema' | 'rope-art';

interface ContentReviewPageProps {
  onBack: () => void;
}

/**
 * 判断用户是否可以直接审核（校长/老师）
 * 如果用户有 content.takedown 权限（老师以上），则可以直接审核所有内容
 * 否则走分配制（学生会成员）
 */
function canDirectReview(hasPermission: (p: string) => boolean): boolean {
  return hasPermission('content.takedown');
}

export const ContentReviewPage: React.FC<ContentReviewPageProps> = ({ onBack }) => {
  const { hasPermission } = useAuth();
  const isDirectMode = canDirectReview(hasPermission);

  if (isDirectMode) {
    return <DirectReviewMode onBack={onBack} />;
  }
  return <AssignmentReviewMode onBack={onBack} />;
};

// ==================== Direct Review Mode (校长/老师) ====================

const DirectReviewMode: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [activeTab, setActiveTab] = useState<ReviewTab>('gallery');

  // Gallery state
  const [galleryItems, setGalleryItems] = useState<GalleryReviewItem[]>([]);
  const [galleryLoading, setGalleryLoading] = useState(true);

  // Cinema state
  const [cinemaVideos, setCinemaVideos] = useState<CinemaVideoSummary[]>([]);
  const [cinemaLoading, setCinemaLoading] = useState(true);

  // Rope art state
  const [ropeApplications, setRopeApplications] = useState<Array<{ artist: RopeArtistData; applicationImages: string[] }>>([]);
  const [ropeLoading, setRopeLoading] = useState(true);

  // Review state
  const [reviewSaving, setReviewSaving] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectingId, setRejectingId] = useState<number | null>(null);
  const [rejectingType, setRejectingType] = useState<ReviewTab>('gallery');
  const [rejectionReason, setRejectionReason] = useState('');

  // Preview state
  const [previewImages, setPreviewImages] = useState<string[] | null>(null);
  const [expandedVideoId, setExpandedVideoId] = useState<number | null>(null);

  // Mux sync state
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);

  const fetchGallery = useCallback(async () => {
    try {
      setGalleryLoading(true);
      const items = await adminGalleryApi.getPending();
      setGalleryItems(items);
    } catch (err) {
      console.error('Failed to fetch gallery reviews:', err);
    } finally {
      setGalleryLoading(false);
    }
  }, []);

  const fetchCinema = useCallback(async () => {
    try {
      setCinemaLoading(true);
      const videos = await adminCinemaApi.getPending();
      setCinemaVideos(videos);
    } catch (err) {
      console.error('Failed to fetch cinema reviews:', err);
    } finally {
      setCinemaLoading(false);
    }
  }, []);

  const fetchRope = useCallback(async () => {
    try {
      setRopeLoading(true);
      const items = await ropeArtistApi.getPendingApplications();
      setRopeApplications(items);
    } catch (err) {
      console.error('Failed to fetch rope art applications:', err);
    } finally {
      setRopeLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGallery();
    fetchCinema();
    fetchRope();
  }, [fetchGallery, fetchCinema, fetchRope]);

  const handleApprove = async (id: number, type: ReviewTab) => {
    setReviewSaving(true);
    try {
      if (type === 'gallery') {
        await adminGalleryApi.review(id, { approved: true });
        fetchGallery();
      } else if (type === 'cinema') {
        await adminCinemaApi.review(id, { approved: true });
        fetchCinema();
      } else {
        await ropeArtistApi.adminReview(id, true);
        fetchRope();
      }
    } catch (err) {
      console.error('Failed to approve:', err);
    } finally {
      setReviewSaving(false);
    }
  };

  const handleReject = async () => {
    if (rejectingId === null) return;
    setReviewSaving(true);
    try {
      if (rejectingType === 'gallery') {
        await adminGalleryApi.review(rejectingId, {
          approved: false,
          rejectionReason: rejectionReason.trim() || undefined,
        });
        fetchGallery();
      } else if (rejectingType === 'cinema') {
        await adminCinemaApi.review(rejectingId, {
          approved: false,
          rejectionReason: rejectionReason.trim() || undefined,
        });
        fetchCinema();
      } else {
        await ropeArtistApi.adminReview(rejectingId, false, rejectionReason.trim() || undefined);
        fetchRope();
      }
      setShowRejectDialog(false);
      setRejectingId(null);
      setRejectionReason('');
    } catch (err) {
      console.error('Failed to reject:', err);
    } finally {
      setReviewSaving(false);
    }
  };

  const openRejectDialog = (id: number, type: ReviewTab) => {
    setRejectingId(id);
    setRejectingType(type);
    setRejectionReason('');
    setShowRejectDialog(true);
  };

  const handleSyncMux = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const result = await adminCinemaApi.syncMux();
      const parts = [];
      if (result.updated > 0) parts.push(`${result.updated}个已修复`);
      if (result.failed > 0) parts.push(`${result.failed}个上传失败`);
      setSyncResult(parts.length > 0 ? parts.join(', ') : `${result.total}个均无变化`);
      fetchCinema();
    } catch (err) {
      console.error('Failed to sync Mux statuses:', err);
      setSyncResult('同步失败');
    } finally {
      setSyncing(false);
      setTimeout(() => setSyncResult(null), 3000);
    }
  };

  const galleryCount = galleryItems.length;
  const cinemaCount = cinemaVideos.length;
  const ropeCount = ropeApplications.length;

  return (
    <div className="h-full flex flex-col bg-slate-50 dark:bg-slate-900 lg:max-w-[900px] lg:mx-auto lg:w-full">
      {/* Header */}
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 text-white px-4 pt-12 pb-3">
        <div className="flex items-center gap-3 mb-3">
          <button
            onClick={onBack}
            className="p-2 hover:bg-white/10 rounded-full transition-colors"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-bold">内容审核</h1>
            <p className="text-xs text-white/60 mt-0.5">审核美术馆和电影院的用户上传内容</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex bg-white/10 rounded-xl p-1">
          <button
            onClick={() => setActiveTab('gallery')}
            className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'gallery'
                ? 'bg-white/20 text-white'
                : 'text-white/50 hover:text-white/70'
            }`}
          >
            <ImageIcon size={13} />
            美术馆
            {galleryCount > 0 && (
              <span className="bg-red-500 text-white text-[9px] px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                {galleryCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('cinema')}
            className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'cinema'
                ? 'bg-white/20 text-white'
                : 'text-white/50 hover:text-white/70'
            }`}
          >
            <Film size={13} />
            电影院
            {cinemaCount > 0 && (
              <span className="bg-red-500 text-white text-[9px] px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                {cinemaCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('rope-art')}
            className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'rope-art'
                ? 'bg-white/20 text-white'
                : 'text-white/50 hover:text-white/70'
            }`}
          >
            <Ribbon size={13} />
            绳艺室
            {ropeCount > 0 && (
              <span className="bg-red-500 text-white text-[9px] px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                {ropeCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Gallery Tab */}
      {activeTab === 'gallery' && (
        <div className="flex-1 overflow-y-auto p-4">
          {galleryLoading ? (
            <LoadingSpinner />
          ) : galleryItems.length === 0 ? (
            <EmptyState text="暂无待审核的美术馆作品" subtext="所有上传都已处理完毕" />
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-slate-400 dark:text-slate-500 mb-2">
                共 {galleryCount} 个待审核
              </p>
              {galleryItems.map((item) => (
                <GalleryReviewCard
                  key={item.id}
                  item={item}
                  onApprove={() => handleApprove(item.id, 'gallery')}
                  onReject={() => openRejectDialog(item.id, 'gallery')}
                  onPreview={() => setPreviewImages(item.images.map(i => i.imageUrl))}
                  saving={reviewSaving}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Cinema Tab */}
      {activeTab === 'cinema' && (
        <div className="flex-1 overflow-y-auto p-4">
          {cinemaLoading ? (
            <LoadingSpinner />
          ) : cinemaVideos.length === 0 ? (
            <EmptyState text="暂无待审核的视频" subtext="所有上传都已处理完毕" />
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-slate-400 dark:text-slate-500">
                  共 {cinemaCount} 个待审核
                </p>
                <button
                  onClick={handleSyncMux}
                  disabled={syncing}
                  className="flex items-center gap-1 px-2.5 py-1 bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 rounded-lg text-[10px] font-medium hover:bg-blue-100 dark:hover:bg-blue-900 transition-colors disabled:opacity-50"
                >
                  <RefreshCw size={10} className={syncing ? 'animate-spin' : ''} />
                  {syncing ? '同步中...' : syncResult || '同步Mux状态'}
                </button>
              </div>
              {cinemaVideos.map((video) => (
                <CinemaReviewCard
                  key={video.id}
                  video={video}
                  onApprove={() => handleApprove(video.id, 'cinema')}
                  onReject={() => openRejectDialog(video.id, 'cinema')}
                  expandedVideoId={expandedVideoId}
                  onExpandVideo={setExpandedVideoId}
                  saving={reviewSaving}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Rope Art Tab */}
      {activeTab === 'rope-art' && (
        <div className="flex-1 overflow-y-auto p-4">
          {ropeLoading ? (
            <LoadingSpinner />
          ) : ropeApplications.length === 0 ? (
            <EmptyState text="暂无待审核的绳艺师申请" subtext="所有申请都已处理完毕" />
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-slate-400 dark:text-slate-500 mb-2">
                共 {ropeCount} 个待审核
              </p>
              {ropeApplications.map((item) => (
                <RopeArtistReviewCard
                  key={item.artist.id}
                  artist={item.artist}
                  applicationImages={item.applicationImages}
                  onApprove={() => handleApprove(item.artist.id, 'rope-art')}
                  onReject={() => openRejectDialog(item.artist.id, 'rope-art')}
                  onPreview={() => setPreviewImages(item.applicationImages)}
                  saving={reviewSaving}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Rejection reason dialog */}
      {showRejectDialog && (
        <RejectDialog
          saving={reviewSaving}
          rejectionReason={rejectionReason}
          onReasonChange={setRejectionReason}
          onConfirm={handleReject}
          onCancel={() => { setShowRejectDialog(false); setRejectingId(null); }}
        />
      )}

      {/* Image preview modal */}
      {previewImages && (
        <ImagePreviewModal images={previewImages} onClose={() => setPreviewImages(null)} />
      )}
    </div>
  );
};

// ==================== Rope Artist Review Card ====================

const RopeArtistReviewCard: React.FC<{
  artist: RopeArtistData;
  applicationImages: string[];
  onApprove: () => void;
  onReject: () => void;
  onPreview: () => void;
  saving: boolean;
}> = ({ artist, applicationImages, onApprove, onReject, onPreview, saving }) => (
  <div className="bg-white dark:bg-slate-800 rounded-xl border border-rose-100 dark:border-rose-900 overflow-hidden shadow-sm">
    <div className="p-3">
      <div className="flex items-start gap-3 mb-2">
        <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden shrink-0">
          {artist.avatarUrl ? (
            <img src={artist.avatarUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <User size={16} className="text-slate-400 dark:text-slate-500" />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">{artist.displayName}</h3>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-0.5">
              <MapPin size={8} />
              {artist.city}
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-rose-50 dark:bg-rose-950 text-rose-600 dark:text-rose-400 flex items-center gap-0.5">
              <Clock size={8} />
              待审核
            </span>
          </div>
        </div>
      </div>

      {artist.bio && (
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-2 line-clamp-3">{artist.bio}</p>
      )}

      {applicationImages.length > 0 && (
        <div className="flex gap-1.5 mb-3 overflow-x-auto">
          {applicationImages.slice(0, 4).map((url, idx) => (
            <div
              key={idx}
              className="w-16 h-16 rounded-lg overflow-hidden shrink-0 bg-slate-100 dark:bg-slate-700 cursor-pointer hover:opacity-80 transition-opacity relative"
              onClick={onPreview}
            >
              <img src={url} alt="" className="w-full h-full object-cover" />
              {idx === 3 && applicationImages.length > 4 && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                  <span className="text-white text-xs font-bold">+{applicationImages.length - 4}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>

    <div className="flex items-center gap-2 px-3 pb-3">
      {applicationImages.length > 0 && (
        <button
          onClick={onPreview}
          className="flex-1 py-2 bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-300 rounded-lg text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors flex items-center justify-center gap-1"
        >
          <Eye size={12} />
          预览
        </button>
      )}
      <button
        onClick={onApprove}
        disabled={saving}
        className="flex-1 py-2 bg-emerald-50 dark:bg-emerald-950 text-emerald-700 rounded-lg text-xs font-medium hover:bg-emerald-100 transition-colors flex items-center justify-center gap-1 disabled:opacity-50"
      >
        {saving ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle size={12} />}
        通过
      </button>
      <button
        onClick={onReject}
        disabled={saving}
        className="flex-1 py-2 bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400 rounded-lg text-xs font-medium hover:bg-red-100 dark:hover:bg-red-900 transition-colors flex items-center justify-center gap-1 disabled:opacity-50"
      >
        <XCircle size={12} />
        拒绝
      </button>
    </div>
  </div>
);

// ==================== Assignment Review Mode (学生会成员) ====================

const AssignmentReviewMode: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [assignmentData, setAssignmentData] = useState<ReviewAssignmentResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState(false);
  const [reviewSaving, setReviewSaving] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectingAssignmentId, setRejectingAssignmentId] = useState<number | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [previewImages, setPreviewImages] = useState<string[] | null>(null);
  const [expandedVideoId, setExpandedVideoId] = useState<number | null>(null);

  const fetchAssignments = useCallback(async () => {
    try {
      setLoading(true);
      const data = await reviewAssignmentApi.getMyAssignments();
      setAssignmentData(data);
    } catch (err) {
      console.error('Failed to fetch assignments:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAssignments();
  }, [fetchAssignments]);

  const handleRequestAssignments = async () => {
    setRequesting(true);
    try {
      const data = await reviewAssignmentApi.requestAssignments();
      setAssignmentData(data);
    } catch (err) {
      console.error('Failed to request assignments:', err);
    } finally {
      setRequesting(false);
    }
  };

  const handleApprove = async (assignmentId: number) => {
    setReviewSaving(true);
    try {
      await reviewAssignmentApi.submitReview(assignmentId, { approved: true });
      fetchAssignments();
    } catch (err) {
      console.error('Failed to approve:', err);
    } finally {
      setReviewSaving(false);
    }
  };

  const handleReject = async () => {
    if (rejectingAssignmentId === null) return;
    setReviewSaving(true);
    try {
      await reviewAssignmentApi.submitReview(rejectingAssignmentId, {
        approved: false,
        rejectionReason: rejectionReason.trim() || undefined,
      });
      setShowRejectDialog(false);
      setRejectingAssignmentId(null);
      setRejectionReason('');
      fetchAssignments();
    } catch (err) {
      console.error('Failed to reject:', err);
    } finally {
      setReviewSaving(false);
    }
  };

  const openRejectDialog = (assignmentId: number) => {
    setRejectingAssignmentId(assignmentId);
    setRejectionReason('');
    setShowRejectDialog(true);
  };

  const assignments = assignmentData?.assignments ?? [];
  const remainingToday = assignmentData?.remainingToday ?? 0;
  const maxPerDay = assignmentData?.maxPerDay ?? 3;

  return (
    <div className="h-full flex flex-col bg-slate-50 dark:bg-slate-900 lg:max-w-[900px] lg:mx-auto lg:w-full">
      {/* Header */}
      <div className="bg-gradient-to-br from-orange-600 to-amber-700 text-white px-4 pt-12 pb-4">
        <div className="flex items-center gap-3 mb-3">
          <button
            onClick={onBack}
            className="p-2 hover:bg-white/10 rounded-full transition-colors"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-bold">内容审核</h1>
            <p className="text-xs text-white/70 mt-0.5">审核分配给你的内容</p>
          </div>
          <ClipboardList size={24} className="text-white/40" />
        </div>

        {/* Stats bar */}
        <div className="flex items-center gap-3 bg-white/10 rounded-xl p-3">
          <div className="flex-1">
            <p className="text-[10px] text-white/60 uppercase tracking-wider">今日剩余配额</p>
            <p className="text-xl font-bold">{remainingToday} / {maxPerDay}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-white/60">待审核</p>
            <p className="text-xl font-bold">{assignments.length}</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <LoadingSpinner />
        ) : assignments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Inbox size={48} className="text-slate-300 dark:text-slate-600 mb-4" />
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">暂无待审核任务</p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mb-6">
              {remainingToday > 0
                ? '点击下方按钮获取新的审核任务'
                : '今日配额已用完，明天再来'}
            </p>
            {remainingToday > 0 && (
              <button
                onClick={handleRequestAssignments}
                disabled={requesting}
                className="px-6 py-2.5 bg-orange-500 text-white rounded-xl text-sm font-medium hover:bg-orange-600 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {requesting ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <ClipboardList size={16} />
                )}
                获取审核任务
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {/* Request more button */}
            {remainingToday > 0 && (
              <button
                onClick={handleRequestAssignments}
                disabled={requesting}
                className="w-full py-2 bg-orange-50 dark:bg-orange-950 text-orange-600 dark:text-orange-400 rounded-xl text-xs font-medium hover:bg-orange-100 dark:hover:bg-orange-900 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {requesting ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <ClipboardList size={12} />
                )}
                获取更多审核任务（还可获取 {remainingToday} 个）
              </button>
            )}

            {assignments.map((item) => (
              <AssignmentCard
                key={item.assignment.id}
                item={item}
                onApprove={() => handleApprove(item.assignment.id)}
                onReject={() => openRejectDialog(item.assignment.id)}
                onPreviewImages={(urls) => setPreviewImages(urls)}
                expandedVideoId={expandedVideoId}
                onExpandVideo={setExpandedVideoId}
                saving={reviewSaving}
              />
            ))}
          </div>
        )}
      </div>

      {/* Rejection reason dialog */}
      {showRejectDialog && (
        <RejectDialog
          saving={reviewSaving}
          rejectionReason={rejectionReason}
          onReasonChange={setRejectionReason}
          onConfirm={handleReject}
          onCancel={() => { setShowRejectDialog(false); setRejectingAssignmentId(null); }}
        />
      )}

      {/* Image preview modal */}
      {previewImages && (
        <ImagePreviewModal images={previewImages} onClose={() => setPreviewImages(null)} />
      )}
    </div>
  );
};

// ==================== Assignment Card ====================

const AssignmentCard: React.FC<{
  item: ReviewAssignmentWithContent;
  onApprove: () => void;
  onReject: () => void;
  onPreviewImages: (urls: string[]) => void;
  expandedVideoId: number | null;
  onExpandVideo: (id: number | null) => void;
  saving: boolean;
}> = ({ item, onApprove, onReject, onPreviewImages, expandedVideoId, onExpandVideo, saving }) => {
  if (item.assignment.contentType === 'GALLERY' && item.galleryItem) {
    return (
      <GalleryReviewCard
        item={item.galleryItem}
        onApprove={onApprove}
        onReject={onReject}
        onPreview={() => onPreviewImages(item.galleryItem!.images.map(i => i.imageUrl))}
        saving={saving}
      />
    );
  }

  if (item.assignment.contentType === 'CINEMA' && item.cinemaVideo) {
    return (
      <CinemaReviewCard
        video={item.cinemaVideo}
        onApprove={onApprove}
        onReject={onReject}
        expandedVideoId={expandedVideoId}
        onExpandVideo={onExpandVideo}
        saving={saving}
      />
    );
  }

  // Fallback for unknown or missing content
  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
          {item.assignment.contentType === 'GALLERY' ? <ImageIcon size={18} className="text-slate-400" /> : <Film size={18} className="text-slate-400" />}
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{item.contentTitle || '内容已被处理'}</p>
          <p className="text-xs text-slate-400">{item.contentAuthorName || '未知作者'}</p>
        </div>
        <span className="text-[10px] px-2 py-1 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-500">已过期</span>
      </div>
    </div>
  );
};

// ==================== Shared Components ====================

const GalleryReviewCard: React.FC<{
  item: GalleryReviewItem;
  onApprove: () => void;
  onReject: () => void;
  onPreview: () => void;
  saving: boolean;
}> = ({ item, onApprove, onReject, onPreview, saving }) => (
  <div className="bg-white dark:bg-slate-800 rounded-xl border border-amber-100 dark:border-amber-900 overflow-hidden shadow-sm">
    <div className="p-3">
      <div className="flex items-start gap-3 mb-2">
        <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden shrink-0">
          {item.authorAvatar ? (
            <img src={item.authorAvatar} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <User size={14} className="text-slate-400 dark:text-slate-500" />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">{item.title}</h3>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[10px] text-slate-500 dark:text-slate-400">{item.authorName || '匿名'}</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400 flex items-center gap-0.5">
              <Clock size={8} />
              待审核
            </span>
            {item.priceCampusPoints > 0 && (
              <span className="text-[10px] text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950 px-2 py-0.5 rounded-full flex items-center gap-0.5">
                <Coins size={8} />
                {item.priceCampusPoints}
              </span>
            )}
          </div>
        </div>
      </div>

      {item.description && (
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-2 line-clamp-2">{item.description}</p>
      )}

      {item.images.length > 0 && (
        <div className="flex gap-1.5 mb-3 overflow-x-auto">
          {item.images.slice(0, 4).map((img, idx) => (
            <div
              key={img.id}
              className="w-16 h-16 rounded-lg overflow-hidden shrink-0 bg-slate-100 dark:bg-slate-700 cursor-pointer hover:opacity-80 transition-opacity relative"
              onClick={onPreview}
            >
              <img src={img.imageUrl} alt="" className="w-full h-full object-cover" />
              {idx === 3 && item.images.length > 4 && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                  <span className="text-white text-xs font-bold">+{item.images.length - 4}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>

    <div className="flex items-center gap-2 px-3 pb-3">
      <button
        onClick={onPreview}
        className="flex-1 py-2 bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-300 rounded-lg text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors flex items-center justify-center gap-1"
      >
        <Eye size={12} />
        预览
      </button>
      <button
        onClick={onApprove}
        disabled={saving}
        className="flex-1 py-2 bg-emerald-50 dark:bg-emerald-950 text-emerald-700 rounded-lg text-xs font-medium hover:bg-emerald-100 transition-colors flex items-center justify-center gap-1 disabled:opacity-50"
      >
        {saving ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle size={12} />}
        通过
      </button>
      <button
        onClick={onReject}
        disabled={saving}
        className="flex-1 py-2 bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400 rounded-lg text-xs font-medium hover:bg-red-100 dark:hover:bg-red-900 transition-colors flex items-center justify-center gap-1 disabled:opacity-50"
      >
        <XCircle size={12} />
        拒绝
      </button>
    </div>
  </div>
);

const CinemaReviewCard: React.FC<{
  video: CinemaVideoSummary;
  onApprove: () => void;
  onReject: () => void;
  expandedVideoId: number | null;
  onExpandVideo: (id: number | null) => void;
  saving: boolean;
}> = ({ video, onApprove, onReject, expandedVideoId, onExpandVideo, saving }) => (
  <div className="bg-white dark:bg-slate-800 rounded-xl border border-amber-100 dark:border-amber-900 overflow-hidden shadow-sm">
    {/* Video preview area */}
    {video.muxPlaybackId ? (
      <div className="relative">
        {expandedVideoId === video.id ? (
          <div className="aspect-video bg-black">
            <CinemaVideoPlayer playbackId={video.muxPlaybackId} playbackToken={video.playbackToken} thumbnailToken={video.thumbnailToken} />
          </div>
        ) : (
          <div
            className="relative aspect-video bg-slate-900 cursor-pointer group"
            onClick={() => onExpandVideo(video.id)}
          >
            <img
              src={video.coverImageUrl || (video.thumbnailToken ? `https://image.mux.com/${video.muxPlaybackId}/thumbnail.webp?token=${video.thumbnailToken}` : `https://image.mux.com/${video.muxPlaybackId}/thumbnail.webp?time=0`)}
              alt=""
              className="w-full h-full object-cover opacity-80"
            />
            <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/30 transition-colors">
              <div className="w-12 h-12 bg-white/90 dark:bg-slate-800/90 rounded-full flex items-center justify-center shadow-lg">
                <Play size={20} className="text-slate-800 dark:text-slate-100 ml-0.5" />
              </div>
            </div>
            <div className="absolute bottom-2 left-2 text-[10px] text-white/80 bg-black/50 px-2 py-0.5 rounded-full">
              点击预览视频
            </div>
          </div>
        )}
        {expandedVideoId === video.id && (
          <button
            onClick={() => onExpandVideo(null)}
            className="absolute top-2 right-2 z-10 p-1 bg-black/50 text-white rounded-full hover:bg-black/70 transition-colors"
          >
            <ChevronUp size={14} />
          </button>
        )}
      </div>
    ) : video.muxAssetStatus === 'upload_failed' ? (
      <div className="aspect-video bg-red-50 dark:bg-red-950 flex flex-col items-center justify-center gap-1">
        <XCircle size={24} className="text-red-400" />
        <span className="text-xs text-red-500 dark:text-red-400 font-medium">上传失败（文件未传完）</span>
      </div>
    ) : video.coverImageUrl ? (
      <div className="relative aspect-video bg-slate-100 dark:bg-slate-700">
        <img src={video.coverImageUrl} alt="" className="w-full h-full object-cover" />
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xs text-white bg-black/50 px-3 py-1 rounded-full">视频处理中</span>
        </div>
      </div>
    ) : (
      <div className="aspect-video bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
        <span className="text-xs text-slate-400 dark:text-slate-500">视频处理中</span>
      </div>
    )}

    <div className="p-3">
      <div className="flex items-start gap-3 mb-2">
        <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden shrink-0">
          {video.authorAvatar ? (
            <img src={video.authorAvatar} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <User size={14} className="text-slate-400 dark:text-slate-500" />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">{video.title}</h3>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span className="text-[10px] text-slate-500 dark:text-slate-400">{video.authorName || '匿名'}</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400 flex items-center gap-0.5">
              <Clock size={8} />
              待审核
            </span>
            {video.priceCampusPoints > 0 && (
              <span className="text-[10px] text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950 px-2 py-0.5 rounded-full flex items-center gap-0.5">
                <Coins size={8} />
                {video.priceCampusPoints}
              </span>
            )}
          </div>
        </div>
      </div>

      {video.description && (
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-2 line-clamp-2">{video.description}</p>
      )}
    </div>

    <div className="flex items-center gap-2 px-3 pb-3">
      {video.muxPlaybackId && expandedVideoId !== video.id && (
        <button
          onClick={() => onExpandVideo(video.id)}
          className="flex-1 py-2 bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-300 rounded-lg text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors flex items-center justify-center gap-1"
        >
          <Play size={12} />
          预览
        </button>
      )}
      <button
        onClick={onApprove}
        disabled={saving}
        className="flex-1 py-2 bg-emerald-50 dark:bg-emerald-950 text-emerald-700 rounded-lg text-xs font-medium hover:bg-emerald-100 transition-colors flex items-center justify-center gap-1 disabled:opacity-50"
      >
        {saving ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle size={12} />}
        通过
      </button>
      <button
        onClick={onReject}
        disabled={saving}
        className="flex-1 py-2 bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400 rounded-lg text-xs font-medium hover:bg-red-100 dark:hover:bg-red-900 transition-colors flex items-center justify-center gap-1 disabled:opacity-50"
      >
        <XCircle size={12} />
        拒绝
      </button>
    </div>
  </div>
);

// ==================== Utility Components ====================

const LoadingSpinner = () => (
  <div className="flex items-center justify-center py-20">
    <Loader2 size={24} className="animate-spin text-indigo-400" />
  </div>
);

const EmptyState: React.FC<{ text: string; subtext: string }> = ({ text, subtext }) => (
  <div className="flex flex-col items-center justify-center py-20 text-slate-400 dark:text-slate-500">
    <CheckCircle size={36} className="mb-3 opacity-50" />
    <p className="text-sm">{text}</p>
    <p className="text-xs mt-1">{subtext}</p>
  </div>
);

const RejectDialog: React.FC<{
  saving: boolean;
  rejectionReason: string;
  onReasonChange: (v: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}> = ({ saving, rejectionReason, onReasonChange, onConfirm, onCancel }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
    <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 w-full max-w-sm shadow-xl">
      <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-3">拒绝原因</h3>
      <textarea
        value={rejectionReason}
        onChange={(e) => onReasonChange(e.target.value)}
        placeholder="请输入拒绝原因（将通知作者）..."
        rows={3}
        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-red-300 resize-none"
      />
      <div className="flex gap-3 mt-4">
        <button
          onClick={onCancel}
          className="flex-1 px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-medium hover:bg-slate-200 dark:hover:bg-slate-600"
        >
          取消
        </button>
        <button
          onClick={onConfirm}
          disabled={saving}
          className="flex-1 px-4 py-2 bg-red-600 text-white rounded-xl text-xs font-medium hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-1"
        >
          {saving ? <Loader2 size={12} className="animate-spin" /> : <XCircle size={12} />}
          确认拒绝
        </button>
      </div>
    </div>
  </div>
);

const ImagePreviewModal: React.FC<{ images: string[]; onClose: () => void }> = ({ images, onClose }) => (
  <div
    className="fixed inset-0 z-50 bg-black/90 flex flex-col"
    onClick={onClose}
  >
    <div className="flex items-center justify-end p-4">
      <button className="text-white/70 hover:text-white text-sm">
        关闭
      </button>
    </div>
    <div className="flex-1 overflow-y-auto p-4 space-y-3" onClick={(e) => e.stopPropagation()}>
      {images.map((url, idx) => (
        <img
          key={idx}
          src={url}
          alt={`预览 ${idx + 1}`}
          className="w-full max-w-lg mx-auto rounded-xl"
        />
      ))}
    </div>
  </div>
);

// HLS.js-based Mux player for review preview
const CinemaVideoPlayer: React.FC<{
  playbackId: string;
  playbackToken?: string | null;
  thumbnailToken?: string | null;
}> = ({ playbackId, playbackToken, thumbnailToken }) => {
  const videoRef = React.useRef<HTMLVideoElement>(null);

  const src = playbackToken
    ? `https://stream.mux.com/${playbackId}.m3u8?token=${playbackToken}`
    : `https://stream.mux.com/${playbackId}.m3u8`;

  const posterUrl = thumbnailToken
    ? `https://image.mux.com/${playbackId}/thumbnail.webp?token=${thumbnailToken}`
    : `https://image.mux.com/${playbackId}/thumbnail.webp?time=0`;

  React.useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let hlsInstance: any = null;

    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = src;
    } else {
      import('hls.js').then(({ default: Hls }) => {
        if (Hls.isSupported()) {
          hlsInstance = new Hls();
          hlsInstance.loadSource(src);
          hlsInstance.attachMedia(video);
        }
      }).catch(() => {
        video.src = src;
      });
    }

    return () => {
      if (hlsInstance) {
        hlsInstance.destroy();
      }
    };
  }, [src]);

  return (
    <video
      ref={videoRef}
      controls
      playsInline
      className="w-full h-full"
      poster={posterUrl}
    />
  );
};
