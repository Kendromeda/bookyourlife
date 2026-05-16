import { useMutation, useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BookViewer } from '@/components/feature/book/BookViewer';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Radii, Spacing, Type } from '@/constants/theme';
import {
  BookImageMode,
  BookTone,
  createBookPreview,
  fetchBookPreview,
} from '@/utils/books';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { fetchMe, fetchStats, type Me, type UserStats } from '@/utils/users';

const TONES: { value: BookTone; label: string }[] = [
  { value: 'poetic', label: 'Poetic' },
  { value: 'honest', label: 'Honest' },
  { value: 'minimalist', label: 'Minimalist' },
  { value: 'cinematic', label: 'Cinematic' },
  { value: 'funny', label: 'Funny' },
  { value: 'deeply_reflective', label: 'Deeply reflective' },
];

const IMAGE_MODES: { value: BookImageMode; label: string }[] = [
  { value: 'abstract', label: 'Abstract visuals' },
  { value: 'photo_inspired', label: 'Use my photos as inspiration' },
  { value: 'none', label: 'No AI images' },
];

function currentMonthRange(): { start: Date; end: Date; label: string } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return {
    start,
    end,
    label: start.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }),
  };
}

export default function BookScreen() {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const router = useRouter();
  const range = useMemo(() => currentMonthRange(), []);
  const [tone, setTone] = useState<BookTone>('poetic');
  const [imageMode, setImageMode] = useState<BookImageMode>('abstract');
  const [includeVoiceTranscripts, setIncludeVoiceTranscripts] = useState(false);
  const [bookId, setBookId] = useState<string | null>(null);

  const previewQuery = useQuery({
    queryKey: ['book-preview', bookId],
    queryFn: () => fetchBookPreview(bookId!),
    enabled: !!bookId,
    refetchInterval: bookId ? 3000 : false,
  });

  const generate = useMutation({
    mutationFn: async () =>
      createBookPreview({
        period_start: range.start.toISOString(),
        period_end: range.end.toISOString(),
        tone,
        image_mode: imageMode,
        include_voice_transcripts: includeVoiceTranscripts,
      }),
    onSuccess: setBookId,
  });

  const preview = previewQuery.data;
  const busy =
    generate.isPending || preview?.status === 'queued' || preview?.status === 'processing';

  const meQuery = useQuery<Me>({
    queryKey: ['me'],
    queryFn: fetchMe,
    enabled: preview?.status === 'done',
    staleTime: 60_000,
  });
  const statsQuery = useQuery<UserStats>({
    queryKey: ['stats'],
    queryFn: fetchStats,
    enabled: preview?.status === 'done',
    staleTime: 60_000,
  });

  // When the preview lands, swap to the hardcover viewer. Setup state
  // stays mounted under the modal so a back-to-setup feels instant.
  if (preview?.status === 'done') {
    return (
      <BookViewer
        preview={preview}
        authorName={meQuery.data?.display_name ?? meQuery.data?.email ?? 'Author'}
        totalEntries={statsQuery.data?.total_entries ?? 0}
        totalWords={statsQuery.data?.total_words ?? 0}
        onClose={() => router.back()}
      />
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.background }]} edges={['top']}>
      <View style={styles.headerBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <IconSymbol name="chevron.left" size={22} color={c.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: c.text, fontFamily: Type.serif }]}>
          Your Book
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.hero}>
          <Text style={[styles.eyebrow, { color: c.accentDark }]}>BOOK PREVIEW</Text>
          <Text style={[styles.heroTitle, { color: c.text, fontFamily: Type.serif }]}>
            Turn this month into a chapter.
          </Text>
          <Text style={[styles.heroSub, { color: c.textSoft }]}>
            Generate a memoir-style preview with a title, opening letter, thematic chapters,
            media pages, and a reflection ending.
          </Text>
        </View>

        <Text style={[styles.section, { color: c.text }]}>Period</Text>
        <View style={[styles.periodRow, { borderColor: c.border, backgroundColor: c.surface }]}>
          <IconSymbol name="calendar" size={18} color={c.accent} />
          <Text style={[styles.periodText, { color: c.text }]}>{range.label}</Text>
        </View>

        <Text style={[styles.section, { color: c.text }]}>Tone</Text>
        <View style={styles.chipGrid}>
          {TONES.map((item) => (
            <Chip
              key={item.value}
              active={tone === item.value}
              label={item.label}
              onPress={() => setTone(item.value)}
            />
          ))}
        </View>

        <Text style={[styles.section, { color: c.text }]}>AI images</Text>
        <View style={styles.chipGrid}>
          {IMAGE_MODES.map((item) => (
            <Chip
              key={item.value}
              active={imageMode === item.value}
              label={item.label}
              onPress={() => setImageMode(item.value)}
            />
          ))}
        </View>

        <View style={[styles.toggleRow, { borderColor: c.border, backgroundColor: c.surface }]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.toggleTitle, { color: c.text }]}>Optional voice transcripts</Text>
            <Text style={[styles.toggleSub, { color: c.muted }]}>
              Off by default. When enabled, audio memories may be transcribed for this book only.
            </Text>
          </View>
          <Switch value={includeVoiceTranscripts} onValueChange={setIncludeVoiceTranscripts} />
        </View>

        <TouchableOpacity
          style={[styles.cta, { backgroundColor: c.accent }, busy && styles.disabled]}
          activeOpacity={0.85}
          disabled={busy}
          onPress={() => generate.mutate()}
        >
          {busy ? <ActivityIndicator color="#fff" /> : null}
          <Text style={styles.ctaLabel}>
            {busy ? 'Generating preview...' : 'Generate preview'}
          </Text>
        </TouchableOpacity>

        {generate.error ? (
          <Text style={[styles.error, { color: c.danger }]}>
            {generate.error instanceof Error ? generate.error.message : 'Could not start preview.'}
          </Text>
        ) : null}

        {preview ? <Preview preview={preview} /> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function Chip({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  return (
    <TouchableOpacity
      activeOpacity={0.75}
      onPress={onPress}
      style={[
        styles.chip,
        {
          borderColor: active ? c.accent : c.border,
          backgroundColor: active ? c.accent : c.surface,
        },
      ]}
    >
      <Text style={[styles.chipText, { color: active ? '#fff' : c.text }]}>{label}</Text>
    </TouchableOpacity>
  );
}

function Preview({ preview }: { preview: Awaited<ReturnType<typeof fetchBookPreview>> }) {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];

  if (preview.status === 'failed') {
    return (
      <View style={[styles.previewBlock, { borderColor: c.border, backgroundColor: c.surface }]}>
        <Text style={[styles.previewStatus, { color: c.danger }]}>Preview failed</Text>
        <Text style={[styles.bodyText, { color: c.textSoft }]}>
          {preview.error ?? 'Could not generate your book preview.'}
        </Text>
      </View>
    );
  }

  if (preview.status !== 'done') {
    return (
      <View style={[styles.previewBlock, { borderColor: c.border, backgroundColor: c.surface }]}>
        <Text style={[styles.previewStatus, { color: c.accentDark }]}>
          {preview.status === 'queued' ? 'Queued' : 'Writing your preview'}
        </Text>
        <Text style={[styles.bodyText, { color: c.textSoft }]}>
          This can take a minute while the AI reads your entries and shapes the book.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.preview}>
      {preview.cover_image_url ? (
        <Image source={{ uri: preview.cover_image_url }} style={styles.cover} resizeMode="cover" />
      ) : (
        <View style={[styles.coverFallback, { backgroundColor: c.surface, borderColor: c.border }]}>
          <IconSymbol name="book.fill" size={42} color={c.accent} />
        </View>
      )}

      <Text style={[styles.bookTitle, { color: c.text, fontFamily: Type.serif }]}>
        {preview.title}
      </Text>
      {preview.opening_letter ? (
        <Text style={[styles.opening, { color: c.textSoft }]}>{preview.opening_letter}</Text>
      ) : null}

      <Text style={[styles.section, { color: c.text }]}>Chapters</Text>
      {preview.chapters.map((chapter) => (
        <View
          key={chapter.title}
          style={[styles.previewBlock, { borderColor: c.border, backgroundColor: c.surface }]}
        >
          <Text style={[styles.chapterTitle, { color: c.text, fontFamily: Type.serif }]}>
            {chapter.title}
          </Text>
          <Text style={[styles.bodyText, { color: c.textSoft }]}>{chapter.narrative}</Text>
        </View>
      ))}

      {preview.media_pages.length > 0 ? (
        <>
          <Text style={[styles.section, { color: c.text }]}>Media memories</Text>
          {preview.media_pages.slice(0, 12).map((item) => (
            <View
              key={`${item.type}-${item.url}`}
              style={[styles.mediaRow, { borderColor: c.border, backgroundColor: c.surface }]}
            >
              <IconSymbol
                name={item.type === 'photo' ? 'photo' : item.type === 'video' ? 'video.fill' : 'mic.fill'}
                size={18}
                color={c.accent}
              />
              <View style={{ flex: 1 }}>
                <Text style={[styles.mediaTitle, { color: c.text }]}>{item.caption}</Text>
                <Text style={[styles.mediaSub, { color: c.muted }]}>
                  {item.type === 'audio' ? 'Audio memory' : item.type}
                </Text>
                {item.transcript ? (
                  <Text style={[styles.bodyText, { color: c.textSoft }]}>{item.transcript}</Text>
                ) : null}
              </View>
            </View>
          ))}
        </>
      ) : null}

      <Text style={[styles.section, { color: c.text }]}>Reflection ending</Text>
      <View style={[styles.previewBlock, { borderColor: c.border, backgroundColor: c.surface }]}>
        {(preview.reflection.lessons ?? []).map((lesson, index) => (
          <Text key={lesson} style={[styles.bodyText, { color: c.textSoft }]}>
            {index + 1}. {lesson}
          </Text>
        ))}
        {preview.reflection.carry_forward ? (
          <Text style={[styles.closing, { color: c.text }]}>
            Carry forward: {preview.reflection.carry_forward}
          </Text>
        ) : null}
        {preview.reflection.letter_to_self ? (
          <Text style={[styles.bodyText, { color: c.textSoft }]}>
            {preview.reflection.letter_to_self}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  backBtn: { padding: Spacing.sm },
  headerTitle: { fontSize: 20, fontWeight: '600' },
  container: { padding: Spacing.lg, paddingBottom: Spacing.xxl },
  hero: { gap: Spacing.sm, marginBottom: Spacing.xl },
  eyebrow: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.4,
  },
  heroTitle: { fontSize: 32, fontWeight: '500', lineHeight: 38 },
  heroSub: { fontSize: 15, lineHeight: 22 },
  section: { fontSize: 18, fontWeight: '600', marginTop: Spacing.xl, marginBottom: Spacing.md },
  periodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderWidth: 1,
    borderRadius: Radii.md,
    padding: Spacing.md,
  },
  periodText: { fontSize: 15, fontWeight: '600' },
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  chip: {
    borderWidth: 1,
    borderRadius: Radii.pill,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  chipText: { fontSize: 13, fontWeight: '600' },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    borderWidth: 1,
    borderRadius: Radii.md,
    padding: Spacing.md,
    marginTop: Spacing.xl,
  },
  toggleTitle: { fontSize: 15, fontWeight: '700' },
  toggleSub: { fontSize: 12, lineHeight: 17, marginTop: 2 },
  cta: {
    marginTop: Spacing.xl,
    minHeight: 52,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  disabled: { opacity: 0.75 },
  ctaLabel: { color: '#fff', fontSize: 16, fontWeight: '700' },
  error: { fontSize: 13, marginTop: Spacing.md },
  preview: { marginTop: Spacing.xl },
  previewBlock: {
    borderWidth: 1,
    borderRadius: Radii.md,
    padding: Spacing.lg,
    marginTop: Spacing.md,
    gap: Spacing.sm,
  },
  previewStatus: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase' },
  cover: { width: '100%', aspectRatio: 0.75, borderRadius: Radii.md, marginBottom: Spacing.lg },
  coverFallback: {
    width: '100%',
    aspectRatio: 0.75,
    borderWidth: 1,
    borderRadius: Radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
  bookTitle: { fontSize: 32, fontWeight: '500', lineHeight: 38, marginBottom: Spacing.md },
  opening: { fontSize: 16, lineHeight: 24 },
  chapterTitle: { fontSize: 22, fontWeight: '500' },
  bodyText: { fontSize: 14, lineHeight: 21 },
  mediaRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    borderWidth: 1,
    borderRadius: Radii.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  mediaTitle: { fontSize: 14, fontWeight: '700' },
  mediaSub: { fontSize: 12, marginTop: 2, textTransform: 'capitalize' },
  closing: { fontSize: 15, lineHeight: 22, fontWeight: '700', marginTop: Spacing.sm },
});
