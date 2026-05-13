import { useAuth } from '@clerk/clerk-expo';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Href, useRouter } from 'expo-router';
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

import { Eyebrow, RibbonMark } from '@/components/ui/Ribbon';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Radii, Spacing, Type } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTranslation } from '@/utils/i18n';
import { fetchExport, fetchMe, LANGUAGES, LanguageCode, Me, updateMe } from '@/utils/users';

const NOTIF_HOURS = [6, 7, 8, 9, 10, 12, 18, 20, 21];

type RowProps = {
  icon: string;
  label: string;
  detail?: string;
  onPress?: () => void;
  danger?: boolean;
  trailing?: React.ReactNode;
};

function Row({ icon, label, detail, onPress, danger, trailing }: RowProps) {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
      style={[styles.row, { backgroundColor: c.surface, borderColor: c.border }]}
    >
      <View style={[styles.rowIcon, { backgroundColor: c.background }]}>
        <IconSymbol name={icon as any} size={18} color={danger ? c.danger : c.accent} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.rowLabel, { color: danger ? c.danger : c.text }]}>{label}</Text>
        {detail && <Text style={[styles.rowDetail, { color: c.muted }]}>{detail}</Text>}
      </View>
      {trailing ? trailing : onPress && !danger && <IconSymbol name="chevron.right" size={16} color={c.muted} />}
    </TouchableOpacity>
  );
}

