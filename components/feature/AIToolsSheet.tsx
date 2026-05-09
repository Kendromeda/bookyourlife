import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  fetchHighlights,
  fetchTitleSuggestions,
  fetchWritingPrompts,
  GeneratedImage,
  pollImageJob,
  startImageGen,
} from '@/utils/ai';

type AITool = 'titles' | 'prompts' | 'highlights' | 'image';

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
const MIN_IMAGE_BODY_LENGTH = 30;

const toolTitles: Record<AITool, string> = {
  titles: 'Title suggestions',
  prompts: 'Writing prompts',
  highlights: 'Highlights',
  image: 'AI image',
};

export function AIToolsSheet({
  visible,
  onClose,
  tool,
  entryBody,
  onApplyTitle,
  onAppendText,
  onAddPhoto,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<string[]>([]);
  const [generatedImage, setGeneratedImage] = useState<GeneratedImage | null>(null);

  useEffect(() => {
    if (!visible) {
      setLoading(false);
      setResults([]);
      setGeneratedImage(null);
      return;
    }

    const trimmedBody = entryBody.trim();
    const minLength = tool === 'image' ? MIN_IMAGE_BODY_LENGTH : MIN_TEXT_BODY_LENGTH;
    if (trimmedBody.length < minLength) {
      Alert.alert('Add more detail', `Write at least ${minLength} characters before using this tool.`);
      onClose();
      return;
    }

    let cancelled = false;

    async function runTool() {
      setLoading(true);
      setResults([]);
      setGeneratedImage(null);

      try {
        if (tool === 'titles') {
          const titles = await fetchTitleSuggestions(trimmedBody);
          if (!cancelled) {
            setResults(titles);
          }
          return;
        }

        if (tool === 'prompts') {
          const prompts = await fetchWritingPrompts(trimmedBody);
          if (!cancelled) {
            setResults(prompts);
          }
          return;
        }

        if (tool === 'highlights') {
          const highlights = await fetchHighlights(trimmedBody);
          if (!cancelled) {
            setResults(highlights);
          }
          return;
        }

        const jobId = await startImageGen(trimmedBody);
        const completed = await pollImageJob(jobId);
        if (!cancelled) {
          setGeneratedImage(completed);
        }
      } catch (error) {
        if (!cancelled) {
          Alert.alert('AI tool failed', error instanceof Error ? error.message : 'Please try again.');
          onClose();
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    runTool();

    return () => {
      cancelled = true;
    };
  }, [entryBody, onClose, tool, visible]);

  const applyTextResult = (item: string) => {
    if (tool === 'titles') {
      onApplyTitle(item);
    } else {
      onAppendText(item);
    }
    onClose();
  };

  const addPhoto = () => {
    if (generatedImage) {
      onAddPhoto(generatedImage);
      onClose();
    }
  };

  return (
    <Modal animationType="slide" transparent visible={visible} onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>{toolTitles[tool]}</Text>
            <Pressable hitSlop={10} onPress={onClose}>
              <Text style={styles.close}>Close</Text>
            </Pressable>
          </View>

          {loading ? (
            <View style={styles.loading}>
              <ActivityIndicator />
            </View>
          ) : tool === 'image' && generatedImage ? (
            <View style={styles.imageWrap}>
              <Image source={{ uri: generatedImage.public_url }} style={styles.image} />
              <View style={styles.actions}>
                <Pressable style={[styles.button, styles.secondaryButton]} onPress={onClose}>
                  <Text style={styles.secondaryButtonText}>Discard</Text>
                </Pressable>
                <Pressable style={[styles.button, styles.primaryButton]} onPress={addPhoto}>
                  <Text style={styles.primaryButtonText}>Add</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <FlatList
              data={results}
              keyExtractor={(item, index) => `${item}-${index}`}
              renderItem={({ item }) => (
                <Pressable style={styles.row} onPress={() => applyTextResult(item)}>
                  <Text style={styles.rowText}>{item}</Text>
                </Pressable>
              )}
              ListEmptyComponent={<Text style={styles.empty}>No results returned.</Text>}
              contentContainerStyle={results.length === 0 ? styles.emptyList : undefined}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  sheet: {
    maxHeight: '78%',
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
  imageWrap: {
    alignItems: 'center',
    gap: 18,
  },
  image: {
    width: 300,
    height: 300,
    borderRadius: 16,
    backgroundColor: '#f3f4f6',
  },
  actions: {
    width: '100%',
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    flex: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
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
});
