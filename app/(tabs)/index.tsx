import { MIN_TOUCH_TARGET, SCROLL_END_PADDING, STUDY_CARD_PADDING, STUDY_PAGE_GUTTER } from "@/lib/layout";
import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Platform,
  Alert,
  Image,
} from "react-native";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import Animated, { FadeIn } from "react-native-reanimated";

import { ScreenContainer } from "@/components/screen-container";
import {
  COUNTS,
  QUIZ_MODES,
  RANGES,
  type QuizMode,
} from "@/lib/vocab";
import { useColors } from "@/hooks/use-colors";
import { PRODUCT_NAME, PRODUCT_PHILOSOPHY } from "@/constants/brand";
import { getQuizCandidateItems } from "@/lib/quiz-engine";
import {
  loadQuizSettings,
  saveQuizSettings,
  type ChoiceLang,
} from "@/lib/store";

const DEFAULT_RANGE_ID = "all";
const SETUP_RANGES = [...RANGES.filter(range => range.id === DEFAULT_RANGE_ID), ...RANGES.filter(range => range.id !== DEFAULT_RANGE_ID)];

export default function HomeScreen() {
  const colors = useColors();
  const router = useRouter();
  const [selectedMode, setSelectedMode] = useState<QuizMode>("syn-choice");
  const [selectedRange, setSelectedRange] = useState(DEFAULT_RANGE_ID);
  const [selectedCount, setSelectedCount] = useState(10);
  const [choiceLang, setChoiceLang] = useState<ChoiceLang>("korean");
  const [showAuxiliary, setShowAuxiliary] = useState(false);

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
      try {
        await saveQuizSettings({ choiceLang: lang });
        setChoiceLang(lang);
      } catch {
        Alert.alert("설정 저장 실패", "기존 설정을 유지했습니다. 저장소 접근 상태를 확인하고 다시 시도해 주세요.");
      }
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
  const s = styles(colors);
  const completionCount = selectedMode === "sentence-completion" ? getQuizCandidateItems({ mode: selectedMode, rangeId: selectedRange, count: 200 }).length : 0;

  return (
    <ScreenContainer containerClassName="bg-background">
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: SCROLL_END_PADDING }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── 헤더 ─────────────────────────────── */}
        <View style={s.header}>
          <Image source={require("@/assets/images/finetune-home-v2.png")} style={s.brandIcon} accessibilityLabel="파인튠 FT 로고" />
          <View style={s.brandText}>
            <Text style={s.headerTitle} accessibilityLabel={PRODUCT_NAME}>FineTune</Text>
            <Text style={s.headerSub}>{PRODUCT_PHILOSOPHY}</Text>
          </View>
        </View>

        <Pressable accessibilityRole="button" accessibilityLabel="v1.5 전체 목차·개념·숙어 열기" onPress={() => router.push('/wordbook')} style={{ marginHorizontal: 16, marginBottom: 16, padding: 18, backgroundColor: colors.surface, borderRadius: 16, borderColor: '#7555B2', borderWidth: 1 }}>
          <Text style={{ color: colors.foreground, fontSize: 18, fontWeight: '700' }}>v1.5 단권화 전체 구성 →</Text>
          <Text style={{ color: colors.muted, marginTop: 6 }}>101–601 · 301 개념 지도 · 502 확장 · 부록 · 보카바이블 B · 숙어 청크</Text>
          <Text style={{ color: colors.muted, marginTop: 6 }}>기존 학습 기록과 문제 풀이 설정은 그대로 유지합니다.</Text>
        </Pressable>
        {/* ── 문제 풀이 방식 ─────────────────────── */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>문제 풀이 방식</Text>
          <View style={s.modeGrid}>
            {QUIZ_MODES.filter(mode => showAuxiliary || !["flashcard", "syn-type"].includes(mode.id)).map((mode) => {
              const active = selectedMode === mode.id;
              return (
                <Pressable
                  key={mode.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
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
                  <View style={s.modeCopy}>
                    <Text style={[s.modeTitle, active && s.modeTitleActive]}>
                      {mode.title}
                    </Text>
                    <Text style={s.modeDesc}>{mode.desc}</Text>
                  </View>
                  {active && <View style={s.modeActiveDot} />}
                </Pressable>
              );
            })}
          </View>

          {selectedMode === "sentence-completion" ? <Text style={{ color: colors.muted, fontSize: 13, lineHeight: 21, marginTop: 10 }}>
            자체 창작 논리 문항 · 선택 범위 {completionCount}문제. 등록 수보다 많이 요청하면 등록된 문항만 출제합니다. 관련 단어의 암기 상태와 논리 성과는 구분됩니다.
          </Text> : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="보조 학습 설정"
            accessibilityState={{ expanded: showAuxiliary }}
            onPress={() => {
              if (showAuxiliary && ["flashcard", "syn-type"].includes(selectedMode)) setSelectedMode("syn-choice");
              setShowAuxiliary(value => !value);
            }}
            style={{ minHeight: 44, justifyContent: "center", marginTop: 8 }}
          >
            <Text style={{ color: colors.primary, fontSize: 13 }}>보조 학습 · 플래시카드/직접 입력 {showAuxiliary ? "접기 ▴" : "펼치기 ▾"}</Text>
          </Pressable>

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
          </View>

          <View style={s.rangeGrid}>
            {SETUP_RANGES.map((r) => {
              const active = selectedRange === r.id;
              return (
                <Pressable
                  key={r.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
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
              : "선택한 유형에서 출제 가능한 문항만 사용합니다. 자료가 부족하면 다른 유형을 직접 선택할 수 있습니다"}
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
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
      paddingTop: 10,
      paddingBottom: 12,
      paddingHorizontal: STUDY_PAGE_GUTTER,
    },
    brandIcon: { width: 40, height: 40, borderRadius: 10 },
    brandText: { flexShrink: 1 },
    headerTitle: {
      fontSize: 24,
      fontWeight: "900",
      color: colors.foreground as string,
      letterSpacing: -1,
      marginBottom: 2,
    },
    headerSub: {
      fontSize: 11,
      color: colors.muted as string,
      letterSpacing: 0.3,
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
      marginHorizontal: STUDY_PAGE_GUTTER,
      marginBottom: 10,
      backgroundColor: colors.surface as string,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border as string,
      padding: STUDY_CARD_PADDING,
    },
    sectionTitleRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 0,
    },
    sectionTitle: {
      fontSize: 10,
      fontWeight: "700",
      color: colors.metadata as string,
      letterSpacing: 1,
      textTransform: "uppercase",
      marginBottom: 10,
    },
    // ── 모드 카드
    modeGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    modeCard: {
      flexBasis: "47%",
      flexGrow: 1,
      minWidth: 0,
      minHeight: 64,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      backgroundColor: colors.card as string,
      borderWidth: 1.5,
      borderColor: colors.border as string,
      borderRadius: 10,
      padding: 10,
      overflow: "hidden",
      position: "relative",
    },
    modeCopy: { flex: 1, minWidth: 0 },
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
      width: 26,
      height: 26,
      borderRadius: 7,
      flexShrink: 0,
      backgroundColor: (colors.primary as string) + "20",
      alignItems: "center",
      justifyContent: "center",
    },
    modeIcon: {
      fontSize: 15,
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
      color: colors.metadata as string,
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
      minHeight: MIN_TOUCH_TARGET,
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
    // ── 범위 그리드
    rangeGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    rangeCard: {
      minWidth: 80,
      minHeight: MIN_TOUCH_TARGET,
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
      minHeight: MIN_TOUCH_TARGET,
      paddingVertical: 8,
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
      paddingHorizontal: STUDY_PAGE_GUTTER,
      marginTop: 4,
    },
    startBtn: {
      backgroundColor: colors.primary as string,
      borderRadius: 12,
      minHeight: MIN_TOUCH_TARGET,
      paddingVertical: 12,
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
