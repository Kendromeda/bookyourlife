import { useAuth } from '@clerk/clerk-expo';
import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/ui/AppHeader';
import { Eyebrow } from '@/components/ui/Ribbon';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Radii, Spacing, Type } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTranslation } from '@/utils/i18n';
import { deleteAccount } from '@/utils/users';

export default function PrivacyScreen() {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const router = useRouter();
  const { t } = useTranslation();
  const { signOut } = useAuth();
  const [error, setError] = useState<string | null>(null);

  const remove = useMutation({
    mutationFn: deleteAccount,
    onSuccess: async () => {
      await signOut();
      router.replace('/(auth)/sign-in');
    },
    onError: () => setError(t('privacy.deleteFailed')),
  });

  const confirmDelete = () => {
    Alert.alert(
      t('privacy.deleteTitle'),
      t('privacy.deleteMessage'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: () => remove.mutate(),
        },
      ],
    );
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.background }]} edges={['top']}>
      <AppHeader title={t('privacy.title')} onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.body}>
        {/* Hero paragraph in editorial italic serif */}
        <View style={[styles.heroCard, { backgroundColor: c.paper, borderColor: c.border }]}>
          <Eyebrow color={c.accentDark}>{t('privacy.title')}</Eyebrow>
          <Text
            style={[
              styles.heroBody,
              { color: c.text, fontFamily: Type.serif },
            ]}
          >
            {t('privacy.body')}
          </Text>
        </View>

        {/* Practice rows — small, scannable promises */}
        <Eyebrow style={styles.sectionLabel as any}>
          {t('more.section.account')}
        </Eyebrow>
        <View style={[styles.rowList, { borderColor: c.border }]}>
          <PrivacyRow
            icon="lock.fill"
            label="Private by default"
            detail="Entries are encrypted in transit and stored privately on your account."
          />
          <PrivacyRow
            icon="cloud"
            label="No third-party sharing"
            detail="We never sell or share your journal content."
            divider
          />
          <PrivacyRow
            icon="mic.fill"
            label="Voice notes"
            detail="Transcribed via OpenAI and discarded after processing."
          />
        </View>

        {error && <Text style={[styles.error, { color: c.danger }]}>{error}</Text>}

        <TouchableOpacity
          style={[
            styles.dangerBtn,
            { borderColor: c.danger, opacity: remove.isPending ? 0.6 : 1 },
          ]}
          onPress={confirmDelete}
          disabled={remove.isPending}
          activeOpacity={0.9}
        >
          {remove.isPending ? (
            <ActivityIndicator color={c.danger} />
          ) : (
            <Text style={[styles.dangerLabel, { color: c.danger }]}>
              {t('privacy.deleteAccount')}
            </Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function PrivacyRow({
  icon,
  label,
  detail,
  divider,
}: {
  icon: string;
  label: string;
  detail: string;
  divider?: boolean;
}) {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  return (
    <View
      style={[
        styles.row,
        divider && {
          borderTopWidth: 1,
          borderBottomWidth: 1,
          borderColor: c.border,
        },
      ]}
    >
      <View style={[styles.rowIcon, { backgroundColor: c.background }]}>
        <IconSymbol name={icon as any} size={16} color={c.accent} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.rowLabel, { color: c.text }]}>{label}</Text>
        <Text style={[styles.rowDetail, { color: c.textSoft }]}>{detail}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  body: { padding: Spacing.lg, paddingBottom: Spacing.xxl },
  heroCard: {
    borderWidth: 1,
    borderRadius: Radii.md,
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  heroBody: {
    fontSize: 16,
    lineHeight: 26,
  },
  sectionLabel: {
    marginTop: Spacing.xl,
    marginBottom: Spacing.sm,
    paddingHorizontal: Spacing.xs,
  },
  rowList: {
    borderWidth: 1,
    borderRadius: Radii.md,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
    padding: Spacing.md,
    backgroundColor: 'transparent',
  },
  rowIcon: {
    width: 32,
    height: 32,
    borderRadius: Radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowLabel: { fontSize: 15, fontWeight: '600' },
  rowDetail: { fontSize: 13, marginTop: 2, lineHeight: 18 },
  error: { marginTop: Spacing.lg, fontSize: 14, textAlign: 'center' },
  dangerBtn: {
    marginTop: Spacing.xl,
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: Spacing.lg,
    alignItems: 'center',
  },
  dangerLabel: { fontSize: 15, fontWeight: '600', letterSpacing: 0.2 },
});
