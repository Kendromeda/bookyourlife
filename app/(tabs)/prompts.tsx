import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Radii, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { getPromptPacks, getRecommended } from '@/constants/prompts';
import { fetchMe, Me } from '@/utils/users';

export default function PromptsScreen() {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const router = useRouter();
  const meQuery = useQuery<Me>({ queryKey: ['me'], queryFn: fetchMe });
  const language = meQuery.data?.preferred_language;
  const promptPacks = getPromptPacks(language);
  const recommended = getRecommended(language);

  const openPrompt = (text: string) => {
    router.push({ pathname: '/modal', params: { questionText: text } });
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.background }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={[styles.title, { color: c.text }]}>Prompts</Text>

        <Text style={[styles.section, { color: c.text }]}>Recommended</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingRight: Spacing.lg }}
          style={{ marginHorizontal: -Spacing.lg, paddingLeft: Spacing.lg }}
        >
          {recommended.map((p, i) => (
            <TouchableOpacity
              key={i}
              style={[styles.heroCard, { backgroundColor: c.accent }]}
              onPress={() => openPrompt(p.text)}
              activeOpacity={0.85}
            >
              <Text style={styles.heroLabel}>{p.text}</Text>
              <View style={styles.heroFooter}>
                <IconSymbol name="sparkles" size={14} color="#fff" />
                <Text style={styles.heroPack}>{p.pack}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <Text style={[styles.section, { color: c.text, marginTop: Spacing.xl }]}>Prompt Packs</Text>
        {promptPacks.map((pack) => (
          <TouchableOpacity
            key={pack.id}
            style={[styles.packRow, { backgroundColor: c.surface, borderColor: c.border }]}
            onPress={() =>
              router.push({ pathname: '/prompt-pack', params: { id: pack.id } })
            }
            activeOpacity={0.7}
          >
            <View style={[styles.packIcon, { backgroundColor: c.background }]}>
              <IconSymbol name={pack.icon as any} size={20} color={c.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.packTitle, { color: c.text }]}>{pack.title}</Text>
              <Text style={[styles.packMeta, { color: c.muted }]}>
                {pack.prompts.length} prompts
              </Text>
            </View>
            <IconSymbol name="chevron.right" size={18} color={c.muted} />
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: { padding: Spacing.lg, paddingBottom: Spacing.xxl },
  title: { fontSize: 32, fontWeight: '700', marginBottom: Spacing.lg },
  section: { fontSize: 18, fontWeight: '600', marginBottom: Spacing.md },
  heroCard: {
    width: 280,
    minHeight: 160,
    borderRadius: Radii.lg,
    padding: Spacing.lg,
    marginRight: Spacing.md,
    justifyContent: 'space-between',
  },
  heroLabel: { fontSize: 20, fontWeight: '600', color: '#fff', lineHeight: 28 },
  heroFooter: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginTop: Spacing.md },
  heroPack: { color: '#fff', fontSize: 13, opacity: 0.9 },
  packRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: Radii.md,
    borderWidth: 1,
    marginBottom: Spacing.sm,
  },
  packIcon: {
    width: 40,
    height: 40,
    borderRadius: Radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  packTitle: { fontSize: 16, fontWeight: '600' },
  packMeta: { fontSize: 13, marginTop: 2 },
});
