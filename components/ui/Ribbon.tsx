import { StyleSheet, Text, View, ViewStyle } from 'react-native';

import { Colors, Type } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

type RibbonProps = {
  width?: number;
  length?: number;
  color?: string;
  /** Background behind the ribbon — required to fake the bottom V-notch. */
  backgroundColor?: string;
  style?: ViewStyle;
};

/**
 * Vertical bookmark ribbon — a strip with a V-notched bottom edge. The
 * notch is rendered by stacking two background-colored triangles over
 * the bottom of the strip, so callers must pass the `backgroundColor`
 * the ribbon is sitting on (defaults to the screen background).
 */
export function Ribbon({
  width = 16,
  length = 56,
  color,
  backgroundColor,
  style,
}: RibbonProps) {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const fill = color ?? c.accent;
  const bg = backgroundColor ?? c.background;
  const notchHeight = Math.max(6, Math.round(width * 0.6));
  const halfWidth = width / 2;
  return (
    <View
      style={[{ width, height: length, backgroundColor: fill }, style]}
      pointerEvents="none"
    >
      {/* Left half of the notch — a triangle cut out of the bottom-left */}
      <View
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          width: 0,
          height: 0,
          borderRightWidth: halfWidth,
          borderBottomWidth: notchHeight,
          borderRightColor: 'transparent',
          borderBottomColor: bg,
        }}
      />
      {/* Right half of the notch */}
      <View
        style={{
          position: 'absolute',
          bottom: 0,
          right: 0,
          width: 0,
          height: 0,
          borderLeftWidth: halfWidth,
          borderBottomWidth: notchHeight,
          borderLeftColor: 'transparent',
          borderBottomColor: bg,
        }}
      />
    </View>
  );
}

type RibbonMarkProps = {
  size?: number;
  inkColor?: string;
  accentColor?: string;
  /** Background behind the mark, for the bookmark flag notch. */
  backgroundColor?: string;
};

/**
 * The brand sigil — a serif "L" with a small bookmark flag tucked into
 * the negative space on the right.
 */
export function RibbonMark({
  size = 22,
  inkColor,
  accentColor,
  backgroundColor,
}: RibbonMarkProps) {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const ink = inkColor ?? c.text;
  const accent = accentColor ?? c.accent;
  const bg = backgroundColor ?? c.background;

  const flagWidth = Math.round(size * 0.34);
  const flagHeight = Math.round(size * 0.66);

  return (
    <View
      style={{
        width: size + flagWidth * 0.4,
        height: size * 1.06,
        flexDirection: 'row',
        alignItems: 'flex-start',
      }}
    >
      <Text
        style={{
          fontFamily: Type.serif,
          fontSize: size,
          fontWeight: '600',
          color: ink,
          lineHeight: size * 1.02,
          letterSpacing: -size * 0.02,
          includeFontPadding: false as unknown as undefined,
        } as any}
      >
        L
      </Text>
      <View style={{ marginLeft: 1, marginTop: Math.round(size * 0.04) }}>
        <Ribbon
          width={flagWidth}
          length={flagHeight}
          color={accent}
          backgroundColor={bg}
        />
      </View>
    </View>
  );
}

/**
 * Small mono uppercase label. Sits above titles, beside dates, and at
 * the top of every settings group.
 */
export function Eyebrow({
  children,
  color,
  style,
}: {
  children: React.ReactNode;
  color?: string;
  style?: ViewStyle;
}) {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  return (
    <Text
      style={[
        styles.eyebrow,
        { color: color ?? c.muted },
        style as object,
      ]}
    >
      {children}
    </Text>
  );
}

/**
 * Triangular accent shown beneath active tab labels / section tabs —
 * replaces a hard underline with a small ribbon notch.
 */
export function RibbonNotch({
  width = 14,
  color,
}: {
  width?: number;
  color?: string;
}) {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  return (
    <View
      style={{
        width: 0,
        height: 0,
        borderLeftWidth: width / 2,
        borderRightWidth: width / 2,
        borderTopWidth: width * 0.43,
        borderLeftColor: 'transparent',
        borderRightColor: 'transparent',
        borderTopColor: color ?? c.accent,
      }}
    />
  );
}

const styles = StyleSheet.create({
  eyebrow: {
    fontFamily: Type.mono,
    fontSize: 10,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
});
