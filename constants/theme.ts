import { Platform } from 'react-native';

const palette = {
  cream: '#FAF6F0',
  paper: '#FFFFFF',
  ink: '#2C2421',
  inkSoft: '#5A4F49',
  accent: '#C4886B',
  accentDark: '#A36F54',
  border: '#E5DCD0',
  borderSoft: '#EFE7DA',
  surface: '#FFFFFF',
  danger: '#B5483B',
  muted: '#9B8E84',
};

const tintColorLight = palette.accent;
const tintColorDark = palette.cream;

export const Colors = {
  light: {
    text: palette.ink,
    textSoft: palette.inkSoft,
    background: palette.cream,
    surface: palette.surface,
    paper: palette.paper,
    tint: tintColorLight,
    icon: palette.inkSoft,
    border: palette.border,
    borderSoft: palette.borderSoft,
    accent: palette.accent,
    accentDark: palette.accentDark,
    danger: palette.danger,
    muted: palette.muted,
    tabIconDefault: palette.muted,
    tabIconSelected: tintColorLight,
  },
  dark: {
    text: palette.cream,
    textSoft: '#D8CFC4',
    background: '#1A1714',
    surface: '#26211D',
    paper: '#26211D',
    tint: tintColorDark,
    icon: '#D8CFC4',
    border: '#3A322C',
    borderSoft: '#332B26',
    accent: palette.accent,
    accentDark: palette.accentDark,
    danger: palette.danger,
    muted: palette.muted,
    tabIconDefault: '#9B8E84',
    tabIconSelected: tintColorDark,
  },
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

export const Radii = {
  sm: 6,
  md: 12,
  lg: 20,
  pill: 999,
};

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    italic: 'Georgia',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    italic: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    italic: "'Instrument Serif', Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});

/**
 * Editorial type ramp drawn from the Book My Life design system.
 * Newsreader (serif) for titles / questions / chapter headings, Manrope
 * for UI, DM Mono for eyebrows. We can't bundle Google Fonts as native
 * assets without a download step, so we map each role to the best
 * platform stock equivalent — italic comes via the `Fonts.italic` token
 * combined with `fontStyle: 'italic'` at the call site.
 */
export const Type = {
  serif: Fonts!.serif,
  sans: Fonts!.sans,
  italic: Fonts!.italic,
  mono: Fonts!.mono,
};

export const Letterspacing = {
  eyebrow: 1.4,
  tight: -0.2,
  none: 0,
};
