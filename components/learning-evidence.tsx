import React, { useState } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";

import { useColors } from "@/hooks/use-colors";
import type { ActiveRecallSense } from "@/lib/active-recall";

function sourceLabel(publisher: string) {
  if (publisher.startsWith("The Free Dictionary · ")) return publisher.replace("The Free Dictionary · ", "TFD · ");
  if (publisher.includes("Webster") && publisher.includes("Collins")) return "Webster’s · Collins";
  if (publisher.startsWith("Oxford")) return "Oxford";
  if (publisher.startsWith("Cambridge")) return "Cambridge";
  if (publisher.startsWith("Collins")) return "Collins";
  return publisher;
}

/** Evidence for reviewed editorial senses only; never a dictionary endorsement. */
export function LearningEvidence({
  entry,
}: {
  entry: Pick<ActiveRecallSense, "sources" | "sourceCheckedAt" | "exampleSentences">;
}) {
  const colors = useColors();
  const [expanded, setExpanded] = useState(false);
  const [linkFailed, setLinkFailed] = useState(false);
  const ownExamples = entry.exampleSentences.every(example => example.type === "editorial");
  // Keep the summary compact; extra pages from one publisher are not independent dictionaries.
  const sourceGroups = new Set<string>();
  const summarySources = entry.sources.filter(source => {
    if (sourceGroups.has(source.independenceGroup)) return false;
    sourceGroups.add(source.independenceGroup);
    return true;
  });
  const openSource = async (url: string) => {
    try {
      await Linking.openURL(url);
      setLinkFailed(false);
    } catch {
      setLinkFailed(true);
    }
  };

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.primary }]}>사전 근거 · 편집 노트</Text>
        <Text style={[styles.date, { color: colors.muted }]}>확인 {entry.sourceCheckedAt}</Text>
      </View>
      <Text style={[styles.summary, { color: colors.foreground }]}>뜻·구문은 사전 대조, 설명은 학습에 맞게</Text>
      <View style={styles.sources}>
        {summarySources.map((source, index) => (
          <Pressable
            key={`${source.url}:${index}`}
            accessibilityRole="link"
            accessibilityLabel={`${source.publisher} 사전 근거 열기`}
            onPress={() => void openSource(source.url)}
            style={({ pressed }) => [styles.source, { borderColor: colors.border, backgroundColor: colors.card }, pressed && styles.pressed]}
          >
            <Text style={[styles.sourceName, { color: colors.primary }]}>{sourceLabel(source.publisher)} ↗</Text>
          </Pressable>
        ))}
      </View>
      <Text style={[styles.note, { color: colors.muted }]}>
        정의는 학습용 자체 편집 · {ownExamples ? "예문은 학습용 창작" : "예문은 항목별 출처·창작 구분"}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`사전 근거·확인 범위 ${expanded ? "접기" : "펼치기"}`}
        accessibilityState={{ expanded }}
        onPress={() => setExpanded(value => !value)}
        style={styles.toggle}
      >
        <Text style={[styles.toggleText, { color: colors.primary }]}>{expanded ? "확인 범위 접기 −" : "근거·확인 범위 보기 +"}</Text>
      </Pressable>
      {expanded ? (
        <View style={styles.details}>
          {entry.sources.map((source, index) => (
            <View key={`${source.publisher}:${index}`} style={styles.detail}>
              <Pressable
                accessibilityRole="link"
                accessibilityLabel={`${source.publisher} 확인 범위·직접 근거 열기`}
                onPress={() => void openSource(source.url)}
                style={({ pressed }) => [styles.detailLink, pressed && styles.pressed]}
              >
                <Text style={[styles.fullName, { color: colors.primary }]}>{source.publisher} ↗</Text>
              </Pressable>
              <Text style={[styles.note, { color: colors.muted }]}>{source.note}</Text>
            </View>
          ))}
          <Text style={[styles.note, { color: colors.muted }]}>확인일은 위 뜻의 근거를 대조한 날짜입니다. 사전의 공식 인증이나 전체 수록어 검수 완료를 뜻하지 않습니다.</Text>
        </View>
      ) : null}
      {linkFailed ? <Text accessibilityLiveRegion="polite" style={[styles.note, { color: colors.error }]}>사전 링크를 열지 못했습니다. 연결 상태를 확인하고 다시 눌러 주세요.</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: 7, marginTop: 10, padding: 13, borderWidth: 1, borderRadius: 14 },
  header: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: 5 },
  title: { fontSize: 12, lineHeight: 18, fontWeight: "800", letterSpacing: 0.2 },
  date: { fontSize: 11, lineHeight: 18 },
  summary: { fontSize: 13, lineHeight: 21, fontWeight: "600" },
  sources: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  source: { minHeight: 44, maxWidth: "100%", paddingHorizontal: 12, paddingVertical: 10, justifyContent: "center", borderWidth: 1, borderRadius: 12 },
  sourceName: { fontSize: 13, lineHeight: 21, fontWeight: "700", flexShrink: 1 },
  note: { fontSize: 12, lineHeight: 20 },
  toggle: { minHeight: 44, justifyContent: "center" },
  toggleText: { fontSize: 12, lineHeight: 20, fontWeight: "700" },
  details: { gap: 10 },
  detail: { gap: 3 },
  detailLink: { minHeight: 44, justifyContent: "center" },
  fullName: { fontSize: 12, lineHeight: 20, fontWeight: "700" },
  pressed: { opacity: 0.7 },
});
