import { useInfiniteQuery } from '@tanstack/react-query';
import { ActivityIndicator, FlatList, Image, StyleSheet, Text, View } from 'react-native';

import { Colors, Radii, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Entry, EntryListPage, fetchEntries } from '@/utils/entries';

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

function EntryRow({ entry }: { entry: Entry }) {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  return (
    <View style={[styles.row, { backgroundColor: c.surface, borderColor: c.border }]}>
      <Text style={[styles.date, { color: c.muted }]}>{formatDate(entry.written_at)}</Text>
      <Text style={[styles.body, { color: c.text }]} numberOfLines={4}>
        {entry.body}
      </Text>
      {entry.photos.length > 0 && (
        <View style={styles.photos}>
          {entry.photos.slice(0, 3).map((p) => (
            <Image key={p.id} source={{ uri: p.storage_key }} style={styles.thumb} />
          ))}
        </View>
      )}
    </View>
  );
}

export function Timeline({ ListHeaderComponent }: { ListHeaderComponent?: React.ReactElement }) {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const query = useInfiniteQuery<EntryListPage>({
    queryKey: ['entries'],
    queryFn: ({ pageParam }) => fetchEntries(pageParam as string | undefined),
    initialPageParam: undefined,
    getNextPageParam: (last) => last.next_cursor ?? undefined,
  });

  const items = query.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <FlatList
      ListHeaderComponent={ListHeaderComponent}
      data={items}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => <EntryRow entry={item} />}
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
              No entries yet. Answer today&apos;s question to get started.
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
  date: { fontSize: 12, marginBottom: Spacing.xs, textTransform: 'uppercase', letterSpacing: 1 },
  body: { fontSize: 15, lineHeight: 22 },
  photos: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.md },
  thumb: { width: 60, height: 60, borderRadius: Radii.sm },
  center: { paddingVertical: Spacing.xxl, paddingHorizontal: Spacing.xl, alignItems: 'center' },
  empty: { fontSize: 14, textAlign: 'center', lineHeight: 22 },
});
