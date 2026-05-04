import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { QuestionCard } from '@/components/feature/QuestionCard';
import { Timeline } from '@/components/feature/Timeline';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Radii, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { fetchTodayQuestion, Question, skipQuestion } from '@/utils/entries';

function formatToday(): string {
  return new Date().toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function TodayScreen() {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const router = useRouter();
  const qc = useQueryClient();

  const todayQuery = useQuery<Question>({
    queryKey: ['questions', 'today'],
    queryFn: fetchTodayQuestion,
    staleTime: 5 * 60_000,
  });

  const skip = useMutation({
    mutationFn: (q: Question) => skipQuestion(q.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['questions', 'today'] }),
  });

  const onAnswer = (q: Question) => {
    router.push({ pathname: '/modal', params: { questionId: q.id, questionText: q.text } });
  };

  const header = (
    <View style={styles.headerWrap}>
      <Text style={[styles.title, { color: c.text }]}>Today</Text>
      <Text style={[styles.subtitle, { color: c.muted }]}>{formatToday()}</Text>

      {todayQuery.isLoading ? (
        <View style={styles.loadingCard}>
          <ActivityIndicator color={c.accent} />
        </View>
      ) : todayQuery.data ? (
        <View style={{ marginTop: Spacing.lg }}>
          <QuestionCard question={todayQuery.data} onAnswer={onAnswer} onSkip={(q) => skip.mutate(q)} />
        </View>
      ) : null}
    </View>
  );

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.background }]} edges={['top']}>
      <Timeline ListHeaderComponent={header} />
      <TouchableOpacity
        style={[styles.fab, { backgroundColor: c.accent }]}
        onPress={() => router.push('/modal')}
        activeOpacity={0.85}
      >
        <IconSymbol name="plus" size={20} color="#fff" />
        <Text style={styles.fabLabel}>New entry</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  headerWrap: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg, paddingBottom: Spacing.md },
  title: { fontSize: 32, fontWeight: '700' },
  subtitle: { fontSize: 14, marginTop: Spacing.xs },
  loadingCard: { paddingVertical: Spacing.xl },
  fab: {
    position: 'absolute',
    right: Spacing.lg,
    bottom: Spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: Radii.pill,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 4,
  },
  fabLabel: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
