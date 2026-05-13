import { ReactNode } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Eyebrow, RibbonMark } from '@/components/ui/Ribbon';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Spacing, Type } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

type Props = {
  title: string;
  eyebrow?: string;
  ribbon?: boolean;
  onBack?: () => void;
  right?: ReactNode;
};

/**
 * Editorial-style page header used across the modal/profile/privacy
 * stack. Centered serif title with an optional eyebrow and a tiny
 * RibbonMark above it; reuses the navbar pattern from the Book My Life
 * design system.
 */
export function AppHeader({ title, eyebrow, ribbon = true, onBack, right }: Props) {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  return (
    <View style={[styles.bar, { backgroundColor: c.background }]}>
      <View style={styles.side}>
        {onBack && (
          <TouchableOpacity onPress={onBack} hitSlop={10}>
            <IconSymbol name="chevron.left" size={22} color={c.text} />
          </TouchableOpacity>
        )}
      </View>
      <View style={styles.center}>
        {ribbon && (
          <RibbonMark
            size={16}
            inkColor={c.text}
            accentColor={c.accent}
            backgroundColor={c.background}
          />
        )}
        {eyebrow && <Eyebrow style={{ marginTop: 2 } as any}>{eyebrow}</Eyebrow>}
        <Text
          style={[styles.title, { color: c.text, fontFamily: Type.serif }]}
          numberOfLines={1}
        >
          {title}
        </Text>
      </View>
      <View style={[styles.side, styles.sideRight]}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
    gap: Spacing.md,
  },
  side: { minWidth: 36, justifyContent: 'center' },
  sideRight: { alignItems: 'flex-end' },
  center: { flex: 1, alignItems: 'center', gap: 2 },
  title: {
    fontSize: 17,
    fontWeight: '500',
    letterSpacing: -0.2,
  },
});
