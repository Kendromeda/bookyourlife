import { useUser } from '@clerk/clerk-expo';
import { useMutation } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Eyebrow, Ribbon, RibbonMark } from '@/components/ui/Ribbon';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Type } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { uploadPhoto } from '@/utils/entries';
import { useTranslation } from '@/utils/i18n';
import type { TranslationKey } from '@/utils/i18n';
import { JournalingGoal, updateMe } from '@/utils/users';

// ─────────────────────────────────────────────────────────────
// Flow definition — 7 screens. Welcome has no progress bar; the
// other six count 1..6 for the progress chrome.
// ─────────────────────────────────────────────────────────────

type StepId = 'welcome' | 'name' | 'intent' | 'packs' | 'rhythm' | 'likeness' | 'ready';
const STEPS: StepId[] = ['welcome', 'name', 'intent', 'packs', 'rhythm', 'likeness', 'ready'];
const PROGRESS_TOTAL = 6;

type IntentOption = { id: string; glyph: string; key: TranslationKey };
const INTENTS: IntentOption[] = [
  { id: 'daily',    glyph: 'D', key: 'onboarding.intent.option.daily' },
  { id: 'trip',     glyph: 'T', key: 'onboarding.intent.option.trip' },
  { id: 'feelings', glyph: 'F', key: 'onboarding.intent.option.feelings' },
  { id: 'chapter',  glyph: 'M', key: 'onboarding.intent.option.chapter' },
  { id: 'writer',   glyph: 'W', key: 'onboarding.intent.option.writer' },
  { id: 'kids',     glyph: 'K', key: 'onboarding.intent.option.kids' },
];

// Each intent maps to a single backend `journaling_goal`. We keep the
// multi-select UI but only the first selected intent is persisted.
// TODO: send intents[] once the backend exposes a column.
const INTENT_TO_GOAL: Record<string, JournalingGoal> = {
  daily: 'memory',
  trip: 'memory',
  feelings: 'mental_health',
  chapter: 'memory',
  writer: 'creativity',
  kids: 'memory',
};

type PackOption = {
  id: string;
  glyph: string;
  title: string;
  count: number;
  descKey: TranslationKey;
};
const PACKS: PackOption[] = [
  { id: 'reflection',  glyph: 'R', title: 'Reflection',  count: 7, descKey: 'onboarding.packs.pack.reflection.desc' },
  { id: 'gratitude',   glyph: 'G', title: 'Gratitude',   count: 5, descKey: 'onboarding.packs.pack.gratitude.desc' },
  { id: 'about-me',    glyph: 'A', title: 'About me',    count: 5, descKey: 'onboarding.packs.pack.aboutMe.desc' },
  { id: 'mindfulness', glyph: 'M', title: 'Mindfulness', count: 4, descKey: 'onboarding.packs.pack.mindfulness.desc' },
  { id: 'creativity',  glyph: 'C', title: 'Creativity',  count: 7, descKey: 'onboarding.packs.pack.creativity.desc' },
];

type RhythmBand = 'morning' | 'midday' | 'evening';
const RHYTHM_DEFAULT_HOUR: Record<RhythmBand, number> = {
  morning: 9,
  midday: 13,
  evening: 21,
};

// ─────────────────────────────────────────────────────────────
// Shared chrome — progress bar, primary CTA, headings.
// ─────────────────────────────────────────────────────────────

function OnbProgress({
  step,
  showBack,
  onBack,
}: {
  step: number; // 1..PROGRESS_TOTAL; 0 to hide all ticks (use showBack=false too)
  showBack: boolean;
  onBack: () => void;
}) {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  return (
    <View style={styles.progressRow}>
      <View style={styles.progressSide}>
        {showBack ? (
          <TouchableOpacity onPress={onBack} hitSlop={12} style={styles.backHit}>
            <IconSymbol name="chevron.left" size={20} color={c.text} />
          </TouchableOpacity>
        ) : null}
      </View>
      <View style={styles.progressTicks}>
        {Array.from({ length: PROGRESS_TOTAL }).map((_, i) => (
          <View
            key={i}
            style={[
              styles.tick,
              { backgroundColor: i < step ? c.accent : c.border },
            ]}
          />
        ))}
      </View>
      <Text style={[styles.progressCount, { color: c.muted }]}>
        {String(step).padStart(2, '0')}/{String(PROGRESS_TOTAL).padStart(2, '0')}
      </Text>
    </View>
  );
}

function OnbHeading({
  eyebrow,
  title,
  body,
}: {
  eyebrow?: string;
  title: string;
  body?: string;
}) {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  return (
    <View style={styles.heading}>
      {eyebrow ? (
        <Eyebrow color={c.accentDark} style={{ marginBottom: 10 } as ViewStyle}>
          {eyebrow}
        </Eyebrow>
      ) : null}
      <Text
        style={[
          styles.headingTitle,
          { color: c.text, fontFamily: Type.serif },
        ]}
      >
        {title}
      </Text>
      {body ? (
        <Text
          style={[
            styles.headingBody,
            {
              color: c.textSoft,
              fontFamily: Type.italic,
              fontStyle: 'italic',
            },
          ]}
        >
          {body}
        </Text>
      ) : null}
    </View>
  );
}

