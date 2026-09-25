import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useColors } from "@/hooks/use-colors";
import type { ActiveRecallSense } from "@/lib/active-recall";

export function ActiveRecallPrompt({ recall, promptId }: { recall: ActiveRecallSense; promptId?: string }) {
  const colors = useColors();
  const prompt = recall.prompts.find(candidate => candidate.id === promptId) ?? recall.prompts[0];
  return (
    <View style={[styles.prompt, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[styles.eyebrow, { color: colors.primary }]}>
        {prompt.kind === "definition-recall" ? "EN · 정의에서 단어 인출" : "EN · 문맥에서 단어 인출"}
      </Text>
      <Text style={[styles.promptText, { color: colors.foreground }]}>{prompt.text}</Text>
      <Text style={[styles.note, { color: colors.muted }]}>한국어 뜻은 정답 확인 뒤에 표시됩니다.</Text>
    </View>
  );
}

export function ActiveRecallAnswer({ recall }: { recall: ActiveRecallSense }) {
  const colors = useColors();
  const [expanded, setExpanded] = useState(false);
  const chips = [
    ...recall.exactSynonyms.map(value => ({ value, kind: "Exact" })),
    ...recall.nearSynonyms.map(value => ({ value, kind: "Near" })),
    ...recall.variants.map(value => ({ value, kind: "Variant" })),
    ...recall.relatedWords.map(value => ({ value, kind: "Related" })),
  ].slice(0, 5);
  return (
    <View style={[styles.answer, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[styles.answerWord, { color: colors.foreground }]}>{recall.headword}</Text>
      <Text style={[styles.label, { color: colors.primary }]}>EN</Text>
      <Text style={[styles.definition, { color: colors.foreground }]}>{recall.conciseEnglishDefinition}</Text>
      <Text style={[styles.label, { color: colors.primary }]}>KR</Text>
      <Text style={[styles.korean, { color: colors.foreground }]}>{recall.koreanMeaning}</Text>
      {recall.contextExplanationKo ? <>
        <Text style={[styles.label, { color: colors.primary }]}>문맥 설명</Text>
        <Text style={[styles.detailText, { color: colors.foreground }]}>{recall.contextExplanationKo}</Text>
      </> : null}
      {chips.length > 0 ? (
        <View style={styles.chips}>
          {chips.map(chip => (
            <View key={`${chip.kind}:${chip.value}`} style={[styles.chip, { borderColor: colors.border, backgroundColor: colors.surface }]}>
              <Text style={[styles.chipKind, { color: colors.muted }]}>{chip.kind}</Text>
              <Text style={[styles.chipText, { color: colors.foreground }]}>{chip.value}</Text>
            </View>
          ))}
        </View>
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        onPress={() => setExpanded(value => !value)}
        style={styles.more}
      >
        <Text style={[styles.moreText, { color: colors.primary }]}>{expanded ? "상세 접기 −" : "예문·전체 정의 보기 +"}</Text>
      </Pressable>
      {expanded ? (
        <View style={styles.details}>
          <Text style={[styles.label, { color: colors.primary }]}>Full EN</Text>
          <Text style={[styles.detailText, { color: colors.foreground }]}>{recall.englishDefinition}</Text>
          <Text style={[styles.label, { color: colors.primary }]}>Example</Text>
          {recall.exampleSentences.map((example, index) => (
            <View key={`${example.en}-${index}`} style={styles.example}>
              <Text style={[styles.detailText, { color: colors.foreground }]}>{example.en}</Text>
              {example.ko ? <Text style={[styles.detailText, { color: colors.foreground }]}>{example.ko}</Text> : null}
              {example.cueKo ? <Text style={[styles.note, { color: colors.muted }]}>문맥 단서: {example.cueKo}</Text> : null}
            </View>
          ))}
          <Text style={[styles.note, { color: colors.muted }]}>사전 2곳 의미 대조 · 정의와 예문은 학습용 자체 편집</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  prompt: { gap: 8, marginVertical: 12, padding: 14, borderWidth: 1, borderRadius: 12 },
  eyebrow: { fontSize: 11, lineHeight: 17, fontWeight: "800", letterSpacing: 0.5 },
  promptText: { fontSize: 17, lineHeight: 27, fontWeight: "600" },
  note: { fontSize: 11, lineHeight: 18 },
  answer: { gap: 7, marginTop: 14, padding: 16, borderWidth: 1, borderRadius: 14 },
  answerWord: { fontSize: 24, lineHeight: 31, fontWeight: "800" },
  label: { marginTop: 3, fontSize: 10, lineHeight: 16, fontWeight: "800", letterSpacing: 1.2 },
  definition: { fontSize: 15, lineHeight: 23 },
  korean: { fontSize: 14, lineHeight: 21, fontWeight: "700" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4 },
  chip: { flexDirection: "row", alignItems: "center", gap: 5, borderWidth: 1, borderRadius: 14, paddingHorizontal: 9, paddingVertical: 5 },
  chipKind: { fontSize: 9, fontWeight: "800" },
  chipText: { fontSize: 11, fontWeight: "600" },
  more: { minHeight: 44, justifyContent: "center", alignSelf: "flex-start" },
  moreText: { fontSize: 12, fontWeight: "700" },
  details: { gap: 6, paddingTop: 4 },
  example: { gap: 4 },
  detailText: { fontSize: 13, lineHeight: 21 },
});
