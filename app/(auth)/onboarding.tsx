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
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Eyebrow, Ribbon, RibbonMark } from '@/components/ui/Ribbon';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Radii, Spacing, Type } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { uploadPhoto } from '@/utils/entries';
import { useTranslation } from '@/utils/i18n';
import type { TranslationKey } from '@/utils/i18n';
import {
  Gender,
  JournalingGoal,
  LANGUAGES,
  LanguageCode,
  updateMe,
} from '@/utils/users';

type StepId = 'profile' | 'gender' | 'birthday' | 'goal' | 'language';
const STEPS: StepId[] = ['profile', 'gender', 'birthday', 'goal', 'language'];

const GENDERS: { value: Gender; key: TranslationKey }[] = [
  { value: 'male', key: 'onboarding.gender.male' },
  { value: 'female', key: 'onboarding.gender.female' },
  { value: 'non_binary', key: 'onboarding.gender.non_binary' },
  { value: 'prefer_not_to_say', key: 'onboarding.gender.prefer_not_to_say' },
];

const GOALS: { value: JournalingGoal; key: TranslationKey; glyph: string }[] = [
  { value: 'self_reflection', key: 'onboarding.goal.self_reflection', glyph: 'R' },
  { value: 'mental_health',   key: 'onboarding.goal.mental_health',   glyph: 'M' },
  { value: 'memory',          key: 'onboarding.goal.memory',          glyph: 'K' },
  { value: 'creativity',      key: 'onboarding.goal.creativity',      glyph: 'C' },
  { value: 'other',           key: 'onboarding.goal.other',           glyph: '+' },
];

const MONTHS_ABBR = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

function daysInMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
}

function clampDay(year: number, monthIndex: number, day: number): number {
  return Math.min(day, daysInMonth(year, monthIndex));
}

