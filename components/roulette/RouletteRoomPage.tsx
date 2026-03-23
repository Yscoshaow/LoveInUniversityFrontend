import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ChevronLeft,
  Dice5,
  Compass,
  User,
  Plus,
  Heart,
  Play,
  Eye,
  Loader2,
  Bookmark,
  Search,
  X,
  Tag,
  Image as ImageIcon,
  Type,
  Edit3,
  Workflow,
  Coins,
} from 'lucide-react';
import { rouletteApi } from '../../lib/api';
import type { RouletteGameSummary, RouletteGameType, ActiveSessionSummary } from '../../types';
import { RouletteGameDetail } from './RouletteGameDetail';
import { RouletteGameEditor } from './RouletteGameEditor';
import { RoulettePlayView } from './RoulettePlayView';
import { WheelGameEditor } from './WheelGameEditor';
import { WheelPlayView } from './WheelPlayView';
import NodeScriptEditor, { type GameMeta } from '../node-editor/NodeScriptEditor';
import NodeScriptPlayerView from '../node-editor/NodeScriptPlayerView';

type RouletteSubPage = 'list' | 'detail' | 'editor' | 'play' | 'wheel-editor' | 'wheel-play' | 'node-editor' | 'node-play';

interface RouletteRoomPageProps {
  onBack: () => void;
}

