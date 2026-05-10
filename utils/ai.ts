import { api } from './api';

type ImageJobStatus = {
  status: 'pending' | 'processing' | 'done' | 'failed';
  storage_key: string | null;
  public_url: string | null;
  error: string | null;
};

export type GeneratedImage = {
  storage_key: string;
  public_url: string;
};

const DEFAULT_INTERVAL_MS = 2000;
const DEFAULT_TIMEOUT_MS = 180_000;

export async function fetchTitleSuggestions(body: string): Promise<string[]> {
  const { data } = await api.post<{ titles?: string[] }>('/ai/title-suggestions', { body });
  return data.titles ?? [];
}

export async function fetchWritingPrompts(body: string): Promise<string[]> {
  const { data } = await api.post<{ prompts?: string[] }>('/ai/writing-prompts', { body });
  return data.prompts ?? [];
}

export async function fetchHighlights(body: string): Promise<string[]> {
  const { data } = await api.post<{ highlights?: string[] }>('/ai/highlights', { body });
  return data.highlights ?? [];
}

export async function startImageGen(body: string): Promise<string> {
  const { data } = await api.post<{ job_id: string }>('/ai/image-gen', { body });
  return data.job_id;
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function pollImageJob(
  jobId: string,
  intervalMs = DEFAULT_INTERVAL_MS,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<GeneratedImage> {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const { data } = await api.get<ImageJobStatus>(`/ai/image-gen/${jobId}`);

    if (data.status === 'done') {
      if (!data.storage_key || !data.public_url) {
        throw new Error('Image job completed without storage info.');
      }
      return { storage_key: data.storage_key, public_url: data.public_url };
    }

    if (data.status === 'failed') {
      throw new Error(data.error || 'Image generation failed.');
    }

    await wait(intervalMs);
  }

  throw new Error('Image generation timed out.');
}
