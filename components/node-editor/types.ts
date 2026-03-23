// ===================== 节点图序列化格式 =====================

export interface NodeGraphData {
  version: 1;
  nodes: Record<string, SerializedNode>;
  connections: SerializedConnection[];
  metadata: {
    nodeCount: number;
    editorViewport: { x: number; y: number; zoom: number };
  };
}

export interface SerializedNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: Record<string, any>;
}

export interface SerializedConnection {
  id: string;
  sourceNodeId: string;
  sourceOutput: string;
  targetNodeId: string;
  targetInput: string;
}

// ===================== 章节 & 角色 & 游戏配置 =====================

export interface ChapterData {
  id: string;
  name: string;
  sortOrder: number;
  nodes: Record<string, SerializedNode>;
  connections: SerializedConnection[];
  viewport?: { x: number; y: number; zoom: number };
}

export interface CharacterDef {
  id: string;
  name: string;
  avatar?: string;
  color?: string;
}

export interface GameConfig {
  characters: CharacterDef[];
}

export interface NodeGraphDataV2 {
  version: 2;
  chapters: Record<string, ChapterData>;
  gameConfig: GameConfig;
  metadata: {
    nodeCount: number;
  };
}

/** Load graph data (V1 or V2) and normalize to V2 */
export function normalizeGraphData(raw: any): NodeGraphDataV2 {
  if (!raw) {
    return createEmptyV2();
  }
  if (raw.version === 2 && raw.chapters) {
    return raw as NodeGraphDataV2;
  }
  // V1 → V2 migration: wrap single graph as "main" chapter
  const v1 = raw as NodeGraphData;
  return {
    version: 2,
    chapters: {
      main: {
        id: 'main',
        name: '主线',
        sortOrder: 0,
        nodes: v1.nodes || {},
        connections: v1.connections || [],
        viewport: v1.metadata?.editorViewport,
      },
    },
    gameConfig: { characters: [] },
    metadata: { nodeCount: v1.metadata?.nodeCount || 0 },
  };
}

export function createEmptyV2(): NodeGraphDataV2 {
  return {
    version: 2,
    chapters: {
      main: {
        id: 'main',
        name: '主线',
        sortOrder: 0,
        nodes: {},
        connections: [],
      },
    },
    gameConfig: { characters: [] },
    metadata: { nodeCount: 0 },
  };
}

// ===================== Socket 类型 =====================

export type SocketType = 'flow' | 'number' | 'string' | 'boolean' | 'any' | 'array';

export const SOCKET_COLORS: Record<SocketType, string> = {
  flow: '#94a3b8',
  number: '#3b82f6',
  string: '#22c55e',
  boolean: '#ef4444',
  any: '#a855f7',
  array: '#f97316',
};

// ===================== 节点分类 =====================

export type NodeCategory =
  | 'flow'
  | 'variables'
  | 'player'
  | 'chat'
  | 'lock'
  | 'task'
  | 'user'
  | 'events'
  | 'data'
  | 'vn';

export const NODE_CATEGORY_LABELS: Record<NodeCategory, string> = {
  flow: '流程控制',
  variables: '变量',
  player: '玩家交互',
  chat: '聊天室',
  lock: '锁 API',
  task: '任务 API',
  user: '用户 API',
  events: '事件触发',
  data: '数据',
  vn: '视觉小说',
};

export const NODE_CATEGORY_COLORS: Record<NodeCategory, string> = {
  flow: '#f59e0b',
  variables: '#3b82f6',
  player: '#22c55e',
  chat: '#10b981',
  lock: '#ef4444',
  task: '#a855f7',
  user: '#06b6d4',
  events: '#eab308',
  data: '#6b7280',
  vn: '#e879f9',
};

// ===================== 节点定义 =====================

export interface NodeTypeDefinition {
  type: string;
  label: string;
  category: NodeCategory;
  description: string;
  inputs: PortDefinition[];
  outputs: PortDefinition[];
  configFields: ConfigFieldDefinition[];
}

export interface PortDefinition {
  name: string;
  label: string;
  socket: SocketType;
  isFlow?: boolean;
}

export interface ConfigFieldDefinition {
  key: string;
  label: string;
  type: 'text' | 'number' | 'select' | 'boolean' | 'json' | 'textarea' | 'choiceList' | 'imageUpload' | 'characterSelect' | 'chapterSelect';
  defaultValue?: any;
  options?: { label: string; value: string }[];
  min?: number;
  max?: number;
}

// ===================== API 类型 =====================

export interface ScriptExecutionResponse {
  executionId: number;
  status: string;
  displayCommands: DisplayCommand[];
  waitingForInput: boolean;
  inputSpec?: InputSpec;
  gameTitle?: string;
}

export interface DisplayCommand {
  id: string;
  type: 'TEXT' | 'IMAGE' | 'CHOICE' | 'INPUT' | 'TIMER' | 'TASK_CREATED' | 'DICE'
    | 'VN_ENTER' | 'VN_EXIT' | 'VN_BG' | 'VN_SPRITE' | 'VN_CLEAR_SPRITES' | 'VN_DIALOGUE'
    | 'CHAT_OPEN' | 'CHAT_SWITCH';
  data: Record<string, string>;
  timestamp?: string;
}

export interface InputSpec {
  nodeId: string;
  type: 'CHOICE' | 'TEXT' | 'NUMBER' | 'IMAGE_UPLOAD' | 'TIMER' | 'DICE' | 'VN_DIALOGUE';
  choices?: { index: number; label: string; description?: string }[];
  prompt?: string;
  timeLimit?: number;
  sides?: number;
  result?: number;
  chatId?: string;
}

export interface ScriptValidationResult {
  valid: boolean;
  errors: { nodeId?: string; message: string; severity: string }[];
}

// ===================== 聊天室状态 =====================

export interface ChatRoom {
  id: string;
  name: string;
  avatar?: string;
  type: 'private' | 'group';
  messages: ChatMessage[];
  unreadCount: number;
  lastMessagePreview?: string;
  lastMessageTimestamp?: number;
  hasActiveInput: boolean;
}

export interface ChatMessage {
  id: string;
  type: 'text' | 'image' | 'system' | 'choice-made' | 'timer' | 'task';
  content: string;
  data?: Record<string, string>;
  timestamp: number;
  speaker?: string;
  speakerAvatar?: string;
  speakerColor?: string;
}

// ===================== VN 视觉小说状态 =====================

export interface VNSprite {
  position: 'left' | 'center' | 'right';
  imageUrl: string;
  characterId?: string;
}

export interface VNDisplayState {
  active: boolean;
  orientation: 'portrait' | 'landscape';
  backgroundUrl: string | null;
  sprites: VNSprite[];
  currentDialogue: { speaker: string; speakerAvatar?: string; text: string } | null;
}
