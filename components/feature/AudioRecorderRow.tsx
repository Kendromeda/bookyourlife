import {
  RecordingPresets,
  useAudioPlayer,
  useAudioPlayerStatus,
  useAudioRecorder,
  useAudioRecorderState,
  setAudioModeAsync,
  requestRecordingPermissionsAsync,
} from 'expo-audio';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Radii, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTranslation } from '@/utils/i18n';

export type RecordedClip = {
  id: string;
  uri: string;
  duration_seconds: number;
  uploading: boolean;
  storage_key: string | null;
  existing_id?: string;
};

export type AudioRecorderRowProps = {
  clips: RecordedClip[];
  uploading: boolean;
  onCaptured: (uri: string, durationSeconds: number) => void;
  onRemove: (id: string) => void;
  disabled?: boolean;
};

function formatDuration(s: number): string {
  const mins = Math.floor(s / 60);
  const secs = Math.floor(s % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function AudioRecorderRow({
  clips,
  onCaptured,
  onRemove,
  disabled,
}: AudioRecorderRowProps) {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];

  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder, 250);
  const [error, setError] = useState<string | null>(null);

  const start = async () => {
    try {
      const perm = await requestRecordingPermissionsAsync();
      if (perm.status !== 'granted') {
        setError('Microphone permission denied');
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
    } catch (e: any) {
      setError(e?.message ?? 'Failed to start recording');
    }
  };

  const stop = async () => {
    try {
      await recorder.stop();
      const uri = recorder.uri;
      const durationMs = recorderState.durationMillis ?? 0;
      if (uri) {
        onCaptured(uri, Math.max(1, Math.round(durationMs / 1000)));
      }
    } catch (e: any) {
      setError(e?.message ?? 'Failed to stop recording');
    }
  };

  const recording = recorderState.isRecording;

  return (
    <View style={{ marginTop: Spacing.lg }}>
      {clips.map((clip) => (
        <ClipPreview key={clip.id} clip={clip} onRemove={() => onRemove(clip.id)} />
      ))}

      <TouchableOpacity
        style={[
          styles.recordBtn,
          {
            backgroundColor: recording ? c.danger : c.surface,
            borderColor: recording ? c.danger : c.border,
          },
          disabled && { opacity: 0.5 },
        ]}
        onPress={recording ? stop : start}
        disabled={disabled}
        activeOpacity={0.8}
      >
        <IconSymbol
          name={recording ? 'checkmark' : 'mic.fill'}
          size={18}
          color={recording ? '#fff' : c.danger}
        />
        <Text style={[styles.recordLabel, { color: recording ? '#fff' : c.text }]}>
          {recording
            ? `Stop · ${formatDuration((recorderState.durationMillis ?? 0) / 1000)}`
            : 'Record voice note'}
        </Text>
      </TouchableOpacity>
      {error && <Text style={[styles.error, { color: c.danger }]}>{error}</Text>}
    </View>
  );
}

function ClipPreview({ clip, onRemove }: { clip: RecordedClip; onRemove: () => void }) {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const { t } = useTranslation();
  const player = useAudioPlayer(clip.uri);
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

  const toggle = () => {
    if (status.playing) {
      player.pause();
    } else {
      player.seekTo(0);
      player.play();
    }
  };

  return (
    <View style={[styles.clipRow, { backgroundColor: c.surface, borderColor: c.border }]}>
      <TouchableOpacity onPress={toggle} style={[styles.playBtn, { backgroundColor: c.accent }]}>
        {clip.uploading ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <IconSymbol
            name={status.playing ? 'pause.fill' : 'play.fill'}
            size={14}
            color="#fff"
          />
        )}
      </TouchableOpacity>
      <View style={{ flex: 1 }}>
        <Text style={[styles.clipLabel, { color: c.text }]}>{t('editor.voiceNote')}</Text>
        <Text style={[styles.clipMeta, { color: c.muted }]}>
          {formatDuration(clip.duration_seconds)}
          {clip.uploading ? ` · ${t('editor.uploading')}` : ''}
        </Text>
      </View>
      <TouchableOpacity onPress={onRemove} style={styles.clipRemove}>
        <IconSymbol name="xmark" size={14} color={c.muted} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  recordBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radii.md,
    borderWidth: 1,
  },
  recordLabel: { fontSize: 14, fontWeight: '600' },
  clipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: Radii.md,
    borderWidth: 1,
    marginBottom: Spacing.sm,
  },
  playBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clipLabel: { fontSize: 14, fontWeight: '500' },
  clipMeta: { fontSize: 12, marginTop: 2 },
  clipRemove: { padding: Spacing.xs },
  error: { fontSize: 13, marginTop: Spacing.sm },
});
