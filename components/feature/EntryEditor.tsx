import * as ImagePicker from 'expo-image-picker';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AIToolsSheet } from '@/components/feature/AIToolsSheet';
import { AudioRecorderRow, RecordedClip } from '@/components/feature/AudioRecorderRow';
import { VideoClip, VideoClipRow } from '@/components/feature/VideoClipRow';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Radii, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import {
  createEntry,
  deleteEntry,
  fetchEntry,
  updateEntry,
  uploadAudio,
  uploadPhoto,
  uploadVideo,
} from '@/utils/entries';
import { CapturedLocation, captureCurrentLocation } from '@/utils/location';

const MAX_PHOTOS = 5;
const MAX_VIDEOS = 1;
const MAX_AUDIOS = 3;

type Photo = {
  id: string;
  uri: string;
  storage_key: string | null;
  uploading: boolean;
  existing_id?: string;
};

function makeId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function inferAudioMime(uri: string): string {
  const lower = uri.toLowerCase();
  if (lower.endsWith('.m4a')) return 'audio/x-m4a';
  if (lower.endsWith('.mp4')) return 'audio/mp4';
  if (lower.endsWith('.wav')) return 'audio/wav';
  if (lower.endsWith('.webm')) return 'audio/webm';
  if (lower.endsWith('.ogg')) return 'audio/ogg';
  if (lower.endsWith('.mp3')) return 'audio/mpeg';
  return 'audio/x-m4a';
}

function inferVideoMime(uri: string, fallback?: string): string {
  if (fallback === 'video/quicktime' || fallback === 'video/mp4') return fallback;
  const lower = uri.toLowerCase();
  if (lower.endsWith('.mov')) return 'video/quicktime';
  return 'video/mp4';
}

type AITool = 'titles' | 'prompts' | 'highlights' | 'image';

type Props = {
  questionId?: string | null;
  questionText?: string | null;
  entryId?: string | null;
  /** ISO string. If set on a fresh entry, the entry will be backdated. */
  initialWrittenAt?: string | null;
  onDone: () => void;
  onCanSubmitChange?: (canSubmit: boolean) => void;
  onSubmittingChange?: (submitting: boolean) => void;
  onEditModeChange?: (isEditMode: boolean) => void;
  onDirtyChange?: (dirty: boolean) => void;
  onWrittenAtChange?: (writtenAt: string | null) => void;
};

export type EntryEditorHandle = {
  submit: () => void;
  delete: () => void;
};

