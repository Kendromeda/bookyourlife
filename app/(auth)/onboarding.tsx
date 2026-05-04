import { useUser } from '@clerk/clerk-expo';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors, Radii, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { requestPhotoUpload, uploadPhotoToR2 } from '@/utils/entries';
import { updateMe } from '@/utils/users';

export default function OnboardingScreen() {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const router = useRouter();
  const { user } = useUser();
  const [displayName, setDisplayName] = useState(user?.fullName ?? '');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoKey, setPhotoKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pickPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setError('Photo permission is required to personalize your book covers.');
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
    try {
      const presigned = await requestPhotoUpload('image/jpeg', 'face-photo');
      await uploadPhotoToR2(presigned.upload_url, asset.uri, 'image/jpeg');
      setPhotoKey(presigned.storage_key);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to upload photo');
      setPhotoUri(null);
    }
  };

  const finish = useMutation({
    mutationFn: async () => {
      await updateMe({
        display_name: displayName.trim() || undefined,
        face_photo_url: photoKey ?? undefined,
      });
    },
    onSuccess: () => router.replace('/(tabs)'),
    onError: (e: any) => setError(e?.message ?? 'Failed to save profile'),
  });

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.background }]}>
      <View style={styles.container}>
        <Text style={[styles.title, { color: c.text }]}>Let&apos;s set you up</Text>
        <Text style={[styles.subtitle, { color: c.textSoft }]}>
          Your face photo helps us draw illustrations that look like you in your book chapters.
        </Text>

        <TouchableOpacity
          style={[styles.photoBtn, { borderColor: c.border, backgroundColor: c.surface }]}
          onPress={pickPhoto}
        >
          {photoUri ? (
            <Image source={{ uri: photoUri }} style={styles.photo} />
          ) : (
            <Text style={[styles.photoLabel, { color: c.accentDark }]}>+ Add face photo</Text>
          )}
        </TouchableOpacity>

        <TextInput
          style={[styles.input, { color: c.text, borderColor: c.border, backgroundColor: c.surface }]}
          placeholder="Your name"
          placeholderTextColor={c.muted}
          value={displayName}
          onChangeText={setDisplayName}
        />

        {error && <Text style={[styles.error, { color: c.danger }]}>{error}</Text>}

        <TouchableOpacity
          style={[styles.primary, { backgroundColor: c.accent, opacity: finish.isPending ? 0.6 : 1 }]}
          onPress={() => finish.mutate()}
          disabled={finish.isPending}
        >
          {finish.isPending ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryLabel}>Continue</Text>}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.replace('/(tabs)')}>
          <Text style={[styles.skip, { color: c.muted }]}>Skip for now</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: { flex: 1, paddingHorizontal: Spacing.xl, paddingTop: Spacing.xxl },
  title: { fontSize: 28, fontWeight: '700', marginBottom: Spacing.sm },
  subtitle: { fontSize: 15, marginBottom: Spacing.xl, lineHeight: 22 },
  photoBtn: { alignSelf: 'center', width: 160, height: 160, borderRadius: Radii.pill, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.xl, overflow: 'hidden' },
  photo: { width: '100%', height: '100%' },
  photoLabel: { fontSize: 14, fontWeight: '600' },
  input: { borderWidth: 1, borderRadius: Radii.md, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, fontSize: 16, marginBottom: Spacing.md },
  error: { marginBottom: Spacing.md, fontSize: 14 },
  primary: { borderRadius: Radii.md, paddingVertical: Spacing.lg, alignItems: 'center', marginTop: Spacing.sm },
  primaryLabel: { color: '#fff', fontSize: 16, fontWeight: '600' },
  skip: { textAlign: 'center', marginTop: Spacing.lg, fontSize: 14 },
});
