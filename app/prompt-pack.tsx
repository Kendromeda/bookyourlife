import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Radii, Spacing } from '@/constants/theme';
import { PROMPT_PACKS } from '@/constants/prompts';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function PromptPackScreen() {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const pack = PROMPT_PACKS.find((p) => p.id === id);

  if (!pack) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: c.background }]} edges={['top']}>
        <View style={styles.center}>
          <Text style={{ color: c.text }}>Pack not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.background }]} edges={['top']}>
      <View style={styles.headerBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <IconSymbol name="chevron.left" size={22} color={c.text} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.container}>
        <View style={[styles.iconBubble, { backgroundColor: c.surface, borderColor: c.border }]}>
          <IconSymbol name={pack.icon as any} size={28} color={c.accent} />
        </View>
        <Text style={[styles.title, { color: c.text }]}>{pack.title}</Text>
        <Text style={[styles.meta, { color: c.muted }]}>
          {pack.prompts.length} Prompts · Book Your Life
        </Text>
        <Text style={[styles.desc, { color: c.muted }]}>{pack.description}</Text>

        <View style={{ marginTop: Spacing.xl, gap: Spacing.md }}>
          {pack.prompts.map((p, i) => (
            <TouchableOpacity
              key={i}
              style={[styles.promptRow, { backgroundColor: c.surface, borderColor: c.border }]}
              onPress={() =>
                router.push({ pathname: '/modal', params: { questionText: p } })
              }
              activeOpacity={0.7}
            >
              <Text style={[styles.promptText, { color: c.text }]}>{p}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  headerBar: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
  backBtn: { padding: Spacing.sm, alignSelf: 'flex-start' },
  container: { padding: Spacing.lg, paddingBottom: Spacing.xxl },
  iconBubble: {
    width: 56,
    height: 56,
    borderRadius: Radii.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  title: { fontSize: 28, fontWeight: '700' },
  meta: { fontSize: 13, marginTop: Spacing.xs },
  desc: { fontSize: 15, lineHeight: 22, marginTop: Spacing.md },
  promptRow: {
    padding: Spacing.lg,
    borderRadius: Radii.md,
    borderWidth: 1,
  },
  promptText: { fontSize: 16, lineHeight: 24 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
