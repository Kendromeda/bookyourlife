import { Pressable, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';

import { Eyebrow } from '@/components/ui/Ribbon';
import {
  BookPaperPalettes,
  BookRibbonPalettes,
  BookSurfacePalettes,
  BookTypeSets,
  Spacing,
  Type,
} from '@/constants/theme';
import type { BookTweaks } from '@/utils/books';
import { useTranslation } from '@/utils/i18n';

type Props = {
  tweaks: BookTweaks;
  onChange: (next: BookTweaks) => void;
  onClose: () => void;
};

const PAPER_KEYS: BookTweaks['paper'][] = ['cream', 'ivory', 'white', 'slate'];
const TYPE_KEYS: BookTweaks['type'][] = ['newsreader', 'garamond', 'cormorant'];
const RIBBON_KEYS: BookTweaks['ribbon'][] = ['terracotta', 'ink', 'forest', 'wine'];
const SURFACE_KEYS: BookTweaks['surface'][] = ['ink', 'walnut', 'slate', 'paper'];

/**
 * Bottom-sheet picker for book viewer tweaks. Each row sends a partial
 * tweaks dict to the parent — the parent owns the PATCH mutation so the
 * sheet stays presentation-only.
 */
export function TweaksSheet({ tweaks, onChange, onClose }: Props) {
  const { t } = useTranslation();
  const current: Required<BookTweaks> = {
    paper: tweaks.paper ?? 'cream',
    type: tweaks.type ?? 'newsreader',
    ribbon: tweaks.ribbon ?? 'terracotta',
    surface: tweaks.surface ?? 'ink',
    illustrations_enabled: tweaks.illustrations_enabled ?? true,
  };

  return (
    <View style={styles.backdrop}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.handle} />
        <View style={styles.header}>
          <Text style={[styles.title, { fontFamily: Type.serif }]}>{t('book.viewer.tweaks.title')}</Text>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.close}>{t('common.done')}</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={{ paddingBottom: Spacing.xxl }}>
          <Section label={t('book.viewer.tweaks.paper')}>
            {PAPER_KEYS.map((key) => {
              if (!key) return null;
              const palette = BookPaperPalettes[key];
              return (
                <SwatchOption
                  key={key}
                  label={t(`book.viewer.tweaks.paperOption.${key}` as never)}
                  swatch={palette.paper}
                  border={palette.faint}
                  active={current.paper === key}
                  onPress={() => onChange({ paper: key })}
                />
              );
            })}
          </Section>

          <Section label={t('book.viewer.tweaks.type')}>
            {TYPE_KEYS.map((key) => {
              if (!key) return null;
              const set = BookTypeSets[key];
              return (
                <RadioOption
                  key={key}
                  label={set.label}
                  active={current.type === key}
                  onPress={() => onChange({ type: key })}
                />
              );
            })}
          </Section>

          <Section label={t('book.viewer.tweaks.ribbon')}>
            {RIBBON_KEYS.map((key) => {
              if (!key) return null;
              const palette = BookRibbonPalettes[key];
              return (
                <SwatchOption
                  key={key}
                  label={t(`book.viewer.tweaks.ribbonOption.${key}` as never)}
                  swatch={palette.c}
                  border={palette.d}
                  active={current.ribbon === key}
                  onPress={() => onChange({ ribbon: key })}
                />
              );
            })}
          </Section>

          <Section label={t('book.viewer.tweaks.stage')}>
            {SURFACE_KEYS.map((key) => {
              if (!key) return null;
              return (
                <SwatchOption
                  key={key}
                  label={t(`book.viewer.tweaks.stageOption.${key}` as never)}
                  swatch={BookSurfacePalettes[key]}
                  border="rgba(0,0,0,0.15)"
                  active={current.surface === key}
                  onPress={() => onChange({ surface: key })}
                />
              );
            })}
          </Section>

          <View style={styles.toggleRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.toggleLabel, { fontFamily: Type.serif }]}>
                {t('book.viewer.tweaks.illustrations')}
              </Text>
              <Text style={styles.toggleSub}>{t('book.viewer.tweaks.illustrationsHint')}</Text>
            </View>
            <Switch
              value={current.illustrations_enabled}
              onValueChange={(v) => onChange({ illustrations_enabled: v })}
            />
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Eyebrow style={{ marginBottom: Spacing.sm } as any}>{label}</Eyebrow>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm }}>{children}</View>
    </View>
  );
}

function SwatchOption({
  label,
  swatch,
  border,
  active,
  onPress,
}: {
  label: string;
  swatch: string;
  border: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={[
        styles.option,
        {
          borderColor: active ? '#2C2421' : border,
          borderWidth: active ? 2 : 1,
        },
      ]}
    >
      <View style={[styles.swatch, { backgroundColor: swatch, borderColor: border }]} />
      <Text style={[styles.optionLabel, { fontFamily: Type.serif }]}>{label}</Text>
    </TouchableOpacity>
  );
}

function RadioOption({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={[
        styles.option,
        styles.radioOption,
        {
          borderColor: active ? '#2C2421' : '#E5DCD0',
          borderWidth: active ? 2 : 1,
        },
      ]}
    >
      <Text style={[styles.optionLabel, { fontFamily: Type.serif }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    backgroundColor: '#FAF6F0',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    maxHeight: '78%',
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E5DCD0',
    alignSelf: 'center',
    marginBottom: Spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  title: { fontSize: 22, fontWeight: '500', color: '#2C2421' },
  close: { fontFamily: Type.mono, fontSize: 11, letterSpacing: 1.2, color: '#A36F54', textTransform: 'uppercase', fontWeight: '600' },
  section: { marginBottom: Spacing.xl },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
  },
  radioOption: { paddingHorizontal: 16 },
  swatch: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1,
  },
  optionLabel: { fontSize: 14, color: '#2C2421' },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: '#E5DCD0',
  },
  toggleLabel: { fontSize: 16, color: '#2C2421', fontWeight: '500' },
  toggleSub: { fontSize: 12, color: '#9B8E84', marginTop: 2 },
});
