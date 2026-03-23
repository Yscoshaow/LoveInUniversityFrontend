import { NodeEditor, GetSchemes, ClassicPreset } from 'rete';
import { AreaPlugin, AreaExtensions } from 'rete-area-plugin';
import { ConnectionPlugin, Presets as ConnectionPresets } from 'rete-connection-plugin';
import { ContextMenuPlugin, Presets as ContextMenuPresets } from 'rete-context-menu-plugin';
import { ReactPlugin, Presets as ReactPresets, ReactArea2D } from 'rete-react-plugin';
import { createRoot } from 'react-dom/client';
import { AutoArrangePlugin, Presets as ArrangePresets } from 'rete-auto-arrange-plugin';
import type { NodeGraphData, SerializedNode, SerializedConnection, NodeTypeDefinition, NodeCategory } from '../types';
import { NODE_CATEGORY_LABELS } from '../types';
import { NODE_DEFINITIONS, getNodeDefinition, getNodesByCategory } from '../nodeDefinitions';
import {
  CustomNodeComponent,
  CustomSocketComponent,
  InlineConfigControl,
  ChoiceListControl,
  ImageUploadControl,
  type ConfigControlData,
  type ChoiceListControlData,
  type ImageUploadControlData,
} from '../ui/CustomComponents';

// ─── ConfigControl: 让节点内嵌配置字段 ────────────────────────
class ConfigControl extends ClassicPreset.Control {
  public onChange?: (value: any) => void;

  constructor(
    public fieldDef: ConfigControlData['fieldDef'],
    public value: any,
    public configRef: Record<string, any>,
    onChange?: (value: any) => void
  ) {
    super();
    this.onChange = onChange;
  }

  set(value: any) {
    this.value = value;
    this.configRef[this.fieldDef.key] = value;
    this.onChange?.(value);
  }

  getDynamicOptions(): { label: string; value: string }[] | undefined {
    if (this.fieldDef.type === 'characterSelect') {
      return [
        { label: '(无)', value: '' },
        ..._gameConfigRef.characters.map(c => ({ label: c.name, value: c.id })),
      ];
    }
    if (this.fieldDef.type === 'chapterSelect') {
      return [
        { label: '(选择章节)', value: '' },
        ..._gameConfigRef.chapters.map(c => ({ label: c.name, value: c.id })),
      ];
    }
    return undefined;
  }
}

// ─── ChoiceListConfigControl: ShowChoiceNode 专用选项列表控件 ────
class ChoiceListConfigControl extends ClassicPreset.Control {
  constructor(
    public choices: { label: string; description?: string }[],
    public configRef: Record<string, any>,
    public onChoicesChange: (choices: { label: string; description?: string }[]) => void
  ) {
    super();
  }
}

// ─── ImageUploadConfigControl: 图片上传控件 ────
class ImageUploadConfigControl extends ClassicPreset.Control {
  constructor(
    public imageUrl: string,
    public configRef: Record<string, any>,
    public configKey: string,
    public uploadFn: (file: File) => Promise<{ imageUrl: string }>
  ) {
    super();
  }
}

// 模块级图片上传函数引用（由 createEditor 注入）
let _imageUploadFn: ((file: File) => Promise<{ imageUrl: string }>) | null = null;

// 模块级游戏配置引用（由 NodeScriptEditor 更新，供 characterSelect/chapterSelect 控件使用）
let _gameConfigRef: {
  characters: { id: string; name: string; avatar?: string; color?: string }[];
  chapters: { id: string; name: string }[];
} = { characters: [], chapters: [] };

export function updateGameConfig(config: typeof _gameConfigRef) {
  _gameConfigRef = config;
}

export interface EditorOptions {
  /** 图片上传函数，用于 ShowImageNode 的图片上传控件 */
  uploadImage?: (file: File) => Promise<{ imageUrl: string }>;
}

class NodeWithSize extends ClassicPreset.Node {
  width = 200;
  height = 0; // 动态计算
}

