import { useState, useRef, useCallback, useEffect } from 'react';
import type {
  TavernServerMessage,
  TavernGameStateView,
  TavernCardRank,
  TavernGamePhase,
} from '../types';

export interface GamePlayState {
  phase: TavernGamePhase;
  roundNumber: number;
  targetRank: TavernCardRank;
  currentTurnSeat: number;
  myCards: string[];
  pileSize: number;
  lastClaimedCount: number;
  isFirstTurnOfRound: boolean;
  isMyTurn: boolean;
  canCallLiar: boolean;
  mustCallLiar: boolean;
  timeRemainingMs: number;
  gameStateView: TavernGameStateView | null;
}

export interface ChallengeResultData {
  revealedCards: string[];
  targetRank: string;
  wasLying: boolean;
  loserSeat: number;
  loserName: string;
}

export interface RouletteData {
  seatIndex: number;
  displayName: string;
  chamberPosition: number;
  died?: boolean;
  chamberFired?: number;
  bulletWasAt?: number;
}

export interface GameOverData {
  winnerSeat: number;
  winnerName: string;
  winnerUserId: number | null;
  rewardCampusPoints: number;
  totalRounds: number;
}

export interface UseGamePlayReturn {
  gameState: GamePlayState | null;
  selectedCards: Set<number>;
  challengeResult: ChallengeResultData | null;
  rouletteData: RouletteData | null;
  gameOverData: GameOverData | null;
  chatMessages: Array<{
    userId: number;
    displayName: string;
    avatarUrl: string | null;
    content: string;
    timestamp: number;
  }>;
  // 操作
  toggleCardSelection: (index: number) => void;
  clearSelection: () => void;
  playCards: (ws: WebSocket | null) => void;
  callLiar: (ws: WebSocket | null) => void;
  sendChat: (ws: WebSocket | null, content: string) => void;
  // 处理消息
  handleGameMessage: (data: TavernServerMessage) => void;
  // 回调
  onCardsPlayed: React.MutableRefObject<
    ((seatIndex: number, displayName: string, cardCount: number) => void) | null
  >;
  onLiarCalled: React.MutableRefObject<
    ((challengerName: string, targetName: string) => void) | null
  >;
  onPlayerEliminated: React.MutableRefObject<
    ((seatIndex: number, displayName: string) => void) | null
  >;
}

