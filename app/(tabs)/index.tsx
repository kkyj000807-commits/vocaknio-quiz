import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import Animated, { FadeIn } from "react-native-reanimated";

import { ScreenContainer } from "@/components/screen-container";
import {
  CORE_RANGES,
  COUNTS,
  QUIZ_MODES,
  RANGES,
  SECTION_RANGES,
  VOCAB,
  type QuizMode,
} from "@/lib/vocab";
import { useColors } from "@/hooks/use-colors";
import {
  loadQuizSettings,
  saveQuizSettings,
  type ChoiceLang,
} from "@/lib/store";

const DEFAULT_RANGE_ID = CORE_RANGES[0]?.id ?? SECTION_RANGES[0]?.id ?? "all";

export default function HomeScreen() {
  const colors = useColors();
  const router = useRouter();
  const [selectedMode, setSelectedMode] = useState<QuizMode>("syn-choice");
  const [selectedRange, setSelectedRange] = useState(DEFAULT_RANGE_ID);
  const [selectedCount, setSelectedCount] = useState(10);
  const [choiceLang, setChoiceLang] = useState<ChoiceLang>("korean");
  const [rangeTab, setRangeTab] = useState<"core" | "all">("core");

  useEffect(() => {
    loadQuizSettings().then((s) => setChoiceLang(s.choiceLang));
  }, []);

  const haptic = useCallback(() => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, []);

  const handleChoiceLangToggle = useCallback(
    async (lang: ChoiceLang) => {
      haptic();
      setChoiceLang(lang);
      await saveQuizSettings({ choiceLang: lang });
    },
    [haptic],
  );

  const handleStart = useCallback(() => {
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    const range = RANGES.find((r) => r.id === selectedRange);
    if (!range) return;
    router.push({
      pathname: "/quiz",
      params: {
        mode: selectedMode,
        rangeStart: range.start,
        rangeEnd: range.end,
        count: selectedCount,
        rangeId: selectedRange,
        choiceLang,
      },
    });
  }, [selectedMode, selectedRange, selectedCount, choiceLang, router]);

  const isChoiceLangRelevant = selectedMode === "kor-choice";
  const currentRanges = rangeTab === "core" ? CORE_RANGES : RANGES;
  const s = styles(colors);

  return (
    <ScreenContainer containerClassName="bg-background">
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── 헤더 ─────────────────────────────── */}
        <View style={s.header}>
          <View style={s.headerBadgeRow}>
            <View style={s.headerBadge}>
              <Text style={s.headerBadgeText}>VOCA NEXUS</Text>
            </View>
          </View>
          <Text style={s.headerTitle}>문제 풀이</Text>
          <Text style={s.headerSub}>편입 어휘 암기를 위한 초효율 학습 앱</Text>
          <View style={s.statRow}>
            <View style={s.statItem}>
              <Text style={s.statNum}>{VOCAB.length.toLocaleString()}</Text>
              <Text style={s.statLabel}>단어</Text>
            </View>
            <View style={s.statDivider} />
            <View style={s.statItem}>
              <Text style={s.statNum}>{SECTION_RANGES.length}</Text>
              <Text style={s.statLabel}>구간</Text>
            </View>
            <View style={s.statDivider} />
            <View style={s.statItem}>
              <Text style={s.statNum}>{QUIZ_MODES.length}</Text>
              <Text style={s.statLabel}>모드</Text>
            </View>
          </View>
        </View>

        {/* ── 문제 풀이 방식 ─────────────────────── */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>문제 풀이 방식</Text>
          <View style={s.modeGrid}>
            {QUIZ_MODES.map((mode) => {
              const active = selectedMode === mode.id;
              return (
                <Pressable
                  key={mode.id}
                  style={({ pressed }) => [
                    s.modeCard,
                    active && s.modeCardActive,
                    pressed && { opacity: 0.8, transform: [{ scale: 0.97 }] },
                  ]}
                  onPress={() => {
                    haptic();
                    setSelectedMode(mode.id);
                  }}
                >
                  {active && <View style={s.modeGlow} />}
                  <View style={s.modeIconWrap}>
                    <Text style={s.modeIcon}>{mode.icon}</Text>
                  </View>
                  <Text style={[s.modeTitle, active && s.modeTitleActive]}>
                    {mode.title}
                  </Text>
                  <Text style={s.modeDesc}>{mode.desc}</Text>
                  {active && <View style={s.modeActiveDot} />}
                </Pressable>
              );
            })}
          </View>

          {/* 선지 언어 토글 */}
          {isChoiceLangRelevant && (
            <Animated.View entering={FadeIn.duration(200)} style={s.langBox}>
              <Text style={s.langLabel}>선지 언어</Text>
              <View style={s.langRow}>
                {(["korean", "english"] as ChoiceLang[]).map((lang) => (
                  <Pressable
                    key={lang}
                    style={[s.langBtn, choiceLang === lang && s.langBtnActive]}
                    onPress={() => handleChoiceLangToggle(lang)}
                  >
                    <Text
                      style={[
                        s.langBtnText,
                        choiceLang === lang && s.langBtnTextActive,
                      ]}
                    >
                      {lang === "korean" ? "🇰🇷 한글뜻" : "🔤 영어 동의어"}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </Animated.View>
          )}
        </View>

        {/* ── 단어 범위 ─────────────────────────── */}
        <View style={s.section}>
          <View style={s.sectionTitleRow}>
            <Text style={s.sectionTitle}>단어 범위</Text>
            {/* 핵심 / 전체 구간 탭 */}
            <View style={s.rangeTabRow}>
              <Pressable
                style={[s.rangeTab, rangeTab === "core" && s.rangeTabActive]}
                onPress={() => {
                  haptic();
                  setRangeTab("core");
                  setSelectedRange(DEFAULT_RANGE_ID);
                }}
              >
                <Text
                  style={[
                    s.rangeTabText,
                    rangeTab === "core" && s.rangeTabTextActive,
                  ]}
                >
                  핵심
                </Text>
              </Pressable>
              <Pressable
                style={[s.rangeTab, rangeTab === "all" && s.rangeTabActive]}
                onPress={() => {
                  haptic();
                  setRangeTab("all");
                  setSelectedRange(SECTION_RANGES[0]?.id ?? "all");
                }}
              >
                <Text
                  style={[
                    s.rangeTabText,
                    rangeTab === "all" && s.rangeTabTextActive,
                  ]}
                >
                  전체 구간
                </Text>
              </Pressable>
            </View>
          </View>

          <View style={s.rangeGrid}>
            {currentRanges.map((r) => {
              const active = selectedRange === r.id;
              return (
                <Pressable
                  key={r.id}
                  style={[s.rangeCard, active && s.rangeCardActive]}
                  onPress={() => {
                    haptic();
                    setSelectedRange(r.id);
                  }}
                >
                  {active && <View style={s.rangeGlow} />}
                  <Text style={[s.rangeLabel, active && s.rangeLabelActive]}>
                    {r.label}
                  </Text>
                  {active && <View style={s.rangeCheckDot} />}
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* ── 문제 수 ───────────────────────────── */}
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
                  {active && <View style={s.countGlow} />}
                  <Text style={[s.countText, active && s.countTextActive]}>
                    {c}
                  </Text>
                  <Text style={[s.countUnit, active && s.countUnitActive]}>
                    문제
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* ── 시작 버튼 ─────────────────────────── */}
        <View style={s.startWrap}>
          <Pressable
            style={({ pressed }) => [
              s.startBtn,
              pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
            ]}
            onPress={handleStart}
          >
            <View style={s.startGlow} />
            <Text style={s.startBtnText}>문제 풀기</Text>
            <Text style={s.startBtnArrow}>→</Text>
          </Pressable>
          <Text style={s.startNote}>
            {selectedMode === "syn-kor-choice"
              ? "영어 동의어와 한글 뜻이 함께 검증된 문항만 출제됩니다"
              : "검증된 동의어가 없으면 한국어 뜻 문제로 자동 전환됩니다"}
          </Text>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = (colors: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    // ── 헤더
    header: {
      alignItems: "center",
      paddingTop: 28,
      paddingBottom: 20,
      paddingHorizontal: 20,
    },
    headerBadgeRow: {
      marginBottom: 10,
    },
    headerBadge: {
      borderWidth: 1,
      borderColor: (colors.primary as string) + "60",
      borderRadius: 20,
      paddingHorizontal: 14,
      paddingVertical: 4,
      backgroundColor: (colors.primary as string) + "15",
    },
    headerBadgeText: {
      fontSize: 10,
      fontWeight: "700",
      color: colors.primary as string,
      letterSpacing: 2.5,
    },
    headerTitle: {
      fontSize: 36,
      fontWeight: "900",
      color: colors.foreground as string,
      letterSpacing: -1,
      marginBottom: 6,
    },
    headerSub: {
      fontSize: 13,
      color: colors.muted as string,
      letterSpacing: 0.3,
      marginBottom: 20,
    },
    statRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 0,
    },
    statItem: {
      alignItems: "center",
      paddingHorizontal: 20,
    },
    statNum: {
      fontSize: 22,
      fontWeight: "800",
      color: colors.primary as string,
    },
    statLabel: {
      fontSize: 10,
      color: colors.muted as string,
      marginTop: 2,
      letterSpacing: 0.5,
    },
    statDivider: {
      width: 1,
      height: 28,
      backgroundColor: colors.border as string,
    },
    // ── 섹션
    section: {
      marginHorizontal: 16,
      marginBottom: 14,
      backgroundColor: colors.surface as string,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.border as string,
      padding: 18,
    },
    sectionTitleRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 14,
    },
    sectionTitle: {
      fontSize: 10,
      fontWeight: "700",
      color: colors.muted as string,
      letterSpacing: 2,
      textTransform: "uppercase",
      marginBottom: 14,
    },
    // ── 모드 카드
    modeGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 10,
    },
    modeCard: {
      width: "47.5%",
      backgroundColor: colors.card as string,
      borderWidth: 1.5,
      borderColor: colors.border as string,
      borderRadius: 14,
      padding: 14,
      overflow: "hidden",
      position: "relative",
    },
    modeCardActive: {
      borderColor: (colors.primary as string) + "80",
      backgroundColor: (colors.primary as string) + "12",
    },
    modeGlow: {
      position: "absolute",
      top: -20,
      left: -20,
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: (colors.primary as string) + "20",
    },
    modeIconWrap: {
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor: (colors.primary as string) + "20",
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 8,
    },
    modeIcon: {
      fontSize: 18,
    },
    modeTitle: {
      fontSize: 13,
      fontWeight: "700",
      color: colors.foreground as string,
      marginBottom: 3,
    },
    modeTitleActive: {
      color: colors.primary as string,
    },
    modeDesc: {
      fontSize: 10,
      color: colors.muted as string,
      lineHeight: 14,
    },
    modeActiveDot: {
      position: "absolute",
      top: 10,
      right: 10,
      width: 7,
      height: 7,
      borderRadius: 4,
      backgroundColor: colors.primary as string,
    },
    // ── 선지 언어
    langBox: {
      marginTop: 14,
      paddingTop: 14,
      borderTopWidth: 1,
      borderTopColor: colors.border as string,
    },
    langLabel: {
      fontSize: 10,
      fontWeight: "700",
      color: colors.muted as string,
      letterSpacing: 2,
      textTransform: "uppercase",
      marginBottom: 10,
    },
    langRow: {
      flexDirection: "row",
      gap: 8,
    },
    langBtn: {
      flex: 1,
      minHeight: 44,
      backgroundColor: colors.card as string,
      borderWidth: 1.5,
      borderColor: colors.border as string,
      borderRadius: 10,
      paddingVertical: 10,
      alignItems: "center",
    },
    langBtnActive: {
      borderColor: (colors.primary as string) + "80",
      backgroundColor: (colors.primary as string) + "15",
    },
    langBtnText: {
      fontSize: 12,
      fontWeight: "600",
      color: colors.muted as string,
    },
    langBtnTextActive: {
      color: colors.primary as string,
    },
    // ── 범위 탭
    rangeTabRow: {
      flexDirection: "row",
      gap: 6,
      marginBottom: 0,
    },
    rangeTab: {
      minHeight: 44,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 8,
      backgroundColor: colors.card as string,
      borderWidth: 1,
      borderColor: colors.border as string,
      alignItems: "center",
      justifyContent: "center",
    },
    rangeTabActive: {
      backgroundColor: (colors.primary as string) + "20",
      borderColor: (colors.primary as string) + "60",
    },
    rangeTabText: {
      fontSize: 11,
      fontWeight: "600",
      color: colors.muted as string,
    },
    rangeTabTextActive: {
      color: colors.primary as string,
    },
    // ── 범위 그리드
    rangeGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    rangeCard: {
      minWidth: 80,
      minHeight: 44,
      backgroundColor: colors.card as string,
      borderWidth: 1.5,
      borderColor: colors.border as string,
      borderRadius: 10,
      paddingHorizontal: 10,
      paddingVertical: 9,
      alignItems: "center",
      position: "relative",
      overflow: "hidden",
    },
    rangeCardActive: {
      borderColor: (colors.primary as string) + "80",
      backgroundColor: (colors.primary as string) + "15",
    },
    rangeGlow: {
      position: "absolute",
      top: -10,
      left: -10,
      width: 50,
      height: 50,
      borderRadius: 25,
      backgroundColor: (colors.primary as string) + "25",
    },
    rangeLabel: {
      fontSize: 11,
      fontWeight: "700",
      color: colors.muted as string,
      letterSpacing: 0.3,
    },
    rangeLabelActive: {
      color: colors.primary as string,
    },
    rangeCheckDot: {
      position: "absolute",
      top: 4,
      right: 4,
      width: 5,
      height: 5,
      borderRadius: 3,
      backgroundColor: colors.primary as string,
    },
    // ── 문제 수
    countRow: {
      flexDirection: "row",
      gap: 10,
    },
    countBtn: {
      flex: 1,
      backgroundColor: colors.card as string,
      borderWidth: 1.5,
      borderColor: colors.border as string,
      borderRadius: 12,
      paddingVertical: 14,
      alignItems: "center",
      position: "relative",
      overflow: "hidden",
    },
    countBtnActive: {
      borderColor: (colors.primary as string) + "80",
      backgroundColor: (colors.primary as string) + "15",
    },
    countGlow: {
      position: "absolute",
      top: -15,
      left: "25%",
      width: 50,
      height: 50,
      borderRadius: 25,
      backgroundColor: (colors.primary as string) + "25",
    },
    countText: {
      fontSize: 20,
      fontWeight: "800",
      color: colors.muted as string,
    },
    countTextActive: {
      color: colors.primary as string,
    },
    countUnit: {
      fontSize: 10,
      color: colors.dim as string,
      marginTop: 2,
    },
    countUnitActive: {
      color: (colors.primary as string) + "CC",
    },
    // ── 시작 버튼
    startWrap: {
      paddingHorizontal: 16,
      marginTop: 4,
    },
    startBtn: {
      backgroundColor: colors.primary as string,
      borderRadius: 16,
      paddingVertical: 18,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      overflow: "hidden",
      position: "relative",
    },
    startGlow: {
      position: "absolute",
      top: -30,
      left: "30%",
      width: 100,
      height: 100,
      borderRadius: 50,
      backgroundColor: "rgba(255,255,255,0.12)",
    },
    startBtnText: {
      fontSize: 17,
      fontWeight: "800",
      color: "#FFFFFF",
      letterSpacing: 0.5,
    },
    startBtnArrow: {
      fontSize: 18,
      fontWeight: "800",
      color: "rgba(255,255,255,0.8)",
    },
    startNote: {
      fontSize: 11,
      color: colors.dim as string,
      textAlign: "center",
      marginTop: 10,
      lineHeight: 16,
    },
  });
