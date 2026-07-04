import { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Platform,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";

import { ScreenContainer } from "@/components/screen-container";
import { VOCAB } from "@/lib/vocab";
import { useColors } from "@/hooks/use-colors";

export default function ResultScreen() {
  const colors = useColors();
  const router = useRouter();
  const params = useLocalSearchParams<{
    correct: string;
    total: string;
    wrongNums: string;
  }>();

  const correct = parseInt(params.correct ?? "0");
  const total = parseInt(params.total ?? "0");
  const wrongNums = params.wrongNums
    ? params.wrongNums.split(",").map(Number).filter(Boolean)
    : [];

  const wrongItems = wrongNums
    .map((num) => VOCAB.find((v) => v.num === num))
    .filter(Boolean);

  const pct = total > 0 ? Math.round((correct / total) * 100) : 0;

  const haptic = () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const getGradeEmoji = () => {
    if (pct >= 90) return "🏆";
    if (pct >= 70) return "⭐";
    if (pct >= 50) return "💪";
    return "📚";
  };

  const getGradeText = () => {
    if (pct >= 90) return "완벽해요!";
    if (pct >= 70) return "잘 했어요!";
    if (pct >= 50) return "조금 더 노력해요";
    return "복습이 필요해요";
  };

  const s = styles(colors);

  return (
    <ScreenContainer containerClassName="bg-background">
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Result Card */}
        <View style={s.resultCard}>
          <Text style={s.gradeEmoji}>{getGradeEmoji()}</Text>
          <Text style={s.scoreText}>{pct}%</Text>
          <Text style={s.gradeText}>{getGradeText()}</Text>
          <Text style={s.subText}>
            {total}문제 중 {correct}개 정답
          </Text>

          {/* Score Breakdown */}
          <View style={s.breakdownRow}>
            <View style={s.breakdownItem}>
              <Text style={[s.breakdownNum, { color: colors.success }]}>{correct}</Text>
              <Text style={s.breakdownLabel}>정답</Text>
            </View>
            <View style={s.breakdownDivider} />
            <View style={s.breakdownItem}>
              <Text style={[s.breakdownNum, { color: colors.error }]}>{total - correct}</Text>
              <Text style={s.breakdownLabel}>오답</Text>
            </View>
            <View style={s.breakdownDivider} />
            <View style={s.breakdownItem}>
              <Text style={[s.breakdownNum, { color: colors.primary2 as string }]}>{total}</Text>
              <Text style={s.breakdownLabel}>총 문제</Text>
            </View>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={s.btnRow}>
          <Pressable
            style={({ pressed }) => [s.btn, s.btnPrimary, pressed && { opacity: 0.85 }]}
            onPress={() => {
              haptic();
              router.replace("/practice");
            }}
          >
            <Text style={s.btnPrimaryText}>🏠 홈으로</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [s.btn, s.btnSecondary, pressed && { opacity: 0.85 }]}
            onPress={() => {
              haptic();
              router.back();
            }}
          >
            <Text style={s.btnSecondaryText}>↩ 다시 풀기</Text>
          </Pressable>
        </View>
        {/* 오답 전용 문제풀이 바로 시작 */}
        {wrongNums.length > 0 && (
          <View style={{ paddingHorizontal: 16, marginBottom: 16 }}>
            <Pressable
              style={({ pressed }) => [s.btn, s.btnWrong, { width: "100%" }, pressed && { opacity: 0.85 }]}
              onPress={() => {
                haptic();
                router.replace({
                  pathname: "/wrong-quiz",
                  params: {
                    wrongNums: wrongNums.join(","),
                    count: Math.min(wrongNums.length, 20),
                  },
                });
              }}
            >
              <Text style={s.btnWrongText}>🔴 이번 오답 바로 복습하기 ({wrongNums.length}개)</Text>
            </Pressable>
          </View>
        )}

        {/* Wrong Items List */}
        {wrongItems.length > 0 && (
          <View style={s.wrongSection}>
            <Text style={s.wrongTitle}>오답 목록 ({wrongItems.length}개)</Text>
            {wrongItems.map((item, idx) => (
              <View key={idx} style={s.wrongItem}>
                <View style={s.wrongWordRow}>
                  <Text style={s.wrongWord}>{item!.w}</Text>
                  {item!.p ? (
                    <Text style={s.wrongIpa}>{item!.p}</Text>
                  ) : null}
                </View>
                <Text style={s.wrongKor} numberOfLines={2}>
                  {item!.k_short}
                </Text>
                {item!.s.length > 0 && (
                  <View style={s.synTagRow}>
                    {item!.s.slice(0, 3).map((syn, i) => (
                      <View key={i} style={s.synTag}>
                        <Text style={s.synTagText}>{syn}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = (colors: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    resultCard: {
      margin: 16,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 20,
      padding: 32,
      alignItems: "center",
    },
    gradeEmoji: {
      fontSize: 48,
      marginBottom: 12,
    },
    scoreText: {
      fontSize: 52,
      fontWeight: "700",
      color: colors.primary2 as string,
      fontVariant: ["tabular-nums"],
    },
    gradeText: {
      fontSize: 18,
      fontWeight: "700",
      color: colors.foreground,
      marginTop: 8,
    },
    subText: {
      fontSize: 13,
      color: colors.dim,
      marginTop: 6,
    },
    breakdownRow: {
      flexDirection: "row",
      alignItems: "center",
      marginTop: 24,
      gap: 0,
    },
    breakdownItem: {
      flex: 1,
      alignItems: "center",
    },
    breakdownNum: {
      fontSize: 24,
      fontWeight: "700",
      fontVariant: ["tabular-nums"],
    },
    breakdownLabel: {
      fontSize: 11,
      color: colors.dim,
      marginTop: 4,
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    breakdownDivider: {
      width: 1,
      height: 36,
      backgroundColor: colors.border,
    },
    btnRow: {
      flexDirection: "row",
      gap: 10,
      paddingHorizontal: 16,
      marginBottom: 16,
    },
    btn: {
      flex: 1,
      borderRadius: 12,
      paddingVertical: 14,
      alignItems: "center",
    },
    btnPrimary: {
      backgroundColor: colors.primary,
    },
    btnPrimaryText: {
      fontSize: 14,
      fontWeight: "700",
      color: "#fff",
    },
    btnSecondary: {
      backgroundColor: colors.card,
      borderWidth: 2,
      borderColor: colors.border,
    },
    btnSecondaryText: {
      fontSize: 14,
      fontWeight: "700",
      color: colors.muted,
    },
    wrongSection: {
      paddingHorizontal: 16,
    },
    wrongTitle: {
      fontSize: 13,
      fontWeight: "700",
      color: colors.dim,
      letterSpacing: 1,
      textTransform: "uppercase",
      marginBottom: 12,
    },
    wrongItem: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: "rgba(248,113,113,0.25)",
      borderRadius: 12,
      padding: 14,
      marginBottom: 8,
    },
    wrongWordRow: {
      flexDirection: "row",
      alignItems: "baseline",
      gap: 8,
      marginBottom: 4,
    },
    wrongWord: {
      fontSize: 15,
      fontWeight: "700",
      color: colors.error,
    },
    wrongIpa: {
      fontSize: 10,
      color: colors.dim,
      fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    },
    wrongKor: {
      fontSize: 12,
      color: colors.dim,
      marginTop: 2,
      lineHeight: 16,
    },
    synTagRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 6,
      marginTop: 8,
    },
    synTag: {
      backgroundColor: "rgba(108,99,255,0.12)",
      borderWidth: 1,
      borderColor: "rgba(108,99,255,0.25)",
      borderRadius: 20,
      paddingHorizontal: 10,
      paddingVertical: 3,
    },
    synTagText: {
      fontSize: 11,
      color: colors.primary2 as string,
    },
    btnWrong: {
      backgroundColor: "rgba(248,113,113,0.12)",
      borderWidth: 2,
      borderColor: "rgba(248,113,113,0.35)",
    },
    btnWrongText: {
      fontSize: 14,
      fontWeight: "700",
      color: colors.error,
    },
  });
