import React from "react";
import { Text, View } from "react-native";
import { useColors } from "@/hooks/use-colors";
import type { QuizQuestion } from "@/lib/quiz-engine";
import { quizReadingContrast } from "@/lib/book-reading-contrast";
import { getDefinitionWalkthrough } from "@/lib/definition-walkthrough";

/** Read only the current question. Never look up a different sense by spelling. */
export function QuizCorrectFeedback({ question: q, answered, skipped, selectedChoice }: {
  question: QuizQuestion; answered: boolean; skipped: boolean; selectedChoice: number | null;
}) {
  const colors = useColors();
  const selected = selectedChoice == null ? undefined : q.choices[selectedChoice];
  if (!answered || q.sentenceCompletion || (!skipped && (!selected || selected.isCorrect))) return null;
  const correct = q.choices.find(choice => choice.isCorrect);
  if (!correct) return null;
  const contrast = quizReadingContrast(q.item);
  const meaning = correct.meaning.replace(/^같은 sense의 핵심 뜻\s*·\s*/u, "").trim();
  const partiality = q.synonymRecall?.senseId === "partisanship%1:09:00::" && correct.value.toLowerCase() === "partiality";
  const walkthrough = getDefinitionWalkthrough(q.definitionRecall ?? q.synonymRecall);
  const gloss = partiality ? "편파성 · 한쪽을 더 편드는 성향" : q.definitionRecall && walkthrough
    ? walkthrough.headlineKo : meaning === correct.label ? correct.word : meaning;
  const reviewed = q.sense?.choices.find(choice => choice.id === q.sense?.correctId);
  const reason = partiality
    ? "partisanship은 특정 당파나 입장을 편드는 태도이고, partiality는 어느 한쪽을 더 좋게 보거나 대하는 편향입니다. 여기서는 ‘공정하지 않고 한쪽에 기운다’는 점이 같습니다."
    : reviewed?.reasonKo || walkthrough?.quickKo || q.recall?.contextExplanationKo || q.recall?.conciseEnglishDefinition ||
      q.synonymRecall?.definition || q.definitionRecall?.definition ||
      (q.answerKind === "synonym" && gloss ? `${q.item.w}의 ‘${q.item.k_short}’라는 뜻에 해당하는 표현입니다.` : "");
  return <View accessibilityLabel="정답 해설" style={{ marginTop: 12, borderRadius: 10, borderWidth: 1, borderColor: "rgba(248,113,113,0.25)", backgroundColor: "rgba(248,113,113,0.08)", padding: 14, gap: 5 }}>
    <Text style={{ color: colors.error, fontSize: 12, fontWeight: "700" }}>정답</Text>
    <Text style={{ color: colors.foreground, fontSize: 17, fontWeight: "700" }}>{correct.label}</Text>
    {!!gloss && gloss !== correct.label && <Text style={{ color: colors.foreground }}>{gloss}</Text>}
    {!!reason && reason !== gloss && <Text style={{ color: colors.foreground, lineHeight: 22 }}>{reason}</Text>}
    {contrast && <>
      <Text style={{ color: colors.foreground, fontWeight: "700" }}>{contrast.focus}</Text>
      <Text style={{ color: colors.foreground, lineHeight: 22 }}>{contrast.en}</Text>
      <Text style={{ color: colors.foreground, lineHeight: 22 }}>{contrast.ko}</Text>
    </>}
  </View>;
}
