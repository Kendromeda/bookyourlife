import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EntryEditor, EntryEditorHandle } from '@/components/feature/EntryEditor';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

function formatHeaderDate(): string {
  return new Date().toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function EntryModal() {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const router = useRouter();
  const params = useLocalSearchParams<{ questionId?: string; questionText?: string }>();

  const editorRef = useRef<EntryEditorHandle>(null);
  const [canSubmit, setCanSubmit] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.background }]} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
          <IconSymbol name="chevron.left" size={22} color={c.text} />
        </TouchableOpacity>
        <Text style={[styles.headerDate, { color: c.text }]}>{formatHeaderDate()}</Text>
        <TouchableOpacity
          onPress={() => editorRef.current?.submit()}
          disabled={!canSubmit}
          style={[
            styles.saveBtn,
            { backgroundColor: canSubmit ? c.accent : c.border },
          ]}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <IconSymbol name="checkmark" size={16} color={canSubmit ? '#fff' : c.muted} />
          )}
        </TouchableOpacity>
      </View>
      <EntryEditor
        ref={editorRef}
        questionId={params.questionId ?? null}
        questionText={params.questionText ?? null}
        onDone={() => router.back()}
        onCanSubmitChange={setCanSubmit}
        onSubmittingChange={setSubmitting}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerDate: { fontSize: 17, fontWeight: '600' },
  saveBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
