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
export type BookGenerationStatus =
  | 'queued'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'cancelled';
export type BookGenerationMode = 'illustrated' | 'photo_only' | 'mixed';
export type BookStylePreset = 'watercolor' | 'pencil' | 'vintage' | 'anime';
export type BookCoverMode = 'ai_mood' | 'best_photo';

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

export type CreateGeneratedBookInput = {
  date_start: string;
  date_end: string;
  mode: BookGenerationMode;
  style_preset: BookStylePreset;
  cover_mode: BookCoverMode;
  include_voice_transcripts: boolean;
  illustrated_required: boolean;
  /** Opt-in: run user photos through Flux img2img with the chosen style. */
  style_transfer_photos?: boolean;
  custom_title?: string | null;
  dedication?: string | null;
};

export type RegenerateBookAssetsResponse = {
  book_id: string;
  requeued: number;
  status: BookGenerationStatus;
  current_stage: string | null;
};

export type CreateGeneratedBookResponse = {
  book_id: string;
  status: BookGenerationStatus;
  estimated_minutes: number;
};

export type GeneratedBook = {
  book_id: string;
  status: BookGenerationStatus;
  progress: number;
  current_stage: string | null;
  generated_title: string | null;
  subtitle: string | null;
  theme_summary: string | null;
  pdf_url: string | null;
  cover_url: string | null;
  error_message: string | null;
};

export async function createBookPreview(input: CreateBookPreviewInput): Promise<string> {
  const { data } = await api.post<{ book_id: string }>('/books/previews', input);
  return data.book_id;
}

export async function createGeneratedBook(
  input: CreateGeneratedBookInput,
): Promise<CreateGeneratedBookResponse> {
  const { data } = await api.post<CreateGeneratedBookResponse>('/books/generate', input);
  return data;
}

export async function fetchGeneratedBook(bookId: string): Promise<GeneratedBook> {
  const { data } = await api.get<GeneratedBook>(`/books/${bookId}`);
  return data;
}

export async function fetchGeneratedBooks(
  status?: BookGenerationStatus,
): Promise<GeneratedBook[]> {
  const { data } = await api.get<{ items: GeneratedBook[] }>('/books', {
    params: status ? { status } : undefined,
  });
  return data.items;
}

export async function cancelGeneratedBook(bookId: string): Promise<GeneratedBook> {
  const { data } = await api.post<GeneratedBook>(`/books/${bookId}/cancel`);
  return data;
}

export async function regenerateBookAssets(
  bookId: string,
  assetIds: string[] = [],
): Promise<RegenerateBookAssetsResponse> {
  const { data } = await api.post<RegenerateBookAssetsResponse>(
    `/books/${bookId}/regenerate-assets`,
    { asset_ids: assetIds },
  );
  return data;
}

export async function fetchBookPreview(bookId: string): Promise<BookPreview> {
  const { data } = await api.get<BookPreview>(`/books/previews/${bookId}`);
  return data;
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
