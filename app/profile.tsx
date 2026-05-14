import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
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

import { AppHeader } from '@/components/ui/AppHeader';
import { Eyebrow } from '@/components/ui/Ribbon';
import { Colors, Radii, Spacing, Type } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { uploadPhoto } from '@/utils/entries';
import { useTranslation } from '@/utils/i18n';
import type { TranslationKey } from '@/utils/i18n';
import {
  Gender,
  JournalingGoal,
  Me,
  fetchMe,
  updateMe,
} from '@/utils/users';

const GENDERS: { value: Gender; key: TranslationKey }[] = [
  { value: 'male', key: 'onboarding.gender.male' },
  { value: 'female', key: 'onboarding.gender.female' },
  { value: 'non_binary', key: 'onboarding.gender.non_binary' },
  { value: 'prefer_not_to_say', key: 'onboarding.gender.prefer_not_to_say' },
];

const GOALS: { value: JournalingGoal; key: TranslationKey }[] = [
  { value: 'self_reflection', key: 'onboarding.goal.self_reflection' },
  { value: 'mental_health', key: 'onboarding.goal.mental_health' },
  { value: 'memory', key: 'onboarding.goal.memory' },
  { value: 'creativity', key: 'onboarding.goal.creativity' },
  { value: 'other', key: 'onboarding.goal.other' },
];

function parseBirthday(raw: string | null): { y: string; m: string; d: string } {
  if (!raw) return { y: '', m: '', d: '' };
  const [y, m, d] = raw.split('-');
  return { y: y ?? '', m: m ?? '', d: d ?? '' };
}

