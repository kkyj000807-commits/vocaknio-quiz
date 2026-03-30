import { useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Platform,
} from "react-native";
import { useFocusEffect } from "expo-router";

import { ScreenContainer } from "@/components/screen-container";
import { loadStats, type StatsData, loadStudyTime, type StudyTimeData, formatStudyTime } from "@/lib/store";
import { useColors } from "@/hooks/use-colors";

export default function StatsScreen() {
  const colors = useColors();
  const [stats, setStats] = useState<StatsData | null>(null);
  const [studyTime, setStudyTime] = useState<StudyTimeData | null>(null);

  useFocusEffect(
    useCallback(() => {
      loadStats().then(setStats);
      loadStudyTime().then(setStudyTime);
    }, [])
  );

  const s = styles(colors);

  const accuracy =
    stats && stats.totalAnswered > 0
      ? Math.round((stats.totalCorrect / stats.totalAnswered) * 100)
      : 0;

  return (
    <ScreenContainer containerClassName="bg-background">
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={s.header}>
          <Text style={s.headerTitle}>학습 통계</Text>
          <Text style={s.headerSub}>나의 편입 어휘 학습 현황</Text>
        </View>

        {/* Main Stats Grid */}
        <View style={s.statsGrid}>
          <View style={[s.statCard, s.statCardLarge]}>
            <Text style={s.statEmoji}>🎯</Text>
            <Text style={[s.statBigNum, { color: colors.primary2 as string }]}>
              {accuracy}%
            </Text>
            <Text style={s.statCardLabel}>전체 정답률</Text>
          </View>
          <View style={[s.statCard, s.statCardLarge]}>
            <Text style={s.statEmoji}>🔥</Text>
            <Text style={[s.statBigNum, { color: colors.warning }]}>
              {stats?.streak ?? 0}
            </Text>
            <Text style={s.statCardLabel}>연속 학습일</Text>
          </View>
        </View>

        <View style={s.statsGrid}>
          <View style={s.statCard}>
            <Text style={s.statEmoji}>📖</Text>
            <Text style={[s.statNum, { color: colors.success }]}>
              {stats?.totalAnswered ?? 0}
            </Text>
            <Text style={s.statCardLabel}>총 풀이 수</Text>
          </View>
          <View style={s.statCard}>
            <Text style={s.statEmoji}>✅</Text>
            <Text style={[s.statNum, { color: colors.success }]}>
              {stats?.totalCorrect ?? 0}
            </Text>
            <Text style={s.statCardLabel}>총 정답 수</Text>
          </View>
          <View style={s.statCard}>
            <Text style={s.statEmoji}>📅</Text>
            <Text style={[s.statNum, { color: colors.primary2 as string }]}>
              {stats?.todayAnswered ?? 0}
            </Text>
            <Text style={s.statCardLabel}>오늘 풀이</Text>
          </View>
        </View>

        {/* 학습 시간 섹션 */}
        <View style={s.timeSection}>
          <Text style={s.sectionTitle}>⏱ 순공부 시간</Text>
          <View style={s.timeGrid}>
            <View style={s.timeCard}>
              <Text style={s.timeEmoji}>📅</Text>
              <Text style={[s.timeNum, { color: colors.primary }]}>
                {formatStudyTime(studyTime?.todaySeconds ?? 0)}
              </Text>
              <Text style={s.timeLabel}>오늘</Text>
            </View>
            <View style={[s.timeCard, s.timeCardMid]}>
              <Text style={s.timeEmoji}>📆</Text>
              <Text style={[s.timeNum, { color: colors.success }]}>
                {formatStudyTime(studyTime?.weekSeconds ?? 0)}
              </Text>
              <Text style={s.timeLabel}>이번 주</Text>
            </View>
            <View style={s.timeCard}>
              <Text style={s.timeEmoji}>🏅</Text>
              <Text style={[s.timeNum, { color: colors.warning }]}>
                {formatStudyTime(studyTime?.totalSeconds ?? 0)}
              </Text>
              <Text style={s.timeLabel}>누적</Text>
            </View>
          </View>
        </View>

        {/* Progress Bar */}
        {stats && stats.totalAnswered > 0 && (
          <View style={s.accuracySection}>
            <Text style={s.sectionTitle}>정답률 현황</Text>
            <View style={s.accuracyBar}>
              <View
                style={[
                  s.accuracyFill,
                  { width: `${accuracy}%` as any },
                ]}
              />
            </View>
            <View style={s.accuracyLabels}>
              <Text style={s.accuracyLabel}>0%</Text>
              <Text style={[s.accuracyLabel, { color: colors.primary2 as string }]}>
                {accuracy}%
              </Text>
              <Text style={s.accuracyLabel}>100%</Text>
            </View>
          </View>
        )}

        {/* Encouragement */}
        <View style={s.encourageCard}>
          <Text style={s.encourageTitle}>
            {accuracy >= 80
              ? "🏆 훌륭한 실력이에요!"
              : accuracy >= 60
              ? "⭐ 꾸준히 성장 중이에요!"
              : "💪 매일 조금씩 공부해요!"}
          </Text>
          <Text style={s.encourageText}>
            {accuracy >= 80
              ? "편입 시험 준비가 잘 되고 있어요. 계속 유지하세요!"
              : accuracy >= 60
              ? "좋은 페이스입니다. 오답 단어를 복습해 보세요!"
              : "동의어 고르기 모드로 반복 학습을 시작해 보세요!"}
          </Text>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = (colors: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    header: {
      paddingTop: 28,
      paddingBottom: 20,
      paddingHorizontal: 16,
    },
    headerTitle: {
      fontSize: 26,
      fontWeight: "800",
      color: colors.foreground,
      letterSpacing: -0.5,
    },
    headerSub: {
      fontSize: 13,
      color: colors.dim,
      marginTop: 4,
    },
    statsGrid: {
      flexDirection: "row",
      gap: 10,
      paddingHorizontal: 16,
      marginBottom: 10,
    },
    statCard: {
      flex: 1,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 16,
      padding: 16,
      alignItems: "center",
    },
    statCardLarge: {
      paddingVertical: 24,
    },
    statEmoji: {
      fontSize: 24,
      marginBottom: 8,
    },
    statBigNum: {
      fontSize: 36,
      fontWeight: "700",
      fontVariant: ["tabular-nums"],
    },
    statNum: {
      fontSize: 26,
      fontWeight: "700",
      fontVariant: ["tabular-nums"],
    },
    statCardLabel: {
      fontSize: 11,
      color: colors.dim,
      marginTop: 6,
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    accuracySection: {
      marginHorizontal: 16,
      marginTop: 8,
      marginBottom: 10,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 16,
      padding: 20,
    },
    sectionTitle: {
      fontSize: 13,
      fontWeight: "700",
      color: colors.muted,
      marginBottom: 14,
    },
    accuracyBar: {
      height: 8,
      backgroundColor: colors.border,
      borderRadius: 4,
      overflow: "hidden",
    },
    accuracyFill: {
      height: "100%",
      backgroundColor: colors.primary,
      borderRadius: 4,
    },
    accuracyLabels: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginTop: 6,
    },
    accuracyLabel: {
      fontSize: 11,
      color: colors.dim,
    },
    encourageCard: {
      marginHorizontal: 16,
      marginTop: 8,
      backgroundColor: "rgba(108,99,255,0.08)",
      borderWidth: 1,
      borderColor: "rgba(108,99,255,0.2)",
      borderRadius: 16,
      padding: 20,
    },
    encourageTitle: {
      fontSize: 16,
      fontWeight: "700",
      color: colors.primary2 as string,
      marginBottom: 8,
    },
    encourageText: {
      fontSize: 13,
      color: colors.muted,
      lineHeight: 20,
    },
    // 학습 시간 섹션
    timeSection: {
      marginHorizontal: 16,
      marginTop: 8,
      marginBottom: 10,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 16,
      padding: 20,
    },
    timeGrid: {
      flexDirection: "row" as const,
      gap: 0,
    },
    timeCard: {
      flex: 1,
      alignItems: "center" as const,
      paddingVertical: 8,
    },
    timeCardMid: {
      borderLeftWidth: 1,
      borderRightWidth: 1,
      borderColor: colors.border,
    },
    timeEmoji: {
      fontSize: 22,
      marginBottom: 6,
    },
    timeNum: {
      fontSize: 18,
      fontWeight: "700" as const,
      fontVariant: ["tabular-nums"] as any,
      textAlign: "center" as const,
    },
    timeLabel: {
      fontSize: 11,
      color: colors.dim,
      marginTop: 4,
      textTransform: "uppercase" as const,
      letterSpacing: 0.5,
    },
  });