export function useGamePlay(mySeatIndex: number): UseGamePlayReturn {
  const [gameState, setGameState] = useState<GamePlayState | null>(null);
  const [selectedCards, setSelectedCards] = useState<Set<number>>(new Set());
  const [challengeResult, setChallengeResult] = useState<ChallengeResultData | null>(null);
  const [rouletteData, setRouletteData] = useState<RouletteData | null>(null);
  const [gameOverData, setGameOverData] = useState<GameOverData | null>(null);
  const [chatMessages, setChatMessages] = useState<
    Array<{
      userId: number;
      displayName: string;
      avatarUrl: string | null;
      content: string;
      timestamp: number;
    }>
  >([]);

  const timerRef = useRef<number | null>(null);

  const onCardsPlayed = useRef<
    ((seatIndex: number, displayName: string, cardCount: number) => void) | null
  >(null);
  const onLiarCalled = useRef<((challengerName: string, targetName: string) => void) | null>(null);
  const onPlayerEliminated = useRef<((seatIndex: number, displayName: string) => void) | null>(
    null
  );

  // 清理计时器
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const startTimer = useCallback((ms: number) => {
    if (timerRef.current) clearInterval(timerRef.current);
    let remaining = ms;
    timerRef.current = window.setInterval(() => {
      remaining -= 1000;
      if (remaining <= 0) {
        if (timerRef.current) clearInterval(timerRef.current);
        remaining = 0;
      }
      setGameState((prev) => (prev ? { ...prev, timeRemainingMs: remaining } : null));
    }, 1000);
  }, []);

  const handleGameMessage = useCallback(
    (data: TavernServerMessage) => {
      switch (data.type) {
        case 'GAME_STATE':
          if (data.state) {
            setGameState((prev) => ({
              phase: data.state!.phase,
              roundNumber: data.state!.roundNumber,
              targetRank: data.state!.targetRank,
              currentTurnSeat: data.state!.currentTurnSeat,
              myCards: data.state!.myHand ?? prev?.myCards ?? [],
              pileSize: data.state!.pileSize,
              lastClaimedCount: data.state!.lastClaimedCount,
              isFirstTurnOfRound: data.state!.isFirstTurnOfRound,
              isMyTurn: data.state!.currentTurnSeat === mySeatIndex,
              canCallLiar: !data.state!.isFirstTurnOfRound,
              mustCallLiar: false,
              timeRemainingMs: data.state!.turnTimeRemainingMs ?? prev?.timeRemainingMs ?? 60000,
              gameStateView: data.state!,
            }));
          }
          break;

        case 'ROUND_START':
          setChallengeResult(null);
          setRouletteData(null);
          setSelectedCards(new Set());
          setGameState((prev) => ({
            phase: 'PLAYING',
            roundNumber: data.roundNumber ?? prev?.roundNumber ?? 1,
            targetRank: (data.targetRank as TavernCardRank) ?? prev?.targetRank ?? 'KING',
            currentTurnSeat: data.firstTurnSeat ?? 0,
            myCards: data.yourCards ?? [],
            pileSize: 0,
            lastClaimedCount: 0,
            isFirstTurnOfRound: true,
            isMyTurn: data.firstTurnSeat === mySeatIndex,
            canCallLiar: false,
            mustCallLiar: false,
            timeRemainingMs: 60000,
            gameStateView: prev?.gameStateView ?? null,
          }));
          break;

        case 'TURN_START':
          setSelectedCards(new Set());
          setGameState((prev) =>
            prev
              ? {
                  ...prev,
                  currentTurnSeat: data.seatIndex ?? prev.currentTurnSeat,
                  isMyTurn: data.isYourTurn ?? data.seatIndex === mySeatIndex,
                  canCallLiar: data.canCallLiar ?? false,
                  mustCallLiar: data.mustCallLiar ?? false,
                  timeRemainingMs: data.timeRemainingMs ?? 60000,
                  isFirstTurnOfRound: !(data.canCallLiar ?? false),
                }
              : null
          );
          startTimer(data.timeRemainingMs ?? 60000);
          break;

        case 'CARDS_PLAYED':
          setGameState((prev) => {
            if (!prev) return null;
            // 更新 gameStateView 中对应玩家的 cardCount
            const updatedView = prev.gameStateView
              ? {
                  ...prev.gameStateView,
                  players: prev.gameStateView.players.map((p) =>
                    p.seatIndex === (data.seatIndex ?? -1)
                      ? { ...p, cardCount: data.remainingCards ?? (p.cardCount - (data.cardCount ?? 0)) }
                      : p
                  ),
                }
              : null;
            return {
              ...prev,
              pileSize: prev.pileSize + (data.cardCount ?? 0),
              lastClaimedCount: data.cardCount ?? 0,
              gameStateView: updatedView,
            };
          });
          onCardsPlayed.current?.(
            data.seatIndex ?? 0,
            data.displayName ?? '',
            data.cardCount ?? 0
          );
          break;

        case 'LIAR_CALLED':
          if (timerRef.current) clearInterval(timerRef.current);
          onLiarCalled.current?.(data.challengerName ?? '', data.targetName ?? '');
          break;

        case 'CHALLENGE_RESULT':
          setChallengeResult({
            revealedCards: data.revealedCards ?? [],
            targetRank: data.targetRank ?? '',
            wasLying: data.wasLying ?? false,
            loserSeat: data.loserSeat ?? 0,
            loserName: data.loserName ?? '',
          });
          setGameState((prev) => (prev ? { ...prev, phase: 'CHALLENGE_REVEAL' } : null));
          break;

        case 'ROULETTE_START':
          setRouletteData({
            seatIndex: data.seatIndex ?? 0,
            displayName: data.displayName ?? '',
            chamberPosition: data.chamberPosition ?? 0,
          });
          setGameState((prev) => (prev ? { ...prev, phase: 'ROULETTE' } : null));
          break;

        case 'ROULETTE_RESULT':
          setRouletteData((prev) =>
            prev
              ? {
                  ...prev,
                  died: data.died,
                  chamberFired: data.chamberFired,
                  bulletWasAt: data.bulletWasAt,
                }
              : null
          );
          break;

        case 'PLAYER_ELIMINATED':
          setGameState((prev) => {
            if (!prev?.gameStateView) return prev;
            return {
              ...prev,
              gameStateView: {
                ...prev.gameStateView,
                players: prev.gameStateView.players.map((p) =>
                  p.seatIndex === (data.seatIndex ?? -1)
                    ? { ...p, status: 'ELIMINATED' as const }
                    : p
                ),
              },
            };
          });
          onPlayerEliminated.current?.(data.seatIndex ?? 0, data.displayName ?? '');
          break;

        case 'GAME_OVER':
          if (timerRef.current) clearInterval(timerRef.current);
          setGameOverData({
            winnerSeat: data.winnerSeat ?? 0,
            winnerName: data.winnerName ?? '',
            winnerUserId: data.winnerUserId ?? null,
            rewardCampusPoints: data.rewardCampusPoints ?? 0,
            totalRounds: data.totalRounds ?? 0,
          });
          setGameState((prev) => (prev ? { ...prev, phase: 'GAME_OVER' } : null));
          break;

        case 'PLAY_AGAIN_STATUS':
          // 再来一把状态更新（readyPlayerSeats, timeoutSeconds）
          break;

        case 'TURN_TIMEOUT':
          // 超时自动操作通知
          break;

        case 'CHAT_MESSAGE':
          setChatMessages((prev) => [
            ...prev.slice(-99),
            {
              userId: data.userId ?? 0,
              displayName: data.displayName ?? '',
              avatarUrl: data.avatarUrl ?? null,
              content: data.content ?? '',
              timestamp: data.timestamp ?? Date.now(),
            },
          ]);
          break;
      }
    },
    [mySeatIndex, startTimer]
  );

  const toggleCardSelection = useCallback(
    (index: number) => {
      setSelectedCards((prev) => {
        const next = new Set(prev);
        if (next.has(index)) {
          next.delete(index);
        } else if (next.size < 3) {
          next.add(index);
        }
        return next;
      });
    },
    []
  );

  const clearSelection = useCallback(() => setSelectedCards(new Set()), []);

  const playCards = useCallback(
    (ws: WebSocket | null) => {
      if (!ws || ws.readyState !== WebSocket.OPEN) return;
      if (selectedCards.size === 0) return;
      ws.send(JSON.stringify({ type: 'PLAY_CARDS', cardIndices: Array.from(selectedCards) }));
      // 从手牌中移除已出的牌
      setGameState((prev) => {
        if (!prev) return null;
        const remaining = prev.myCards.filter((_, i) => !selectedCards.has(i));
        return { ...prev, myCards: remaining };
      });
      setSelectedCards(new Set());
    },
    [selectedCards]
  );

  const callLiar = useCallback((ws: WebSocket | null) => {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({ type: 'CALL_LIAR' }));
  }, []);

  const sendChat = useCallback((ws: WebSocket | null, content: string) => {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    if (!content.trim()) return;
    ws.send(JSON.stringify({ type: 'CHAT_MESSAGE', content: content.trim() }));
  }, []);

  return {
    gameState,
    selectedCards,
    challengeResult,
    rouletteData,
    gameOverData,
    chatMessages,
    toggleCardSelection,
    clearSelection,
    playCards,
    callLiar,
    sendChat,
    handleGameMessage,
    onCardsPlayed,
    onLiarCalled,
    onPlayerEliminated,
  };
}
