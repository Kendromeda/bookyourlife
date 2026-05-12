import { useVideoPlayer, VideoView } from 'expo-video';
import { ActivityIndicator, Dimensions, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Radii, Spacing } from '@/constants/theme';

export type VideoClip = {
  id: string;
  uri: string;
  duration_seconds: number | null;
  uploading: boolean;
  storage_key: string | null;
  existing_id?: string;
};

const SCREEN_WIDTH = Dimensions.get('window').width;
const PREVIEW_WIDTH = SCREEN_WIDTH - Spacing.lg * 2;
const PREVIEW_HEIGHT = Math.round(PREVIEW_WIDTH * 0.56);

function formatDuration(s: number | null): string {
  if (!s) return '';
  const mins = Math.floor(s / 60);
  const secs = Math.floor(s % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function VideoClipRow({
  clip,
  onRemove,
}: {
  clip: VideoClip;
  onRemove: () => void;
}) {
  const player = useVideoPlayer(clip.uri, (p) => {
    p.loop = false;
    p.muted = false;
  });

  return (
    <View style={styles.wrapper}>
      <View style={styles.preview}>
        <VideoView
          player={player}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          nativeControls
        />
        {clip.uploading && (
          <View style={styles.overlay}>
            <ActivityIndicator color="#fff" size="small" />
            <Text style={styles.overlayLabel}>Uploading…</Text>
          </View>
        )}
        {clip.duration_seconds && !clip.uploading ? (
          <View style={styles.duration}>
            <Text style={styles.durationLabel}>{formatDuration(clip.duration_seconds)}</Text>
          </View>
        ) : null}
        <TouchableOpacity onPress={onRemove} style={styles.remove}>
          <IconSymbol name="xmark" size={14} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginTop: Spacing.lg,
  },
  preview: {
    width: PREVIEW_WIDTH,
    height: PREVIEW_HEIGHT,
    borderRadius: Radii.md,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  overlayLabel: { color: '#fff', fontSize: 13, fontWeight: '500' },
  duration: {
    position: 'absolute',
    bottom: Spacing.sm,
    right: Spacing.sm,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: Radii.sm,
  },
  durationLabel: { color: '#fff', fontSize: 11, fontWeight: '600' },
  remove: {
    position: 'absolute',
    top: Spacing.sm,
    right: Spacing.sm,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
