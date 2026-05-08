import { useVideoPlayer, VideoView } from 'expo-video';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Radii, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export type VideoClip = {
  id: string;
  uri: string;
  duration_seconds: number | null;
  uploading: boolean;
  storage_key: string | null;
};

export function VideoClipRow({
  clip,
  onRemove,
}: {
  clip: VideoClip;
  onRemove: () => void;
}) {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const player = useVideoPlayer(clip.uri, (p) => {
    p.loop = false;
    p.muted = true;
  });

  return (
    <View style={[styles.row, { backgroundColor: c.surface, borderColor: c.border }]}>
      <View style={[styles.thumb, { backgroundColor: c.background }]}>
        <VideoView
          player={player}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          nativeControls={false}
        />
        {clip.uploading && (
          <View style={styles.overlay}>
            <ActivityIndicator color="#fff" size="small" />
          </View>
        )}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.label, { color: c.text }]}>Video</Text>
        <Text style={[styles.meta, { color: c.muted }]}>
          {clip.duration_seconds ? `${clip.duration_seconds}s` : 'attached'}
          {clip.uploading ? ' · uploading…' : clip.storage_key ? ' · saved' : ''}
        </Text>
      </View>
      <TouchableOpacity onPress={onRemove} style={styles.remove}>
        <IconSymbol name="xmark" size={14} color={c.muted} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.sm,
    borderRadius: Radii.md,
    borderWidth: 1,
    marginTop: Spacing.lg,
  },
  thumb: {
    width: 64,
    height: 48,
    borderRadius: Radii.sm,
    overflow: 'hidden',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { fontSize: 14, fontWeight: '500' },
  meta: { fontSize: 12, marginTop: 2 },
  remove: { padding: Spacing.xs },
});
