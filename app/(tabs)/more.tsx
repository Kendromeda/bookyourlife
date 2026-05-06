import { useAuth } from '@clerk/clerk-expo';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Href, useRouter } from 'expo-router';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Radii, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { fetchMe, LANGUAGES, LanguageCode, Me, updateMe } from '@/utils/users';

const NOTIF_HOURS = [6, 7, 8, 9, 10, 12, 18, 20, 21];

type RowProps = {
  icon: string;
  label: string;
  detail?: string;
  onPress?: () => void;
  danger?: boolean;
};

function Row({ icon, label, detail, onPress, danger }: RowProps) {
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
      {onPress && !danger && <IconSymbol name="chevron.right" size={16} color={c.muted} />}
    </TouchableOpacity>
  );
}

export default function MoreScreen() {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const router = useRouter();
  const qc = useQueryClient();
  const { signOut } = useAuth();

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

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.background }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={[styles.title, { color: c.text }]}>More</Text>

        {meQuery.isLoading ? (
          <ActivityIndicator color={c.accent} />
        ) : (
          <>
            <View style={[styles.profileCard, { backgroundColor: c.surface, borderColor: c.border }]}>
              <View style={[styles.avatar, { backgroundColor: c.accent }]}>
                <Text style={styles.avatarLabel}>
                  {displayName.slice(0, 1).toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.profileName, { color: c.text }]}>{displayName}</Text>
                <Text style={[styles.profileMeta, { color: c.muted }]}>
                  {me?.subscription_tier === 'premium' ? 'Premium' : 'Free plan'}
                </Text>
              </View>
            </View>

            <Text style={[styles.section, { color: c.muted }]}>YOUR BOOK</Text>
            <Row
              icon="book.fill"
              label="Generate Book"
              detail="Turn your entries into a printable book"
              onPress={() => router.push('/book' as Href)}
            />

            <Text style={[styles.section, { color: c.muted }]}>PREFERENCES</Text>
            <Row
              icon="bell.fill"
              label="Daily question time"
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
              label="Language"
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
            <Row icon="paintbrush.fill" label="Appearance" detail="System default" />

            <Text style={[styles.section, { color: c.muted }]}>ACCOUNT</Text>
            <Row icon="person.fill" label="Profile" />
            <Row icon="lock.fill" label="Privacy" />
            <Row icon="doc.fill" label="Export data" />

            <Text style={[styles.section, { color: c.muted }]}> </Text>
            <Row icon="arrow.right" label="Sign out" onPress={() => signOut()} danger />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: { padding: Spacing.lg, paddingBottom: Spacing.xxl },
  title: { fontSize: 32, fontWeight: '700', marginBottom: Spacing.lg },
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
  avatarLabel: { color: '#fff', fontSize: 20, fontWeight: '600' },
  profileName: { fontSize: 17, fontWeight: '600' },
  profileMeta: { fontSize: 13, marginTop: 2 },
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
