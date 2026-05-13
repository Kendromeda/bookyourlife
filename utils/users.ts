import { api } from './api';

export type LanguageCode = 'en' | 'id';
export type Gender = 'male' | 'female' | 'non_binary' | 'prefer_not_to_say';
export type JournalingGoal =
  | 'self_reflection'
  | 'mental_health'
  | 'memory'
  | 'creativity'
  | 'other';

export type Me = {
  id: string;
  clerk_id: string;
  email: string | null;
  display_name: string | null;
  face_photo_url: string | null;
  notif_hour: number;
  timezone: string;
  preferred_language: LanguageCode;
  subscription_tier: 'free' | 'premium';
  gender: Gender | null;
  /** YYYY-MM-DD */
  birthday: string | null;
  journaling_goal: JournalingGoal | null;
};

export const LANGUAGES: { code: LanguageCode; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'id', label: 'Bahasa Indonesia' },
];

export async function fetchMe(): Promise<Me> {
  const { data } = await api.get<Me>('/users/me');
  return data;
}

export type UpdateMeInput = Partial<{
  display_name: string;
  face_photo_url: string;
  notif_hour: number;
  timezone: string;
  preferred_language: LanguageCode;
  gender: Gender;
  birthday: string;
  journaling_goal: JournalingGoal;
}>;

export async function updateMe(input: UpdateMeInput): Promise<Me> {
  const { data } = await api.patch<Me>('/users/me', input);
  return data;
}

export async function deleteAccount(): Promise<void> {
  await api.delete('/users/me');
}

export type UserStats = {
  entries_last_30_days: number;
  current_streak_days: number;
  total_entries: number;
  total_words: number;
};

export async function fetchStats(): Promise<UserStats> {
  const { data } = await api.get<UserStats>('/users/me/stats');
  return data;
}

export async function fetchExport(): Promise<unknown> {
  const { data } = await api.get<unknown>('/users/me/export');
  return data;
}

export async function registerFcmToken(
  token: string,
  platform: 'ios' | 'android' | 'web',
): Promise<void> {
  await api.post('/users/me/fcm-token', { token, platform });
}
