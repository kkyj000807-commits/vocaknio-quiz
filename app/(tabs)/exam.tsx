import React, { useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Platform,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  FadeIn,
  FadeOut,
  SlideInRight,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";

import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import {
  examQuestions,
  shuffleQuestions,
  shuffleChoices,
  getQuestionsByYear,
  getQuestionsByType,
  type ExamQuestion,
  type QuestionType,
} from "@/lib/exam-questions";

type FilterYear = "all" | 2024 | 2025 | 2026;
type FilterType = "all" | "vocab" | "reading" | "logic";

const YEAR_OPTIONS: { id: FilterYear; label: string }[] = [
  { id: "all", label: "전체" },
  { id: 2026, label: "2026" },
  { id: 2025, label: "2025" },
  { id: 2024, label: "2024" },
];

const TYPE_OPTIONS: { id: FilterType; label: string; icon: string }[] = [
  { id: "all",     label: "전체",   icon: "📚" },
  { id: "vocab",   label: "어휘",   icon: "🔤" },
  { id: "reading", label: "독해",   icon: "📖" },
  { id: "logic",   label: "논리",   icon: "🔗" },
];

function isVocab(type: QuestionType) {
  return type === "vocab-synonym" || type === "vocab-blank";
}
function isReading(type: QuestionType) {
  return (
    type === "reading-main" ||
    type === "reading-vocab" ||
    type === "reading-blank" ||
    type === "reading-title"
  );
}
function isLogic(type: QuestionType) {
  return type === "logic-blank" || type === "grammar";
}

function getTypeLabel(type: QuestionType): string {
  switch (type) {
    case "vocab-synonym": return "어휘 동의어";
    case "vocab-blank":   return "어휘 빈칸";
    case "logic-blank":   return "논리 빈칸";
    case "reading-vocab": return "독해 밑줄어휘";
    case "reading-blank": return "독해 빈칸";
    case "reading-main":  return "독해 내용일치";
    case "reading-title": return "독해 제목";
    case "grammar":       return "문법";
    default:              return "기출";
  }
}

function getTypeColor(type: QuestionType, colors: ReturnType<typeof useColors>): string {
  if (isVocab(type)) return colors.primary as string;
  if (isReading(type)) return colors.success as string;
  if (isLogic(type)) return colors.warning as string;
  return colors.muted as string;
}

// ─── 퀴즈 세션 컴포넌트 ──────────────────────────────────────────────────────
interface QuizSessionProps {
  questions: ExamQuestion[];
  onFinish: (correct: number, total: number) => void;
}

function QuizSession({ questions, onFinish }: QuizSessionProps) {
  const colors = useColors();
  const [idx, setIdx] = useState(0);
  const [answered, setAnswered] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [correct, setCorrect] = useState(0);

  const cardScale = useSharedValue(1);
  const cardAnim = useAnimatedStyle(() => ({
    transform: [{ scale: cardScale.value }],
  }));

  const q = useMemo(() => shuffleChoices(questions[idx]), [questions, idx]);

  const haptic = useCallback((type: "light" | "success" | "error") => {
    if (Platform.OS === "web") return;
    if (type === "light") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    else if (type === "success") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    else Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  }, []);

  const handleSelect = useCallback(
    (choiceIdx: number) => {
      if (answered) return;
      haptic("light");
      cardScale.value = withSequence(
        withTiming(0.97, { duration: 80 }),
        withTiming(1, { duration: 150 })
      );
      setSelected(choiceIdx);
      setAnswered(true);
      if (choiceIdx === q.answer) {
        haptic("success");
        setCorrect((c) => c + 1);
      } else {
        haptic("error");
      }
    },
    [answered, q.answer, haptic, cardScale]
  );

  const handleNext = useCallback(() => {
    haptic("light");
    if (idx + 1 >= questions.length) {
      onFinish(correct, questions.length);
      return;
    }
    setIdx((i) => i + 1);
    setAnswered(false);
    setSelected(null);
  }, [idx, questions.length, correct, selected, q.answer, haptic, onFinish]);

  const s = styles(colors);
  const pct = Math.round((idx / questions.length) * 100);
  const typeColor = getTypeColor(q.type, colors);

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ paddingBottom: 40 }}
      showsVerticalScrollIndicator={false}
    >
      {/* 진행 바 */}
      <View style={s.progressWrap}>
        <View style={s.progressRow}>
          <Text style={s.progressText}>{idx + 1} / {questions.length}</Text>
          <Text style={s.progressText}>{pct}%</Text>
        </View>
        <View style={s.progressBar}>
          <Animated.View
            style={[s.progressFill, { width: `${pct}%` as any }]}
          />
        </View>
      </View>

      {/* 문제 카드 */}
      <Animated.View style={[s.card, cardAnim]} entering={SlideInRight.duration(250)}>
        {/* 유형 배지 */}
        <View style={[s.typeBadge, { backgroundColor: typeColor + "22", borderColor: typeColor + "55" }]}>
          <Text style={[s.typeBadgeText, { color: typeColor }]}>
            {q.year}년 {getTypeLabel(q.type)} · {q.points}점
          </Text>
        </View>

        {/* 지문 (독해) */}
        {q.passage && (
          <View style={s.passageBox}>
            <Text style={s.passageText}>{q.passage}</Text>
          </View>
        )}

        {/* 문제 */}
        <Text style={s.questionText}>{q.question}</Text>

        {/* 선택지 */}
        <View style={s.choicesWrap}>
          {q.choices.map((choice, ci) => {
            const isCorrect = ci === q.answer;
            const isSelected = ci === selected;
            let borderColor = colors.border as string;
            let bgColor = colors.surface as string;
            let textColor = colors.foreground as string;

            if (answered) {
              if (isCorrect) {
                borderColor = colors.success as string;
                bgColor = (colors.success as string) + "18";
                textColor = colors.success as string;
              } else if (isSelected && !isCorrect) {
                borderColor = colors.error as string;
                bgColor = (colors.error as string) + "18";
                textColor = colors.error as string;
              }
            }

            return (
              <Pressable
                key={ci}
                style={[s.choiceBtn, { borderColor, backgroundColor: bgColor }]}
                onPress={() => handleSelect(ci)}
                disabled={answered}
              >
                <View style={[
                  s.choiceNum,
                  answered && isCorrect && { backgroundColor: colors.success },
                  answered && isSelected && !isCorrect && { backgroundColor: colors.error },
                ]}>
                  <Text style={[
                    s.choiceNumText,
                    answered && (isCorrect || (isSelected && !isCorrect)) && { color: "#fff" },
                  ]}>
                    {["①", "②", "③", "④", "⑤"][ci]}
                  </Text>
                </View>
                <Text style={[s.choiceText, { color: textColor }]} numberOfLines={4}>
                  {choice}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* 해설 */}
        {answered && (
          <Animated.View entering={FadeIn.duration(300)} style={s.explBox}>
            <Text style={s.explTitle}>해설</Text>
            <Text style={s.explText}>{q.explanation}</Text>
          </Animated.View>
        )}

        {/* 다음 버튼 */}
        {answered && (
          <Animated.View entering={FadeIn.duration(200)}>
            <Pressable
              style={({ pressed }) => [s.nextBtn, pressed && { opacity: 0.85 }]}
              onPress={handleNext}
            >
              <Text style={s.nextBtnText}>
                {idx + 1 >= questions.length ? "결과 보기 →" : "다음 →"}
              </Text>
            </Pressable>
          </Animated.View>
        )}
      </Animated.View>
    </ScrollView>
  );
}

// ─── 결과 컴포넌트 ────────────────────────────────────────────────────────────
interface ResultViewProps {
  correct: number;
  total: number;
  onRetry: () => void;
}

function ResultView({ correct, total, onRetry }: ResultViewProps) {
  const colors = useColors();
  const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
  const s = styles(colors);

  return (
    <Animated.View entering={FadeIn.duration(400)} style={s.resultBox}>
      <Text style={s.resultEmoji}>{pct >= 80 ? "🏆" : pct >= 60 ? "👍" : "📚"}</Text>
      <Text style={s.resultScore}>{correct} / {total}</Text>
      <Text style={s.resultPct}>{pct}%</Text>
      <Text style={s.resultMsg}>
        {pct >= 80 ? "훌륭합니다! 실전 준비 완료!" : pct >= 60 ? "잘 하고 있어요. 조금만 더!" : "다시 한 번 도전해 보세요!"}
      </Text>
      <Pressable
        style={({ pressed }) => [s.retryBtn, pressed && { opacity: 0.85 }]}
        onPress={onRetry}
      >
        <Text style={s.retryBtnText}>다시 풀기</Text>
      </Pressable>
    </Animated.View>
  );
}

// ─── 메인 화면 ────────────────────────────────────────────────────────────────
export default function ExamScreen() {
  const colors = useColors();
  const [yearFilter, setYearFilter] = useState<FilterYear>("all");
  const [typeFilter, setTypeFilter] = useState<FilterType>("all");
  const [quizQuestions, setQuizQuestions] = useState<ExamQuestion[] | null>(null);
  const [result, setResult] = useState<{ correct: number; total: number } | null>(null);

  const filteredQuestions = useMemo(() => {
    let qs = examQuestions;
    if (yearFilter !== "all") qs = qs.filter((q) => q.year === yearFilter);
    if (typeFilter === "vocab") qs = qs.filter((q) => isVocab(q.type));
    else if (typeFilter === "reading") qs = qs.filter((q) => isReading(q.type));
    else if (typeFilter === "logic") qs = qs.filter((q) => isLogic(q.type));
    return qs;
  }, [yearFilter, typeFilter]);

  const handleStart = useCallback(() => {
    if (filteredQuestions.length === 0) return;
    setQuizQuestions(shuffleQuestions(filteredQuestions));
    setResult(null);
  }, [filteredQuestions]);

  const handleFinish = useCallback((correct: number, total: number) => {
    setResult({ correct, total });
    setQuizQuestions(null);
  }, []);

  const handleRetry = useCallback(() => {
    setResult(null);
    setQuizQuestions(null);
  }, []);

  const s = styles(colors);

  // 퀴즈 진행 중
  if (quizQuestions) {
    return (
      <ScreenContainer containerClassName="bg-background">
        <View style={s.sessionHeader}>
          <Pressable onPress={() => setQuizQuestions(null)} style={s.backBtn}>
            <Text style={s.backBtnText}>← 나가기</Text>
          </Pressable>
          <Text style={s.sessionTitle}>기출 퀴즈</Text>
          <View style={{ width: 60 }} />
        </View>
        <QuizSession questions={quizQuestions} onFinish={handleFinish} />
      </ScreenContainer>
    );
  }

  // 결과 화면
  if (result) {
    return (
      <ScreenContainer className="p-6">
        <ResultView correct={result.correct} total={result.total} onRetry={handleRetry} />
      </ScreenContainer>
    );
  }

  // 설정 화면
  return (
    <ScreenContainer containerClassName="bg-background">
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* 헤더 */}
        <View style={s.header}>
          <Text style={s.headerTitle}>기출 퀴즈</Text>
          <Text style={s.headerSub}>한양대 편입 {examQuestions.length}문항 · 2024~2026</Text>
        </View>

        {/* 연도 필터 */}
        <View style={s.section}>
          <Text style={s.sectionLabel}>연도</Text>
          <View style={s.chipRow}>
            {YEAR_OPTIONS.map((opt) => (
              <Pressable
                key={opt.id}
                style={[s.chip, yearFilter === opt.id && s.chipActive]}
                onPress={() => setYearFilter(opt.id)}
              >
                <Text style={[s.chipText, yearFilter === opt.id && s.chipTextActive]}>
                  {opt.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* 유형 필터 */}
        <View style={s.section}>
          <Text style={s.sectionLabel}>문제 유형</Text>
          <View style={s.typeGrid}>
            {TYPE_OPTIONS.map((opt) => (
              <Pressable
                key={opt.id}
                style={[s.typeCard, typeFilter === opt.id && s.typeCardActive]}
                onPress={() => setTypeFilter(opt.id)}
              >
                <Text style={s.typeCardIcon}>{opt.icon}</Text>
                <Text style={[s.typeCardLabel, typeFilter === opt.id && s.typeCardLabelActive]}>
                  {opt.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* 문항 수 표시 */}
        <View style={s.countBox}>
          <Text style={s.countText}>
            선택된 문항: <Text style={s.countNum}>{filteredQuestions.length}문항</Text>
          </Text>
        </View>

        {/* 시작 버튼 */}
        <Pressable
          style={({ pressed }) => [
            s.startBtn,
            filteredQuestions.length === 0 && s.startBtnDisabled,
            pressed && { opacity: 0.85 },
          ]}
          onPress={handleStart}
          disabled={filteredQuestions.length === 0}
        >
          <Text style={s.startBtnText}>
            {filteredQuestions.length > 0 ? `기출 퀴즈 시작 →` : "해당 문항 없음"}
          </Text>
        </Pressable>

        {/* 문항 목록 미리보기 */}
        <View style={s.section}>
          <Text style={s.sectionLabel}>문항 목록</Text>
          {filteredQuestions.slice(0, 20).map((q) => (
            <View key={q.id} style={s.previewRow}>
              <View style={[s.previewBadge, { backgroundColor: getTypeColor(q.type, colors) + "22" }]}>
                <Text style={[s.previewBadgeText, { color: getTypeColor(q.type, colors) }]}>
                  {q.year}
                </Text>
              </View>
              <Text style={s.previewQ} numberOfLines={1}>
                Q{q.qNum}. {q.underlined ?? q.question.slice(0, 40)}
              </Text>
              <Text style={s.previewType}>{getTypeLabel(q.type)}</Text>
            </View>
          ))}
          {filteredQuestions.length > 20 && (
            <Text style={s.moreText}>+{filteredQuestions.length - 20}문항 더</Text>
          )}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = (colors: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    header: {
      paddingHorizontal: 20,
      paddingTop: 20,
      paddingBottom: 16,
    },
    headerTitle: {
      fontSize: 28,
      fontWeight: "800",
      color: colors.foreground as string,
      letterSpacing: -0.5,
    },
    headerSub: {
      fontSize: 13,
      color: colors.muted as string,
      marginTop: 4,
    },
    section: {
      paddingHorizontal: 20,
      marginBottom: 20,
    },
    sectionLabel: {
      fontSize: 12,
      fontWeight: "700",
      color: colors.muted as string,
      letterSpacing: 1,
      textTransform: "uppercase",
      marginBottom: 10,
    },
    chipRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    chip: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 20,
      borderWidth: 1.5,
      borderColor: colors.border as string,
      backgroundColor: colors.surface as string,
    },
    chipActive: {
      borderColor: colors.primary as string,
      backgroundColor: (colors.primary as string) + "18",
    },
    chipText: {
      fontSize: 13,
      fontWeight: "600",
      color: colors.muted as string,
    },
    chipTextActive: {
      color: colors.primary as string,
    },
    typeGrid: {
      flexDirection: "row",
      gap: 10,
    },
    typeCard: {
      flex: 1,
      backgroundColor: colors.surface as string,
      borderWidth: 1.5,
      borderColor: colors.border as string,
      borderRadius: 14,
      paddingVertical: 14,
      alignItems: "center",
      gap: 6,
    },
    typeCardActive: {
      borderColor: colors.primary as string,
      backgroundColor: (colors.primary as string) + "15",
    },
    typeCardIcon: {
      fontSize: 22,
    },
    typeCardLabel: {
      fontSize: 11,
      fontWeight: "700",
      color: colors.muted as string,
    },
    typeCardLabelActive: {
      color: colors.primary as string,
    },
    countBox: {
      marginHorizontal: 20,
      marginBottom: 16,
      backgroundColor: colors.surface as string,
      borderRadius: 12,
      padding: 14,
      borderWidth: 1,
      borderColor: colors.border as string,
    },
    countText: {
      fontSize: 14,
      color: colors.muted as string,
      textAlign: "center",
    },
    countNum: {
      fontWeight: "800",
      color: colors.primary as string,
    },
    startBtn: {
      marginHorizontal: 20,
      marginBottom: 24,
      backgroundColor: colors.primary as string,
      borderRadius: 16,
      paddingVertical: 16,
      alignItems: "center",
    },
    startBtnDisabled: {
      opacity: 0.4,
    },
    startBtnText: {
      fontSize: 16,
      fontWeight: "800",
      color: "#fff",
      letterSpacing: 0.3,
    },
    previewRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: colors.border as string,
      gap: 10,
    },
    previewBadge: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 6,
    },
    previewBadgeText: {
      fontSize: 11,
      fontWeight: "700",
    },
    previewQ: {
      flex: 1,
      fontSize: 13,
      color: colors.foreground as string,
    },
    previewType: {
      fontSize: 10,
      color: colors.muted as string,
      fontWeight: "600",
    },
    moreText: {
      textAlign: "center",
      fontSize: 12,
      color: colors.muted as string,
      paddingVertical: 10,
    },
    // 퀴즈 세션
    sessionHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 0.5,
      borderBottomColor: colors.border as string,
    },
    backBtn: {
      width: 60,
    },
    backBtnText: {
      fontSize: 13,
      color: colors.primary as string,
      fontWeight: "600",
    },
    sessionTitle: {
      fontSize: 16,
      fontWeight: "700",
      color: colors.foreground as string,
    },
    progressWrap: {
      paddingHorizontal: 20,
      paddingTop: 16,
      marginBottom: 12,
    },
    progressRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: 6,
    },
    progressText: {
      fontSize: 11,
      color: colors.muted as string,
    },
    progressBar: {
      height: 4,
      backgroundColor: colors.border as string,
      borderRadius: 2,
      overflow: "hidden",
    },
    progressFill: {
      height: "100%",
      backgroundColor: colors.primary as string,
      borderRadius: 2,
    },
    card: {
      marginHorizontal: 16,
      backgroundColor: colors.surface as string,
      borderWidth: 1,
      borderColor: colors.border as string,
      borderRadius: 20,
      padding: 20,
    },
    typeBadge: {
      alignSelf: "flex-start",
      borderWidth: 1,
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 4,
      marginBottom: 14,
    },
    typeBadgeText: {
      fontSize: 11,
      fontWeight: "700",
      letterSpacing: 0.5,
    },
    passageBox: {
      backgroundColor: colors.background as string,
      borderWidth: 1,
      borderColor: colors.border as string,
      borderRadius: 10,
      padding: 14,
      marginBottom: 16,
    },
    passageText: {
      fontSize: 13,
      color: colors.foreground as string,
      lineHeight: 20,
    },
    questionText: {
      fontSize: 15,
      color: colors.foreground as string,
      lineHeight: 24,
      fontWeight: "600",
      marginBottom: 18,
    },
    choicesWrap: {
      gap: 10,
    },
    choiceBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      borderWidth: 1.5,
      borderRadius: 12,
      padding: 13,
    },
    choiceNum: {
      width: 26,
      height: 26,
      borderRadius: 7,
      backgroundColor: colors.border as string,
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
    },
    choiceNumText: {
      fontSize: 11,
      fontWeight: "700",
      color: colors.muted as string,
    },
    choiceText: {
      fontSize: 14,
      flex: 1,
      lineHeight: 20,
    },
    explBox: {
      marginTop: 16,
      backgroundColor: (colors.primary as string) + "12",
      borderWidth: 1,
      borderColor: (colors.primary as string) + "30",
      borderRadius: 12,
      padding: 14,
    },
    explTitle: {
      fontSize: 10,
      fontWeight: "800",
      color: colors.primary as string,
      letterSpacing: 1,
      textTransform: "uppercase",
      marginBottom: 6,
    },
    explText: {
      fontSize: 13,
      color: colors.foreground as string,
      lineHeight: 20,
    },
    nextBtn: {
      marginTop: 16,
      backgroundColor: colors.primary as string,
      borderRadius: 14,
      paddingVertical: 14,
      alignItems: "center",
    },
    nextBtnText: {
      fontSize: 15,
      fontWeight: "800",
      color: "#fff",
    },
    // 결과
    resultBox: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: 12,
    },
    resultEmoji: {
      fontSize: 64,
    },
    resultScore: {
      fontSize: 48,
      fontWeight: "900",
      color: colors.foreground as string,
      letterSpacing: -1,
    },
    resultPct: {
      fontSize: 20,
      fontWeight: "700",
      color: colors.primary as string,
    },
    resultMsg: {
      fontSize: 16,
      color: colors.muted as string,
      textAlign: "center",
    },
    retryBtn: {
      marginTop: 16,
      backgroundColor: colors.primary as string,
      borderRadius: 16,
      paddingVertical: 14,
      paddingHorizontal: 40,
    },
    retryBtnText: {
      fontSize: 16,
      fontWeight: "800",
      color: "#fff",
    },
  });
