import { useSignUp } from '@clerk/clerk-expo';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors, Radii, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function SignUpScreen() {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const router = useRouter();
  const { signUp, setActive, isLoaded } = useSignUp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [pendingVerification, setPendingVerification] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!isLoaded) return;
    setError(null);
    setBusy(true);
    try {
      await signUp.create({ emailAddress: email.trim(), password });
      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
      setPendingVerification(true);
    } catch (e: any) {
      setError(e?.errors?.[0]?.message ?? e?.message ?? 'Sign up failed');
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    if (!isLoaded) return;
    setError(null);
    setBusy(true);
    try {
      const result = await signUp.attemptEmailAddressVerification({ code });
      await setActive({ session: result.createdSessionId });
      router.replace('/(auth)/onboarding');
    } catch (e: any) {
      setError(e?.errors?.[0]?.message ?? e?.message ?? 'Verification failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.background }]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <View style={styles.container}>
          <Text style={[styles.title, { color: c.text }]}>Create account</Text>

          {!pendingVerification ? (
            <>
              <TextInput
                style={[styles.input, { color: c.text, borderColor: c.border, backgroundColor: c.surface }]}
                placeholder="Email"
                placeholderTextColor={c.muted}
                keyboardType="email-address"
                autoCapitalize="none"
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
                {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryLabel}>Create account</Text>}
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={[styles.hint, { color: c.textSoft }]}>
                Enter the verification code sent to {email}
              </Text>
              <TextInput
                style={[styles.input, { color: c.text, borderColor: c.border, backgroundColor: c.surface }]}
                placeholder="Verification code"
                placeholderTextColor={c.muted}
                keyboardType="number-pad"
                value={code}
                onChangeText={setCode}
              />
              {error && <Text style={[styles.error, { color: c.danger }]}>{error}</Text>}
              <TouchableOpacity
                style={[styles.primary, { backgroundColor: c.accent, opacity: busy ? 0.6 : 1 }]}
                onPress={verify}
                disabled={busy || !isLoaded}
              >
                {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryLabel}>Verify</Text>}
              </TouchableOpacity>
            </>
          )}

          <TouchableOpacity onPress={() => router.push('/(auth)/sign-in')}>
            <Text style={[styles.toggle, { color: c.accentDark }]}>Already have an account? Sign in</Text>
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
  title: { fontSize: 36, fontWeight: '700', marginBottom: Spacing.xxl },
  hint: { fontSize: 14, marginBottom: Spacing.lg, lineHeight: 20 },
  input: { borderWidth: 1, borderRadius: Radii.md, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, fontSize: 16, marginBottom: Spacing.md },
  error: { marginBottom: Spacing.md, fontSize: 14 },
  primary: { borderRadius: Radii.md, paddingVertical: Spacing.lg, alignItems: 'center', marginTop: Spacing.sm },
  primaryLabel: { color: '#fff', fontSize: 16, fontWeight: '600' },
  toggle: { textAlign: 'center', marginTop: Spacing.xl, fontSize: 14 },
});