function OnbPrimary({
  label,
  subtle,
  onPress,
  disabled,
  busy,
  onSubtlePress,
}: {
  label: string;
  subtle?: string;
  onPress: () => void;
  disabled?: boolean;
  busy?: boolean;
  onSubtlePress?: () => void;
}) {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const off = !!disabled || !!busy;
  return (
    <View style={[styles.primaryWrap, { backgroundColor: c.background }]}>
      <Pressable
        onPress={onPress}
        disabled={off}
        style={({ pressed }) => [
          styles.primaryBtn,
          {
            backgroundColor: off ? c.border : c.text,
            opacity: pressed && !off ? 0.92 : 1,
          },
        ]}
      >
        {busy ? (
          <ActivityIndicator color={c.background} />
        ) : (
          <>
            <Text
              style={[
                styles.primaryLabel,
                { color: off ? c.muted : c.background },
              ]}
            >
              {label}
            </Text>
            {!off ? (
              <IconSymbol name="arrow.right" size={15} color={c.background} />
            ) : null}
          </>
        )}
      </Pressable>
      {subtle ? (
        <Pressable onPress={onSubtlePress} disabled={!onSubtlePress}>
          <Text
            style={[
              styles.primarySubtle,
              {
                color: c.textSoft,
                textDecorationLine: onSubtlePress ? 'underline' : 'none',
              },
            ]}
          >
            {subtle}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// 01 · Welcome — editorial hero, book cover with ribbon.
// ─────────────────────────────────────────────────────────────

function MiniBookCover({ scale = 1 }: { scale?: number }) {
  const w = 130 * scale;
  const h = 180 * scale;
  return (
    <View style={{ width: w, height: h + 14 }}>
      <View
        style={[
          styles.book,
          {
            width: w,
            height: h,
            paddingHorizontal: 18 * scale,
            paddingTop: 22 * scale,
            paddingBottom: 18 * scale,
            paddingLeft: 24 * scale,
          },
        ]}
      >
        <View
          style={[
            styles.bookHairline,
            { top: 14 * scale, left: 26 * scale, right: 14 * scale },
          ]}
        />
        <View
          style={[
            styles.bookHairline,
            { bottom: 14 * scale, left: 26 * scale, right: 14 * scale },
          ]}
        />
        <Text
          style={{
            fontFamily: Type.mono,
            fontSize: 8 * scale,
            letterSpacing: 1.6,
            color: '#FAF6F0',
            opacity: 0.7,
          }}
        >
          VOLUME · ONE
        </Text>
        <View style={{ flex: 1 }} />
        <Text
          style={{
            fontFamily: Type.serif,
            fontSize: 15 * scale,
            fontWeight: '500',
            color: '#FAF6F0',
            letterSpacing: -0.2,
            marginBottom: 6 * scale,
          }}
        >
          Book My Life
        </Text>
        <Text
          style={{
            fontFamily: Type.italic,
            fontStyle: 'italic',
            fontSize: 11 * scale,
            color: '#FAF6F0',
            opacity: 0.85,
          }}
        >
          a memoir in progress
        </Text>
      </View>
      <View
        style={{
          position: 'absolute',
          top: -18 * scale,
          right: 22 * scale,
        }}
      >
        <Ribbon width={12 * scale} length={56 * scale} color="#2C2421" />
      </View>
    </View>
  );
}

function WelcomeStep({
  onBegin,
  busy,
}: {
  onBegin: () => void;
  busy: boolean;
}) {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const { t } = useTranslation();
  const year = new Date().getFullYear();
  return (
    <View style={[styles.flex, { backgroundColor: c.background }]}>
      <View style={styles.welcomeMark}>
        <RibbonMark
          size={22}
          inkColor={c.text}
          accentColor={c.accent}
          backgroundColor={c.background}
        />
      </View>
      <View style={styles.welcomeStage}>
        <MiniBookCover scale={1.05} />
        <View style={{ height: 38 }} />
        <Eyebrow color={c.accentDark} style={{ marginBottom: 12 } as ViewStyle}>
          {t('onboarding.welcome.eyebrow', { year })}
        </Eyebrow>
        <Text
          style={[
            styles.welcomeHeading,
            { color: c.text, fontFamily: Type.italic, fontStyle: 'italic' },
          ]}
        >
          {t('onboarding.welcome.headingA')}
          {'\n'}
          {t('onboarding.welcome.headingB')}
        </Text>
        <Text
          style={[
            styles.welcomeBody,
            { color: c.textSoft, fontFamily: Type.serif },
          ]}
        >
          {t('onboarding.welcome.body')}
        </Text>
      </View>
      <View style={[styles.primaryWrap, { backgroundColor: c.background }]}>
        <Pressable
          onPress={onBegin}
          disabled={busy}
          style={({ pressed }) => [
            styles.primaryBtn,
            {
              backgroundColor: c.text,
              opacity: pressed && !busy ? 0.92 : 1,
            },
          ]}
        >
          <Text style={[styles.primaryLabel, { color: c.background }]}>
            {t('onboarding.welcome.begin')}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// 02 · Name — text field + book-cover live preview.
// ─────────────────────────────────────────────────────────────

const NAME_MAX = 60;

function NameStep({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const { t } = useTranslation();
  const year = new Date().getFullYear();
  const displayName = value.trim() || t('onboarding.name.previewBlank');
  return (
    <View style={styles.bodyPad}>
      <OnbHeading
        eyebrow={t('onboarding.name.eyebrow')}
        title={t('onboarding.name.title')}
        body={t('onboarding.name.body')}
      />
      <View style={{ paddingHorizontal: 20, paddingTop: 20 }}>
        <Eyebrow style={{ marginBottom: 8 } as ViewStyle}>
          {t('onboarding.name.label')}
        </Eyebrow>
        <TextInput
          style={[
            styles.nameInput,
            {
              backgroundColor: c.paper,
              borderColor: c.accent,
              color: c.text,
              fontFamily: Type.serif,
            },
          ]}
          value={value}
          onChangeText={(v) => onChange(v.slice(0, NAME_MAX))}
          placeholder={t('onboarding.profile.namePlaceholder')}
          placeholderTextColor={c.muted}
          autoFocus
          maxLength={NAME_MAX}
          returnKeyType="done"
        />
        <Text
          style={{
            marginTop: 10,
            fontFamily: Type.mono,
            fontSize: 10,
            color: c.muted,
            letterSpacing: 1.2,
          }}
        >
          {value.length} / {NAME_MAX}
        </Text>
      </View>

      {/* Live preview */}
      <View style={{ paddingHorizontal: 20, paddingTop: 28 }}>
        <Eyebrow color={c.accentDark} style={{ marginBottom: 10 } as ViewStyle}>
          {t('onboarding.name.previewEyebrow')}
        </Eyebrow>
        <View
          style={[
            styles.namePreview,
            { backgroundColor: c.paper, borderColor: c.border },
          ]}
        >
          <View
            style={{ position: 'absolute', top: 0, right: 28 }}
            pointerEvents="none"
          >
            <Ribbon
              width={10}
              length={32}
              color={c.accent}
              backgroundColor={c.paper}
            />
          </View>
          <Eyebrow color={c.muted} style={{ marginBottom: 14 } as ViewStyle}>
            {t('onboarding.name.previewVolume', { year })}
          </Eyebrow>
          <Text
            style={{
              fontFamily: Type.serif,
              fontSize: 22,
              fontWeight: '500',
              color: c.text,
              textAlign: 'center',
              letterSpacing: -0.2,
            }}
          >
            {t('onboarding.name.previewTitle')}
          </Text>
          <Text
            style={{
              marginTop: 12,
              fontFamily: Type.italic,
              fontStyle: 'italic',
              fontSize: 16,
              color: c.textSoft,
              textAlign: 'center',
            }}
          >
            {t('onboarding.name.previewBy', { name: displayName })}
          </Text>
          <View
            style={{
              width: 36,
              height: 1,
              backgroundColor: c.border,
              alignSelf: 'center',
              marginTop: 16,
            }}
          />
        </View>
        <Text
          style={{
            marginTop: 12,
            fontFamily: Type.sans,
            fontSize: 12,
            color: c.textSoft,
            textAlign: 'center',
            fontStyle: 'italic',
          }}
        >
          {t('onboarding.name.previewCaption')}
        </Text>
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// 03 · Intent — multi-select chip rows.
// ─────────────────────────────────────────────────────────────

function IntentStep({
  selected,
  onToggle,
}: {
  selected: Set<string>;
  onToggle: (id: string) => void;
}) {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const { t } = useTranslation();
  return (
    <View style={styles.bodyPad}>
      <OnbHeading
        eyebrow={t('onboarding.intent.eyebrow')}
        title={t('onboarding.intent.title')}
        body={t('onboarding.intent.body')}
      />
      <View style={{ paddingHorizontal: 20, paddingTop: 18, gap: 10 }}>
        {INTENTS.map((it) => {
          const on = selected.has(it.id);
          return (
            <Pressable
              key={it.id}
              onPress={() => onToggle(it.id)}
              style={({ pressed }) => [
                styles.intentChip,
                {
                  backgroundColor: on ? c.text : c.paper,
                  borderColor: on ? c.text : c.border,
                  opacity: pressed ? 0.92 : 1,
                },
              ]}
            >
              <View
                style={[
                  styles.intentGlyphWrap,
                  {
                    backgroundColor: on
                      ? 'rgba(250,246,240,0.1)'
                      : c.background,
                  },
                ]}
              >
                <Text
                  style={{
                    fontFamily: Type.italic,
                    fontStyle: 'italic',
                    fontSize: 18,
                    color: c.accent,
                    fontWeight: '500',
                  }}
                >
                  {it.glyph}
                </Text>
              </View>
              <Text
                style={{
                  flex: 1,
                  fontFamily: Type.serif,
                  fontSize: 14,
                  fontWeight: '600',
                  color: on ? c.background : c.text,
                  lineHeight: 18,
                }}
              >
                {t(it.key)}
              </Text>
              {on ? (
                <View style={[styles.intentTick, { backgroundColor: c.accent }]}>
                  <IconSymbol name="checkmark" size={12} color={c.background} />
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// 04 · Prompt packs — featured taste card + multi-select rows.
// ─────────────────────────────────────────────────────────────

function PacksStep({
  selected,
  onToggle,
}: {
  selected: Set<string>;
  onToggle: (id: string) => void;
}) {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const { t } = useTranslation();
  return (
    <View style={styles.bodyPad}>
      <OnbHeading
        eyebrow={t('onboarding.packs.eyebrow')}
        title={t('onboarding.packs.title')}
        body={t('onboarding.packs.body')}
      />
      <View style={{ paddingHorizontal: 20, paddingTop: 14 }}>
        <View style={[styles.featuredCard, { backgroundColor: c.text }]}>
          <View
            style={{ position: 'absolute', top: 0, right: 24 }}
            pointerEvents="none"
          >
            <Ribbon
              width={10}
              length={36}
              color={c.accent}
              backgroundColor={c.text}
            />
          </View>
          <Eyebrow
            color="rgba(250,246,240,0.6)"
            style={{ marginBottom: 10 } as ViewStyle}
          >
            {t('onboarding.packs.featuredEyebrow')}
          </Eyebrow>
          <Text
            style={{
              fontFamily: Type.italic,
              fontStyle: 'italic',
              fontSize: 19,
              lineHeight: 24,
              color: c.background,
            }}
          >
            {t('onboarding.packs.featuredQuestion')}
          </Text>
        </View>
      </View>
      <View style={{ paddingHorizontal: 20, paddingTop: 20, gap: 8 }}>
        {PACKS.map((p) => {
          const on = selected.has(p.id);
          return (
            <Pressable
              key={p.id}
              onPress={() => onToggle(p.id)}
              style={({ pressed }) => [
                styles.packRow,
                {
                  backgroundColor: c.paper,
                  borderColor: on ? c.accent : c.border,
                  opacity: pressed ? 0.92 : 1,
                },
              ]}
            >
              <View
                style={[styles.packGlyphWrap, { backgroundColor: c.background }]}
              >
                <Text
                  style={{
                    fontFamily: Type.italic,
                    fontStyle: 'italic',
                    fontSize: 18,
                    color: c.accent,
                    fontWeight: '500',
                  }}
                >
                  {p.glyph}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontFamily: Type.serif,
                    fontSize: 15,
                    fontWeight: '600',
                    color: c.text,
                  }}
                >
                  {p.title}
                </Text>
                <Text
                  style={{
                    fontFamily: Type.sans,
                    fontSize: 12,
                    color: c.textSoft,
                    marginTop: 2,
                  }}
                >
                  {t('onboarding.packs.meta', {
                    count: p.count,
                    desc: t(p.descKey),
                  })}
                </Text>
              </View>
              <View
                style={[
                  styles.packTick,
                  {
                    borderColor: on ? c.accent : c.border,
                    backgroundColor: on ? c.accent : 'transparent',
                  },
                ]}
              >
                {on ? (
                  <IconSymbol
                    name="checkmark"
                    size={12}
                    color={c.background}
                  />
                ) : null}
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// 05 · Rhythm — time-of-day tiles + hour stepper + day pills.
// ─────────────────────────────────────────────────────────────

const DAYS: { key: string; label: string }[] = [
  { key: 'mon', label: 'M' },
  { key: 'tue', label: 'T' },
  { key: 'wed', label: 'W' },
  { key: 'thu', label: 'T' },
  { key: 'fri', label: 'F' },
  { key: 'sat', label: 'S' },
  { key: 'sun', label: 'S' },
];

function RhythmTile({
  glyph,
  label,
  sub,
  selected,
  onPress,
}: {
  glyph: string;
  label: string;
  sub: string;
  selected: boolean;
  onPress: () => void;
}) {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.rhythmTile,
        {
          backgroundColor: c.paper,
          borderColor: selected ? c.accent : c.border,
          opacity: pressed ? 0.92 : 1,
        },
      ]}
    >
      <Text
        style={{
          fontFamily: Type.italic,
          fontStyle: 'italic',
          fontSize: 28,
          color: selected ? c.accent : c.textSoft,
          fontWeight: '500',
        }}
      >
        {glyph}
      </Text>
      <Text
        style={{
          fontFamily: Type.serif,
          fontSize: 13,
          fontWeight: '600',
          color: c.text,
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          fontFamily: Type.mono,
          fontSize: 9,
          color: c.muted,
          letterSpacing: 0.9,
        }}
      >
        {sub}
      </Text>
    </Pressable>
  );
}

function RhythmStep({
  band,
  hour,
  days,
  onBand,
  onHour,
  onToggleDay,
}: {
  band: RhythmBand;
  hour: number;
  days: Set<string>;
  onBand: (b: RhythmBand) => void;
  onHour: (h: number) => void;
  onToggleDay: (d: string) => void;
}) {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const { t } = useTranslation();
  const bandLabel =
    band === 'morning'
      ? t('onboarding.rhythm.everyMorning')
      : band === 'midday'
      ? t('onboarding.rhythm.everyMidday')
      : t('onboarding.rhythm.everyEvening');
  return (
    <View style={styles.bodyPad}>
      <OnbHeading
        eyebrow={t('onboarding.rhythm.eyebrow')}
        title={t('onboarding.rhythm.title')}
        body={t('onboarding.rhythm.body')}
      />
      <View
        style={{
          paddingHorizontal: 20,
          paddingTop: 18,
          flexDirection: 'row',
          gap: 10,
        }}
      >
        <RhythmTile
          glyph="☉"
          label={t('onboarding.rhythm.morning')}
          sub="06—10"
          selected={band === 'morning'}
          onPress={() => onBand('morning')}
        />
        <RhythmTile
          glyph="◐"
          label={t('onboarding.rhythm.midday')}
          sub="11—15"
          selected={band === 'midday'}
          onPress={() => onBand('midday')}
        />
        <RhythmTile
          glyph="☾"
          label={t('onboarding.rhythm.evening')}
          sub="20—23"
          selected={band === 'evening'}
          onPress={() => onBand('evening')}
        />
      </View>

      {/* Hour stepper */}
      <View style={{ paddingHorizontal: 20, paddingTop: 28 }}>
        <Eyebrow style={{ marginBottom: 12 } as ViewStyle}>
          {t('onboarding.rhythm.remindAt')}
        </Eyebrow>
        <View
          style={[
            styles.hourCard,
            { backgroundColor: c.paper, borderColor: c.border },
          ]}
        >
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
              <Pressable
                onPress={() => onHour((hour + 23) % 24)}
                hitSlop={10}
                style={({ pressed }) => [
                  styles.hourStep,
                  { opacity: pressed ? 0.6 : 1 },
                ]}
              >
                <Text style={{ color: c.muted, fontSize: 18 }}>−</Text>
              </Pressable>
              <Text
                style={{
                  fontFamily: Type.serif,
                  fontSize: 38,
                  fontWeight: '500',
                  color: c.text,
                  letterSpacing: -0.6,
                  lineHeight: 42,
                }}
              >
                {String(hour).padStart(2, '0')}
                <Text style={{ color: c.muted }}>:00</Text>
              </Text>
              <Pressable
                onPress={() => onHour((hour + 1) % 24)}
                hitSlop={10}
                style={({ pressed }) => [
                  styles.hourStep,
                  { opacity: pressed ? 0.6 : 1 },
                ]}
              >
                <Text style={{ color: c.muted, fontSize: 18 }}>+</Text>
              </Pressable>
            </View>
            <Text
              style={{
                fontFamily: Type.mono,
                fontSize: 10,
                color: c.muted,
                letterSpacing: 1.4,
                marginTop: 6,
              }}
            >
              {bandLabel}
            </Text>
          </View>
          <View
            style={[
              styles.bellPill,
              { backgroundColor: c.background, borderColor: c.border },
            ]}
          >
            <IconSymbol name="bell.fill" size={13} color={c.accent} />
            <Text
              style={{
                fontFamily: Type.mono,
                fontSize: 11,
                fontWeight: '600',
                color: c.text,
                letterSpacing: 0.9,
              }}
            >
              {t('onboarding.rhythm.notifOn')}
            </Text>
          </View>
        </View>
      </View>

      {/* Day pills (local-only) */}
      <View style={{ paddingHorizontal: 20, paddingTop: 20 }}>
        <Eyebrow style={{ marginBottom: 10 } as ViewStyle}>
          {t('onboarding.rhythm.onTheseDays')}
        </Eyebrow>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {DAYS.map((d, i) => {
            const on = days.has(d.key);
            return (
              <Pressable
                key={`${d.key}-${i}`}
                onPress={() => onToggleDay(d.key)}
                style={({ pressed }) => [
                  styles.dayPill,
                  {
                    backgroundColor: on ? c.text : c.paper,
                    borderColor: on ? c.text : c.border,
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}
              >
                <Text
                  style={{
                    fontFamily: Type.sans,
                    fontWeight: '600',
                    fontSize: 13,
                    color: on ? c.background : c.muted,
                  }}
                >
                  {d.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// 06 · Likeness — three photo slots + guidance card.
// ─────────────────────────────────────────────────────────────

function PhotoSlot({
  uri,
  index,
  total,
  onPress,
  busy,
}: {
  uri: string | null;
  index: number;
  total: number;
  onPress: () => void;
  busy: boolean;
}) {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const { t } = useTranslation();
  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      style={({ pressed }) => [
        styles.photoSlot,
        {
          backgroundColor: uri ? '#C4886B' : c.paper,
          borderColor: c.border,
          borderStyle: uri ? 'solid' : 'dashed',
          opacity: pressed ? 0.9 : 1,
        },
      ]}
    >
      {uri ? (
        <>
          <Image source={{ uri }} style={styles.photoSlotImg} />
          <View
            style={[styles.photoSlotBadge, { backgroundColor: 'rgba(44,36,33,0.7)' }]}
          >
            <Text
              style={{
                fontFamily: Type.mono,
                fontSize: 8,
                letterSpacing: 1.1,
                color: c.background,
              }}
            >
              {t('onboarding.likeness.slotCounter', {
                current: index + 1,
                total,
              })}
            </Text>
          </View>
        </>
      ) : busy ? (
        <ActivityIndicator color={c.muted} />
      ) : (
        <IconSymbol name="plus" size={22} color={c.muted} />
      )}
    </Pressable>
  );
}

function LikenessStep({
  photos,
  pickIndex,
  busyIndex,
}: {
  photos: (string | null)[];
  pickIndex: (i: number) => void;
  busyIndex: number | null;
}) {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const { t } = useTranslation();
  return (
    <View style={styles.bodyPad}>
      <OnbHeading
        eyebrow={t('onboarding.likeness.eyebrow')}
        title={t('onboarding.likeness.title')}
        body={t('onboarding.likeness.body')}
      />
      <View
        style={{
          paddingHorizontal: 20,
          paddingTop: 20,
          flexDirection: 'row',
          gap: 10,
        }}
      >
        {photos.map((uri, i) => (
          <View key={i} style={{ flex: 1 }}>
            <PhotoSlot
              uri={uri}
              index={i}
              total={photos.length}
              onPress={() => pickIndex(i)}
              busy={busyIndex === i}
            />
          </View>
        ))}
      </View>

      <View style={{ paddingHorizontal: 20, paddingTop: 20 }}>
        <View
          style={[
            styles.guideCard,
            { backgroundColor: c.paper, borderColor: c.border },
          ]}
        >
          <Eyebrow color={c.accentDark} style={{ marginBottom: 10 } as ViewStyle}>
            {t('onboarding.likeness.guide.title')}
          </Eyebrow>
          {(
            [
              'onboarding.likeness.guide.front',
              'onboarding.likeness.guide.range',
              'onboarding.likeness.guide.refresh',
            ] as TranslationKey[]
          ).map((k) => (
            <View
              key={k}
              style={{
                flexDirection: 'row',
                gap: 10,
                paddingVertical: 6,
                alignItems: 'flex-start',
              }}
            >
              <View
                style={{
                  marginTop: 6,
                  width: 5,
                  height: 5,
                  borderRadius: 3,
                  backgroundColor: c.accent,
                }}
              />
              <Text
                style={{
                  flex: 1,
                  fontFamily: Type.serif,
                  fontSize: 13,
                  color: c.text,
                  lineHeight: 18,
                }}
              >
                {t(k)}
              </Text>
            </View>
          ))}
        </View>
      </View>

      <View
        style={{
          paddingHorizontal: 20,
          paddingTop: 14,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          justifyContent: 'center',
        }}
      >
        <IconSymbol name="lock.fill" size={11} color={c.muted} />
        <Text
          style={{
            fontFamily: Type.mono,
            fontSize: 9,
            letterSpacing: 1.3,
            color: c.muted,
          }}
        >
          {t('onboarding.likeness.encrypted')}
        </Text>
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// 07 · Ready — celebratory final screen.
// ─────────────────────────────────────────────────────────────

function ReadyStep({
  name,
  packCount,
  firstPackTitle,
  remindHour,
  photoCount,
  onBegin,
  onToday,
  busy,
}: {
  name: string;
  packCount: number;
  firstPackTitle: string | null;
  remindHour: number;
  photoCount: number;
  onBegin: () => void;
  onToday: () => void;
  busy: boolean;
}) {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const { t } = useTranslation();

  const packBadge =
    packCount <= 0
      ? null
      : {
          label:
            packCount === 1
              ? t('onboarding.ready.badge.packs.one')
              : t('onboarding.ready.badge.packs', { count: packCount }),
          sub:
            packCount === 1
              ? t('onboarding.ready.badge.packsSubOne', {
                  first: firstPackTitle ?? '',
                })
              : t('onboarding.ready.badge.packsSubMany', {
                  first: firstPackTitle ?? '',
                  rest: packCount - 1,
                }),
        };
  const photoBadge =
    photoCount <= 0
      ? null
      : {
          label:
            photoCount === 1
              ? t('onboarding.ready.badge.photo', { count: 1 })
              : t('onboarding.ready.badge.photos', { count: photoCount }),
          sub: t('onboarding.ready.badge.photosSub'),
        };
  const reminderBadge = {
    label: `${String(remindHour).padStart(2, '0')}:00`,
    sub: t('onboarding.ready.badge.reminder'),
  };

  return (
    <View style={[styles.flex, { backgroundColor: c.background }]}>
      <View style={{ paddingHorizontal: 20, paddingTop: 12, alignItems: 'center' }}>
        <Eyebrow color={c.accentDark} style={{ marginBottom: 16 } as ViewStyle}>
          {name.trim()
            ? t('onboarding.ready.eyebrowNamed', { name: name.trim() })
            : t('onboarding.ready.eyebrow')}
        </Eyebrow>
        <Text
          style={[
            styles.readyTitle,
            { color: c.text, fontFamily: Type.italic, fontStyle: 'italic' },
          ]}
        >
          {t('onboarding.ready.titleA')}
          {'\n'}
          {t('onboarding.ready.titleB')}
        </Text>
      </View>

      <View style={styles.readyStage}>
        <View style={{ position: 'relative' }}>
          <MiniBookCover scale={1.0} />
          {packBadge ? (
            <View style={[styles.readyBadge, { top: -8, left: -64, backgroundColor: c.paper, borderColor: c.border }]}>
              <View style={[styles.readyBadgeDot, { backgroundColor: c.accent }]} />
              <View>
                <Text style={[styles.readyBadgeLabel, { color: c.text }]}>{packBadge.label}</Text>
                <Text style={[styles.readyBadgeSub, { color: c.muted }]}>{packBadge.sub}</Text>
              </View>
            </View>
          ) : null}
          <View
            style={[
              styles.readyBadge,
              { top: 64, right: -82, backgroundColor: c.paper, borderColor: c.border },
            ]}
          >
            <View style={[styles.readyBadgeDot, { backgroundColor: c.accent }]} />
            <View>
              <Text style={[styles.readyBadgeLabel, { color: c.text }]}>{reminderBadge.label}</Text>
              <Text style={[styles.readyBadgeSub, { color: c.muted }]}>{reminderBadge.sub}</Text>
            </View>
          </View>
          {photoBadge ? (
            <View
              style={[
                styles.readyBadge,
                { bottom: -10, left: -56, backgroundColor: c.paper, borderColor: c.border },
              ]}
            >
              <View style={[styles.readyBadgeDot, { backgroundColor: c.accent }]} />
              <View>
                <Text style={[styles.readyBadgeLabel, { color: c.text }]}>{photoBadge.label}</Text>
                <Text style={[styles.readyBadgeSub, { color: c.muted }]}>{photoBadge.sub}</Text>
              </View>
            </View>
          ) : null}
        </View>
      </View>

      <View style={{ paddingHorizontal: 20, paddingBottom: 12 }}>
        <View style={[styles.firstPromptCard, { backgroundColor: c.paper, borderColor: c.border }]}>
          <View style={{ position: 'absolute', top: -4, right: 22 }} pointerEvents="none">
            <Ribbon width={11} length={36} color={c.accent} backgroundColor={c.paper} />
          </View>
          <Eyebrow color={c.accentDark} style={{ marginBottom: 8 } as ViewStyle}>
            {t('onboarding.ready.firstPrompt')}
          </Eyebrow>
          <Text
            style={{
              fontFamily: Type.italic,
              fontStyle: 'italic',
              fontSize: 18,
              lineHeight: 22,
              color: c.text,
            }}
          >
            {t('onboarding.ready.firstPromptText')}
          </Text>
        </View>
      </View>

      <View style={[styles.primaryWrap, { backgroundColor: c.background }]}>
        <Pressable
          onPress={onBegin}
          disabled={busy}
          style={({ pressed }) => [
            styles.primaryBtn,
            {
              backgroundColor: c.text,
              opacity: pressed && !busy ? 0.92 : 1,
            },
          ]}
        >
          {busy ? (
            <ActivityIndicator color={c.background} />
          ) : (
            <>
              <Text style={[styles.primaryLabel, { color: c.background }]}>
                {t('onboarding.ready.beginWriting')}
              </Text>
              <IconSymbol name="arrow.right" size={15} color={c.background} />
            </>
          )}
        </Pressable>
        <Pressable onPress={onToday} disabled={busy}>
          <Text
            style={[
              styles.primarySubtle,
              { color: c.text, fontWeight: '500' },
            ]}
          >
            {t('onboarding.ready.takeMeToday')}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// Top-level controller
// ─────────────────────────────────────────────────────────────

export default function OnboardingScreen() {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const router = useRouter();
  const { user } = useUser();
  const { t } = useTranslation();

  const [stepIndex, setStepIndex] = useState(0);
  const stepId = STEPS[stepIndex];

  // Step 02 · Name
  const [displayName, setDisplayName] = useState(user?.fullName ?? '');

  // Step 03 · Intent (multi-select; first ⇒ journaling_goal)
  const [intents, setIntents] = useState<Set<string>>(
    () => new Set(['daily', 'trip', 'chapter']),
  );
  const toggleIntent = (id: string) =>
    setIntents((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // Step 04 · Packs (multi-select; local-only)
  const [packs, setPacks] = useState<Set<string>>(
    () => new Set(['reflection', 'gratitude', 'about-me']),
  );
  const togglePack = (id: string) =>
    setPacks((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // Step 05 · Rhythm (band + hour; days local-only)
  const [rhythmBand, setRhythmBand] = useState<RhythmBand>('evening');
  const [hour, setHour] = useState<number>(RHYTHM_DEFAULT_HOUR.evening);
  const onPickBand = (b: RhythmBand) => {
    setRhythmBand(b);
    setHour(RHYTHM_DEFAULT_HOUR[b]);
  };
  const [days, setDays] = useState<Set<string>>(
    () => new Set(['mon', 'tue', 'wed', 'thu', 'fri', 'sun']),
  );
  const toggleDay = (k: string) =>
    setDays((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });

  // Step 06 · Likeness (3 slots; only slot 0 uploaded)
  const [photos, setPhotos] = useState<(string | null)[]>([null, null, null]);
  const [photoKey, setPhotoKey] = useState<string | null>(null);
  const [busyPhoto, setBusyPhoto] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pickPhoto = async (i: number) => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setError(t('editor.error.photoPermission'));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [3, 4],
      quality: 0.85,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    setError(null);
    setPhotos((prev) => prev.map((p, idx) => (idx === i ? asset.uri : p)));
    // Only the first slot is persisted to the backend (single
    // face_photo_url column). Slots 1 and 2 stay local until the
    // backend grows multi-photo support.
    if (i === 0) {
      setBusyPhoto(i);
      try {
        const uploaded = await uploadPhoto(
          asset.uri,
          asset.mimeType ?? 'image/jpeg',
          'face-photo',
        );
        setPhotos((prev) => prev.map((p, idx) => (idx === i ? uploaded.public_url : p)));
        setPhotoKey(uploaded.storage_key);
      } catch (e: any) {
        setError(e?.message ?? t('editor.error.photoUploadFailed'));
        setPhotos((prev) => prev.map((p, idx) => (idx === i ? null : p)));
      } finally {
        setBusyPhoto(null);
      }
    }
  };

  const finish = useMutation({
    mutationFn: async () => {
      // Map the first selected intent to the backend's single
      // journaling_goal slot. Multi-intent persists locally only.
      const firstIntent = INTENTS.find((it) => intents.has(it.id));
      const goal: JournalingGoal | undefined = firstIntent
        ? INTENT_TO_GOAL[firstIntent.id]
        : undefined;
      await updateMe({
        display_name: displayName.trim() || undefined,
        face_photo_url: photoKey ?? undefined,
        notif_hour: hour,
        journaling_goal: goal,
      });
    },
    onSuccess: () => router.replace('/(tabs)'),
    onError: (e: any) => setError(e?.message ?? t('onboarding.error.save')),
  });

  const goNext = () => {
    setError(null);
    if (stepIndex < STEPS.length - 1) {
      setStepIndex((i) => i + 1);
    }
  };
  const goBack = () => {
    setError(null);
    if (stepIndex > 0) setStepIndex((i) => i - 1);
  };

  // Per-step progress mapping (welcome = 0, name = 1, … ready = 6)
  const progressStep = stepId === 'welcome' ? 0 : stepIndex; // stepIndex 1..6
  const showProgress = stepId !== 'welcome' && stepId !== 'ready';
  const showBack = stepId !== 'welcome' && stepId !== 'ready';

  const photoCount = photos.filter(Boolean).length;
  const firstPackTitle = useMemo(() => {
    const first = PACKS.find((p) => packs.has(p.id));
    return first ? first.title : null;
  }, [packs]);

  // ─────── Render ───────
  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: c.background }]}
      edges={['top', 'bottom']}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        {showProgress ? (
          <OnbProgress step={progressStep} showBack={showBack} onBack={goBack} />
        ) : stepId === 'ready' ? (
          <OnbProgress step={PROGRESS_TOTAL} showBack={false} onBack={goBack} />
        ) : null}

        {stepId === 'welcome' ? (
          <WelcomeStep onBegin={goNext} busy={false} />
        ) : stepId === 'ready' ? (
          <ReadyStep
            name={displayName}
            packCount={packs.size}
            firstPackTitle={firstPackTitle}
            remindHour={hour}
            photoCount={photoCount}
            onBegin={() => finish.mutate()}
            onToday={() => finish.mutate()}
            busy={finish.isPending}
          />
        ) : (
          <>
            <ScrollView
              style={styles.flex}
              contentContainerStyle={{ paddingBottom: 24 }}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {stepId === 'name' ? (
                <NameStep value={displayName} onChange={setDisplayName} />
              ) : stepId === 'intent' ? (
                <IntentStep selected={intents} onToggle={toggleIntent} />
              ) : stepId === 'packs' ? (
                <PacksStep selected={packs} onToggle={togglePack} />
              ) : stepId === 'rhythm' ? (
                <RhythmStep
                  band={rhythmBand}
                  hour={hour}
                  days={days}
                  onBand={onPickBand}
                  onHour={setHour}
                  onToggleDay={toggleDay}
                />
              ) : stepId === 'likeness' ? (
                <LikenessStep
                  photos={photos}
                  pickIndex={pickPhoto}
                  busyIndex={busyPhoto}
                />
              ) : null}
              {error ? (
                <Text style={[styles.error, { color: c.danger }]}>{error}</Text>
              ) : null}
            </ScrollView>
            <OnbPrimary
              label={
                stepId === 'likeness'
                  ? photoCount === 0
                    ? t('onboarding.likeness.cta.addThree')
                    : photoCount < 3
                    ? t('onboarding.likeness.cta.addMore', {
                        remaining: 3 - photoCount,
                      })
                    : t('onboarding.likeness.cta.continue')
                  : t('common.continue')
              }
              subtle={
                stepId === 'intent' && intents.size > 0
                  ? t('onboarding.intent.selected', { count: intents.size })
                  : stepId === 'packs'
                  ? t('onboarding.packs.subtle')
                  : stepId === 'likeness' && photoCount < 3
                  ? t('onboarding.likeness.skip')
                  : undefined
              }
              onSubtlePress={
                stepId === 'likeness' && photoCount < 3 ? goNext : undefined
              }
              onPress={() => {
                if (stepId === 'likeness' && photoCount === 0) {
                  goNext();
                  return;
                }
                goNext();
              }}
            />
          </>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  bodyPad: { paddingTop: 4, paddingBottom: 8 },

  // Progress chrome
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 4,
    gap: 14,
  },
  progressSide: { width: 32, alignItems: 'flex-start' },
  backHit: { width: 32, height: 32, alignItems: 'flex-start', justifyContent: 'center' },
  progressTicks: { flex: 1, flexDirection: 'row', gap: 4 },
  tick: { flex: 1, height: 3, borderRadius: 2 },
  progressCount: {
    fontFamily: Type.mono,
    fontSize: 10,
    letterSpacing: 1.4,
    minWidth: 36,
    textAlign: 'right',
  },

  // Heading
  heading: { paddingHorizontal: 20, paddingTop: 22, paddingBottom: 10 },
  headingTitle: {
    fontSize: 28,
    fontWeight: '500',
    lineHeight: 32,
    letterSpacing: -0.4,
  },
  headingBody: {
    marginTop: 10,
    fontSize: 15,
    lineHeight: 22,
  },

  // Primary footer
  primaryWrap: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 22,
    gap: 10,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 15,
    paddingHorizontal: 24,
    borderRadius: 999,
  },
  primaryLabel: {
    fontFamily: Type.sans,
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  primarySubtle: {
    textAlign: 'center',
    paddingVertical: 4,
    fontFamily: Type.sans,
    fontSize: 13,
    fontWeight: '500',
  },

  // Welcome
  welcomeMark: { paddingTop: 14, paddingHorizontal: 20, alignItems: 'center' },
  welcomeStage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  welcomeHeading: {
    fontSize: 38,
    lineHeight: 40,
    textAlign: 'center',
    letterSpacing: -0.7,
    maxWidth: 280,
  },
  welcomeBody: {
    marginTop: 14,
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
    maxWidth: 260,
  },

  // Book cover
  book: {
    backgroundColor: '#B57A5F',
    borderTopLeftRadius: 3,
    borderBottomLeftRadius: 3,
    borderTopRightRadius: 9,
    borderBottomRightRadius: 9,
    overflow: 'hidden',
    ...Platform.select({
      web: {
        boxShadow:
          '0 26px 50px -22px rgba(44,36,33,0.55), inset 5px 0 0 rgba(0,0,0,0.18)',
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 14 },
        shadowOpacity: 0.25,
        shadowRadius: 16,
        elevation: 8,
      },
    }),
  },
  bookHairline: {
    position: 'absolute',
    height: 1,
    backgroundColor: 'rgba(250,246,240,0.4)',
  },

  // Name
  nameInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 17,
    ...Platform.select({
      web: { boxShadow: '0 0 0 3px rgba(196,136,107,0.12)' },
      default: {},
    }),
  },
  namePreview: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 20,
    paddingVertical: 26,
    alignItems: 'center',
    overflow: 'hidden',
  },

  // Intent
  intentChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  intentGlyphWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  intentTick: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Packs
  featuredCard: {
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 16,
    overflow: 'hidden',
  },
  packRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
  },
  packGlyphWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  packTick: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Rhythm
  rhythmTile: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 14,
    paddingTop: 18,
    paddingBottom: 16,
    alignItems: 'center',
    gap: 8,
  },
  hourCard: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  hourStep: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  bellPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderRadius: 999,
  },
  dayPill: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Likeness
  photoSlot: {
    aspectRatio: 3 / 4,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  photoSlotImg: {
    position: 'absolute',
    inset: 0 as unknown as number,
    width: '100%',
    height: '100%',
  },
  photoSlotBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  guideCard: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },

  // Ready
  readyTitle: {
    fontSize: 32,
    lineHeight: 34,
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  readyStage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  readyBadge: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    ...Platform.select({
      web: { boxShadow: '0 6px 16px -10px rgba(44,36,33,0.4)' },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.12,
        shadowRadius: 6,
        elevation: 2,
      },
    }),
  },
  readyBadgeDot: { width: 5, height: 5, borderRadius: 3 },
  readyBadgeLabel: {
    fontFamily: Type.serif,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 14,
  },
  readyBadgeSub: {
    fontFamily: Type.mono,
    fontSize: 8,
    letterSpacing: 1,
    marginTop: 1,
  },
  firstPromptCard: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 16,
    overflow: 'hidden',
    ...Platform.select({
      web: { boxShadow: '0 12px 28px -18px rgba(44,36,33,0.3)' },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 3,
      },
    }),
  },

  // Misc
  error: { marginTop: 12, fontSize: 14, textAlign: 'center' },
});
