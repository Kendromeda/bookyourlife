import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BookViewer } from '@/components/feature/book/BookViewer';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Radii, Spacing, Type } from '@/constants/theme';
import {
  BookImageMode,
  BookPreview,
  BookTone,
  createBookPreview,
  fetchBookPreview,
  fetchLatestBookPreview,
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

// `photo_inspired` only changes the cover prompt language; user photos
// are NOT yet sent into the model. Keep the label honest until real
// image-to-image input is wired through to the cover task.
const IMAGE_MODES: { value: BookImageMode; label: string }[] = [
  { value: 'abstract', label: 'Abstract cover' },
  { value: 'photo_inspired', label: 'Photo-inspired cover' },
  { value: 'none', label: 'No AI cover' },
];

type PeriodMode = 'month' | 'custom';

/** One selectable month chip — month-of-year + the [start, end) date range. */
type MonthOption = {
  key: string; // YYYY-MM
  label: string;
  start: Date;
  end: Date;
};

function lastMonths(count: number): MonthOption[] {
  // List `count` months ending on the current month, newest first. Used
  // for the period chip rail so the user can pick a real month, not just
  // "today".
  const out: MonthOption[] = [];
  const now = new Date();
  for (let i = 0; i < count; i++) {
    const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
    out.push({
      key: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`,
      label: start.toLocaleDateString(undefined, { month: 'short', year: 'numeric' }),
      start,
      end,
    });
  }
  return out;
}

function ymd(d: Date): string {
  // ISO date (YYYY-MM-DD) without timezone shift — the custom-range
  // pickers store strings and we only care about local-day granularity.
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`;
}

function addDays(d: Date, days: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + days);
}

function parseYmd(s: string): Date | null {
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s.trim());
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

export default function BookScreen() {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const router = useRouter();
  const qc = useQueryClient();

  // Period state — month-chip mode by default; custom range available.
  const months = useMemo(() => lastMonths(12), []);
  const [periodMode, setPeriodMode] = useState<PeriodMode>('month');
  const [activeMonthKey, setActiveMonthKey] = useState<string>(months[0].key);
  const [customStart, setCustomStart] = useState<string>(ymd(months[0].start));
  const [customEnd, setCustomEnd] = useState<string>(ymd(addDays(months[0].end, -1)));

  const range = useMemo(() => {
    if (periodMode === 'month') {
      const m = months.find((mo) => mo.key === activeMonthKey) ?? months[0];
      return { start: m.start, end: m.end, label: m.label, valid: true };
    }
    const start = parseYmd(customStart);
    const endInclusive = parseYmd(customEnd);
    if (!start || !endInclusive || endInclusive < start) {
      return { start, end: endInclusive, label: 'Choose a range', valid: false };
    }
    const endExclusive = addDays(endInclusive, 1);
    return {
      start,
      end: endExclusive,
      label: `${start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${endInclusive.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`,
      valid: true,
    };
  }, [periodMode, activeMonthKey, customStart, customEnd, months]);

  const [tone, setTone] = useState<BookTone>('poetic');
  const [imageMode, setImageMode] = useState<BookImageMode>('abstract');
  const [includeVoiceTranscripts, setIncludeVoiceTranscripts] = useState(false);
  const [bookId, setBookId] = useState<string | null>(null);
  const [ignoredLatestId, setIgnoredLatestId] = useState<string | null>(null);
  // When true the user has tapped "Read book" and we've committed to the
  // viewer for this book. Without this flag, the auto-jump-to-viewer
  // logic would skip the review card entirely.
  const [enteredViewer, setEnteredViewer] = useState(false);

  // On mount fetch the user's latest preview. If they have one in flight
  // or freshly done, we resume into the same book id so the review card
  // / viewer feel continuous across reloads and back-navigations.
  const latestQuery = useQuery<BookPreview | null>({
    queryKey: ['book-preview', 'latest'],
    queryFn: fetchLatestBookPreview,
    staleTime: 30_000,
  });

  useEffect(() => {
    if (bookId) return;
    const latest = latestQuery.data;
    if (!latest) return;
    // Skip already-failed previews — the user almost always wants to try
    // again, so leaving the setup screen visible is the right default.
    if (latest.status === 'failed') return;
    if (latest.id === ignoredLatestId) return;
    setBookId(latest.id);
    qc.setQueryData(['book-preview', latest.id], latest);
  }, [latestQuery.data, bookId, ignoredLatestId, qc]);

  const previewQuery = useQuery<BookPreview>({
    queryKey: ['book-preview', bookId],
    queryFn: () => fetchBookPreview(bookId!),
    enabled: !!bookId,
    // Poll every 3s only while the preview is still being built. Once it
    // reaches a terminal state we stop hitting the API entirely.
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data) return 3000;
      if (data.status === 'done' || data.status === 'failed') return false;
      return 3000;
    },
  });

  const generate = useMutation({
    mutationFn: async () => {
      if (!range.valid || !range.start || !range.end) {
        throw new Error('Pick a valid period first.');
      }
      return createBookPreview({
        period_start: range.start.toISOString(),
        period_end: range.end.toISOString(),
        tone,
        image_mode: imageMode,
        include_voice_transcripts: includeVoiceTranscripts,
      });
    },
    onSuccess: (id) => {
      setIgnoredLatestId(null);
      setEnteredViewer(false);
      setBookId(id);
      qc.invalidateQueries({ queryKey: ['book-preview', 'latest'] });
    },
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

  // Once the user explicitly enters the viewer we render the hardcover
  // full-screen. Setup state stays in tree so a back-to-setup is instant.
  if (preview?.status === 'done' && enteredViewer) {
    return (
      <BookViewer
        preview={preview}
        authorName={meQuery.data?.display_name ?? meQuery.data?.email ?? 'Author'}
        totalEntries={statsQuery.data?.total_entries ?? 0}
        totalWords={statsQuery.data?.total_words ?? 0}
        onClose={() => setEnteredViewer(false)}
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
        {preview?.status === 'done' ? (
          <ReviewCard
            preview={preview}
            onRead={() => setEnteredViewer(true)}
            onRegenerate={() => {
              setIgnoredLatestId(preview.id);
              setBookId(null);
              setEnteredViewer(false);
              generate.reset();
            }}
          />
        ) : (
          <>
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

            {/* Period — month chips + optional custom range */}
            <Text style={[styles.section, { color: c.text }]}>Period</Text>
            <View style={styles.modeRow}>
              <ModeChip
                label="By month"
                active={periodMode === 'month'}
                onPress={() => setPeriodMode('month')}
              />
              <ModeChip
                label="Custom range"
                active={periodMode === 'custom'}
                onPress={() => setPeriodMode('custom')}
              />
            </View>
            {periodMode === 'month' ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.monthRow}
              >
                {months.map((m) => (
                  <Chip
                    key={m.key}
                    active={activeMonthKey === m.key}
                    label={m.label}
                    onPress={() => setActiveMonthKey(m.key)}
                  />
                ))}
              </ScrollView>
            ) : (
              <View style={styles.dateRow}>
                <DateField
                  label="Start"
                  value={customStart}
                  onChange={setCustomStart}
                />
                <DateField label="End" value={customEnd} onChange={setCustomEnd} />
              </View>
            )}
            <Text style={[styles.periodEcho, { color: c.muted }]}>
              {range.label}
            </Text>

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

            <Text style={[styles.section, { color: c.text }]}>Cover style</Text>
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
              style={[
                styles.cta,
                { backgroundColor: c.accent },
                (busy || !range.valid) && styles.disabled,
              ]}
              activeOpacity={0.85}
              disabled={busy || !range.valid}
              onPress={() => generate.mutate()}
            >
              {busy ? <ActivityIndicator color="#fff" /> : null}
              <Text style={styles.ctaLabel}>
                {busy
                  ? preview?.status === 'queued'
                    ? 'Queued…'
                    : preview?.status === 'processing'
                      ? 'Writing your book…'
                      : 'Sending to the writer…'
                  : 'Generate preview'}
              </Text>
            </TouchableOpacity>

            {generate.error ? (
              <Text style={[styles.error, { color: c.danger }]}>
                {generate.error instanceof Error
                  ? generate.error.message
                  : 'Could not start preview.'}
              </Text>
            ) : null}

            {/* Outer ternary already excluded the 'done' branch, so the
                preview here is queued / processing / failed if present. */}
            {preview ? <StatusCard preview={preview} /> : null}
          </>
        )}
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

function ModeChip({
  active,
  label,
  onPress,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
}) {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      style={[
        styles.modeChip,
        {
          borderBottomColor: active ? c.accent : 'transparent',
        },
      ]}
    >
      <Text
        style={[
          styles.modeChipText,
          { color: active ? c.text : c.muted, fontWeight: active ? '700' : '500' },
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function DateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
}) {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  return (
    <View style={styles.dateField}>
      <Text style={[styles.dateLabel, { color: c.muted }]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder="YYYY-MM-DD"
        placeholderTextColor={c.muted}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="numbers-and-punctuation"
        style={[
          styles.dateInput,
          { borderColor: c.border, color: c.text, backgroundColor: c.surface },
        ]}
      />
    </View>
  );
}

/**
 * Inline review card shown when the latest preview is done. Lets the
 * user see the cover, title, and opening letter — then commit to
 * reading or regenerate from scratch. Replaces the old auto-jump.
 */
function ReviewCard({
  preview,
  onRead,
  onRegenerate,
}: {
  preview: BookPreview;
  onRead: () => void;
  onRegenerate: () => void;
}) {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  return (
    <View style={styles.reviewWrap}>
      <Text style={[styles.eyebrow, { color: c.accentDark }]}>YOUR LATEST BOOK</Text>
      <View style={[styles.reviewCard, { borderColor: c.border, backgroundColor: c.surface }]}>
        {preview.cover_image_url ? (
          <Image source={{ uri: preview.cover_image_url }} style={styles.reviewCover} />
        ) : (
          <View style={[styles.reviewCoverFallback, { borderColor: c.border, backgroundColor: c.background }]}>
            <IconSymbol name="book.fill" size={36} color={c.accent} />
          </View>
        )}
        <View style={styles.reviewBody}>
          <Text style={[styles.reviewTitle, { color: c.text, fontFamily: Type.serif }]}>
            {preview.title ?? 'Untitled book'}
          </Text>
          {preview.opening_letter ? (
            <Text
              style={[
                styles.reviewLetter,
                { color: c.textSoft, fontFamily: Type.italic, fontStyle: 'italic' },
              ]}
              numberOfLines={6}
            >
              {preview.opening_letter}
            </Text>
          ) : null}
          <View style={styles.reviewMeta}>
            <Text style={[styles.reviewMetaText, { color: c.muted }]}>
              {preview.chapters.length} chapters · {preview.media_pages.length} media
            </Text>
          </View>
        </View>
      </View>

      <TouchableOpacity
        style={[styles.cta, { backgroundColor: c.accent }]}
        activeOpacity={0.85}
        onPress={onRead}
      >
        <Text style={styles.ctaLabel}>Read book</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.secondaryCta, { borderColor: c.border }]}
        activeOpacity={0.85}
        onPress={onRegenerate}
      >
        <Text style={[styles.secondaryCtaLabel, { color: c.text }]}>Regenerate</Text>
      </TouchableOpacity>
    </View>
  );
}

function StatusCard({ preview }: { preview: BookPreview }) {
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
  // Walk-the-user-through progress hints. The backend doesn't emit
  // sub-status events yet, so we synthesize a sequence using time-on-
  // status to give the user something to read instead of a frozen
  // "queued / processing" label.
  const hint =
    preview.status === 'queued'
      ? 'Sending your entries to the writer.'
      : 'Reading your entries, then writing chapters and choosing a cover.';
  return (
    <View style={[styles.previewBlock, { borderColor: c.border, backgroundColor: c.surface }]}>
      <Text style={[styles.previewStatus, { color: c.accentDark }]}>
        {preview.status === 'queued' ? 'Queued' : 'Writing your preview'}
      </Text>
      <Text style={[styles.bodyText, { color: c.textSoft }]}>{hint}</Text>
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
  modeRow: { flexDirection: 'row', gap: Spacing.lg, marginBottom: Spacing.md },
  modeChip: {
    paddingBottom: 6,
    borderBottomWidth: 2,
  },
  modeChipText: { fontSize: 14 },
  monthRow: { gap: Spacing.sm, paddingRight: Spacing.lg },
  dateRow: { flexDirection: 'row', gap: Spacing.md },
  dateField: { flex: 1, gap: 4 },
  dateLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  dateInput: {
    borderWidth: 1,
    borderRadius: Radii.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: 15,
  },
  periodEcho: {
    fontSize: 13,
    marginTop: Spacing.sm,
    fontStyle: 'italic',
  },
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
  disabled: { opacity: 0.5 },
  ctaLabel: { color: '#fff', fontSize: 16, fontWeight: '700' },
  secondaryCta: {
    marginTop: Spacing.md,
    minHeight: 48,
    borderWidth: 1,
    borderRadius: Radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryCtaLabel: { fontSize: 15, fontWeight: '600' },
  error: { fontSize: 13, marginTop: Spacing.md },
  previewBlock: {
    borderWidth: 1,
    borderRadius: Radii.md,
    padding: Spacing.lg,
    marginTop: Spacing.lg,
    gap: Spacing.sm,
  },
  previewStatus: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase' },
  bodyText: { fontSize: 14, lineHeight: 21 },

  // ── Review card ─────────────────────────────────────────────────
  reviewWrap: { gap: Spacing.md },
  reviewCard: {
    flexDirection: 'row',
    gap: Spacing.lg,
    borderWidth: 1,
    borderRadius: Radii.md,
    padding: Spacing.md,
  },
  reviewCover: { width: 100, height: 140, borderRadius: Radii.sm },
  reviewCoverFallback: {
    width: 100,
    height: 140,
    borderRadius: Radii.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewBody: { flex: 1, gap: 6 },
  reviewTitle: { fontSize: 20, fontWeight: '500', lineHeight: 24 },
  reviewLetter: { fontSize: 13, lineHeight: 19 },
  reviewMeta: { marginTop: 4 },
  reviewMetaText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
});
