import { useSignUp } from '@clerk/clerk-expo';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { RibbonMark } from '@/components/ui/Ribbon';
import { Colors, Radii, Spacing, Type } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTranslation } from '@/utils/i18n';

export default function SignUpScreen() {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const router = useRouter();
  const { t } = useTranslation();
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
          <View style={styles.brand}>
            <RibbonMark size={28} inkColor={c.text} accentColor={c.accent} backgroundColor={c.background} />
          </View>
          <Text style={[styles.title, { color: c.text, fontFamily: Type.serif }]}>
            {t('auth.signUp.title')}
          </Text>

          {!pendingVerification ? (
            <>
              <TextInput
                style={[styles.input, { color: c.text, borderColor: c.border, backgroundColor: c.paper, fontFamily: Type.serif }]}
                placeholder={t('auth.signIn.email')}
                placeholderTextColor={c.muted}
                keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onChangeText={setEmail}
              />
              <TextInput
                style={[styles.input, { color: c.text, borderColor: c.border, backgroundColor: c.paper, fontFamily: Type.serif }]}
                placeholder={t('auth.signIn.password')}
                placeholderTextColor={c.muted}
                secureTextEntry
                value={password}
                onChangeText={setPassword}
              />
              {error && <Text style={[styles.error, { color: c.danger }]}>{error}</Text>}
              <TouchableOpacity
                style={[styles.primary, { backgroundColor: c.text, opacity: busy ? 0.6 : 1 }]}
                onPress={submit}
                disabled={busy || !isLoaded}
                activeOpacity={0.9}
              >
                {busy ? (
                  <ActivityIndicator color={c.background} />
                ) : (
                  <Text style={[styles.primaryLabel, { color: c.background }]}>
                    {t('auth.signUp.button')}
                  </Text>
                )}
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text
                style={[
                  styles.hint,
                  { color: c.textSoft, fontFamily: Type.italic, fontStyle: 'italic' },
                ]}
              >
                {t('auth.signUp.verifyHint', { email })}
              </Text>
              <TextInput
                style={[styles.input, { color: c.text, borderColor: c.border, backgroundColor: c.paper, fontFamily: Type.serif }]}
                placeholder={t('auth.signUp.code')}
                placeholderTextColor={c.muted}
                keyboardType="number-pad"
                value={code}
                onChangeText={setCode}
              />
              {error && <Text style={[styles.error, { color: c.danger }]}>{error}</Text>}
              <TouchableOpacity
                style={[styles.primary, { backgroundColor: c.text, opacity: busy ? 0.6 : 1 }]}
                onPress={verify}
                disabled={busy || !isLoaded}
                activeOpacity={0.9}
              >
                {busy ? (
                  <ActivityIndicator color={c.background} />
                ) : (
                  <Text style={[styles.primaryLabel, { color: c.background }]}>
                    {t('auth.signUp.verify')}
                  </Text>
                )}
              </TouchableOpacity>
            </>
          )}

          <TouchableOpacity onPress={() => router.push('/(auth)/sign-in')}>
            <Text style={[styles.toggle, { color: c.accentDark }]}>{t('auth.signUp.toggle')}</Text>
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
  brand: { alignItems: 'center', marginBottom: Spacing.lg },
  title: { fontSize: 32, fontWeight: '500', letterSpacing: -0.5, textAlign: 'center', marginBottom: Spacing.xxl },
  hint: { fontSize: 16, marginBottom: Spacing.lg, lineHeight: 24, textAlign: 'center' },
  input: { borderWidth: 1, borderRadius: Radii.md, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, fontSize: 17, marginBottom: Spacing.md },
  error: { marginBottom: Spacing.md, fontSize: 14 },
  primary: { borderRadius: 999, paddingVertical: Spacing.lg, alignItems: 'center', marginTop: Spacing.sm },
  primaryLabel: { fontSize: 16, fontWeight: '600', letterSpacing: 0.2 },
  toggle: { textAlign: 'center', marginTop: Spacing.xl, fontSize: 14 },
});
