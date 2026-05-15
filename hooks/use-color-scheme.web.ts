import { useThemeStore } from '@/utils/themeStore';

export function useColorScheme(): 'light' | 'dark' {
  return useThemeStore((s) => s.preference);
}
