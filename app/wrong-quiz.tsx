import { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
} from "react-native-reanimated";

import { ScreenContainer } from "@/components/screen-container";
import { type VocabItem } from "@/lib/vocab";
import {
  buildReviewQuestions,
  isChoiceCorrect,
  type QuizQuestion,
} from "@/lib/quiz-engine";
import { updateStatsAfterQuiz, toggleBookmark, loadBookmarks, addWrongWords } from "@/lib/store";
import { useColors } from "@/hooks/use-colors";

export default function WrongQuizScreen() {
  const colors = useColors();
  const router = useRouter();
  const params = useLocalSearchParams<{
    wrongNums: string;
    count: string;
  }>();

  const wrongNums = params.wrongNums
    ? params.wrongNums.split(",").map(Number).filter(Boolean)
    : [];
  const count = parseInt(params.count ?? "20");

  const [questions] = useState<QuizQuestion[]>(() =>
    buildReviewQuestions(wrongNums, count)
  );
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answered, setAnswered] = useState(false);
  const [selectedChoice, setSelectedChoice] = useState<number | null>(null);
  const [skipped, setSkipped] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [wrongCount, setWrongCount] = useState(0);
  const [wrongItems, setWrongItems] = useState<VocabItem[]>([]);
  const [bookmarks, setBookmarks] = useState<number[]>([]);

  const cardScale = useSharedValue(1);
  const cardAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: cardScale.value }],
  }));

  useEffect(() => {
    loadBookmarks().then(setBookmarks);
  }, []);

  const haptic = useCallback((type: "light" | "success" | "error" = "light") => {
    if (Platform.OS === "web") return;
    if (type === "light") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    else if (type === "success") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    else if (type === "error") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  }, []);

  const animateCard = useCallback(() => {
    cardScale.value = withSequence(
      withTiming(0.97, { duration: 80 }),
      withTiming(1, { duration: 120 })
    );
  }, [cardScale]);

  const q = questions[currentIdx];
  const isBookmarked = q ? bookmarks.includes(q.item.num) : false;

  const handleBookmark = useCallback(async () => {
    if (!q) return;
    haptic("light");
    const updated = await toggleBookmark(q.item.num);
    setBookmarks(updated);
  }, [q, haptic]);

  const handleChoiceSelect = useCallback(
    (idx: number) => {
      if (answered) return;
      haptic("light");
      animateCard();
      setSelectedChoice(idx);
      setAnswered(true);
      setSkipped(false);

      const choice = q.choices[idx];
      const isCorrect = choice ? isChoiceCorrect(q, choice) : false;
      if (isCorrect) {
        haptic("success");
        setCorrectCount((c) => c + 1);
      } else {
        haptic("error");
        setWrongCount((w) => w + 1);
        setWrongItems((prev) => [...prev, q.item]);
      }
    },
    [answered, q, haptic, animateCard]
  );

  const handleSkip = useCallback(() => {
    if (answered) return;
    haptic("error");
    animateCard();
    setAnswered(true);
    setSkipped(true);
    setSelectedChoice(null);
    setWrongCount((w) => w + 1);
    setWrongItems((prev) => [...prev, q.item]);
  }, [answered, q, haptic, animateCard]);

  const handleNext = useCallback(async () => {
    haptic("light");
    if (currentIdx + 1 >= questions.length) {
      const finalWrongNums = wrongItems.map((w) => w.num);
      await Promise.all([
        updateStatsAfterQuiz(correctCount, questions.length),
        addWrongWords(finalWrongNums),
      ]);
      router.replace({
        pathname: "/result",
        params: {
          correct: correctCount,
          total: questions.length,
          wrongNums: finalWrongNums.join(","),
        },
      });
      return;
    }
    setCurrentIdx((i) => i + 1);
    setAnswered(false);
    setSelectedChoice(null);
    setSkipped(false);
  }, [currentIdx, questions.length, correctCount, wrongItems, haptic, router]);

  const s = styles(colors);
  const pct = Math.round((currentIdx / questions.length) * 100);

  if (!q) return null;

  return (
    <ScreenContainer containerClassName="bg-background">
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header Banner */}
        <View style={s.wrongBanner}>
          <Text style={s.wrongBannerText}>🔴 오답 전용 퀴즈</Text>
          <Text style={s.wrongBannerSub}>틀린 단어만 모아서 복습</Text>
        </View>

        {/* Stats Row */}
        <View style={s.statsRow}>
          <View style={[s.statBox]}>
            <Text style={[s.statNum, { color: colors.success }]}>{correctCount}</Text>
            <Text style={s.statLabel}>정답</Text>
          </View>
          <View style={s.statBox}>
            <Text style={[s.statNum, { color: colors.error }]}>{wrongCount}</Text>
            <Text style={s.statLabel}>오답</Text>
          </View>
          <View style={s.statBox}>
            <Text style={[s.statNum, { color: colors.primary2 as string }]}>{currentIdx}</Text>
            <Text style={s.statLabel}>진행</Text>
          </View>
        </View>

        {/* Progress Bar */}
        <View style={s.progressContainer}>
          <View style={s.progressInfo}>
            <Text style={s.progressText}>{currentIdx + 1} / {questions.length}</Text>
            <Text style={s.progressText}>{pct}%</Text>
          </View>
          <View style={s.progressBar}>
            <View style={[s.progressFill, { width: `${pct}%` as any }]} />
          </View>
        </View>

        {/* Question Card */}
        <Animated.View style={[s.questionCard, cardAnimStyle]}>
          <View style={s.questionHeader}>
            <Text style={s.questionNum}>
              문제 {currentIdx + 1} · {q.answerKind === "synonym" ? "동의어 고르기" : "한국어 뜻 고르기"}
            </Text>
            <Pressable onPress={handleBookmark} style={s.bookmarkBtn}>
              <Text style={{ fontSize: 20 }}>{isBookmarked ? "🔖" : "🏷️"}</Text>
            </Pressable>
          </View>

          <Text style={s.wordText}>{q.item.w}</Text>
          {q.item.p ? <Text style={s.ipaText}>{q.item.p}</Text> : null}

          <Text style={s.hintText}>
            {q.answerKind === "synonym" ? "올바른 동의어는?" : "올바른 한국어 뜻은?"}
          </Text>
          <View style={s.choicesContainer}>
            {q.choices.map((choice, idx) => {
              const choiceIsCorrect = isChoiceCorrect(q, choice);
              let choiceStyle = s.choiceBtn;
              let textStyle = s.choiceText;
              if (answered) {
                if (choiceIsCorrect) {
                  choiceStyle = { ...s.choiceBtn, ...s.choiceCorrect };
                  textStyle = { ...s.choiceText, color: colors.success };
                } else if (idx === selectedChoice) {
                  choiceStyle = { ...s.choiceBtn, ...s.choiceWrong };
                  textStyle = { ...s.choiceText, color: colors.error };
                }
              }
              return (
                <Pressable
                  key={choice.id}
                  style={choiceStyle}
                  onPress={() => handleChoiceSelect(idx)}
                  disabled={answered}
                >
                  <View style={[
                    s.choiceNum,
                    answered && choiceIsCorrect && { backgroundColor: colors.success },
                    answered && idx === selectedChoice && !choiceIsCorrect && { backgroundColor: colors.error },
                  ]}>
                    <Text style={[
                      s.choiceNumText,
                      answered && (choiceIsCorrect || idx === selectedChoice) && { color: "#000" },
                    ]}>
                      {["①", "②", "③", "④"][idx]}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={textStyle} numberOfLines={2}>{choice.label}</Text>
                    {answered && choice.meaning && choice.meaning !== choice.label ? (
                      <Text style={s.choiceMeaning}>{choice.meaning}</Text>
                    ) : null}
                  </View>
                </Pressable>
              );
            })}
          </View>

          {/* 모르겠다 버튼 */}
          {!answered && (
            <Pressable style={s.skipBtn} onPress={handleSkip}>
              <Text style={s.skipBtnText}>🤷 모르겠다 (패스)</Text>
            </Pressable>
          )}

          {/* 패스 후 정답 표시 */}
          {answered && skipped && (
            <View style={s.skipResultBox}>
              <Text style={s.skipResultLabel}>정답</Text>
              <Text style={s.skipResultAnswer}>{q.correct}</Text>
            </View>
          )}

          {/* Explanation Panel */}
          {answered && (
            <View style={s.explPanel}>
              <Text style={s.explHeader}>해설</Text>
              <View style={s.explWordRow}>
                <Text style={s.explWord}>{q.item.w}</Text>
                {q.item.p ? <Text style={s.explIpa}>{q.item.p}</Text> : null}
              </View>
              <Text style={s.explKor} numberOfLines={3}>{q.item.k_short}</Text>
              {q.item.s.length > 0 && (
                <View style={s.synTagRow}>
                  {q.item.s.slice(0, 5).map((syn, i) => (
                    <View key={i} style={s.synTag}>
                      <Text style={s.synTagText}>{syn}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}

          {answered && (
            <Pressable
              style={({ pressed }) => [s.nextBtn, pressed && { opacity: 0.85 }]}
              onPress={handleNext}
            >
              <Text style={s.nextBtnText}>
                {currentIdx + 1 >= questions.length ? "결과 보기 →" : "다음 →"}
              </Text>
            </Pressable>
          )}
        </Animated.View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = (colors: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    wrongBanner: {
      marginHorizontal: 16,
      marginTop: 16,
      marginBottom: 12,
      backgroundColor: "rgba(248,113,113,0.1)",
      borderWidth: 1,
      borderColor: "rgba(248,113,113,0.25)",
      borderRadius: 12,
      paddingVertical: 10,
      paddingHorizontal: 16,
    },
    wrongBannerText: {
      fontSize: 13,
      fontWeight: "700",
      color: colors.error,
    },
    wrongBannerSub: {
      fontSize: 11,
      color: colors.dim,
      marginTop: 2,
    },
    statsRow: {
      flexDirection: "row",
      gap: 8,
      paddingHorizontal: 16,
      marginBottom: 14,
    },
    statBox: {
      flex: 1,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingVertical: 10,
      alignItems: "center",
    },
    statNum: {
      fontSize: 20,
      fontWeight: "700",
      fontVariant: ["tabular-nums"],
    },
    statLabel: {
      fontSize: 9,
      color: colors.dim,
      textTransform: "uppercase",
      letterSpacing: 1,
      marginTop: 2,
    },
    progressContainer: {
      paddingHorizontal: 16,
      marginBottom: 16,
    },
    progressInfo: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: 6,
    },
    progressText: {
      fontSize: 11,
      color: colors.dim,
    },
    progressBar: {
      height: 3,
      backgroundColor: colors.border,
      borderRadius: 2,
      overflow: "hidden",
    },
    progressFill: {
      height: "100%",
      backgroundColor: colors.error,
      borderRadius: 2,
    },
    questionCard: {
      marginHorizontal: 16,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: "rgba(248,113,113,0.2)",
      borderRadius: 20,
      padding: 24,
    },
    questionHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 14,
    },
    questionNum: {
      fontSize: 11,
      color: colors.dim,
      letterSpacing: 1,
      textTransform: "uppercase",
    },
    bookmarkBtn: {
      padding: 4,
    },
    wordText: {
      fontSize: 30,
      fontWeight: "800",
      color: colors.foreground,
      letterSpacing: -1,
      marginBottom: 4,
    },
    ipaText: {
      fontSize: 13,
      color: colors.primary2 as string,
      fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
      letterSpacing: 0.5,
      marginBottom: 16,
    },
    hintText: {
      fontSize: 12,
      color: colors.dim,
      marginBottom: 14,
    },
    choicesContainer: {
      gap: 10,
    },
    choiceBtn: {
      backgroundColor: colors.card,
      borderWidth: 2,
      borderColor: colors.border,
      borderRadius: 12,
      padding: 14,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    choiceCorrect: {
      borderColor: colors.success,
      backgroundColor: "rgba(52,211,153,0.1)",
    },
    choiceWrong: {
      borderColor: colors.error,
      backgroundColor: "rgba(248,113,113,0.1)",
    },
    choiceNum: {
      width: 26,
      height: 26,
      borderRadius: 7,
      backgroundColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
    },
    choiceNumText: {
      fontSize: 11,
      fontWeight: "700",
      color: colors.dim,
    },
    choiceText: {
      fontSize: 14,
      color: colors.foreground,
      flex: 1,
      lineHeight: 20,
    },
    choiceMeaning: {
      fontSize: 11,
      color: colors.dim,
      marginTop: 3,
      lineHeight: 16,
    },
    explPanel: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      padding: 16,
      marginTop: 14,
    },
    explHeader: {
      fontSize: 11,
      fontWeight: "700",
      color: colors.dim,
      letterSpacing: 1,
      textTransform: "uppercase",
      marginBottom: 10,
    },
    explWordRow: {
      flexDirection: "row",
      alignItems: "baseline",
      gap: 10,
      marginBottom: 6,
      flexWrap: "wrap",
    },
    explWord: {
      fontSize: 16,
      fontWeight: "700",
      color: colors.foreground,
    },
    explIpa: {
      fontSize: 11,
      color: colors.dim,
      fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    },
    explKor: {
      fontSize: 14,
      color: colors.muted,
      marginBottom: 10,
      lineHeight: 20,
    },
    synTagRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 6,
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
    nextBtn: {
      backgroundColor: colors.error,
      borderRadius: 12,
      paddingVertical: 15,
      alignItems: "center",
      marginTop: 14,
    },
    nextBtnText: {
      fontSize: 14,
      fontWeight: "700",
      color: "#fff",
      letterSpacing: 0.5,
    },
    skipBtn: {
      marginTop: 12,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      paddingVertical: 11,
      alignItems: "center" as const,
      backgroundColor: "rgba(255,255,255,0.03)",
    },
    skipBtnText: {
      fontSize: 13,
      color: colors.dim,
      fontWeight: "600" as const,
    },
    skipResultBox: {
      marginTop: 12,
      backgroundColor: "rgba(248,113,113,0.08)",
      borderWidth: 1,
      borderColor: "rgba(248,113,113,0.25)",
      borderRadius: 10,
      padding: 14,
    },
    skipResultLabel: {
      fontSize: 10,
      color: colors.error,
      fontWeight: "700" as const,
      letterSpacing: 1,
      textTransform: "uppercase" as const,
      marginBottom: 4,
    },
    skipResultAnswer: {
      fontSize: 16,
      fontWeight: "700" as const,
      color: colors.foreground,
    },
  });
