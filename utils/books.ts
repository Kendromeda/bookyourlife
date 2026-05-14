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
