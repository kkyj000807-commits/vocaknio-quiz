import React from "react";
import { Linking, Pressable, Text, View } from "react-native";
import { useColors } from "@/hooks/use-colors";
import { contextTargetSpan, type SenseQuestion } from "@/lib/sense-questions";

/** Same prompt/feedback in main and review; unrelated senses stay in the wordbook. */
export function ProblemSenseContext({ sense, answered = false, contextSynonym = false }: {
  sense?: SenseQuestion; answered?: boolean; contextSynonym?: boolean;
}) {
  const colors = useColors();
  if (!sense) return null;
  const span = contextSynonym && !answered ? contextTargetSpan(sense) : null;
  const sentence = sense.contextEn;
  return (
    <View style={{ marginVertical: 12, padding: 14, borderRadius: 12, backgroundColor: colors.background, gap: 10 }}>
      <Text style={{ color: colors.muted, fontSize: 12 }}>{answered ? "뜻과 오답 해설" : contextSynonym ? "기출형 연습 · 자체 제작" : `문맥 속 의미 판별 · ${sense.partOfSpeech}`}</Text>
      {!answered && <Text style={{ color: colors.foreground, fontSize: 17, lineHeight: 27 }}
        accessibilityLabel={span ? `${sentence.slice(0, span.start)}밑줄 시작, ${sentence.slice(span.start, span.end)}, 밑줄 끝${sentence.slice(span.end)}` : undefined}>
        {span ? <>{sentence.slice(0, span.start)}<Text style={{ textDecorationLine: "underline", fontWeight: "700" }}>{sentence.slice(span.start, span.end)}</Text>{sentence.slice(span.end)}</> : sentence}
      </Text>}
      {answered && <>
        <Text style={{ color: colors.foreground, fontSize: 15, lineHeight: 24 }}>{sense.contextKo}</Text>
        {contextSynonym && <Text style={{ color: colors.foreground, lineHeight: 23 }}>문장 단서 · {sense.evidence}</Text>}
        <Text style={{ color: colors.primary, fontWeight: "700", lineHeight: 22 }}>{sense.definitionKo}</Text>
        <Text style={{ color: colors.foreground, lineHeight: 23 }}>{sense.bridgeKo}</Text>
        {sense.relation && <Text style={{ color: colors.muted, lineHeight: 23 }}>{sense.relation.constraintKo}</Text>}
        {sense.choices.map(c => <Text key={c.id} style={{ color: c.id === sense.correctId ? colors.success : colors.muted, lineHeight: 23 }}>{c.en}: {c.reasonKo}</Text>)}
        {!contextSynonym && <Text style={{ color: colors.muted, fontSize: 11, lineHeight: 18 }}>사전 뜻 교차 대조 · 자체 작성 문항/AI 편집 검수 · 시험 효과 미검증</Text>}
        {sense.sources.map(source => <Pressable key={source.publisher} accessibilityRole="link" accessibilityLabel={`${source.publisher} 뜻 근거 열기`} onPress={() => { void Linking.openURL(source.url); }} style={{ minHeight: 44, justifyContent: "center" }}><Text style={{ color: colors.primary }}>{source.publisher} 뜻 근거 ↗</Text></Pressable>)}
      </>}
    </View>
  );
}
