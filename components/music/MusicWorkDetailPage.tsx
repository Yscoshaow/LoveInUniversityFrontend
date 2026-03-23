import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  ChevronLeft, Play, Pause, Heart, ListPlus, Star, Clock, Calendar,
  Download, ChevronDown, ChevronRight, Subtitles, Music, Image,
  FileText, Folder, FolderOpen, Sparkles, ExternalLink, Users,
  UserPlus, UserCheck, Check, Plus, X, ZoomIn, Film, ArrowUpDown, Share2,
} from 'lucide-react';
import { ImageLightbox } from '../ui/ImageLightbox';
import { platformShare } from '../../lib/platform-actions';
import {
  useAsmrWorkInfo, useAsmrTracks, useMusicLikeCheck, useToggleMusicLike, useMusicProgress,
  useCheckFollowVA, useFollowVA, useUnfollowVA,
  useCheckFollowCircle, useFollowCircle, useUnfollowCircle,
  useMusicPlaylists, useCreatePlaylist, useAddToPlaylist,
  useWatchLaterPlaylist, useWatchLaterItems, useAddToWatchLater,
} from '../../hooks/useMusic';
import { asmrCoverUrl, asmrProxyUrl } from '../../lib/api';
import type { AsmrTrackNode, AsmrTag, MusicPlayProgress } from '../../types';
import { useMusicPlayer } from './MusicPlayer';

interface MusicWorkDetailPageProps {
  workId: number;
  onBack: () => void;
  onTagClick?: (tagName: string) => void;
  onCircleClick?: (circleId: number, circleName: string) => void;
  onVAClick?: (vaId: string, vaName: string) => void;
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Recursively sort track tree nodes by filename (natural number ordering)
function sortTrackTree(nodes: AsmrTrackNode[]): AsmrTrackNode[] {
  return [...nodes]
    .sort((a, b) => a.title.localeCompare(b.title, undefined, { numeric: true }))
    .map(node => node.type === 'folder' && node.children
      ? { ...node, children: sortTrackTree(node.children) }
      : node
    );
}

// Flatten all files from track tree
function flattenTracks(nodes: AsmrTrackNode[]): AsmrTrackNode[] {
  const result: AsmrTrackNode[] = [];
  for (const node of nodes) {
    if (node.type === 'folder') {
      result.push(...flattenTracks(node.children || []));
    } else {
      result.push(node);
    }
  }
  return result;
}

// Find subtitle for audio
function findSubtitle(audioNode: AsmrTrackNode, allFiles: AsmrTrackNode[]): AsmrTrackNode | undefined {
  return allFiles.find(f => f.type === 'text' && f.title === audioNode.title + '.vtt');
}

/** Hover-activated marquee for long filenames (desktop only) */
function HoverMarqueeText({ text, className }: { text: string; className?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const [hovered, setHovered] = useState(false);
  const [overflows, setOverflows] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    const textEl = textRef.current;
    if (container && textEl) setOverflows(textEl.scrollWidth > container.clientWidth + 1);
  }, [text]);

  const showMarquee = overflows && hovered;