export const RouletteRoomPage: React.FC<RouletteRoomPageProps> = ({ onBack }) => {
  const [subPage, setSubPage] = useState<RouletteSubPage>('list');
  const [selectedGameId, setSelectedGameId] = useState<number | null>(null);
  const [editingGameId, setEditingGameId] = useState<number | null>(null);
  const editingGameIdRef = useRef<number | null>(null);
  const [playSessionId, setPlaySessionId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'discover' | 'favorites' | 'mine'>('discover');
  const [showTypeSelector, setShowTypeSelector] = useState(false);
  const [wheelGameType, setWheelGameType] = useState<RouletteGameType>('IMAGE_WHEEL');
  const [wheelPlayGame, setWheelPlayGame] = useState<{ id: number; gameType: RouletteGameType; wheelConfig: string; title: string; coverImageUrl: string | null } | null>(null);
  const [nodeEditorMeta, setNodeEditorMeta] = useState<GameMeta | undefined>(undefined);

  // 保持 ref 同步
  useEffect(() => {
    editingGameIdRef.current = editingGameId;
  }, [editingGameId]);

  // Browse state
  const [games, setGames] = useState<RouletteGameSummary[]>([]);
  const [myGames, setMyGames] = useState<RouletteGameSummary[]>([]);
  const [favorites, setFavorites] = useState<RouletteGameSummary[]>([]);
  const [activeSessions, setActiveSessions] = useState<ActiveSessionSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const [myGamesLoading, setMyGamesLoading] = useState(false);
  const [favoritesLoading, setFavoritesLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchTag, setSearchTag] = useState('');
  const sentinelRef = useRef<HTMLDivElement>(null);
  const LIMIT = 20;

  const fetchGames = useCallback(async (reset = false, search?: string, tag?: string) => {
    const currentOffset = reset ? 0 : offset;
    if (reset) {
      setIsLoading(true);
    } else {
      setIsLoadingMore(true);
    }

    try {
      const result = await rouletteApi.listGames(LIMIT, currentOffset, search || undefined, tag || undefined);
      if (reset) {
        setGames(result);
        setOffset(result.length);
      } else {
        setGames(prev => [...prev, ...result]);
        setOffset(currentOffset + result.length);
      }
      setHasMore(result.length >= LIMIT);
    } catch (e) {
      console.error('Failed to fetch games', e);
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, [offset]);

  const fetchMyGames = useCallback(async () => {
    setMyGamesLoading(true);
    try {
      const result = await rouletteApi.listMyGames();
      setMyGames(result);
    } catch (e) {
      console.error('Failed to fetch my games', e);
    } finally {
      setMyGamesLoading(false);
    }
  }, []);

  const fetchFavorites = useCallback(async () => {
    setFavoritesLoading(true);
    try {
      const result = await rouletteApi.listFavorites();
      setFavorites(result);
    } catch (e) {
      console.error('Failed to fetch favorites', e);
    } finally {
      setFavoritesLoading(false);
    }
  }, []);

  const fetchActiveSessions = useCallback(async () => {
    try {
      const result = await rouletteApi.listActiveSessions();
      setActiveSessions(result);
    } catch (e) {
      console.error('Failed to fetch active sessions', e);
    }
  }, []);

  useEffect(() => {
    if (subPage === 'list') {
      fetchActiveSessions();
      if (activeTab === 'discover' && games.length === 0) {
        fetchGames(true);
      } else if (activeTab === 'favorites') {
        fetchFavorites();
      } else if (activeTab === 'mine') {
        fetchMyGames();
      }
    }
  }, [activeTab, subPage]);

  // Infinite scroll
  useEffect(() => {
    if (activeTab !== 'discover' || !hasMore || isLoading || isLoadingMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasMore && !isLoadingMore) {
          fetchGames(false);
        }
      },
      { rootMargin: '200px' }
    );
    const el = sentinelRef.current;
    if (el) observer.observe(el);
    return () => observer.disconnect();
  }, [activeTab, hasMore, isLoading, isLoadingMore]);

  const handleViewGame = (gameId: number) => {
    setSelectedGameId(gameId);
    setSubPage('detail');
  };

  const handleCreateGame = () => {
    setShowTypeSelector(true);
  };

  const handleSelectGameType = (type: RouletteGameType) => {
    setShowTypeSelector(false);
    setEditingGameId(null);
    if (type === 'GRAPH') {
      setSubPage('editor');
    } else if (type === 'NODE_SCRIPT') {
      setNodeEditorMeta(undefined); // 新游戏无初始 meta
      setSubPage('node-editor');
    } else {
      setWheelGameType(type);
      setSubPage('wheel-editor');
    }
  };

  const handleEditGame = (gameId: number, gameType?: RouletteGameType) => {
    setEditingGameId(gameId);
    if (gameType === 'NODE_SCRIPT') {
      // 异步加载游戏元数据
      setNodeEditorMeta(undefined);
      rouletteApi.getGame(gameId).then((game) => {
        setNodeEditorMeta({
          title: game.title || '',
          description: game.description || '',
          coverImageUrl: game.coverImageUrl || '',
          tags: game.tags || [],
        });
      }).catch(() => {});
      setSubPage('node-editor');
    } else if (gameType && gameType !== 'GRAPH') {
      setWheelGameType(gameType);
      setSubPage('wheel-editor');
    } else {
      setSubPage('editor');
    }
  };

  const handleStartPlay = (sessionId: number) => {
    setPlaySessionId(sessionId);
    setSubPage('play');
  };

  const handleBackToList = () => {
    setSubPage('list');
    setSelectedGameId(null);
    setEditingGameId(null);
    setPlaySessionId(null);
    setWheelPlayGame(null);
  };

  const handleEditorSaved = () => {
    setSubPage('list');
    setEditingGameId(null);
    fetchGames(true);
    fetchMyGames();
  };

  const handleGameDeleted = () => {
    handleBackToList();
    fetchMyGames();
    fetchGames(true);
  };

  const handleToggleLike = async (gameId: number) => {
    try {
      const result = await rouletteApi.toggleLike(gameId);
      const updateLike = (list: RouletteGameSummary[]) =>
        list.map(g => g.id === gameId ? {
          ...g,
          isLiked: result.isLiked,
          likeCount: g.likeCount + (result.isLiked ? 1 : -1)
        } : g);
      setGames(updateLike);
      setMyGames(updateLike);
      setFavorites(updateLike);
    } catch (e) {
      console.error('Failed to toggle like', e);
    }
  };

  const handleToggleFavorite = async (gameId: number) => {
    try {
      const result = await rouletteApi.toggleFavorite(gameId);
      const updateFav = (list: RouletteGameSummary[]) =>
        list.map(g => g.id === gameId ? { ...g, isFavorited: result.isFavorited } : g);
      setGames(updateFav);
      setMyGames(updateFav);
      if (!result.isFavorited) {
        setFavorites(prev => prev.filter(g => g.id !== gameId));
      } else {
        setFavorites(updateFav);
      }
    } catch (e) {
      console.error('Failed to toggle favorite', e);
    }
  };

  const handleSearch = () => {
    fetchGames(true, searchQuery, searchTag);
  };

  const handleTagFilter = (tag: string) => {
    if (searchTag === tag) {
      setSearchTag('');
      fetchGames(true, searchQuery, '');
    } else {
      setSearchTag(tag);
      fetchGames(true, searchQuery, tag);
    }
  };

  // Sub-page rendering (rendered as overlay to preserve list scroll position)
  const renderSubPage = () => {
    if (subPage === 'detail' && selectedGameId != null) {
      return (
        <RouletteGameDetail
          gameId={selectedGameId}
          onBack={() => setSubPage('list')}
          onStartPlay={handleStartPlay}
          onEdit={(gameType?: RouletteGameType) => handleEditGame(selectedGameId, gameType)}
          onDeleted={handleGameDeleted}
          onStartWheelPlay={(game) => {
            setWheelPlayGame(game);
            setSubPage('wheel-play');
          }}
          onStartScriptPlay={(gId) => {
            setEditingGameId(gId);
            setSubPage('node-play');
          }}
        />
      );
    }

    if (subPage === 'editor') {
      return (
        <RouletteGameEditor
          gameId={editingGameId}
          onBack={() => setSubPage('list')}
          onSaved={handleEditorSaved}
        />
      );
    }

    if (subPage === 'wheel-editor') {
      return (
        <WheelGameEditor
          gameId={editingGameId}
          gameType={wheelGameType}
          onBack={() => setSubPage('list')}
          onSaved={handleEditorSaved}
        />
      );
    }

    if (subPage === 'play' && playSessionId != null) {
      return (
        <RoulettePlayView
          sessionId={playSessionId}
          onBack={handleBackToList}
          onFinished={handleBackToList}
        />
      );
    }

    if (subPage === 'wheel-play' && wheelPlayGame) {
      return (
        <WheelPlayView
          gameId={wheelPlayGame.id}
          gameType={wheelPlayGame.gameType}
          wheelConfig={wheelPlayGame.wheelConfig}
          gameTitle={wheelPlayGame.title}
          coverImageUrl={wheelPlayGame.coverImageUrl}
          onBack={handleBackToList}
        />
      );
    }

    if (subPage === 'node-editor') {
      return (
        <NodeScriptEditor
          gameId={editingGameId ?? 0}
          initialMeta={nodeEditorMeta}
          onSave={async (graphJson, meta) => {
            let gameId = editingGameIdRef.current;
            if (!gameId) {
              const game = await rouletteApi.createGame({
                title: meta.title || '脚本游戏',
                description: meta.description,
                coverImageUrl: meta.coverImageUrl || undefined,
                sections: [],
                specialRules: [],
                tags: meta.tags,
                roundExitEnabled: false,
                gameType: 'NODE_SCRIPT',
              });
              gameId = game.id;
              setEditingGameId(gameId);
              editingGameIdRef.current = gameId;
            } else {
              await rouletteApi.updateGame(gameId, {
                title: meta.title || '脚本游戏',
                description: meta.description,
                coverImageUrl: meta.coverImageUrl || undefined,
                sections: [],
                specialRules: [],
                tags: meta.tags,
                roundExitEnabled: false,
                gameType: 'NODE_SCRIPT',
              });
            }
            await rouletteApi.saveScript(gameId, graphJson);
          }}
          onValidate={async () => {
            if (!editingGameIdRef.current) return { valid: false, errors: [{ message: '请先保存游戏', severity: 'ERROR' }] };
            return rouletteApi.validateScript(editingGameIdRef.current);
          }}
          onPublish={async () => {
            if (editingGameIdRef.current) {
              await rouletteApi.publishScript(editingGameIdRef.current);
            }
          }}
          onBack={handleBackToList}
        />
      );
    }

    if (subPage === 'node-play' && editingGameId) {
      return (
        <NodeScriptPlayerView
          gameId={editingGameId}
          onBack={handleBackToList}
          onFinished={handleBackToList}
          api={{
            startExecution: (gId) => rouletteApi.startScriptExecution(gId),
            getExecution: (eId) => rouletteApi.getScriptExecution(eId),
            submitInput: (eId, input) => rouletteApi.submitScriptInput(eId, input),
            abandonExecution: (eId) => rouletteApi.abandonScriptExecution(eId),
          }}
        />
      );
    }

    return null;
  };

  const activeSubPage = renderSubPage();

  return (
    <>
    {/* Sub-page overlay */}
    {activeSubPage && (
      <div className="absolute inset-0 z-10 bg-slate-50 dark:bg-slate-900">
        {activeSubPage}
      </div>
    )}
    {/* List view - always mounted to preserve scroll */}
    <div className={activeSubPage ? 'invisible h-full' : 'h-full'}>
    <div className="h-full flex flex-col bg-slate-50 dark:bg-slate-900 lg:max-w-[900px] lg:mx-auto lg:w-full">
      {/* Compact Header */}
      <div className="bg-white dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700 px-4 py-3 flex items-center gap-3">
        <button onClick={onBack} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors">
          <ChevronLeft size={20} className="text-slate-600 dark:text-slate-300" />
        </button>
        <h1 className="text-lg font-semibold text-slate-800 dark:text-slate-100 flex-1">游戏室</h1>
        <button
          onClick={handleCreateGame}
          className="w-9 h-9 rounded-full bg-teal-500 flex items-center justify-center hover:bg-teal-600 transition-colors text-white"
        >
          <Plus size={18} />
        </button>
      </div>

      {/* Active sessions banner */}
      {activeSessions.length > 0 && (
        <div className="bg-white dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700 px-4 py-3">
          <div className="flex items-center gap-2 mb-2">
            <Play size={14} className="text-teal-500 dark:text-teal-400" />
            <span className="text-xs font-medium text-slate-600 dark:text-slate-300">进行中的游戏</span>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
            {activeSessions.map(session => (
              <button
                key={session.id}
                onClick={() => handleStartPlay(session.id)}
                className="flex-shrink-0 flex items-center gap-2 bg-teal-50 dark:bg-teal-950 rounded-xl px-3 py-2 hover:bg-teal-100 transition-colors"
              >
                {session.gameCoverImageUrl ? (
                  <img src={session.gameCoverImageUrl} className="w-8 h-8 rounded-lg object-cover" alt="" />
                ) : (
                  <div className="w-8 h-8 rounded-lg bg-teal-500 flex items-center justify-center">
                    <Dice5 size={14} className="text-white" />
                  </div>
                )}
                <div className="text-left">
                  <p className="text-xs font-medium text-slate-700 dark:text-slate-200 truncate max-w-[100px]">{session.gameTitle}</p>
                  <p className="text-[10px] text-teal-600 dark:text-teal-400">{session.currentSectionName}</p>
                </div>
                {session.pendingTaskCount > 0 && (
                  <span className="w-5 h-5 rounded-full bg-rose-500 text-white text-[10px] flex items-center justify-center">
                    {session.pendingTaskCount}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800">
        {([
          { key: 'discover' as const, label: '发现', icon: Compass },
          { key: 'favorites' as const, label: '收藏', icon: Bookmark },
          { key: 'mine' as const, label: '我的', icon: User },
        ]).map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 py-3 text-sm font-medium transition-colors relative ${
              activeTab === tab.key ? 'text-teal-600 dark:text-teal-400' : 'text-slate-400 dark:text-slate-500'
            }`}
          >
            <div className="flex items-center justify-center gap-1.5">
              <tab.icon size={16} />
              {tab.label}
            </div>
            {activeTab === tab.key && (
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-12 h-0.5 bg-teal-500 rounded-full" />
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'discover' && (
          <DiscoverTab
            games={games}
            isLoading={isLoading}
            isLoadingMore={isLoadingMore}
            hasMore={hasMore}
            sentinelRef={sentinelRef}
            searchQuery={searchQuery}
            searchTag={searchTag}
            onSearchChange={setSearchQuery}
            onSearch={handleSearch}
            onTagFilter={handleTagFilter}
            onViewGame={handleViewGame}
            onToggleLike={handleToggleLike}
            onToggleFavorite={handleToggleFavorite}
          />
        )}
        {activeTab === 'favorites' && (
          <FavoritesTab
            games={favorites}
            isLoading={favoritesLoading}
            onViewGame={handleViewGame}
            onToggleLike={handleToggleLike}
            onToggleFavorite={handleToggleFavorite}
          />
        )}
        {activeTab === 'mine' && (
          <MyGamesTab
            games={myGames}
            isLoading={myGamesLoading}
            onViewGame={handleViewGame}
            onEditGame={handleEditGame}
            onCreateGame={handleCreateGame}
          />
        )}
      </div>

      {/* Game Type Selector Modal */}
      {showTypeSelector && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={() => setShowTypeSelector(false)}>
          <div
            className="bg-white dark:bg-slate-800 rounded-t-3xl w-full max-w-lg p-6 pb-8 animate-in slide-in-from-bottom"
            onClick={e => e.stopPropagation()}
          >
            <div className="w-12 h-1 bg-slate-200 dark:bg-slate-700 rounded-full mx-auto mb-4" />
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-4">选择游戏类型</h2>
            <div className="space-y-3">
              <button
                onClick={() => handleSelectGameType('GRAPH')}
                className="w-full flex items-center gap-4 p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-left"
              >
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center">
                  <Dice5 size={24} className="text-white" />
                </div>
                <div>
                  <p className="font-semibold text-slate-800 dark:text-slate-100">图谱游戏</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">包含关卡、任务、骰子的复杂玩法</p>
                </div>
              </button>
              <button
                onClick={() => handleSelectGameType('IMAGE_WHEEL')}
                className="w-full flex items-center gap-4 p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-left"
              >
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-400 to-purple-500 flex items-center justify-center">
                  <ImageIcon size={24} className="text-white" />
                </div>
                <div>
                  <p className="font-semibold text-slate-800 dark:text-slate-100">图片轮盘</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">上传图片，定义分类和点数范围</p>
                </div>
              </button>
              <button
                onClick={() => handleSelectGameType('TEXT_WHEEL')}
                className="w-full flex items-center gap-4 p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-left"
              >
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
                  <Type size={24} className="text-white" />
                </div>
                <div>
                  <p className="font-semibold text-slate-800 dark:text-slate-100">文字轮盘</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">定义分类描述和每个点数的说明</p>
                </div>
              </button>
              <button
                onClick={() => handleSelectGameType('NODE_SCRIPT')}
                className="w-full flex items-center gap-4 p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-left"
              >
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center">
                  <Workflow size={24} className="text-white" />
                </div>
                <div>
                  <p className="font-semibold text-slate-800 dark:text-slate-100">脚本游戏</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">节点式编程，构建复杂交互逻辑</p>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </div>
    </>
  );
};

// ==================== Discover Tab ====================

interface DiscoverTabProps {
  games: RouletteGameSummary[];
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  sentinelRef: React.RefObject<HTMLDivElement | null>;
  searchQuery: string;
  searchTag: string;
  onSearchChange: (q: string) => void;
  onSearch: () => void;
  onTagFilter: (tag: string) => void;
  onViewGame: (id: number) => void;
  onToggleLike: (id: number) => void;
  onToggleFavorite: (id: number) => void;
}

const DiscoverTab: React.FC<DiscoverTabProps> = ({
  games, isLoading, isLoadingMore, hasMore, sentinelRef,
  searchQuery, searchTag, onSearchChange, onSearch, onTagFilter,
  onViewGame, onToggleLike, onToggleFavorite,
}) => {
  const allTags = Array.from(new Set(games.flatMap(g => g.tags || [])));

  return (
    <div className="p-4 space-y-3 lg:max-w-none">
      {/* Search bar */}
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => onSearchChange(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') onSearch(); }}
            placeholder="搜索游戏..."
            className="w-full pl-9 pr-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:border-teal-400 transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => { onSearchChange(''); onSearch(); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"
            >
              <X size={14} />
            </button>
          )}
        </div>
        <button
          onClick={onSearch}
          className="px-3 py-2 bg-teal-500 text-white rounded-xl text-sm font-medium hover:bg-teal-600 transition-colors"
        >
          <Search size={16} />
        </button>
      </div>

      {/* Tag filter chips */}
      {allTags.length > 0 && (
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {allTags.map(tag => (
            <button
              key={tag}
              onClick={() => onTagFilter(tag)}
              className={`flex-shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full text-xs transition-colors ${
                searchTag === tag
                  ? 'bg-teal-500 text-white'
                  : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
              }`}
            >
              <Tag size={10} />
              {tag}
            </button>
          ))}
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="animate-spin text-teal-500 dark:text-teal-400" size={32} />
        </div>
      ) : games.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 px-6">
          <Dice5 size={48} className="text-slate-300 mb-4" />
          <p className="text-slate-500 dark:text-slate-400 text-sm">
            {searchQuery || searchTag ? '没有找到匹配的游戏' : '还没有发布的游戏'}
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            {games.map((game, idx) => {
              // First game with a cover image gets hero treatment
              const isHero = idx === 0 && !!game.coverImageUrl;
              return (
                <GameCard
                  key={game.id}
                  game={game}
                  isHero={isHero}
                  onClick={() => onViewGame(game.id)}
                  onToggleLike={() => onToggleLike(game.id)}
                  onToggleFavorite={() => onToggleFavorite(game.id)}
                />
              );
            })}
          </div>
          <div ref={sentinelRef} className="py-3 flex justify-center">
            {isLoadingMore && <Loader2 className="animate-spin text-teal-500 dark:text-teal-400" size={20} />}
            {!hasMore && games.length > 0 && (
              <p className="text-center text-xs text-slate-300">已加载全部</p>
            )}
          </div>
        </>
      )}
    </div>
  );
};

// ==================== Favorites Tab ====================

interface FavoritesTabProps {
  games: RouletteGameSummary[];
  isLoading: boolean;
  onViewGame: (id: number) => void;
  onToggleLike: (id: number) => void;
  onToggleFavorite: (id: number) => void;
}

const FavoritesTab: React.FC<FavoritesTabProps> = ({
  games, isLoading, onViewGame, onToggleLike, onToggleFavorite,
}) => {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="animate-spin text-teal-500 dark:text-teal-400" size={32} />
      </div>
    );
  }

  if (games.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-6">
        <Bookmark size={48} className="text-slate-300 mb-4" />
        <p className="text-slate-500 dark:text-slate-400 text-sm">还没有收藏的游戏</p>
        <p className="text-slate-400 dark:text-slate-500 text-xs mt-1">在游戏卡片上点击书签图标即可收藏</p>
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="grid grid-cols-2 gap-3">
        {games.map(game => (
          <GameCard
            key={game.id}
            game={game}
            onClick={() => onViewGame(game.id)}
            onToggleLike={() => onToggleLike(game.id)}
            onToggleFavorite={() => onToggleFavorite(game.id)}
          />
        ))}
      </div>
    </div>
  );
};

// ==================== My Games Tab ====================

interface MyGamesTabProps {
  games: RouletteGameSummary[];
  isLoading: boolean;
  onViewGame: (id: number) => void;
  onEditGame: (id: number, gameType?: RouletteGameType) => void;
  onCreateGame: () => void;
}

const MyGamesTab: React.FC<MyGamesTabProps> = ({
  games, isLoading, onViewGame, onEditGame, onCreateGame,
}) => {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="animate-spin text-teal-500 dark:text-teal-400" size={32} />
      </div>
    );
  }

  if (games.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-6">
        <Dice5 size={48} className="text-slate-300 mb-4" />
        <p className="text-slate-500 dark:text-slate-400 text-sm mb-4">你还没有创建过游戏</p>
        <button
          onClick={onCreateGame}
          className="px-4 py-2 bg-teal-500 text-white rounded-xl text-sm font-medium hover:bg-teal-600 transition-colors"
        >
          创建游戏
        </button>
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="grid grid-cols-2 gap-3">
        {games.map(game => {
          const hasImage = !!game.coverImageUrl;
          const typeConfig = GAME_TYPE_CONFIG[game.gameType] || GAME_TYPE_CONFIG.GRAPH;
          const TypeIcon = typeConfig.icon;

          return (
            <div
              key={game.id}
              className="rounded-2xl overflow-hidden shadow-sm border border-slate-50 dark:border-slate-700 hover:shadow-md transition-all flex flex-col"
            >
              {/* Cover area */}
              <div
                className={`relative cursor-pointer ${hasImage ? 'aspect-[3/4]' : 'aspect-square'}`}
                onClick={() => onViewGame(game.id)}
              >
                {hasImage ? (
                  <img src={game.coverImageUrl!} alt={game.title} className="w-full h-full object-cover" />
                ) : (
                  <div className={`w-full h-full bg-gradient-to-br ${typeConfig.gradient} flex flex-col items-center justify-center`}>
                    <TypeIcon size={36} className="text-white/30 mb-2" />
                    <span className="text-white/80 text-[10px] font-medium">{typeConfig.label}</span>
                  </div>
                )}
                {/* Status badge */}
                <span className={`absolute top-2 left-2 px-2 py-0.5 rounded-full text-[10px] font-medium backdrop-blur-sm ${
                  game.status === 'PUBLISHED'
                    ? 'bg-green-500/80 text-white'
                    : 'bg-amber-500/80 text-white'
                }`}>
                  {game.status === 'PUBLISHED' ? '已发布' : '草稿'}
                </span>
                {/* Type badge (only when has image) */}
                {hasImage && game.gameType !== 'GRAPH' && (
                  <span className={`absolute top-2 right-2 px-2 py-0.5 rounded-full text-[10px] font-medium backdrop-blur-sm bg-gradient-to-r ${typeConfig.gradient} text-white`}>
                    {game.gameType === 'IMAGE_WHEEL' ? '图片' : '文字'}
                  </span>
                )}
              </div>
              {/* Info */}
              <div className="bg-white dark:bg-slate-800 p-2.5 flex-1">
                <h3 className="font-semibold text-slate-800 dark:text-slate-100 text-sm truncate">{game.title}</h3>
                <div className="flex items-center justify-between mt-1.5">
                  <div className="flex items-center gap-2 text-[10px] text-slate-400 dark:text-slate-500">
                    <span className="flex items-center gap-0.5">
                      <Play size={10} /> {game.playCount}
                    </span>
                    <span className="flex items-center gap-0.5">
                      <Heart size={10} /> {game.likeCount}
                    </span>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); onEditGame(game.id, game.gameType); }}
                    className="p-1 text-teal-500 dark:text-teal-400 hover:bg-teal-50 dark:bg-teal-950 rounded-md transition-colors"
                  >
                    <Edit3 size={14} />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ==================== Game Card (Bento) ====================

const GAME_TYPE_CONFIG: Record<string, { label: string; gradient: string; icon: React.ElementType }> = {
  IMAGE_WHEEL: { label: '图片轮盘', gradient: 'from-violet-500 to-purple-600', icon: ImageIcon },
  TEXT_WHEEL: { label: '文字轮盘', gradient: 'from-amber-500 to-orange-600', icon: Type },
  GRAPH: { label: '图谱游戏', gradient: 'from-emerald-500 to-teal-600', icon: Dice5 },
  NODE_SCRIPT: { label: '脚本游戏', gradient: 'from-cyan-500 to-blue-600', icon: Workflow },
};

interface GameCardProps {
  game: RouletteGameSummary;
  isHero?: boolean;
  onClick: () => void;
  onToggleLike: () => void;
  onToggleFavorite: () => void;
}

const GameCard: React.FC<GameCardProps> = ({ game, isHero, onClick, onToggleLike, onToggleFavorite }) => {
  const hasImage = !!game.coverImageUrl;
  const typeConfig = GAME_TYPE_CONFIG[game.gameType] || GAME_TYPE_CONFIG.GRAPH;
  const TypeIcon = typeConfig.icon;

  // ── Hero card: full-width, landscape image with overlay text ──
  if (isHero && hasImage) {
    return (
      <div
        onClick={onClick}
        className="col-span-2 bg-white dark:bg-slate-800 rounded-2xl overflow-hidden shadow-sm border border-slate-50 dark:border-slate-700 hover:shadow-md transition-all active:scale-[0.98] cursor-pointer"
      >
        <div className="relative aspect-[16/9]">
          <img src={game.coverImageUrl!} alt={game.title} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
          {/* Type badge */}
          <span className={`absolute top-3 right-3 px-2.5 py-1 rounded-full text-[10px] font-medium backdrop-blur-sm bg-gradient-to-r ${typeConfig.gradient} text-white`}>
            {typeConfig.label}
          </span>
          {/* Favorite */}
          <button
            onClick={(e) => { e.stopPropagation(); onToggleFavorite(); }}
            className="absolute top-3 left-3 p-1.5 rounded-full backdrop-blur-sm bg-black/20 hover:bg-black/30 transition-colors"
          >
            <Bookmark size={16} className={game.isFavorited ? 'text-amber-400 dark:text-amber-300' : 'text-white/80'} fill={game.isFavorited ? 'currentColor' : 'none'} />
          </button>
          {/* Bottom info overlay */}
          <div className="absolute bottom-0 left-0 right-0 p-3">
            <h3 className="font-bold text-white text-base mb-1 drop-shadow-sm">{game.title}</h3>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-white/80 text-xs">
                {game.creatorAvatar ? (
                  <img src={game.creatorAvatar} className="w-4 h-4 rounded-full" alt="" />
                ) : (
                  <User size={12} />
                )}
                <span>{game.creatorName}</span>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); onToggleLike(); }}
                className={`flex items-center gap-1 text-xs font-medium ${game.isLiked ? 'text-rose-400' : 'text-white/70'}`}
              >
                <Heart size={14} fill={game.isLiked ? 'currentColor' : 'none'} />
                {game.likeCount > 0 && game.likeCount}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Image card: portrait image-dominant ──
  if (hasImage) {
    return (
      <div
        onClick={onClick}
        className="bg-white dark:bg-slate-800 rounded-2xl overflow-hidden shadow-sm border border-slate-50 dark:border-slate-700 hover:shadow-md transition-all active:scale-[0.98] cursor-pointer"
      >
        <div className="relative aspect-[3/4]">
          <img src={game.coverImageUrl!} alt={game.title} className="w-full h-full object-cover" />
          {game.gameType !== 'GRAPH' && (
            <span className={`absolute top-2 right-2 px-2 py-0.5 rounded-full text-[10px] font-medium backdrop-blur-sm bg-gradient-to-r ${typeConfig.gradient} text-white`}>
              {game.gameType === 'IMAGE_WHEEL' ? '图片' : '文字'}
            </span>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); onToggleFavorite(); }}
            className="absolute top-2 left-2 p-1 rounded-full backdrop-blur-sm bg-black/20 hover:bg-black/30 transition-colors"
          >
            <Bookmark size={14} className={game.isFavorited ? 'text-amber-400 dark:text-amber-300' : 'text-white/80'} fill={game.isFavorited ? 'currentColor' : 'none'} />
          </button>
        </div>
        <div className="p-2.5">
          <div className="flex items-center gap-1.5">
            <h3 className="font-semibold text-slate-800 dark:text-slate-100 text-sm truncate flex-1">{game.title}</h3>
            {game.priceCampusPoints > 0 && (
              <span className="shrink-0 px-1.5 py-0.5 bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 text-[10px] font-medium rounded-full flex items-center gap-0.5">
                <Coins size={10} />{game.priceCampusPoints}
              </span>
            )}
          </div>
          <div className="flex items-center justify-between mt-1.5">
            <div className="flex items-center gap-1 text-[11px] text-slate-400 dark:text-slate-500 min-w-0">
              {game.creatorAvatar ? (
                <img src={game.creatorAvatar} className="w-3.5 h-3.5 rounded-full shrink-0" alt="" />
              ) : (
                <User size={11} className="shrink-0" />
              )}
              <span className="truncate">{game.creatorName}</span>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); onToggleLike(); }}
              className={`flex items-center gap-0.5 text-[11px] font-medium ${game.isLiked ? 'text-rose-500 dark:text-rose-400' : 'text-slate-400 dark:text-slate-500'}`}
            >
              <Heart size={12} fill={game.isLiked ? 'currentColor' : 'none'} />
              {game.likeCount > 0 && game.likeCount}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Text card: no cover image, gradient bg with text info ──
  return (
    <div
      onClick={onClick}
      className="rounded-2xl overflow-hidden shadow-sm border border-slate-50 dark:border-slate-700 hover:shadow-md transition-all active:scale-[0.98] cursor-pointer flex flex-col"
    >
      {/* Gradient header with type icon */}
      <div className={`relative bg-gradient-to-br ${typeConfig.gradient} p-4 flex flex-col items-center justify-center aspect-square`}>
        <TypeIcon size={36} className="text-white/30 mb-2" />
        <span className="text-white/80 text-[10px] font-medium">{typeConfig.label}</span>
        {/* Favorite */}
        <button
          onClick={(e) => { e.stopPropagation(); onToggleFavorite(); }}
          className="absolute top-2 left-2 p-1 rounded-full bg-white/15 dark:bg-slate-800/15 hover:bg-white/25 dark:bg-slate-800/25 transition-colors"
        >
          <Bookmark size={14} className={game.isFavorited ? 'text-amber-300' : 'text-white/70'} fill={game.isFavorited ? 'currentColor' : 'none'} />
        </button>
      </div>
      {/* Info */}
      <div className="bg-white dark:bg-slate-800 p-2.5 flex-1 flex flex-col">
        <div className="flex items-center gap-1.5">
          <h3 className="font-semibold text-slate-800 dark:text-slate-100 text-sm truncate flex-1">{game.title}</h3>
          {game.priceCampusPoints > 0 && (
            <span className="shrink-0 px-1.5 py-0.5 bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 text-[10px] font-medium rounded-full flex items-center gap-0.5">
              <Coins size={10} />{game.priceCampusPoints}
            </span>
          )}
        </div>
        {game.description && (
          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5 line-clamp-2 flex-1">{game.description}</p>
        )}
        <div className="flex items-center justify-between mt-1.5">
          <div className="flex items-center gap-1 text-[11px] text-slate-400 dark:text-slate-500 min-w-0">
            {game.creatorAvatar ? (
              <img src={game.creatorAvatar} className="w-3.5 h-3.5 rounded-full shrink-0" alt="" />
            ) : (
              <User size={11} className="shrink-0" />
            )}
            <span className="truncate">{game.creatorName}</span>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); onToggleLike(); }}
            className={`flex items-center gap-0.5 text-[11px] font-medium ${game.isLiked ? 'text-rose-500 dark:text-rose-400' : 'text-slate-400 dark:text-slate-500'}`}
          >
            <Heart size={12} fill={game.isLiked ? 'currentColor' : 'none'} />
            {game.likeCount > 0 && game.likeCount}
          </button>
        </div>
      </div>
    </div>
  );
};

export default RouletteRoomPage;
