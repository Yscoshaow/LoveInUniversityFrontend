import React, { useState, useCallback, useRef } from 'react';
import { ClassicPreset } from 'rete';
import { Presets } from 'rete-react-plugin';

const { RefSocket, RefControl } = Presets.classic;

// ─── UE5 Blueprint Socket 颜色 ──────────────────────────────
const SOCKET_COLORS: Record<string, string> = {
  flow: '#b8b8c8',
  number: '#4fc1e9',
  string: '#a0d468',
  boolean: '#ed5565',
  any: '#ac92ec',
  array: '#fc6e51',
};

// ─── 分类头部颜色（薄顶部条带） ─────────────────────────────
const CATEGORY_COLORS: Record<string, string> = {
  flow: '#d97706',
  variables: '#0891b2',
  player: '#059669',
  lock: '#dc2626',
  task: '#7c3aed',
  user: '#0284c7',
  events: '#ca8a04',
  data: '#4b5563',
  chat: '#10b981',
  vn: '#e879f9',
};

const CATEGORY_LABELS: Record<string, string> = {
  flow: '流程',
  variables: '变量',
  player: '交互',
  chat: '聊天室',
  lock: '锁',
  task: '任务',
  user: '用户',
  events: '事件',
  data: '数据',
  vn: '视觉小说',
};

// ─── Flow Socket (三角形 ►) ─────────────────────────────────
function FlowSocket({ color, connected }: { color: string; connected?: boolean }) {
  return (
    <div
      style={{
        width: 16,
        height: 16,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
      }}
    >
      <div
        style={{
          width: 0,
          height: 0,
          borderTop: '6px solid transparent',
          borderBottom: '6px solid transparent',
          borderLeft: `10px solid ${connected ? color : 'transparent'}`,
          filter: connected ? `drop-shadow(0 0 4px ${color}80)` : 'none',
          // 未连接时用边框形式的空心三角
          ...(connected
            ? {}
            : {
                borderLeft: `10px solid ${color}`,
                opacity: 0.5,
              }),
          transition: 'opacity 0.15s, filter 0.15s',
        }}
      />
    </div>
  );
}

// ─── Data Socket (圆形) ─────────────────────────────────────
function DataSocket({ color, connected }: { color: string; connected?: boolean }) {
  return (
    <div
      style={{
        width: 14,
        height: 14,
        borderRadius: '50%',
        background: connected ? color : 'transparent',
        border: `2.5px solid ${color}`,
        boxShadow: connected ? `0 0 8px ${color}60` : 'none',
        cursor: 'pointer',
        transition: 'background 0.15s, box-shadow 0.15s',
      }}
    />
  );
}

/**
 * 自定义 Socket 组件 — UE5 Blueprint 风格
 * flow = 三角形 ►, data = 彩色圆圈
 */
export function CustomSocketComponent(props: { data: ClassicPreset.Socket }) {
  const name = props.data?.name || 'any';
  const color = SOCKET_COLORS[name] || SOCKET_COLORS.any;
  const isFlow = name === 'flow';

  if (isFlow) {
    return <FlowSocket color={color} connected />;
  }
  return <DataSocket color={color} connected />;
}

// ─── InlineConfigControl ────────────────────────────────────
// 用于在节点体内显示行内编辑控件（select / text / number / boolean）
interface ConfigControlData {
  fieldDef: {
    key: string;
    label: string;
    type: string;
    defaultValue?: any;
    options?: { label: string; value: string }[];
    min?: number;
    max?: number;
  };
  value: any;
  configRef: Record<string, any>;
  onChange?: (value: any) => void;
}

