import type { BookPreview, BookPreviewChapter, BookPreviewMediaItem } from '@/utils/books';

/**
 * Spread descriptors — discriminated union the renderer in
 * BookSpread.tsx switches on. The `mapPreviewToSpreads` function turns
 * a generated BookPreview into the page sequence: cover, copyright,
 * contents, then per-chapter (opener + body + optional pull-quote)
 * with photo plates interleaved, then a colophon.
 */
export type MediaListItem = {
  type: 'audio' | 'video';
  caption: string | null;
  transcript: string | null;
};

export type SpreadDescriptor =
  | { kind: 'cover'; title: string; author: string; year: string }
  | { kind: 'copyright'; year: string; entryCount: number; wordCount: number }
  | { kind: 'contents'; chapters: { title: string; index: number }[]; partTitle: string }
  | {
      kind: 'chapter-opener';
      chapterNumberLabel: string;
      title: string;
      lead: string;
      slotId: string;
      slotPlaceholder: string;
    }
  | { kind: 'body'; chapterTitle: string; verso: string; recto: string; bookTitle: string; pageStart: number }
  | { kind: 'pullquote'; chapterTitle: string; quote: string; bookTitle: string }
  | { kind: 'plate'; slotId: string; caption: string; bodyChapterTitle: string; body: string; bookTitle: string }
  | { kind: 'mediaList'; bookTitle: string; items: MediaListItem[] }
  | { kind: 'colophon'; author: string; entryCount: number; wordCount: number; year: string };

const NUMBER_WORDS = ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
const MEDIA_ITEMS_PER_PAGE = 3;

function chapterNumberLabel(i: number): string {
  return NUMBER_WORDS[i] ?? String(i + 1);
}

function leadParagraph(narrative: string): string {
  const firstBreak = narrative.search(/\n\n|\.\s/);
  const cut = firstBreak < 0 ? narrative.length : firstBreak + 1;
  return narrative.slice(0, Math.min(cut, 220)).trim();
}

/**
 * Split a narrative into body spread halves. The chapter-opener already
 * shows `leadParagraph(narrative)`, so the body spread renders the
 * REMAINDER — never the whole narrative. For long remainders the half-
 * sentence-boundary split fills both pages; short remainders fill verso
 * and leave recto with a quiet asterism so every chapter gets a body
 * spread regardless of length (no silent content drops).
 */
function bodyHalves(narrative: string, lead: string): { verso: string; recto: string } {
  const trimmed = narrative.trim();
  // Drop the already-shown lead from the body if it sits at the start.
  const after = trimmed.startsWith(lead) ? trimmed.slice(lead.length).trim() : trimmed;
  if (!after) return { verso: '', recto: '' };
  if (after.length < 600) return { verso: after, recto: '' };
  const midpoint = Math.floor(after.length / 2);
  const tail = after.slice(midpoint);
  const breakAt = tail.search(/[.!?]\s/);
  const cut = breakAt < 0 ? midpoint : midpoint + breakAt + 2;
  return { verso: after.slice(0, cut).trim(), recto: after.slice(cut).trim() };
}