type Conn = ClassicPreset.Connection<NodeWithSize, NodeWithSize> & { isLoop?: boolean };

type Schemes = GetSchemes<NodeWithSize, Conn>;

type ContextMenuExtra = import('rete-context-menu-plugin').ContextMenuExtra;
type AreaExtra = ReactArea2D<Schemes> | ContextMenuExtra;

// Socket 实例缓存
const sockets = {
  flow: new ClassicPreset.Socket('flow'),
  number: new ClassicPreset.Socket('number'),
  string: new ClassicPreset.Socket('string'),
  boolean: new ClassicPreset.Socket('boolean'),
  any: new ClassicPreset.Socket('any'),
  array: new ClassicPreset.Socket('array'),
};

function getSocket(type: string): ClassicPreset.Socket {
  return sockets[type as keyof typeof sockets] || sockets.any;
}

/**
 * 计算节点动态高度
 * @param extraFlowOutputs 额外的动态流程输出数量（如 ShowChoiceNode 的选项输出）
 */
function calcNodeHeight(def: NodeTypeDefinition, extraFlowOutputs = 0): number {
  const HEADER = 32;           // 标题行
  const ACCENT = 3;            // 顶部色条
  const flowInputs = def.inputs.filter((p) => p.isFlow).length;
  const flowOutputs = def.outputs.filter((p) => p.isFlow).length + extraFlowOutputs;
  const flowRows = Math.max(flowInputs, flowOutputs);
  const FLOW_ROW = flowRows > 0 ? flowRows * 24 + 8 : 0;

  const dataInputs = def.inputs.filter((p) => !p.isFlow).length;
  const dataOutputs = def.outputs.filter((p) => !p.isFlow).length;
  const dataRows = Math.max(dataInputs, dataOutputs);
  const DATA_ROW = dataRows * 24;

  // textarea/json fields are taller; choiceList has dynamic height
  const CONFIG_ROW = def.configFields.reduce((sum, f) => {
    if (f.type === 'textarea' || f.type === 'json') return sum + 80;
    if (f.type === 'boolean') return sum + 24;
    if (f.type === 'choiceList') return sum + 0; // height handled by choiceListHeight()
    if (f.type === 'imageUpload') return sum + 110; // 预览区域 + 按钮
    return sum + 40;
  }, 0);

  const PADDING = 12;
  return ACCENT + HEADER + FLOW_ROW + DATA_ROW + CONFIG_ROW + PADDING;
}

/**
 * 计算选项列表控件的额外高度
 */
function choiceListHeight(choiceCount: number): number {
  // 标签(16) + 每选项行(25) + 间距(3*n) + 添加按钮(28) + 上下padding(8)
  return 16 + choiceCount * 25 + (choiceCount - 1) * 3 + 28 + 8;
}

/**
 * 同步 ShowChoiceNode 的动态输出端口（choice_0, choice_1, ...）
 * 根据 choices 数组生成对应的 flow 输出
 * 尽量保留已有端口（避免断开连接），仅增删差异部分
 */
function syncChoiceOutputs(
  node: NodeWithSize,
  choices: { label: string; description?: string }[],
  def: NodeTypeDefinition
) {
  const flowSocket = getSocket('flow');

  // 统计现有 choice_N 输出数量
  const existingChoiceKeys = Object.keys(node.outputs).filter((k) => k.startsWith('choice_'));
  const oldCount = existingChoiceKeys.length;
  const newCount = choices.length;

  // 更新已有端口的 label
  for (let i = 0; i < Math.min(oldCount, newCount); i++) {
    const output = node.outputs[`choice_${i}`];
    if (output) {
      (output as any).label = choices[i].label || `选项 ${i + 1}`;
    }
  }

  // 添加新增的端口
  for (let i = oldCount; i < newCount; i++) {
    const label = choices[i].label || `选项 ${i + 1}`;
    node.addOutput(`choice_${i}`, new ClassicPreset.Output(flowSocket, label, true));
  }

  // 移除多余的端口
  for (let i = newCount; i < oldCount; i++) {
    node.removeOutput(`choice_${i}`);
  }

  // 重新计算高度
  node.height = calcNodeHeight(def, newCount) + choiceListHeight(newCount);
}

