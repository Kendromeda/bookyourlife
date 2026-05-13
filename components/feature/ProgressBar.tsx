import { StyleSheet, Text, View } from 'react-native';

import { Eyebrow } from '@/components/ui/Ribbon';
import { Colors, Radii, Spacing, Type } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTranslation } from '@/utils/i18n';
import { UserStats } from '@/utils/users';

const REFLECTION_TARGET = 30; // entries in last 30 days = 100%

type Props = {
  stats: UserStats;
};

/**
 * "Your book" progress card — mono eyebrow with the current year, a
 * serif accent percent on the right, and a streak/total summary row.
 * Mirrors the ProgressCard atom in the Book My Life design system.
 */
export function ProgressBar({ stats }: Props) {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const { t } = useTranslation();

  const percent = Math.min(
    100,
    Math.round((stats.entries_last_30_days / REFLECTION_TARGET) * 100),
  );

  const streakLabel =
    stats.current_streak_days === 0
      ? t('progress.startStreak')
      : stats.current_streak_days === 1
      ? t('progress.streakSingular')
      : t('progress.streak', { count: stats.current_streak_days });

  const year = new Date().getFullYear();

  return (
    <View
      style={[styles.card, { backgroundColor: c.paper, borderColor: c.border }]}
    >
      <View style={styles.headerRow}>
        <Eyebrow color={c.textSoft}>{`${t('progress.title')} · ${year}`}</Eyebrow>
        <Text
          style={[
            styles.percent,
            { color: c.accent, fontFamily: Type.serif },
          ]}
        >
          {percent}%
        </Text>
      </View>
      <View style={[styles.track, { backgroundColor: c.background }]}>
        <View
          style={[
            styles.fill,
            { width: `${percent}%`, backgroundColor: c.accent },
          ]}
        />
      </View>
      <View style={styles.metaRow}>
        <Text style={[styles.streak, { color: c.text }]}>{streakLabel}</Text>
        <Text style={[styles.meta, { color: c.textSoft }]} numberOfLines={1}>
          {t('progress.entriesIn30', { count: stats.entries_last_30_days })}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: Radii.md,
    padding: Spacing.md,
    marginTop: Spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  percent: { fontSize: 20, fontWeight: '500', letterSpacing: -0.3 },
  track: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: Spacing.sm,
  },
  fill: { height: '100%', borderRadius: 3 },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  streak: { fontSize: 12, fontWeight: '600' },
  meta: { fontSize: 12, flex: 1, textAlign: 'right' },
});
