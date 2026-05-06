import { api } from './api';

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
};

export type LanguageCode = 'en' | 'id';

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
}>;

export async function updateMe(input: UpdateMeInput): Promise<Me> {
  const { data } = await api.patch<Me>('/users/me', input);
  return data;
}

export async function registerFcmToken(token: string, platform: 'ios' | 'android' | 'web'): Promise<void> {
  await api.post('/users/me/fcm-token', { token, platform });
}
