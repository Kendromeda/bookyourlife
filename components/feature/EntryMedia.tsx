import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect } from 'react';
import { Dimensions, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Radii, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { EntryAudio, EntryPhoto, EntryVideo } from '@/utils/entries';
import { useTranslation } from '@/utils/i18n';

const SCREEN_WIDTH = Dimensions.get('window').width;

function formatDuration(s: number | null): string {
  if (!s) return '';
  const mins = Math.floor(s / 60);
  const secs = Math.floor(s % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

type Props = {
  photos: EntryPhoto[];
  videos: EntryVideo[];
  audios: EntryAudio[];
  /** Available content width (excluding row padding/margins). Defaults to screen - 2*lg. */
  contentWidth?: number;
};

export function EntryMedia({ photos, videos, audios, contentWidth }: Props) {
  const width = contentWidth ?? SCREEN_WIDTH - Spacing.lg * 2 - Spacing.lg * 2;
  const hasAnything = photos.length > 0 || videos.length > 0 || audios.length > 0;
  if (!hasAnything) return null;

  return (
    <View style={{ marginTop: Spacing.md, gap: Spacing.sm }}>
      {photos.length > 0 && <PhotoStack photos={photos} width={width} />}
      {videos.map((v) => (
        <VideoPlayer key={v.id} video={v} width={width} />
      ))}
      {audios.map((a) => (
        <AudioPlayer key={a.id} audio={a} />
      ))}
    </View>
  );
}

function PhotoStack({ photos, width }: { photos: EntryPhoto[]; width: number }) {
  if (photos.length === 1) {
    const p = photos[0];
    return (
      <Image
        source={{ uri: p.storage_key }}
        style={{ width, height: Math.round(width * 0.66), borderRadius: Radii.md }}
        resizeMode="cover"
      />
    );
  }
  if (photos.length === 2) {
    const cellW = (width - Spacing.xs) / 2;
    return (
      <View style={{ flexDirection: 'row', gap: Spacing.xs }}>
        {photos.map((p) => (
          <Image
            key={p.id}
            source={{ uri: p.storage_key }}
            style={{ width: cellW, height: cellW, borderRadius: Radii.sm }}
            resizeMode="cover"
          />
        ))}
      </View>
    );
  }
  // 3+ photos: first big, rest grid below
  const heroH = Math.round(width * 0.55);
  const extra = photos.slice(1, 4);
  const cellW = (width - Spacing.xs * (extra.length - 1)) / extra.length;
  return (
    <View style={{ gap: Spacing.xs }}>
      <Image
        source={{ uri: photos[0].storage_key }}
        style={{ width, height: heroH, borderRadius: Radii.md }}
        resizeMode="cover"
      />
      <View style={{ flexDirection: 'row', gap: Spacing.xs }}>
        {extra.map((p, idx) => (
          <View key={p.id} style={{ width: cellW, height: cellW, borderRadius: Radii.sm, overflow: 'hidden' }}>
            <Image
              source={{ uri: p.storage_key }}
              style={{ width: '100%', height: '100%' }}
              resizeMode="cover"
            />
            {idx === extra.length - 1 && photos.length > 4 && (
              <View style={styles.photoMoreOverlay}>
                <Text style={styles.photoMoreLabel}>+{photos.length - 4}</Text>
              </View>
            )}
          </View>
        ))}
      </View>
    </View>
  );
}

function VideoPlayer({ video, width }: { video: EntryVideo; width: number }) {
  const player = useVideoPlayer(video.storage_key, (p) => {
    p.loop = false;
    p.muted = false;
  });
  const height = Math.round(width * 0.56);

  return (
    <View
      style={{
        width,
        height,
        borderRadius: Radii.md,
        overflow: 'hidden',
        backgroundColor: '#000',
      }}
    >
      <VideoView
        player={player}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        nativeControls
      />
      {video.duration_seconds ? (
        <View style={styles.videoDuration}>
          <Text style={styles.videoDurationLabel}>{formatDuration(video.duration_seconds)}</Text>
        </View>
      ) : null}
    </View>
  );
}

function AudioPlayer({ audio }: { audio: EntryAudio }) {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const { t } = useTranslation();
  const player = useAudioPlayer(audio.storage_key);
  const status = useAudioPlayerStatus(player);

  useEffect(() => {
    return () => {
      try {
        player.pause();
        player.remove();
      } catch {
        // ignore
      }
    };
  }, [player]);

  const playing = status.playing;
  const duration = audio.duration_seconds ?? Math.floor((status.duration ?? 0));
  const current = Math.floor(status.currentTime ?? 0);

  const toggle = () => {
    if (playing) {
      player.pause();
    } else {
      if (current >= duration && duration > 0) {
        player.seekTo(0);
      }
      player.play();
    }
  };

  return (
    <View style={[styles.audioRow, { backgroundColor: c.surface, borderColor: c.border }]}>
      <TouchableOpacity onPress={toggle} style={[styles.audioPlayBtn, { backgroundColor: c.accent }]}>
        <IconSymbol name={playing ? 'pause.fill' : 'play.fill'} size={16} color="#fff" />
      </TouchableOpacity>
      <View style={{ flex: 1 }}>
        <Text style={[styles.audioLabel, { color: c.text }]}>{t('editor.voiceNote')}</Text>
        <Text style={[styles.audioMeta, { color: c.muted }]} numberOfLines={1}>
          {playing ? `${formatDuration(current)} / ${formatDuration(duration)}` : formatDuration(duration)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  photoMoreOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoMoreLabel: { color: '#fff', fontSize: 20, fontWeight: '700' },
  videoDuration: {
    position: 'absolute',
    bottom: Spacing.sm,
    right: Spacing.sm,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: Radii.sm,
  },
  videoDurationLabel: { color: '#fff', fontSize: 11, fontWeight: '600' },
  audioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: Radii.md,
    borderWidth: 1,
  },
  audioPlayBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  audioLabel: { fontSize: 14, fontWeight: '500' },
  audioMeta: { fontSize: 12, marginTop: 2 },
});
