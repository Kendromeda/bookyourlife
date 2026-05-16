import type { BookPreview, BookPreviewChapter, BookPreviewMediaItem } from '@/utils/books';

/**
 * Spread descriptors — discriminated union the renderer in
 * BookSpread.tsx switches on. The `mapPreviewToSpreads` function turns
 * a generated BookPreview into the page sequence: cover, copyright,
 * contents, then per-chapter (opener + body + optional pull-quote)
 * with photo plates interleaved, then a colophon.
 */
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
  | { kind: 'colophon'; author: string; entryCount: number; wordCount: number; year: string };

const NUMBER_WORDS = ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];

function chapterNumberLabel(i: number): string {
  return NUMBER_WORDS[i] ?? String(i + 1);
}

/** Split a long narrative roughly in half on a sentence boundary. */
function splitNarrative(text: string): { verso: string; recto: string } {
  const trimmed = text.trim();
  if (trimmed.length < 800) return { verso: trimmed, recto: '' };
  const midpoint = Math.floor(trimmed.length / 2);
  // Find the closest sentence break after the midpoint.
  const after = trimmed.slice(midpoint);
  const breakAt = after.search(/[.!?]\s/);
  const cut = breakAt < 0 ? midpoint : midpoint + breakAt + 2;
  return { verso: trimmed.slice(0, cut).trim(), recto: trimmed.slice(cut).trim() };
}

function leadParagraph(narrative: string): string {
  const firstBreak = narrative.search(/\n\n|\.\s/);
  const cut = firstBreak < 0 ? narrative.length : firstBreak + 1;
  return narrative.slice(0, Math.min(cut, 220)).trim();
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

    const { verso, recto } = splitNarrative(chapter.narrative);
    if (recto) {
      spreads.push({
        kind: 'body',
        chapterTitle: chapter.title,
        verso,
        recto,
        bookTitle: title,
        pageStart: pageCounter,
      });
      pageCounter += 4;
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

  spreads.push({
    kind: 'colophon',
    author: authorName,
    entryCount: totalEntries,
    wordCount: totalWords,
    year,
  });

  return spreads;
}