function joinBirthday(y: string, m: string, d: string): string | undefined {
  if (!y && !m && !d) return undefined;
  if (!y || !m || !d) return undefined;
  return `${y.padStart(4, '0')}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

export default function ProfileScreen() {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const router = useRouter();
  const qc = useQueryClient();
  const { t } = useTranslation();

  const meQuery = useQuery<Me>({ queryKey: ['me'], queryFn: fetchMe });
  const me = meQuery.data;

  const [displayName, setDisplayName] = useState('');
  const [gender, setGender] = useState<Gender | null>(null);
  const [goal, setGoal] = useState<JournalingGoal | null>(null);
  const [birthdayY, setBirthdayY] = useState('');
  const [birthdayM, setBirthdayM] = useState('');
  const [birthdayD, setBirthdayD] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoKey, setPhotoKey] = useState<string | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  // Hydrate local state from server once data loads.
  useEffect(() => {
    if (!me) return;
    setDisplayName(me.display_name ?? '');
    setGender(me.gender);
    setGoal(me.journaling_goal);
    const b = parseBirthday(me.birthday);
    setBirthdayY(b.y);
    setBirthdayM(b.m);
    setBirthdayD(b.d);
    setPhotoUri(me.face_photo_url);
    setPhotoKey(me.face_photo_url);
  }, [me]);

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
      const uploaded = await uploadPhoto(
        asset.uri,
        asset.mimeType ?? 'image/jpeg',
        'face-photo',
      );
      setPhotoKey(uploaded.public_url);
    } catch (e: any) {
      setError(e?.message ?? t('editor.error.photoUploadFailed'));
    } finally {
      setPhotoBusy(false);
    }
  };

  const save = useMutation({
    mutationFn: async () => {
      const birthday = joinBirthday(birthdayY, birthdayM, birthdayD);
      return updateMe({
        display_name: displayName.trim() || undefined,
        face_photo_url: photoKey ?? undefined,
        gender: gender ?? undefined,
        birthday: birthday,
        journaling_goal: goal ?? undefined,
      });
    },
    onSuccess: (data) => {
      qc.setQueryData(['me'], data);
      setSavedAt(Date.now());
      setError(null);
    },
    onError: (e: any) => setError(e?.message ?? t('onboarding.error.save')),
  });

  // Clear the "Saved" pill after a short delay.
  useEffect(() => {
    if (!savedAt) return;
    const timer = setTimeout(() => setSavedAt(null), 2200);
    return () => clearTimeout(timer);
  }, [savedAt]);

  const fmtMeta =
    me?.subscription_tier === 'premium'
      ? t('more.plan.premium')
      : t('more.plan.free');

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.background }]} edges={['top']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <AppHeader
          title={t('profile.title')}
          onBack={() => router.back()}
          right={
            savedAt ? (
              <Text style={[styles.savedPill, { color: c.accentDark }]}>
                {t('profile.saved')}
              </Text>
            ) : null
          }
        />

        {meQuery.isLoading ? (
          <View style={styles.loading}>
            <ActivityIndicator color={c.accent} />
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={styles.body}
            keyboardShouldPersistTaps="handled"
          >
            {/* Avatar row */}
            <View style={styles.avatarRow}>
              <TouchableOpacity
                onPress={pickPhoto}
                activeOpacity={0.85}
                style={[
                  styles.avatarBtn,
                  { borderColor: c.border, backgroundColor: c.paper },
                ]}
              >
                {photoUri ? (
                  <Image source={{ uri: photoUri }} style={styles.avatarImg} />
                ) : (
                  <Text
                    style={{
                      fontFamily: Type.serif,
                      fontSize: 36,
                      color: c.paper,
                    }}
                  >
                    {(displayName || me?.email || '?').slice(0, 1).toUpperCase()}
                  </Text>
                )}
                {photoBusy && (
                  <View style={styles.avatarOverlay}>
                    <ActivityIndicator color="#fff" />
                  </View>
                )}
              </TouchableOpacity>
              <TouchableOpacity onPress={pickPhoto} style={styles.changePhoto}>
                <Text style={[styles.changePhotoLabel, { color: c.accentDark }]}>
                  {t('profile.changePhoto')}
                </Text>
              </TouchableOpacity>
              <Text style={[styles.meta, { color: c.muted }]}>{fmtMeta}</Text>
            </View>

            {/* Display name */}
            <Eyebrow style={styles.sectionLabel as any}>
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

            {/* Gender */}
            <Eyebrow style={styles.sectionLabel as any}>
              {t('profile.gender')}
            </Eyebrow>
            <View style={styles.choiceWrap}>
              {GENDERS.map((g) => {
                const active = gender === g.value;
                return (
                  <TouchableOpacity
                    key={g.value}
                    onPress={() => setGender(g.value)}
                    activeOpacity={0.85}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: active ? c.accent : c.paper,
                        borderColor: active ? c.accent : c.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.chipLabel,
                        { color: active ? c.paper : c.text },
                      ]}
                    >
                      {t(g.key)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Birthday */}
            <Eyebrow style={styles.sectionLabel as any}>
              {t('profile.birthday')}
            </Eyebrow>
            <View style={styles.dobRow}>
              <TextInput
                style={[
                  styles.dobInput,
                  {
                    color: c.text,
                    borderColor: c.border,
                    backgroundColor: c.paper,
                    fontFamily: Type.serif,
                  },
                ]}
                placeholder={t('onboarding.birthday.year')}
                placeholderTextColor={c.muted}
                value={birthdayY}
                onChangeText={(v) => setBirthdayY(v.replace(/[^0-9]/g, '').slice(0, 4))}
                keyboardType="number-pad"
                maxLength={4}
              />
              <TextInput
                style={[
                  styles.dobInput,
                  {
                    color: c.text,
                    borderColor: c.border,
                    backgroundColor: c.paper,
                    fontFamily: Type.serif,
                  },
                ]}
                placeholder={t('onboarding.birthday.month')}
                placeholderTextColor={c.muted}
                value={birthdayM}
                onChangeText={(v) => setBirthdayM(v.replace(/[^0-9]/g, '').slice(0, 2))}
                keyboardType="number-pad"
                maxLength={2}
              />
              <TextInput
                style={[
                  styles.dobInput,
                  {
                    color: c.text,
                    borderColor: c.border,
                    backgroundColor: c.paper,
                    fontFamily: Type.serif,
                  },
                ]}
                placeholder={t('onboarding.birthday.day')}
                placeholderTextColor={c.muted}
                value={birthdayD}
                onChangeText={(v) => setBirthdayD(v.replace(/[^0-9]/g, '').slice(0, 2))}
                keyboardType="number-pad"
                maxLength={2}
              />
            </View>

            {/* Goal */}
            <Eyebrow style={styles.sectionLabel as any}>
              {t('profile.goal')}
            </Eyebrow>
            <View style={styles.choiceWrap}>
              {GOALS.map((g) => {
                const active = goal === g.value;
                return (
                  <TouchableOpacity
                    key={g.value}
                    onPress={() => setGoal(g.value)}
                    activeOpacity={0.85}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: active ? c.accent : c.paper,
                        borderColor: active ? c.accent : c.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.chipLabel,
                        { color: active ? c.paper : c.text },
                      ]}
                    >
                      {t(g.key)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {error && (
              <Text style={[styles.error, { color: c.danger }]}>{error}</Text>
            )}

            <TouchableOpacity
              style={[
                styles.primary,
                { backgroundColor: c.text, opacity: save.isPending ? 0.6 : 1 },
              ]}
              onPress={() => save.mutate()}
              disabled={save.isPending}
              activeOpacity={0.9}
            >
              {save.isPending ? (
                <ActivityIndicator color={c.background} />
              ) : (
                <Text style={[styles.primaryLabel, { color: c.background }]}>
                  {t('common.save')}
                </Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  body: { padding: Spacing.lg, paddingBottom: Spacing.xxl },
  avatarRow: { alignItems: 'center', marginTop: Spacing.md, marginBottom: Spacing.xl },
  avatarBtn: {
    width: 112,
    height: 112,
    borderRadius: 56,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImg: { width: '100%', height: '100%' },
  avatarOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.32)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  changePhoto: { padding: Spacing.sm, marginTop: Spacing.sm },
  changePhotoLabel: { fontSize: 13, fontWeight: '600', letterSpacing: 0.2 },
  meta: { fontSize: 12, marginTop: 2 },
  sectionLabel: {
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  input: {
    borderWidth: 1,
    borderRadius: Radii.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    fontSize: 17,
  },
  choiceWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  chip: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: 999,
    borderWidth: 1,
  },
  chipLabel: { fontSize: 13, fontWeight: '600' },
  dobRow: { flexDirection: 'row', gap: Spacing.sm },
  dobInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: Radii.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    fontSize: 17,
    textAlign: 'center',
  },
  error: { marginTop: Spacing.md, fontSize: 14, textAlign: 'center' },
  primary: {
    marginTop: Spacing.xl,
    borderRadius: 999,
    paddingVertical: Spacing.lg,
    alignItems: 'center',
  },
  primaryLabel: { fontSize: 16, fontWeight: '600', letterSpacing: 0.2 },
  savedPill: {
    fontFamily: Type.mono,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
});
