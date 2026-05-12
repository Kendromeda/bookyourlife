import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { QuestionCard } from '@/components/feature/QuestionCard';
import { Timeline } from '@/components/feature/Timeline';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Radii, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { fetchTodayQuestion, Question, skipQuestion } from '@/utils/entries';

/**
 * Day boundaries are computed in the device's local timezone. Backend
 * filters by an explicit [from, to) ISO range so the UTC offset is
 * captured correctly.
 */
function startOfLocalDay(d: Date): Date {
  const next = new Date(d);
  next.setHours(0, 0, 0, 0);
  return next;
}

function addDays(d: Date, days: number): Date {
  const next = new Date(d);
  next.setDate(next.getDate() + days);
  return next;
}

function describeDate(d: Date, today: Date): { heading: string; sub: string } {
  const diffDays = Math.round(
    (d.getTime() - today.getTime()) / (24 * 60 * 60 * 1000),
  );
  const full = d.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  if (diffDays === 0) return { heading: 'Today', sub: full };
  if (diffDays === -1) return { heading: 'Yesterday', sub: full };
  if (diffDays === 1) return { heading: 'Tomorrow', sub: full };
  const short = d.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
  return { heading: short, sub: full };
}

export default function TodayScreen() {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const router = useRouter();
  const qc = useQueryClient();

  const [today, setToday] = useState<Date>(() => startOfLocalDay(new Date()));
  const [activeDate, setActiveDate] = useState<Date>(today);

  // Refresh `today` each time the screen regains focus so a session
  // that survives across midnight self-corrects.
  useFocusEffect(
    useCallback(() => {
      const fresh = startOfLocalDay(new Date());
      if (fresh.getTime() !== today.getTime()) {
        setToday(fresh);
        // If user was viewing the old "today", roll them forward.
        if (activeDate.getTime() === today.getTime()) {
          setActiveDate(fresh);
        }
      }
    }, [today, activeDate]),
  );

  const isToday = activeDate.getTime() === today.getTime();

  const todayQuery = useQuery<Question | null>({
    queryKey: ['questions', 'today'],
    queryFn: fetchTodayQuestion,
    staleTime: 5 * 60_000,
    enabled: isToday,
  });

  const skip = useMutation({
    mutationFn: (q: Question) => skipQuestion(q.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['questions', 'today'] }),
  });

  const onAnswer = (q: Question) => {
    router.push({ pathname: '/modal', params: { questionId: q.id, questionText: q.text } });
  };

  const goPrev = () => setActiveDate((d) => addDays(d, -1));
  const goNext = () => {
    if (isToday) return;
    setActiveDate((d) => addDays(d, 1));
  };
  const goToday = () => setActiveDate(today);

  // For backdating, anchor the new entry at noon local on the active
  // date — far from any timezone boundary, so it stays in the right
  // local day regardless of where the device is.
  const backdateWrittenAt = (() => {
    if (isToday) return null;
    const at = new Date(activeDate);
    at.setHours(12, 0, 0, 0);
    return at.toISOString();
  })();

  const newEntryParams = backdateWrittenAt ? { writtenAt: backdateWrittenAt } : {};

  // Timeline range filter: [activeDate 00:00 local, activeDate+1 00:00 local).
  const dayStart = activeDate;
  const dayEnd = addDays(activeDate, 1);

  const { heading, sub } = describeDate(activeDate, today);

  const header = (
    <View style={styles.headerWrap}>
      <View style={styles.dateBar}>
        <TouchableOpacity
          onPress={goPrev}
          style={[styles.navBtn, { backgroundColor: c.surface, borderColor: c.border }]}
          hitSlop={8}
        >
          <IconSymbol name="chevron.left" size={18} color={c.text} />
        </TouchableOpacity>

        <TouchableOpacity onPress={goToday} activeOpacity={0.7} style={styles.dateTitleCenter}>
          <Text style={[styles.title, { color: c.text }]}>{heading}</Text>
          <Text style={[styles.subtitle, { color: c.muted }]}>{sub}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={goNext}
          disabled={isToday}
          style={[
            styles.navBtn,
            {
              backgroundColor: c.surface,
              borderColor: c.border,
              opacity: isToday ? 0.35 : 1,
            },
          ]}
          hitSlop={8}
        >
          <IconSymbol name="chevron.right" size={18} color={c.text} />
        </TouchableOpacity>
      </View>

      {isToday && (todayQuery.isLoading ? (
        <View style={styles.loadingCard}>
          <ActivityIndicator color={c.accent} />
        </View>
      ) : todayQuery.isError ? (
        <View style={[styles.questionError, { backgroundColor: c.surface, borderColor: c.border }]}>
          <Text style={[styles.questionErrorText, { color: c.muted }]}>
            Daily question could not load.
          </Text>
          <TouchableOpacity onPress={() => todayQuery.refetch()} style={styles.questionRetry}>
            <Text style={[styles.questionRetryText, { color: c.text }]}>Try again</Text>
          </TouchableOpacity>
        </View>
      ) : todayQuery.data ? (
        <View style={{ marginTop: Spacing.lg }}>
          <QuestionCard question={todayQuery.data} onAnswer={onAnswer} onSkip={(q) => skip.mutate(q)} />
        </View>
      ) : null)}
    </View>
  );

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.background }]} edges={['top']}>
      <Timeline
        ListHeaderComponent={header}
        fromIso={isToday ? undefined : dayStart.toISOString()}
        toIso={isToday ? undefined : dayEnd.toISOString()}
        emptyLabel={isToday ? undefined : 'No entries on this day yet.'}
      />
      <TouchableOpacity
        style={[styles.fab, { backgroundColor: c.accent }]}
        onPress={() => router.push({ pathname: '/modal', params: newEntryParams })}
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
  dateBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  dateTitleCenter: { flex: 1, alignItems: 'center' },
  navBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 28, fontWeight: '700' },
  subtitle: { fontSize: 13, marginTop: 2 },
  loadingCard: { paddingVertical: Spacing.xl },
  questionError: {
    marginTop: Spacing.lg,
    borderWidth: 1,
    borderRadius: Radii.md,
    padding: Spacing.lg,
  },
  questionErrorText: { fontSize: 14, lineHeight: 20 },
  questionRetry: { marginTop: Spacing.sm, alignSelf: 'flex-start' },
  questionRetryText: { fontSize: 14, fontWeight: '600' },
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