  return (
    <div
      ref={containerRef}
      className="overflow-hidden flex-1 min-w-0"
      onMouseEnter={() => overflows && setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {showMarquee ? (
        <div
          className="inline-flex"
          style={{ animation: `marquee-scroll ${Math.max(text.length * 0.2, 4)}s linear infinite` }}
        >
          <span className={`${className} whitespace-nowrap shrink-0 pr-12`}>{text}</span>
          <span className={`${className} whitespace-nowrap shrink-0 pr-12`} aria-hidden="true">{text}</span>
        </div>
      ) : (
        <span ref={textRef} className={`${className} block truncate`}>{text}</span>
      )}
    </div>
  );
}

/** Recursive file tree node */
function TrackTreeNode({
  node, allFiles, depth, progressMap, onPlayTrack, currentTrackHash, isPlaying,
}: {
  node: AsmrTrackNode;
  allFiles: AsmrTrackNode[];
  depth: number;
  progressMap: Map<string, MusicPlayProgress>;
  onPlayTrack: (track: AsmrTrackNode, subtitle?: AsmrTrackNode) => void;
  currentTrackHash?: string;
  isPlaying: boolean;
}) {
  const [expanded, setExpanded] = useState(depth < 1); // Auto-expand first level
  const [showText, setShowText] = useState(false);
  const [textContent, setTextContent] = useState<string | null>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [showVideo, setShowVideo] = useState(false);

  const isFolder = node.type === 'folder';
  const isAudio = node.type === 'audio';
  const isText = node.type === 'text' && !node.title.endsWith('.vtt');
  const isImage = node.type === 'image';
  const isVideo = (node.type === 'other' || node.type === 'audio') && /\.(mp4|webm|mkv|avi|mov|m4v)$/i.test(node.title);
  const isCurrentTrack = isAudio && !isVideo && node.hash === currentTrackHash;
  const progress = node.hash ? progressMap.get(node.hash) : undefined;
  const progressPercent = progress && progress.duration > 0 ? (progress.currentTime / progress.duration) * 100 : 0;

  const handleTextClick = async () => {
    if (textContent) {
      setShowText(!showText);
      return;
    }
    if (node.mediaStreamUrl) {
      try {
        const res = await fetch(asmrProxyUrl(node.mediaStreamUrl));
        const buffer = await res.arrayBuffer();
        let text: string;
        try {
          text = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
        } catch {
          // Not valid UTF-8, try Shift-JIS (common for Japanese content)
          text = new TextDecoder('shift-jis').decode(buffer);
        }
        setTextContent(text);
        setShowText(true);
      } catch {
        setTextContent('加载失败');
        setShowText(true);
      }
    }
  };

  if (isFolder) {
    return (
      <div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-2 w-full px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition-colors text-left"
          style={{ paddingLeft: `${12 + depth * 16}px` }}
        >
          {expanded ? <FolderOpen size={16} className="text-purple-500 dark:text-purple-400 shrink-0" /> : <Folder size={16} className="text-purple-400 shrink-0" />}
          <HoverMarqueeText text={node.title} className="text-sm font-medium text-slate-700 dark:text-slate-200" />
          <ChevronDown size={14} className={`text-slate-400 dark:text-slate-500 transition-transform ${expanded ? '' : '-rotate-90'}`} />
        </button>
        {expanded && node.children?.map((child, i) => (
          <TrackTreeNode
            key={i}
            node={child}
            allFiles={allFiles}
            depth={depth + 1}
            progressMap={progressMap}
            onPlayTrack={onPlayTrack}
            currentTrackHash={currentTrackHash}
            isPlaying={isPlaying}
          />
        ))}
      </div>
    );
  }

  if (isAudio && !isVideo) {
    const subtitle = findSubtitle(node, allFiles);
    return (
      <button
        onClick={() => onPlayTrack(node, subtitle)}
        className={`flex items-center gap-2.5 w-full px-3 py-2.5 rounded-xl transition-colors text-left ${
          isCurrentTrack ? 'bg-purple-50 dark:bg-purple-950' : 'hover:bg-slate-50 dark:hover:bg-slate-800'
        }`}
        style={{ paddingLeft: `${12 + depth * 16}px` }}
      >
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
          isCurrentTrack ? 'bg-purple-500 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500'
        }`}>
          {isCurrentTrack && isPlaying ? <Pause size={14} /> : <Play size={14} className="ml-0.5" />}
        </div>
        <div className="flex-1 min-w-0">
          <HoverMarqueeText text={node.title} className={`text-sm ${isCurrentTrack ? 'text-purple-700 dark:text-purple-400 font-medium' : 'text-slate-700 dark:text-slate-200'}`} />
          <div className="flex items-center gap-2 text-xs text-slate-400 dark:text-slate-500 mt-0.5">
            {node.duration && <span>{formatDuration(node.duration)}</span>}
            {node.size && <span>{formatFileSize(node.size)}</span>}
            {subtitle && <Subtitles size={10} className="text-purple-400" />}
          </div>
          {/* Progress bar */}
          {progressPercent > 0 && (
            <div className="mt-1 h-0.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
              <div className="h-full bg-purple-400 rounded-full" style={{ width: `${Math.min(progressPercent, 100)}%` }} />
            </div>
          )}
        </div>
      </button>
    );
  }

  if (isText) {
    return (
      <div>
        <button
          onClick={handleTextClick}
          className="flex items-center gap-2.5 w-full px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition-colors text-left"
          style={{ paddingLeft: `${12 + depth * 16}px` }}
        >
          <FileText size={16} className="text-blue-400 shrink-0" />
          <HoverMarqueeText text={node.title} className="text-sm text-slate-600 dark:text-slate-300" />
          <ChevronRight size={14} className={`text-slate-300 transition-transform ${showText ? 'rotate-90' : ''}`} />
        </button>
        {showText && textContent && (
          <div className="mx-4 mb-2 p-3 bg-slate-50 dark:bg-slate-900 rounded-xl text-xs text-slate-600 dark:text-slate-300 whitespace-pre-wrap max-h-60 overflow-y-auto font-mono"
            style={{ marginLeft: `${16 + depth * 16}px` }}
          >
            {textContent}
          </div>
        )}
      </div>
    );
  }

  if (isImage) {
    const imageUrl = node.mediaDownloadUrl || (node.mediaStreamUrl ? asmrProxyUrl(node.mediaStreamUrl) : '');
    return (
      <div>
        <button
          onClick={() => imageUrl ? setLightboxOpen(true) : undefined}
          className="flex items-center gap-2.5 w-full px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition-colors text-left"
          style={{ paddingLeft: `${12 + depth * 16}px` }}
        >
          <Image size={16} className="text-green-400 shrink-0" />
          <HoverMarqueeText text={node.title} className="text-sm text-slate-600 dark:text-slate-300" />
          {imageUrl && <ZoomIn size={14} className="text-slate-300 shrink-0" />}
        </button>
        {lightboxOpen && imageUrl && createPortal(
          <ImageLightbox
            images={[{ imageUrl }]}
            onClose={() => setLightboxOpen(false)}
          />,
          document.body
        )}
      </div>
    );
  }

  if (isVideo) {
    const videoUrl = node.mediaDownloadUrl || (node.mediaStreamUrl ? asmrProxyUrl(node.mediaStreamUrl) : '');
    return (
      <div>
        <button
          onClick={() => videoUrl && setShowVideo(!showVideo)}
          className="flex items-center gap-2.5 w-full px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition-colors text-left"
          style={{ paddingLeft: `${12 + depth * 16}px` }}
        >
          <Film size={16} className="text-orange-400 shrink-0" />
          <HoverMarqueeText text={node.title} className="text-sm text-slate-600 dark:text-slate-300" />
          <span className="text-xs text-slate-400 dark:text-slate-500 shrink-0">{node.size ? formatFileSize(node.size) : ''}</span>
          <ChevronRight size={14} className={`text-slate-300 transition-transform ${showVideo ? 'rotate-90' : ''}`} />
        </button>
        {showVideo && videoUrl && (
          <div
            className="mx-4 mb-2 rounded-xl overflow-hidden bg-black"
            style={{ marginLeft: `${16 + depth * 16}px` }}
          >
            <video
              src={videoUrl}
              controls
              playsInline
              className="w-full max-h-80"
            />
          </div>
        )}
      </div>
    );
  }

  return null;
}

const MusicWorkDetailPage: React.FC<MusicWorkDetailPageProps> = ({ workId, onBack, onTagClick, onCircleClick, onVAClick }) => {
  const { data: work, isLoading: workLoading } = useAsmrWorkInfo(workId);
  const { data: tracks, isLoading: tracksLoading } = useAsmrTracks(workId);
  const { data: likeStatus } = useMusicLikeCheck(workId);
  const { data: progressList } = useMusicProgress(workId);
  const toggleLike = useToggleMusicLike();
  const player = useMusicPlayer();

  // Follow hooks
  const circleId = work?.circle?.id ?? null;
  const circleName = work?.circle?.name ?? '';
  const firstVA = work?.vas?.[0];
  const vaId = firstVA?.id ?? null;
  const vaName = firstVA?.name ?? '';

  const { data: vaFollowStatus } = useCheckFollowVA(vaId);
  const followVA = useFollowVA();
  const unfollowVA = useUnfollowVA();
  const { data: circleFollowStatus } = useCheckFollowCircle(circleId);
  const followCircle = useFollowCircle();
  const unfollowCircle = useUnfollowCircle();

  // Playlist hooks
  const playlistsQuery = useMusicPlaylists();
  const createPlaylist = useCreatePlaylist();
  const addToPlaylist = useAddToPlaylist();
  const watchLaterQuery = useWatchLaterPlaylist();
  const watchLaterItemsQuery = useWatchLaterItems();
  const addToWatchLater = useAddToWatchLater();
  const [showPlaylistSheet, setShowPlaylistSheet] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');

  const [imgError, setImgError] = useState(false);
  const [sortByName, setSortByName] = useState(true);

  // Title marquee overflow detection
  const titleContainerRef = useRef<HTMLDivElement>(null);
  const titleTextRef = useRef<HTMLHeadingElement>(null);
  const [titleOverflows, setTitleOverflows] = useState(false);

  useEffect(() => {
    const container = titleContainerRef.current;
    const text = titleTextRef.current;
    if (!container || !text) return;
    const check = () => setTitleOverflows(text.scrollWidth > container.clientWidth + 1);
    check();
    const ro = new ResizeObserver(check);
    ro.observe(container);
    return () => ro.disconnect();
  }, [work?.title]);

  // Build progress map: trackHash → MusicPlayProgress
  const progressMap = useMemo(() => {
    const map = new Map<string, MusicPlayProgress>();
    progressList?.forEach(p => map.set(p.trackHash, p));
    return map;
  }, [progressList]);

  // Sort tree then flatten — sorting propagates to both tree display and playlist
  const displayTracks = useMemo(() => sortByName && tracks ? sortTrackTree(tracks) : tracks, [tracks, sortByName]);
  const allFiles = useMemo(() => displayTracks ? flattenTracks(displayTracks) : [], [displayTracks]);
  const audioFiles = useMemo(() => allFiles.filter(f => f.type === 'audio' && !/\.(mp4|webm|mkv|avi|mov|m4v)$/i.test(f.title)), [allFiles]);

  const handlePlayTrack = useCallback((track: AsmrTrackNode, subtitle?: AsmrTrackNode) => {
    if (!work || !track.hash) return;
    // If clicking current track, toggle play/pause
    if (player.currentTrack?.hash === track.hash) {
      player.toggle();
      return;
    }
    // Play the track and set up the work's audio list as playlist
    const playlist = audioFiles.map(af => ({
      hash: af.hash!,
      title: af.title,
      duration: af.duration || 0,
      // Prefer mediaDownloadUrl (OSS, no CORS) for audio, proxy for others
      audioUrl: af.mediaDownloadUrl || asmrProxyUrl(af.mediaStreamUrl || ''),
      subtitleUrl: (() => {
        const sub = findSubtitle(af, allFiles);
        return sub?.mediaStreamUrl ? asmrProxyUrl(sub.mediaStreamUrl) : undefined;
      })(),
      workId: work.id,
      workTitle: work.title,
      coverUrl: asmrCoverUrl(work.id, 'main'),
    }));

    const trackIndex = playlist.findIndex(t => t.hash === track.hash);
    player.setPlaylist(playlist, trackIndex >= 0 ? trackIndex : 0);
  }, [work, audioFiles, allFiles, player]);

  const handlePlayAll = useCallback(() => {
    if (!work || audioFiles.length === 0) return;
    const playlist = audioFiles.map(af => ({
      hash: af.hash!,
      title: af.title,
      duration: af.duration || 0,
      audioUrl: af.mediaDownloadUrl || asmrProxyUrl(af.mediaStreamUrl || ''),
      subtitleUrl: (() => {
        const sub = findSubtitle(af, allFiles);
        return sub?.mediaStreamUrl ? asmrProxyUrl(sub.mediaStreamUrl) : undefined;
      })(),
      workId: work.id,
      workTitle: work.title,
      coverUrl: asmrCoverUrl(work.id, 'main'),
    }));
    player.setPlaylist(playlist, 0);
  }, [work, audioFiles, allFiles, player]);

  if (workLoading) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-50 dark:bg-slate-900">
        <div className="animate-pulse text-slate-400 dark:text-slate-500">加载中...</div>
      </div>
    );
  }

  if (!work) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-900 px-6">
        <p className="text-slate-400 dark:text-slate-500 mb-4">作品不存在</p>
        <button onClick={onBack} className="text-purple-600 dark:text-purple-400 text-sm font-medium">返回</button>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-slate-50/80 dark:bg-slate-900/80 lg:max-w-300 lg:mx-auto lg:w-full">
      {/* Desktop back button */}
      <button onClick={onBack} className="hidden lg:flex items-center gap-1 px-6 pt-4 pb-1 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors self-start">
        <ChevronLeft size={18} />
        <span>返回</span>
      </button>

      {/* Desktop: left-right split; Mobile: vertical stack */}
      <div className="flex-1 min-h-0 flex flex-col lg:flex-row">

      {/* ── Left Panel: Info ── */}
      <div className="lg:flex-1 lg:max-h-full lg:overflow-y-auto lg:border-r lg:border-slate-200/50 dark:border-slate-700/50 lg:flex lg:flex-col lg:justify-center">

      {/* Blurred cover background */}
      <div className="relative">
        {/* Background blur */}
        <div className="absolute inset-0 overflow-hidden">
          {!imgError && (
            <img
              src={asmrCoverUrl(work.id, 'main')}
              alt=""
              className="w-full h-full object-cover blur-3xl scale-110 opacity-30"
              onError={() => setImgError(true)}
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-b from-white/60 to-slate-50 dark:from-slate-800/60 dark:to-slate-900" />
        </div>

        {/* Content */}
        <div className="relative z-10 px-4 pt-2 lg:pt-6 lg:px-6 pb-4">
          {/* Back button (mobile only) */}
          <button onClick={onBack} className="p-1.5 -ml-1.5 mb-3 hover:bg-black/5 rounded-full transition-colors lg:hidden">
            <ChevronLeft size={24} className="text-slate-700 dark:text-slate-200" />
          </button>

          {/* Hero section */}
          <div className="flex gap-4 lg:flex-col lg:items-center lg:gap-5">
            {/* Cover */}
            <div className="w-32 h-32 lg:w-56 lg:h-56 xl:w-64 xl:h-64 rounded-2xl overflow-hidden shadow-lg shrink-0 bg-gradient-to-br from-purple-100 to-indigo-100 dark:to-indigo-900">
              {!imgError ? (
                <img
                  src={asmrCoverUrl(work.id, 'main')}
                  alt={work.title}
                  className="w-full h-full object-cover"
                  onError={() => setImgError(true)}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Sparkles size={40} className="text-purple-300" />
                </div>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0 pt-1 lg:text-center lg:pt-0 lg:w-full">
              <div ref={titleContainerRef} className={`overflow-hidden mb-1.5 ${!titleOverflows ? 'lg:text-center' : ''}`}>
                <div
                  className={titleOverflows ? 'inline-flex hover:paused' : ''}
                  style={titleOverflows ? {
                    animation: `marquee-scroll ${Math.max(work.title.length * 0.3, 8)}s linear infinite`,
                  } : undefined}
                >
                  <h1 ref={titleTextRef} className="text-lg lg:text-2xl font-bold text-slate-800 dark:text-slate-100 leading-tight whitespace-nowrap shrink-0 pr-16">
                    {work.title}
                  </h1>
                  {titleOverflows && (
                    <h1 className="text-lg lg:text-2xl font-bold text-slate-800 dark:text-slate-100 leading-tight whitespace-nowrap shrink-0 pr-16" aria-hidden="true">
                      {work.title}
                    </h1>
                  )}
                </div>
              </div>
              <p className="text-xs text-slate-400 dark:text-slate-500 font-mono mb-1 lg:text-center">{work.source_id}</p>
              <div className="flex items-center gap-2 mb-1 lg:justify-center">
                <button
                  onClick={() => circleId && onCircleClick?.(circleId, circleName)}
                  className="text-sm text-purple-600 dark:text-purple-400 font-medium truncate hover:underline"
                >
                  {work.circle?.name}
                </button>
                {circleId && (
                  <button
                    onClick={() => {
                      if (circleFollowStatus?.following) {
                        unfollowCircle.mutate(circleId);
                      } else {
                        followCircle.mutate({ circleId, circleName });
                      }
                    }}
                    disabled={followCircle.isPending || unfollowCircle.isPending}
                    className={`shrink-0 flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-medium transition-colors ${
                      circleFollowStatus?.following
                        ? 'bg-purple-100 text-purple-600 dark:text-purple-400'
                        : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:bg-purple-50 dark:bg-purple-950 hover:text-purple-500 dark:text-purple-400'
                    }`}
                  >
                    {circleFollowStatus?.following ? <Check size={10} /> : <Plus size={10} />}
                    {circleFollowStatus?.following ? '已关注' : '关注'}
                  </button>
                )}
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 lg:justify-center">
                {work.rate_count > 0 && (
                  <span className="flex items-center gap-0.5">
                    <Star size={12} className="text-amber-400 dark:text-amber-300 fill-amber-400" />
                    {work.rate_average_2dp} ({work.rate_count})
                  </span>
                )}
                {work.duration > 0 && (
                  <span className="flex items-center gap-0.5">
                    <Clock size={12} />
                    {formatDuration(work.duration)}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-400 dark:text-slate-500 mt-1 lg:justify-center">
                <Calendar size={11} />
                <span>{formatDate(work.release)}</span>
                <Download size={11} />
                <span>{work.dl_count}</span>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2.5 mt-4 lg:mt-5 lg:justify-center">
            <button
              onClick={handlePlayAll}
              disabled={audioFiles.length === 0}
              className="flex-1 flex items-center justify-center gap-1.5 bg-purple-600 text-white py-2.5 rounded-xl font-medium text-sm shadow-sm hover:bg-purple-700 transition-colors disabled:opacity-40"
            >
              <Play size={16} className="ml-0.5" />
              全部播放 ({audioFiles.length})
            </button>
            <button
              onClick={() => toggleLike.mutate(workId)}
              disabled={toggleLike.isPending}
              className={`p-2.5 rounded-xl border transition-colors ${
                likeStatus?.liked
                  ? 'bg-pink-50 dark:bg-pink-950 border-pink-200 text-pink-500 dark:text-pink-400'
                  : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500 hover:text-pink-500 dark:text-pink-400'
              }`}
            >
              <Heart size={20} className={likeStatus?.liked ? 'fill-current' : ''} />
            </button>
            <button
              onClick={() => setShowPlaylistSheet(true)}
              className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-400 dark:text-slate-500 hover:text-purple-500 dark:text-purple-400 transition-colors"
            >
              <ListPlus size={20} />
            </button>
            <button
              onClick={() => {
                platformShare({
                  text: `来听听「${work.title}」— ${work.circle?.name || '未知'}`,
                  url: `https://t.me/lovein_university_bot/university?startapp=music_${workId}`,
                });
              }}
              className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-400 dark:text-slate-500 hover:text-purple-500 dark:text-purple-400 transition-colors"
            >
              <Share2 size={20} />
            </button>
          </div>
        </div>
      </div>

      {/* Tags */}
      {work.tags?.length > 0 && (
        <div className="px-4 py-2 flex flex-wrap gap-1.5 lg:justify-center">
          {work.tags.map(tag => {
            const label = tag.i18n?.['zh-cn']?.name || tag.name;
            return (
              <button
                key={tag.id}
                onClick={() => onTagClick?.(label)}
                className="bg-purple-50 dark:bg-purple-950 text-purple-600 dark:text-purple-400 text-xs px-2.5 py-1 rounded-full hover:bg-purple-100 dark:hover:bg-purple-900 active:scale-95 transition-all"
              >
                {label}
              </button>
            );
          })}
        </div>
      )}

      {/* VAs */}
      {work.vas?.length > 0 && (
        <div className="px-4 py-1.5 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 lg:justify-center">
          <Users size={12} className="text-slate-400 dark:text-slate-500 shrink-0" />
          <span className="truncate">
            {work.vas.map((v, i) => (
              <React.Fragment key={v.id}>
                {i > 0 && ', '}
                <button
                  onClick={() => onVAClick?.(v.id, v.name)}
                  className="hover:underline hover:text-purple-500 dark:text-purple-400 transition-colors"
                >
                  {v.name}
                </button>
              </React.Fragment>
            ))}
          </span>
          {vaId && (
            <button
              onClick={() => {
                if (vaFollowStatus?.following) {
                  unfollowVA.mutate(vaId);
                } else {
                  followVA.mutate({ vaId, vaName });
                }
              }}
              disabled={followVA.isPending || unfollowVA.isPending}
              className={`shrink-0 flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-medium transition-colors ${
                vaFollowStatus?.following
                  ? 'bg-purple-100 text-purple-600 dark:text-purple-400'
                  : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:bg-purple-50 dark:bg-purple-950 hover:text-purple-500 dark:text-purple-400'
              }`}
            >
              {vaFollowStatus?.following ? <Check size={10} /> : <Plus size={10} />}
              {vaFollowStatus?.following ? '已关注' : '关注'}
            </button>
          )}
        </div>
      )}

      </div>{/* end Left Panel */}

      {/* ── Right Panel: Track Tree ── */}
      <div className="flex-1 overflow-y-auto px-2 pb-24 lg:pb-8 lg:px-4 lg:self-stretch">
        <div className="px-2 py-2 flex items-center justify-between">
          <h2 className="text-sm lg:text-base font-semibold text-slate-700 dark:text-slate-200 px-1">
            文件 {tracksLoading && '(加载中...)'}
          </h2>
          <button
            onClick={() => setSortByName(v => !v)}
            className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs transition-colors ${
              sortByName ? 'bg-purple-50 dark:bg-purple-950 text-purple-600 dark:text-purple-400' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
            }`}
          >
            <ArrowUpDown size={12} />
            {sortByName ? '按名称' : '默认'}
          </button>
        </div>

        {displayTracks && displayTracks.length > 0 ? (
          <div className="space-y-0.5">
            {displayTracks.map((node, i) => (
              <TrackTreeNode
                key={i}
                node={node}
                allFiles={allFiles}
                depth={0}
                progressMap={progressMap}
                onPlayTrack={handlePlayTrack}
                currentTrackHash={player.currentTrack?.hash}
                isPlaying={player.playing}
              />
            ))}
          </div>
        ) : !tracksLoading ? (
          <div className="text-center py-8 text-slate-400 dark:text-slate-500 text-sm">暂无文件</div>
        ) : null}
      </div>{/* end Right Panel */}

      </div>{/* end Split Container */}

      {/* Add to Playlist bottom sheet — portal to escape transform stacking context */}
      {showPlaylistSheet && createPortal(
        <div className="fixed inset-0 bg-black/40 z-70 flex items-end justify-center lg:items-center" onClick={() => setShowPlaylistSheet(false)}>
          <div
            className="bg-white dark:bg-slate-800 w-full max-w-lg rounded-t-2xl lg:rounded-2xl animate-in slide-in-from-bottom duration-300 max-h-[70vh] flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-slate-100 dark:border-slate-700">
              <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">添加到歌单</h3>
              <button onClick={() => setShowPlaylistSheet(false)} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full">
                <X size={18} className="text-slate-400 dark:text-slate-500" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {/* Watch Later special entry */}
              {(() => {
                const isInWatchLater = watchLaterItemsQuery.data?.some(
                  (item: { asmrWorkId: number }) => item.asmrWorkId === workId
                );
                return (
                  <button
                    onClick={() => {
                      if (isInWatchLater) return;
                      addToWatchLater.mutate(workId, {
                        onSuccess: () => setShowPlaylistSheet(false),
                      });
                    }}
                    disabled={addToWatchLater.isPending || isInWatchLater}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors text-left active:scale-[0.98] mb-2 ${
                      isInWatchLater
                        ? 'bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800'
                        : 'bg-amber-50 dark:bg-amber-950 hover:bg-amber-100 dark:hover:bg-amber-900 border border-amber-200/60 dark:border-amber-800/60'
                    }`}
                  >
                    <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
                      <Clock size={16} className="text-amber-500 dark:text-amber-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-amber-700 dark:text-amber-400">稍后再听</p>
                      <p className="text-xs text-amber-500 dark:text-amber-400">
                        {isInWatchLater ? '已添加' : `${watchLaterQuery.data?.itemCount ?? 0} 首 · 听完自动移除`}
                      </p>
                    </div>
                    {isInWatchLater && <Check size={16} className="text-amber-500 dark:text-amber-400 shrink-0" />}
                  </button>
                );
              })()}

              {/* New playlist inline */}
              <div className="flex gap-2 mb-3">
                <input
                  type="text"
                  value={newPlaylistName}
                  onChange={e => setNewPlaylistName(e.target.value)}
                  placeholder="新建歌单..."
                  className="flex-1 bg-slate-100 dark:bg-slate-700 rounded-xl px-3 py-2.5 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-purple-300"
                />
                <button
                  onClick={() => {
                    if (!newPlaylistName.trim()) return;
                    createPlaylist.mutate({ name: newPlaylistName.trim() }, {
                      onSuccess: () => setNewPlaylistName(''),
                    });
                  }}
                  disabled={!newPlaylistName.trim() || createPlaylist.isPending}
                  className="px-4 py-2.5 rounded-xl bg-purple-600 text-white text-sm font-medium disabled:opacity-50 shrink-0"
                >
                  <Plus size={16} />
                </button>
              </div>

              {playlistsQuery.isLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="h-12 bg-slate-100 dark:bg-slate-700 rounded-xl animate-pulse" />
                  ))}
                </div>
              ) : (playlistsQuery.data || []).length > 0 ? (
                (playlistsQuery.data || []).map(pl => (
                  <button
                    key={pl.id}
                    onClick={() => {
                      addToPlaylist.mutate({ playlistId: pl.id, asmrWorkId: workId }, {
                        onSuccess: () => setShowPlaylistSheet(false),
                      });
                    }}
                    disabled={addToPlaylist.isPending}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-left active:scale-[0.98]"
                  >
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-100 to-indigo-100 dark:to-indigo-900 flex items-center justify-center shrink-0">
                      <ListPlus size={16} className="text-purple-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">{pl.name}</p>
                      <p className="text-xs text-slate-400 dark:text-slate-500">{pl.itemCount} 首</p>
                    </div>
                  </button>
                ))
              ) : (
                <p className="text-center text-sm text-slate-400 dark:text-slate-500 py-6">还没有歌单，在上方输入名称创建</p>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default MusicWorkDetailPage;
