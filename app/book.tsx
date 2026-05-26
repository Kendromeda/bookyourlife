import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Linking,
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
  BookStylePreset,
  BookTone,
  GeneratedBook,
  cancelGeneratedBook,
  createBookPreview,
  createGeneratedBook,
  fetchGeneratedBook,
  fetchGeneratedBooks,
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

// `photo_inspired` only changes the cover prompt language; user photos
// are NOT yet sent into the model. Keep the label honest until real
// image-to-image input is wired through to the cover task.
const IMAGE_MODES: { value: BookImageMode; label: string }[] = [
  { value: 'abstract', label: 'Abstract cover' },
  { value: 'photo_inspired', label: 'Photo-inspired cover' },
  { value: 'none', label: 'No AI cover' },
];

const STYLE_BY_TONE: Record<BookTone, BookStylePreset> = {
  poetic: 'watercolor',
  honest: 'pencil',
  minimalist: 'pencil',
  cinematic: 'vintage',
  funny: 'anime',
  deeply_reflective: 'watercolor',
};

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

function dateOnly(value: string): string {
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(value);
  return m?.[1] ?? ymd(new Date(value));
}

function isBookTone(value: string | null | undefined): value is BookTone {
  return TONES.some((item) => item.value === value);
}

function generationStageLabel(stage: string | null | undefined): string {
  switch (stage) {
    case 'prepare':
      return 'Checking entries';
    case 'transcribe':
      return 'Checking voice notes';
    case 'plan':
      return 'Planning chapters';
    case 'texts':
      return 'Writing book text';
    case 'images':
      return 'Preparing artwork';
    case 'render':
      return 'Rendering PDF';
    case 'finalize':
      return 'Saving PDF';
    case 'notify':
      return 'Finishing';
    case 'completed':
      return 'Ready';
    default:
      return 'Starting';
  }
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
  const [styleTransferPhotos, setStyleTransferPhotos] = useState(false);
  // Personal dedication printed on the first interior page (max 1000
  // chars enforced by the backend BookGenerateRequest schema).
  const [dedication, setDedication] = useState('');
  const [bookId, setBookId] = useState<string | null>(null);
  const [generatedBookId, setGeneratedBookId] = useState<string | null>(null);
  const [pdfOpenError, setPdfOpenError] = useState<string | null>(null);
  // When true the user has tapped "Read book" and we've committed to the
  // viewer for this book. Without this flag, the auto-jump-to-viewer
  // logic would skip the review card entirely.
  const [enteredViewer, setEnteredViewer] = useState(false);

  const generatedBooksQuery = useQuery<GeneratedBook[]>({
    queryKey: ['book-generations'],
    queryFn: () => fetchGeneratedBooks(),
    staleTime: 30_000,
  });

  useEffect(() => {
    if (generatedBookId) return;
    const latest = generatedBooksQuery.data?.[0];
    if (!latest) return;
    setGeneratedBookId(latest.book_id);
    qc.setQueryData(['book-generation', latest.book_id], latest);
  }, [generatedBooksQuery.data, generatedBookId, qc]);

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

  const generationQuery = useQuery<GeneratedBook>({
    queryKey: ['book-generation', generatedBookId],
    queryFn: () => fetchGeneratedBook(generatedBookId!),
    enabled: !!generatedBookId,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data) return 3000;
      if (data.status === 'queued' || data.status === 'processing') return 3000;
      return false;
    },
  });

  const generatePreview = useMutation({
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
      setEnteredViewer(false);
      setBookId(id);
    },
  });

  const generateBook = useMutation({
    mutationFn: async () => {
      const previewTone = preview?.status === 'done' && isBookTone(preview.tone) ? preview.tone : tone;
      const source =
        preview?.status === 'done' && preview.period_start && preview.period_end
          ? {
              date_start: dateOnly(preview.period_start),
              date_end: ymd(addDays(new Date(preview.period_end), -1)),
            }
          : null;
      if (!source && (!range.valid || !range.start || !range.end)) {
        throw new Error('Pick a valid period first.');
      }
      const date_start = source?.date_start ?? ymd(range.start!);
      const date_end = source?.date_end ?? ymd(addDays(range.end!, -1));
      const generationMode = imageMode === 'none' ? 'photo_only' : 'illustrated';
      const trimmedDedication = dedication.trim();
      return createGeneratedBook({
        date_start,
        date_end,
        mode: generationMode,
        style_preset: STYLE_BY_TONE[previewTone],
        cover_mode: imageMode === 'photo_inspired' ? 'best_photo' : 'ai_mood',
        include_voice_transcripts: includeVoiceTranscripts,
        illustrated_required: false,
        // photo_only mode rejects style_transfer_photos server-side.
        style_transfer_photos: generationMode === 'photo_only' ? false : styleTransferPhotos,
        dedication: trimmedDedication.length > 0 ? trimmedDedication : null,
      });
    },
    onSuccess: (result) => {
      setPdfOpenError(null);
      setGeneratedBookId(result.book_id);
      qc.setQueryData(['book-generation', result.book_id], {
        book_id: result.book_id,
        status: result.status,
        progress: 0,
        current_stage: 'queued',
        generated_title: null,
        subtitle: null,
        theme_summary: null,
        pdf_url: null,
        cover_url: null,
        error_message: null,
      } satisfies GeneratedBook);
      qc.invalidateQueries({ queryKey: ['book-generations'] });
    },
  });

  const cancelGeneration = useMutation({
    mutationFn: async (id: string) => cancelGeneratedBook(id),
    onSuccess: (book) => {
      setPdfOpenError(null);
      qc.setQueryData(['book-generation', book.book_id], book);
      qc.invalidateQueries({ queryKey: ['book-generations'] });
    },
  });

  const preview = previewQuery.data;
  const generatedBook = generationQuery.data;
  const previewBusy =
    generatePreview.isPending || preview?.status === 'queued' || preview?.status === 'processing';
  const generationBusy =
    generateBook.isPending ||
    generatedBook?.status === 'queued' ||
    generatedBook?.status === 'processing';

  const openGeneratedPdf = async (url: string) => {
    setPdfOpenError(null);
    if (url.startsWith('file://')) {
      setPdfOpenError('The PDF was created on the backend local disk. Configure R2 storage to open it from this device.');
      return;
    }
    const supported = await Linking.canOpenURL(url);
    if (!supported) {
      setPdfOpenError('This device cannot open the generated PDF URL.');
      return;
    }
    await Linking.openURL(url);
  };

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
          <>
            <ReviewCard
              preview={preview}
              onRead={() => setEnteredViewer(true)}
              onRegenerate={() => {
                setBookId(null);
                setEnteredViewer(false);
                generatePreview.reset();
              }}
            />
            <GenerationBlock
              book={generatedBook}
              starting={generateBook.isPending}
              cancelling={cancelGeneration.isPending}
              disabled={generationBusy}
              generateError={generateBook.error}
              pdfOpenError={pdfOpenError}
              generateLabel="Generate PDF from this period"
              onGenerate={() => generateBook.mutate()}
              onCancel={
                generatedBook &&
                (generatedBook.status === 'queued' || generatedBook.status === 'processing')
                  ? () => cancelGeneration.mutate(generatedBook.book_id)
                  : undefined
              }
              onOpenPdf={(url) => openGeneratedPdf(url)}
            />
          </>
        ) : (
          <>
            <View style={styles.hero}>
              <Text style={[styles.eyebrow, { color: c.accentDark }]}>BOOK GENERATION</Text>
              <Text style={[styles.heroTitle, { color: c.text, fontFamily: Type.serif }]}>
                Turn this period into a finished PDF book.
              </Text>
              <Text style={[styles.heroSub, { color: c.textSoft }]}>
                Build a print-style Life Book from your entries. You can still create an in-app
                preview first if you want to read it before rendering the PDF.
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

            <View style={[styles.toggleRow, { borderColor: c.border, backgroundColor: c.surface }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.toggleTitle, { color: c.text }]}>
                  Style-transfer my photos
                </Text>
                <Text style={[styles.toggleSub, { color: c.muted }]}>
                  Re-paint each photo in the chosen style. Adds time and cost.
                </Text>
              </View>
              <Switch
                value={imageMode === 'none' ? false : styleTransferPhotos}
                disabled={imageMode === 'none'}
                onValueChange={setStyleTransferPhotos}
              />
            </View>

            <Text style={[styles.section, { color: c.text }]}>Dedication (optional)</Text>
            <TextInput
              value={dedication}
              onChangeText={setDedication}
              placeholder="For everyone who waited for me to write this down."
              placeholderTextColor={c.muted}
              multiline
              maxLength={1000}
              style={[
                styles.dedicationInput,
                { borderColor: c.border, color: c.text, backgroundColor: c.surface },
              ]}
            />
            <Text style={[styles.helperText, { color: c.muted }]}>
              {dedication.length}/1000 — printed on the first interior page.
            </Text>

            <TouchableOpacity
              style={[
                styles.cta,
                { backgroundColor: c.accent },
                (generationBusy || !range.valid) && styles.disabled,
              ]}
              activeOpacity={0.85}
              disabled={generationBusy || !range.valid}
              onPress={() => generateBook.mutate()}
            >
              {generationBusy ? <ActivityIndicator color="#fff" /> : null}
              <Text style={styles.ctaLabel}>
                {generationBusy
                  ? generatedBook?.status === 'queued'
                    ? 'Queued...'
                    : generatedBook?.status === 'processing'
                      ? `${generationStageLabel(generatedBook.current_stage)} ${generatedBook.progress}%`
                      : 'Starting...'
                  : 'Generate PDF book'}
              </Text>
            </TouchableOpacity>

            {generateBook.error ? (
              <Text style={[styles.error, { color: c.danger }]}>
                {generateBook.error instanceof Error
                  ? generateBook.error.message
                  : 'Could not start book generation.'}
              </Text>
            ) : null}

            {generatedBook ? (
              <GenerationStatusCard
                book={generatedBook}
                pdfOpenError={pdfOpenError}
                cancelling={cancelGeneration.isPending}
                onCancel={
                  generatedBook.status === 'queued' || generatedBook.status === 'processing'
                    ? () => cancelGeneration.mutate(generatedBook.book_id)
                    : undefined
                }
                onOpenPdf={(url) => openGeneratedPdf(url)}
              />
            ) : null}

            <TouchableOpacity
              style={[
                styles.secondaryCta,
                { borderColor: c.border },
                (previewBusy || !range.valid) && styles.disabled,
              ]}
              activeOpacity={0.85}
              disabled={previewBusy || !range.valid}
              onPress={() => generatePreview.mutate()}
            >
              {previewBusy ? <ActivityIndicator color={c.text} /> : null}
              <Text style={[styles.secondaryCtaLabel, { color: c.text }]}>
                {previewBusy
                  ? preview?.status === 'queued'
                    ? 'Preview queued...'
                    : preview?.status === 'processing'
                      ? 'Writing preview...'
                      : 'Starting preview...'
                  : 'Generate in-app preview'}
              </Text>
            </TouchableOpacity>

            {generatePreview.error ? (
              <Text style={[styles.error, { color: c.danger }]}>
                {generatePreview.error instanceof Error
                  ? generatePreview.error.message
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

function GenerationBlock({
  book,
  starting,
  cancelling,
  disabled,
  generateError,
  pdfOpenError,
  generateLabel,
  onGenerate,
  onCancel,
  onOpenPdf,
}: {
  book: GeneratedBook | undefined;
  starting: boolean;
  cancelling: boolean;
  disabled: boolean;
  generateError: unknown;
  pdfOpenError: string | null;
  generateLabel: string;
  onGenerate: () => void;
  onCancel?: () => void;
  onOpenPdf: (url: string) => void;
}) {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const ready = book?.status === 'completed' && !!book.pdf_url;
  const active = book?.status === 'queued' || book?.status === 'processing';
  return (
    <View style={[styles.generationBlock, { borderColor: c.border, backgroundColor: c.surface }]}>
      <Text style={[styles.eyebrow, { color: c.accentDark }]}>PDF BOOK</Text>
      {book ? (
        <GenerationStatusBody book={book} />
      ) : (
        <Text style={[styles.bodyText, { color: c.textSoft }]}>
          PDF generation runs in the backend and needs at least 20 entries in the selected period.
        </Text>
      )}

      <TouchableOpacity
        style={[
          styles.cta,
          { backgroundColor: c.accent },
          ((disabled && !ready) || starting) && styles.disabled,
        ]}
        activeOpacity={0.85}
        disabled={(disabled && !ready) || starting}
        onPress={() => {
          if (ready) {
            onOpenPdf(book.pdf_url!);
            return;
          }
          onGenerate();
        }}
      >
        {starting || active ? <ActivityIndicator color="#fff" /> : null}
        <Text style={styles.ctaLabel}>
          {ready
            ? 'Open PDF'
            : active
              ? `${generationStageLabel(book.current_stage)} ${book.progress}%`
              : generateLabel}
        </Text>
      </TouchableOpacity>

      {onCancel ? (
        <TouchableOpacity
          style={[styles.secondaryCta, { borderColor: c.border }, cancelling && styles.disabled]}
          activeOpacity={0.85}
          disabled={cancelling}
          onPress={onCancel}
        >
          <Text style={[styles.secondaryCtaLabel, { color: c.text }]}>
            {cancelling ? 'Cancelling...' : 'Cancel generation'}
          </Text>
        </TouchableOpacity>
      ) : null}

      {generateError ? (
        <Text style={[styles.error, { color: c.danger }]}>
          {generateError instanceof Error ? generateError.message : 'Could not start book generation.'}
        </Text>
      ) : null}
      {pdfOpenError ? <Text style={[styles.error, { color: c.danger }]}>{pdfOpenError}</Text> : null}
    </View>
  );
}

function GenerationStatusCard({
  book,
  pdfOpenError,
  cancelling,
  onCancel,
  onOpenPdf,
}: {
  book: GeneratedBook;
  pdfOpenError: string | null;
  cancelling: boolean;
  onCancel?: () => void;
  onOpenPdf: (url: string) => void;
}) {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  return (
    <View style={[styles.previewBlock, { borderColor: c.border, backgroundColor: c.surface }]}>
      <GenerationStatusBody book={book} />
      {book.status === 'completed' && book.pdf_url ? (
        <TouchableOpacity
          style={[styles.secondaryCta, { borderColor: c.border }]}
          activeOpacity={0.85}
          onPress={() => onOpenPdf(book.pdf_url!)}
        >
          <Text style={[styles.secondaryCtaLabel, { color: c.text }]}>Open PDF</Text>
        </TouchableOpacity>
      ) : null}
      {onCancel ? (
        <TouchableOpacity
          style={[styles.secondaryCta, { borderColor: c.border }, cancelling && styles.disabled]}
          activeOpacity={0.85}
          disabled={cancelling}
          onPress={onCancel}
        >
          <Text style={[styles.secondaryCtaLabel, { color: c.text }]}>
            {cancelling ? 'Cancelling...' : 'Cancel generation'}
          </Text>
        </TouchableOpacity>
      ) : null}
      {pdfOpenError ? <Text style={[styles.error, { color: c.danger }]}>{pdfOpenError}</Text> : null}
    </View>
  );
}

function GenerationStatusBody({ book }: { book: GeneratedBook }) {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  if (book.status === 'failed') {
    return (
      <>
        <Text style={[styles.previewStatus, { color: c.danger }]}>Book failed</Text>
        <Text style={[styles.bodyText, { color: c.textSoft }]}>
          {book.error_message ?? 'Could not generate your PDF book.'}
        </Text>
      </>
    );
  }
  if (book.status === 'cancelled') {
    return (
      <>
        <Text style={[styles.previewStatus, { color: c.muted }]}>Book cancelled</Text>
        <Text style={[styles.bodyText, { color: c.textSoft }]}>
          Start again when you are ready.
        </Text>
      </>
    );
  }
  if (book.status === 'completed') {
    return (
      <>
        <Text style={[styles.previewStatus, { color: c.accentDark }]}>PDF book ready</Text>
        <Text style={[styles.bodyText, { color: c.text }]}>
          {book.generated_title ?? 'Your Life Book'}
        </Text>
        {book.subtitle ? (
          <Text style={[styles.bodyText, { color: c.textSoft }]}>{book.subtitle}</Text>
        ) : null}
      </>
    );
  }
  return (
    <>
      <Text style={[styles.previewStatus, { color: c.accentDark }]}>
        {book.status === 'queued' ? 'Queued' : generationStageLabel(book.current_stage)}
      </Text>
      <View style={[styles.progressTrack, { backgroundColor: c.borderSoft }]}>
        <View
          style={[
            styles.progressFill,
            { backgroundColor: c.accent, width: `${Math.max(3, book.progress)}%` },
          ]}
        />
      </View>
      <Text style={[styles.bodyText, { color: c.textSoft }]}>
        {book.progress}% complete. This can take several minutes while the backend writes and
        renders the PDF.
      </Text>
    </>
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
  dedicationInput: {
    borderWidth: 1,
    borderRadius: Radii.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    minHeight: 90,
    textAlignVertical: 'top',
    fontSize: 14,
    lineHeight: 20,
  },
  helperText: { fontSize: 11, marginTop: 4 },
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
  generationBlock: {
    borderWidth: 1,
    borderRadius: Radii.md,
    padding: Spacing.lg,
    marginTop: Spacing.xl,
    gap: Spacing.sm,
  },
  progressTrack: {
    height: 8,
    borderRadius: Radii.pill,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: Radii.pill,
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
