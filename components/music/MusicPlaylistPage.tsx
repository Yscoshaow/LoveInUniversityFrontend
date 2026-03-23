import React, { useState, useCallback } from 'react';
import {
  ChevronLeft, Play, Music, Trash2, MoreHorizontal, Pencil, Clock, Loader2, Share2,
} from 'lucide-react';
import { usePlaylistItems, useRemoveFromPlaylist, useUpdatePlaylist, useDeletePlaylist, useSharePlaylist, useUnsharePlaylist } from '../../hooks/useMusic';
import { asmrCoverUrl, asmrProxyUrl, asmrApi } from '../../lib/api';
import type { MusicPlaylist, AsmrTrackNode } from '../../types';
import { useMusicPlayer, type MusicTrack } from './MusicPlayer';

interface MusicPlaylistPageProps {
  playlist: MusicPlaylist;
  onBack: () => void;
  onWorkClick: (workId: number) => void;
  onPlayAll?: (workIds: number[]) => void;
  onDeleted?: () => void;
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h${m}m`;
  return `${m}m`;
}

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

function findSubtitle(audioNode: AsmrTrackNode, allFiles: AsmrTrackNode[]): AsmrTrackNode | undefined {
  return allFiles.find(f => f.type === 'text' && f.title === audioNode.title + '.vtt');
}

const MusicPlaylistPage: React.FC<MusicPlaylistPageProps> = ({
  playlist, onBack, onWorkClick, onDeleted,
}) => {
  const { data: items, isLoading } = usePlaylistItems(playlist.id);
  const removeFromPlaylist = useRemoveFromPlaylist();
  const updatePlaylist = useUpdatePlaylist();
  const deletePlaylist = useDeletePlaylist();
  const player = useMusicPlayer();

  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(playlist.name);
  const [editDesc, setEditDesc] = useState(playlist.description || '');
  const [showMenu, setShowMenu] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [playAllLoading, setPlayAllLoading] = useState(false);
  const [showShareSheet, setShowShareSheet] = useState(false);
  const [copiedShare, setCopiedShare] = useState(false);
  const sharePlaylist = useSharePlaylist();
  const unsharePlaylist = useUnsharePlaylist();

  const handlePlayAll = useCallback(async () => {
    if (!items || items.length === 0 || playAllLoading) return;
    setPlayAllLoading(true);
    try {
      const trackResults = await Promise.all(
        items.map(item => asmrApi.getTracks(item.asmrWorkId).catch(() => [] as AsmrTrackNode[]))
      );
      const allMusicTracks: MusicTrack[] = [];
      for (let i = 0; i < items.length; i++) {
        const workId = items[i].asmrWorkId;
        const allFiles = flattenTracks(trackResults[i]);
        const audioFiles = allFiles.filter(f => f.type === 'audio' && f.hash);
        for (const af of audioFiles) {
          const sub = findSubtitle(af, allFiles);
          allMusicTracks.push({
            hash: af.hash!,
            title: af.title,
            duration: af.duration || 0,
            audioUrl: af.mediaDownloadUrl || asmrProxyUrl(af.mediaStreamUrl || ''),
            subtitleUrl: sub?.mediaStreamUrl ? asmrProxyUrl(sub.mediaStreamUrl) : undefined,
            workId,
            workTitle: `RJ${String(workId).padStart(8, '0')}`,
            coverUrl: asmrCoverUrl(workId, 'main'),
            ...(playlist.type === 'WATCH_LATER' ? { isWatchLater: true } : {}),
          });
        }
      }
      if (allMusicTracks.length > 0) {
        player.setPlaylist(allMusicTracks, 0);
      }
    } catch (e) {
      console.error('Failed to load playlist tracks', e);
    } finally {
      setPlayAllLoading(false);
    }
  }, [items, playAllLoading, player]);

  const handleSaveEdit = useCallback(() => {
    if (!editName.trim()) return;
    updatePlaylist.mutate({ id: playlist.id, name: editName.trim(), description: editDesc.trim() || undefined }, {
      onSuccess: () => setIsEditing(false),
    });
  }, [editName, editDesc, playlist.id, updatePlaylist]);

  const handleDelete = useCallback(() => {
    deletePlaylist.mutate(playlist.id, {
      onSuccess: () => onDeleted?.(),
    });
  }, [playlist.id, deletePlaylist, onDeleted]);

  const handleRemoveItem = useCallback((workId: number) => {
    removeFromPlaylist.mutate({ playlistId: playlist.id, asmrWorkId: workId });
  }, [playlist.id, removeFromPlaylist]);

  // Cover mosaic: first 4 work covers
  const coverIds = (items || []).slice(0, 4).map(i => i.asmrWorkId);

  return (
    <div className="h-full flex flex-col bg-slate-50/80 dark:bg-slate-900/80 lg:max-w-225 lg:mx-auto lg:w-full">
      {/* Header */}
      <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl border-b border-slate-200/60 dark:border-slate-700/60">
        <div className="px-4 pt-2 pb-3">
          <div className="flex items-center justify-between mb-3">
            <button onClick={onBack} className="p-1.5 -ml-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors lg:hidden">
              <ChevronLeft size={24} className="text-slate-700 dark:text-slate-200" />
            </button>
            {playlist.type !== 'WATCH_LATER' && (
              <div className="relative">
                <button
                  onClick={() => setShowMenu(!showMenu)}
                  className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors"
                >
                  <MoreHorizontal size={20} className="text-slate-500 dark:text-slate-400" />
                </button>
                {showMenu && (
                  <div className="absolute right-0 top-10 bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 py-1 z-50 min-w-[140px]">
                    <button
                      onClick={() => { setShowMenu(false); setIsEditing(true); }}
                      className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                    >
                      <Pencil size={14} />
                      编辑歌单
                    </button>
                    <button
                      onClick={() => { setShowMenu(false); setShowShareSheet(true); }}
                      className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                    >
                      <Share2 size={14} />
                      {playlist.shareCode ? '分享设置' : '分享歌单'}
                    </button>
                    <button
                      onClick={() => { setShowMenu(false); setConfirmDelete(true); }}
                      className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950"
                    >
                      <Trash2 size={14} />
                      删除歌单
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Playlist info */}
          <div className="flex gap-4">
            {/* Cover mosaic */}
            <div className={`w-28 h-28 lg:w-36 lg:h-36 rounded-2xl overflow-hidden shadow-md shrink-0 ${
              playlist.type === 'WATCH_LATER'
                ? 'bg-gradient-to-br from-amber-100 to-amber-200 flex items-center justify-center'
                : 'bg-gradient-to-br from-purple-100 to-indigo-100 dark:to-indigo-900 grid grid-cols-2 grid-rows-2'
            }`}>
              {playlist.type === 'WATCH_LATER' ? (
                <Clock size={40} className="text-amber-500 dark:text-amber-400" />
              ) : coverIds.length > 0 ? coverIds.map((id, i) => (
                <img
                  key={id}
                  src={asmrCoverUrl(id, 'main')}
                  alt=""
                  className="w-full h-full object-cover"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              )) : (
                <div className="col-span-2 row-span-2 flex items-center justify-center">
                  <Music size={36} className="text-purple-300" />
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0 pt-1">
              <h1 className={`text-lg lg:text-xl font-bold line-clamp-2 leading-tight mb-1 ${
                playlist.type === 'WATCH_LATER' ? 'text-amber-700 dark:text-amber-400' : 'text-slate-800 dark:text-slate-100'
              }`}>
                {playlist.name}
              </h1>
              {playlist.type === 'WATCH_LATER' ? (
                <p className="text-xs text-amber-500 dark:text-amber-400 mb-1.5">听完自动移除</p>
              ) : playlist.description ? (
                <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mb-1.5">{playlist.description}</p>
              ) : null}
              <p className="text-xs text-slate-400 dark:text-slate-500 mb-2">{playlist.itemCount} 首作品</p>
              {/* Action buttons */}
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePlayAll}
                  disabled={!items || items.length === 0 || playAllLoading}
                  className="flex items-center gap-1.5 px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-xl shadow-sm hover:bg-purple-700 transition-colors disabled:opacity-40"
                >
                  {playAllLoading ? <Loader2 size={15} className="animate-spin" /> : <Play size={15} className="ml-0.5" />}
                  播放全部
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto pb-24 lg:pb-8">
        {isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex gap-3 animate-pulse">
                <div className="w-14 h-14 rounded-xl bg-slate-200 dark:bg-slate-700" />
                <div className="flex-1 py-1 space-y-2">
                  <div className="h-3.5 bg-slate-200 dark:bg-slate-700 rounded w-3/4" />
                  <div className="h-3 bg-slate-100 dark:bg-slate-700 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : items && items.length > 0 ? (
          <div className="p-4 space-y-1">
            {items.map((item, idx) => (
              <PlaylistItemRow
                key={item.id}
                workId={item.asmrWorkId}
                index={idx + 1}
                onClick={() => onWorkClick(item.asmrWorkId)}
                onRemove={() => handleRemoveItem(item.asmrWorkId)}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <Music size={48} className="text-slate-200 mx-auto mb-3" />
            <p className="text-slate-400 dark:text-slate-500 text-sm">歌单还是空的</p>
            <p className="text-slate-300 text-xs mt-1">在作品详情页点击添加到歌单</p>
          </div>
        )}
      </div>

      {/* Edit sheet */}
      {isEditing && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end justify-center lg:items-center" onClick={() => setIsEditing(false)}>
          <div
            className="bg-white dark:bg-slate-800 w-full max-w-lg rounded-t-2xl p-5 animate-in slide-in-from-bottom duration-300 lg:rounded-2xl lg:max-w-md"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 mb-4">编辑歌单</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">名称</label>
                <input
                  type="text"
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  className="w-full bg-slate-100 dark:bg-slate-700 rounded-xl px-3 py-2.5 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-purple-300"
                  autoFocus
                />
              </div>
              <div>
                <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">描述（可选）</label>
                <textarea
                  value={editDesc}
                  onChange={e => setEditDesc(e.target.value)}
                  className="w-full bg-slate-100 dark:bg-slate-700 rounded-xl px-3 py-2.5 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-purple-300 resize-none"
                  rows={3}
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setIsEditing(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-600 dark:text-slate-300"
                >
                  取消
                </button>
                <button
                  onClick={handleSaveEdit}
                  disabled={!editName.trim() || updatePlaylist.isPending}
                  className="flex-1 py-2.5 rounded-xl bg-purple-600 text-white text-sm font-medium disabled:opacity-50"
                >
                  {updatePlaylist.isPending ? '保存中...' : '保存'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-6" onClick={() => setConfirmDelete(false)}>
          <div
            className="bg-white dark:bg-slate-800 rounded-2xl p-5 max-w-sm w-full animate-in zoom-in-95 duration-200"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 mb-2">确认删除</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">确定要删除歌单「{playlist.name}」吗？此操作不可恢复。</p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmDelete(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-600 dark:text-slate-300"
              >
                取消
              </button>
              <button
                onClick={handleDelete}
                disabled={deletePlaylist.isPending}
                className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-sm font-medium disabled:opacity-50"
              >
                {deletePlaylist.isPending ? '删除中...' : '删除'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Share sheet */}
      {showShareSheet && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end justify-center lg:items-center" onClick={() => setShowShareSheet(false)}>
          <div
            className="bg-white dark:bg-slate-800 w-full max-w-lg rounded-t-2xl p-5 animate-in slide-in-from-bottom duration-300 lg:rounded-2xl lg:max-w-md"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 mb-4">分享歌单</h3>
            {playlist.shareCode ? (
              <div className="space-y-3">
                <p className="text-sm text-slate-500 dark:text-slate-400">分享码已生成，发送给好友即可导入：</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-slate-100 dark:bg-slate-700 rounded-xl px-4 py-3 text-center text-lg font-mono font-bold text-purple-600 dark:text-purple-400 tracking-widest select-all">
                    {playlist.shareCode}
                  </code>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(playlist.shareCode!);
                      setCopiedShare(true);
                      setTimeout(() => setCopiedShare(false), 2000);
                    }}
                    className="px-4 py-3 rounded-xl bg-purple-600 text-white text-sm font-medium shrink-0"
                  >
                    {copiedShare ? '已复制' : '复制'}
                  </button>
                </div>
                <button
                  onClick={() => {
                    unsharePlaylist.mutate(playlist.id, {
                      onSuccess: () => setShowShareSheet(false),
                    });
                  }}
                  disabled={unsharePlaylist.isPending}
                  className="w-full py-2.5 text-sm text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950 rounded-xl transition-colors"
                >
                  取消分享
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-slate-500 dark:text-slate-400">生成分享码后，好友可以通过分享码导入你的歌单副本。</p>
                <button
                  onClick={() => {
                    sharePlaylist.mutate(playlist.id, {
                      onSuccess: () => {
                        // playlist object will be refreshed via invalidateQueries
                      },
                    });
                  }}
                  disabled={sharePlaylist.isPending}
                  className="w-full py-2.5 rounded-xl bg-purple-600 text-white text-sm font-medium disabled:opacity-50"
                >
                  {sharePlaylist.isPending ? '生成中...' : '生成分享码'}
                </button>
              </div>
            )}
            <button
              onClick={() => setShowShareSheet(false)}
              className="w-full py-2.5 mt-2 text-sm text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
            >
              关闭
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

/** A single row in the playlist */
function PlaylistItemRow({
  workId, index, onClick, onRemove,
}: {
  workId: number;
  index: number;
  onClick: () => void;
  onRemove: () => void;
}) {
  const [imgError, setImgError] = useState(false);
  const [showDelete, setShowDelete] = useState(false);

  return (
    <div className="flex items-center gap-3 group">
      <span className="text-xs text-slate-400 dark:text-slate-500 w-5 text-right shrink-0">{index}</span>
      <button
        onClick={onClick}
        className="flex items-center gap-3 flex-1 min-w-0 py-2 px-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-left"
      >
        <div className="w-12 h-12 rounded-lg overflow-hidden bg-gradient-to-br from-purple-100 to-indigo-100 dark:to-indigo-900 shrink-0">
          {!imgError ? (
            <img
              src={asmrCoverUrl(workId, 'main')}
              alt={`RJ${String(workId).padStart(8, '0')}`}
              className="w-full h-full object-cover"
              loading="lazy"
              onError={() => setImgError(true)}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Music size={16} className="text-purple-300" />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">
            RJ{String(workId).padStart(8, '0')}
          </p>
        </div>
      </button>
      <button
        onClick={onRemove}
        className="p-2 text-slate-300 hover:text-red-400 transition-colors lg:opacity-0 lg:group-hover:opacity-100 shrink-0"
      >
        <Trash2 size={16} />
      </button>
    </div>
  );
}

export default MusicPlaylistPage;
