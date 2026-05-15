import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Eyebrow, Ribbon } from '@/components/ui/Ribbon';
import { Colors, Radii, Spacing, Type } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Question } from '@/utils/entries';
import { useTranslation } from '@/utils/i18n';

type Props = {
  question: Question;
  onAnswer: (q: Question) => void;
  onSkip: (q: Question) => void;
};

/**
 * Today's question — presented like a line from a novel. Cream card on
 * paper, italic serif body, with a small bookmark ribbon flag rising
 * out of the top edge as the brand sigil.
 */
export function QuestionCard({ question, onAnswer, onSkip }: Props) {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const { t } = useTranslation();
  return (
    <View style={styles.wrap}>
      <View style={[styles.card, { backgroundColor: c.paper, borderColor: c.border }]}>
        <Eyebrow color={c.accentDark} style={{ marginBottom: Spacing.md } as any}>
          {t('editor.answering')}
        </Eyebrow>
        <Text
          style={[
            styles.text,
            { color: c.text, fontFamily: Type.italic, fontStyle: 'italic' },
          ]}
        >
          {question.text}
        </Text>
        <View style={styles.row}>
          <TouchableOpacity
            style={[styles.primary, { backgroundColor: c.text }]}
            onPress={() => onAnswer(question)}
            activeOpacity={0.9}
          >
            <Text style={[styles.primaryLabel, { color: c.background }]}>
              {t('question.answer')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.ghost} onPress={() => onSkip(question)}>
            <Text style={[styles.ghostLabel, { color: c.textSoft }]}>
              {t('question.skip')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
      <Ribbon
        width={14}
        length={48}
        color={c.accent}
        backgroundColor={c.background}
        style={{ position: 'absolute', top: -6, right: 28 } as any}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'relative' },
  card: {
    borderWidth: 1,
    borderRadius: 14,
    padding: Spacing.xl,
    paddingTop: Spacing.xl + 2,
    boxShadow: '0px 6px 12px rgba(44, 36, 33, 0.08)',
    elevation: 1,
  },
  text: {
    fontSize: 24,
    lineHeight: 30,
    marginBottom: Spacing.lg,
    letterSpacing: -0.2,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  primary: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderRadius: Radii.pill,
  },
  primaryLabel: { fontSize: 13, fontWeight: '600', letterSpacing: 0.2 },
  ghost: { paddingVertical: Spacing.md, paddingHorizontal: Spacing.md },
  ghostLabel: { fontSize: 13, fontWeight: '500' },
});
