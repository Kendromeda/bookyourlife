import { Platform } from 'react-native';

const palette = {
  cream: '#FAF6F0',
  ink: '#2C2421',
  inkSoft: '#5A4F49',
  accent: '#C4886B',
  accentDark: '#A36F54',
  border: '#E5DCD0',
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
    tint: tintColorLight,
    icon: palette.inkSoft,
    border: palette.border,
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
    tint: tintColorDark,
    icon: '#D8CFC4',
    border: '#3A322C',
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
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