export default function OnboardingScreen() {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const router = useRouter();
  const { user } = useUser();
  const { t } = useTranslation();

  const [stepIndex, setStepIndex] = useState(0);
  const [displayName, setDisplayName] = useState(user?.fullName ?? '');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoKey, setPhotoKey] = useState<string | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [gender, setGender] = useState<Gender | null>(null);
  const today = useMemo(() => new Date(), []);
  const defaultYear = today.getFullYear() - 25;
  const [year, setYear] = useState<number>(defaultYear);
  const [month, setMonth] = useState<number>(0); // 0-based
  const [day, setDay] = useState<number>(1);
  const [goal, setGoal] = useState<JournalingGoal | null>(null);
  const [language, setLanguage] = useState<LanguageCode>('en');
  const [error, setError] = useState<string | null>(null);

  const stepId = STEPS[stepIndex];
  const totalSteps = STEPS.length;
  const isLast = stepIndex === totalSteps - 1;

  const pickPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setError(t('editor.error.photoPermission'));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    setError(null);
    setPhotoUri(asset.uri);
    setPhotoBusy(true);
    try {
      const uploaded = await uploadPhoto(asset.uri, asset.mimeType ?? 'image/jpeg', 'face-photo');
      setPhotoKey(uploaded.public_url);
    } catch (e: any) {
      setError(e?.message ?? t('editor.error.photoUploadFailed'));
      setPhotoUri(null);
    } finally {
      setPhotoBusy(false);
    }
  };

  const finish = useMutation({
    mutationFn: async () => {
      const birthday = `${year.toString().padStart(4, '0')}-${(month + 1)
        .toString()
        .padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
      await updateMe({
        display_name: displayName.trim() || undefined,
        face_photo_url: photoKey ?? undefined,
        preferred_language: language,
        gender: gender ?? undefined,
        birthday,
        journaling_goal: goal ?? undefined,
      });
    },
    onSuccess: () => router.replace('/(tabs)'),
    onError: (e: any) => setError(e?.message ?? t('onboarding.error.save')),
  });

  const goNext = () => {
    setError(null);
    if (stepId === 'gender' && !gender) {
      setError(t('onboarding.error.required'));
      return;
    }
    if (stepId === 'goal' && !goal) {
      setError(t('onboarding.error.required'));
      return;
    }
    if (isLast) {
      finish.mutate();
      return;
    }
    setStepIndex((i) => i + 1);
  };

  const goBack = () => {
    setError(null);
    if (stepIndex === 0) return;
    setStepIndex((i) => i - 1);
  };

  const stepTitleKey: TranslationKey =
    stepId === 'profile'  ? 'onboarding.profile.title' :
    stepId === 'gender'   ? 'onboarding.gender.title' :
    stepId === 'birthday' ? 'onboarding.birthday.title' :
    stepId === 'goal'     ? 'onboarding.goal.title' :
                            'onboarding.language.title';

  const stepSubtitleKey: TranslationKey =
    stepId === 'profile'  ? 'onboarding.profile.subtitle' :
    stepId === 'gender'   ? 'onboarding.gender.subtitle' :
    stepId === 'birthday' ? 'onboarding.birthday.subtitle' :
    stepId === 'goal'     ? 'onboarding.goal.subtitle' :
                            'onboarding.language.subtitle';

  const primaryBusy = finish.isPending || photoBusy;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.background }]} edges={['top']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        {/* Header — eyebrow step indicator over a tiny ribbon mark */}
        <View style={styles.header}>
          <View style={styles.headerSide}>
            {stepIndex > 0 && (
              <TouchableOpacity onPress={goBack} hitSlop={10}>
                <IconSymbol name="chevron.left" size={22} color={c.text} />
              </TouchableOpacity>
            )}
          </View>
          <View style={styles.headerCenter}>
            <RibbonMark
              size={18}
              inkColor={c.text}
              accentColor={c.accent}
              backgroundColor={c.background}
            />
            <Eyebrow style={{ marginTop: 4 } as any}>
              {t('onboarding.step', { current: stepIndex + 1, total: totalSteps })}
            </Eyebrow>
          </View>
          <View style={[styles.headerSide, styles.headerSideRight]}>
            {!isLast && (
              <TouchableOpacity onPress={() => router.replace('/(tabs)')} hitSlop={10}>
                <Text style={[styles.skipLink, { color: c.muted }]}>
                  {t('common.skip')}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Progress dots — replaces the old segmented bar with editorial ticks */}
        <View style={styles.dots}>
          {STEPS.map((_, i) => {
            const active = i <= stepIndex;
            return (
              <View
                key={i}
                style={[
                  styles.dot,
                  {
                    backgroundColor: active ? c.accent : c.border,
                    width: i === stepIndex ? 24 : 16,
                  },
                ]}
              />
            );
          })}
        </View>

        <ScrollView
          contentContainerStyle={styles.body}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={[styles.title, { color: c.text, fontFamily: Type.serif }]}>
            {t(stepTitleKey)}
          </Text>
          <Text
            style={[
              styles.subtitle,
              { color: c.textSoft, fontFamily: Type.italic, fontStyle: 'italic' },
            ]}
          >
            {t(stepSubtitleKey)}
          </Text>

          {stepId === 'profile' && (
            <View style={styles.section}>
              <View style={styles.photoWrap}>
                <TouchableOpacity
                  style={[
                    styles.photoBtn,
                    { borderColor: c.border, backgroundColor: c.paper },
                  ]}
                  onPress={pickPhoto}
                  activeOpacity={0.8}
                >
                  {photoUri ? (
                    <Image source={{ uri: photoUri }} style={styles.photo} />
                  ) : (
                    <View style={styles.photoEmpty}>
                      <IconSymbol name="person.fill" size={36} color={c.muted} />
                    </View>
                  )}
                </TouchableOpacity>
                <Ribbon
                  width={14}
                  length={42}
                  color={c.accent}
                  backgroundColor={c.background}
                  style={{ position: 'absolute', top: -6, right: 18 } as any}
                />
              </View>
              <TouchableOpacity onPress={pickPhoto} style={styles.photoLinkBtn}>
                <Text style={[styles.photoLink, { color: c.accentDark }]}>
                  {photoUri
                    ? t('profile.changePhoto')
                    : t('onboarding.profile.addPhoto')}
                </Text>
              </TouchableOpacity>

              <Eyebrow style={{ marginTop: Spacing.xl, marginBottom: Spacing.sm } as any}>
                {t('profile.displayName')}
              </Eyebrow>
              <TextInput
                style={[
                  styles.input,
                  {
                    color: c.text,
                    borderColor: c.border,
                    backgroundColor: c.paper,
                    fontFamily: Type.serif,
                  },
                ]}
                placeholder={t('onboarding.profile.namePlaceholder')}
                placeholderTextColor={c.muted}
                value={displayName}
                onChangeText={setDisplayName}
              />
            </View>
          )}

          {stepId === 'gender' && (
            <View style={styles.section}>
              {GENDERS.map((g) => {
                const active = gender === g.value;
                return (
                  <TouchableOpacity
                    key={g.value}
                    onPress={() => setGender(g.value)}
                    activeOpacity={0.85}
                    style={[
                      styles.choice,
                      {
                        backgroundColor: c.paper,
                        borderColor: active ? c.accent : c.border,
                        borderWidth: active ? 2 : 1,
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.choiceDot,
                        {
                          borderColor: active ? c.accent : c.border,
                          backgroundColor: active ? c.accent : 'transparent',
                        },
                      ]}
                    >
                      {active && (
                        <IconSymbol name="checkmark" size={12} color={c.paper} />
                      )}
                    </View>
                    <Text
                      style={[
                        styles.choiceLabel,
                        { color: c.text, fontFamily: Type.serif },
                      ]}
                    >
                      {t(g.key)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {stepId === 'birthday' && (
            <View style={styles.section}>
              <View style={[styles.birthdayCard, { backgroundColor: c.paper, borderColor: c.border }]}>
                <View style={styles.birthdayRow}>
                  <BirthdayColumn
                    label={t('onboarding.birthday.month')}
                    options={MONTHS_ABBR.map((m, i) => ({ value: i, label: m }))}
                    value={month}
                    onChange={(m) => {
                      setMonth(m);
                      setDay(clampDay(year, m, day));
                    }}
                  />
                  <BirthdayColumn
                    label={t('onboarding.birthday.day')}
                    options={Array.from({ length: daysInMonth(year, month) }, (_, i) => ({
                      value: i + 1,
                      label: (i + 1).toString().padStart(2, '0'),
                    }))}
                    value={day}
                    onChange={setDay}
                  />
                  <BirthdayColumn
                    label={t('onboarding.birthday.year')}
                    options={Array.from({ length: 100 }, (_, i) => {
                      const y = today.getFullYear() - i;
                      return { value: y, label: y.toString() };
                    })}
                    value={year}
                    onChange={(y) => {
                      setYear(y);
                      setDay(clampDay(y, month, day));
                    }}
                  />
                </View>
              </View>
            </View>
          )}

          {stepId === 'goal' && (
            <View style={styles.section}>
              {GOALS.map((g) => {
                const active = goal === g.value;
                return (
                  <TouchableOpacity
                    key={g.value}
                    onPress={() => setGoal(g.value)}
                    activeOpacity={0.85}
                    style={[
                      styles.goalRow,
                      {
                        backgroundColor: c.paper,
                        borderColor: active ? c.accent : c.border,
                        borderWidth: active ? 2 : 1,
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.goalGlyph,
                        { backgroundColor: c.background },
                      ]}
                    >
                      <Text
                        style={{
                          fontFamily: Type.serif,
                          fontSize: 20,
                          fontStyle: 'italic',
                          color: c.accent,
                        }}
                      >
                        {g.glyph}
                      </Text>
                    </View>
                    <Text
                      style={[
                        styles.choiceLabel,
                        { color: c.text, fontFamily: Type.serif },
                      ]}
                    >
                      {t(g.key)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {stepId === 'language' && (
            <View style={styles.section}>
              {LANGUAGES.map((item) => {
                const active = language === item.code;
                return (
                  <TouchableOpacity
                    key={item.code}
                    onPress={() => setLanguage(item.code)}
                    activeOpacity={0.85}
                    style={[
                      styles.choice,
                      {
                        backgroundColor: c.paper,
                        borderColor: active ? c.accent : c.border,
                        borderWidth: active ? 2 : 1,
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.choiceDot,
                        {
                          borderColor: active ? c.accent : c.border,
                          backgroundColor: active ? c.accent : 'transparent',
                        },
                      ]}
                    >
                      {active && (
                        <IconSymbol name="checkmark" size={12} color={c.paper} />
                      )}
                    </View>
                    <Text
                      style={[
                        styles.choiceLabel,
                        { color: c.text, fontFamily: Type.serif },
                      ]}
                    >
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {error && (
            <Text style={[styles.error, { color: c.danger }]}>{error}</Text>
          )}
        </ScrollView>

        <View style={[styles.footer, { backgroundColor: c.background }]}>
          <TouchableOpacity
            style={[
              styles.primary,
              { backgroundColor: c.text, opacity: primaryBusy ? 0.6 : 1 },
            ]}
            onPress={goNext}
            disabled={primaryBusy}
            activeOpacity={0.9}
          >
            {primaryBusy ? (
              <ActivityIndicator color={c.background} />
            ) : (
              <Text style={[styles.primaryLabel, { color: c.background }]}>
                {isLast ? t('common.finish') : t('common.continue')}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function BirthdayColumn({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: number; label: string }[];
  value: number;
  onChange: (v: number) => void;
}) {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  return (
    <View style={styles.birthdayCol}>
      <Eyebrow>{label}</Eyebrow>
      <ScrollView
        style={[styles.birthdayList, { borderColor: c.border }]}
        showsVerticalScrollIndicator={false}
      >
        {options.map((opt) => {
          const active = opt.value === value;
          return (
            <TouchableOpacity
              key={opt.value}
              onPress={() => onChange(opt.value)}
              style={[
                styles.birthdayOpt,
                active && { backgroundColor: c.accent },
              ]}
            >
              <Text
                style={{
                  fontFamily: Type.serif,
                  fontSize: active ? 17 : 15,
                  color: active ? c.paper : c.text,
                  fontWeight: active ? '600' : '400',
                }}
              >
                {opt.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
    gap: Spacing.md,
  },
  headerSide: { width: 48, justifyContent: 'center' },
  headerSideRight: { alignItems: 'flex-end' },
  headerCenter: { flex: 1, alignItems: 'center' },
  skipLink: { fontSize: 13, fontWeight: '500' },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    paddingVertical: Spacing.sm,
  },
  dot: {
    height: 4,
    borderRadius: 2,
  },
  body: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.xxl,
  },
  title: {
    fontSize: 28,
    fontWeight: '500',
    letterSpacing: -0.4,
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    marginBottom: Spacing.xl,
  },
  section: { marginTop: Spacing.md },
  photoWrap: {
    alignItems: 'center',
    marginTop: Spacing.md,
    position: 'relative',
    width: 168,
    alignSelf: 'center',
  },
  photoBtn: {
    width: 168,
    height: 168,
    borderRadius: 999,
    borderWidth: 1,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photo: { width: '100%', height: '100%' },
  photoEmpty: { alignItems: 'center', justifyContent: 'center' },
  photoLinkBtn: { alignSelf: 'center', marginTop: Spacing.md, padding: Spacing.sm },
  photoLink: { fontSize: 13, fontWeight: '600', letterSpacing: 0.2 },
  input: {
    borderWidth: 1,
    borderRadius: Radii.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    fontSize: 17,
  },
  choice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
    borderRadius: Radii.md,
    marginBottom: Spacing.sm,
  },
  choiceDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  choiceLabel: { fontSize: 17, fontWeight: '500' },
  goalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: Radii.md,
    marginBottom: Spacing.sm,
  },
  goalGlyph: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  birthdayCard: {
    borderWidth: 1,
    borderRadius: Radii.md,
    padding: Spacing.md,
  },
  birthdayRow: { flexDirection: 'row', gap: Spacing.sm },
  birthdayCol: { flex: 1, alignItems: 'center', gap: Spacing.xs },
  birthdayList: {
    width: '100%',
    height: 200,
    borderWidth: 1,
    borderRadius: Radii.sm,
    overflow: 'hidden',
  },
  birthdayOpt: {
    paddingVertical: Spacing.sm,
    alignItems: 'center',
  },
  error: { marginTop: Spacing.md, fontSize: 14, textAlign: 'center' },
  footer: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.lg,
  },
  primary: {
    borderRadius: 999,
    paddingVertical: Spacing.lg,
    alignItems: 'center',
  },
  primaryLabel: { fontSize: 16, fontWeight: '600', letterSpacing: 0.2 },
});
