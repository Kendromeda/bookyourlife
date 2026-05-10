import { api } from './api';

export type EntryPhoto = { id: string; storage_key: string; position: number };
export type EntryVideo = {
  id: string;
  storage_key: string;
  duration_seconds: number | null;
  position: number;
};
export type EntryAudio = {
  id: string;
  storage_key: string;
  duration_seconds: number | null;
  transcript: string | null;
  position: number;
};

export type Entry = {
  id: string;
  user_id: string;
  body: string;
  question_id: string | null;
  emotion_tags: string[];
  written_at: string;
  created_at: string;
  updated_at: string;
  lat: number | null;
  lng: number | null;
  place_name: string | null;
  weather: string | null;
  photos: EntryPhoto[];
  videos: EntryVideo[];
  audios: EntryAudio[];
};

export type MediaAttachmentInput = {
  storage_key: string;
  duration_seconds?: number | null;
};

export type Question = {
  id: string;
  text: string;
  source: 'fresh' | 'follow_up' | 'on_this_date';
  asked_at: string;
};

type PendingQuestion = {
  status: 'pending';
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
  video_attachments?: MediaAttachmentInput[];
  audio_attachments?: MediaAttachmentInput[];
  lat?: number | null;
  lng?: number | null;
  place_name?: string | null;
  weather?: string | null;
};

export async function createEntry(input: CreateEntryInput): Promise<Entry> {
  const { data } = await api.post<Entry>('/entries', input);
  return data;
}

export async function fetchTodayQuestion(): Promise<Question | null> {
  const { data } = await api.get<Question | PendingQuestion>('/questions/today');
  if ((data as PendingQuestion).status === 'pending') return null;
  return data as Question;
}

export async function skipQuestion(id: string): Promise<void> {
  await api.post(`/questions/${id}/skip`);
}

export type PresignedUpload = {
  upload_url: string;
  storage_key: string;
  expires_in_seconds: number;
};

export type DirectUpload = {
  storage_key: string;
  public_url: string;
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

export async function uploadPhoto(
  fileUri: string,
  contentType: string,
  purpose: 'entry-photo' | 'face-photo' = 'entry-photo',
): Promise<DirectUpload> {
  return uploadWithRetry(() => uploadPhotoOnce(fileUri, contentType, purpose));
}

export async function uploadVideo(fileUri: string, contentType: string): Promise<DirectUpload> {
  return uploadWithRetry(() => uploadMedia(fileUri, contentType, 'video'));
}

export async function uploadAudio(fileUri: string, contentType: string): Promise<DirectUpload> {
  return uploadWithRetry(() => uploadMedia(fileUri, contentType, 'audio'));
}

async function uploadWithRetry(fn: () => Promise<DirectUpload>): Promise<DirectUpload> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      const status = error?.response?.status;
      const retryable = !error?.response || [408, 429, 500, 502, 503, 504].includes(status);
      if (!retryable || attempt === 1) {
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 800));
    }
  }
  throw normalizeUploadError(lastError);
}

const UPLOAD_TIMEOUT_MS = 120_000;

async function uploadPhotoOnce(
  fileUri: string,
  contentType: string,
  purpose: 'entry-photo' | 'face-photo',
): Promise<DirectUpload> {
  const form = new FormData();
  const extension = contentType === 'image/png' ? 'png' : contentType === 'image/webp' ? 'webp' : 'jpg';
  form.append('purpose', purpose);
  form.append('file', {
    uri: fileUri,
    name: `${purpose}.${extension}`,
    type: contentType,
  } as any);

  const { data } = await api.post<DirectUpload>('/uploads/photo/direct', form, {
    timeout: UPLOAD_TIMEOUT_MS,
  });
  return data;
}

async function uploadMedia(
  fileUri: string,
  contentType: string,
  kind: 'video' | 'audio',
): Promise<DirectUpload> {
  const extension = extensionForContentType(contentType, kind);
  const form = new FormData();
  form.append('file', {
    uri: fileUri,
    name: `${kind}.${extension}`,
    type: contentType,
  } as any);
  const { data } = await api.post<DirectUpload>(`/uploads/${kind}/direct`, form, {
    timeout: UPLOAD_TIMEOUT_MS,
  });
  return data;
}

function extensionForContentType(
  contentType: string,
  kind: 'video' | 'audio',
): string {
  if (kind === 'video') {
    if (contentType === 'video/quicktime') return 'mov';
    return 'mp4';
  }
  if (contentType === 'audio/mpeg') return 'mp3';
  if (contentType === 'audio/wav' || contentType === 'audio/x-wav') return 'wav';
  if (contentType === 'audio/3gpp') return '3gp';
  if (contentType === 'audio/webm') return 'webm';
  if (contentType === 'audio/ogg') return 'ogg';
  return 'm4a';
}

function normalizeUploadError(error: any): Error {
  const status = error?.response?.status;
  const detail = error?.response?.data?.detail;
  if (typeof detail === 'string' && detail.trim()) {
    return new Error(status ? `Upload failed (${status}): ${detail}` : detail);
  }
  if (status) {
    return new Error(`Upload failed with status code ${status}`);
  }
  if (error instanceof Error && error.message) {
    return error;
  }
  return new Error('Upload failed. Check your connection and try again.');
}
