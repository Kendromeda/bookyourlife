import { api } from './api';

export type BookTone =
  | 'poetic'
  | 'honest'
  | 'minimalist'
  | 'cinematic'
  | 'funny'
  | 'deeply_reflective';

export type BookImageMode = 'abstract' | 'photo_inspired' | 'none';
export type BookStatus = 'queued' | 'processing' | 'done' | 'failed';

export type BookPreviewChapter = {
  title: string;
  narrative: string;
  source_entry_ids: string[];
  image_url: string | null;
  /** Optional pull-quote line emitted by the LLM for the pull-quote spread. */
  pull_quote?: string | null;
};

export type BookIllustrationCrop = {
  s?: number;
  x?: number;
  y?: number;
};

export type BookIllustration = {
  /** Raw R2 object key — the bucket-relative path. Use this for delete/replace. */
  storage_key: string;
  /** Public URL to render. Computed server-side from storage_key. */
  public_url: string;
  crop?: BookIllustrationCrop;
};

export type BookTweaks = {
  paper?: 'cream' | 'ivory' | 'white' | 'slate';
  type?: 'newsreader' | 'garamond' | 'cormorant';
  ribbon?: 'terracotta' | 'ink' | 'forest' | 'wine';
  surface?: 'ink' | 'walnut' | 'slate' | 'paper';
  illustrations_enabled?: boolean;
};

export type BookPreviewMediaItem = {
  type: 'photo' | 'video' | 'audio';
  url: string;
  entry_id: string;
  caption: string | null;
  transcript: string | null;
};

export type BookPreview = {
  id: string;
  status: BookStatus;
  tone: string;
  image_mode: string;
  include_voice_transcripts: boolean;
  period_start: string | null;
  period_end: string | null;
  title: string | null;
  cover_image_url: string | null;
  opening_letter: string | null;
  chapters: BookPreviewChapter[];
  media_pages: BookPreviewMediaItem[];
  reflection: {
    lessons?: string[];
    moments?: string[];
    carry_forward?: string;
    letter_to_self?: string;
  };
  error: string | null;
  illustrations: Record<string, BookIllustration>;
  tweaks: BookTweaks;
};

export type CreateBookPreviewInput = {
  period_start: string;
  period_end: string;
  tone: BookTone;
  image_mode: BookImageMode;
  include_voice_transcripts: boolean;
};

export async function createBookPreview(input: CreateBookPreviewInput): Promise<string> {
  const { data } = await api.post<{ book_id: string }>('/books/previews', input);
  return data.book_id;
}

export async function fetchBookPreview(bookId: string): Promise<BookPreview> {
  const { data } = await api.get<BookPreview>(`/books/previews/${bookId}`);
  return data;
}

/**
 * Most recent book preview for the signed-in user, or null if they
 * haven't generated anything yet. Used on /book mount so a queued or
 * processing preview resumes its polling automatically without the user
 * having to re-trigger generation.
 */
export async function fetchLatestBookPreview(): Promise<BookPreview | null> {
  const { data } = await api.get<BookPreview | null>('/books/previews/latest');
  return data ?? null;
}

export async function updateBookIllustration(
  bookId: string,
  slotId: string,
  storageKey: string | null,
  crop?: BookIllustrationCrop,
): Promise<BookPreview> {
  const { data } = await api.patch<BookPreview>(
    `/books/previews/${bookId}/illustrations`,
    { slot_id: slotId, storage_key: storageKey, crop },
  );
  return data;
}

export async function updateBookTweaks(
  bookId: string,
  tweaks: BookTweaks,
): Promise<BookPreview> {
  const { data } = await api.patch<BookPreview>(`/books/previews/${bookId}/tweaks`, tweaks);
  return data;
}
