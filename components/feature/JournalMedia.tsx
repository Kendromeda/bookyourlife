import { useInfiniteQuery } from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';
import { ActivityIndicator, FlatList, Image, StyleSheet, Text, View } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Radii, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { EntryListPage, fetchEntries } from '@/utils/entries';

export function JournalMedia() {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];

  const query = useInfiniteQuery<EntryListPage>({
    queryKey: ['entries', 'all'],
    queryFn: ({ pageParam }) =>
      fetchEntries({ cursor: pageParam as string | undefined, limit: 100 }),
    initialPageParam: undefined,
    getNextPageParam: (last) => last.next_cursor ?? undefined,
  });

  useEffect(() => {
    if (query.hasNextPage && !query.isFetchingNextPage) {
      void query.fetchNextPage();
    }
  }, [query.hasNextPage, query.isFetchingNextPage, query.data, query]);

  const photos = useMemo(() => {
    const all = query.data?.pages.flatMap((p) => p.items) ?? [];
    return all.flatMap((e) =>
      e.photos.map((p) => ({ id: p.id, uri: p.storage_key, entryId: e.id })),
    );
  }, [query.data]);

  if (query.isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={c.accent} />
      </View>
    );
  }

  if (photos.length === 0) {
    return (
      <View style={styles.center}>
        <IconSymbol name="photo" size={48} color={c.muted} />
        <Text style={[styles.emptyTitle, { color: c.text }]}>Empty Media</Text>
        <Text style={[styles.emptySub, { color: c.muted }]}>
          Media will appear here when added to your journal
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      data={photos}
      keyExtractor={(item) => item.id}
      numColumns={3}
      contentContainerStyle={{ padding: 2, paddingBottom: Spacing.xxl }}
      renderItem={({ item }) => (
        <View style={styles.cell}>
          <Image source={{ uri: item.uri }} style={styles.photo} />
        </View>
      )}
    />
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
  emptyTitle: { fontSize: 18, fontWeight: '600' },
  emptySub: { fontSize: 14, textAlign: 'center' },
  cell: { width: '33.333%', aspectRatio: 1, padding: 2 },
  photo: { width: '100%', height: '100%', borderRadius: Radii.sm },
});
