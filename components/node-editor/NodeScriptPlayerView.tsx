import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ArrowLeft,
  Send,
  Clock,
  Loader2,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Image as ImageIcon,
  MessageSquare,
  Timer,
  ListChecks,
  ChevronLeft,
  ChevronUp,
  ChevronDown,
  Users,
  Play,
  Pause,
  Plus,
} from 'lucide-react';
import type { ScriptExecutionResponse, DisplayCommand, InputSpec, VNDisplayState, ChatRoom, ChatMessage } from './types';
import VNModeView from './VNModeView';

interface NodeScriptPlayerViewProps {
  gameId: number;
  gameTitle?: string;
  onBack: () => void;
  onFinished?: () => void;
  api: {
    startExecution: (gameId: number) => Promise<ScriptExecutionResponse>;
    getExecution: (executionId: number) => Promise<ScriptExecutionResponse>;
    submitInput: (executionId: number, input: { nodeId: string; value: string }) => Promise<ScriptExecutionResponse>;
    abandonExecution: (executionId: number) => Promise<void>;
  };
}

const DEFAULT_ROOM_ID = '__default__';

function createDefaultRoom(): ChatRoom {
  return {
    id: DEFAULT_ROOM_ID,
    name: '系统',
    type: 'private',
    messages: [],
    unreadCount: 0,
    hasActiveInput: false,
  };
}

