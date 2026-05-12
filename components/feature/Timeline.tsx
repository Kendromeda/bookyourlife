import { useInfiniteQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { EntryMedia } from '@/components/feature/EntryMedia';
import { Colors, Radii, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Entry, EntryListPage, fetchEntries } from '@/utils/entries';

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

const FALLBACK_MARKERS = new Set(['(photo)', '(video)', '(voice note)']);

function extractDisplay(entry: Entry): { title: string | null; body: string } {
  // Prefer DB title if set.
  if (entry.title?.trim()) {
    const trimmed = entry.body.trim();
    return {
      title: entry.title.trim(),
      body: FALLBACK_MARKERS.has(trimmed) ? '' : entry.body,
    };
  }
  // Legacy fallback: parse from body (entries from before title column existed)
  const trimmedBody = entry.body.trim();
  if (FALLBACK_MARKERS.has(trimmedBody)) return { title: null, body: '' };
  const lines = entry.body.split('\n');
  const looksLikeTitle =
    lines.length > 1 && lines[0].length < 60 && !FALLBACK_MARKERS.has(lines[0].trim());
  if (looksLikeTitle) {
    const body = lines.slice(2).join('\n').trim() || lines.slice(1).join('\n').trim();
    return { title: lines[0], body };
  }
  return { title: null, body: entry.body };
}

function EntryRow({ entry, onPress }: { entry: Entry; onPress: () => void }) {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const { title, body } = extractDisplay(entry);

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      style={[styles.row, { backgroundColor: c.surface, borderColor: c.border }]}
    >
      <View style={styles.headerRow}>
        <Text style={[styles.date, { color: c.muted }]}>{formatDate(entry.written_at)}</Text>
        {entry.place_name && (
          <Text style={[styles.place, { color: c.muted }]} numberOfLines={1}>
            · {entry.place_name}
          </Text>
        )}
      </View>

      {title && (
        <Text style={[styles.title, { color: c.text }]} numberOfLines={2}>
          {title}
        </Text>
      )}

      {body.length > 0 && (
        <Text style={[styles.body, { color: c.text }]} numberOfLines={6}>
          {body}
        </Text>
      )}

      <EntryMedia photos={entry.photos} videos={entry.videos} audios={entry.audios} />
    </TouchableOpacity>
  );
}

type TimelineProps = {
  ListHeaderComponent?: React.ReactElement;
  /** ISO datetime, inclusive lower bound */
  fromIso?: string;
  /** ISO datetime, exclusive upper bound */
  toIso?: string;
  emptyLabel?: string;
};

export function Timeline({
  ListHeaderComponent,
  fromIso,
  toIso,
  emptyLabel,
}: TimelineProps) {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const router = useRouter();
  const filtered = Boolean(fromIso || toIso);
  const query = useInfiniteQuery<EntryListPage>({
    queryKey: filtered ? ['entries', { fromIso, toIso }] : ['entries'],
    queryFn: ({ pageParam }) =>
      fetchEntries({ cursor: pageParam as string | undefined, from: fromIso, to: toIso }),
    initialPageParam: undefined,
    getNextPageParam: (last) => last.next_cursor ?? undefined,
  });

  const items = query.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <FlatList
      ListHeaderComponent={ListHeaderComponent}
      data={items}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <EntryRow
          entry={item}
          onPress={() => router.push({ pathname: '/modal', params: { entryId: item.id } })}
        />
      )}
      contentContainerStyle={{ paddingBottom: Spacing.xxl }}
      onEndReached={() => query.hasNextPage && query.fetchNextPage()}
      onEndReachedThreshold={0.5}
      refreshing={query.isRefetching}
      onRefresh={() => query.refetch()}
      ListEmptyComponent={
        query.isLoading ? (
          <View style={styles.center}>
            <ActivityIndicator color={c.accent} />
          </View>
        ) : (
          <View style={styles.center}>
            <Text style={[styles.empty, { color: c.muted }]}>
              {emptyLabel ?? "No entries yet. Answer today's question to get started."}
            </Text>
          </View>
        )
      }
    />
  );
}

const styles = StyleSheet.create({
  row: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    padding: Spacing.lg,
    borderWidth: 1,
    borderRadius: Radii.md,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.xs },
  date: { fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 },
  place: { fontSize: 12, marginLeft: Spacing.xs, flex: 1 },
  title: { fontSize: 18, fontWeight: '700', marginBottom: Spacing.xs, lineHeight: 24 },
  body: { fontSize: 15, lineHeight: 22 },
  center: { paddingVertical: Spacing.xxl, paddingHorizontal: Spacing.xl, alignItems: 'center' },
  empty: { fontSize: 14, textAlign: 'center', lineHeight: 22 },
});
