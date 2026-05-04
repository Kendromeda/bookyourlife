import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Radii, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function BookScreen() {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const router = useRouter();

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.background }]} edges={['top']}>
      <View style={styles.headerBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <IconSymbol name="chevron.left" size={22} color={c.text} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.container}>
        <View style={[styles.heroCard, { backgroundColor: c.surface, borderColor: c.border }]}>
          <IconSymbol name="book.fill" size={40} color={c.accent} />
          <Text style={[styles.heroTitle, { color: c.text }]}>Your Book</Text>
          <Text style={[styles.heroSub, { color: c.muted }]}>
            Compile your entries into a beautiful printable book.
          </Text>
        </View>

        <Text style={[styles.section, { color: c.text }]}>How it works</Text>
        <View style={[styles.step, { backgroundColor: c.surface, borderColor: c.border }]}>
          <Text style={[styles.stepNum, { color: c.accent }]}>01</Text>
          <Text style={[styles.stepText, { color: c.text }]}>
            Keep journaling. The more entries you have, the richer your book.
          </Text>
        </View>
        <View style={[styles.step, { backgroundColor: c.surface, borderColor: c.border }]}>
          <Text style={[styles.stepNum, { color: c.accent }]}>02</Text>
          <Text style={[styles.stepText, { color: c.text }]}>
            We turn them into chapters with AI-crafted illustrations.
          </Text>
        </View>
        <View style={[styles.step, { backgroundColor: c.surface, borderColor: c.border }]}>
          <Text style={[styles.stepNum, { color: c.accent }]}>03</Text>
          <Text style={[styles.stepText, { color: c.text }]}>
            Order a hardcover copy or download a PDF.
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.cta, { backgroundColor: c.accent }]}
          activeOpacity={0.85}
        >
          <Text style={styles.ctaLabel}>Generate preview</Text>
        </TouchableOpacity>
        <Text style={[styles.disclaimer, { color: c.muted }]}>
          Coming soon — book generation will be available once you have at least 30 entries.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  headerBar: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
  backBtn: { padding: Spacing.sm, alignSelf: 'flex-start' },
  container: { padding: Spacing.lg, paddingBottom: Spacing.xxl },
  heroCard: {
    padding: Spacing.xl,
    borderRadius: Radii.lg,
    borderWidth: 1,
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  heroTitle: { fontSize: 24, fontWeight: '700' },
  heroSub: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  section: { fontSize: 18, fontWeight: '600', marginBottom: Spacing.md },
  step: {
    flexDirection: 'row',
    gap: Spacing.md,
    padding: Spacing.lg,
    borderRadius: Radii.md,
    borderWidth: 1,
    marginBottom: Spacing.sm,
  },
  stepNum: { fontSize: 18, fontWeight: '700' },
  stepText: { flex: 1, fontSize: 14, lineHeight: 20 },
  cta: {
    marginTop: Spacing.xl,
    paddingVertical: Spacing.lg,
    borderRadius: Radii.md,
    alignItems: 'center',
  },
  ctaLabel: { color: '#fff', fontSize: 16, fontWeight: '600' },
  disclaimer: { fontSize: 12, textAlign: 'center', marginTop: Spacing.md, lineHeight: 18 },
});