/**
 * 同步 RollDiceNode 的动态输出端口（dice_1, dice_2, ...dice_N）
 * 根据面数生成对应的 flow 输出
 */
function syncDiceOutputs(
  node: NodeWithSize,
  sides: number,
  def: NodeTypeDefinition
) {
  const flowSocket = getSocket('flow');

  const existingDiceKeys = Object.keys(node.outputs).filter((k) => k.startsWith('dice_'));
  const oldCount = existingDiceKeys.length;

  // 更新已有端口的 label
  for (let i = 0; i < Math.min(oldCount, sides); i++) {
    const output = node.outputs[`dice_${i + 1}`];
    if (output) {
      (output as any).label = `🎲 ${i + 1}`;
    }
  }

  // 添加新增的端口
  for (let i = oldCount; i < sides; i++) {
    node.addOutput(`dice_${i + 1}`, new ClassicPreset.Output(flowSocket, `🎲 ${i + 1}`, true));
  }

  // 移除多余的端口
  for (let i = sides; i < oldCount; i++) {
    node.removeOutput(`dice_${i + 1}`);
  }

  // 重新计算高度
  node.height = calcNodeHeight(def, sides);
}

/**
 * 根据节点类型定义创建 Rete 节点
 */
function createNodeFromDefinition(
  def: NodeTypeDefinition,
  nodeData: Record<string, any> = {}
): NodeWithSize {
  const node = new NodeWithSize(def.label);
  (node as any).__nodeType = def.type;
  (node as any).__category = def.category;

  const configData = { ...getDefaultConfigData(def), ...nodeData };
  (node as any).__configData = configData;

  // 兼容旧格式：如果 choices 是 JSON 字符串则解析为数组
  if (def.type === 'ShowChoiceNode' && typeof configData.choices === 'string') {
    try {
      configData.choices = JSON.parse(configData.choices);
    } catch {
      configData.choices = [{ label: '选项1' }, { label: '选项2' }];
    }
  }

  // 添加输入 — flow 输入也允许多连接（支持多路流程汇入同一节点）
  for (const input of def.inputs) {
    const socket = getSocket(input.socket);
    node.addInput(input.name, new ClassicPreset.Input(socket, input.label, true));
  }

  // 添加输出（静态定义部分）
  for (const output of def.outputs) {
    const socket = getSocket(output.socket);
    node.addOutput(output.name, new ClassicPreset.Output(socket, output.label, true));
  }

  // ShowChoiceNode: 动态生成 choice_N 流程输出
  if (def.type === 'ShowChoiceNode') {
    const choices: { label: string; description?: string }[] =
      Array.isArray(configData.choices) ? configData.choices : [{ label: '选项1' }, { label: '选项2' }];
    configData.choices = choices;
    syncChoiceOutputs(node, choices, def);
  }

  // RollDiceNode: 动态生成 dice_1..dice_N 流程输出
  if (def.type === 'RollDiceNode') {
    const sides = parseInt(configData.sides, 10) || 6;
    syncDiceOutputs(node, sides, def);
  }

  // 添加行内配置控件
  for (const field of def.configFields) {
    if (field.type === 'choiceList') {
      // ShowChoiceNode 专用选项列表控件
      const choices: { label: string; description?: string }[] = configData[field.key] || [];
      const ctrl = new ChoiceListConfigControl(choices, configData, (updated) => {
        configData[field.key] = updated;
        syncChoiceOutputs(node, updated, def);
        // 触发 Rete 节点更新（如果有 area 引用）
        const areaRef = (node as any).__areaRef;
        if (areaRef) {
          areaRef.update('node', node.id);
        }
      });
      node.addControl(`__cfg_${field.key}`, ctrl);
    } else if (field.type === 'imageUpload') {
      // 图片上传控件
      const uploadFn = _imageUploadFn || (async () => { throw new Error('图片上传未配置'); });
      const ctrl = new ImageUploadConfigControl(
        configData[field.key] || '',
        configData,
        field.key,
        uploadFn
      );
      node.addControl(`__cfg_${field.key}`, ctrl);
    } else {
      // RollDiceNode 的 sides 字段变化时需要同步输出端口
      const onChange = (def.type === 'RollDiceNode' && field.key === 'sides')
        ? (value: any) => {
            const newSides = parseInt(value, 10) || 6;
            syncDiceOutputs(node, newSides, def);
            const areaRef = (node as any).__areaRef;
            if (areaRef) areaRef.update('node', node.id);
          }
        : undefined;
      const ctrl = new ConfigControl(field, configData[field.key], configData, onChange);
      node.addControl(`__cfg_${field.key}`, ctrl);
    }
  }

  // 计算动态高度（ShowChoiceNode / RollDiceNode 在 sync*Outputs 中已计算）
  if (def.type !== 'ShowChoiceNode' && def.type !== 'RollDiceNode') {
    node.height = calcNodeHeight(def);
  }
  node.width = 200;

  return node;
}

