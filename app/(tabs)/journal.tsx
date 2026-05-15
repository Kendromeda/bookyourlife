import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { JournalCalendar } from '@/components/feature/JournalCalendar';
import { JournalMap } from '@/components/feature/JournalMap';
import { JournalMedia } from '@/components/feature/JournalMedia';
import { Timeline } from '@/components/feature/Timeline';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Radii, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTranslation } from '@/utils/i18n';

type Tab = 'list' | 'calendar' | 'media' | 'map';

export default function JournalScreen() {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const router = useRouter();
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>('list');

  const TABS: { id: Tab; label: string }[] = [
    { id: 'list', label: t('journal.tab.list') },
    { id: 'calendar', label: t('journal.tab.calendar') },
    { id: 'media', label: t('journal.tab.media') },
    { id: 'map', label: t('journal.tab.map') },
  ];

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.background }]} edges={['top']}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: c.text }]}>{t('journal.title')}</Text>
        <Text style={[styles.year, { color: c.muted }]}>{new Date().getFullYear()}</Text>
      </View>

      <View style={[styles.tabBar, { borderBottomColor: c.border }]}>
        {TABS.map((tabItem) => {
          const active = tab === tabItem.id;
          return (
            <TouchableOpacity
              key={tabItem.id}
              style={styles.tabItem}
              onPress={() => setTab(tabItem.id)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.tabLabel,
                  { color: active ? c.accent : c.muted, fontWeight: active ? '600' : '500' },
                ]}
              >
                {tabItem.label}
              </Text>
              {active && <View style={[styles.tabUnderline, { backgroundColor: c.accent }]} />}
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.body}>
        {tab === 'list' && <Timeline />}
        {tab === 'calendar' && <JournalCalendar />}
        {tab === 'media' && <JournalMedia />}
        {tab === 'map' && <JournalMap />}
      </View>

      <TouchableOpacity
        style={[styles.fab, { backgroundColor: c.accent }]}
        onPress={() => router.push('/modal')}
        activeOpacity={0.85}
      >
        <IconSymbol name="plus" size={20} color="#fff" />
        <Text style={styles.fabLabel}>{t('today.newEntry')}</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg, paddingBottom: Spacing.sm },
  title: { fontSize: 32, fontWeight: '700' },
  year: { fontSize: 14, marginTop: Spacing.xs },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    paddingHorizontal: Spacing.md,
  },
  tabItem: {
    flex: 1,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  tabLabel: { fontSize: 14 },
  tabUnderline: {
    position: 'absolute',
    bottom: -1,
    left: '20%',
    right: '20%',
    height: 2,
  },
  body: { flex: 1 },
  fab: {
    position: 'absolute',
    right: Spacing.lg,
    bottom: Spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: Radii.pill,
    boxShadow: '0px 4px 8px rgba(0, 0, 0, 0.15)',
    elevation: 4,
  },
  fabLabel: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