function InlineConfigControl({ data }: { data: ConfigControlData }) {
  const { fieldDef, configRef } = data;
  const [val, setVal] = useState(data.value ?? fieldDef.defaultValue ?? '');

  const commit = useCallback(
    (v: any) => {
      setVal(v);
      configRef[fieldDef.key] = v;
      data.onChange?.(v);
    },
    [configRef, fieldDef.key, data]
  );

  // 阻止 Rete area 的 drag/pointer 事件吞噬控件交互
  const stopPropagation = useCallback((e: React.PointerEvent | React.MouseEvent) => {
    e.stopPropagation();
  }, []);

  const baseStyle: React.CSSProperties = {
    width: '100%',
    background: 'rgba(0,0,0,0.45)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 4,
    color: '#c8c8d8',
    fontSize: 11,
    padding: '3px 6px',
    outline: 'none',
    fontFamily: 'inherit',
  };

  const focusStyle = {
    borderColor: 'rgba(255,255,255,0.2)',
  };

  // characterSelect / chapterSelect — 动态下拉
  const dynamicOptions: { label: string; value: string }[] | undefined = (data as any).getDynamicOptions?.();
  if (dynamicOptions) {
    return (
      <div style={{ padding: '2px 0' }} onPointerDown={stopPropagation}>
        <div style={{ fontSize: 9, color: '#666680', marginBottom: 2, fontWeight: 600 }}>
          {fieldDef.label}
        </div>
        <select
          value={val}
          onChange={(e) => commit(e.target.value)}
          style={{
            ...baseStyle,
            appearance: 'none',
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='5'%3E%3Cpath d='M0 0l4 5 4-5z' fill='%23666680'/%3E%3C/svg%3E\")",
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'right 6px center',
            paddingRight: 20,
            cursor: 'pointer',
          }}
        >
          {dynamicOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
    );
  }

  if (fieldDef.type === 'select' && fieldDef.options) {
    return (
      <div style={{ padding: '2px 0' }} onPointerDown={stopPropagation}>
        <div style={{ fontSize: 9, color: '#666680', marginBottom: 2, fontWeight: 600 }}>
          {fieldDef.label}
        </div>
        <select
          value={val}
          onChange={(e) => commit(e.target.value)}
          style={{
            ...baseStyle,
            appearance: 'none',
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='5'%3E%3Cpath d='M0 0l4 5 4-5z' fill='%23666680'/%3E%3C/svg%3E\")",
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'right 6px center',
            paddingRight: 20,
            cursor: 'pointer',
          }}
        >
          {fieldDef.options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
    );
  }

  if (fieldDef.type === 'boolean') {
    return (
      <div
        style={{
          padding: '2px 0',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          cursor: 'pointer',
        }}
        onPointerDown={stopPropagation}
        onClick={() => commit(!val)}
      >
        <div
          style={{
            width: 14,
            height: 14,
            borderRadius: 3,
            border: '1.5px solid rgba(255,255,255,0.15)',
            background: val ? '#4fc1e9' : 'rgba(0,0,0,0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'background 0.15s',
          }}
        >
          {val && (
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M2 5l2 2 4-4" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </div>
        <span style={{ fontSize: 9, color: '#666680', fontWeight: 600 }}>{fieldDef.label}</span>
      </div>
    );
  }

  if (fieldDef.type === 'number') {
    return (
      <div style={{ padding: '2px 0' }} onPointerDown={stopPropagation}>
        <div style={{ fontSize: 9, color: '#666680', marginBottom: 2, fontWeight: 600 }}>
          {fieldDef.label}
        </div>
        <input
          type="number"
          value={val}
          min={fieldDef.min}
          max={fieldDef.max}
          onChange={(e) => commit(Number(e.target.value))}
          onFocus={(e) => Object.assign(e.currentTarget.style, focusStyle)}
          onBlur={(e) => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)')}
          style={baseStyle}
        />
      </div>
    );
  }

  if (fieldDef.type === 'textarea' || fieldDef.type === 'json') {
    return (
      <div style={{ padding: '2px 0' }} onPointerDown={stopPropagation}>
        <div style={{ fontSize: 9, color: '#666680', marginBottom: 2, fontWeight: 600 }}>
          {fieldDef.label}
        </div>
        <textarea
          value={typeof val === 'string' ? val : JSON.stringify(val, null, 2)}
          onChange={(e) => {
            if (fieldDef.type === 'json') {
              try {
                commit(JSON.parse(e.target.value));
              } catch {
                setVal(e.target.value);
              }
            } else {
              commit(e.target.value);
            }
          }}
          onFocus={(e) => Object.assign(e.currentTarget.style, focusStyle)}
          onBlur={(e) => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)')}
          rows={3}
          style={{ ...baseStyle, resize: 'vertical', minHeight: 36 }}
        />
      </div>
    );
  }

  // text (default)
  return (
    <div style={{ padding: '2px 0' }} onPointerDown={stopPropagation}>
      <div style={{ fontSize: 9, color: '#666680', marginBottom: 2, fontWeight: 600 }}>
        {fieldDef.label}
      </div>
      <input
        type="text"
        value={val}
        onChange={(e) => commit(e.target.value)}
        onFocus={(e) => Object.assign(e.currentTarget.style, focusStyle)}
        onBlur={(e) => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)')}
        style={baseStyle}
      />
    </div>
  );
}

/**
 * 自定义节点组件 — UE5 Blueprint 深色毛玻璃风格
 *
 * - 暗色半透明节点体
 * - 薄彩色顶部条带 (3px)
 * - 标题行 + 分类徽章
 * - 左输入 / 右输出 行对齐
 * - 行内 config 控件
 */
export function CustomNodeComponent(props: { data: any; emit: any }) {
  const { data, emit } = props;
  const category: string = data.__category || 'data';
  const catColor = CATEGORY_COLORS[category] || '#4b5563';
  const catLabel = CATEGORY_LABELS[category] || '';
  const isSelected = data.selected;

  const inputs = Object.entries(data.inputs || {}).filter(([_, v]) => v) as [string, any][];
  const outputs = Object.entries(data.outputs || {}).filter(([_, v]) => v) as [string, any][];
  const controls = Object.entries(data.controls || {}).filter(([_, v]) => v) as [string, any][];

  // 分离 flow 和 data 端口
  const flowInputs = inputs.filter(([k]) => k === 'flow' || k === 'exec');
  const dataInputs = inputs.filter(([k]) => k !== 'flow' && k !== 'exec');
  const flowOutputs = outputs.filter(([k]) => k === 'flow' || k === 'exec' || k === 'completed' || k === 'failed' || k === 'pending' || k === 'true' || k === 'false');
  const dataOutputs = outputs.filter(([k]) => k !== 'flow' && k !== 'exec' && k !== 'completed' && k !== 'failed' && k !== 'pending' && k !== 'true' && k !== 'false');

  // 用 socket type 来区分 flow 和 data
  const isFlowPort = (entry: [string, any]) => {
    const socket = entry[1]?.socket;
    return socket?.name === 'flow';
  };

  const allFlowInputs = inputs.filter(isFlowPort);
  const allDataInputs = inputs.filter((e) => !isFlowPort(e));
  const allFlowOutputs = outputs.filter(isFlowPort);
  const allDataOutputs = outputs.filter((e) => !isFlowPort(e));

  return (
    <div
      style={{
        background: 'rgba(22, 22, 35, 0.95)',
        backdropFilter: 'blur(8px)',
        borderRadius: 6,
        border: isSelected ? `1.5px solid ${catColor}` : '1px solid rgba(255,255,255,0.05)',
        boxShadow: isSelected
          ? `0 0 20px ${catColor}30, 0 8px 32px rgba(0,0,0,0.6)`
          : '0 4px 20px rgba(0,0,0,0.5)',
        minWidth: 200,
        overflow: 'hidden',
        transition: 'box-shadow 0.2s, border-color 0.2s',
        fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
      }}
    >
      {/* ── 顶部彩色条带 (3px) ── */}
      <div
        style={{
          height: 3,
          background: `linear-gradient(90deg, ${catColor}, ${catColor}88)`,
        }}
      />

      {/* ── 标题行 ── */}
      <div
        style={{
          padding: '6px 10px 5px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          borderBottom: '1px solid rgba(255,255,255,0.04)',
        }}
      >
        <span
          style={{
            color: '#e0e0ec',
            fontSize: 11.5,
            fontWeight: 700,
            letterSpacing: '0.01em',
          }}
        >
          {data.label}
        </span>
        <span
          style={{
            color: catColor,
            fontSize: 8.5,
            fontWeight: 700,
            background: `${catColor}15`,
            border: `1px solid ${catColor}30`,
            padding: '1px 6px',
            borderRadius: 3,
            whiteSpace: 'nowrap',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          {catLabel}
        </span>
      </div>

      {/* ── Flow 端口行（顶部，如果有） ── */}
      {(allFlowInputs.length > 0 || allFlowOutputs.length > 0) && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '4px 0',
            borderBottom: '1px solid rgba(255,255,255,0.03)',
          }}
        >
          {/* 左侧 flow 输入 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {allFlowInputs.map(([key, input]) => (
              <div
                key={`fi-${key}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '2px 12px 2px 4px',
                }}
              >
                <RefSocket
                  name="input-socket"
                  side="input"
                  socketKey={key}
                  nodeId={data.id}
                  payload={input.socket}
                  emit={emit}
                />
                <span style={{ color: '#606078', fontSize: 10, marginLeft: 4, fontWeight: 500 }}>
                  {input.label || key}
                </span>
              </div>
            ))}
            {allFlowInputs.length === 0 && <div style={{ width: 20 }} />}
          </div>

          {/* 右侧 flow 输出 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'flex-end' }}>
            {allFlowOutputs.map(([key, output]) => (
              <div
                key={`fo-${key}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '2px 4px 2px 12px',
                }}
              >
                <span style={{ color: '#606078', fontSize: 10, marginRight: 4, fontWeight: 500 }}>
                  {output.label || key}
                </span>
                <RefSocket
                  name="output-socket"
                  side="output"
                  socketKey={key}
                  nodeId={data.id}
                  payload={output.socket}
                  emit={emit}
                />
              </div>
            ))}
            {allFlowOutputs.length === 0 && <div style={{ width: 20 }} />}
          </div>
        </div>
      )}

      {/* ── 数据端口区域 ── */}
      <div style={{ padding: '4px 0 6px' }}>
        {/* 数据端口：输入（左）和输出（右）配对排列 */}
        {(() => {
          const maxRows = Math.max(allDataInputs.length, allDataOutputs.length);
          const rows = [];
          for (let i = 0; i < maxRows; i++) {
            const inp = allDataInputs[i];
            const out = allDataOutputs[i];
            rows.push(
              <div
                key={`row-${i}`}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '2px 0',
                  minHeight: 22,
                }}
              >
                {/* 左侧 data input */}
                {inp ? (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      padding: '0 10px 0 4px',
                    }}
                  >
                    <RefSocket
                      name="input-socket"
                      side="input"
                      socketKey={inp[0]}
                      nodeId={data.id}
                      payload={inp[1].socket}
                      emit={emit}
                    />
                    <span
                      style={{
                        color: SOCKET_COLORS[(inp[1] as any)?.socket?.name] || '#7a7a95',
                        fontSize: 10,
                        marginLeft: 6,
                        fontWeight: 500,
                      }}
                    >
                      {inp[1].label || inp[0]}
                    </span>
                    {inp[1].control && inp[1].showControl && (
                      <div style={{ marginLeft: 6 }}>
                        <RefControl
                          name="input-control"
                          payload={inp[1].control}
                          emit={emit}
                        />
                      </div>
                    )}
                  </div>
                ) : (
                  <div />
                )}

                {/* 右侧 data output */}
                {out ? (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      padding: '0 4px 0 10px',
                    }}
                  >
                    <span
                      style={{
                        color: SOCKET_COLORS[(out[1] as any)?.socket?.name] || '#7a7a95',
                        fontSize: 10,
                        marginRight: 6,
                        fontWeight: 500,
                      }}
                    >
                      {out[1].label || out[0]}
                    </span>
                    <RefSocket
                      name="output-socket"
                      side="output"
                      socketKey={out[0]}
                      nodeId={data.id}
                      payload={out[1].socket}
                      emit={emit}
                    />
                  </div>
                ) : (
                  <div />
                )}
              </div>
            );
          }
          return rows;
        })()}

        {/* ── 行内 Config 控件 ── */}
        {controls.map(([key, ctrl]) => (
          <div key={`ctrl-${key}`} style={{ padding: '2px 10px' }}>
            <RefControl name="control" payload={ctrl} emit={emit} />
          </div>
        ))}

        {/* 无端口无控件 */}
        {inputs.length === 0 && outputs.length === 0 && controls.length === 0 && (
          <div
            style={{
              padding: '8px 12px',
              color: '#333350',
              fontSize: 10,
              textAlign: 'center',
              fontStyle: 'italic',
            }}
          >
            无端口
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * 自定义 Connection 组件 — UE5 风格线条
 * flow 连接: 白色/灰色虚线, data 连接: 对应颜色实线
 */
export function CustomConnectionComponent(props: {
  data: any;
  styles?: () => any;
}) {
  const { data } = props;
  const path = props.styles?.();

  // 从 data 中获取 source socket 信息来确定颜色
  // 默认使用灰色
  return null; // 使用默认连接渲染, 通过 CSS 样式化
}

// ─── ChoiceListControl ─────────────────────────────────────────
// 用于 ShowChoiceNode 的选项列表编辑控件
interface ChoiceListControlData {
  choices: { label: string; description?: string }[];
  configRef: Record<string, any>;
  onChoicesChange?: (choices: { label: string; description?: string }[]) => void;
}

function ChoiceListControl({ data }: { data: ChoiceListControlData }) {
  const [choices, setChoices] = useState<{ label: string; description?: string }[]>(
    () => data.choices?.length > 0 ? data.choices : [{ label: '选项1' }, { label: '选项2' }]
  );

  const stopPropagation = useCallback((e: React.PointerEvent | React.MouseEvent) => {
    e.stopPropagation();
  }, []);

  const commit = useCallback(
    (updated: { label: string; description?: string }[]) => {
      setChoices(updated);
      data.configRef['choices'] = updated;
      data.onChoicesChange?.(updated);
    },
    [data]
  );

  const updateChoice = useCallback(
    (index: number, label: string) => {
      const updated = choices.map((c, i) => (i === index ? { ...c, label } : c));
      commit(updated);
    },
    [choices, commit]
  );

  const addChoice = useCallback(() => {
    if (choices.length >= 8) return;
    const updated = [...choices, { label: `选项${choices.length + 1}` }];
    commit(updated);
  }, [choices, commit]);

  const removeChoice = useCallback(
    (index: number) => {
      if (choices.length <= 2) return;
      const updated = choices.filter((_, i) => i !== index);
      commit(updated);
    },
    [choices, commit]
  );

  return (
    <div style={{ padding: '2px 0' }} onPointerDown={stopPropagation}>
      <div
        style={{
          fontSize: 9,
          color: '#666680',
          marginBottom: 4,
          fontWeight: 600,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span>选项列表</span>
        <span style={{ color: '#4a4a60', fontWeight: 400 }}>{choices.length}/8</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {choices.map((choice, idx) => (
          <div
            key={idx}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            {/* 序号标记 */}
            <div
              style={{
                width: 16,
                height: 16,
                borderRadius: 3,
                background: 'rgba(79,193,233,0.15)',
                color: '#4fc1e9',
                fontSize: 9,
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              {idx + 1}
            </div>

            {/* 文本输入 */}
            <input
              type="text"
              value={choice.label}
              placeholder={`选项 ${idx + 1}`}
              onChange={(e) => updateChoice(idx, e.target.value)}
              style={{
                flex: 1,
                minWidth: 0,
                background: 'rgba(0,0,0,0.45)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 4,
                color: '#c8c8d8',
                fontSize: 11,
                padding: '3px 6px',
                outline: 'none',
                fontFamily: 'inherit',
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)';
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
              }}
            />

            {/* 删除按钮 */}
            {choices.length > 2 && (
              <div
                onClick={() => removeChoice(idx)}
                style={{
                  width: 16,
                  height: 16,
                  borderRadius: 3,
                  background: 'rgba(237,85,101,0.1)',
                  color: '#ed5565',
                  fontSize: 11,
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  flexShrink: 0,
                  transition: 'background 0.15s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(237,85,101,0.25)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(237,85,101,0.1)';
                }}
              >
                ×
              </div>
            )}
          </div>
        ))}
      </div>

      {/* 添加按钮 */}
      {choices.length < 8 && (
        <div
          onClick={addChoice}
          style={{
            marginTop: 4,
            padding: '3px 0',
            textAlign: 'center',
            fontSize: 10,
            color: '#4fc1e9',
            background: 'rgba(79,193,233,0.06)',
            border: '1px dashed rgba(79,193,233,0.2)',
            borderRadius: 4,
            cursor: 'pointer',
            fontWeight: 600,
            transition: 'background 0.15s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(79,193,233,0.12)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(79,193,233,0.06)';
          }}
        >
          + 添加选项
        </div>
      )}
    </div>
  );
}

// ─── ImageUploadControl ─────────────────────────────────────────
// 用于 ShowImageNode 的图片上传控件
interface ImageUploadControlData {
  imageUrl: string;
  configRef: Record<string, any>;
  configKey: string;
  uploadFn: (file: File) => Promise<{ imageUrl: string }>;
}

function ImageUploadControl({ data }: { data: ImageUploadControlData }) {
  const [imageUrl, setImageUrl] = useState<string>(data.imageUrl || '');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const stopPropagation = useCallback((e: React.PointerEvent | React.MouseEvent) => {
    e.stopPropagation();
  }, []);

  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      // 验证文件类型
      if (!file.type.startsWith('image/')) {
        setError('请选择图片文件');
        return;
      }
      // 5MB 限制
      if (file.size > 5 * 1024 * 1024) {
        setError('图片不能超过 5MB');
        return;
      }

      setError(null);
      setUploading(true);
      try {
        const result = await data.uploadFn(file);
        setImageUrl(result.imageUrl);
        data.configRef[data.configKey] = result.imageUrl;
      } catch (err: any) {
        setError(err.message || '上传失败');
      } finally {
        setUploading(false);
      }
    },
    [data]
  );

  const handleClear = useCallback(() => {
    setImageUrl('');
    data.configRef[data.configKey] = '';
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [data]);

  return (
    <div style={{ padding: '2px 0' }} onPointerDown={stopPropagation}>
      <div
        style={{
          fontSize: 9,
          color: '#666680',
          marginBottom: 4,
          fontWeight: 600,
        }}
      >
        图片
      </div>

      {/* 隐藏的文件输入 */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        style={{ display: 'none' }}
      />

      {imageUrl ? (
        /* 已上传 — 显示缩略图 + 清除按钮 */
        <div style={{ position: 'relative' }}>
          <div
            style={{
              width: '100%',
              height: 80,
              borderRadius: 4,
              overflow: 'hidden',
              border: '1px solid rgba(255,255,255,0.08)',
              background: 'rgba(0,0,0,0.3)',
            }}
          >
            <img
              src={imageUrl}
              alt="preview"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
              }}
            />
          </div>
          <div
            style={{
              display: 'flex',
              gap: 4,
              marginTop: 4,
            }}
          >
            <div
              onClick={() => fileInputRef.current?.click()}
              style={{
                flex: 1,
                padding: '3px 0',
                textAlign: 'center',
                fontSize: 9,
                color: '#4fc1e9',
                background: 'rgba(79,193,233,0.06)',
                border: '1px solid rgba(79,193,233,0.15)',
                borderRadius: 3,
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              替换
            </div>
            <div
              onClick={handleClear}
              style={{
                flex: 1,
                padding: '3px 0',
                textAlign: 'center',
                fontSize: 9,
                color: '#ed5565',
                background: 'rgba(237,85,101,0.06)',
                border: '1px solid rgba(237,85,101,0.15)',
                borderRadius: 3,
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              移除
            </div>
          </div>
        </div>
      ) : (
        /* 未上传 — 显示上传区域 */
        <div
          onClick={() => !uploading && fileInputRef.current?.click()}
          style={{
            width: '100%',
            height: 60,
            borderRadius: 4,
            border: '1px dashed rgba(255,255,255,0.12)',
            background: 'rgba(0,0,0,0.2)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: uploading ? 'wait' : 'pointer',
            transition: 'border-color 0.15s, background 0.15s',
          }}
          onMouseEnter={(e) => {
            if (!uploading) {
              e.currentTarget.style.borderColor = 'rgba(79,193,233,0.3)';
              e.currentTarget.style.background = 'rgba(79,193,233,0.04)';
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)';
            e.currentTarget.style.background = 'rgba(0,0,0,0.2)';
          }}
        >
          {uploading ? (
            <span style={{ fontSize: 10, color: '#4fc1e9' }}>上传中...</span>
          ) : (
            <>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ marginBottom: 2 }}>
                <path
                  d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"
                  stroke="#555568"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span style={{ fontSize: 9, color: '#555568' }}>点击上传图片</span>
            </>
          )}
        </div>
      )}

      {error && (
        <div style={{ fontSize: 9, color: '#ed5565', marginTop: 3 }}>{error}</div>
      )}
    </div>
  );
}

// ─── 导出 InlineConfigControl 组件给 createEditor.ts 使用 ──────
export { InlineConfigControl, ChoiceListControl, ImageUploadControl };
export type { ConfigControlData, ChoiceListControlData, ImageUploadControlData };