function getDefaultConfigData(def: NodeTypeDefinition): Record<string, any> {
  const data: Record<string, any> = {};
  for (const field of def.configFields) {
    if (field.defaultValue !== undefined) {
      data[field.key] = field.defaultValue;
    }
  }
  return data;
}

// ─── 构建右键菜单项（按分类分组） ─────────────────────────────
function buildContextMenuItems(
  editor: NodeEditor<Schemes>,
  area: AreaPlugin<Schemes, AreaExtra>
) {
  const categories = Object.keys(NODE_CATEGORY_LABELS) as NodeCategory[];
  const items: [string, [string, () => NodeWithSize][]][] = [];

  for (const cat of categories) {
    const nodes = getNodesByCategory(cat);
    if (nodes.length === 0) continue;

    const subItems: [string, () => NodeWithSize][] = nodes.map((def) => [
      def.label,
      () => createNodeFromDefinition(def),
    ]);

    items.push([NODE_CATEGORY_LABELS[cat], subItems]);
  }

  return items;
}

// ─── 深色网格背景 CSS ────────────────────────────────────────
function applyDarkGridBackground(container: HTMLElement) {
  container.style.background = '#12121e';
  container.style.backgroundImage = [
    'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px)',
    'linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)',
    'linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px)',
    'linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)',
  ].join(', ');
  container.style.backgroundSize = '20px 20px, 20px 20px, 100px 100px, 100px 100px';
}

