import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/ui/AppHeader';
import { Eyebrow } from '@/components/ui/Ribbon';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Radii, Spacing, Type } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTranslation } from '@/utils/i18n';
import { ThemePreference, useThemeStore } from '@/utils/themeStore';

type Option = {
  value: ThemePreference;
  titleKey: 'appearance.light' | 'appearance.dark';
  detailKey: 'appearance.lightDetail' | 'appearance.darkDetail';
};

const OPTIONS: Option[] = [
  { value: 'light', titleKey: 'appearance.light', detailKey: 'appearance.lightDetail' },
  { value: 'dark', titleKey: 'appearance.dark', detailKey: 'appearance.darkDetail' },
];

export default function AppearanceScreen() {
  const scheme = useColorScheme();
  const c = Colors[scheme];
  const router = useRouter();
  const { t } = useTranslation();
  const preference = useThemeStore((s) => s.preference);
  const setPreference = useThemeStore((s) => s.setPreference);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.background }]} edges={['top']}>
      <AppHeader title={t('appearance.title')} onBack={() => router.back()} />

      <ScrollView contentContainerStyle={styles.body}>
        <Eyebrow style={styles.sectionLabel as any}>
          {t('appearance.section')}
        </Eyebrow>

        <View style={[styles.list, { borderColor: c.border, backgroundColor: c.paper }]}>
          {OPTIONS.map((opt, idx) => {
            const active = preference === opt.value;
            const isLast = idx === OPTIONS.length - 1;
            return (
              <TouchableOpacity
                key={opt.value}
                onPress={() => void setPreference(opt.value)}
                activeOpacity={0.85}
                style={[
                  styles.row,
                  !isLast && { borderBottomWidth: 1, borderBottomColor: c.border },
                ]}
              >
                <View style={styles.rowMain}>
                  <Text
                    style={[
                      styles.rowTitle,
                      { color: c.text, fontFamily: Type.serif },
                    ]}
                  >
                    {t(opt.titleKey)}
                  </Text>
                  <Text style={[styles.rowDetail, { color: c.textSoft }]}>
                    {t(opt.detailKey)}
                  </Text>
                </View>
                <View
                  style={[
                    styles.radio,
                    {
                      borderColor: active ? c.accent : c.border,
                      backgroundColor: active ? c.accent : 'transparent',
                    },
                  ]}
                >
                  {active && <IconSymbol name="checkmark" size={14} color={c.paper} />}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={[styles.note, { color: c.muted, fontFamily: Type.italic, fontStyle: 'italic' }]}>
          {t('appearance.note')}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  body: { padding: Spacing.lg, paddingBottom: Spacing.xxl },
  sectionLabel: {
    marginBottom: Spacing.sm,
    paddingHorizontal: Spacing.xs,
  },
  list: {
    borderWidth: 1,
    borderRadius: Radii.md,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
    gap: Spacing.md,
  },
  rowMain: { flex: 1 },
  rowTitle: { fontSize: 17, fontWeight: '500', letterSpacing: -0.2 },
  rowDetail: { fontSize: 13, marginTop: 2, lineHeight: 18 },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  note: {
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: Spacing.lg,
    paddingHorizontal: Spacing.lg,
  },
});
