import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EntryEditor, EntryEditorHandle } from '@/components/feature/EntryEditor';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { EntryNeighbors, fetchEntryNeighbors } from '@/utils/entries';

function formatDate(iso: string | null | undefined): string {
  const d = iso ? new Date(iso) : new Date();
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

const SWIPE_THRESHOLD = 80;
const SWIPE_VELOCITY = 500;

export default function EntryModal() {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const router = useRouter();
  const params = useLocalSearchParams<{
    questionId?: string;
    questionText?: string;
    entryId?: string;
    writtenAt?: string;
  }>();

  const entryId = params.entryId ?? null;
  const editorRef = useRef<EntryEditorHandle>(null);
  const [canSubmit, setCanSubmit] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [activeDate, setActiveDate] = useState<string | null>(null);

  const neighborsQuery = useQuery<EntryNeighbors>({
    queryKey: ['entry-neighbors', entryId],
    queryFn: () => fetchEntryNeighbors(entryId!),
    enabled: Boolean(entryId),
    staleTime: 30_000,
  });
  const older = neighborsQuery.data?.older ?? null;
  const newer = neighborsQuery.data?.newer ?? null;

  const navigateToEntry = useCallback(
    (targetId: string) => {
      router.setParams({
        entryId: targetId,
        questionId: undefined,
        questionText: undefined,
      } as any);
      setIsDirty(false);
    },
    [router],
  );

  const confirmAndNavigate = useCallback(
    (targetId: string) => {
      if (!isDirty) {
        navigateToEntry(targetId);
        return;
      }
      Alert.alert(
        'Discard unsaved changes?',
        'Your edits to this entry will be lost.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Discard',
            style: 'destructive',
            onPress: () => navigateToEntry(targetId),
          },
        ],
      );
    },
    [isDirty, navigateToEntry],
  );

  const goOlder = () => {
    if (older) confirmAndNavigate(older.id);
  };
  const goNewer = () => {
    if (newer) confirmAndNavigate(newer.id);
  };

  const swipeGesture = Gesture.Pan()
    .activeOffsetX([-20, 20])
    .failOffsetY([-15, 15])
    .onEnd((event) => {
      const tx = event.translationX;
      const vx = event.velocityX;
      const right = tx > SWIPE_THRESHOLD || vx > SWIPE_VELOCITY;
      const left = tx < -SWIPE_THRESHOLD || vx < -SWIPE_VELOCITY;
      if (right && older) {
        confirmAndNavigate(older.id);
      } else if (left && newer) {
        confirmAndNavigate(newer.id);
      }
    })
    .runOnJS(true);

  const confirmDelete = () => {
    Alert.alert(
      'Delete entry?',
      'This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => editorRef.current?.delete(),
        },
      ],
    );
  };

  const headerDateText = formatDate(activeDate);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.background }]} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
          <IconSymbol name="chevron.left" size={22} color={c.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={[styles.headerDate, { color: c.text }]} numberOfLines={1}>
            {headerDateText}
          </Text>
          {isEditMode && (
            <View style={styles.navRow}>
              <TouchableOpacity
                onPress={goOlder}
                disabled={!older}
                hitSlop={10}
                style={styles.navBtn}
              >
                <IconSymbol
                  name="chevron.left"
                  size={16}
                  color={older ? c.text : c.border}
                />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={goNewer}
                disabled={!newer}
                hitSlop={10}
                style={styles.navBtn}
              >
                <IconSymbol
                  name="chevron.right"
                  size={16}
                  color={newer ? c.text : c.border}
                />
              </TouchableOpacity>
            </View>
          )}
        </View>
        <View style={styles.headerActions}>
          {isEditMode && (
            <TouchableOpacity
              onPress={confirmDelete}
              style={[styles.iconBtn, { marginRight: Spacing.xs }]}
            >
              <IconSymbol name="xmark" size={18} color={c.danger} />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={() => editorRef.current?.submit()}
            disabled={!canSubmit}
            style={[styles.saveBtn, { backgroundColor: canSubmit ? c.accent : c.border }]}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <IconSymbol name="checkmark" size={16} color={canSubmit ? '#fff' : c.muted} />
            )}
          </TouchableOpacity>
        </View>
      </View>
      <GestureDetector gesture={swipeGesture}>
        <View style={styles.flex}>
          <EntryEditor
            key={entryId ?? params.writtenAt ?? 'new'}
            ref={editorRef}
            questionId={params.questionId ?? null}
            questionText={params.questionText ?? null}
            entryId={entryId}
            initialWrittenAt={params.writtenAt ?? null}
            onDone={() => router.back()}
            onCanSubmitChange={setCanSubmit}
            onSubmittingChange={setSubmitting}
            onEditModeChange={setIsEditMode}
            onDirtyChange={setIsDirty}
            onWrittenAtChange={setActiveDate}
          />
        </View>
      </GestureDetector>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  navRow: { flexDirection: 'row', gap: Spacing.lg },
  navBtn: { padding: 2 },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerActions: { flexDirection: 'row', alignItems: 'center' },
  headerDate: { fontSize: 15, fontWeight: '600' },
  saveBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
