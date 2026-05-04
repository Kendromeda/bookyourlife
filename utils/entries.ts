import { api } from './api';

export type Entry = {
  id: string;
  user_id: string;
  body: string;
  question_id: string | null;
  emotion_tags: string[];
  written_at: string;
  created_at: string;
  updated_at: string;
  photos: { id: string; storage_key: string; position: number }[];
};

export type Question = {
  id: string;
  text: string;
  source: 'fresh' | 'follow_up' | 'on_this_date';
  asked_at: string;
};

export type EntryListPage = {
  items: Entry[];
  next_cursor: string | null;
};

export async function fetchEntries(cursor?: string, limit = 20): Promise<EntryListPage> {
  const { data } = await api.get<EntryListPage>('/entries', {
    params: { cursor, limit },
  });
  return data;
}

export type CreateEntryInput = {
  body: string;
  question_id?: string | null;
  written_at?: string;
  photo_storage_keys?: string[];
};

export async function createEntry(input: CreateEntryInput): Promise<Entry> {
  const { data } = await api.post<Entry>('/entries', input);
  return data;
}

export async function fetchTodayQuestion(): Promise<Question> {
  const { data } = await api.get<Question>('/questions/today');
  return data;
}

export async function skipQuestion(id: string): Promise<void> {
  await api.post(`/questions/${id}/skip`);
}

export type PresignedUpload = {
  upload_url: string;
  storage_key: string;
  expires_in_seconds: number;
};

export async function requestPhotoUpload(
  contentType: string,
  purpose: 'entry-photo' | 'face-photo' = 'entry-photo',
): Promise<PresignedUpload> {
  const { data } = await api.post<PresignedUpload>('/uploads/photo', {
    purpose,
    content_type: contentType,
  });
  return data;
}

export async function uploadPhotoToR2(
  uploadUrl: string,
  fileUri: string,
  contentType: string,
): Promise<void> {
  const blob = await (await fetch(fileUri)).blob();
  const res = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body: blob,
  });
  if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
}
