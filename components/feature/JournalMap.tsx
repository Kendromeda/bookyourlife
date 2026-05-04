import { StyleSheet, Text, View } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export function JournalMap() {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];

  return (
    <View style={styles.center}>
      <IconSymbol name="map.fill" size={48} color={c.muted} />
      <Text style={[styles.title, { color: c.text }]}>Map coming soon</Text>
      <Text style={[styles.sub, { color: c.muted }]}>
        Entries will plot on a map once location capture is enabled.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
    gap: Spacing.md,
  },
  title: { fontSize: 18, fontWeight: '600' },
  sub: { fontSize: 14, textAlign: 'center' },
});