export default function NodeScriptPlayerView({
  gameId,
  gameTitle,
  onBack,
  onFinished,
  api,
}: NodeScriptPlayerViewProps) {
  const [executionId, setExecutionId] = useState<number | null>(null);
  const [status, setStatus] = useState<string>('INIT');
  const [inputSpec, setInputSpec] = useState<InputSpec | null>(null);
  const [textInput, setTextInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [choiceDrawerOpen, setChoiceDrawerOpen] = useState(false);
  const [timerEndTime, setTimerEndTime] = useState<number | null>(null);
  const [timerRemaining, setTimerRemaining] = useState<number>(0);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const processedCommandIds = useRef(new Set<string>());
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Multi-room chat state
  const [chatRooms, setChatRooms] = useState<Map<string, ChatRoom>>(() => {
    const m = new Map<string, ChatRoom>();
    m.set(DEFAULT_ROOM_ID, createDefaultRoom());
    return m;
  });
  const [activeChatId, setActiveChatId] = useState<string>(DEFAULT_ROOM_ID);
  const [hasChatRoomFeature, setHasChatRoomFeature] = useState(false);

  // VN mode state
  const [viewMode, setViewMode] = useState<'chatList' | 'chatRoom' | 'vn'>('chatRoom');
  const [vnState, setVNState] = useState<VNDisplayState>({
    active: false,
    orientation: 'portrait',
    backgroundUrl: null,
    sprites: [],
    currentDialogue: null,
  });

  // ── When restoring saved state, skip animations and show messages instantly ──
  const isRestoring = useRef(false);

  // ── Typing animation queue (chat mode) ──
  const chatQueue = useRef<Array<{roomId: string; message: ChatMessage}>>([]);
  const chatDrainTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isDraining = useRef(false);
  const [typingIn, setTypingIn] = useState<{roomId: string; speaker?: string; speakerAvatar?: string; speakerColor?: string} | null>(null);

  // ── VN queue: dialogue entries (wait for click) + action entries (apply immediately, auto-advance) ──
  type VnQueueEntry =
    | { kind: 'dialogue'; speaker: string; speakerAvatar?: string; text: string; chatMsg?: {roomId: string; message: ChatMessage} }
    | { kind: 'action'; apply: () => void };
  const vnDialogueQueue = useRef<VnQueueEntry[]>([]);

  // ── Deferred inputSpec (applied after queues drain) ──
  const pendingInputSpec = useRef<InputSpec | null>(null);

  // ── Deferred completion (status message shown after queues drain) ──
  const pendingStatusMsg = useRef<ChatMessage | null>(null);
  const [hasPendingCompletion, setHasPendingCompletion] = useState(false);

  // ── Deferred VN mode enter (wait for chat queue to drain first) ──
  const pendingVnEnter = useRef(false);

  // ── Tracks whether a VN dialogue is currently displayed (waiting for user click) ──
  const isVnDialogueActive = useRef(false);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
  }, []);

  /** Helper: add message(s) to a specific chat room */
  const addMessagesToRoom = useCallback((roomId: string, msgs: ChatMessage[], currentActive: string) => {
    setChatRooms((prev) => {
      const updated = new Map(prev);
      let room = updated.get(roomId);
      if (!room) {
        // Auto-create room for unknown chatId
        room = { id: roomId, name: roomId, type: 'private', messages: [], unreadCount: 0, hasActiveInput: false };
        updated.set(roomId, room);
      }
      const newRoom = { ...room, messages: [...room.messages, ...msgs] };
      const last = msgs[msgs.length - 1];
      if (last) {
        newRoom.lastMessagePreview = last.content.substring(0, 50);
        newRoom.lastMessageTimestamp = last.timestamp;
      }
      if (roomId !== currentActive) {
        newRoom.unreadCount = (room.unreadCount || 0) + msgs.length;
      }
      updated.set(roomId, newRoom);
      return updated;
    });
  }, []);

  /** Calculate typing delay based on message content */
  const calcTypingDelay = (msg: ChatMessage): number => {
    if (msg.type === 'image') return 1000;
    if (msg.type === 'system' || msg.type === 'task' || msg.type === 'timer') return 0;
    const len = msg.content.length;
    return Math.min(3000, Math.max(500, 500 + len * 30));
  };

  /** Apply deferred completion: add status message + exit VN mode */
  const applyDeferredCompletion = useCallback(() => {
    if (!pendingStatusMsg.current) return;
    const statusMsg = pendingStatusMsg.current;
    pendingStatusMsg.current = null;
    setHasPendingCompletion(false);
    setChatRooms((prev) => {
      const updated = new Map(prev);
      let addedToAny = false;
      for (const [id, room] of updated) {
        if (room.messages.length > 0) {
          updated.set(id, { ...room, messages: [...room.messages, statusMsg], hasActiveInput: false });
          addedToAny = true;
        }
      }
      if (!addedToAny) {
        const def = updated.get(DEFAULT_ROOM_ID) || createDefaultRoom();
        updated.set(DEFAULT_ROOM_ID, { ...def, messages: [...def.messages, statusMsg] });
      }
      return updated;
    });
    setViewMode((prev) => prev === 'vn' ? (hasChatRoomFeature ? 'chatList' : 'chatRoom') : prev);
    scrollToBottom();
  }, [hasChatRoomFeature, scrollToBottom]);

  /** Flush all queues immediately (on abandon) */
  const flushQueues = useCallback(() => {
    for (const item of chatQueue.current) {
      addMessagesToRoom(item.roomId, [item.message], activeChatId);
    }
    chatQueue.current = [];
    isDraining.current = false;
    if (chatDrainTimer.current) { clearTimeout(chatDrainTimer.current); chatDrainTimer.current = null; }
    setTypingIn(null);
    // Flush VN dialogue queue — add deferred chat messages + apply visual actions
    for (const entry of vnDialogueQueue.current) {
      if (entry.kind === 'dialogue' && entry.chatMsg) {
        addMessagesToRoom(entry.chatMsg.roomId, [entry.chatMsg.message], activeChatId);
      } else if (entry.kind === 'action') {
        entry.apply();
      }
    }
    vnDialogueQueue.current = [];
    pendingVnEnter.current = false;
    isVnDialogueActive.current = false;
    if (pendingInputSpec.current) {
      setInputSpec(pendingInputSpec.current);
      pendingInputSpec.current = null;
    }
  }, [addMessagesToRoom, activeChatId]);

  /** Show next VN queue entry: dialogue waits for click, action auto-advances */
  const showNextVnDialogue = useCallback(() => {
    if (vnDialogueQueue.current.length === 0) {
      isVnDialogueActive.current = false;
      if (pendingInputSpec.current) {
        setInputSpec(pendingInputSpec.current);
        pendingInputSpec.current = null;
      }
      if (!isDraining.current && pendingStatusMsg.current) {
        applyDeferredCompletion();
      }
      return;
    }
    const entry = vnDialogueQueue.current.shift()!;
    if (entry.kind === 'action') {
      // Visual action (sprite/bg) — apply immediately and continue to next entry
      entry.apply();
      showNextVnDialogue();
      return;
    }
    // Dialogue entry — display and wait for user click
    isVnDialogueActive.current = true;
    if (entry.chatMsg) {
      addMessagesToRoom(entry.chatMsg.roomId, [entry.chatMsg.message], activeChatId);
    }
    setVNState(prev => ({
      ...prev,
      currentDialogue: { speaker: entry.speaker, speakerAvatar: entry.speakerAvatar, text: entry.text },
    }));
  }, [applyDeferredCompletion, addMessagesToRoom, activeChatId]);

  /** Drain one chat message from queue, then recurse */
  const drainNextChatMessage = useCallback(() => {
    if (chatQueue.current.length === 0) {
      isDraining.current = false;
      setTypingIn(null);
      scrollToBottom();

      // Apply pending VN mode enter
      if (pendingVnEnter.current) {
        pendingVnEnter.current = false;
        // Brief delay so user can read the last chat message before VN transition
        chatDrainTimer.current = setTimeout(() => {
          setViewMode('vn');
          if (vnDialogueQueue.current.length > 0) {
            showNextVnDialogue();
            // Don't apply pendingInputSpec yet — let VN queue drain first
            // showNextVnDialogue will apply it when vnDialogueQueue empties
          } else {
            // No VN dialogues queued, apply pending input/completion now
            if (pendingInputSpec.current) {
              setInputSpec(pendingInputSpec.current);
              if (pendingInputSpec.current.type === 'TIMER' && pendingInputSpec.current.timeLimit) {
                setTimerEndTime(Date.now() + pendingInputSpec.current.timeLimit * 1000);
              }
              pendingInputSpec.current = null;
            }
            if (pendingStatusMsg.current) applyDeferredCompletion();
          }
        }, 800);
        return;
      }

      // No VN pending — apply inputSpec and completion directly
      if (pendingInputSpec.current) {
        setInputSpec(pendingInputSpec.current);
        if (pendingInputSpec.current.type === 'TIMER' && pendingInputSpec.current.timeLimit) {
          setTimerEndTime(Date.now() + pendingInputSpec.current.timeLimit * 1000);
        }
        pendingInputSpec.current = null;
      }
      if (vnDialogueQueue.current.length === 0 && pendingStatusMsg.current) {
        applyDeferredCompletion();
      }
      return;
    }
    const item = chatQueue.current[0];
    setTypingIn({ roomId: item.roomId, speaker: item.message.speaker, speakerAvatar: item.message.speakerAvatar, speakerColor: item.message.speakerColor });
    scrollToBottom();
    chatDrainTimer.current = setTimeout(() => {
      chatQueue.current.shift();
      setTypingIn(null);
      addMessagesToRoom(item.roomId, [item.message], activeChatId);
      scrollToBottom();
      drainNextChatMessage();
    }, calcTypingDelay(item.message));
  }, [addMessagesToRoom, activeChatId, scrollToBottom, applyDeferredCompletion, showNextVnDialogue]);

  /** Start draining chat queue if not already running */
  const startChatDrain = useCallback(() => {
    if (isDraining.current) return;
    isDraining.current = true;
    drainNextChatMessage();
  }, [drainNextChatMessage]);

  // Process display commands into chat room messages + VN state
  const processCommands = useCallback((commands: DisplayCommand[]) => {
    // Batch messages by room
    const roomBatch = new Map<string, ChatMessage[]>();
    const addToBatch = (roomId: string, msg: ChatMessage) => {
      if (!roomBatch.has(roomId)) roomBatch.set(roomId, []);
      roomBatch.get(roomId)!.push(msg);
    };

    let detectedChatFeature = false;
    const newRooms: ChatRoom[] = [];
    // Track viewMode locally so VN_ENTER/VN_EXIT take effect within same batch
    let currentViewMode = viewMode;

    for (const cmd of commands) {
      if (processedCommandIds.current.has(cmd.id)) continue;
      processedCommandIds.current.add(cmd.id);

      const chatId = cmd.data.chatId || DEFAULT_ROOM_ID;

      switch (cmd.type) {
        case 'CHAT_OPEN':
          detectedChatFeature = true;
          newRooms.push({
            id: cmd.data.chatId || `chat_${cmd.id}`,
            name: cmd.data.chatName || '聊天',
            avatar: cmd.data.chatAvatar || undefined,
            type: (cmd.data.chatType as 'private' | 'group') || 'private',
            messages: [],
            unreadCount: 0,
            hasActiveInput: false,
          });
          break;

        case 'CHAT_SWITCH':
          // No visual effect; routing handled by backend
          break;

        case 'TEXT': {
          const textMsg: ChatMessage = {
            id: cmd.id,
            type: 'text',
            content: cmd.data.text || '',
            speaker: cmd.data.speaker || undefined,
            speakerAvatar: cmd.data.speakerAvatar || undefined,
            speakerColor: cmd.data.speakerColor || undefined,
            timestamp: Date.now(),
          };
          if (isRestoring.current) {
            // Restoring saved state — show instantly, no animation
            addToBatch(chatId, textMsg);
          } else if (textMsg.speaker && currentViewMode === 'vn') {
            // In VN mode: show in VN dialogue box (click-to-advance)
            // Chat history deferred until displayed in showNextVnDialogue
            vnDialogueQueue.current.push({
              kind: 'dialogue',
              speaker: textMsg.speaker,
              speakerAvatar: textMsg.speakerAvatar,
              text: textMsg.content,
              chatMsg: { roomId: chatId, message: textMsg },
            });
          } else if (textMsg.speaker) {
            // In chat mode: NPC message → queue with typing animation
            chatQueue.current.push({ roomId: chatId, message: textMsg });
          } else {
            addToBatch(chatId, textMsg);
          }
          break;
        }

        case 'IMAGE': {
          const imgMsg: ChatMessage = {
            id: cmd.id,
            type: 'image',
            content: cmd.data.imageUrl || '',
            data: cmd.data,
            speaker: cmd.data.speaker || undefined,
            speakerAvatar: cmd.data.speakerAvatar || undefined,
            timestamp: Date.now(),
          };
          if (isRestoring.current) {
            addToBatch(chatId, imgMsg);
          } else if (imgMsg.speaker && (currentViewMode !== 'vn' || pendingVnEnter.current)) {
            // NPC image: queue with typing animation (chat mode, or VN pending)
            chatQueue.current.push({ roomId: chatId, message: imgMsg });
          } else {
            addToBatch(chatId, imgMsg);
          }
          break;
        }

        case 'TIMER':
          addToBatch(chatId, {
            id: cmd.id,
            type: 'timer',
            content: `${cmd.data.label || '倒计时'}: ${cmd.data.duration || '?'}秒`,
            data: cmd.data,
            timestamp: Date.now(),
          });
          break;

        case 'TASK_CREATED':
          addToBatch(chatId, {
            id: cmd.id,
            type: 'task',
            content: cmd.data.taskName || cmd.data.title || '新任务',
            data: {
              ...cmd.data,
              taskId: cmd.data.taskId,
              taskName: cmd.data.taskName || cmd.data.title || '新任务',
              description: cmd.data.description || '',
              taskType: cmd.data.taskType || 'MANUAL',
              targetValue: cmd.data.targetValue || '',
              targetUnit: cmd.data.targetUnit || '',
            },
            timestamp: Date.now(),
          });
          break;

        case 'CHOICE':
        case 'INPUT':
        case 'DICE':
          // Mark the room as having active input
          setChatRooms((prev) => {
            const updated = new Map(prev);
            // Clear previous hasActiveInput
            for (const [id, room] of updated) {
              if (room.hasActiveInput) updated.set(id, { ...room, hasActiveInput: false });
            }
            const room = updated.get(chatId);
            if (room) updated.set(chatId, { ...room, hasActiveInput: true });
            return updated;
          });
          break;

        // ── VN commands ──
        case 'VN_ENTER':
          currentViewMode = 'vn';
          // Defer viewMode switch if chat messages are still queued
          if (chatQueue.current.length > 0 || isDraining.current) {
            pendingVnEnter.current = true;
          } else {
            setViewMode('vn');
          }
          setVNState((prev) => ({
            ...prev,
            active: true,
            orientation: (cmd.data.orientation as 'portrait' | 'landscape') || 'portrait',
          }));
          break;
        case 'VN_EXIT':
          currentViewMode = hasChatRoomFeature ? 'chatList' : 'chatRoom';
          setViewMode(currentViewMode);
          setVNState((prev) => ({ ...prev, active: false, currentDialogue: null }));
          vnDialogueQueue.current = [];
          isVnDialogueActive.current = false;
          break;
        case 'VN_BG': {
          const bgUrl = cmd.data.imageUrl || null;
          const applyBg = () => setVNState((prev) => ({ ...prev, backgroundUrl: bgUrl }));
          if (vnDialogueQueue.current.length > 0) {
            vnDialogueQueue.current.push({ kind: 'action', apply: applyBg });
          } else {
            applyBg();
          }
          break;
        }
        case 'VN_SPRITE': {
          const spriteData = {
            position: (cmd.data.position as 'left' | 'center' | 'right') || 'center',
            imageUrl: cmd.data.imageUrl || '',
            characterId: cmd.data.characterId || undefined,
          };
          const applySprite = () => setVNState((prev) => ({
            ...prev,
            sprites: [...prev.sprites.filter((s) => s.position !== spriteData.position), spriteData],
          }));
          if (vnDialogueQueue.current.length > 0) {
            // Queue after pending dialogues so sprite appears at the right moment
            vnDialogueQueue.current.push({ kind: 'action', apply: applySprite });
          } else {
            applySprite();
          }
          break;
        }
        case 'VN_CLEAR_SPRITES': {
          const target = cmd.data.target || 'all';
          const applyClear = () => setVNState((prev) => ({
            ...prev,
            sprites: target === 'all' ? [] : prev.sprites.filter((s) => s.position !== target),
          }));
          if (vnDialogueQueue.current.length > 0) {
            vnDialogueQueue.current.push({ kind: 'action', apply: applyClear });
          } else {
            applyClear();
          }
          break;
        }
        case 'VN_DIALOGUE':
          if (isRestoring.current) {
            // Restoring — add to chat history instantly
            addToBatch(chatId, {
              id: cmd.id,
              type: 'text',
              content: cmd.data.text || '',
              speaker: cmd.data.speaker || undefined,
              speakerAvatar: cmd.data.speakerAvatar || undefined,
              timestamp: Date.now(),
            });
          } else {
            // Queue for VN visual display (shown one at a time via click)
            vnDialogueQueue.current.push({
              kind: 'dialogue',
              speaker: cmd.data.speaker || '',
              speakerAvatar: cmd.data.speakerAvatar || undefined,
              text: cmd.data.text || '',
              chatMsg: { roomId: chatId, message: {
                id: cmd.id,
                type: 'text',
                content: cmd.data.text || '',
                speaker: cmd.data.speaker || undefined,
                speakerAvatar: cmd.data.speakerAvatar || undefined,
                timestamp: Date.now(),
              }},
            });
          }
          break;
      }
    }

    // Apply new rooms
    if (newRooms.length > 0 || roomBatch.size > 0) {
      setChatRooms((prev) => {
        const updated = new Map(prev);
        for (const room of newRooms) {
          if (!updated.has(room.id)) updated.set(room.id, room);
        }
        for (const [roomId, msgs] of roomBatch) {
          let room = updated.get(roomId);
          if (!room) {
            room = { id: roomId, name: roomId, type: 'private', messages: [], unreadCount: 0, hasActiveInput: false };
          }
          const newRoom = { ...room, messages: [...room.messages, ...msgs] };
          const last = msgs[msgs.length - 1];
          if (last) {
            newRoom.lastMessagePreview = last.content.substring(0, 50);
            newRoom.lastMessageTimestamp = last.timestamp;
          }
          // Don't increment unread for the active room
          // Note: we read activeChatId via ref-like approach; use state callback
          updated.set(roomId, newRoom);
        }
        return updated;
      });
    }

    if (detectedChatFeature) {
      setHasChatRoomFeature(true);
      // If currently in single chatRoom mode, switch to chatList
      setViewMode((prev) => prev === 'chatRoom' ? 'chatList' : prev);
    }

    // Start queue drains after batch application
    if (chatQueue.current.length > 0) startChatDrain();
    // Only start VN drain if not waiting for chat to drain first
    if (vnDialogueQueue.current.length > 0 && currentViewMode === 'vn' && !pendingVnEnter.current) showNextVnDialogue();
  }, [hasChatRoomFeature, viewMode, startChatDrain, showNextVnDialogue]);

  const handleExecutionUpdate = useCallback((exec: ScriptExecutionResponse) => {
    setStatus(exec.status);
    processCommands(exec.displayCommands);

    if (exec.waitingForInput && exec.inputSpec) {
      // Defer inputSpec if queues are still draining or VN dialogue is being displayed
      const queuesActive = isDraining.current || chatQueue.current.length > 0 || vnDialogueQueue.current.length > 0 || pendingVnEnter.current || isVnDialogueActive.current;
      if (queuesActive) {
        pendingInputSpec.current = exec.inputSpec;
        setInputSpec(null); // Clear current so old choice doesn't show during queue drain
      } else {
        setInputSpec(exec.inputSpec);
        if (exec.inputSpec.type === 'TIMER' && exec.inputSpec.timeLimit) {
          setTimerEndTime(Date.now() + exec.inputSpec.timeLimit * 1000);
          setTimeout(() => {
            if (exec.inputSpec) {
              api.submitInput(exec.executionId, { nodeId: exec.inputSpec.nodeId, value: 'expired' })
                .then(handleExecutionUpdate)
                .catch(() => {});
            }
          }, exec.inputSpec.timeLimit * 1000);
        }
      }
    } else if (!exec.waitingForInput) {
      setInputSpec(null);
      pendingInputSpec.current = null;
    }

    if (['COMPLETED', 'FAILED', 'ERROR', 'CANCELLED'].includes(exec.status)) {
      stopPolling();
      const statusMsg: ChatMessage = {
        id: `status-${Date.now()}`,
        type: 'system',
        content: exec.status === 'COMPLETED' ? '脚本执行完成' :
                 exec.status === 'FAILED' ? '脚本执行失败' :
                 exec.status === 'ERROR' ? '脚本执行出错' : '执行已取消',
        timestamp: Date.now(),
      };
      // If queues are active or VN dialogue being displayed, defer status message
      const queuesActive = isDraining.current || chatQueue.current.length > 0 || vnDialogueQueue.current.length > 0 || pendingVnEnter.current || isVnDialogueActive.current;
      if (queuesActive) {
        pendingStatusMsg.current = statusMsg;
        setHasPendingCompletion(true);
      } else {
        // No queues → apply immediately
        setChatRooms((prev) => {
          const updated = new Map(prev);
          let addedToAny = false;
          for (const [id, room] of updated) {
            if (room.messages.length > 0) {
              updated.set(id, { ...room, messages: [...room.messages, statusMsg], hasActiveInput: false });
              addedToAny = true;
            }
          }
          if (!addedToAny) {
            const def = updated.get(DEFAULT_ROOM_ID) || createDefaultRoom();
            updated.set(DEFAULT_ROOM_ID, { ...def, messages: [...def.messages, statusMsg] });
          }
          return updated;
        });
        if (viewMode === 'vn') setViewMode(hasChatRoomFeature ? 'chatList' : 'chatRoom');
      }
    }

    scrollToBottom();
  }, [processCommands, scrollToBottom, viewMode, hasChatRoomFeature]);

  const startPolling = useCallback((execId: number) => {
    if (pollingRef.current) clearInterval(pollingRef.current);
    pollingRef.current = setInterval(async () => {
      try {
        const exec = await api.getExecution(execId);
        handleExecutionUpdate(exec);
      } catch {
        // Silently ignore polling errors
      }
    }, 2000);
  }, [api, handleExecutionUpdate]);

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      setLoading(true);
      try {
        const exec = await api.startExecution(gameId);
        if (cancelled) return;
        setExecutionId(exec.executionId);
        // If resuming an existing execution, skip animations — show state instantly
        const isResuming = processedCommandIds.current.size === 0 && exec.displayCommands.length > 0
          && (exec.status === 'WAITING_INPUT' || exec.status === 'PAUSED');
        if (isResuming) isRestoring.current = true;
        handleExecutionUpdate(exec);
        if (isResuming) isRestoring.current = false;
        if (exec.status === 'RUNNING' || exec.status === 'WAITING_INPUT') {
          startPolling(exec.executionId);
        }
      } catch (e: any) {
        if (!cancelled) setError(e.message || '启动脚本失败');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    init();
    return () => {
      cancelled = true;
      stopPolling();
      if (chatDrainTimer.current) { clearTimeout(chatDrainTimer.current); chatDrainTimer.current = null; }
    };
  }, [gameId]);

  useEffect(() => {
    if (!timerEndTime) return;
    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((timerEndTime - Date.now()) / 1000));
      setTimerRemaining(remaining);
      if (remaining <= 0) { clearInterval(interval); setTimerEndTime(null); }
    }, 100);
    return () => clearInterval(interval);
  }, [timerEndTime]);

  // Auto-open choice drawer when new choices arrive
  useEffect(() => {
    if (inputSpec?.type === 'CHOICE') {
      setChoiceDrawerOpen(true);
    } else {
      setChoiceDrawerOpen(false);
    }
  }, [inputSpec]);

  // ── Input submission helpers ──

  /** Helper: add player message to the correct chat room */
  const addPlayerMessage = useCallback((msg: ChatMessage) => {
    const targetRoom = inputSpec?.chatId || activeChatId;
    setChatRooms((prev) => {
      const updated = new Map(prev);
      const room = updated.get(targetRoom);
      if (room) {
        updated.set(targetRoom, {
          ...room,
          messages: [...room.messages, msg],
          lastMessagePreview: msg.content.substring(0, 50),
          lastMessageTimestamp: msg.timestamp,
        });
      }
      return updated;
    });
  }, [inputSpec, activeChatId]);

  const handleSubmitChoice = async (choiceIndex: number) => {
    if (!executionId || !inputSpec || submitting) return;
    setSubmitting(true);
    const choiceLabel = inputSpec.choices?.find((c) => c.index === choiceIndex)?.label || `选项 ${choiceIndex}`;
    const nodeId = inputSpec.nodeId;
    setInputSpec(null); // Clear immediately so old choice doesn't linger during VN transition
    addPlayerMessage({ id: `choice-${Date.now()}`, type: 'choice-made', content: choiceLabel, timestamp: Date.now() });
    try {
      const exec = await api.submitInput(executionId, { nodeId, value: String(choiceIndex) });
      handleExecutionUpdate(exec);
      if (exec.status === 'RUNNING' || exec.status === 'WAITING_INPUT') startPolling(executionId);
    } catch (e: any) {
      addPlayerMessage({ id: `err-${Date.now()}`, type: 'system', content: `提交失败: ${e.message}`, timestamp: Date.now() });
    } finally {
      setSubmitting(false);
      scrollToBottom();
    }
  };

  const handleSubmitText = async () => {
    if (!executionId || !inputSpec || submitting || !textInput.trim()) return;
    setSubmitting(true);
    const nodeId = inputSpec.nodeId;
    const value = textInput.trim();
    setTextInput('');
    setInputSpec(null); // Clear immediately so old input doesn't linger
    addPlayerMessage({ id: `input-${Date.now()}`, type: 'choice-made', content: value, timestamp: Date.now() });
    try {
      const exec = await api.submitInput(executionId, { nodeId, value });
      handleExecutionUpdate(exec);
      if (exec.status === 'RUNNING' || exec.status === 'WAITING_INPUT') startPolling(executionId);
    } catch (e: any) {
      addPlayerMessage({ id: `err-${Date.now()}`, type: 'system', content: `提交失败: ${e.message}`, timestamp: Date.now() });
    } finally {
      setSubmitting(false);
      scrollToBottom();
    }
  };

  /** Generic submit for VN dialogue advance */
  const handleSubmitRaw = async (nodeId: string, value: string) => {
    if (!executionId || submitting) return;
    setSubmitting(true);
    setInputSpec(null); // Clear immediately so old input doesn't linger
    try {
      const exec = await api.submitInput(executionId, { nodeId, value });
      handleExecutionUpdate(exec);
      if (exec.status === 'RUNNING' || exec.status === 'WAITING_INPUT') startPolling(executionId);
    } catch (e: any) {
      addPlayerMessage({ id: `err-${Date.now()}`, type: 'system', content: `提交失败: ${e.message}`, timestamp: Date.now() });
    } finally {
      setSubmitting(false);
    }
  };

  const handleAbandon = async () => {
    if (!executionId) return;
    try {
      await api.abandonExecution(executionId);
      stopPolling();
      flushQueues();
      pendingStatusMsg.current = null;
      setHasPendingCompletion(false);
      setStatus('CANCELLED');
      setInputSpec(null);
      if (viewMode === 'vn') setViewMode(hasChatRoomFeature ? 'chatList' : 'chatRoom');
    } catch (e: any) {
      addPlayerMessage({ id: `err-${Date.now()}`, type: 'system', content: `放弃失败: ${e.message}`, timestamp: Date.now() });
    }
  };

  const handleForceRestart = async () => {
    setError(null);
    setLoading(true);
    try {
      const exec = await api.startExecution(gameId);
      setExecutionId(exec.executionId);
      handleExecutionUpdate(exec);
      if (exec.status === 'RUNNING' || exec.status === 'WAITING_INPUT') startPolling(exec.executionId);
    } catch (e: any) {
      if (executionId) { try { await api.abandonExecution(executionId); } catch { /* ignore */ } }
      setError(e.message || '启动失败');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenChat = (roomId: string) => {
    setActiveChatId(roomId);
    setViewMode('chatRoom');
    // Clear unread
    setChatRooms((prev) => {
      const updated = new Map(prev);
      const room = updated.get(roomId);
      if (room && room.unreadCount > 0) {
        updated.set(roomId, { ...room, unreadCount: 0 });
      }
      return updated;
    });
  };

  const isFinished = ['COMPLETED', 'FAILED', 'ERROR', 'CANCELLED'].includes(status);
  const activeRoom = chatRooms.get(activeChatId);
  const activeMessages = activeRoom?.messages || [];

  // Determine if the input belongs to the active room
  const inputRoomId = inputSpec?.chatId || DEFAULT_ROOM_ID;
  const inputInActiveRoom = inputRoomId === activeChatId;
  // Find the room that needs input (for notification banner)
  const inputRoom = inputSpec ? chatRooms.get(inputRoomId) : null;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-slate-50 dark:bg-slate-900">
        <Loader2 className="w-8 h-8 animate-spin text-teal-500 dark:text-teal-400 mb-3" />
        <p className="text-sm text-slate-500 dark:text-slate-400">正在启动脚本...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-slate-50 dark:bg-slate-900 p-6">
        <AlertTriangle className="w-12 h-12 text-amber-400 dark:text-amber-300 mb-3" />
        <p className="text-sm text-slate-600 dark:text-slate-300 mb-4">{error}</p>
        <div className="flex gap-3">
          <button onClick={onBack} className="px-4 py-2 bg-teal-500 text-white rounded-xl text-sm hover:bg-teal-600">返回</button>
          <button onClick={handleForceRestart} className="px-4 py-2 bg-amber-500 text-white rounded-xl text-sm hover:bg-amber-600">重试</button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900 lg:max-w-150 lg:mx-auto lg:w-full">
      {/* Header */}
      <div className={`${viewMode === 'vn' ? 'bg-black/80 border-white/10' : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700'} border-b px-4 py-3 flex items-center gap-3 z-20 relative`}>
        {/* Back button: in chatRoom mode with multi-room, go to chatList; otherwise exit */}
        <button
          onClick={() => {
            if (viewMode === 'chatRoom' && hasChatRoomFeature) {
              setViewMode('chatList');
            } else {
              onBack();
            }
          }}
          className="p-1.5 hover:bg-white/10 dark:bg-slate-800/10 rounded-full"
        >
          {viewMode === 'chatRoom' && hasChatRoomFeature ? (
            <ChevronLeft size={20} className="text-slate-600 dark:text-slate-300" />
          ) : (
            <ArrowLeft size={20} className={viewMode === 'vn' ? 'text-white/80' : 'text-slate-600 dark:text-slate-300'} />
          )}
        </button>
        <div className="flex-1 min-w-0">
          {viewMode === 'chatRoom' && hasChatRoomFeature && activeRoom ? (
            <>
              <h2 className="text-sm font-semibold truncate text-slate-800 dark:text-slate-100">
                {activeRoom.name}
                {activeRoom.type === 'group' && <Users size={12} className="inline ml-1 text-slate-400 dark:text-slate-500" />}
              </h2>
              <p className="text-[10px] text-slate-400 dark:text-slate-500">
                {status === 'WAITING_INPUT' && inputInActiveRoom && '等待你的输入'}
                {status === 'RUNNING' && '运行中'}
              </p>
            </>
          ) : (
            <>
              <h2 className={`text-sm font-semibold truncate ${viewMode === 'vn' ? 'text-white' : 'text-slate-800 dark:text-slate-100'}`}>
                {viewMode === 'chatList' ? (gameTitle || '消息') : (gameTitle || '脚本游戏')}
              </h2>
              <p className={`text-[10px] ${viewMode === 'vn' ? 'text-white/50' : 'text-slate-400 dark:text-slate-500'}`}>
                {status === 'RUNNING' && '运行中'}
                {status === 'WAITING_INPUT' && '等待你的输入'}
                {status === 'COMPLETED' && '已完成'}
                {status === 'FAILED' && '已失败'}
                {status === 'ERROR' && '出错了'}
                {status === 'CANCELLED' && '已取消'}
              </p>
            </>
          )}
        </div>
        {!isFinished && (
          <button onClick={handleAbandon} className={`px-3 py-1.5 text-xs rounded-lg ${viewMode === 'vn' ? 'text-rose-300 hover:bg-white/10 dark:bg-slate-800/10' : 'text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950'}`}>
            放弃
          </button>
        )}
      </div>

      {/* ── Content area ── */}
      {viewMode === 'chatList' ? (
        /* ── Chat List Screen ── */
        <div className="flex-1 overflow-y-auto">
          {Array.from(chatRooms.values())
            .filter((r) => r.id !== DEFAULT_ROOM_ID || r.messages.length > 0)
            .sort((a, b) => (b.lastMessageTimestamp || 0) - (a.lastMessageTimestamp || 0))
            .map((room) => (
              <button
                key={room.id}
                onClick={() => handleOpenChat(room.id)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-100 dark:hover:bg-slate-700 active:bg-slate-200 dark:bg-slate-700 transition-colors border-b border-slate-50 dark:border-slate-700 text-left"
              >
                {/* Avatar */}
                <div className="w-11 h-11 rounded-full shrink-0 flex items-center justify-center overflow-hidden bg-teal-100">
                  {room.avatar ? (
                    <img src={room.avatar} className="w-full h-full object-cover" alt="" />
                  ) : room.type === 'group' ? (
                    <Users size={20} className="text-teal-500 dark:text-teal-400" />
                  ) : (
                    <MessageSquare size={20} className="text-teal-500 dark:text-teal-400" />
                  )}
                </div>
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">{room.name}</span>
                    {room.lastMessageTimestamp && (
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 shrink-0 ml-2">
                        {new Date(room.lastMessageTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between mt-0.5">
                    <p className="text-xs text-slate-400 dark:text-slate-500 truncate">
                      {typingIn?.roomId === room.id
                        ? <span className="text-teal-500 dark:text-teal-400 italic">{typingIn.speaker || '对方'}正在输入...</span>
                        : (room.lastMessagePreview || '暂无消息')}
                    </p>
                    <div className="flex items-center gap-1.5 shrink-0 ml-2">
                      {room.hasActiveInput && (
                        <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse" />
                      )}
                      {room.unreadCount > 0 && (
                        <span className="min-w-4.5 h-4.5 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center px-1">
                          {room.unreadCount > 99 ? '99+' : room.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          {chatRooms.size <= 1 && (
            <div className="flex flex-col items-center justify-center py-16 text-slate-300">
              <MessageSquare size={32} />
              <p className="text-sm mt-2">等待游戏开始...</p>
            </div>
          )}
        </div>
      ) : viewMode === 'chatRoom' ? (
        <>
          {/* Chat message area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {activeMessages.map((msg) => <MessageBubble key={msg.id} message={msg} />)}
            {typingIn && typingIn.roomId === activeChatId && (
              <TypingBubble indicator={typingIn} />
            )}
            {timerEndTime && timerRemaining > 0 && (
              <div className="flex justify-center">
                <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-2xl px-6 py-3 flex items-center gap-2">
                  <Timer size={18} className="text-amber-500 dark:text-amber-400" />
                  <span className="text-2xl font-mono font-bold text-amber-600 dark:text-amber-400">{timerRemaining}s</span>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Input notification: input is in a different room */}
          {!isFinished && inputSpec && !inputInActiveRoom && inputRoom && (
            <div className="bg-teal-50 dark:bg-teal-950 border-t border-teal-200 px-4 py-2.5 flex items-center justify-between">
              <p className="text-xs text-teal-700 truncate">
                <span className="font-medium">{inputRoom.name}</span> 等待你的回复
              </p>
              <button
                onClick={() => handleOpenChat(inputRoomId)}
                className="px-3 py-1 bg-teal-500 text-white text-xs rounded-lg hover:bg-teal-600 shrink-0 ml-2"
              >
                前往
              </button>
            </div>
          )}

          {/* Choice drawer trigger bar */}
          {!isFinished && inputSpec?.type === 'CHOICE' && inputInActiveRoom && (
            <button
              onClick={() => setChoiceDrawerOpen(true)}
              className="bg-white dark:bg-slate-800 border-t border-slate-100 dark:border-slate-700 px-4 py-3.5 flex items-center justify-between w-full text-left"
            >
              <span className="text-sm text-slate-500 dark:text-slate-400 truncate">{inputSpec.prompt || '请选择...'}</span>
              <ChevronUp size={18} className="text-slate-400 dark:text-slate-500 shrink-0 ml-2" />
            </button>
          )}

          {/* Choice drawer (fixed overlay) */}
          {inputSpec?.type === 'CHOICE' && inputSpec.choices && choiceDrawerOpen && (
            <div className="fixed inset-0 z-9999 bg-black/40 flex flex-col justify-end" onClick={() => setChoiceDrawerOpen(false)}>
              <div className="flex-1" />
              <div
                className="bg-white dark:bg-slate-800 rounded-t-2xl shadow-[0_-4px_30px_rgba(0,0,0,0.12)] max-h-[70vh] flex flex-col animate-in slide-in-from-bottom duration-300"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Drawer handle */}
                <div className="flex justify-center pt-3 pb-1">
                  <div className="w-10 h-1 bg-slate-200 dark:bg-slate-700 rounded-full" />
                </div>
                {/* Drawer header */}
                <div className="px-5 pb-3 flex items-center justify-between border-b border-slate-100 dark:border-slate-700">
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{inputSpec.prompt || '请选择'}</p>
                  <button onClick={() => setChoiceDrawerOpen(false)} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full">
                    <ChevronDown size={18} className="text-slate-400 dark:text-slate-500" />
                  </button>
                </div>
                {/* Choices */}
                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                  {inputSpec.choices.map((choice) => (
                    <button
                      key={choice.index}
                      onClick={() => { handleSubmitChoice(choice.index); setChoiceDrawerOpen(false); }}
                      disabled={submitting}
                      className="w-full text-left px-4 py-3.5 bg-teal-50 dark:bg-teal-950 hover:bg-teal-100 border border-teal-200 rounded-xl text-sm text-teal-800 dark:text-teal-200 transition-colors disabled:opacity-50 active:scale-[0.98]"
                    >
                      <span className="font-medium">{choice.label}</span>
                      {choice.description && <span className="block text-xs text-teal-600 dark:text-teal-400 mt-0.5">{choice.description}</span>}
                    </button>
                  ))}
                </div>
                {submitting && (
                  <div className="flex justify-center py-3 border-t border-slate-100 dark:border-slate-700">
                    <Loader2 size={20} className="animate-spin text-teal-500 dark:text-teal-400" />
                  </div>
                )}
                {/* Safe area padding */}
                <div className="pb-[env(safe-area-inset-bottom,20px)]" />
              </div>
            </div>
          )}

          {/* Chat input area (non-choice types) */}
          {!isFinished && inputSpec && inputInActiveRoom && inputSpec.type !== 'CHOICE' && (
            <div className="bg-white dark:bg-slate-800 border-t border-slate-100 dark:border-slate-700 p-4">
              {(inputSpec.type === 'TEXT' || inputSpec.type === 'NUMBER') && (
                <div>
                  {inputSpec.prompt && <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">{inputSpec.prompt}</p>}
                  <div className="flex gap-2">
                    <input
                      type={inputSpec.type === 'NUMBER' ? 'number' : 'text'}
                      value={textInput}
                      onChange={(e) => setTextInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleSubmitText(); }}
                      placeholder={inputSpec.type === 'NUMBER' ? '输入数字...' : '输入内容...'}
                      className="flex-1 px-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:border-teal-400"
                      disabled={submitting}
                    />
                    <button
                      onClick={handleSubmitText}
                      disabled={submitting || !textInput.trim()}
                      className="px-4 py-2.5 bg-teal-500 text-white rounded-xl hover:bg-teal-600 disabled:opacity-50 transition-colors"
                    >
                      {submitting ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                    </button>
                  </div>
                </div>
              )}

              {inputSpec.type === 'IMAGE_UPLOAD' && (
                <ImageUploadInput
                  prompt={inputSpec.prompt}
                  submitting={submitting}
                  onSubmit={(url) => {
                    if (!executionId || !inputSpec || submitting) return;
                    const nodeId = inputSpec.nodeId;
                    setSubmitting(true);
                    addPlayerMessage({ id: `input-${Date.now()}`, type: 'image', content: url, timestamp: Date.now() });
                    api.submitInput(executionId, { nodeId, value: url })
                      .then((exec) => { handleExecutionUpdate(exec); if (exec.status === 'RUNNING' || exec.status === 'WAITING_INPUT') startPolling(executionId); })
                      .catch((e: any) => { addPlayerMessage({ id: `err-${Date.now()}`, type: 'system', content: `上传失败: ${e.message}`, timestamp: Date.now() }); })
                      .finally(() => { setSubmitting(false); scrollToBottom(); });
                  }}
                />
              )}

              {inputSpec.type === 'DICE' && (
                <DiceRollInput
                  prompt={inputSpec.prompt}
                  sides={inputSpec.sides || 6}
                  result={inputSpec.result || 1}
                  submitting={submitting}
                  onRolled={(result) => {
                    if (!executionId || !inputSpec || submitting) return;
                    const nodeId = inputSpec.nodeId;
                    setSubmitting(true);
                    addPlayerMessage({ id: `dice-${Date.now()}`, type: 'choice-made', content: `🎲 掷出了 ${result}`, timestamp: Date.now() });
                    api.submitInput(executionId, { nodeId, value: String(result) })
                      .then((exec) => { handleExecutionUpdate(exec); if (exec.status === 'RUNNING' || exec.status === 'WAITING_INPUT') startPolling(executionId); })
                      .catch((e: any) => { addPlayerMessage({ id: `err-${Date.now()}`, type: 'system', content: `提交失败: ${e.message}`, timestamp: Date.now() }); })
                      .finally(() => { setSubmitting(false); scrollToBottom(); });
                  }}
                />
              )}
            </div>
          )}
        </>
      ) : (
        /* ── VN Mode ── */
        <VNModeView
          vnState={vnState}
          inputSpec={inputSpec}
          submitting={submitting}
          onSubmitChoice={handleSubmitChoice}
          onSubmitText={(value) => {
            if (!executionId || !inputSpec || submitting) return;
            setSubmitting(true);
            addPlayerMessage({ id: `input-${Date.now()}`, type: 'choice-made', content: value, timestamp: Date.now() });
            api.submitInput(executionId, { nodeId: inputSpec.nodeId, value })
              .then((exec) => { handleExecutionUpdate(exec); if (exec.status === 'RUNNING' || exec.status === 'WAITING_INPUT') startPolling(executionId); })
              .catch((e: any) => { addPlayerMessage({ id: `err-${Date.now()}`, type: 'system', content: `提交失败: ${e.message}`, timestamp: Date.now() }); })
              .finally(() => { setSubmitting(false); });
          }}
          onSubmitDice={(result) => {
            if (!executionId || !inputSpec || submitting) return;
            setSubmitting(true);
            addPlayerMessage({ id: `dice-${Date.now()}`, type: 'choice-made', content: `🎲 掷出了 ${result}`, timestamp: Date.now() });
            api.submitInput(executionId, { nodeId: inputSpec.nodeId, value: String(result) })
              .then((exec) => { handleExecutionUpdate(exec); if (exec.status === 'RUNNING' || exec.status === 'WAITING_INPUT') startPolling(executionId); })
              .catch((e: any) => { addPlayerMessage({ id: `err-${Date.now()}`, type: 'system', content: `提交失败: ${e.message}`, timestamp: Date.now() }); })
              .finally(() => { setSubmitting(false); });
          }}
          onSubmitImageUpload={(url) => {
            if (!executionId || !inputSpec || submitting) return;
            setSubmitting(true);
            addPlayerMessage({ id: `input-${Date.now()}`, type: 'image', content: url, timestamp: Date.now() });
            api.submitInput(executionId, { nodeId: inputSpec.nodeId, value: url })
              .then((exec) => { handleExecutionUpdate(exec); if (exec.status === 'RUNNING' || exec.status === 'WAITING_INPUT') startPolling(executionId); })
              .catch((e: any) => { addPlayerMessage({ id: `err-${Date.now()}`, type: 'system', content: `上传失败: ${e.message}`, timestamp: Date.now() }); })
              .finally(() => { setSubmitting(false); });
          }}
          canAdvance={vnDialogueQueue.current.length > 0 || isVnDialogueActive.current || inputSpec?.type === 'VN_DIALOGUE' || hasPendingCompletion}
          onAdvanceDialogue={() => {
            if (vnDialogueQueue.current.length > 0) {
              showNextVnDialogue();
            } else if (isVnDialogueActive.current) {
              // Last dialogue was displayed — acknowledge it and apply pending state
              showNextVnDialogue(); // queue empty → will set isVnDialogueActive=false + apply pendingInputSpec
            } else if (inputSpec?.type === 'VN_DIALOGUE') {
              handleSubmitRaw(inputSpec.nodeId, 'continue');
            } else if (hasPendingCompletion) {
              applyDeferredCompletion();
            }
          }}
          timerEndTime={timerEndTime}
          timerRemaining={timerRemaining}
        />
      )}

      {/* Finished bottom bar */}
      {isFinished && (
        <div className="bg-white dark:bg-slate-800 border-t border-slate-100 dark:border-slate-700 p-4 flex gap-3">
          <button onClick={onBack} className="flex-1 px-4 py-2.5 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-sm font-medium hover:bg-slate-200 dark:hover:bg-slate-600">
            返回
          </button>
          {onFinished && (
            <button onClick={onFinished} className="flex-1 px-4 py-2.5 bg-teal-500 text-white rounded-xl text-sm font-medium hover:bg-teal-600">
              完成
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ==================== Message Bubble ====================

function MessageBubble({ message }: { message: ChatMessage }) {
  switch (message.type) {
    case 'text': {
      const hasSpeaker = !!message.speaker;
      const color = message.speakerColor || '#0d9488';
      return (
        <div className="flex items-start gap-2">
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 overflow-hidden"
            style={{ backgroundColor: hasSpeaker && message.speakerAvatar ? 'transparent' : color }}
          >
            {message.speakerAvatar ? (
              <img src={message.speakerAvatar} className="w-full h-full object-cover" alt={message.speaker || ''} />
            ) : (
              <MessageSquare size={14} className="text-white" />
            )}
          </div>
          <div className="max-w-[85%]">
            {hasSpeaker && (
              <p className="text-xs font-medium mb-0.5" style={{ color }}>{message.speaker}</p>
            )}
            <div
              className="rounded-2xl rounded-tl-md px-4 py-2.5 shadow-sm"
              style={hasSpeaker ? { backgroundColor: `${color}10`, borderLeft: `3px solid ${color}` } : { backgroundColor: 'var(--card)' }}
            >
              <p className="text-sm text-slate-700 dark:text-slate-200 whitespace-pre-wrap">{message.content}</p>
            </div>
          </div>
        </div>
      );
    }

    case 'image': {
      const hasSpeaker = !!message.speaker;
      const color = '#0d9488';
      return (
        <div className="flex items-start gap-2">
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 overflow-hidden"
            style={{ backgroundColor: hasSpeaker && message.speakerAvatar ? 'transparent' : color }}
          >
            {message.speakerAvatar ? (
              <img src={message.speakerAvatar} className="w-full h-full object-cover" alt={message.speaker || ''} />
            ) : (
              <ImageIcon size={14} className="text-white" />
            )}
          </div>
          <div className="max-w-[85%]">
            {hasSpeaker && (
              <p className="text-xs font-medium mb-0.5" style={{ color }}>{message.speaker}</p>
            )}
            <div className="bg-white dark:bg-slate-800 rounded-2xl rounded-tl-md overflow-hidden shadow-sm">
              {message.data?.caption && (
                <p className="text-sm text-slate-700 dark:text-slate-200 px-4 pt-2.5">{message.data.caption}</p>
              )}
              <img
                src={message.content}
                alt={message.data?.caption || '图片'}
                className="max-w-full max-h-64 object-contain"
                loading="lazy"
              />
            </div>
          </div>
        </div>
      );
    }

    case 'choice-made':
      return (
        <div className="flex justify-end">
          <div className="bg-teal-500 rounded-2xl rounded-tr-md px-4 py-2.5 max-w-[75%]">
            <p className="text-sm text-white">{message.content}</p>
          </div>
        </div>
      );

    case 'timer':
      return (
        <div className="flex justify-center">
          <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-xl px-4 py-2 flex items-center gap-2">
            <Clock size={14} className="text-amber-500 dark:text-amber-400" />
            <span className="text-xs text-amber-700 dark:text-amber-400">{message.content}</span>
          </div>
        </div>
      );

    case 'task':
      return (
        <ScriptTaskBubble
          taskId={message.data?.taskId ? parseInt(message.data.taskId) : null}
          taskName={message.data?.taskName || message.content}
          description={message.data?.description}
          taskType={message.data?.taskType || 'MANUAL'}
          targetValue={message.data?.targetValue}
          targetUnit={message.data?.targetUnit}
        />
      );

    case 'system':
      return (
        <div className="flex justify-center">
          <div className="bg-slate-100 dark:bg-slate-700 rounded-full px-4 py-1.5 flex items-center gap-1.5">
            {message.content.includes('完成') ? (
              <CheckCircle size={12} className="text-green-500 dark:text-green-400" />
            ) : message.content.includes('失败') || message.content.includes('出错') ? (
              <XCircle size={12} className="text-rose-500 dark:text-rose-400" />
            ) : (
              <AlertTriangle size={12} className="text-amber-500 dark:text-amber-400" />
            )}
            <span className="text-xs text-slate-500 dark:text-slate-400">{message.content}</span>
          </div>
        </div>
      );

    default:
      return null;
  }
}

// ==================== Typing Bubble ====================

function TypingBubble({ indicator }: { indicator: { roomId: string; speaker?: string; speakerAvatar?: string; speakerColor?: string } }) {
  const color = indicator.speakerColor || '#0d9488';
  return (
    <div className="flex items-start gap-2">
      <div
        className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 overflow-hidden"
        style={{ backgroundColor: indicator.speakerAvatar ? 'transparent' : color }}
      >
        {indicator.speakerAvatar ? (
          <img src={indicator.speakerAvatar} className="w-full h-full object-cover" alt={indicator.speaker || ''} />
        ) : (
          <MessageSquare size={14} className="text-white" />
        )}
      </div>
      <div>
        {indicator.speaker && (
          <p className="text-xs font-medium mb-0.5" style={{ color }}>{indicator.speaker}</p>
        )}
        <div
          className="rounded-2xl rounded-tl-md px-4 py-3 shadow-sm"
          style={{ backgroundColor: `${color}10`, borderLeft: `3px solid ${color}` }}
        >
          <div className="flex gap-1 items-center">
            <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" />
            <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:150ms]" />
            <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:300ms]" />
          </div>
        </div>
      </div>
    </div>
  );
}

// ==================== Image Upload Input ====================

function ImageUploadInput({
  prompt,
  submitting,
  onSubmit,
}: {
  prompt?: string;
  submitting: boolean;
  onSubmit: (url: string) => void;
}) {
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [preview, setPreview] = React.useState<string | null>(null);
  const [uploading, setUploading] = React.useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleUploadAndSubmit = async () => {
    const file = fileInputRef.current?.files?.[0];
    if (!file || uploading) return;
    setUploading(true);
    try {
      const reader = new FileReader();
      const dataUrl = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      onSubmit(dataUrl);
    } catch {
      // Reset on error
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      {prompt && <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">{prompt}</p>}
      {preview && (
        <div className="mb-2 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700">
          <img src={preview} alt="预览" className="max-h-48 w-full object-contain bg-slate-50 dark:bg-slate-900" />
        </div>
      )}
      <div className="flex gap-2">
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={submitting || uploading}
          className="flex-1 px-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50"
        >
          {preview ? '重新选择图片' : '选择图片'}
        </button>
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
        {preview && (
          <button
            onClick={handleUploadAndSubmit}
            disabled={submitting || uploading}
            className="px-4 py-2.5 bg-teal-500 text-white rounded-xl hover:bg-teal-600 disabled:opacity-50 transition-colors"
          >
            {uploading || submitting ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
          </button>
        )}
      </div>
    </div>
  );
}

// ==================== Script Task Bubble ====================

function ScriptTaskBubble({
  taskId,
  taskName,
  description,
  taskType,
  targetValue,
  targetUnit,
}: {
  taskId: number | null;
  taskName: string;
  description?: string;
  taskType: string;
  targetValue?: string;
  targetUnit?: string;
}) {
  const [task, setTask] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [isActioning, setIsActioning] = useState(false);

  // Dynamically import the API
  const fetchTask = useCallback(async () => {
    if (!taskId || taskId <= 0) return;
    try {
      const { rouletteApi } = await import('../../lib/api');
      const result = await rouletteApi.getTaskInstance(taskId);
      setTask(result);
    } catch {
      // Task may not exist yet
    }
  }, [taskId]);

  useEffect(() => {
    fetchTask();
    // Poll for status updates
    if (!taskId || taskId <= 0) return;
    const interval = setInterval(fetchTask, 5000);
    return () => clearInterval(interval);
  }, [taskId, fetchTask]);

  const handleStart = async () => {
    if (!taskId || isActioning) return;
    setIsActioning(true);
    try {
      const { rouletteApi } = await import('../../lib/api');
      const updated = await rouletteApi.startTaskInstance(taskId);
      setTask(updated);
    } catch (err) {
      console.error('Failed to start task', err);
    } finally {
      setIsActioning(false);
    }
  };

  const handleComplete = async (success: boolean) => {
    if (!taskId || isActioning) return;
    setIsActioning(true);
    try {
      const { rouletteApi } = await import('../../lib/api');
      const updated = await rouletteApi.completeTaskInstance(taskId, { success });
      setTask(updated);
    } catch (err) {
      console.error('Failed to complete task', err);
    } finally {
      setIsActioning(false);
    }
  };

  const handleIncrement = async (amount: number) => {
    if (!taskId || isActioning) return;
    setIsActioning(true);
    try {
      const { rouletteApi } = await import('../../lib/api');
      if (task?.status === 'PENDING') {
        await rouletteApi.startTaskInstance(taskId);
      }
      const newVal = ((task?.currentValue || 0) + amount);
      const updated = await rouletteApi.updateTaskProgress(taskId, { currentValue: newVal });
      setTask(updated);
    } catch (err) {
      console.error('Failed to update progress', err);
    } finally {
      setIsActioning(false);
    }
  };

  // Status colors
  const status = task?.status || 'PENDING';
  const borderColor = status === 'COMPLETED' ? 'border-emerald-400' :
    status === 'IN_PROGRESS' ? 'border-indigo-400' :
    status === 'FAILED' ? 'border-rose-400' :
    'border-purple-300';
  const bgColor = status === 'COMPLETED' ? 'bg-emerald-50 dark:bg-emerald-950' :
    status === 'IN_PROGRESS' ? 'bg-indigo-50 dark:bg-indigo-950' :
    status === 'FAILED' ? 'bg-rose-50 dark:bg-rose-950' :
    'bg-purple-50 dark:bg-purple-950';
  const statusLabel = status === 'COMPLETED' ? '已完成' :
    status === 'IN_PROGRESS' ? '进行中' :
    status === 'FAILED' ? '未完成' : '待开始';
  const isActive = status === 'PENDING' || status === 'IN_PROGRESS';

  const effectiveType = task?.taskType || taskType || 'MANUAL';
  const hasTarget = !!(task?.targetValue || targetValue);
  const progress = hasTarget && effectiveType === 'COUNT'
    ? Math.min(100, ((task?.currentValue || 0) / (task?.targetValue || parseFloat(targetValue || '1'))) * 100)
    : 0;

  return (
    <div className={`${bgColor} border-l-4 ${borderColor} rounded-2xl p-4 mx-2`}>
      <div className="flex items-start justify-between mb-1">
        <div className="flex items-center gap-2">
          <ListChecks size={16} className="text-indigo-500 dark:text-indigo-400" />
          <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">{taskName}</span>
        </div>
        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
          status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-600 dark:text-emerald-400' :
          status === 'IN_PROGRESS' ? 'bg-indigo-100 text-indigo-600 dark:text-indigo-400' :
          status === 'FAILED' ? 'bg-rose-100 text-rose-600 dark:text-rose-400' :
          'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
        }`}>
          {statusLabel}
        </span>
      </div>

      {(description || task?.description) && (
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">{task?.description || description}</p>
      )}

      {/* Progress bar for COUNT */}
      {effectiveType === 'COUNT' && hasTarget && (
        <div className="mb-2">
          <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 mb-1">
            <span>{task?.currentValue || 0} / {task?.targetValue || targetValue} {task?.targetUnit || targetUnit || ''}</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div className="h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${status === 'COMPLETED' ? 'bg-emerald-500' : 'bg-indigo-500'}`}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Action buttons for active tasks */}
      {isActive && (
        <div className="flex items-center gap-2 mt-2">
          {effectiveType === 'MANUAL' && (
            <>
              <button
                onClick={() => handleComplete(false)}
                disabled={isActioning}
                className="flex-1 py-1.5 bg-rose-100 text-rose-600 dark:text-rose-400 rounded-lg text-xs font-medium hover:bg-rose-200 disabled:opacity-50 transition-colors"
              >
                放弃
              </button>
              <button
                onClick={() => handleComplete(true)}
                disabled={isActioning}
                className="flex-1 py-1.5 bg-emerald-100 text-emerald-600 dark:text-emerald-400 rounded-lg text-xs font-medium hover:bg-emerald-200 disabled:opacity-50 transition-colors flex items-center justify-center gap-1"
              >
                {isActioning ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle size={12} />}
                完成
              </button>
            </>
          )}

          {effectiveType === 'COUNT' && (
            <>
              <button
                onClick={() => handleIncrement(1)}
                disabled={isActioning}
                className="px-3 py-1.5 bg-indigo-100 text-indigo-600 dark:text-indigo-400 rounded-lg text-xs font-medium hover:bg-indigo-200 disabled:opacity-50 transition-colors flex items-center gap-0.5"
              >
                {isActioning ? <Loader2 size={12} className="animate-spin" /> : <Plus size={10} />}
                +1
              </button>
              <div className="flex-1" />
              <button
                onClick={() => handleComplete(true)}
                disabled={isActioning}
                className="px-3 py-1.5 bg-emerald-100 text-emerald-600 dark:text-emerald-400 rounded-lg text-xs font-medium hover:bg-emerald-200 disabled:opacity-50 transition-colors"
              >
                完成
              </button>
            </>
          )}

          {effectiveType === 'LOCK' && (
            <div className="text-xs text-purple-500 dark:text-purple-400 flex items-center gap-1">
              <Clock size={12} />
              <span>系统自动判定</span>
            </div>
          )}

          {effectiveType === 'DURATION' && (
            <div className="text-xs text-indigo-500 dark:text-indigo-400 flex items-center gap-1">
              <Timer size={12} />
              <span>请在任务列表中操作计时任务</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ==================== Dice Roll Input ====================

const DICE_FACES: Record<number, string> = { 1: '⚀', 2: '⚁', 3: '⚂', 4: '⚃', 5: '⚄', 6: '⚅' };

function DiceRollInput({
  prompt,
  sides,
  result,
  submitting,
  onRolled,
}: {
  prompt?: string;
  sides: number;
  result: number;
  submitting: boolean;
  onRolled: (result: number) => void;
}) {
  const [rolling, setRolling] = React.useState(false);
  const [displayFace, setDisplayFace] = React.useState<number | null>(null);
  const [revealed, setRevealed] = React.useState(false);

  const handleRoll = useCallback(() => {
    if (rolling || revealed || submitting) return;
    setRolling(true);
    let ticks = 0;
    const maxTicks = 12;
    const interval = setInterval(() => {
      ticks++;
      setDisplayFace(Math.floor(Math.random() * sides) + 1);
      if (ticks >= maxTicks) {
        clearInterval(interval);
        setDisplayFace(result);
        setRolling(false);
        setRevealed(true);
        setTimeout(() => onRolled(result), 800);
      }
    }, 100);
  }, [rolling, revealed, submitting, sides, result, onRolled]);

  const face = displayFace || '?';
  const faceEmoji = typeof face === 'number' && sides <= 6 ? DICE_FACES[face] || face : face;

  return (
    <div className="flex flex-col items-center gap-3">
      {prompt && <p className="text-sm text-slate-600 dark:text-slate-300 font-medium">{prompt}</p>}
      <button
        onClick={handleRoll}
        disabled={rolling || revealed || submitting}
        className={`
          relative w-24 h-24 rounded-2xl text-5xl flex items-center justify-center
          transition-all duration-200 select-none shadow-lg
          ${revealed
            ? 'bg-teal-50 dark:bg-teal-950 border-2 border-teal-400 text-teal-700 scale-110'
            : rolling
              ? 'bg-amber-50 dark:bg-amber-950 border-2 border-amber-300 text-amber-700 dark:text-amber-400 animate-bounce'
              : 'bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-teal-400 hover:bg-teal-50 dark:bg-teal-950 hover:scale-105 active:scale-95 cursor-pointer'
          }
        `}
      >
        {sides <= 6 ? (
          <span className={rolling ? 'animate-spin' : ''}>{faceEmoji}</span>
        ) : (
          <span className="text-3xl font-bold">{face}</span>
        )}
      </button>
      <p className="text-xs text-slate-400 dark:text-slate-500">
        {revealed ? `结果: ${result}` : rolling ? '掷骰中...' : `点击掷出 ${sides} 面骰子`}
      </p>
      {revealed && submitting && <Loader2 size={16} className="animate-spin text-teal-500 dark:text-teal-400" />}
    </div>
  );
}
