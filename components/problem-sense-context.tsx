import { Linking, Pressable, Text, View } from "react-native";
import { useColors } from "@/hooks/use-colors";
import type { SenseQuestion } from "@/lib/sense-questions";

/** Same prompt/feedback in main and review; unrelated senses stay in the wordbook. */
export function ProblemSenseContext({ sense, answered = false }: { sense?: SenseQuestion; answered?: boolean }) {
  const colors = useColors();
  if (!sense) return null;
  return (
    <View style={{ marginVertical: 12, padding: 14, borderRadius: 12, backgroundColor: colors.background, gap: 10 }}>
      <Text style={{ color: colors.muted, fontSize: 12 }}>{answered ? "뜻과 오답 해설" : `문맥 속 의미 판별 · ${sense.partOfSpeech}`}</Text>
      {!answered && <Text style={{ color: colors.foreground, fontSize: 17, lineHeight: 27 }}>{sense.contextEn}</Text>}
      {answered && <>
        <Text style={{ color: colors.foreground, fontSize: 15, lineHeight: 24 }}>{sense.contextKo}</Text>
        <Text style={{ color: colors.primary, fontWeight: "700", lineHeight: 22 }}>{sense.definitionKo}</Text>
        <Text style={{ color: colors.foreground, lineHeight: 23 }}>{sense.bridgeKo}</Text>
        {sense.choices.map(c => <Text key={c.id} style={{ color: c.id === sense.correctId ? colors.success : colors.muted, lineHeight: 23 }}>{c.en}: {c.reasonKo}</Text>)}
        <Text style={{ color: colors.muted, fontSize: 11, lineHeight: 18 }}>사전 뜻 교차 대조 · 자체 작성 문항/AI 편집 검수 · 시험 효과 미검증</Text>
        {sense.sources.map(source => <Pressable key={source.publisher} accessibilityRole="link" accessibilityLabel={`${source.publisher} 뜻 근거 열기`} onPress={() => { void Linking.openURL(source.url); }} style={{ minHeight: 44, justifyContent: "center" }}><Text style={{ color: colors.primary }}>{source.publisher} 뜻 근거 ↗</Text></Pressable>)}
      </>}
    </View>
  );
}
