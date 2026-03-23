export interface CardFaceTheme {
  key: string
  name: string
  cardClassName: string
  watermark?: string
  decorCircle1?: string
  decorCircle2?: string
}

export const CARD_FACE_THEMES: Record<string, CardFaceTheme> = {
  default: {
    key: 'default',
    name: '默认',
    cardClassName: 'bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900',
  },
  alpha: {
    key: 'alpha',
    name: 'Alpha校园卡',
    cardClassName: 'card-face-alpha',
    watermark: '01',
    decorCircle1: 'bg-sky-400/20',
    decorCircle2: 'bg-purple-400/20',
  },
}

export function getCardFaceTheme(themeKey?: string): CardFaceTheme {
  if (!themeKey) return CARD_FACE_THEMES.default
  return CARD_FACE_THEMES[themeKey] ?? CARD_FACE_THEMES.default
}
