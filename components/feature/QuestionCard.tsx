import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Colors, Radii, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Question } from '@/utils/entries';

type Props = {
  question: Question;
  onAnswer: (q: Question) => void;
  onSkip: (q: Question) => void;
};

export function QuestionCard({ question, onAnswer, onSkip }: Props) {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  return (
    <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
      <Text style={[styles.eyebrow, { color: c.accentDark }]}>Today&apos;s question</Text>
      <Text style={[styles.text, { color: c.text }]}>{question.text}</Text>
      <View style={styles.row}>
        <TouchableOpacity style={[styles.primary, { backgroundColor: c.accent }]} onPress={() => onAnswer(question)}>
          <Text style={styles.primaryLabel}>Answer</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.ghost} onPress={() => onSkip(question)}>
          <Text style={[styles.ghostLabel, { color: c.muted }]}>Skip</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: Radii.lg,
    padding: Spacing.xl,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  eyebrow: { fontSize: 12, textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: Spacing.sm },
  text: { fontSize: 20, lineHeight: 28, marginBottom: Spacing.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  primary: { paddingVertical: Spacing.md, paddingHorizontal: Spacing.xl, borderRadius: Radii.md },
  primaryLabel: { color: '#fff', fontSize: 14, fontWeight: '600' },
  ghost: { paddingVertical: Spacing.md, paddingHorizontal: Spacing.lg },
  ghostLabel: { fontSize: 14, fontWeight: '500' },
});
