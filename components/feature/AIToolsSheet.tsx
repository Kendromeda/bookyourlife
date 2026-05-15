import { useEffect, useMemo, useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { ImageSourcePropType } from 'react-native';

import {
  AiDiagnostics,
  fetchAiDiagnostics,
  fetchHighlights,
  fetchTitleSuggestions,
  fetchWritingPrompts,
  GeneratedImage,
  ImageIntensity,
  ImageStyle,
  pollImageJob,
  startImageGen,
} from '@/utils/ai';
import { uploadPhoto } from '@/utils/entries';
import { useTranslation } from '@/utils/i18n';

type AITool = 'titles' | 'prompts' | 'highlights' | 'image';
type ImagePhase = 'idle' | 'queued' | 'generating' | 'done' | 'failed';
type SourceImage = {
  uri: string;
  mimeType: string;
  storage_key: string | null;
  uploading: boolean;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  tool: AITool;
  entryBody: string;
  onApplyTitle: (title: string) => void;
  onAppendText: (text: string) => void;
  onAddPhoto: (image: GeneratedImage) => void;
};

const MIN_TEXT_BODY_LENGTH = 50;
const MIN_IMAGE_PROMPT_LENGTH = 10;

const IMAGE_STYLES: { value: ImageStyle; label: string; preview: ImageSourcePropType }[] = [
  {
    value: 'black_white_drawing',
    label: 'B&W drawing',
    preview: require('../../assets/images/style-black-white-drawing.jpg'),
  },
  {
    value: 'watercolor',
    label: 'Watercolor',
    preview: require('../../assets/images/style-watercolor.jpg'),
  },
  {
    value: 'animated',
    label: 'Animated',
    preview: require('../../assets/images/style-animated.jpg'),
  },
];

const IMAGE_INTENSITIES: { value: ImageIntensity; label: string }[] = [
  { value: 'subtle', label: 'Subtle' },
  { value: 'balanced', label: 'Balanced' },
  { value: 'expressive', label: 'Expressive' },
];

export function AIToolsSheet({
  visible,
  onClose,
  tool,
  entryBody,
  onApplyTitle,
  onAppendText,
  onAddPhoto,
}: Props) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [generatedImage, setGeneratedImage] = useState<GeneratedImage | null>(null);
  const [imagePrompt, setImagePrompt] = useState('');
  const [imageStyle, setImageStyle] = useState<ImageStyle>('black_white_drawing');
  const [imageIntensity, setImageIntensity] = useState<ImageIntensity>('balanced');
  const [imagePhase, setImagePhase] = useState<ImagePhase>('idle');
  const [diagnostics, setDiagnostics] = useState<AiDiagnostics | null>(null);
  const [sourceImage, setSourceImage] = useState<SourceImage | null>(null);

  const trimmedBody = useMemo(() => entryBody.trim(), [entryBody]);
  const toolTitles: Record<AITool, string> = {
    titles: t('editor.aiTools.titles'),
    prompts: t('editor.aiTools.prompts'),
    highlights: t('editor.aiTools.highlights'),
    image: t('editor.aiTools.image'),
  };

  useEffect(() => {
    if (!visible) {
      setLoading(false);
      setResults([]);
      setError(null);
      setGeneratedImage(null);
      setImagePhase('idle');
      setSourceImage(null);
      return;
    }

    if (tool === 'image') {
      setImagePrompt(trimmedBody.slice(0, 1200));
      setGeneratedImage(null);
      setImagePhase('idle');
      setError(null);
      setSourceImage(null);
      void fetchAiDiagnostics()
        .then(setDiagnostics)
        .catch(() => setDiagnostics(null));
      return;
    }

    if (trimmedBody.length < MIN_TEXT_BODY_LENGTH) {
      setError('Write a little more before using this AI tool.');
      setResults([]);
      return;
    }

    let cancelled = false;

    async function runTool() {
      setLoading(true);
      setResults([]);
      setError(null);

      try {
        if (tool === 'titles') {
          const titles = await fetchTitleSuggestions(trimmedBody);
          if (!cancelled) setResults(titles);
          return;
        }
        if (tool === 'prompts') {
          const prompts = await fetchWritingPrompts(trimmedBody);
          if (!cancelled) setResults(prompts);
          return;
        }
        const highlights = await fetchHighlights(trimmedBody);
        if (!cancelled) setResults(highlights);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'AI request failed.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    runTool();

    return () => {
      cancelled = true;
    };
  }, [tool, trimmedBody, visible]);

  const applyTextResult = (item: string) => {
    if (tool === 'titles') {
      onApplyTitle(item);
    } else {
      onAppendText(item);
    }
    onClose();
  };

  const generateImage = async () => {
    const prompt = imagePrompt.trim();
    if ((prompt || trimmedBody).length < MIN_IMAGE_PROMPT_LENGTH) {
      setError('Add a short prompt or write more in the entry first.');
      return;
    }
    setError(null);
    setGeneratedImage(null);
    try {
      let sourceImageStorageKey = sourceImage?.storage_key ?? null;
      if (sourceImage && !sourceImageStorageKey) {
        setSourceImage({ ...sourceImage, uploading: true });
        const uploaded = await uploadPhoto(sourceImage.uri, sourceImage.mimeType, 'ai-reference');
        sourceImageStorageKey = uploaded.storage_key;
        setSourceImage({
          uri: uploaded.public_url,
          mimeType: sourceImage.mimeType,
          storage_key: uploaded.storage_key,
          uploading: false,
        });
      }

      setImagePhase('queued');
      const jobId = await startImageGen(trimmedBody, {
        prompt,
        style: imageStyle,
        intensity: imageIntensity,
        sourceImageStorageKey,
      });
      setImagePhase('generating');
      const completed = await pollImageJob(jobId);
      setGeneratedImage(completed);
      setImagePhase('done');
    } catch (err) {
      setImagePhase('failed');
      setSourceImage((current) => (current ? { ...current, uploading: false } : current));
      setError(err instanceof Error ? err.message : 'Image generation failed.');
    }
  };

  const addPhoto = () => {
    if (generatedImage) {
      onAddPhoto(generatedImage);
      onClose();
    }
  };

  const pickSourceImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setError('Photo library permission is required.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.9,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    setError(null);
    setGeneratedImage(null);
    setImagePhase('idle');
    setSourceImage({
      uri: asset.uri,
      mimeType: asset.mimeType ?? 'image/jpeg',
      storage_key: null,
      uploading: false,
    });
  };

  return (
    <Modal animationType="slide" transparent visible={visible} onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>{toolTitles[tool]}</Text>
            <Pressable hitSlop={10} onPress={onClose}>
              <Text style={styles.close}>{t('common.done')}</Text>
            </Pressable>
          </View>

          {tool === 'image' ? (
            <ImageForm
              diagnostics={diagnostics}
              error={error}
              generatedImage={generatedImage}
              imageIntensity={imageIntensity}
              imagePhase={imagePhase}
              imagePrompt={imagePrompt}
              imageStyle={imageStyle}
              sourceImage={sourceImage}
              onAddPhoto={addPhoto}
              onGenerate={generateImage}
              onPromptChange={setImagePrompt}
              onPickSourceImage={pickSourceImage}
              onRemoveSourceImage={() => setSourceImage(null)}
              onSetIntensity={setImageIntensity}
              onSetStyle={setImageStyle}
              onDiscard={onClose}
            />
          ) : loading ? (
            <View style={styles.loading}>
              <ActivityIndicator />
            </View>
          ) : (
            <>
              {error ? <Text style={styles.error}>{error}</Text> : null}
              <FlatList
                data={results}
                keyExtractor={(item, index) => `${item}-${index}`}
                renderItem={({ item }) => (
                  <Pressable style={styles.row} onPress={() => applyTextResult(item)}>
                    <Text style={styles.rowText}>{item}</Text>
                  </Pressable>
                )}
                ListEmptyComponent={<Text style={styles.empty}>{t('common.tryAgain')}</Text>}
                contentContainerStyle={results.length === 0 ? styles.emptyList : undefined}
              />
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

function ImageForm({
  diagnostics,
  error,
  generatedImage,
  imageIntensity,
  imagePhase,
  imagePrompt,
  imageStyle,
  sourceImage,
  onAddPhoto,
  onGenerate,
  onPromptChange,
  onPickSourceImage,
  onRemoveSourceImage,
  onSetIntensity,
  onSetStyle,
  onDiscard,
}: {
  diagnostics: AiDiagnostics | null;
  error: string | null;
  generatedImage: GeneratedImage | null;
  imageIntensity: ImageIntensity;
  imagePhase: ImagePhase;
  imagePrompt: string;
  imageStyle: ImageStyle;
  sourceImage: SourceImage | null;
  onAddPhoto: () => void;
  onGenerate: () => void;
  onPromptChange: (value: string) => void;
  onPickSourceImage: () => void;
  onRemoveSourceImage: () => void;
  onSetIntensity: (value: ImageIntensity) => void;
  onSetStyle: (value: ImageStyle) => void;
  onDiscard: () => void;
}) {
  const busy = imagePhase === 'queued' || imagePhase === 'generating';
  const uploadingSource = Boolean(sourceImage?.uploading);
  const status =
    imagePhase === 'queued'
      ? 'Queued...'
      : imagePhase === 'generating'
        ? 'Generating image...'
        : imagePhase === 'failed'
          ? 'Failed'
          : imagePhase === 'done'
            ? 'Ready'
            : 'Ready to generate';

  return (
    <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      <Text style={styles.label}>Upload your photo</Text>
      <Pressable style={styles.sourceBox} onPress={onPickSourceImage} disabled={busy}>
        {sourceImage ? (
          <>
            <Image source={{ uri: sourceImage.uri }} style={styles.sourceThumb} resizeMode="contain" />
            <View style={styles.sourceTextWrap}>
              <Text style={styles.sourceTitle}>
                {sourceImage.uploading ? 'Uploading source photo...' : 'Source photo ready'}
              </Text>
              <Text style={styles.sourceSub}>Use this photo as the visual reference.</Text>
            </View>
            {sourceImage.uploading ? (
              <ActivityIndicator />
            ) : (
              <Pressable hitSlop={8} onPress={onRemoveSourceImage}>
                <Text style={styles.removeSource}>Remove</Text>
              </Pressable>
            )}
          </>
        ) : (
          <>
            <View style={styles.sourceIcon}>
              <Text style={styles.sourceIconText}>+</Text>
            </View>
            <View style={styles.sourceTextWrap}>
              <Text style={styles.sourceTitle}>Add optional source photo</Text>
              <Text style={styles.sourceSub}>Transform a real memory with the prompt below.</Text>
            </View>
          </>
        )}
      </Pressable>

      <Text style={styles.label}>Prompt</Text>
      <TextInput
        value={imagePrompt}
        onChangeText={onPromptChange}
        placeholder="Describe the memory, mood, or symbol you want to visualize."
        placeholderTextColor="#9ca3af"
        style={styles.promptInput}
        multiline
        textAlignVertical="top"
      />

      <Text style={styles.label}>Style</Text>
      <View style={styles.styleCards}>
        {IMAGE_STYLES.map((item) => (
          <StyleCard
            key={item.value}
            active={imageStyle === item.value}
            label={item.label}
            preview={item.preview}
            onPress={() => onSetStyle(item.value)}
          />
        ))}
      </View>

      <Text style={styles.label}>Intensity</Text>
      <View style={styles.chips}>
        {IMAGE_INTENSITIES.map((item) => (
          <Chip
            key={item.value}
            active={imageIntensity === item.value}
            label={item.label}
            onPress={() => onSetIntensity(item.value)}
          />
        ))}
      </View>

      <View style={styles.diagnostics}>
        <Text style={styles.diagnosticsText}>
          {diagnostics
            ? `OpenAI ${diagnostics.openai_configured ? 'ready' : 'missing'} · R2 ${
                diagnostics.r2_configured ? 'ready' : 'missing'
              } · Queue ${diagnostics.queue_reachable ? 'ready' : 'offline'}`
            : 'Checking AI configuration...'}
        </Text>
        {diagnostics ? (
          <Text style={styles.diagnosticsText}>
            {diagnostics.image_model} · {diagnostics.image_size}
          </Text>
        ) : null}
      </View>

      <View style={styles.statusRow}>
        <Text style={styles.status}>{status}</Text>
        {busy ? <ActivityIndicator /> : null}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {generatedImage ? (
        <View style={styles.imageWrap}>
          <Image
            source={{ uri: generatedImage.public_url }}
            style={styles.image}
            resizeMode="contain"
          />
        </View>
      ) : null}

      <View style={styles.actions}>
        <Pressable style={[styles.button, styles.secondaryButton]} onPress={onDiscard}>
          <Text style={styles.secondaryButtonText}>Discard</Text>
        </Pressable>
        <Pressable
          style={[
            styles.button,
            styles.primaryButton,
            (busy || uploadingSource) && styles.disabledButton,
          ]}
          disabled={busy || uploadingSource}
          onPress={generatedImage ? onAddPhoto : onGenerate}
        >
          <Text style={styles.primaryButtonText}>
            {generatedImage
              ? 'Add to entry'
              : uploadingSource
                ? 'Uploading...'
                : busy
                  ? 'Generating...'
                  : sourceImage
                    ? 'Transform image'
                    : 'Generate'}
          </Text>
        </Pressable>
      </View>
      {generatedImage ? (
        <Pressable style={styles.regenerate} onPress={onGenerate} disabled={busy}>
          <Text style={styles.regenerateText}>Regenerate</Text>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

function Chip({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable style={[styles.chip, active && styles.chipActive]} onPress={onPress}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

function StyleCard({
  active,
  label,
  preview,
  onPress,
}: {
  active: boolean;
  label: string;
  preview: ImageSourcePropType;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={[styles.styleCard, active && styles.styleCardActive]}
      onPress={onPress}
    >
      <Image source={preview} style={styles.stylePreview} resizeMode="cover" />
      <Text style={[styles.styleCardText, active && styles.styleCardTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  sheet: {
    maxHeight: '88%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: '#fff',
    padding: 20,
    paddingBottom: 28,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  close: {
    fontSize: 15,
    fontWeight: '600',
    color: '#2563eb',
  },
  loading: {
    minHeight: 220,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    borderRadius: 14,
    backgroundColor: '#f3f4f6',
    padding: 16,
    marginBottom: 10,
  },
  rowText: {
    fontSize: 16,
    lineHeight: 22,
    color: '#111827',
  },
  emptyList: {
    minHeight: 160,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: {
    fontSize: 15,
    color: '#6b7280',
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 14,
    marginBottom: 8,
  },
  promptInput: {
    minHeight: 116,
    borderRadius: 14,
    backgroundColor: '#f3f4f6',
    padding: 14,
    fontSize: 15,
    lineHeight: 21,
    color: '#111827',
  },
  sourceBox: {
    minHeight: 72,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  sourceIcon: {
    width: 46,
    height: 46,
    borderRadius: 12,
    backgroundColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sourceIconText: {
    color: '#111827',
    fontSize: 24,
    fontWeight: '600',
    lineHeight: 26,
  },
  sourceThumb: {
    width: 52,
    height: 52,
    borderRadius: 12,
    backgroundColor: '#e5e7eb',
  },
  sourceTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  sourceTitle: {
    color: '#111827',
    fontSize: 14,
    fontWeight: '700',
  },
  sourceSub: {
    color: '#6b7280',
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2,
  },
  removeSource: {
    color: '#b91c1c',
    fontSize: 12,
    fontWeight: '700',
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  styleCards: {
    gap: 10,
  },
  styleCard: {
    minHeight: 78,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
    padding: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  styleCardActive: {
    borderColor: '#111827',
    backgroundColor: '#f3f4f6',
  },
  stylePreview: {
    width: 88,
    height: 58,
    borderRadius: 10,
    backgroundColor: '#e5e7eb',
  },
  styleCardText: {
    color: '#111827',
    fontSize: 14,
    fontWeight: '700',
  },
  styleCardTextActive: {
    color: '#111827',
  },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipActive: {
    borderColor: '#111827',
    backgroundColor: '#111827',
  },
  chipText: {
    color: '#111827',
    fontSize: 13,
    fontWeight: '600',
  },
  chipTextActive: {
    color: '#fff',
  },
  diagnostics: {
    borderRadius: 12,
    backgroundColor: '#f9fafb',
    padding: 12,
    marginTop: 16,
    gap: 4,
  },
  diagnosticsText: {
    color: '#6b7280',
    fontSize: 12,
  },
  statusRow: {
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  status: {
    color: '#374151',
    fontSize: 13,
    fontWeight: '600',
  },
  error: {
    color: '#b91c1c',
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 10,
  },
  imageWrap: {
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  image: {
    width: 300,
    height: 300,
    borderRadius: 16,
    backgroundColor: '#f3f4f6',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  button: {
    flex: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  disabledButton: {
    opacity: 0.65,
  },
  primaryButton: {
    backgroundColor: '#111827',
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  secondaryButton: {
    backgroundColor: '#e5e7eb',
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  regenerate: {
    alignItems: 'center',
    paddingVertical: 14,
  },
  regenerateText: {
    color: '#2563eb',
    fontSize: 14,
    fontWeight: '700',
  },
});
