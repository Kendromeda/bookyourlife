import { useEffect } from 'react';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { ClerkLoaded, ClerkProvider, useAuth } from '@clerk/clerk-expo';
import { tokenCache } from '@clerk/clerk-expo/token-cache';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { QueryClientProvider } from '@tanstack/react-query';
import * as Linking from 'expo-linking';
import Constants from 'expo-constants';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { queryClient } from '@/utils/queryClient';
import { setApiTokenGetter } from '@/utils/api';
import { ensurePushRegistered } from '@/utils/fcm';

export const unstable_settings = {
  anchor: '(tabs)',
};

const publishableKey =
  (Constants.expoConfig?.extra?.clerkPublishableKey as string | undefined) ??
  process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ??
  '';

function useAuthGate() {
  const { isSignedIn, isLoaded, getToken } = useAuth();
  const router = useRouter();
  const segments = useSegments() as string[];

  useEffect(() => {
    setApiTokenGetter(() => getToken());
  }, [getToken]);

  useEffect(() => {
    if (!isLoaded) return;
    const inAuthGroup = segments[0] === '(auth)';
    if (!isSignedIn && !inAuthGroup) {
      router.replace('/(auth)/sign-in');
    } else if (isSignedIn && inAuthGroup && segments[1] !== 'onboarding') {
      router.replace('/(tabs)');
    }
  }, [isSignedIn, isLoaded, segments, router]);
}

function usePushLifecycle() {
  const { isSignedIn } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isSignedIn) return;
    if (Constants.appOwnership === 'expo') return;
    void ensurePushRegistered().catch(() => {});
  }, [isSignedIn]);

  useEffect(() => {
    if (Constants.appOwnership === 'expo') return;
    let cleanup: (() => void) | undefined;
    void import('expo-notifications').then((Notifications) => {
      const sub = Notifications.addNotificationResponseReceivedListener((response) => {
        const deepLink = response.notification.request.content.data?.deep_link as string | undefined;
        if (deepLink) {
          try {
            const parsed = Linking.parse(deepLink);
            if (parsed.path?.startsWith('question/')) {
              router.push('/(tabs)');
            }
          } catch {
            // ignore malformed
          }
        }
      });
      cleanup = () => sub.remove();
    });
    return () => cleanup?.();
  }, [router]);
}

function AppShell() {
  const colorScheme = useColorScheme();
  useAuthGate();
  usePushLifecycle();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal', headerShown: false }} />
        <Stack.Screen name="prompt-pack" options={{ headerShown: false }} />
        <Stack.Screen name="book" options={{ headerShown: false }} />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
      <ClerkLoaded>
        <QueryClientProvider client={queryClient}>
          <AppShell />
        </QueryClientProvider>
      </ClerkLoaded>
    </ClerkProvider>
  );
}
