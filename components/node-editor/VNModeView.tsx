import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Loader2, Upload, Camera, Dice5, Timer } from 'lucide-react';
import TypewriterText from './TypewriterText';
import type { VNDisplayState, InputSpec } from './types';

interface VNModeViewProps {
  vnState: VNDisplayState;
  inputSpec: InputSpec | null;
  submitting: boolean;
  onSubmitChoice: (index: number) => void;
  onSubmitText: (value: string) => void;
  onSubmitDice: (result: number) => void;
  onSubmitImageUpload: (url: string) => void;
  onAdvanceDialogue: () => void;
  /** Whether player can click to advance (queue has items or VN_DIALOGUE input) */
  canAdvance?: boolean;
  /** Timer state from parent */
  timerEndTime: number | null;
  timerRemaining: number;
}

export default function VNModeView({
  vnState,
  inputSpec,
  submitting,
  onSubmitChoice,
  onSubmitText,
  onSubmitDice,
  onSubmitImageUpload,
  onAdvanceDialogue,
  canAdvance = false,
  timerEndTime,
  timerRemaining,
}: VNModeViewProps) {
  const [prevBg, setPrevBg] = useState<string | null>(null);
  const [bgTransition, setBgTransition] = useState(false);
  const [textComplete, setTextComplete] = useState(false);

  // Background transition effect
  useEffect(() => {
    if (vnState.backgroundUrl && vnState.backgroundUrl !== prevBg) {
      setBgTransition(true);
      const t = setTimeout(() => {
        setPrevBg(vnState.backgroundUrl);
        setBgTransition(false);
      }, 500);
      return () => clearTimeout(t);
    }
  }, [vnState.backgroundUrl]);

  // Reset text complete on new dialogue
  useEffect(() => {
    setTextComplete(false);
  }, [vnState.currentDialogue?.text]);

  const isInputActive = inputSpec && (
    inputSpec.type === 'CHOICE' ||
    inputSpec.type === 'TEXT' ||
    inputSpec.type === 'NUMBER' ||
    inputSpec.type === 'DICE' ||
    inputSpec.type === 'IMAGE_UPLOAD'
  );

  const handleScreenClick = useCallback(() => {
    // Don't advance while any interactive input is showing
    if (isInputActive) return;
    // Advance if dialogue queue has items or waiting for VN_DIALOGUE input
    if (canAdvance && vnState.currentDialogue) {
      onAdvanceDialogue();
    }
  }, [isInputActive, canAdvance, vnState.currentDialogue, onAdvanceDialogue]);

  const isLandscape = vnState.orientation === 'landscape';

  return (
    <div
      className={`flex-1 relative overflow-hidden bg-black select-none ${isLandscape ? 'landscape-vn' : ''}`}
      onClick={handleScreenClick}
    >
      {/* ── Background Layer ── */}
      {prevBg && (
        <img
          src={prevBg}
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${bgTransition ? 'opacity-0' : 'opacity-100'}`}
          alt=""
          draggable={false}
        />
      )}
      {vnState.backgroundUrl && vnState.backgroundUrl !== prevBg && (
        <img
          src={vnState.backgroundUrl}
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${bgTransition ? 'opacity-100' : 'opacity-0'}`}
          alt=""
          draggable={false}
        />
      )}

      {/* Dim overlay when no background */}
      {!vnState.backgroundUrl && !prevBg && (
        <div className="absolute inset-0 bg-gradient-to-b from-slate-900 to-black" />
      )}

      {/* ── Sprite Layer ── */}
      <div className="absolute inset-0 flex items-end pointer-events-none">
        {vnState.sprites.map((sprite) => (
          <div
            key={`${sprite.position}-${sprite.characterId || sprite.imageUrl}`}
            className={`absolute bottom-0 transition-all duration-500 ease-out ${
              sprite.position === 'left'
                ? 'left-0'
                : sprite.position === 'right'
                  ? 'right-0'
                  : 'left-1/2 -translate-x-1/2'
            }`}
            style={{
              maxWidth: '45%',
              maxHeight: '80%',
            }}
          >
            <img
              src={sprite.imageUrl}
              className="max-h-[70vh] object-contain drop-shadow-2xl"
              alt={sprite.characterId || ''}
              draggable={false}
            />
          </div>
        ))}
      </div>

      {/* ── Timer Overlay ── */}
      {timerEndTime && timerRemaining > 0 && (
        <div className="absolute top-4 right-4 z-20">
          <div className="bg-black/60 backdrop-blur-sm border border-white/20 rounded-2xl px-5 py-3 flex items-center gap-2">
            <Timer size={18} className="text-amber-400 dark:text-amber-300" />
            <span className="text-2xl font-mono font-bold text-amber-400 dark:text-amber-300">{timerRemaining}s</span>
          </div>
        </div>
      )}

      {/* ── Dialogue Box ── */}
      {vnState.currentDialogue && (
        <div className="absolute bottom-0 left-0 right-0 pointer-events-none">
          <div className="bg-gradient-to-t from-black/90 via-black/75 to-transparent pt-12 pb-5 px-5">
            {/* Speaker name */}
            {vnState.currentDialogue.speaker && (
              <div className="flex items-center gap-2 mb-2">
                {vnState.currentDialogue.speakerAvatar && (
                  <img
                    src={vnState.currentDialogue.speakerAvatar}
                    className="w-6 h-6 rounded-full object-cover ring-1 ring-white/30"
                    alt=""
                  />
                )}
                <span className="text-amber-300 text-xs font-bold tracking-wider uppercase">
                  {vnState.currentDialogue.speaker}
                </span>
              </div>
            )}

            {/* Dialogue text with typewriter */}
            <TypewriterText
              text={vnState.currentDialogue.text}
              speed="normal"
              onComplete={() => setTextComplete(true)}
            />

            {/* Advance hint */}
            {textComplete && !isInputActive && canAdvance && (
              <div className="text-xs text-white/40 mt-3 text-right animate-pulse">
                点击继续 ▼
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Choice Overlay (fixed to cover entire viewport including navbar) ── */}
      {inputSpec?.type === 'CHOICE' && inputSpec.choices && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-9999"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="w-full max-w-md px-6 space-y-3">
            {inputSpec.prompt && (
              <p className="text-center text-white/70 text-sm mb-4">{inputSpec.prompt}</p>
            )}
            {inputSpec.choices.map((choice) => (
              <button
                key={choice.index}
                onClick={() => onSubmitChoice(choice.index)}
                disabled={submitting}
                className="w-full px-6 py-4 bg-white/10 dark:bg-slate-800/10 backdrop-blur border border-white/20 text-white rounded-xl hover:bg-white/25 dark:bg-slate-800/25 active:scale-[0.98] transition-all text-sm font-medium disabled:opacity-50"
              >
                {choice.label}
                {choice.description && (
                  <span className="block text-xs text-white/50 mt-0.5">{choice.description}</span>
                )}
              </button>
            ))}
            {submitting && (
              <div className="flex justify-center pt-2">
                <Loader2 size={20} className="animate-spin text-white/60" />
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Text/Number Input Overlay ── */}
      {inputSpec && (inputSpec.type === 'TEXT' || inputSpec.type === 'NUMBER') && (
        <VNTextInput inputSpec={inputSpec} submitting={submitting} onSubmit={onSubmitText} />
      )}

      {/* ── Dice Roll Overlay ── */}
      {inputSpec?.type === 'DICE' && (
        <VNDiceOverlay
          prompt={inputSpec.prompt}
          sides={inputSpec.sides || 6}
          result={inputSpec.result || 1}
          submitting={submitting}
          onRolled={onSubmitDice}
        />
      )}

      {/* ── Image Upload Overlay ── */}
      {inputSpec?.type === 'IMAGE_UPLOAD' && (
        <VNImageUploadOverlay
          prompt={inputSpec.prompt}
          submitting={submitting}
          onSubmit={onSubmitImageUpload}
        />
      )}
    </div>
  );
}

/** Inline text/number input for VN mode */
function VNTextInput({
  inputSpec,
  submitting,
  onSubmit,
}: {
  inputSpec: InputSpec;
  submitting: boolean;
  onSubmit: (value: string) => void;
}) {
  const [value, setValue] = useState('');

  const handleSubmit = () => {
    if (!value.trim() || submitting) return;
    onSubmit(value.trim());
    setValue('');
  };

  return (
    <div
      className="absolute bottom-0 left-0 right-0 bg-black/70 backdrop-blur-sm p-4 z-10"
      onClick={(e) => e.stopPropagation()}
    >
      {inputSpec.prompt && (
        <p className="text-sm text-white/70 mb-2">{inputSpec.prompt}</p>
      )}
      <div className="flex gap-2">
        <input
          type={inputSpec.type === 'NUMBER' ? 'number' : 'text'}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(); }}
          placeholder={inputSpec.type === 'NUMBER' ? '输入数字...' : '输入内容...'}
          className="flex-1 px-4 py-2.5 bg-white/10 dark:bg-slate-800/10 border border-white/20 rounded-xl text-sm text-white placeholder-white/40 focus:outline-none focus:border-white/40"
          disabled={submitting}
          autoFocus
        />
        <button
          onClick={handleSubmit}
          disabled={submitting || !value.trim()}
          className="px-4 py-2.5 bg-amber-500/80 text-white rounded-xl hover:bg-amber-500 disabled:opacity-50 transition-colors text-sm font-medium"
        >
          {submitting ? <Loader2 size={18} className="animate-spin" /> : '确认'}
        </button>
      </div>
    </div>
  );
}

/** Dice roll overlay for VN mode */
function VNDiceOverlay({
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
  const [rolling, setRolling] = useState(false);
  const [displayFace, setDisplayFace] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);

  const doRoll = () => {
    if (rolling || revealed || submitting) return;
    setRolling(true);
    // Animate random faces
    let count = 0;
    const iv = setInterval(() => {
      setDisplayFace(Math.floor(Math.random() * sides) + 1);
      count++;
      if (count >= 12) {
        clearInterval(iv);
        setDisplayFace(result);
        setRolling(false);
        setRevealed(true);
        setTimeout(() => onRolled(result), 600);
      }
    }, 100);
  };

  return (
    <div
      className="absolute inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-10"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="text-center space-y-4">
        {prompt && (
          <p className="text-white/70 text-sm">{prompt}</p>
        )}
        <div className="relative">
          <div className={`w-24 h-24 mx-auto rounded-2xl flex items-center justify-center text-4xl font-bold border-2 transition-all ${
            revealed
              ? 'bg-amber-500/30 border-amber-400 text-amber-300 scale-110'
              : rolling
                ? 'bg-white/10 dark:bg-slate-800/10 border-white/30 text-white animate-pulse'
                : 'bg-white/10 dark:bg-slate-800/10 border-white/20 text-white/60'
          }`}>
            {displayFace !== null ? (
              <span>{displayFace}</span>
            ) : (
              <Dice5 size={40} />
            )}
          </div>
        </div>
        {!revealed && !rolling && (
          <button
            onClick={doRoll}
            disabled={submitting}
            className="px-8 py-3 bg-white/10 dark:bg-slate-800/10 backdrop-blur border border-white/20 text-white rounded-xl hover:bg-white/25 dark:bg-slate-800/25 active:scale-[0.98] transition-all text-sm font-medium disabled:opacity-50"
          >
            掷骰子 (d{sides})
          </button>
        )}
        {revealed && (
          <p className="text-amber-300 text-lg font-bold">
            结果: {result}
          </p>
        )}
        {submitting && (
          <div className="flex justify-center pt-2">
            <Loader2 size={20} className="animate-spin text-white/60" />
          </div>
        )}
      </div>
    </div>
  );
}

/** Image upload overlay for VN mode */
function VNImageUploadOverlay({
  prompt,
  submitting,
  onSubmit,
}: {
  prompt?: string;
  submitting: boolean;
  onSubmit: (url: string) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Show preview
    const reader = new FileReader();
    reader.onload = (ev) => setPreview(ev.target?.result as string);
    reader.readAsDataURL(file);

    // Upload
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const resp = await fetch('/api/upload/image', { method: 'POST', body: formData });
      if (!resp.ok) throw new Error('上传失败');
      const data = await resp.json();
      onSubmit(data.url);
    } catch (err: any) {
      setPreview(null);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div
      className="absolute inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-10"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="w-full max-w-sm px-6 text-center space-y-4">
        {prompt && (
          <p className="text-white/70 text-sm">{prompt}</p>
        )}

        {preview ? (
          <div className="relative">
            <img src={preview} className="max-h-48 mx-auto rounded-xl object-contain" alt="预览" />
            {(uploading || submitting) && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-xl">
                <Loader2 size={28} className="animate-spin text-white" />
              </div>
            )}
          </div>
        ) : (
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={submitting}
            className="w-full py-8 bg-white/10 dark:bg-slate-800/10 backdrop-blur border-2 border-dashed border-white/20 text-white rounded-xl hover:bg-white/15 dark:bg-slate-800/15 transition-all disabled:opacity-50"
          >
            <div className="flex flex-col items-center gap-2">
              <Camera size={32} className="text-white/60" />
              <span className="text-sm text-white/60">点击上传图片</span>
            </div>
          </button>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>
    </div>
  );
}
