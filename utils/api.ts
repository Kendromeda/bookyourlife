import axios, { AxiosError, AxiosInstance } from 'axios';
import Constants from 'expo-constants';

const baseURL =
  process.env.EXPO_PUBLIC_API_BASE_URL ??
  (Constants.expoConfig?.extra?.apiBaseUrl as string | undefined) ??
  'http://10.0.2.2:8000';

export const apiBaseURL = baseURL.replace(/\/$/, '');
export const apiV1BaseURL = `${apiBaseURL}/api/v1`;

export const api: AxiosInstance = axios.create({
  baseURL: apiV1BaseURL,
  timeout: 15000,
});

// Token injector — set by ClerkProvider via setApiToken() below.
let _getToken: (() => Promise<string | null>) | null = null;

export function setApiTokenGetter(fn: () => Promise<string | null>) {
  _getToken = fn;
}

export async function getApiBearerToken(): Promise<string | null> {
  if (!_getToken) return null;
  return _getToken();
}

api.interceptors.request.use(async (config) => {
  if (_getToken) {
    const token = await _getToken();
    if (token) config.headers.set('Authorization', `Bearer ${token}`);
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    if (error.response?.status === 401 && _getToken && error.config) {
      const fresh = await _getToken();
      if (fresh) {
        error.config.headers.set('Authorization', `Bearer ${fresh}`);
        return api.request(error.config);
      }
    }
    return Promise.reject(error);
  },
);
