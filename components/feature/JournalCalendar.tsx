import { useInfiniteQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Radii, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Entry, EntryListPage, fetchEntries } from '@/utils/entries';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function startOfMonth(year: number, month: number): Date {
  return new Date(year, month, 1);
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

export function JournalCalendar() {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());

  const query = useInfiniteQuery<EntryListPage>({
    queryKey: ['entries', 'all'],
    queryFn: ({ pageParam }) => fetchEntries(pageParam as string | undefined, 100),
    initialPageParam: undefined,
    getNextPageParam: (last) => last.next_cursor ?? undefined,
  });

  useEffect(() => {
    if (query.hasNextPage && !query.isFetchingNextPage) {
      void query.fetchNextPage();
    }
  }, [query.hasNextPage, query.isFetchingNextPage, query.data, query]);

  const entries = useMemo(() => query.data?.pages.flatMap((p) => p.items) ?? [], [query.data]);

  const entriesByDay = useMemo(() => {
    const map = new Map<string, Entry[]>();
    for (const e of entries) {
      const d = new Date(e.written_at);
      if (d.getFullYear() === year && d.getMonth() === month) {
        const key = `${d.getDate()}`;
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(e);
      }
    }
    return map;
  }, [entries, year, month]);

  const firstDay = startOfMonth(year, month).getDay();
  const total = daysInMonth(year, month);

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= total; d++) cells.push(d);

  const goPrev = () => {
    if (month === 0) {
      setMonth(11);
      setYear(year - 1);
    } else {
      setMonth(month - 1);
    }
  };

  const goNext = () => {
    if (month === 11) {
      setMonth(0);
      setYear(year + 1);
    } else {
      setMonth(month + 1);
    }
  };

  return (
    <ScrollView contentContainerStyle={{ padding: Spacing.lg, paddingBottom: Spacing.xxl }}>
      <View style={styles.monthBar}>
        <TouchableOpacity onPress={goPrev} style={[styles.navBtn, { backgroundColor: c.surface, borderColor: c.border }]}>
          <IconSymbol name="chevron.left" size={18} color={c.text} />
        </TouchableOpacity>
        <Text style={[styles.monthLabel, { color: c.text }]}>
          {MONTH_NAMES[month]} {year}
        </Text>
        <TouchableOpacity onPress={goNext} style={[styles.navBtn, { backgroundColor: c.surface, borderColor: c.border }]}>
          <IconSymbol name="chevron.right" size={18} color={c.text} />
        </TouchableOpacity>
      </View>

      <View style={styles.dayHeader}>
        {DAY_LABELS.map((d, i) => (
          <Text key={i} style={[styles.dayLabel, { color: c.muted }]}>
            {d}
          </Text>
        ))}
      </View>

      <View style={styles.grid}>
        {cells.map((day, idx) => {
          if (day === null) return <View key={idx} style={styles.cell} />;
          const dayEntries = entriesByDay.get(`${day}`) ?? [];
          const has = dayEntries.length > 0;
          const isToday =
            day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
          return (
            <View key={idx} style={styles.cell}>
              <View
                style={[
                  styles.dayInner,
                  has && { backgroundColor: c.accent },
                  isToday && !has && { borderColor: c.accent, borderWidth: 2 },
                ]}
              >
                <Text
                  style={[
                    styles.dayNum,
                    { color: has ? '#fff' : c.text },
                  ]}
                >
                  {day}
                </Text>
              </View>
            </View>
          );
        })}
      </View>

      {query.isLoading && (
        <View style={{ paddingTop: Spacing.xl }}>
          <ActivityIndicator color={c.accent} />
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  monthBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.lg,
  },
  navBtn: {
    width: 36,
    height: 36,
    borderRadius: Radii.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthLabel: { fontSize: 18, fontWeight: '600' },
  dayHeader: { flexDirection: 'row', marginBottom: Spacing.sm },
  dayLabel: { flex: 1, textAlign: 'center', fontSize: 12, fontWeight: '600' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    padding: 3,
  },
  dayInner: {
    flex: 1,
    borderRadius: Radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayNum: { fontSize: 14, fontWeight: '500' },
});
