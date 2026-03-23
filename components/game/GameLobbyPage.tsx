import { useState, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ChevronLeft,
  Swords,
  Users,
  Plus,
  Search,
  Ticket,
  History,
  Crown,
  Skull,
  Trophy,
  Copy,
  Check,
  Loader2,
  Wifi,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { tavernApi, selfLockApi, itemsApi } from '../../lib/api';
import { useGameRoom } from '../../hooks/useGameRoom';
import GameEntryFeeModal from './GameEntryFeeModal';
import GameWaitingRoom from './GameWaitingRoom';
import GamePlayPage from './GamePlayPage';
import type { TavernRoomSummary, TavernGameHistory, TavernEntryType, TavernRoomDetail } from '../../types';

type LobbyView = 'main' | 'matchmaking' | 'create' | 'join' | 'rooms' | 'history' | 'waiting' | 'playing';

interface GameLobbyPageProps {
  onBack: () => void;
}

export default function GameLobbyPage({ onBack }: GameLobbyPageProps) {
  const [view, setView] = useState<LobbyView>('main');
  const [entryFeeModalOpen, setEntryFeeModalOpen] = useState(false);
  const [entryFeeAction, setEntryFeeAction] = useState<'matchmaking' | 'create' | 'join'>('matchmaking');
  const [inviteCode, setInviteCode] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [joinError, setJoinError] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [pendingEntryType, setPendingEntryType] = useState<TavernEntryType | null>(null);
  const [pendingLockId, setPendingLockId] = useState<number | undefined>();
  const [gameRoomId, setGameRoomId] = useState<number | null>(null);

  const gameRoom = useGameRoom();

  // 获取用户货币信息
  const { data: currency } = useQuery({
    queryKey: ['user-currency'],
    queryFn: () => itemsApi.getCurrency(),
  });

  // 获取活跃锁
  const { data: activeLocks } = useQuery({
    queryKey: ['my-locks-active'],
    queryFn: () => selfLockApi.getMyLocks(true),
  });

  // 获取公开房间列表
  const { data: publicRoomsData, refetch: refetchRooms } = useQuery({
    queryKey: ['tavern-public-rooms'],
    queryFn: () => tavernApi.listPublicRooms(),
    enabled: view === 'rooms',
  });

  // 获取游戏历史
  const { data: historyData } = useQuery({
    queryKey: ['tavern-history'],
    queryFn: () => tavernApi.getHistory(),
    enabled: view === 'history',
  });

  // 获取匹配队列状态（主界面轮询）
  const { data: queueStatus } = useQuery({
    queryKey: ['tavern-queue-status'],
    queryFn: () => tavernApi.getQueueStatus(),
    enabled: view === 'main',
    refetchInterval: 5000,
  });

  // 检查是否有活跃房间
  useEffect(() => {
    tavernApi.getActiveRoom().then((res) => {
      if (res.roomId && res.room) {
        setGameRoomId(res.roomId);
        if (res.room.status === 'IN_GAME' || res.room.status === 'PLAY_AGAIN') {
          setView('playing');
          gameRoom.connectToRoom(res.roomId);
        } else if (res.room.status === 'WAITING') {
          setView('waiting');
          gameRoom.connectToRoom(res.roomId);
        }
      }
    }).catch(() => {});
  }, []);

  // 监听匹配/房间事件
  useEffect(() => {
    gameRoom.onMatchFound.current = (roomId: number) => {
      setGameRoomId(roomId);
      setView('waiting');
      gameRoom.disconnectFromMatchmaking();
      gameRoom.connectToRoom(roomId);
    };
    gameRoom.onRoomUpdate.current = (room: TavernRoomDetail) => {
      // 再来一把：房间从 PLAY_AGAIN 转为 WAITING 时，切回等待视图
      if (room.status === 'WAITING' && view === 'playing') {
        setView('waiting');
      }
    };
    gameRoom.onGameStarting.current = () => {
      setView('playing');
    };
  }, [gameRoom, view]);

  // 匹配 WS 连接成功后自动加入队列
  useEffect(() => {
    if (view === 'matchmaking' && gameRoom.status === 'connected' && pendingEntryType) {
      gameRoom.joinMatchmaking(pendingEntryType, pendingLockId);
    }
  }, [view, gameRoom.status, pendingEntryType, pendingLockId, gameRoom]);

  // 自动匹配状态变化
  useEffect(() => {
    if (gameRoom.status === 'in_game') {
      setView('playing');
    }
  }, [gameRoom.status]);

  const lockOptions = (activeLocks ?? [])
    .filter((l) => l.status === 'ACTIVE')
    .map((l) => ({ id: l.id, name: `锁 #${l.id}` }));

  // 打开入场费选择
  const openEntryFee = (action: 'matchmaking' | 'create' | 'join') => {
    setEntryFeeAction(action);
    setEntryFeeModalOpen(true);
  };

  // 入场费确认后
  const handleEntryFeeConfirm = async (entryType: TavernEntryType, lockId?: number) => {
    setEntryFeeModalOpen(false);
    setPendingEntryType(entryType);
    setPendingLockId(lockId);

    if (entryFeeAction === 'matchmaking') {
      setView('matchmaking');
      gameRoom.connectToMatchmaking();
      // joinMatchmaking 由下方 useEffect 在 WS 连接成功后触发
    } else if (entryFeeAction === 'create') {
      await handleCreateRoom(entryType, lockId);
    } else if (entryFeeAction === 'join') {
      await handleJoinRoom(entryType, lockId);
    }
  };

  // 创建房间
  const handleCreateRoom = async (entryType: TavernEntryType, lockId?: number) => {
    setIsCreating(true);
    try {
      const room = await tavernApi.createRoom(isPublic);
      // 加入自己创建的房间（带入场费）
      await tavernApi.joinRoom({ roomId: room.id, entryType, lockId });
      setGameRoomId(room.id);
      setView('waiting');
      gameRoom.connectToRoom(room.id);
    } catch (e: any) {
      setJoinError(e?.message || '创建房间失败');
    } finally {
      setIsCreating(false);
    }
  };

  // 加入房间
  const handleJoinRoom = async (entryType: TavernEntryType, lockId?: number) => {
    setIsJoining(true);
    setJoinError('');
    try {
      const room = await tavernApi.joinRoom({ inviteCode: inviteCode.trim(), entryType, lockId });
      setGameRoomId(room.id);
      setView('waiting');
      gameRoom.connectToRoom(room.id);
    } catch (e: any) {
      setJoinError(e?.message || '加入房间失败');
    } finally {
      setIsJoining(false);
    }
  };

  // 加入公开房间
  const handleJoinPublicRoom = (roomId: number) => {
    setGameRoomId(roomId);
    setEntryFeeAction('join');
    setInviteCode(''); // clear invite code since we're using roomId
    setEntryFeeModalOpen(true);
  };

  // 退出匹配
  const handleLeaveMatchmaking = () => {
    gameRoom.leaveMatchmaking();
    gameRoom.disconnectFromMatchmaking();
    setView('main');
    setPendingEntryType(null);
  };

  // 退出房间
  const handleLeaveRoom = async () => {
    if (gameRoomId) {
      try {
        await tavernApi.leaveRoom(gameRoomId);
      } catch {}
    }
    gameRoom.disconnectFromRoom();
    setGameRoomId(null);
    setView('main');
  };

  // 游戏结束
  const handleGameExit = () => {
    gameRoom.disconnectFromRoom();
    setGameRoomId(null);
    setView('main');
  };

  // 等待房间
  if (view === 'waiting') {
    if (!gameRoom.room) {
      // WebSocket 尚未连接/收到 ROOM_UPDATE，显示加载状态
      return (
        <div className="h-full flex flex-col items-center justify-center bg-stone-950 gap-4">
          <Loader2 size={32} className="text-amber-500 animate-spin" />
          <p className="text-stone-400 text-sm">正在连接房间...</p>
          <button
            onClick={handleLeaveRoom}
            className="text-stone-500 hover:text-stone-300 text-sm mt-4"
          >
            取消
          </button>
        </div>
      );
    }
    const myPlayer = gameRoom.room.players.find((p) => p.seatIndex === gameRoom.yourSeatIndex);
    return (
      <GameWaitingRoom
        room={gameRoom.room}
        isOwner={myPlayer?.userId != null && myPlayer.userId === gameRoom.room.ownerId}
        onStartGame={() => gameRoom.sendStartGame()}
        onLeave={handleLeaveRoom}
        onAddBot={(difficulty) => gameRoom.sendAddBot(difficulty)}
        onRemoveBot={(seatIndex) => gameRoom.sendRemoveBot(seatIndex)}
        onReady={() => gameRoom.sendReady()}
      />
    );
  }

  // 游戏进行中
  if (view === 'playing' && gameRoomId) {
    return (
      <GamePlayPage
        roomId={gameRoomId}
        mySeatIndex={gameRoom.yourSeatIndex}
        ws={gameRoom.roomWs}
        onExit={handleGameExit}
      />
    );
  }

  return (
    <div className="h-full flex flex-col bg-stone-950 lg:max-w-[900px] lg:mx-auto lg:w-full">
      {/* Header */}
      <div className="bg-gradient-to-br from-amber-900 via-stone-900 to-black text-white px-4 pt-12 lg:pt-8 pb-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-amber-500/10 rounded-full translate-y-1/2 -translate-x-1/2" />

        <button
          onClick={view === 'main' ? onBack : () => setView('main')}
          className="absolute top-4 left-4 p-2 hover:bg-white/10 rounded-full transition-colors"
        >
          <ChevronLeft size={24} />
        </button>

        <div className="text-center relative z-10">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-amber-500/20 rounded-2xl mb-3">
            <Swords size={32} className="text-amber-400" />
          </div>
          <h1 className="text-2xl font-bold font-serif mb-1">骗子酒馆</h1>
          <p className="text-stone-400 text-sm">Liar's Tavern — 勇敢者的博弈</p>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        <AnimatePresence mode="wait">
          {/* 匹配中 */}
          {view === 'matchmaking' && (
            <motion.div
              key="matchmaking"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="flex flex-col items-center justify-center gap-6 py-16"
            >
              <div className="relative">
                <div className="w-24 h-24 rounded-full border-4 border-amber-500/30 flex items-center justify-center">
                  <Wifi size={40} className="text-amber-400 animate-pulse" />
                </div>
                <motion.div
                  className="absolute inset-0 rounded-full border-2 border-amber-500/50"
                  animate={{ scale: [1, 1.3, 1], opacity: [0.5, 0, 0.5] }}
                  transition={{ duration: 2, repeat: Infinity }}
                />
              </div>
              <div className="text-center">
                <h2 className="text-xl font-bold text-white mb-3">正在匹配...</h2>
                {gameRoom.matchmakingInfo ? (
                  <>
                    <div className="flex items-center justify-center gap-2 mb-2">
                      {Array.from({ length: gameRoom.matchmakingInfo.requiredPlayers }).map((_, i) => (
                        <div
                          key={i}
                          className={`w-10 h-10 rounded-full border-2 flex items-center justify-center text-sm font-bold transition-all ${
                            i < gameRoom.matchmakingInfo!.playersInQueue
                              ? 'border-amber-500 bg-amber-500/20 text-amber-400'
                              : 'border-stone-700 bg-stone-800/50 text-stone-600'
                          }`}
                        >
                          {i < gameRoom.matchmakingInfo!.playersInQueue ? '✓' : '?'}
                        </div>
                      ))}
                    </div>
                    <p className="text-amber-400 font-medium">
                      {gameRoom.matchmakingInfo.playersInQueue} / {gameRoom.matchmakingInfo.requiredPlayers} 位玩家
                    </p>
                  </>
                ) : (
                  <p className="text-stone-500">连接匹配服务中...</p>
                )}
                <p className="text-stone-500 text-sm mt-1">正在寻找对手，请稍候</p>
              </div>
              <button
                onClick={handleLeaveMatchmaking}
                className="px-6 py-2 bg-stone-800 hover:bg-stone-700 text-stone-300 rounded-lg transition-colors"
              >
                取消匹配
              </button>
            </motion.div>
          )}

          {/* 主菜单 */}
          {view === 'main' && (
            <motion.div
              key="main"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              {/* 快速匹配 */}
              <button
                onClick={() => openEntryFee('matchmaking')}
                className="w-full p-5 rounded-2xl bg-gradient-to-r from-amber-900/80 to-amber-800/60 border border-amber-700/50 hover:border-amber-600/80 transition-all active:scale-[0.98]"
              >
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-xl bg-amber-500/20 flex items-center justify-center">
                    <Users size={28} className="text-amber-400" />
                  </div>
                  <div className="text-left flex-1">
                    <h3 className="text-lg font-bold text-white">快速匹配</h3>
                    <p className="text-sm text-stone-400">自动匹配 4 名玩家，即刻开局</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Swords size={20} className="text-amber-500/60" />
                    {queueStatus && queueStatus.playersInQueue > 0 && (
                      <span className="text-xs text-amber-400/80 bg-amber-500/10 px-2 py-0.5 rounded-full">
                        {queueStatus.playersInQueue} 人排队中
                      </span>
                    )}
                  </div>
                </div>
              </button>

              {/* 创建/加入 */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setView('create')}
                  className="p-4 rounded-xl bg-stone-800/80 border border-stone-700/50 hover:border-stone-600 transition-all active:scale-[0.98]"
                >
                  <Plus size={24} className="text-emerald-400 mb-2" />
                  <h3 className="font-semibold text-white text-sm">创建房间</h3>
                  <p className="text-xs text-stone-500 mt-1">邀请好友对战</p>
                </button>
                <button
                  onClick={() => setView('join')}
                  className="p-4 rounded-xl bg-stone-800/80 border border-stone-700/50 hover:border-stone-600 transition-all active:scale-[0.98]"
                >
                  <Ticket size={24} className="text-blue-400 mb-2" />
                  <h3 className="font-semibold text-white text-sm">加入房间</h3>
                  <p className="text-xs text-stone-500 mt-1">输入邀请码</p>
                </button>
              </div>

              {/* 公开房间/历史记录 */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => { setView('rooms'); refetchRooms(); }}
                  className="p-4 rounded-xl bg-stone-800/80 border border-stone-700/50 hover:border-stone-600 transition-all active:scale-[0.98]"
                >
                  <Search size={24} className="text-violet-400 mb-2" />
                  <h3 className="font-semibold text-white text-sm">公开房间</h3>
                  <p className="text-xs text-stone-500 mt-1">浏览可加入的房间</p>
                </button>
                <button
                  onClick={() => setView('history')}
                  className="p-4 rounded-xl bg-stone-800/80 border border-stone-700/50 hover:border-stone-600 transition-all active:scale-[0.98]"
                >
                  <History size={24} className="text-orange-400 mb-2" />
                  <h3 className="font-semibold text-white text-sm">游戏记录</h3>
                  <p className="text-xs text-stone-500 mt-1">查看历史对局</p>
                </button>
              </div>

              {/* 游戏规则简介 */}
              <div className="mt-6 p-4 rounded-xl bg-stone-900/80 border border-stone-800">
                <h3 className="text-amber-400 font-semibold text-sm mb-3">游戏规则</h3>
                <div className="space-y-2 text-xs text-stone-400">
                  <p>4 人一局，每回合发 5 张牌（K/Q/A/Joker）</p>
                  <p>轮流出 1-3 张面朝下的牌，声称是目标花色</p>
                  <p>你可以选择相信，或喊"骗子！"翻牌验证</p>
                  <p>输家进入俄罗斯轮盘，中弹即淘汰</p>
                  <p>最后存活的人获胜，赢取奖励</p>
                </div>
              </div>
            </motion.div>
          )}

          {/* 创建房间 */}
          {view === 'create' && (
            <motion.div
              key="create"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
            >
              <h2 className="text-lg font-bold text-white">创建房间</h2>

              <div className="p-4 rounded-xl bg-stone-900 border border-stone-800">
                <label className="flex items-center justify-between">
                  <span className="text-stone-300 text-sm">公开房间</span>
                  <button
                    onClick={() => setIsPublic(!isPublic)}
                    className={`w-12 h-6 rounded-full transition-colors ${isPublic ? 'bg-amber-600' : 'bg-stone-700'}`}
                  >
                    <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${isPublic ? 'translate-x-6' : 'translate-x-0.5'}`} />
                  </button>
                </label>
                <p className="text-xs text-stone-500 mt-2">
                  {isPublic ? '其他玩家可以在公开列表中看到并加入' : '仅通过邀请码加入'}
                </p>
              </div>

              <button
                onClick={() => openEntryFee('create')}
                disabled={isCreating}
                className="w-full py-3 bg-amber-700 hover:bg-amber-600 disabled:bg-stone-800 disabled:text-stone-500 text-white rounded-xl font-bold transition-colors flex items-center justify-center gap-2"
              >
                {isCreating ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
                创建并支付入场费
              </button>

              {joinError && (
                <p className="text-red-400 text-sm text-center">{joinError}</p>
              )}
            </motion.div>
          )}

          {/* 加入房间 */}
          {view === 'join' && (
            <motion.div
              key="join"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
            >
              <h2 className="text-lg font-bold text-white">加入房间</h2>

              <div className="p-4 rounded-xl bg-stone-900 border border-stone-800">
                <label className="text-stone-400 text-sm mb-2 block">邀请码</label>
                <input
                  type="text"
                  value={inviteCode}
                  onChange={(e) => { setInviteCode(e.target.value.toUpperCase()); setJoinError(''); }}
                  placeholder="输入 6 位邀请码"
                  maxLength={6}
                  className="w-full px-4 py-3 bg-stone-800 border border-stone-700 rounded-lg text-white text-center text-2xl tracking-[0.5em] font-mono placeholder:text-stone-600 placeholder:text-base placeholder:tracking-normal focus:outline-none focus:border-amber-600"
                />
              </div>

              <button
                onClick={() => openEntryFee('join')}
                disabled={inviteCode.length !== 6 || isJoining}
                className="w-full py-3 bg-amber-700 hover:bg-amber-600 disabled:bg-stone-800 disabled:text-stone-500 text-white rounded-xl font-bold transition-colors flex items-center justify-center gap-2"
              >
                {isJoining ? <Loader2 size={18} className="animate-spin" /> : <Ticket size={18} />}
                加入并支付入场费
              </button>

              {joinError && (
                <p className="text-red-400 text-sm text-center">{joinError}</p>
              )}
            </motion.div>
          )}

          {/* 公开房间列表 */}
          {view === 'rooms' && (
            <motion.div
              key="rooms"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-3"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-white">公开房间</h2>
                <button onClick={() => refetchRooms()} className="text-stone-400 hover:text-white text-sm">
                  刷新
                </button>
              </div>

              {(!publicRoomsData?.rooms || publicRoomsData.rooms.length === 0) ? (
                <div className="py-12 text-center">
                  <Search size={40} className="text-stone-700 mx-auto mb-3" />
                  <p className="text-stone-500">暂无公开房间</p>
                  <p className="text-stone-600 text-sm mt-1">创建一个新房间开始游戏吧</p>
                </div>
              ) : (
                publicRoomsData.rooms.map((room: TavernRoomSummary) => (
                  <button
                    key={room.id}
                    onClick={() => handleJoinPublicRoom(room.id)}
                    className="w-full p-4 rounded-xl bg-stone-900 border border-stone-800 hover:border-stone-600 transition-all text-left"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {room.ownerAvatar ? (
                          <img src={room.ownerAvatar} className="w-10 h-10 rounded-full" alt="" />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-stone-700 flex items-center justify-center">
                            <Crown size={18} className="text-amber-500" />
                          </div>
                        )}
                        <div>
                          <p className="text-white font-medium text-sm">{room.ownerName} 的房间</p>
                          <p className="text-stone-500 text-xs">{room.playerCount}/{room.maxPlayers} 位玩家</p>
                        </div>
                      </div>
                      <div className="text-xs text-amber-500 bg-amber-500/10 px-2 py-1 rounded">加入</div>
                    </div>
                  </button>
                ))
              )}
            </motion.div>
          )}

          {/* 游戏记录 */}
          {view === 'history' && (
            <motion.div
              key="history"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-3"
            >
              <h2 className="text-lg font-bold text-white">游戏记录</h2>

              {(!historyData || historyData.length === 0) ? (
                <div className="py-12 text-center">
                  <History size={40} className="text-stone-700 mx-auto mb-3" />
                  <p className="text-stone-500">暂无游戏记录</p>
                  <p className="text-stone-600 text-sm mt-1">完成一局游戏后会显示在这里</p>
                </div>
              ) : (
                historyData.map((game: TavernGameHistory) => (
                  <div
                    key={game.roomId}
                    className="p-4 rounded-xl bg-stone-900 border border-stone-800"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Trophy size={16} className="text-amber-400" />
                        <span className="text-amber-400 text-sm font-medium">
                          {game.winnerName ?? '未知'}
                        </span>
                        <span className="text-stone-600 text-xs">获胜</span>
                      </div>
                      <span className="text-stone-600 text-xs">
                        {game.totalRounds} 回合
                      </span>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      {game.players.map((p, i) => (
                        <span
                          key={i}
                          className={`text-xs px-2 py-0.5 rounded ${
                            p.userId === game.winnerId
                              ? 'bg-amber-500/20 text-amber-400'
                              : 'bg-stone-800 text-stone-500'
                          }`}
                        >
                          {p.displayName}
                        </span>
                      ))}
                    </div>
                    {game.finishedAt && (
                      <p className="text-stone-600 text-xs mt-2">
                        {new Date(game.finishedAt).toLocaleDateString('zh-CN', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    )}
                  </div>
                ))
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 入场费弹窗 */}
      <GameEntryFeeModal
        isOpen={entryFeeModalOpen}
        onClose={() => setEntryFeeModalOpen(false)}
        onConfirm={(entryType, lockId) => {
          if (entryFeeAction === 'join' && gameRoomId && !inviteCode) {
            // 公开房间加入 - 用 roomId
            setEntryFeeModalOpen(false);
            setIsJoining(true);
            tavernApi.joinRoom({ roomId: gameRoomId, entryType, lockId })
              .then((room) => {
                setView('waiting');
                gameRoom.connectToRoom(room.id);
              })
              .catch((e: any) => setJoinError(e?.message || '加入失败'))
              .finally(() => setIsJoining(false));
          } else {
            handleEntryFeeConfirm(entryType, lockId);
          }
        }}
        campusPoints={currency?.campusPoints ?? 0}
        activeLocks={lockOptions}
      />
    </div>
  );
}