export const EntryEditor = forwardRef<EntryEditorHandle, Props>(function EntryEditor(
  {
    questionId,
    questionText,
    entryId,
    initialWrittenAt,
    onDone,
    onCanSubmitChange,
    onSubmittingChange,
    onEditModeChange,
    onDirtyChange,
    onWrittenAtChange,
  },
  ref,
) {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [audios, setAudios] = useState<RecordedClip[]>([]);
  const [videos, setVideos] = useState<VideoClip[]>([]);
  const [location, setLocation] = useState<CapturedLocation | null>(null);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeAITool, setActiveAITool] = useState<AITool | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [audioRecorderVisible, setAudioRecorderVisible] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [prefilled, setPrefilled] = useState(false);
  const [writtenAt, setWrittenAt] = useState<string | null>(initialWrittenAt ?? null);
  const [isDirty, setIsDirty] = useState(false);

  const isEditMode = Boolean(entryId);
  const entryQuery = useQuery({
    queryKey: ['entry', entryId],
    queryFn: () => fetchEntry(entryId!),
    enabled: isEditMode,
  });

  useEffect(() => {
    onEditModeChange?.(isEditMode);
  }, [isEditMode, onEditModeChange]);

  // Pre-fill state from fetched entry. Only runs once per load.
  useEffect(() => {
    if (!entryQuery.data || prefilled) return;
    const e = entryQuery.data;
    setTitle(e.title ?? '');
    setBody(e.body);
    setWrittenAt(e.written_at);
    if (e.lat != null && e.lng != null) {
      setLocation({ lat: e.lat, lng: e.lng, place_name: e.place_name });
    }
    setPhotos(
      e.photos.map((p) => ({
        id: p.id,
        uri: p.storage_key,
        storage_key: p.storage_key,
        uploading: false,
        existing_id: p.id,
      })),
    );
    setVideos(
      e.videos.map((v) => ({
        id: v.id,
        uri: v.storage_key,
        duration_seconds: v.duration_seconds,
        uploading: false,
        storage_key: v.storage_key,
        existing_id: v.id,
      })),
    );
    setAudios(
      e.audios.map((a) => ({
        id: a.id,
        uri: a.storage_key,
        duration_seconds: a.duration_seconds ?? 0,
        uploading: false,
        storage_key: a.storage_key,
        existing_id: a.id,
        transcript: a.transcript,
      })),
    );
    setPrefilled(true);
    setIsDirty(false);
  }, [entryQuery.data, prefilled]);

  // Emit written_at + dirty changes
  useEffect(() => {
    onWrittenAtChange?.(writtenAt);
  }, [writtenAt, onWrittenAtChange]);

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  // After prefill (create mode) or after first prefill (edit mode), any
  // *subsequent* state change marks the editor dirty. We skip the first
  // run when readiness flips so prefill itself isn't treated as a user
  // edit.
  const isReadyForDirtyTracking = !isEditMode || prefilled;
  const dirtyTrackingArmed = useRef(false);
  useEffect(() => {
    if (!isReadyForDirtyTracking) return;
    if (!dirtyTrackingArmed.current) {
      dirtyTrackingArmed.current = true;
      return;
    }
    setIsDirty(true);
  }, [title, body, photos, videos, audios, location, isReadyForDirtyTracking]);

  const pickPhoto = async (fromCamera = false) => {
    if (photos.length >= MAX_PHOTOS) return;
    setMoreOpen(false);
    const perm = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setError(fromCamera ? 'Camera permission required.' : 'Photo permission required.');
      return;
    }
    const result = fromCamera
      ? await ImagePicker.launchCameraAsync({ quality: 0.85 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.85 });
    if (result.canceled) return;
    const asset = result.assets[0];
    const photoId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setPhotos((p) => [...p, { id: photoId, uri: asset.uri, storage_key: null, uploading: true }]);
    try {
      const uploaded = await uploadPhoto(asset.uri, asset.mimeType ?? 'image/jpeg', 'entry-photo');
      setPhotos((p) =>
        p.map((existing) =>
          existing.id === photoId
            ? { ...existing, storage_key: uploaded.storage_key, uploading: false }
            : existing,
        ),
      );
    } catch (e: any) {
      setError(e?.message ?? 'Photo upload failed');
      setPhotos((p) => p.filter((existing) => existing.id !== photoId));
    }
  };

  const grabLocation = useCallback(async () => {
    setMoreOpen(false);
    setLocating(true);
    try {
      const loc = await captureCurrentLocation();
      if (loc) setLocation(loc);
      else setError('Location permission was denied.');
    } catch (e: any) {
      setError(e?.message ?? 'Failed to get location');
    } finally {
      setLocating(false);
    }
  }, []);

  const removePhoto = (id: string) => {
    setPhotos((p) => p.filter((existing) => existing.id !== id));
  };

  const pickVideo = async () => {
    setMoreOpen(false);
    if (videos.length >= MAX_VIDEOS) {
      setError(`Only ${MAX_VIDEOS} video allowed per entry.`);
      return;
    }
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setError('Photo library permission required.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['videos'],
      quality: 0.85,
      videoMaxDuration: 60,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    const id = makeId();
    const duration = asset.duration ? Math.round(asset.duration / 1000) : null;
    setVideos((v) => [
      ...v,
      { id, uri: asset.uri, duration_seconds: duration, uploading: true, storage_key: null },
    ]);
    try {
      const contentType = inferVideoMime(asset.uri, asset.mimeType ?? undefined);
      const uploaded = await uploadVideo(asset.uri, contentType);
      setVideos((v) =>
        v.map((existing) =>
          existing.id === id
            ? { ...existing, storage_key: uploaded.storage_key, uploading: false }
            : existing,
        ),
      );
    } catch (e: any) {
      setError(e?.message ?? 'Video upload failed');
      setVideos((v) => v.filter((existing) => existing.id !== id));
    }
  };

  const removeVideo = (id: string) => {
    setVideos((v) => v.filter((existing) => existing.id !== id));
  };

  const onAudioCaptured = async (uri: string, duration: number) => {
    if (audios.length >= MAX_AUDIOS) {
      setError(`Maximum ${MAX_AUDIOS} voice notes per entry.`);
      return;
    }
    const id = makeId();
    setAudios((a) => [
      ...a,
      { id, uri, duration_seconds: duration, uploading: true, storage_key: null },
    ]);
    try {
      const contentType = inferAudioMime(uri);
      const uploaded = await uploadAudio(uri, contentType);
      setAudios((a) =>
        a.map((existing) =>
          existing.id === id
            ? { ...existing, storage_key: uploaded.storage_key, uploading: false }
            : existing,
        ),
      );
    } catch (e: any) {
      setError(e?.message ?? 'Audio upload failed');
      setAudios((a) => a.filter((existing) => existing.id !== id));
    }
  };

  const removeAudio = (id: string) => {
    setAudios((a) => a.filter((existing) => existing.id !== id));
  };

  const submit = useMutation({
    mutationFn: async () => {
      const text = body.trim();
      const titleText = title.trim();
      const fallback =
        photos.length > 0
          ? '(photo)'
          : videos.length > 0
          ? '(video)'
          : audios.length > 0
          ? '(voice note)'
          : '';
      const finalBody = text || fallback;
      const finalTitle = titleText || null;

      if (isEditMode && entryId) {
        await updateEntry(entryId, {
          title: finalTitle,
          body: finalBody,
          lat: location?.lat ?? null,
          lng: location?.lng ?? null,
          place_name: location?.place_name ?? null,
          photos: photos.map((p) =>
            p.existing_id
              ? { id: p.existing_id }
              : { storage_key: p.storage_key ?? '' },
          ),
          videos: videos.map((v) =>
            v.existing_id
              ? { id: v.existing_id }
              : {
                  storage_key: v.storage_key ?? '',
                  duration_seconds: v.duration_seconds,
                },
          ),
          audios: audios.map((a) =>
            a.existing_id
              ? { id: a.existing_id }
              : {
                  storage_key: a.storage_key ?? '',
                  duration_seconds: a.duration_seconds,
                },
          ),
        });
      } else {
        const photoKeys = photos
          .map((p) => p.storage_key)
          .filter((k): k is string => k !== null);
        const videoAttachments = videos
          .filter((v) => v.storage_key !== null)
          .map((v) => ({
            storage_key: v.storage_key!,
            duration_seconds: v.duration_seconds,
          }));
        const audioAttachments = audios
          .filter((a) => a.storage_key !== null)
          .map((a) => ({
            storage_key: a.storage_key!,
            duration_seconds: a.duration_seconds,
          }));

        await createEntry({
          title: finalTitle,
          body: finalBody,
          question_id: questionId ?? null,
          written_at: writtenAt ?? new Date().toISOString(),
          photo_storage_keys: photoKeys,
          video_attachments: videoAttachments,
          audio_attachments: audioAttachments,
          lat: location?.lat ?? null,
          lng: location?.lng ?? null,
          place_name: location?.place_name ?? null,
        });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['entries'] });
      qc.invalidateQueries({ queryKey: ['questions', 'today'] });
      if (entryId) {
        qc.invalidateQueries({ queryKey: ['entry', entryId] });
        // Neighbor entries may carry a snapshot of this entry's data.
        qc.invalidateQueries({ queryKey: ['entry-neighbors'] });
      }
      setIsDirty(false);
      onDone();
    },
    onError: (e: any) => setError(e?.message ?? 'Failed to save entry'),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!entryId) throw new Error('Cannot delete unsaved entry');
      await deleteEntry(entryId);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['entries'] });
      qc.invalidateQueries({ queryKey: ['entry', entryId] });
      // Any neighbor cache that referenced this entry is now stale.
      qc.invalidateQueries({ queryKey: ['entry-neighbors'] });
      onDone();
    },
    onError: (e: any) => setError(e?.message ?? 'Failed to delete entry'),
  });

  const hasContent =
    body.trim().length > 0 ||
    title.trim().length > 0 ||
    photos.length > 0 ||
    videos.length > 0 ||
    audios.length > 0;
  const anyUploading =
    photos.some((p) => p.uploading) ||
    videos.some((v) => v.uploading) ||
    audios.some((a) => a.uploading);
  const editPending = isEditMode && !prefilled;
  const canSubmit = hasContent && !anyUploading && !submit.isPending && !editPending;

  // expose submit + delete + sync state up
  useImperativeHandle(
    ref,
    () => ({
      submit: () => submit.mutate(),
      delete: () => deleteMutation.mutate(),
    }),
    [submit, deleteMutation],
  );
  useEffect(() => {
    onCanSubmitChange?.(canSubmit);
  }, [canSubmit, onCanSubmitChange]);
  useEffect(() => {
    onSubmittingChange?.(submit.isPending);
  }, [submit.isPending, onSubmittingChange]);

  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  const bottomGap = keyboardVisible ? Spacing.sm : Spacing.lg + insets.bottom;

  if (isEditMode && entryQuery.isError) {
    return (
      <View style={[styles.flex, styles.centerLoader, styles.loadError]}>
        <Text style={[styles.loadErrorText, { color: c.muted }]}>Failed to load entry.</Text>
        <TouchableOpacity
          onPress={() => entryQuery.refetch()}
          style={[styles.loadErrorBtn, { backgroundColor: c.surface, borderColor: c.border }]}
        >
          <Text style={[styles.loadErrorBtnText, { color: c.text }]}>Try again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (editPending) {
    return (
      <View style={[styles.flex, styles.centerLoader]}>
        <ActivityIndicator color={c.accent} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      <ScrollView
        contentContainerStyle={[styles.container, keyboardVisible && styles.keyboardContainer]}
        keyboardShouldPersistTaps="handled"
      >
        {questionText && (
          <View style={[styles.questionBox, { backgroundColor: c.surface, borderColor: c.border }]}>
            <Text style={[styles.questionEyebrow, { color: c.accentDark }]}>Answering</Text>
            <Text style={[styles.questionText, { color: c.text }]}>{questionText}</Text>
          </View>
        )}

        <TextInput
          style={[styles.titleInput, { color: c.text }]}
          placeholder="Title (optional)"
          placeholderTextColor={c.muted}
          value={title}
          onChangeText={setTitle}
        />

        <TextInput
          style={[styles.bodyInput, { color: c.text }]}
          placeholder="Start writing..."
          placeholderTextColor={c.muted}
          value={body}
          onChangeText={setBody}
          multiline
          textAlignVertical="top"
        />

        {photos.length > 0 && (
          <View style={styles.photoGrid}>
            {photos.map((p) => {
              const slotStyle =
                photos.length === 1
                  ? styles.photoSlotFull
                  : photos.length === 2
                  ? styles.photoSlotHalf
                  : styles.photoSlotGrid;
              return (
                <View key={p.id} style={slotStyle}>
                  <Image source={{ uri: p.uri }} style={styles.photoThumb} resizeMode="cover" />
                  {p.uploading ? (
                    <View style={styles.photoOverlay}>
                      <ActivityIndicator color="#fff" />
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={styles.photoRemove}
                      onPress={() => removePhoto(p.id)}
                    >
                      <IconSymbol name="xmark" size={14} color="#fff" />
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}
          </View>
        )}

        {videos.map((clip) => (
          <VideoClipRow key={clip.id} clip={clip} onRemove={() => removeVideo(clip.id)} />
        ))}

        {(audioRecorderVisible || audios.length > 0) && (
          <AudioRecorderRow
            clips={audios}
            uploading={audios.some((a) => a.uploading)}
            onCaptured={onAudioCaptured}
            onRemove={removeAudio}
            disabled={audios.length >= MAX_AUDIOS}
          />
        )}

        {error && <Text style={[styles.error, { color: c.danger }]}>{error}</Text>}

        <View style={styles.metaSpacer} />
      </ScrollView>

      {/* Location footer card */}
      {(location || locating) && (
        <View
          style={[
            styles.metaCard,
            { backgroundColor: c.surface, borderColor: c.border },
          ]}
        >
          <IconSymbol name="location.fill" size={14} color={c.accent} />
          {locating ? (
            <Text style={[styles.metaText, { color: c.muted }]}>Locating…</Text>
          ) : location ? (
            <Text style={[styles.metaText, { color: c.text }]} numberOfLines={1}>
              {location.place_name ?? `${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}`}
            </Text>
          ) : null}
          {location && !locating && (
            <TouchableOpacity onPress={() => setLocation(null)}>
              <IconSymbol name="xmark" size={14} color={c.muted} />
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Attachments toolbar */}
      <View
        style={[
          styles.toolbar,
          {
            backgroundColor: c.surface,
            borderColor: c.border,
            marginBottom: bottomGap,
          },
        ]}
      >
        <ToolbarBtn
          icon="photo.stack"
          label="Photos"
          onPress={() => pickPhoto(false)}
          color={c.accent}
          textColor={c.text}
        />
        <ToolbarDivider color={c.border} />
        <ToolbarBtn
          icon="doc.text.fill"
          label="Templates"
          onPress={() => setError('Templates coming soon')}
          color={c.muted}
          textColor={c.text}
        />
        <ToolbarDivider color={c.border} />
        <ToolbarBtn
          icon="sparkles"
          label="AI"
          onPress={() => setAiOpen(true)}
          color={c.accent}
          textColor={c.text}
          badge
        />
        <ToolbarDivider color={c.border} />
        <ToolbarBtn
          icon="ellipsis"
          label="More…"
          onPress={() => setMoreOpen(true)}
          color={c.muted}
          textColor={c.text}
        />
      </View>

      {/* More sheet */}
      <BottomSheet open={moreOpen} onClose={() => setMoreOpen(false)}>
        <Text style={[styles.sheetTitle, { color: c.text }]}>Add to entry</Text>
        <View style={styles.sheetGrid}>
          <SheetTile
            icon="mic.fill"
            label="Audio"
            onPress={() => {
              setMoreOpen(false);
              if (audios.length >= MAX_AUDIOS) {
                setError(`Maximum ${MAX_AUDIOS} voice notes per entry.`);
                return;
              }
              setAudioRecorderVisible(true);
            }}
          />
          <SheetTile icon="location.fill" label="Location" onPress={grabLocation} />
          <SheetTile
            icon="tag.fill"
            label="Tag"
            onPress={() => {
              setMoreOpen(false);
              setError('Tags coming soon');
            }}
          />
          <SheetTile icon="camera.fill" label="Camera" onPress={() => pickPhoto(true)} />
          <SheetTile
            icon="doc.fill"
            label="File"
            star
            onPress={() => {
              setMoreOpen(false);
              setError('Files coming soon');
            }}
          />
          <SheetTile icon="video.fill" label="Video" onPress={pickVideo} />
        </View>
      </BottomSheet>

      {/* AI sheet */}
      <BottomSheet open={aiOpen} onClose={() => setAiOpen(false)}>
        <Text style={[styles.sheetTitle, { color: c.text }]}>Journaling Tools</Text>
        <View style={styles.sheetGrid}>
          <SheetTile
            icon="wand.and.stars"
            label="Title Suggestions"
            onPress={() => {
              setAiOpen(false);
              setActiveAITool('titles');
            }}
          />
          <SheetTile
            icon="sparkles"
            label="Writing Prompts"
            onPress={() => {
              setAiOpen(false);
              setActiveAITool('prompts');
            }}
          />
          <SheetTile
            icon="photo"
            label="Generate Image"
            onPress={() => {
              setAiOpen(false);
              setActiveAITool('image');
            }}
          />
          <SheetTile
            icon="sparkles"
            label="Entry Highlights"
            onPress={() => {
              setAiOpen(false);
              setActiveAITool('highlights');
            }}
          />
        </View>
      </BottomSheet>
      <AIToolsSheet
        visible={activeAITool !== null}
        onClose={() => setActiveAITool(null)}
        tool={activeAITool ?? 'titles'}
        entryBody={body}
        onApplyTitle={setTitle}
        onAppendText={(text) => setBody((current) => `${current.trimEnd()}\n\n${text}`)}
        onAddPhoto={(image) =>
          setPhotos((current) => [
            ...current,
            {
              id: makeId(),
              uri: image.public_url,
              storage_key: image.storage_key,
              uploading: false,
            },
          ])
        }
      />
    </KeyboardAvoidingView>
  );
});

function ToolbarBtn({
  icon,
  label,
  onPress,
  color,
  textColor,
  badge,
}: {
  icon: any;
  label: string;
  onPress: () => void;
  color: string;
  textColor: string;
  badge?: boolean;
}) {
  return (
    <TouchableOpacity style={styles.toolbarBtn} onPress={onPress} activeOpacity={0.7}>
      <View>
        <IconSymbol name={icon} size={20} color={color} />
        {badge && <View style={styles.toolbarBadge} />}
      </View>
      <Text style={[styles.toolbarLabel, { color: textColor }]}>{label}</Text>
    </TouchableOpacity>
  );
}

function ToolbarDivider({ color }: { color: string }) {
  return <View style={[styles.toolbarDivider, { backgroundColor: color }]} />;
}

function BottomSheet({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.sheetBackdrop} onPress={onClose} />
      <View style={[styles.sheet, { backgroundColor: c.surface, borderColor: c.border }]}>
        <View style={[styles.sheetHandle, { backgroundColor: c.border }]} />
        {children}
      </View>
    </Modal>
  );
}

function SheetTile({
  icon,
  label,
  onPress,
  star,
}: {
  icon: any;
  label: string;
  onPress: () => void;
  star?: boolean;
}) {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  return (
    <TouchableOpacity style={styles.sheetTile} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.sheetTileIcon, { backgroundColor: c.background, borderColor: c.border }]}>
        <IconSymbol name={icon} size={22} color={c.text} />
        {star && (
          <View style={[styles.sheetTileStar, { backgroundColor: c.accent }]}>
            <IconSymbol name="sparkles" size={8} color="#fff" />
          </View>
        )}
      </View>
      <Text style={[styles.sheetTileLabel, { color: c.text }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  centerLoader: { alignItems: 'center', justifyContent: 'center' },
  loadError: { padding: Spacing.xl },
  loadErrorText: { fontSize: 14, textAlign: 'center', marginBottom: Spacing.md },
  loadErrorBtn: {
    borderWidth: 1,
    borderRadius: Radii.pill,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  loadErrorBtnText: { fontSize: 14, fontWeight: '600' },
  container: { padding: Spacing.lg, paddingBottom: 0 },
  keyboardContainer: { paddingBottom: 120 },
  questionBox: {
    borderWidth: 1,
    borderRadius: Radii.md,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  questionEyebrow: { fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, marginBottom: Spacing.xs },
  questionText: { fontSize: 16, lineHeight: 22 },
  titleInput: {
    fontSize: 22,
    fontWeight: '700',
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  bodyInput: {
    fontSize: 16,
    lineHeight: 24,
    minHeight: 220,
    paddingVertical: Spacing.sm,
  },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginTop: Spacing.lg },
  photoSlotFull: {
    width: '100%',
    height: Math.round((Dimensions.get('window').width - Spacing.lg * 2) * 0.66),
    borderRadius: Radii.md,
    overflow: 'hidden',
  },
  photoSlotHalf: {
    width: (Dimensions.get('window').width - Spacing.lg * 2 - Spacing.sm) / 2,
    height: (Dimensions.get('window').width - Spacing.lg * 2 - Spacing.sm) / 2,
    borderRadius: Radii.md,
    overflow: 'hidden',
  },
  photoSlotGrid: {
    width: (Dimensions.get('window').width - Spacing.lg * 2 - Spacing.sm * 2) / 3,
    height: (Dimensions.get('window').width - Spacing.lg * 2 - Spacing.sm * 2) / 3,
    borderRadius: Radii.md,
    overflow: 'hidden',
  },
  photoThumb: { width: '100%', height: '100%' },
  photoOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoRemove: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  error: { marginTop: Spacing.md, fontSize: 14 },
  metaSpacer: { height: 80 },
  metaCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radii.md,
    borderWidth: 1,
  },
  metaText: { fontSize: 13, flex: 1 },
  toolbar: {
    flexDirection: 'row',
    marginHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: Radii.lg,
    borderWidth: 1,
  },
  toolbarBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: Spacing.sm,
  },
  toolbarLabel: { fontSize: 11, fontWeight: '500' },
  toolbarDivider: { width: 1, marginVertical: Spacing.xs },
  toolbarBadge: {
    position: 'absolute',
    top: -2,
    right: -4,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FFD23F',
  },
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    borderTopLeftRadius: Radii.lg,
    borderTopRightRadius: Radii.lg,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    padding: Spacing.lg,
    paddingBottom: Spacing.xxl,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: Spacing.lg,
  },
  sheetTitle: { fontSize: 18, fontWeight: '700', marginBottom: Spacing.lg },
  sheetGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  sheetTile: {
    width: '30%',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
  },
  sheetTileIcon: {
    width: 56,
    height: 56,
    borderRadius: Radii.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetTileStar: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetTileLabel: { fontSize: 12, fontWeight: '500' },
});
