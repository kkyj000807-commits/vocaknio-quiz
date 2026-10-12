import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { useColors } from "@/hooks/use-colors";
import type { ChoiceLang } from "@/lib/quiz-engine";
import type { QuizMode } from "@/lib/vocab";

type MeaningStudyRequest = {
  mode: QuizMode;
  choiceLang: ChoiceLang;
  rangeId: string;
  rangeStart: number;
  rangeEnd: number;
  count: number;
  reviewKeys?: string;
  bookmarkNums?: string;
};

/** A deliberate new mode, never a replacement answer in the original mode. */
export function buildExplicitMeaningStudyRoute(request: MeaningStudyRequest) {
  const isEnglishVocabularyMode = ["definition-choice", "syn-choice", "syn-kor-choice", "syn-type"].includes(request.mode)
    || (request.mode === "kor-choice" && request.choiceLang === "english");
  // Do not downgrade exact-sense reviews or older item-specific review links.
  if (!isEnglishVocabularyMode || request.reviewKeys?.trim() || request.bookmarkNums?.trim()) return null;
  if (!Number.isInteger(request.count) || request.count <= 0 || request.count > 200
    || !Number.isInteger(request.rangeStart) || request.rangeStart < 0
    || !Number.isInteger(request.rangeEnd) || request.rangeEnd < request.rangeStart) return null;
  return {
    pathname: "/quiz" as const,
    params: {
      mode: "kor-choice" as const,
      choiceLang: "korean" as const,
      rangeId: request.rangeId,
      rangeStart: request.rangeStart,
      rangeEnd: request.rangeEnd,
      count: request.count,
    },
  };
}

type MeaningStudyRoute = NonNullable<ReturnType<typeof buildExplicitMeaningStudyRoute>>;

export function QuizSessionHold({ onStart, onBackup }: { onStart: () => void; onBackup: () => void }) {
  const s = styles(useColors());
  return <ScrollView contentContainerStyle={s.container}>
    <Text style={s.title}>이전 문제는 다시 검토 중입니다</Text>
    <Text style={s.note}>내용이 갱신되었거나 출제가 보류된 문항이 있어 그대로 이어 풀 수 없습니다. 기존 답안·선지·학습 결과를 다시 채점하거나 삭제하지 않습니다.</Text>
    <Text style={s.note}>새로 시작하면 이전 세션 원본을 기기에 별도 보관합니다. 설정의 학습 기록 백업에도 포함됩니다.</Text>
    <Pressable accessibilityRole="button" accessibilityLabel="이전 원본 보관 후 새 문제 시작" style={s.button} onPress={onStart}>
      <Text style={s.buttonText}>원본 보관 후 새 문제 시작</Text>
    </Pressable>
    <Pressable accessibilityRole="button" accessibilityLabel="학습 기록 백업 설정 열기" style={s.settingsButton} onPress={onBackup}>
      <Text style={s.settingsText}>먼저 백업하기</Text>
    </Pressable>
  </ScrollView>;
}

export function QuizEmptyState({ ready, request, onSettings, onMeaningStudy }: {
  ready: boolean;
  request: MeaningStudyRequest;
  onSettings: () => void;
  onMeaningStudy: (route: MeaningStudyRoute) => void;
}) {
  const colors = useColors();
  const route = ready ? buildExplicitMeaningStudyRoute(request) : null;
  const s = styles(colors);
  return (
    <ScrollView contentContainerStyle={s.container}>
      <Text style={s.emoji}>{ready ? "📭" : "⏳"}</Text>
      <Text style={s.title}>{ready ? "출제할 문제가 없습니다" : "문제를 준비하고 있습니다"}</Text>
      {ready && <>
        <Text style={s.note}>선택한 범위·유형·숙달 상태에서 출제 가능한 문항이 없습니다.</Text>
        {route && <View style={s.action}>
          <Text style={s.note}>
            같은 범위의 원자료 한국어 뜻으로 새 학습을 시작할 수 있습니다. 기존 영영·동의어 문제의 정답을 대체하지 않습니다.
          </Text>
          <Pressable accessibilityRole="button" accessibilityLabel="같은 범위의 한국어 뜻 문제로 전환"
            style={s.button} onPress={() => onMeaningStudy(route)}>
            <Text style={s.buttonText}>한국어 뜻 문제로 전환</Text>
          </Pressable>
        </View>}
        <Pressable accessibilityRole="button" accessibilityLabel="문제 풀이 설정으로 돌아가기"
          style={s.settingsButton} onPress={onSettings}>
          <Text style={s.settingsText}>문제 풀이 설정으로 돌아가기</Text>
        </Pressable>
      </>}
    </ScrollView>
  );
}

const styles = (colors: ReturnType<typeof useColors>) => StyleSheet.create({
  container: { flexGrow: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 24, paddingVertical: 24 },
  emoji: { fontSize: 48, marginBottom: 16 },
  title: { fontSize: 19, fontWeight: "700", color: colors.foreground, textAlign: "center" },
  note: { marginTop: 8, fontSize: 14, lineHeight: 21, textAlign: "center", color: colors.dim },
  action: { alignItems: "center", width: "100%" },
  button: { marginTop: 20, minHeight: 44, justifyContent: "center", borderRadius: 12, paddingHorizontal: 18, paddingVertical: 12, backgroundColor: colors.primary },
  buttonText: { color: "#FFFFFF", fontWeight: "700", textAlign: "center" },
  settingsButton: { marginTop: 12, minHeight: 44, justifyContent: "center", paddingHorizontal: 8, paddingVertical: 12 },
  settingsText: { color: colors.primary, fontWeight: "700", textAlign: "center" },
});
