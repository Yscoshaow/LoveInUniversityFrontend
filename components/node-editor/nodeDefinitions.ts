import type { NodeTypeDefinition } from './types';

/**
 * 所有可用节点类型的注册表
 */
export const NODE_DEFINITIONS: NodeTypeDefinition[] = [
  // ===================== 流程控制 =====================
  {
    type: 'StartNode',
    label: '开始',
    category: 'flow',
    description: '脚本执行入口点',
    inputs: [],
    outputs: [{ name: 'flow', label: '流程', socket: 'flow', isFlow: true }],
    configFields: [
      {
        key: 'triggerType',
        label: '触发方式',
        type: 'select',
        defaultValue: 'MANUAL',
        options: [
          { label: '手动', value: 'MANUAL' },
          { label: '游戏开始时', value: 'ON_GAME_START' },
        ],
      },
    ],
  },
  {
    type: 'EndNode',
    label: '结束',
    category: 'flow',
    description: '脚本执行终点',
    inputs: [{ name: 'flow', label: '流程', socket: 'flow', isFlow: true }],
    outputs: [],
    configFields: [
      {
        key: 'endType',
        label: '结束类型',
        type: 'select',
        defaultValue: 'COMPLETE',
        options: [
          { label: '完成', value: 'COMPLETE' },
          { label: '失败', value: 'FAIL' },
          { label: '重新开始', value: 'RESTART' },
        ],
      },
    ],
  },
  {
    type: 'IfElseNode',
    label: '条件判断',
    category: 'flow',
    description: '根据条件分支',
    inputs: [
      { name: 'flow', label: '流程', socket: 'flow', isFlow: true },
      { name: 'condition', label: '条件', socket: 'boolean' },
    ],
    outputs: [
      { name: 'true', label: '是', socket: 'flow', isFlow: true },
      { name: 'false', label: '否', socket: 'flow', isFlow: true },
    ],
    configFields: [],
  },
  {
    type: 'SwitchNode',
    label: '多路分支',
    category: 'flow',
    description: '根据值选择分支',
    inputs: [
      { name: 'flow', label: '流程', socket: 'flow', isFlow: true },
      { name: 'value', label: '值', socket: 'any' },
    ],
    outputs: [
      { name: 'case_0', label: '分支 1', socket: 'flow', isFlow: true },
      { name: 'case_1', label: '分支 2', socket: 'flow', isFlow: true },
      { name: 'default', label: '默认', socket: 'flow', isFlow: true },
    ],
    configFields: [{ key: 'cases', label: '分支配置', type: 'json', defaultValue: '[]' }],
  },
  {
    type: 'LoopNode',
    label: '循环',
    category: 'flow',
    description: '重复执行指定次数',
    inputs: [
      { name: 'flow', label: '流程', socket: 'flow', isFlow: true },
      { name: 'count', label: '次数', socket: 'number' },
    ],
    outputs: [
      { name: 'body', label: '循环体', socket: 'flow', isFlow: true },
      { name: 'done', label: '完成', socket: 'flow', isFlow: true },
      { name: 'index', label: '当前索引', socket: 'number' },
    ],
    configFields: [
      { key: 'maxIterations', label: '最大迭代次数', type: 'number', defaultValue: 100, min: 1, max: 10000 },
    ],
  },
  {
    type: 'LoopEndNode',
    label: '循环结束',
    category: 'flow',
    description: '标记循环体结束，跳回循环开始',
    inputs: [{ name: 'flow', label: '流程', socket: 'flow', isFlow: true }],
    outputs: [],
    configFields: [],
  },
  {
    type: 'DelayNode',
    label: '延迟',
    category: 'flow',
    description: '暂停执行一段时间',
    inputs: [
      { name: 'flow', label: '流程', socket: 'flow', isFlow: true },
      { name: 'duration', label: '时长', socket: 'number' },
    ],
    outputs: [{ name: 'flow', label: '流程', socket: 'flow', isFlow: true }],
    configFields: [
      {
        key: 'unit',
        label: '单位',
        type: 'select',
        defaultValue: 'SEC',
        options: [
          { label: '秒', value: 'SEC' },
          { label: '分钟', value: 'MIN' },
          { label: '小时', value: 'HOUR' },
          { label: '天', value: 'DAY' },
        ],
      },
    ],
  },
  {
    type: 'RandomBranchNode',
    label: '随机分支',
    category: 'flow',
    description: '加权随机选择分支',
    inputs: [{ name: 'flow', label: '流程', socket: 'flow', isFlow: true }],
    outputs: [
      { name: 'branch_0', label: '分支 1', socket: 'flow', isFlow: true },
      { name: 'branch_1', label: '分支 2', socket: 'flow', isFlow: true },
    ],
    configFields: [{ key: 'branches', label: '分支配置', type: 'json', defaultValue: '[]' }],
  },

  // ===================== 变量 =====================
  {
    type: 'GetVariableNode',
    label: '获取变量',
    category: 'variables',
    description: '读取变量值',
    inputs: [],
    outputs: [{ name: 'value', label: '值', socket: 'any' }],
    configFields: [
      {
        key: 'scope',
        label: '作用域',
        type: 'select',
        defaultValue: 'SESSION',
        options: [
          { label: '会话', value: 'SESSION' },
          { label: '玩家', value: 'PLAYER' },
          { label: '全局', value: 'GLOBAL' },
        ],
      },
      { key: 'variableName', label: '变量名', type: 'text', defaultValue: '' },
      { key: 'defaultValue', label: '默认值', type: 'text', defaultValue: '' },
      {
        key: 'defaultType',
        label: '默认类型',
        type: 'select',
        defaultValue: 'STRING',
        options: [
          { label: '字符串', value: 'STRING' },
          { label: '数字', value: 'NUMBER' },
          { label: '布尔', value: 'BOOLEAN' },
        ],
      },
    ],
  },
  {
    type: 'SetVariableNode',
    label: '设置变量',
    category: 'variables',
    description: '写入变量值',
    inputs: [
      { name: 'flow', label: '流程', socket: 'flow', isFlow: true },
      { name: 'value', label: '值', socket: 'any' },
    ],
    outputs: [{ name: 'flow', label: '流程', socket: 'flow', isFlow: true }],
    configFields: [
      {
        key: 'scope',
        label: '作用域',
        type: 'select',
        defaultValue: 'SESSION',
        options: [
          { label: '会话', value: 'SESSION' },
          { label: '玩家', value: 'PLAYER' },
        ],
      },
      { key: 'variableName', label: '变量名', type: 'text', defaultValue: '' },
    ],
  },
  {
    type: 'MathOpNode',
    label: '数学运算',
    category: 'variables',
    description: '对两个数值进行运算',
    inputs: [
      { name: 'a', label: 'A', socket: 'number' },
      { name: 'b', label: 'B', socket: 'number' },
    ],
    outputs: [{ name: 'result', label: '结果', socket: 'number' }],
    configFields: [
      {
        key: 'op',
        label: '运算',
        type: 'select',
        defaultValue: '+',
        options: [
          { label: '加 (+)', value: '+' },
          { label: '减 (-)', value: '-' },
          { label: '乘 (x)', value: '*' },
          { label: '除 (/)', value: '/' },
          { label: '取余 (%)', value: '%' },
          { label: '最小值', value: 'min' },
          { label: '最大值', value: 'max' },
          { label: '随机范围', value: 'random_range' },
          { label: '幂 (^)', value: 'pow' },
          { label: '绝对值', value: 'abs' },
          { label: '向下取整', value: 'floor' },
          { label: '向上取整', value: 'ceil' },
          { label: '四舍五入', value: 'round' },
        ],
      },
    ],
  },
  {
    type: 'CompareNode',
    label: '比较',
    category: 'variables',
    description: '比较两个值',
    inputs: [
      { name: 'a', label: 'A', socket: 'any' },
      { name: 'b', label: 'B', socket: 'any' },
    ],
    outputs: [{ name: 'result', label: '结果', socket: 'boolean' }],
    configFields: [
      {
        key: 'op',
        label: '比较',
        type: 'select',
        defaultValue: '==',
        options: [
          { label: '等于 (==)', value: '==' },
          { label: '不等于 (!=)', value: '!=' },
          { label: '大于 (>)', value: '>' },
          { label: '大于等于 (>=)', value: '>=' },
          { label: '小于 (<)', value: '<' },
          { label: '小于等于 (<=)', value: '<=' },
          { label: '包含', value: 'contains' },
        ],
      },
    ],
  },
  {
    type: 'LiteralNode',
    label: '常量值',
    category: 'variables',
    description: '输出固定值',
    inputs: [],
    outputs: [{ name: 'value', label: '值', socket: 'any' }],
    configFields: [
      {
        key: 'type',
        label: '类型',
        type: 'select',
        defaultValue: 'STRING',
        options: [
          { label: '字符串', value: 'STRING' },
          { label: '数字', value: 'NUMBER' },
          { label: '布尔', value: 'BOOLEAN' },
        ],
      },
      { key: 'value', label: '值', type: 'text', defaultValue: '' },
    ],
  },
  {
    type: 'LogicGateNode',
    label: '逻辑门',
    category: 'variables',
    description: '逻辑运算（与/或/非/异或/与非/或非）',
    inputs: [
      { name: 'a', label: 'A', socket: 'boolean' },
      { name: 'b', label: 'B', socket: 'boolean' },
    ],
    outputs: [{ name: 'result', label: '结果', socket: 'boolean' }],
    configFields: [
      {
        key: 'op',
        label: '运算',
        type: 'select',
        defaultValue: 'AND',
        options: [
          { label: '与 (AND)', value: 'AND' },
          { label: '或 (OR)', value: 'OR' },
          { label: '非 (NOT)', value: 'NOT' },
          { label: '异或 (XOR)', value: 'XOR' },
          { label: '与非 (NAND)', value: 'NAND' },
          { label: '或非 (NOR)', value: 'NOR' },
        ],
      },
    ],
  },
  {
    type: 'StringOpNode',
    label: '字符串运算',
    category: 'variables',
    description: '字符串拼接、截取、替换等操作',
    inputs: [
      { name: 'a', label: 'A', socket: 'string' },
      { name: 'b', label: 'B', socket: 'string' },
    ],
    outputs: [{ name: 'result', label: '结果', socket: 'any' }],
    configFields: [
      {
        key: 'op',
        label: '运算',
        type: 'select',
        defaultValue: 'concat',
        options: [
          { label: '拼接', value: 'concat' },
          { label: '替换', value: 'replace' },
          { label: '模板', value: 'template' },
          { label: '截取子串', value: 'substring' },
          { label: '长度', value: 'length' },
          { label: '转大写', value: 'upper' },
          { label: '转小写', value: 'lower' },
          { label: '去空格', value: 'trim' },
          { label: '包含', value: 'contains' },
        ],
      },
      { key: 'replacement', label: '替换为（替换模式用）', type: 'text', defaultValue: '' },
      { key: 'end', label: '结束位置（截取用）', type: 'number' },
    ],
  },

  // ===================== 玩家交互 =====================
  {
    type: 'ShowTextNode',
    label: '显示文本',
    category: 'player',
    description: '向玩家显示一段文本',
    inputs: [
      { name: 'flow', label: '流程', socket: 'flow', isFlow: true },
      { name: 'text', label: '文本', socket: 'string' },
    ],
    outputs: [{ name: 'flow', label: '流程', socket: 'flow', isFlow: true }],
    configFields: [
      { key: 'staticText', label: '静态文本', type: 'textarea', defaultValue: '' },
      { key: 'characterId', label: '角色', type: 'characterSelect', defaultValue: '' },
      { key: 'speaker', label: '说话人名称', type: 'text', defaultValue: '' },
      { key: 'speakerAvatar', label: '说话人头像', type: 'imageUpload', defaultValue: '' },
      { key: 'speakerColor', label: '气泡颜色 (Hex)', type: 'text', defaultValue: '' },
    ],
  },
  {
    type: 'ShowImageNode',
    label: '显示图片',
    category: 'player',
    description: '向玩家显示图片（支持上传或动态URL）',
    inputs: [
      { name: 'flow', label: '流程', socket: 'flow', isFlow: true },
      { name: 'imageUrl', label: '图片URL', socket: 'string' },
    ],
    outputs: [{ name: 'flow', label: '流程', socket: 'flow', isFlow: true }],
    configFields: [
      { key: 'staticUrl', label: '静态图片', type: 'imageUpload', defaultValue: '' },
      { key: 'caption', label: '图片说明', type: 'text', defaultValue: '' },
      { key: 'characterId', label: '角色', type: 'characterSelect', defaultValue: '' },
      { key: 'speaker', label: '发送人名称', type: 'text', defaultValue: '' },
      { key: 'speakerAvatar', label: '发送人头像', type: 'imageUpload', defaultValue: '' },
    ],
  },
  {
    type: 'ShowChoiceNode',
    label: '显示选项',
    category: 'player',
    description: '向玩家显示选择题（暂停等待选择，支持 2-8 个选项）',
    inputs: [{ name: 'flow', label: '流程', socket: 'flow', isFlow: true }],
    // 输出端口在 createEditor.ts 中根据 choices 数量动态生成
    // 默认定义仅包含 selectedIndex；choice_N 流程输出在创建时追加
    outputs: [
      { name: 'selectedIndex', label: '选择索引', socket: 'number' },
    ],
    configFields: [
      { key: 'prompt', label: '提示语', type: 'text', defaultValue: '请选择' },
      { key: 'choices', label: '选项列表', type: 'choiceList', defaultValue: [{ label: '选项1' }, { label: '选项2' }] },
    ],
  },
  {
    type: 'ShowInputNode',
    label: '等待输入',
    category: 'player',
    description: '等待玩家输入文本、数字或上传图片（暂停等待输入）',
    inputs: [{ name: 'flow', label: '流程', socket: 'flow', isFlow: true }],
    outputs: [
      { name: 'flow', label: '流程', socket: 'flow', isFlow: true },
      { name: 'value', label: '输入值', socket: 'string' },
    ],
    configFields: [
      { key: 'prompt', label: '提示语', type: 'text', defaultValue: '请输入' },
      {
        key: 'inputType',
        label: '输入类型',
        type: 'select',
        defaultValue: 'TEXT',
        options: [
          { label: '文本', value: 'TEXT' },
          { label: '数字', value: 'NUMBER' },
          { label: '图片上传', value: 'IMAGE_UPLOAD' },
        ],
      },
    ],
  },
  {
    type: 'RollDiceNode',
    label: '掷骰子',
    category: 'player',
    description: '玩家掷骰子，根据结果走不同分支（暂停等待掷骰）',
    inputs: [{ name: 'flow', label: '流程', socket: 'flow', isFlow: true }],
    // 输出端口在 createEditor.ts 中根据 sides 数量动态生成
    // 默认仅 result 数据输出；dice_1..dice_N 流程输出在创建时追加
    outputs: [
      { name: 'result', label: '骰子结果', socket: 'number' },
    ],
    configFields: [
      { key: 'prompt', label: '提示语', type: 'text', defaultValue: '掷骰子！' },
      {
        key: 'sides',
        label: '骰子面数',
        type: 'select',
        defaultValue: '6',
        options: [
          { label: '2 面', value: '2' },
          { label: '3 面', value: '3' },
          { label: '4 面', value: '4' },
          { label: '5 面', value: '5' },
          { label: '6 面', value: '6' },
        ],
      },
    ],
  },
  {
    type: 'ShowTimerNode',
    label: '倒计时',
    category: 'player',
    description: '显示倒计时器（暂停等待完成）',
    inputs: [
      { name: 'flow', label: '流程', socket: 'flow', isFlow: true },
      { name: 'duration', label: '时长', socket: 'number' },
    ],
    outputs: [
      { name: 'completed', label: '完成', socket: 'flow', isFlow: true },
      { name: 'expired', label: '超时', socket: 'flow', isFlow: true },
    ],
    configFields: [
      { key: 'staticDuration', label: '固定时长', type: 'number', defaultValue: 60 },
      {
        key: 'unit',
        label: '单位',
        type: 'select',
        defaultValue: 'SEC',
        options: [
          { label: '秒', value: 'SEC' },
          { label: '分钟', value: 'MIN' },
        ],
      },
    ],
  },

  // ===================== 锁 API =====================
  {
    type: 'CheckLockStatusNode',
    label: '检查锁状态',
    category: 'lock',
    description: '检查玩家是否有活跃的锁',
    inputs: [{ name: 'flow', label: '流程', socket: 'flow', isFlow: true }],
    outputs: [
      { name: 'flow', label: '流程', socket: 'flow', isFlow: true },
      { name: 'isLocked', label: '已锁定', socket: 'boolean' },
      { name: 'status', label: '状态', socket: 'string' },
      { name: 'lockId', label: '锁ID', socket: 'number' },
    ],
    configFields: [],
  },
  {
    type: 'CheckLockTimeNode',
    label: '检查剩余时间',
    category: 'lock',
    description: '获取锁的剩余时间',
    inputs: [{ name: 'flow', label: '流程', socket: 'flow', isFlow: true }],
    outputs: [
      { name: 'flow', label: '流程', socket: 'flow', isFlow: true },
      { name: 'minutesRemaining', label: '剩余分钟', socket: 'number' },
      { name: 'hoursRemaining', label: '剩余小时', socket: 'number' },
    ],
    configFields: [],
  },
  {
    type: 'AddLockTimeNode',
    label: '增加锁时长',
    category: 'lock',
    description: '为玩家的锁增加时间（每次执行最多5次，总计1440分钟）',
    inputs: [
      { name: 'flow', label: '流程', socket: 'flow', isFlow: true },
      { name: 'minutes', label: '分钟数', socket: 'number' },
    ],
    outputs: [
      { name: 'flow', label: '流程', socket: 'flow', isFlow: true },
      { name: 'success', label: '成功', socket: 'boolean' },
    ],
    configFields: [{ key: 'staticMinutes', label: '固定分钟', type: 'number', defaultValue: 30 }],
  },
  {
    type: 'RemoveLockTimeNode',
    label: '减少锁时长',
    category: 'lock',
    description: '为玩家的锁减少时间（每次执行最多5次，总计1440分钟）',
    inputs: [
      { name: 'flow', label: '流程', socket: 'flow', isFlow: true },
      { name: 'minutes', label: '分钟数', socket: 'number' },
    ],
    outputs: [
      { name: 'flow', label: '流程', socket: 'flow', isFlow: true },
      { name: 'success', label: '成功', socket: 'boolean' },
    ],
    configFields: [{ key: 'staticMinutes', label: '固定分钟', type: 'number', defaultValue: 30 }],
  },
  {
    type: 'CheckExtensionNode',
    label: '检查扩展',
    category: 'lock',
    description: '检查锁是否启用了某个扩展功能',
    inputs: [{ name: 'flow', label: '流程', socket: 'flow', isFlow: true }],
    outputs: [
      { name: 'flow', label: '流程', socket: 'flow', isFlow: true },
      { name: 'enabled', label: '已启用', socket: 'boolean' },
    ],
    configFields: [
      {
        key: 'extensionType',
        label: '扩展类型',
        type: 'select',
        defaultValue: 'TASKS',
        options: [
          { label: '投票解锁', value: 'VOTE_UNLOCK' },
          { label: '幸运轮盘', value: 'WHEEL_OF_FORTUNE' },
          { label: '骰子', value: 'DICE' },
          { label: '任务系统', value: 'TASKS' },
          { label: '随机事件', value: 'RANDOM_EVENTS' },
          { label: '公开惩罚', value: 'PILLORY' },
          { label: '共享链接', value: 'SHARE_LINKS' },
          { label: '验证照片', value: 'VERIFICATION_PICTURE' },
          { label: '惩罚追踪', value: 'PENALTIES' },
          { label: '角色扮演', value: 'ROLE' },
          { label: '点赞解锁', value: 'LIKE_UNLOCK' },
          { label: '投币', value: 'COIN_TOSS' },
          { label: '游戏联动', value: 'ROULETTE_GAME_HOOK' },
        ],
      },
    ],
  },
  {
    type: 'BlockUnlockNode',
    label: '阻止解锁',
    category: 'lock',
    description: '注册解锁阻止钩子（最多3个）',
    inputs: [{ name: 'flow', label: '流程', socket: 'flow', isFlow: true }],
    outputs: [
      { name: 'flow', label: '流程', socket: 'flow', isFlow: true },
      { name: 'hookId', label: '钩子ID', socket: 'number' },
    ],
    configFields: [
      { key: 'reason', label: '阻止原因', type: 'text', defaultValue: '游戏条件未满足' },
      { key: 'expiresInMinutes', label: '过期时间(分钟)', type: 'number', defaultValue: 1440 },
    ],
  },
  {
    type: 'AllowUnlockNode',
    label: '允许解锁',
    category: 'lock',
    description: '移除解锁阻止钩子',
    inputs: [
      { name: 'flow', label: '流程', socket: 'flow', isFlow: true },
      { name: 'hookId', label: '钩子ID', socket: 'number' },
    ],
    outputs: [{ name: 'flow', label: '流程', socket: 'flow', isFlow: true }],
    configFields: [],
  },

  // ===================== 任务 API =====================
  {
    type: 'CreateTaskNode',
    label: '创建任务',
    category: 'task',
    description: '创建一个任务给玩家（每次执行最多10个）',
    inputs: [{ name: 'flow', label: '流程', socket: 'flow', isFlow: true }],
    outputs: [
      { name: 'flow', label: '流程', socket: 'flow', isFlow: true },
      { name: 'taskId', label: '任务ID', socket: 'number' },
    ],
    configFields: [
      { key: 'title', label: '任务标题', type: 'text', defaultValue: '' },
      { key: 'description', label: '任务描述', type: 'textarea', defaultValue: '' },
      {
        key: 'taskType',
        label: '任务类型',
        type: 'select',
        defaultValue: 'MANUAL',
        options: [
          { label: '手动完成', value: 'MANUAL' },
          { label: '计时任务', value: 'DURATION' },
          { label: '计数任务', value: 'COUNT' },
          { label: '锁任务', value: 'LOCK' },
        ],
      },
      { key: 'targetValue', label: '目标值', type: 'number' },
      { key: 'targetUnit', label: '目标单位', type: 'text', defaultValue: '' },
    ],
  },
  {
    type: 'CheckTaskStatusNode',
    label: '检查任务状态',
    category: 'task',
    description: '检查任务是否完成',
    inputs: [
      { name: 'flow', label: '流程', socket: 'flow', isFlow: true },
      { name: 'taskId', label: '任务ID', socket: 'number' },
    ],
    outputs: [
      { name: 'completed', label: '已完成', socket: 'flow', isFlow: true },
      { name: 'failed', label: '失败', socket: 'flow', isFlow: true },
      { name: 'pending', label: '进行中', socket: 'flow', isFlow: true },
      { name: 'status', label: '状态', socket: 'string' },
    ],
    configFields: [{ key: 'waitForCompletion', label: '等待完成', type: 'boolean', defaultValue: false }],
  },

  // ===================== 用户 API =====================
  {
    type: 'GetUserInfoNode',
    label: '获取用户信息',
    category: 'user',
    description: '获取当前玩家信息',
    inputs: [{ name: 'flow', label: '流程', socket: 'flow', isFlow: true }],
    outputs: [
      { name: 'flow', label: '流程', socket: 'flow', isFlow: true },
      { name: 'userId', label: '用户ID', socket: 'number' },
      { name: 'displayName', label: '显示名', socket: 'string' },
      { name: 'username', label: '用户名', socket: 'string' },
    ],
    configFields: [],
  },
  {
    type: 'GetCampusPointsNode',
    label: '获取积分',
    category: 'user',
    description: '获取玩家校园点数',
    inputs: [{ name: 'flow', label: '流程', socket: 'flow', isFlow: true }],
    outputs: [
      { name: 'flow', label: '流程', socket: 'flow', isFlow: true },
      { name: 'points', label: '积分', socket: 'number' },
    ],
    configFields: [],
  },
  {
    type: 'GetUserCreditsNode',
    label: '获取学分',
    category: 'user',
    description: '获取用户当前学分',
    inputs: [{ name: 'flow', label: '流程', socket: 'flow', isFlow: true }],
    outputs: [
      { name: 'flow', label: '流程', socket: 'flow', isFlow: true },
      { name: 'credits', label: '学分', socket: 'number' },
    ],
    configFields: [],
  },
  {
    type: 'GetUserPostCountNode',
    label: '获取发帖数',
    category: 'user',
    description: '获取用户发帖数量',
    inputs: [{ name: 'flow', label: '流程', socket: 'flow', isFlow: true }],
    outputs: [
      { name: 'flow', label: '流程', socket: 'flow', isFlow: true },
      { name: 'postCount', label: '发帖数', socket: 'number' },
    ],
    configFields: [],
  },
  {
    type: 'GetLockLikesNode',
    label: '获取锁点赞数',
    category: 'lock',
    description: '获取用户当前锁的点赞数量',
    inputs: [{ name: 'flow', label: '流程', socket: 'flow', isFlow: true }],
    outputs: [
      { name: 'flow', label: '流程', socket: 'flow', isFlow: true },
      { name: 'likesReceived', label: '点赞数', socket: 'number' },
    ],
    configFields: [],
  },
  {
    type: 'IsPublicLockNode',
    label: '是否公开锁',
    category: 'lock',
    description: '检查当前锁是否为公开锁',
    inputs: [{ name: 'flow', label: '流程', socket: 'flow', isFlow: true }],
    outputs: [
      { name: 'flow', label: '流程', socket: 'flow', isFlow: true },
      { name: 'isPublic', label: '公开', socket: 'boolean' },
    ],
    configFields: [],
  },

  // ===================== 事件触发 =====================
  {
    type: 'NewDayTriggerNode',
    label: '新一天触发器',
    category: 'events',
    description: '事件入口：当玩家的"新一天"开始时自动触发（基于玩家时区和偏移设置）。无需流程输入，由系统事件驱动。',
    inputs: [],
    outputs: [{ name: 'flow', label: '流程', socket: 'flow', isFlow: true }],
    configFields: [],
  },
  {
    type: 'OnLockLikedTriggerNode',
    label: '锁被点赞触发器',
    category: 'events',
    description: '事件入口：当玩家的锁被其他人点赞时自动触发。输出点赞者的ID和名称。',
    inputs: [],
    outputs: [
      { name: 'flow', label: '流程', socket: 'flow', isFlow: true },
      { name: 'likerId', label: '点赞者ID', socket: 'number' },
      { name: 'likerName', label: '点赞者名称', socket: 'string' },
    ],
    configFields: [],
  },
  {
    type: 'OnTaskCompletedTriggerNode',
    label: '任务完成触发器',
    category: 'events',
    description: '事件入口：当玩家完成由本脚本创建的任务时自动触发。输出已完成任务的ID和标题。',
    inputs: [],
    outputs: [
      { name: 'flow', label: '流程', socket: 'flow', isFlow: true },
      { name: 'taskId', label: '任务ID', socket: 'number' },
      { name: 'taskTitle', label: '任务标题', socket: 'string' },
    ],
    configFields: [],
  },

  // ===================== 数据 =====================
  {
    type: 'RandomNumberNode',
    label: '随机数',
    category: 'data',
    description: '生成随机数',
    inputs: [
      { name: 'min', label: '最小值', socket: 'number' },
      { name: 'max', label: '最大值', socket: 'number' },
    ],
    outputs: [{ name: 'result', label: '结果', socket: 'number' }],
    configFields: [
      { key: 'staticMin', label: '最小值', type: 'number', defaultValue: 1 },
      { key: 'staticMax', label: '最大值', type: 'number', defaultValue: 100 },
      { key: 'integerOnly', label: '仅整数', type: 'boolean', defaultValue: true },
    ],
  },
  {
    type: 'RandomChoiceNode',
    label: '随机选择',
    category: 'data',
    description: '从加权列表中随机选一项（设置输出值，非分支）',
    inputs: [{ name: 'flow', label: '流程', socket: 'flow', isFlow: true }],
    outputs: [
      { name: 'flow', label: '流程', socket: 'flow', isFlow: true },
      { name: 'selectedIndex', label: '选中索引', socket: 'number' },
      { name: 'selectedLabel', label: '选中标签', socket: 'string' },
    ],
    configFields: [
      {
        key: 'choices',
        label: '选项列表',
        type: 'json',
        defaultValue: '[{"label":"选项1","weight":1},{"label":"选项2","weight":1}]',
      },
    ],
  },
  {
    type: 'ArrayOpNode',
    label: '数组操作',
    category: 'data',
    description: '对数组进行各种操作（增删改查、长度、包含、切片等）',
    inputs: [
      { name: 'flow', label: '流程', socket: 'flow', isFlow: true },
      { name: 'array', label: '数组', socket: 'array' },
      { name: 'item', label: '元素', socket: 'any' },
      { name: 'index', label: '索引', socket: 'number' },
    ],
    outputs: [
      { name: 'flow', label: '流程', socket: 'flow', isFlow: true },
      { name: 'result', label: '结果', socket: 'any' },
    ],
    configFields: [
      {
        key: 'op',
        label: '操作',
        type: 'select',
        defaultValue: 'push',
        options: [
          { label: '添加元素 (push)', value: 'push' },
          { label: '弹出末尾 (pop)', value: 'pop' },
          { label: '获取元素 (get)', value: 'get' },
          { label: '设置元素 (set)', value: 'set' },
          { label: '数组长度 (length)', value: 'length' },
          { label: '包含检查 (contains)', value: 'contains' },
          { label: '移除元素 (remove)', value: 'remove' },
          { label: '随机打乱 (shuffle)', value: 'shuffle' },
          { label: '切片 (slice)', value: 'slice' },
          { label: '拼接为字符串 (join)', value: 'join' },
        ],
      },
      { key: 'end', label: '结束索引（切片用）', type: 'number' },
      { key: 'separator', label: '分隔符（拼接用）', type: 'text', defaultValue: ', ' },
    ],
  },

  // ===================== 聊天室 =====================
  {
    type: 'OpenChatRoomNode',
    label: '打开聊天室',
    category: 'chat',
    description: '创建并打开一个聊天对话（私聊或群聊），后续消息将路由到此聊天室',
    inputs: [
      { name: 'flow', label: '流程', socket: 'flow', isFlow: true },
    ],
    outputs: [
      { name: 'flow', label: '流程', socket: 'flow', isFlow: true },
      { name: 'chatId', label: '聊天ID', socket: 'string' },
    ],
    configFields: [
      { key: 'chatId', label: '聊天ID（唯一标识）', type: 'text', defaultValue: '' },
      { key: 'chatName', label: '聊天名称', type: 'text', defaultValue: '' },
      { key: 'chatAvatar', label: '聊天头像', type: 'imageUpload', defaultValue: '' },
      { key: 'chatType', label: '聊天类型', type: 'select', defaultValue: 'private', options: [
        { label: '私聊', value: 'private' },
        { label: '群聊', value: 'group' },
      ]},
    ],
  },
  {
    type: 'SetActiveChatNode',
    label: '切换聊天室',
    category: 'chat',
    description: '将后续消息路由到指定聊天室（不创建新聊天室）',
    inputs: [
      { name: 'flow', label: '流程', socket: 'flow', isFlow: true },
      { name: 'chatId', label: '聊天ID', socket: 'string' },
    ],
    outputs: [
      { name: 'flow', label: '流程', socket: 'flow', isFlow: true },
    ],
    configFields: [
      { key: 'staticChatId', label: '固定聊天ID', type: 'text', defaultValue: '' },
    ],
  },

  // ===================== 视觉小说 =====================
  {
    type: 'EnterVNModeNode',
    label: '进入VN模式',
    category: 'vn',
    description: '切换到视觉小说沉浸模式（全屏背景+对话框）',
    inputs: [{ name: 'flow', label: '流程', socket: 'flow', isFlow: true }],
    outputs: [{ name: 'flow', label: '流程', socket: 'flow', isFlow: true }],
    configFields: [
      {
        key: 'orientation',
        label: '方向',
        type: 'select',
        defaultValue: 'portrait',
        options: [
          { label: '竖屏', value: 'portrait' },
          { label: '横屏', value: 'landscape' },
        ],
      },
    ],
  },
  {
    type: 'ExitVNModeNode',
    label: '退出VN模式',
    category: 'vn',
    description: '返回聊天模式',
    inputs: [{ name: 'flow', label: '流程', socket: 'flow', isFlow: true }],
    outputs: [{ name: 'flow', label: '流程', socket: 'flow', isFlow: true }],
    configFields: [],
  },
  {
    type: 'SetBackgroundNode',
    label: '设置背景',
    category: 'vn',
    description: '设置VN模式的背景图片/CG',
    inputs: [
      { name: 'flow', label: '流程', socket: 'flow', isFlow: true },
      { name: 'imageUrl', label: '图片URL', socket: 'string' },
    ],
    outputs: [{ name: 'flow', label: '流程', socket: 'flow', isFlow: true }],
    configFields: [
      { key: 'staticUrl', label: '静态背景', type: 'imageUpload', defaultValue: '' },
      {
        key: 'transition',
        label: '转场效果',
        type: 'select',
        defaultValue: 'fade',
        options: [
          { label: '淡入淡出', value: 'fade' },
          { label: '瞬切', value: 'instant' },
          { label: '滑入', value: 'slide' },
        ],
      },
    ],
  },
  {
    type: 'ShowSpriteNode',
    label: '显示立绘',
    category: 'vn',
    description: '在指定位置显示角色立绘',
    inputs: [
      { name: 'flow', label: '流程', socket: 'flow', isFlow: true },
      { name: 'imageUrl', label: '立绘URL', socket: 'string' },
    ],
    outputs: [{ name: 'flow', label: '流程', socket: 'flow', isFlow: true }],
    configFields: [
      { key: 'staticUrl', label: '静态立绘', type: 'imageUpload', defaultValue: '' },
      { key: 'characterId', label: '角色标识', type: 'text', defaultValue: '' },
      {
        key: 'position',
        label: '位置',
        type: 'select',
        defaultValue: 'center',
        options: [
          { label: '左侧', value: 'left' },
          { label: '居中', value: 'center' },
          { label: '右侧', value: 'right' },
        ],
      },
      {
        key: 'enterAnimation',
        label: '入场动画',
        type: 'select',
        defaultValue: 'fade',
        options: [
          { label: '淡入', value: 'fade' },
          { label: '瞬切', value: 'instant' },
          { label: '从左滑入', value: 'slide-left' },
          { label: '从右滑入', value: 'slide-right' },
        ],
      },
    ],
  },
  {
    type: 'ClearSpritesNode',
    label: '清除立绘',
    category: 'vn',
    description: '清除指定位置或全部立绘',
    inputs: [{ name: 'flow', label: '流程', socket: 'flow', isFlow: true }],
    outputs: [{ name: 'flow', label: '流程', socket: 'flow', isFlow: true }],
    configFields: [
      {
        key: 'target',
        label: '清除目标',
        type: 'select',
        defaultValue: 'all',
        options: [
          { label: '全部', value: 'all' },
          { label: '左侧', value: 'left' },
          { label: '居中', value: 'center' },
          { label: '右侧', value: 'right' },
        ],
      },
    ],
  },
  {
    type: 'VNDialogueNode',
    label: 'VN对话',
    category: 'vn',
    description: '在VN模式下显示对话（暂停等待玩家点击继续）',
    inputs: [
      { name: 'flow', label: '流程', socket: 'flow', isFlow: true },
      { name: 'text', label: '文本', socket: 'string' },
    ],
    outputs: [{ name: 'flow', label: '流程', socket: 'flow', isFlow: true }],
    configFields: [
      { key: 'staticText', label: '对话文本', type: 'textarea', defaultValue: '' },
      { key: 'characterId', label: '角色', type: 'characterSelect', defaultValue: '' },
      { key: 'speaker', label: '说话人', type: 'text', defaultValue: '' },
      { key: 'speakerAvatar', label: '说话人头像', type: 'imageUpload', defaultValue: '' },
      { key: 'autoAdvance', label: '自动推进', type: 'boolean', defaultValue: false },
      {
        key: 'textSpeed',
        label: '文字速度',
        type: 'select',
        defaultValue: 'normal',
        options: [
          { label: '慢', value: 'slow' },
          { label: '正常', value: 'normal' },
          { label: '快', value: 'fast' },
          { label: '瞬间', value: 'instant' },
        ],
      },
    ],
  },

  // ── 章节节点 ──
  {
    type: 'ChapterStartNode',
    label: '章节入口',
    category: 'flow',
    description: '章节的执行入口点（每个章节自动创建，不可删除）',
    inputs: [],
    outputs: [{ name: 'flow', label: '流程', socket: 'flow', isFlow: true }],
    configFields: [
      { key: 'chapterId', label: '章节ID', type: 'text', defaultValue: '' },
    ],
  },
  {
    type: 'GoToChapterNode',
    label: '跳转章节',
    category: 'flow',
    description: '跳转到指定章节继续执行',
    inputs: [{ name: 'flow', label: '流程', socket: 'flow', isFlow: true }],
    outputs: [],
    configFields: [
      { key: 'targetChapterId', label: '目标章节', type: 'chapterSelect', defaultValue: '' },
    ],
  },
];

export function getNodeDefinition(type: string): NodeTypeDefinition | undefined {
  return NODE_DEFINITIONS.find((d) => d.type === type);
}

export function getNodesByCategory(category: string): NodeTypeDefinition[] {
  return NODE_DEFINITIONS.filter((d) => d.category === category);
}