// ─── 注入连接线 + 右键菜单样式 CSS ──────────────────────────────
function injectEditorStyles() {
  const STYLE_ID = 'rete-ue5-editor-css';
  if (document.getElementById(STYLE_ID)) return;

  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    /* UE5 Blueprint 连接线样式 */
    .rete-connection path {
      stroke-width: 2.5px;
      fill: none;
    }
    .rete-connection path {
      stroke: #5a5a7a;
    }
    .rete-connection:hover path {
      stroke-width: 3.5px;
      filter: drop-shadow(0 0 4px rgba(180,180,220,0.3));
    }
    [data-testid="socket"] {
      transition: transform 0.12s ease;
    }
    [data-testid="socket"]:hover {
      transform: scale(1.3);
    }

    /* ── 右键菜单深色主题 ── */
    [data-testid="context-menu"] {
      background: rgba(20, 20, 32, 0.97) !important;
      backdrop-filter: blur(12px);
      border: 1px solid rgba(255,255,255,0.08) !important;
      border-radius: 8px !important;
      box-shadow: 0 8px 32px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.03) !important;
      padding: 4px !important;
      min-width: 180px;
    }
    [data-testid="context-menu"] input[type="text"] {
      background: rgba(0,0,0,0.4) !important;
      border: 1px solid rgba(255,255,255,0.08) !important;
      border-radius: 4px !important;
      color: #c8c8d8 !important;
      font-size: 12px !important;
      padding: 5px 8px !important;
      margin: 2px 4px 6px !important;
      outline: none !important;
      width: calc(100% - 8px) !important;
    }
    [data-testid="context-menu"] input[type="text"]:focus {
      border-color: rgba(255,255,255,0.2) !important;
    }
    [data-testid="context-menu"] input[type="text"]::placeholder {
      color: #555568 !important;
    }
    [data-testid="context-menu-item"] {
      background: transparent !important;
      color: #b0b0c8 !important;
      font-size: 12px !important;
      padding: 5px 10px !important;
      border-radius: 4px !important;
      cursor: pointer !important;
      transition: background 0.1s !important;
    }
    [data-testid="context-menu-item"]:hover {
      background: rgba(255,255,255,0.06) !important;
      color: #e0e0ec !important;
    }
    /* 子菜单 (分类标题) 样式 */
    [data-testid="context-menu-item"].hasSubitems,
    [data-testid="context-menu-item"][data-has-subitems="true"] {
      font-weight: 600 !important;
      color: #d0d0e0 !important;
    }
  `;
  document.head.appendChild(style);
}

/**
 * 创建并初始化 Rete.js 编辑器 — UE5 Blueprint 风格
 */
export async function createEditor(container: HTMLElement, options?: EditorOptions) {
  // 注入图片上传函数
  if (options?.uploadImage) {
    _imageUploadFn = options.uploadImage;
  }
  const editor = new NodeEditor<Schemes>();
  const area = new AreaPlugin<Schemes, AreaExtra>(container);
  const connection = new ConnectionPlugin<Schemes, AreaExtra>();
  const render = new ReactPlugin<Schemes, AreaExtra>({ createRoot });
  const arrange = new AutoArrangePlugin<Schemes>();

  // 深色网格背景
  applyDarkGridBackground(container);

  // 注入 CSS
  injectEditorStyles();

  // ── 右键菜单 ──
  const contextMenuItems = buildContextMenuItems(editor, area);
  const contextMenu = new ContextMenuPlugin<Schemes>({
    items: ContextMenuPresets.classic.setup(contextMenuItems),
  });

  // 配置渲染插件 — 使用自定义 UE5 组件
  render.addPreset(
    ReactPresets.classic.setup({
      customize: {
        node() {
          return CustomNodeComponent as any;
        },
        socket() {
          return CustomSocketComponent as any;
        },
        control(data) {
          // ChoiceListConfigControl → ChoiceListControl
          if (data.payload instanceof ChoiceListConfigControl) {
            return ChoiceListControl as any;
          }
          // ImageUploadConfigControl → ImageUploadControl
          if (data.payload instanceof ImageUploadConfigControl) {
            return ImageUploadControl as any;
          }
          // 如果是 ConfigControl, 渲染 InlineConfigControl
          if (data.payload instanceof ConfigControl) {
            return InlineConfigControl as any;
          }
          return undefined; // 使用默认控件
        },
      },
    })
  );

  // 右键菜单渲染
  render.addPreset(ReactPresets.contextMenu.setup());

  connection.addPreset(ConnectionPresets.classic.setup());
  arrange.addPreset(ArrangePresets.classic.setup());

  // 注册插件
  editor.use(area);
  area.use(connection);
  area.use(contextMenu);
  area.use(render);
  area.use(arrange);

  // 设置选择和缩放
  AreaExtensions.selectableNodes(area, AreaExtensions.selector(), {
    accumulating: AreaExtensions.accumulateOnCtrl(),
  });
  AreaExtensions.simpleNodesOrder(area);

  // 监听节点添加事件，注入 area 引用供动态输出更新
  editor.addPipe((context) => {
    if (context.type === 'nodecreated') {
      (context.data as any).__areaRef = area;
    }
    return context;
  });

  return {
    editor,
    area,
    arrange,
    destroy: () => area.destroy(),
  };
}

/**
 * 添加新节点到编辑器
 */
export async function addNode(
  editor: NodeEditor<Schemes>,
  area: AreaPlugin<Schemes, AreaExtra>,
  nodeType: string,
  position?: { x: number; y: number },
  data?: Record<string, any>
) {
  const def = getNodeDefinition(nodeType);
  if (!def) throw new Error(`Unknown node type: ${nodeType}`);

  const node = createNodeFromDefinition(def, data);
  await editor.addNode(node);

  if (position) {
    await area.translate(node.id, position);
  }

  return node;
}

/**
 * 序列化编辑器状态为 NodeGraphData JSON
 */
export function serializeGraph(
  editor: NodeEditor<Schemes>,
  area: AreaPlugin<Schemes, AreaExtra>
): NodeGraphData {
  const nodes: Record<string, SerializedNode> = {};
  const connections: SerializedConnection[] = [];

  // 序列化节点
  for (const node of editor.getNodes()) {
    const view = area.nodeViews.get(node.id);
    const position = view ? { x: view.position.x, y: view.position.y } : { x: 0, y: 0 };

    nodes[node.id] = {
      id: node.id,
      type: (node as any).__nodeType || 'Unknown',
      position,
      data: (node as any).__configData || {},
    };
  }

  // 序列化连接
  for (const conn of editor.getConnections()) {
    connections.push({
      id: conn.id,
      sourceNodeId: conn.source,
      sourceOutput: conn.sourceOutput as string,
      targetNodeId: conn.target,
      targetInput: conn.targetInput as string,
    });
  }

  return {
    version: 1,
    nodes,
    connections,
    metadata: {
      nodeCount: Object.keys(nodes).length,
      editorViewport: { x: 0, y: 0, zoom: 1 },
    },
  };
}

/**
 * 从 NodeGraphData JSON 恢复编辑器状态
 */
export async function deserializeGraph(
  editor: NodeEditor<Schemes>,
  area: AreaPlugin<Schemes, AreaExtra>,
  graphData: NodeGraphData
) {
  // 清空现有内容
  for (const conn of editor.getConnections()) {
    await editor.removeConnection(conn.id);
  }
  for (const node of editor.getNodes()) {
    await editor.removeNode(node.id);
  }

  // ID 映射（旧ID -> 新ID）
  const idMap = new Map<string, string>();

  // 恢复节点
  for (const [oldId, serialized] of Object.entries(graphData.nodes)) {
    const def = getNodeDefinition(serialized.type);
    if (!def) continue;

    const node = createNodeFromDefinition(def, serialized.data);
    await editor.addNode(node);
    await area.translate(node.id, serialized.position);

    idMap.set(oldId, node.id);
  }

  // 恢复连接
  for (const conn of graphData.connections) {
    const sourceId = idMap.get(conn.sourceNodeId);
    const targetId = idMap.get(conn.targetNodeId);

    if (sourceId && targetId) {
      const sourceNode = editor.getNode(sourceId);
      const targetNode = editor.getNode(targetId);

      if (sourceNode && targetNode) {
        const sourceOutput = sourceNode.outputs[conn.sourceOutput];
        const targetInput = targetNode.inputs[conn.targetInput];

        if (sourceOutput && targetInput) {
          const connection = new ClassicPreset.Connection(sourceNode, conn.sourceOutput, targetNode, conn.targetInput);
          await editor.addConnection(connection);
        }
      }
    }
  }
}

/**
 * 获取所有可用的节点类型定义
 */
export function getAvailableNodeTypes(): NodeTypeDefinition[] {
  return NODE_DEFINITIONS;
}
