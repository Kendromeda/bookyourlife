import { useSignIn } from '@clerk/clerk-expo';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors, Radii, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function SignInScreen() {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const router = useRouter();
  const { signIn, setActive, isLoaded } = useSignIn();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!isLoaded) return;
    setError(null);
    setBusy(true);
    try {
      const result = await signIn.create({ identifier: email.trim(), password });
      await setActive({ session: result.createdSessionId });
    } catch (e: any) {
      setError(e?.errors?.[0]?.message ?? e?.message ?? 'Sign in failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.background }]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <View style={styles.container}>
          <Text style={[styles.title, { color: c.text }]}>Life Book</Text>
          <Text style={[styles.subtitle, { color: c.textSoft }]}>
            A daily journal that listens, then writes you a book.
          </Text>

          <TextInput
            style={[styles.input, { color: c.text, borderColor: c.border, backgroundColor: c.surface }]}
            placeholder="Email"
            placeholderTextColor={c.muted}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            value={email}
            onChangeText={setEmail}
          />
          <TextInput
            style={[styles.input, { color: c.text, borderColor: c.border, backgroundColor: c.surface }]}
            placeholder="Password"
            placeholderTextColor={c.muted}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />

          {error && <Text style={[styles.error, { color: c.danger }]}>{error}</Text>}

          <TouchableOpacity
            style={[styles.primary, { backgroundColor: c.accent, opacity: busy ? 0.6 : 1 }]}
            onPress={submit}
            disabled={busy || !isLoaded}
          >
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryLabel}>Sign in</Text>}
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.push('/(auth)/sign-up')}>
            <Text style={[styles.toggle, { color: c.accentDark }]}>New here? Create an account</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  container: { flex: 1, paddingHorizontal: Spacing.xl, justifyContent: 'center' },
  title: { fontSize: 36, fontWeight: '700', marginBottom: Spacing.sm },
  subtitle: { fontSize: 15, marginBottom: Spacing.xxl, lineHeight: 22 },
  input: { borderWidth: 1, borderRadius: Radii.md, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, fontSize: 16, marginBottom: Spacing.md },
  error: { marginBottom: Spacing.md, fontSize: 14 },
  primary: { borderRadius: Radii.md, paddingVertical: Spacing.lg, alignItems: 'center', marginTop: Spacing.sm },
  primaryLabel: { color: '#fff', fontSize: 16, fontWeight: '600' },
  toggle: { textAlign: 'center', marginTop: Spacing.xl, fontSize: 14 },
});
