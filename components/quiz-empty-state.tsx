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

export type QuizPreparationFailure = "SESSION_READ" | "LEARNING_READ" | "CONTENT_PREPARE" | "SESSION_SAVE" | "STORAGE_RECOVERY";

const PREPARATION_MESSAGES: Record<QuizPreparationFailure, string> = {
  SESSION_READ: "이전 학습 세션을 확인하지 못했습니다. 원본을 유지하고 복구 상태를 확인해 주세요.",
  LEARNING_READ: "학습 상태를 확인하지 못했습니다. 기존 기록을 유지하고 다시 확인해 주세요.",
  CONTENT_PREPARE: "선택한 범위의 문제를 구성하지 못했습니다. 문제 풀이 설정으로 돌아가 범위와 유형을 확인해 주세요.",
  SESSION_SAVE: "새 학습 세션의 저장을 완료하지 못했습니다. 저장 상태를 확인한 뒤 시작할 수 있습니다.",
  STORAGE_RECOVERY: "저장·복구 상태를 확인해야 합니다. 해결되지 않은 기록은 덮어쓰지 않습니다.",
};

export function QuizSessionHold({ onStart, onBackup, onSettings, failure = "SESSION_READ", issue, canRetry = true, busy = false }: {
  onStart: () => void; onBackup: () => void; onSettings: () => void;
  failure?: QuizPreparationFailure; issue?: string | null; canRetry?: boolean; busy?: boolean;
}) {
  const s = styles(useColors());
  return <ScrollView contentContainerStyle={s.container}>
    <Text style={s.title}>학습을 준비하지 못했습니다</Text>
    <Text accessibilityLiveRegion="polite" style={s.note}>{issue || PREPARATION_MESSAGES[failure]} ({failure})</Text>
    <Text style={s.note}>이전 기록은 다시 채점하거나 삭제하지 않습니다.</Text>
    {canRetry && <Pressable accessibilityRole="button" accessibilityLabel="저장 확인 후 다시 시도"
      accessibilityState={{ disabled: busy, busy }} disabled={busy} style={s.button} onPress={onStart}>
      <Text style={s.buttonText}>{busy ? "저장 상태 확인 중…" : "다시 시도"}</Text>
    </Pressable>}
    <Pressable accessibilityRole="button" accessibilityLabel="학습 기록 백업 설정 열기" style={s.settingsButton} onPress={onBackup}>
      <Text style={s.settingsText}>기록 백업·저장 상태 확인</Text>
    </Pressable>
    <Pressable accessibilityRole="button" accessibilityLabel="문제 풀이 설정으로 돌아가기" style={s.settingsButton} onPress={onSettings}>
      <Text style={s.settingsText}>문제 풀이 설정으로 돌아가기</Text>
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
