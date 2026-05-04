import { useState } from 'react';
import { ActivityIndicator, Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { Colors, Radii, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { createEntry, requestPhotoUpload, uploadPhotoToR2 } from '@/utils/entries';

const MAX_PHOTOS = 5;

type Photo = { uri: string; storage_key: string | null; uploading: boolean };

type Props = {
  questionId?: string | null;
  questionText?: string | null;
  onDone: () => void;
};

export function EntryEditor({ questionId, questionText, onDone }: Props) {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const qc = useQueryClient();
  const [body, setBody] = useState('');
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [error, setError] = useState<string | null>(null);

  const addPhoto = async () => {
    if (photos.length >= MAX_PHOTOS) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setError('Photo permission is required.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.85,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    const idx = photos.length;
    setPhotos((p) => [...p, { uri: asset.uri, storage_key: null, uploading: true }]);
    try {
      const presigned = await requestPhotoUpload('image/jpeg', 'entry-photo');
      await uploadPhotoToR2(presigned.upload_url, asset.uri, 'image/jpeg');
      setPhotos((p) => {
        const next = [...p];
        next[idx] = { uri: asset.uri, storage_key: presigned.storage_key, uploading: false };
        return next;
      });
    } catch (e: any) {
      setError(e?.message ?? 'Photo upload failed');
      setPhotos((p) => p.filter((_, i) => i !== idx));
    }
  };

  const submit = useMutation({
    mutationFn: async () => {
      const keys = photos.map((p) => p.storage_key).filter((k): k is string => k !== null);
      await createEntry({
        body: body.trim(),
        question_id: questionId ?? null,
        written_at: new Date().toISOString(),
        photo_storage_keys: keys,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['entries'] });
      qc.invalidateQueries({ queryKey: ['questions', 'today'] });
      onDone();
    },
    onError: (e: any) => setError(e?.message ?? 'Failed to save entry'),
  });

  const canSubmit =
    body.trim().length > 0 && !photos.some((p) => p.uploading) && !submit.isPending;

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        {questionText && (
          <View style={[styles.questionBox, { backgroundColor: c.surface, borderColor: c.border }]}>
            <Text style={[styles.questionEyebrow, { color: c.accentDark }]}>Answering</Text>
            <Text style={[styles.questionText, { color: c.text }]}>{questionText}</Text>
          </View>
        )}

        <TextInput
          style={[styles.input, { color: c.text, borderColor: c.border, backgroundColor: c.surface }]}
          placeholder="What's on your mind?"
          placeholderTextColor={c.muted}
          value={body}
          onChangeText={setBody}
          multiline
          textAlignVertical="top"
        />

        <View style={styles.photoRow}>
          {photos.map((p, i) => (
            <View key={i} style={styles.photoSlot}>
              <Image source={{ uri: p.uri }} style={styles.photoThumb} />
              {p.uploading && (
                <View style={styles.photoOverlay}>
                  <ActivityIndicator color="#fff" />
                </View>
              )}
            </View>
          ))}
          {photos.length < MAX_PHOTOS && (
            <TouchableOpacity
              style={[styles.photoAdd, { borderColor: c.border, backgroundColor: c.surface }]}
              onPress={addPhoto}
            >
              <Text style={[styles.photoAddLabel, { color: c.accentDark }]}>+</Text>
            </TouchableOpacity>
          )}
        </View>

        {error && <Text style={[styles.error, { color: c.danger }]}>{error}</Text>}

        <TouchableOpacity
          style={[styles.primary, { backgroundColor: c.accent, opacity: canSubmit ? 1 : 0.5 }]}
          disabled={!canSubmit}
          onPress={() => submit.mutate()}
        >
          {submit.isPending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.primaryLabel}>Save entry</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { padding: Spacing.lg, paddingBottom: Spacing.xxl },
  questionBox: {
    borderWidth: 1,
    borderRadius: Radii.md,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  questionEyebrow: { fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, marginBottom: Spacing.xs },
  questionText: { fontSize: 16, lineHeight: 22 },
  input: {
    borderWidth: 1,
    borderRadius: Radii.md,
    padding: Spacing.lg,
    fontSize: 16,
    lineHeight: 24,
    minHeight: 200,
    marginBottom: Spacing.lg,
  },
  photoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.lg },
  photoSlot: { width: 72, height: 72, borderRadius: Radii.sm, overflow: 'hidden' },
  photoThumb: { width: '100%', height: '100%' },
  photoOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoAdd: {
    width: 72,
    height: 72,
    borderRadius: Radii.sm,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoAddLabel: { fontSize: 28, fontWeight: '300' },
  error: { marginBottom: Spacing.md, fontSize: 14 },
  primary: { borderRadius: Radii.md, paddingVertical: Spacing.lg, alignItems: 'center' },
  primaryLabel: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
