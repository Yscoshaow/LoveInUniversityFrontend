import { useRef, useState, useEffect, useCallback } from 'react';
import { LogOut } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import GamePlayerArea from './GamePlayerArea';
import GameTable from './GameTable';
import GameTurnTimer from './GameTurnTimer';
import GameRoulette from './GameRoulette';
import GameOverScreen from './GameOverScreen';
import GameChat from './GameChat';
import GameVoiceControls from './GameVoiceControls';
import { useGamePlay } from '../../hooks/useGamePlay';
import { useGameVoice } from '../../hooks/useGameVoice';
import { useGameSounds } from '../../hooks/useGameSounds';
import { tavernApi } from '../../lib/api';
import type { TavernServerMessage, TavernGameStateView, TavernPlayerGameView } from '../../types';

interface GamePlayPageProps {
  roomId: number;
  mySeatIndex: number;
  ws: WebSocket | null;
  initialGameState?: TavernGameStateView | null;
  onExit: () => void;
}

export default function GamePlayPage({ roomId, mySeatIndex, ws, initialGameState, onExit }: GamePlayPageProps) {
  const [message, setMessage] = useState('');
  const [chatOpen, setChatOpen] = useState(false);
  const [playAgainLoading, setPlayAgainLoading] = useState(false);
  const msgContainerRef = useRef<HTMLDivElement>(null);
  const [msgOverflow, setMsgOverflow] = useState(0);

  // 检测消息是否溢出容器
  useEffect(() => {
    const container = msgContainerRef.current;
    if (!container) return;
    const span = container.querySelector('span');
    if (!span) { setMsgOverflow(0); return; }
    const overflow = span.scrollWidth - container.clientWidth;
    setMsgOverflow(overflow > 2 ? overflow : 0);
  }, [message]);

  const {
    gameState,
    selectedCards,
    challengeResult,
    rouletteData,
    gameOverData,
    chatMessages,
    toggleCardSelection,
    playCards,
    callLiar,
    sendChat,
    handleGameMessage,
    onCardsPlayed,
    onLiarCalled,
    onPlayerEliminated,
  } = useGamePlay(mySeatIndex);

  const { isMicEnabled, isSpeaking, peerStates, toggleMic, initVoice, cleanupVoice, handleVoiceMessage } =
    useGameVoice();
  const { play } = useGameSounds();

  // 初始化语音（等游戏开始后再建立 WebRTC 连接，只初始化一次）
  const voiceInitialized = useRef(false);
  const gameStarted = !!gameState;
  useEffect(() => {
    if (ws && gameStarted && !voiceInitialized.current) {
      voiceInitialized.current = true;
      initVoice(ws, mySeatIndex, 4);
    }
  }, [ws, gameStarted, mySeatIndex, initVoice]);

  useEffect(() => {
    return () => cleanupVoice();
  }, [cleanupVoice]);

  // 事件回调（含音效）
  useEffect(() => {
    onCardsPlayed.current = (seat, name, count) => {
      play('cardPlay', 0.5);
      setMessage(`${name} 打出了 ${count} 张牌`);
    };
    onLiarCalled.current = (challenger, target) => {
      setMessage(`${challenger} 质疑 ${target} 是骗子！`);
    };
    onPlayerEliminated.current = (seat, name) => {
      setMessage(`${name} 被淘汰了！`);
    };
  }, [onCardsPlayed, onLiarCalled, onPlayerEliminated, play]);

  // WebSocket 消息路由
  useEffect(() => {
    if (!ws) return;

    const handler = (event: MessageEvent) => {
      try {
        const data: TavernServerMessage = JSON.parse(event.data);

        // 游戏消息
        handleGameMessage(data);

        // 语音消息
        if (data.type === 'WEBRTC_OFFER' || data.type === 'WEBRTC_ANSWER' || data.type === 'ICE_CANDIDATE') {
          handleVoiceMessage(data);
        }

        // UI 提示消息 + 音效
        switch (data.type) {
          case 'ROUND_START':
            setMessage(`第 ${data.roundNumber} 回合 — 目标: ${data.targetRank === 'KING' ? 'K' : data.targetRank === 'QUEEN' ? 'Q' : 'A'}`);
            break;
          case 'TURN_START':
            if (data.isYourTurn) {
              setMessage('轮到你了！');
            } else {
              setMessage(`轮到 ${data.displayName}...`);
            }
            break;
          case 'CHALLENGE_RESULT':
            play('cardFlip', 0.6);
            break;
        }
      } catch (e) {
        console.error('Failed to parse game message:', e);
      }
    };

    ws.addEventListener('message', handler);
    return () => ws.removeEventListener('message', handler);
  }, [ws, handleGameMessage, handleVoiceMessage, play]);

  const players: TavernPlayerGameView[] = gameState?.gameStateView?.players ?? [];
  const isMyTurn = gameState?.isMyTurn ?? false;
  const myPlayer = players.find((p) => p.seatIndex === mySeatIndex);
  const isEliminated = myPlayer?.status === 'ELIMINATED';

  // 已淘汰玩家离开：调用 API 移除房间记录，避免重连
  const handleLeave = useCallback(async () => {
    if (isEliminated) {
      try { await tavernApi.leaveRoom(roomId); } catch {}
    }
    onExit();
  }, [isEliminated, roomId, onExit]);

  // 根据 mySeatIndex 确定玩家位置（我在下方）
  const getPositionPlayers = () => {
    const bottom = players.find((p) => p.seatIndex === mySeatIndex);
    const others = players.filter((p) => p.seatIndex !== mySeatIndex);
    // 按座位顺序排列，分配到 left / top / right
    const sorted = others.sort((a, b) => {
      const aOffset = (a.seatIndex - mySeatIndex + 4) % 4;
      const bOffset = (b.seatIndex - mySeatIndex + 4) % 4;
      return aOffset - bOffset;
    });
    return {
      bottom,
      left: sorted[0] ?? null,
      top: sorted[1] ?? null,
      right: sorted[2] ?? null,
    };
  };

  const { bottom, left, top, right } = getPositionPlayers();

  // 游戏结束
  if (gameOverData) {
    return (
      <GameOverScreen
        winnerName={gameOverData.winnerName}
        winnerSeat={gameOverData.winnerSeat}
        mySeat={mySeatIndex}
        rewardCampusPoints={gameOverData.rewardCampusPoints}
        totalRounds={gameOverData.totalRounds}
        onExit={onExit}
        onPlayAgain={() => {
          if (ws && ws.readyState === WebSocket.OPEN) {
            setPlayAgainLoading(true);
            ws.send(JSON.stringify({ type: 'PLAY_AGAIN' }));
          }
        }}
        playAgainLoading={playAgainLoading}
      />
    );
  }

  return (
    <div className="relative w-full h-full flex flex-col overflow-hidden" style={{ background: 'radial-gradient(ellipse at center, #292524, #1c1917, #000000)' }}>
      {/* 顶栏 */}
      <div className="absolute top-0 left-0 w-full p-3 flex justify-between items-center z-10">
        <button onClick={handleLeave} className="text-stone-400 hover:text-white flex items-center gap-1.5 text-sm">
          <LogOut size={16} /> 离开
        </button>
        <div ref={msgContainerRef} className="flex-1 mx-3 overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={message}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-stone-200 text-sm text-center whitespace-nowrap overflow-hidden"
            >
              <span
                className={msgOverflow > 0 ? 'inline-block animate-marquee' : 'inline-block'}
                style={msgOverflow > 0 ? { '--marquee-scroll': `-${msgOverflow + 8}px` } as React.CSSProperties : undefined}
              >
                {message || '\u00A0'}
              </span>
            </motion.div>
          </AnimatePresence>
        </div>
        <div className="flex items-center gap-3">
          <GameVoiceControls
            isMicEnabled={isMicEnabled}
            isSpeaking={isSpeaking}
            onToggleMic={toggleMic}
            peerStates={peerStates}
          />
          {gameState && (
            <GameTurnTimer
              timeRemainingMs={gameState.timeRemainingMs}
              isMyTurn={isMyTurn}
            />
          )}
        </div>
      </div>

      {/* 游戏区域 */}
      <div className="flex-1 flex flex-col justify-between p-2 sm:p-6 max-w-5xl mx-auto w-full h-full relative">
        {/* 上方玩家 */}
        <div className="flex justify-center items-start z-10 pt-12">
          {top && (
            <GamePlayerArea
              player={top}
              position="top"
              isTurn={gameState?.currentTurnSeat === top.seatIndex}
              isSpeaking={peerStates.get(top.seatIndex)?.isSpeaking}
            />
          )}
        </div>

        {/* 左右玩家 + 牌桌 */}
        <div className="flex justify-between items-center w-full z-10 px-1 sm:px-6">
          <div className="flex justify-start">
            {left && (
              <GamePlayerArea
                player={left}
                position="left"
                isTurn={gameState?.currentTurnSeat === left.seatIndex}
                isSpeaking={peerStates.get(left.seatIndex)?.isSpeaking}
              />
            )}
          </div>
          <div className="flex justify-end">
            {right && (
              <GamePlayerArea
                player={right}
                position="right"
                isTurn={gameState?.currentTurnSeat === right.seatIndex}
                isSpeaking={peerStates.get(right.seatIndex)?.isSpeaking}
              />
            )}
          </div>
        </div>

        {/* 牌桌（居中） */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-0 pointer-events-none">
          <GameTable
            targetRank={gameState?.targetRank ?? 'KING'}
            pileSize={gameState?.pileSize ?? 0}
            phase={gameState?.phase ?? 'DEALING'}
            revealedCards={challengeResult?.revealedCards}
          />
        </div>

        {/* 下方玩家（自己） */}
        <div className="flex flex-col justify-end items-center z-10 pb-2">
          {bottom && (
            <GamePlayerArea
              player={bottom}
              position="bottom"
              isTurn={isMyTurn}
              isMe
              myCards={gameState?.myCards}
              selectedCards={selectedCards}
              onCardClick={(i) => isMyTurn && toggleCardSelection(i)}
            />
          )}

          {/* 操作按钮 */}
          <div className="mt-3 flex gap-3 h-11">
            {isMyTurn && (
              <>
                {!gameState?.mustCallLiar && (
                  <button
                    onClick={() => playCards(ws)}
                    disabled={selectedCards.size === 0}
                    className="px-5 py-2 bg-amber-700 hover:bg-amber-600 disabled:bg-stone-800 disabled:text-stone-500 text-white rounded-lg font-bold transition-colors shadow-lg text-sm"
                  >
                    出牌{selectedCards.size > 0 ? ` (${selectedCards.size})` : ''}
                  </button>
                )}

                <button
                  onClick={() => callLiar(ws)}
                  disabled={!gameState?.canCallLiar}
                  className="px-5 py-2 bg-red-800 hover:bg-red-700 disabled:bg-stone-800 disabled:text-stone-500 text-white rounded-lg font-bold transition-colors shadow-lg text-sm"
                >
                  喊骗子！
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* 俄罗斯轮盘 */}
      {gameState?.phase === 'ROULETTE' && rouletteData && (
        <GameRoulette
          displayName={rouletteData.displayName}
          chamberPosition={rouletteData.chamberPosition}
          result={
            rouletteData.died !== undefined
              ? {
                  died: rouletteData.died,
                  chamberFired: rouletteData.chamberFired ?? 0,
                  bulletWasAt: rouletteData.bulletWasAt ?? 0,
                }
              : null
          }
        />
      )}

      {/* 聊天 */}
      <GameChat
        messages={chatMessages}
        onSend={(content) => sendChat(ws, content)}
        isOpen={chatOpen}
        onToggle={() => setChatOpen((prev) => !prev)}
      />
    </div>
  );
}