function inferPullQuote(chapter: BookPreviewChapter): string | null {
  if (chapter.pull_quote && chapter.pull_quote.trim()) return chapter.pull_quote.trim();
  // Fallback: take the shortest punchy sentence ≤ 160 chars from the narrative.
  const sentences = chapter.narrative.split(/(?<=[.!?])\s+/).filter((s) => s.length > 24 && s.length <= 160);
  if (!sentences.length) return null;
  sentences.sort((a, b) => a.length - b.length);
  return sentences[0]!.replace(/^[“"']|[”"']$/g, '');
}

function chapterSlotId(chapterIndex: number): string {
  return `bml-chapter-${chapterIndex + 1}-photo`;
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

function plateSlotId(mediaIndex: number): string {
  return `bml-plate-${mediaIndex + 1}`;
}

export function frontispieceSlotId(): string {
  return 'bml-frontispiece';
}

export function authorPortraitSlotId(): string {
  return 'bml-author-portrait';
}

type MapInput = {
  preview: BookPreview;
  /** Display name of the user, shown as author. */
  authorName: string;
  /** From /users/me/stats. */
  totalEntries: number;
  totalWords: number;
};

export function mapPreviewToSpreads({
  preview,
  authorName,
  totalEntries,
  totalWords,
}: MapInput): SpreadDescriptor[] {
  const spreads: SpreadDescriptor[] = [];
  const year = preview.period_start
    ? new Date(preview.period_start).getFullYear().toString()
    : new Date().getFullYear().toString();
  const title = preview.title ?? 'Untitled volume';

  spreads.push({ kind: 'cover', title, author: authorName, year });
  spreads.push({ kind: 'copyright', year, entryCount: totalEntries, wordCount: totalWords });
  spreads.push({
    kind: 'contents',
    chapters: preview.chapters.map((ch, i) => ({ title: ch.title, index: i })),
    partTitle: 'The chapters',
  });

  // Photo media we'll interleave between chapter bodies as plates.
  const photoMedia: BookPreviewMediaItem[] = preview.media_pages.filter((m) => m.type === 'photo');
  let photoCursor = 0;
  let pageCounter = 11; // arbitrary start to feel like a real book

  preview.chapters.forEach((chapter, i) => {
    spreads.push({
      kind: 'chapter-opener',
      chapterNumberLabel: chapterNumberLabel(i),
      title: chapter.title,
      lead: leadParagraph(chapter.narrative),
      slotId: chapterSlotId(i),
      slotPlaceholder: `Drop a photo for "${chapter.title}"`,
    });

    const lead = leadParagraph(chapter.narrative);
    const { verso, recto } = bodyHalves(chapter.narrative, lead);
    // Always emit a body spread when there is body content beyond the lead,
    // even for short chapters — recto may be empty (the renderer falls back
    // to an asterism so the page never reads "missing"). This avoids the
    // silent drop where short chapters lost the bulk of their narrative.
    if (verso || recto) {
      spreads.push({
        kind: 'body',
        chapterTitle: chapter.title,
        verso,
        recto,
        bookTitle: title,
        pageStart: pageCounter,
      });
      pageCounter += 2;
    }

    const quote = inferPullQuote(chapter);
    if (quote) {
      spreads.push({ kind: 'pullquote', chapterTitle: chapter.title, quote, bookTitle: title });
    }

    // Insert a photo plate every other chapter if media remains.
    if (photoCursor < photoMedia.length && i % 2 === 1) {
      const media = photoMedia[photoCursor++];
      spreads.push({
        kind: 'plate',
        slotId: plateSlotId(photoCursor - 1),
        caption: media.caption ?? `Plate ${photoCursor} — from the archive`,
        bodyChapterTitle: chapter.title,
        body: chapter.narrative.slice(0, 480),
        bookTitle: title,
      });
    }
  });

  // Audio / video memories — collected into a single "Media Memories"
  // spread before the colophon so non-photo media gets its own real page
  // rather than being silently dropped by the photo-only plate filter.
  const audioVideo: MediaListItem[] = preview.media_pages
    .filter((m) => m.type === 'audio' || m.type === 'video')
    .map((m) => ({
      type: m.type as 'audio' | 'video',
      caption: m.caption,
      transcript: m.transcript,
    }));
  const audioChunks = chunk(
    audioVideo.filter((m) => m.type === 'audio'),
    MEDIA_ITEMS_PER_PAGE,
  );
  const videoChunks = chunk(
    audioVideo.filter((m) => m.type === 'video'),
    MEDIA_ITEMS_PER_PAGE,
  );
  const mediaSpreadCount = Math.max(audioChunks.length, videoChunks.length);
  for (let i = 0; i < mediaSpreadCount; i++) {
    spreads.push({
      kind: 'mediaList',
      bookTitle: title,
      items: [...(audioChunks[i] ?? []), ...(videoChunks[i] ?? [])],
    });
  }

  spreads.push({
    kind: 'colophon',
    author: authorName,
    entryCount: totalEntries,
    wordCount: totalWords,
    year,
  });

  return spreads;
}
