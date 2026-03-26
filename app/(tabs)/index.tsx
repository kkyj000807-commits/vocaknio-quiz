import { useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
} from "react-native";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { VOCAB, RANGES, COUNTS, QUIZ_MODES, type QuizMode } from "@/lib/vocab";
import { useColors } from "@/hooks/use-colors";

export default function HomeScreen() {
  const colors = useColors();
  const router = useRouter();
  const [selectedMode, setSelectedMode] = useState<QuizMode>("syn-choice");
  const [selectedRange, setSelectedRange] = useState("0-999");
  const [selectedCount, setSelectedCount] = useState(20);

  const haptic = useCallback(() => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, []);

  const handleStart = useCallback(() => {
    haptic();
    const range = RANGES.find((r) => r.id === selectedRange)!;
    router.push({
      pathname: "/quiz",
      params: {
        mode: selectedMode,
        rangeStart: range.start,
        rangeEnd: range.end,
        count: selectedCount,
      },
    });
  }, [selectedMode, selectedRange, selectedCount, router, haptic]);

  const s = styles(colors);

  return (
    <ScreenContainer containerClassName="bg-background">
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={s.header}>
          <Text style={s.headerTitle}>편입VOCA</Text>
          <View style={s.badge}>
            <Text style={s.badgeText}>
              기출·실전 · {VOCAB.length.toLocaleString()}개 단어 · IPA 발음기호
            </Text>
          </View>
        </View>

        {/* Quiz Mode */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>퀴즈 모드</Text>
          <View style={s.modeGrid}>
            {QUIZ_MODES.map((mode) => {
              const active = selectedMode === mode.id;
              return (
                <Pressable
                  key={mode.id}
                  style={[s.modeBtn, active && s.modeBtnActive]}
                  onPress={() => {
                    haptic();
                    setSelectedMode(mode.id);
                  }}
                >
                  <Text style={s.modeIcon}>{mode.icon}</Text>
                  <Text style={[s.modeTitle, active && s.modeTitleActive]}>
                    {mode.title}
                  </Text>
                  <Text style={s.modeDesc}>{mode.desc}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Range */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>단어 범위</Text>
          <View style={s.chipRow}>
            {RANGES.map((r) => {
              const active = selectedRange === r.id;
              return (
                <Pressable
                  key={r.id}
                  style={[s.chip, active && s.chipActive]}
                  onPress={() => {
                    haptic();
                    setSelectedRange(r.id);
                  }}
                >
                  <Text style={[s.chipText, active && s.chipTextActive]}>
                    {r.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Count */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>문제 수</Text>
          <View style={s.countRow}>
            {COUNTS.map((c) => {
              const active = selectedCount === c;
              return (
                <Pressable
                  key={c}
                  style={[s.countBtn, active && s.countBtnActive]}
                  onPress={() => {
                    haptic();
                    setSelectedCount(c);
                  }}
                >
                  <Text style={[s.countText, active && s.countTextActive]}>
                    {c}문제
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Start Button */}
        <View style={{ paddingHorizontal: 16, marginTop: 8 }}>
          <Pressable
            style={({ pressed }) => [s.startBtn, pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] }]}
            onPress={handleStart}
          >
            <Text style={s.startBtnText}>퀴즈 시작 →</Text>
          </Pressable>
        </View>

        <Text style={s.note}>
          ※ 동의어가 있는 단어 기준으로 퀴즈가 출제됩니다
        </Text>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = (colors: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    header: {
      alignItems: "center",
      paddingTop: 32,
      paddingBottom: 24,
      paddingHorizontal: 16,
    },
    headerTitle: {
      fontSize: 28,
      fontWeight: "900",
      color: colors.primary2 as string,
      letterSpacing: -0.5,
    },
    badge: {
      marginTop: 8,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 20,
      paddingHorizontal: 12,
      paddingVertical: 4,
    },
    badgeText: {
      fontSize: 11,
      color: colors.dim,
      letterSpacing: 0.5,
    },
    section: {
      marginHorizontal: 16,
      marginBottom: 16,
      backgroundColor: colors.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 20,
    },
    sectionTitle: {
      fontSize: 11,
      fontWeight: "700",
      color: colors.dim,
      letterSpacing: 1.5,
      textTransform: "uppercase",
      marginBottom: 14,
    },
    modeGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 10,
    },
    modeBtn: {
      width: "47%",
      backgroundColor: colors.card,
      borderWidth: 2,
      borderColor: colors.border,
      borderRadius: 12,
      padding: 14,
    },
    modeBtnActive: {
      borderColor: colors.primary,
      backgroundColor: "rgba(108,99,255,0.12)",
    },
    modeIcon: {
      fontSize: 20,
      marginBottom: 6,
    },
    modeTitle: {
      fontSize: 13,
      fontWeight: "700",
      color: colors.foreground,
    },
    modeTitleActive: {
      color: colors.primary2 as string,
    },
    modeDesc: {
      fontSize: 11,
      color: colors.dim,
      marginTop: 3,
    },
    chipRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    chip: {
      backgroundColor: colors.card,
      borderWidth: 2,
      borderColor: colors.border,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    chipActive: {
      borderColor: colors.primary,
      backgroundColor: "rgba(108,99,255,0.08)",
    },
    chipText: {
      fontSize: 12,
      fontWeight: "600",
      color: colors.muted,
    },
    chipTextActive: {
      color: colors.primary2 as string,
    },
    countRow: {
      flexDirection: "row",
      gap: 10,
    },
    countBtn: {
      flex: 1,
      backgroundColor: colors.card,
      borderWidth: 2,
      borderColor: colors.border,
      borderRadius: 10,
      paddingVertical: 10,
      alignItems: "center",
    },
    countBtnActive: {
      borderColor: colors.primary,
      backgroundColor: "rgba(108,99,255,0.08)",
    },
    countText: {
      fontSize: 13,
      fontWeight: "600",
      color: colors.muted,
    },
    countTextActive: {
      color: colors.primary2 as string,
    },
    startBtn: {
      backgroundColor: colors.primary,
      borderRadius: 14,
      paddingVertical: 16,
      alignItems: "center",
    },
    startBtnText: {
      fontSize: 16,
      fontWeight: "700",
      color: "#fff",
      letterSpacing: 0.5,
    },
    note: {
      fontSize: 11,
      color: colors.dim,
      textAlign: "center",
      marginTop: 12,
      marginHorizontal: 16,
      lineHeight: 16,
    },
  });
