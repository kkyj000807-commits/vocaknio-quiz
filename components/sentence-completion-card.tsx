import React from "react";
import { Text, View } from "react-native";
import { useColors } from "@/hooks/use-colors";
import { DIFFICULTY_LABELS, LOGIC_TYPE_LABELS, type SentenceCompletionQuestion } from "@/lib/sentence-completion";
import { VOCAB_BY_ID } from "@/lib/vocab";
import { WordSectionLabel } from "@/components/word-section-label";

export function SentenceCompletionPrompt({ question }: { question: SentenceCompletionQuestion }) {
  const colors = useColors();
  // Relation, linked vocabulary and Korean explanations are answer-only clues.
  return <Text selectable style={{ color: colors.foreground, fontSize: 18, lineHeight: 30, marginVertical: 16, flexShrink: 1 }}>{question.passageEn}</Text>;
}
export function SentenceCompletionAnswer({ question, selectedId }: { question: SentenceCompletionQuestion; selectedId?: string }) {
  const colors = useColors();
  const text = { color: colors.foreground, fontSize: 15, lineHeight: 24 };
  const note = { color: colors.muted, fontSize: 12, lineHeight: 20 };
  const answer = question.choices.find(c => c.id === question.correctChoiceId)!;
  const related = VOCAB_BY_ID.get(question.itemId)!;
  return <View style={{ gap: 10, borderTopWidth: 1, borderColor: colors.border, paddingTop: 16, marginTop: 16 }}>
    <Text style={{ ...text, fontWeight: "600" }}>정답 · {answer.text}</Text>
    <Text style={note}>{LOGIC_TYPE_LABELS[question.logicType]} · 난도 {DIFFICULTY_LABELS[question.difficulty]} · {question.id}</Text>
    <Text style={text}>문맥 방향 · {question.relationKo}</Text>
    <Text style={text}>결정적 단서 · {question.evidence.map(cue => `“${cue}”`).join(" / ")}</Text>
    <Text style={text}>빈칸에 필요한 의미 · {question.requiredMeaningKo}</Text>
    <Text style={text}>정답 연결 · {answer.explanationKo}</Text>
    <Text style={{ ...text, fontWeight: "600" }}>오답 배제</Text>
    {question.choices.filter(c => c.id !== question.correctChoiceId).map(c => <View key={c.id} style={{ gap: 3 }}>
      <Text style={{ ...text, fontWeight: "500", color: selectedId === `${question.id}:${c.id}` ? colors.error : colors.foreground }}>{selectedId === `${question.id}:${c.id}` ? "선택한 오답 · " : ""}{c.text}</Text>
      <Text style={text}>{c.explanationKo}</Text>
    </View>)}
    <Text style={text}>문장 해석 · {question.translationKo}</Text>
    <Text style={text}>연결 어휘 · {related.w} — {related.k_short}</Text>
    <WordSectionLabel groups={[related.group]} />
    <Text style={note}>{question.sourceNote}</Text>
    <Text style={note}>논리 문항의 성과는 관련 단어의 암기 상태와 구분하여 기록합니다.</Text>
  </View>;
}
