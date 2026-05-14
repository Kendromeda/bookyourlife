import { useThemeStore } from '@/utils/themeStore';

/**
 * Returns the user-selected appearance preference. The OS color scheme is
 * intentionally ignored — appearance is controlled from Settings →
 * Appearance and persisted via AsyncStorage.
 */
export function useColorScheme(): 'light' | 'dark' {
  return useThemeStore((s) => s.preference);
}