export default function MoreScreen() {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const router = useRouter();
  const qc = useQueryClient();
  const { signOut } = useAuth();
  const { t } = useTranslation();
  const [exporting, setExporting] = useState(false);

  const meQuery = useQuery<Me>({ queryKey: ['me'], queryFn: fetchMe });
  const updateNotif = useMutation({
    mutationFn: (hour: number) => updateMe({ notif_hour: hour }),
    onSuccess: (data) => qc.setQueryData(['me'], data),
  });
  const updateLanguage = useMutation({
    mutationFn: (preferred_language: LanguageCode) => updateMe({ preferred_language }),
    onSuccess: (data) => {
      qc.setQueryData(['me'], data);
      qc.invalidateQueries({ queryKey: ['questions', 'today'] });
    },
  });

  const me = meQuery.data;
  const displayName = me?.display_name || me?.email || 'You';

  const handleExport = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const data = await fetchExport();
      // Try to share via expo-sharing + expo-file-system when available;
      // fall back to a simple alert with confirmation.
      let shared = false;
      try {
        const FileSystem = await import('expo-file-system/legacy');
        const Sharing = await import('expo-sharing');
        const isAvailable = await Sharing.isAvailableAsync();
        const uri = `${FileSystem.cacheDirectory}${t('export.fileName')}`;
        await FileSystem.writeAsStringAsync(uri, JSON.stringify(data, null, 2), {
          encoding: 'utf8',
        });
        if (isAvailable) {
          await Sharing.shareAsync(uri, { mimeType: 'application/json' });
          shared = true;
        }
      } catch {
        // expo-file-system or expo-sharing not available; show alert fallback
      }
      if (!shared) {
        Alert.alert(t('export.success'), t('export.unsupported'));
      }
    } catch {
      Alert.alert(t('export.failed'));
    } finally {
      setExporting(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.background }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.titleRow}>
          <Eyebrow>{t('more.signedInAs')}</Eyebrow>
          <Text style={[styles.title, { color: c.text, fontFamily: Type.serif }]}>
            {t('more.title')}
          </Text>
        </View>

        {meQuery.isLoading ? (
          <ActivityIndicator color={c.accent} />
        ) : (
          <>
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => router.push('/profile' as Href)}
              style={[styles.profileCard, { backgroundColor: c.paper, borderColor: c.border }]}
            >
              <View style={[styles.avatar, { backgroundColor: c.accent }]}>
                <Text style={[styles.avatarLabel, { fontFamily: Type.serif }]}>
                  {displayName.slice(0, 1).toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.profileName, { color: c.text, fontFamily: Type.serif }]}>
                  {displayName}
                </Text>
                <Text style={[styles.profileMeta, { color: c.muted }]}>
                  {me?.subscription_tier === 'premium' ? t('more.plan.premium') : t('more.plan.free')}
                </Text>
              </View>
              <View style={[styles.editPill, { backgroundColor: c.background }]}>
                <Text style={[styles.editPillLabel, { color: c.accentDark }]}>
                  EDIT
                </Text>
              </View>
            </TouchableOpacity>

            <Text style={[styles.section, { color: c.muted }]}>{t('more.section.yourBook')}</Text>
            <Row
              icon="book.fill"
              label={t('more.row.generateBook')}
              detail={t('more.row.generateBookDetail')}
              onPress={() => router.push('/book' as Href)}
            />

            <Text style={[styles.section, { color: c.muted }]}>{t('more.section.preferences')}</Text>
            <Row
              icon="bell.fill"
              label={t('more.row.notifHour')}
              detail={me ? `${me.notif_hour.toString().padStart(2, '0')}:00` : '—'}
            />
            {me && (
              <View style={styles.hourGrid}>
                {NOTIF_HOURS.map((h) => {
                  const active = me.notif_hour === h;
                  return (
                    <TouchableOpacity
                      key={h}
                      onPress={() => updateNotif.mutate(h)}
                      style={[
                        styles.hourChip,
                        {
                          backgroundColor: active ? c.accent : c.surface,
                          borderColor: active ? c.accent : c.border,
                        },
                      ]}
                    >
                      <Text style={[styles.hourLabel, { color: active ? '#fff' : c.text }]}>
                        {h.toString().padStart(2, '0')}:00
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
            <Row
              icon="globe"
              label={t('more.row.language')}
              detail={
                LANGUAGES.find((item) => item.code === me?.preferred_language)?.label ?? 'English'
              }
            />
            {me && (
              <View style={styles.hourGrid}>
                {LANGUAGES.map((item) => {
                  const active = me.preferred_language === item.code;
                  return (
                    <TouchableOpacity
                      key={item.code}
                      onPress={() => updateLanguage.mutate(item.code)}
                      style={[
                        styles.hourChip,
                        {
                          backgroundColor: active ? c.accent : c.surface,
                          borderColor: active ? c.accent : c.border,
                        },
                      ]}
                    >
                      <Text style={[styles.hourLabel, { color: active ? '#fff' : c.text }]}>
                        {item.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
            <Row icon="paintbrush.fill" label={t('more.row.appearance')} detail={t('more.row.appearanceDetail')} />

            <Text style={[styles.section, { color: c.muted }]}>{t('more.section.account')}</Text>
            <Row
              icon="person.fill"
              label={t('more.row.profile')}
              onPress={() => router.push('/profile' as Href)}
            />
            <Row
              icon="lock.fill"
              label={t('more.row.privacy')}
              onPress={() => router.push('/privacy' as Href)}
            />
            <Row
              icon="doc.fill"
              label={t('more.row.exportData')}
              onPress={handleExport}
              trailing={
                exporting ? <ActivityIndicator color={c.muted} size="small" /> : undefined
              }
            />

            <Text style={[styles.section, { color: c.muted }]}> </Text>
            <Row icon="arrow.right" label={t('common.signOut')} onPress={() => signOut()} danger />

            <View style={styles.footer}>
              <RibbonMark
                size={20}
                inkColor={c.muted}
                accentColor={c.accent}
                backgroundColor={c.background}
              />
              <Text style={[styles.versionLabel, { color: c.muted }]}>
                Book My Life · v1.0
              </Text>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: { padding: Spacing.lg, paddingBottom: Spacing.xxl },
  titleRow: { alignItems: 'flex-start', marginBottom: Spacing.lg, gap: 4 },
  title: { fontSize: 30, fontWeight: '500', letterSpacing: -0.5 },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.lg,
    borderRadius: Radii.md,
    borderWidth: 1,
    marginBottom: Spacing.lg,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: Radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLabel: { color: '#fff', fontSize: 22, fontWeight: '500' },
  profileName: { fontSize: 18, fontWeight: '600', letterSpacing: -0.2 },
  profileMeta: { fontSize: 12, marginTop: 2 },
  editPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  editPillLabel: {
    fontFamily: Type.mono,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.4,
  },
  footer: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
    gap: 6,
  },
  versionLabel: {
    fontFamily: Type.mono,
    fontSize: 9,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
  },
  section: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1,
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
    paddingHorizontal: Spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: Radii.md,
    borderWidth: 1,
    marginBottom: Spacing.sm,
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: Radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowLabel: { fontSize: 16, fontWeight: '500' },
  rowDetail: { fontSize: 13, marginTop: 2 },
  hourGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginVertical: Spacing.md,
    paddingHorizontal: Spacing.xs,
  },
  hourChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radii.pill,
    borderWidth: 1,
  },
  hourLabel: { fontSize: 13, fontWeight: '500' },
});
