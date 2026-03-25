import { useState, useCallback, useRef, useEffect } from "react";
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
import {
  VOCAB,
  VocabItem,
  type QuizMode,
  shuffle,
  getSynDistractors,
  getKorDistractors,
} from "@/lib/vocab";
import { updateStatsAfterQuiz, toggleBookmark, loadBookmarks } from "@/lib/store";
import { useColors } from "@/hooks/use-colors";

interface QuizQuestion {
  item: VocabItem;
  choices: string[];
  correct: string;
}

function buildQuestions(
  mode: QuizMode,
  rangeStart: number,
  rangeEnd: number,
  count: number
): QuizQuestion[] {
  const pool = VOCAB.slice(rangeStart, rangeEnd + 1).filter(
    (v) => v.k && v.k.length > 2
  );

  let candidates: VocabItem[];
  if (mode === "syn-choice" || mode === "syn-type") {
    candidates = pool.filter((v) => v.s && v.s.length > 0);
  } else {
    candidates = pool;
  }

  const selected = shuffle(candidates).slice(0, Math.min(count, candidates.length));

  return selected.map((item) => {
    if (mode === "syn-choice") {
      const correctSyn = item.s[Math.floor(Math.random() * item.s.length)];
      const distractors = getSynDistractors(item, correctSyn, 3);
      const choices = shuffle([correctSyn, ...distractors]);
      return { item, choices, correct: correctSyn };
    } else if (mode === "kor-choice") {
      const distractors = getKorDistractors(item, pool, 3);
      const choices = shuffle([item.k, ...distractors]);
      return { item, choices, correct: item.k };
    } else if (mode === "flashcard") {
      return { item, choices: [], correct: item.k };
    } else {
      // syn-type
      const correctSyn = item.s[Math.floor(Math.random() * item.s.length)];
      return { item, choices: [], correct: correctSyn };
    }
  });
}

export default function QuizScreen() {
  const colors = useColors();
  const router = useRouter();
  const params = useLocalSearchParams<{
    mode: QuizMode;
    rangeStart: string;
    rangeEnd: string;
    count: string;
  }>();

  const mode = params.mode ?? "syn-choice";
  const rangeStart = parseInt(params.rangeStart ?? "0");
  const rangeEnd = parseInt(params.rangeEnd ?? "999");
  const count = parseInt(params.count ?? "20");

  const [questions] = useState<QuizQuestion[]>(() =>
    buildQuestions(mode, rangeStart, rangeEnd, count)
  );
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answered, setAnswered] = useState(false);
  const [selectedChoice, setSelectedChoice] = useState<number | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [wrongCount, setWrongCount] = useState(0);
  const [wrongItems, setWrongItems] = useState<VocabItem[]>([]);
  const [revealed, setRevealed] = useState(false);
  const [flashGrade, setFlashGrade] = useState<"correct" | "wrong" | null>(null);
  const [typedAnswer, setTypedAnswer] = useState("");
  const [typeResult, setTypeResult] = useState<"correct" | "wrong" | null>(null);
  const [bookmarks, setBookmarks] = useState<number[]>([]);
  const [hintLevel, setHintLevel] = useState(0);

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

      const isCorrect = q.choices[idx] === q.correct;
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

  const handleReveal = useCallback(() => {
    haptic("light");
    setRevealed(true);
  }, [haptic]);

  const handleFlashGrade = useCallback(
    (grade: "correct" | "wrong") => {
      haptic(grade === "correct" ? "success" : "error");
      setFlashGrade(grade);
      setAnswered(true);
      if (grade === "correct") {
        setCorrectCount((c) => c + 1);
      } else {
        setWrongCount((w) => w + 1);
        setWrongItems((prev) => [...prev, q.item]);
      }
    },
    [haptic, q]
  );

  const handleTypeSubmit = useCallback(() => {
    if (!typedAnswer.trim()) return;
    haptic("light");
    const userAns = typedAnswer.trim().toLowerCase();
    const allAccepted = [q.correct, ...q.item.s].map((s) => s.toLowerCase());
    const isCorrect = allAccepted.includes(userAns);
    setTypeResult(isCorrect ? "correct" : "wrong");
    setAnswered(true);
    if (isCorrect) {
      haptic("success");
      setCorrectCount((c) => c + 1);
    } else {
      haptic("error");
      setWrongCount((w) => w + 1);
      setWrongItems((prev) => [...prev, q.item]);
    }
  }, [typedAnswer, q, haptic]);

  const handleNext = useCallback(async () => {
    haptic("light");
    if (currentIdx + 1 >= questions.length) {
      // Quiz done
      await updateStatsAfterQuiz(correctCount + (mode === "flashcard" && flashGrade === "correct" ? 1 : 0), questions.length);
      router.replace({
        pathname: "/result",
        params: {
          correct: correctCount,
          total: questions.length,
          wrongNums: wrongItems.map((w) => w.num).join(","),
        },
      });
      return;
    }
    setCurrentIdx((i) => i + 1);
    setAnswered(false);
    setSelectedChoice(null);
    setRevealed(false);
    setFlashGrade(null);
    setTypedAnswer("");
    setTypeResult(null);
    setHintLevel(0);
  }, [currentIdx, questions.length, correctCount, wrongItems, mode, flashGrade, haptic, router]);

  const s = styles(colors);
  const pct = Math.round((currentIdx / questions.length) * 100);

  if (!q) return null;

  const getHint = () => {
    const word = q.correct;
    if (hintLevel === 0) return "_ ".repeat(word.length).trim();
    const revealed_count = Math.ceil(word.length * hintLevel * 0.4);
    return word
      .split("")
      .map((ch, i) => (i < revealed_count ? ch : ch === " " ? " " : "_"))
      .join(" ");
  };

  return (
    <ScreenContainer containerClassName="bg-background">
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: 32 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Stats Row */}
          <View style={s.statsRow}>
            <View style={[s.statBox, s.statOk]}>
              <Text style={[s.statNum, { color: colors.success }]}>{correctCount}</Text>
              <Text style={s.statLabel}>정답</Text>
            </View>
            <View style={[s.statBox, s.statErr]}>
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
                문제 {currentIdx + 1} ·{" "}
                {mode === "syn-choice" ? "동의어 고르기" :
                  mode === "kor-choice" ? "한국어 뜻 고르기" :
                  mode === "flashcard" ? "플래시카드" : "동의어 입력"}
              </Text>
              <Pressable onPress={handleBookmark} style={s.bookmarkBtn}>
                <Text style={{ fontSize: 20 }}>{isBookmarked ? "🔖" : "🏷️"}</Text>
              </Pressable>
            </View>

            <Text style={s.wordText}>{q.item.w}</Text>
            {q.item.p ? (
              <Text style={s.ipaText}>{q.item.p}</Text>
            ) : null}

            {/* Mode-specific content */}
            {(mode === "syn-choice" || mode === "kor-choice") && (
              <>
                <Text style={s.hintText}>
                  {mode === "syn-choice" ? "올바른 동의어는?" : "올바른 한국어 뜻은?"}
                </Text>
                <View style={s.choicesContainer}>
                  {q.choices.map((choice, idx) => {
                    let choiceStyle = s.choiceBtn;
                    let textStyle = s.choiceText;
                    if (answered) {
                      if (choice === q.correct) {
                        choiceStyle = { ...s.choiceBtn, ...s.choiceCorrect };
                        textStyle = { ...s.choiceText, color: colors.success };
                      } else if (idx === selectedChoice) {
                        choiceStyle = { ...s.choiceBtn, ...s.choiceWrong };
                        textStyle = { ...s.choiceText, color: colors.error };
                      }
                    }
                    return (
                      <Pressable
                        key={idx}
                        style={choiceStyle}
                        onPress={() => handleChoiceSelect(idx)}
                        disabled={answered}
                      >
                        <View style={[
                          s.choiceNum,
                          answered && choice === q.correct && { backgroundColor: colors.success },
                          answered && idx === selectedChoice && choice !== q.correct && { backgroundColor: colors.error },
                        ]}>
                          <Text style={[
                            s.choiceNumText,
                            answered && (choice === q.correct || idx === selectedChoice) && { color: "#000" },
                          ]}>
                            {["①", "②", "③", "④"][idx]}
                          </Text>
                        </View>
                        <Text style={textStyle} numberOfLines={2}>
                          {choice.length > 60 ? choice.slice(0, 60) + "…" : choice}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </>
            )}

            {mode === "flashcard" && (
              <View style={s.flashContainer}>
                {!revealed ? (
                  <>
                    <Text style={s.flashHint}>뜻을 떠올린 후 확인 버튼을 누르세요</Text>
                    <Pressable style={s.revealBtn} onPress={handleReveal}>
                      <Text style={s.revealBtnText}>🔍 뜻 확인</Text>
                    </Pressable>
                  </>
                ) : (
                  <>
                    <View style={s.flashAnswer}>
                      <Text style={s.flashKorText}>{q.item.k_short}</Text>
                      {q.item.s.length > 0 && (
                        <View style={s.synTagRow}>
                          {q.item.s.slice(0, 4).map((syn, i) => (
                            <View key={i} style={s.synTag}>
                              <Text style={s.synTagText}>{syn}</Text>
                            </View>
                          ))}
                        </View>
                      )}
                    </View>
                    {!answered && (
                      <View style={s.gradeRow}>
                        <Pressable
                          style={[s.gradeBtn, s.gradeBtnWrong]}
                          onPress={() => handleFlashGrade("wrong")}
                        >
                          <Text style={[s.gradeBtnText, { color: colors.error }]}>❌ 모르겠어요</Text>
                        </Pressable>
                        <Pressable
                          style={[s.gradeBtn, s.gradeBtnCorrect]}
                          onPress={() => handleFlashGrade("correct")}
                        >
                          <Text style={[s.gradeBtnText, { color: colors.success }]}>✅ 알았어요</Text>
                        </Pressable>
                      </View>
                    )}
                  </>
                )}
              </View>
            )}

            {mode === "syn-type" && (
              <View style={s.typeContainer}>
                <Text style={s.hintText}>동의어를 입력하세요</Text>
                <View style={s.hintRow}>
                  <View style={s.hintBox}>
                    <Text style={s.hintBoxText}>{getHint()}</Text>
                  </View>
                  {!answered && (
                    <Pressable
                      style={s.hintBtn}
                      onPress={() => setHintLevel((h) => Math.min(h + 1, 3))}
                    >
                      <Text style={s.hintBtnText}>힌트</Text>
                    </Pressable>
                  )}
                </View>
                <TextInput
                  style={[
                    s.typeInput,
                    typeResult === "correct" && s.typeInputCorrect,
                    typeResult === "wrong" && s.typeInputWrong,
                  ]}
                  value={typedAnswer}
                  onChangeText={setTypedAnswer}
                  placeholder="동의어 입력..."
                  placeholderTextColor={colors.dim}
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!answered}
                  returnKeyType="done"
                  onSubmitEditing={handleTypeSubmit}
                />
                {!answered && (
                  <Pressable style={s.submitBtn} onPress={handleTypeSubmit}>
                    <Text style={s.submitBtnText}>확인</Text>
                  </Pressable>
                )}
                {typeResult === "wrong" && (
                  <View style={s.typeWrongInfo}>
                    <Text style={s.typeWrongText}>정답: {q.correct}</Text>
                  </View>
                )}
              </View>
            )}

            {/* Explanation Panel (after answering) */}
            {answered && mode !== "flashcard" && (
              <View style={s.explPanel}>
                <Text style={s.explHeader}>해설</Text>
                <View style={s.explWordRow}>
                  <Text style={s.explWord}>{q.item.w}</Text>
                  {q.item.p ? (
                    <Text style={s.explIpa}>{q.item.p}</Text>
                  ) : null}
                </View>
                <Text style={s.explKor} numberOfLines={3}>
                  {q.item.k_short}
                </Text>
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

            {/* Next Button */}
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
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const styles = (colors: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    statsRow: {
      flexDirection: "row",
      gap: 8,
      paddingHorizontal: 16,
      paddingTop: 16,
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
    statOk: {},
    statErr: {},
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
      backgroundColor: colors.primary,
      borderRadius: 2,
    },
    questionCard: {
      marginHorizontal: 16,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
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
    flashContainer: {
      marginTop: 8,
    },
    flashHint: {
      fontSize: 13,
      color: colors.dim,
      textAlign: "center",
      marginBottom: 16,
    },
    revealBtn: {
      backgroundColor: colors.card,
      borderWidth: 2,
      borderColor: colors.border,
      borderRadius: 12,
      paddingVertical: 13,
      alignItems: "center",
    },
    revealBtnText: {
      fontSize: 13,
      fontWeight: "600",
      color: colors.primary2 as string,
    },
    flashAnswer: {
      backgroundColor: "rgba(52,211,153,0.08)",
      borderWidth: 1,
      borderColor: "rgba(52,211,153,0.25)",
      borderRadius: 12,
      padding: 16,
      marginBottom: 14,
    },
    flashKorText: {
      fontSize: 16,
      fontWeight: "600",
      color: colors.success,
      marginBottom: 8,
      lineHeight: 22,
    },
    gradeRow: {
      flexDirection: "row",
      gap: 10,
    },
    gradeBtn: {
      flex: 1,
      borderWidth: 2,
      borderRadius: 12,
      paddingVertical: 13,
      alignItems: "center",
    },
    gradeBtnWrong: {
      borderColor: "rgba(248,113,113,0.25)",
      backgroundColor: "rgba(248,113,113,0.08)",
    },
    gradeBtnCorrect: {
      borderColor: "rgba(52,211,153,0.25)",
      backgroundColor: "rgba(52,211,153,0.08)",
    },
    gradeBtnText: {
      fontSize: 13,
      fontWeight: "700",
    },
    typeContainer: {
      marginTop: 8,
    },
    hintRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginBottom: 12,
      flexWrap: "wrap",
    },
    hintBox: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 6,
    },
    hintBoxText: {
      fontSize: 14,
      letterSpacing: 3,
      color: colors.muted,
      fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    },
    hintBtn: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 5,
    },
    hintBtnText: {
      fontSize: 11,
      color: colors.dim,
    },
    typeInput: {
      backgroundColor: colors.card,
      borderWidth: 2,
      borderColor: colors.border,
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 14,
      fontSize: 15,
      color: colors.foreground,
      marginTop: 8,
    },
    typeInputCorrect: {
      borderColor: colors.success,
      backgroundColor: "rgba(52,211,153,0.08)",
    },
    typeInputWrong: {
      borderColor: colors.error,
      backgroundColor: "rgba(248,113,113,0.08)",
    },
    submitBtn: {
      backgroundColor: colors.primary,
      borderRadius: 12,
      paddingVertical: 13,
      alignItems: "center",
      marginTop: 10,
    },
    submitBtnText: {
      fontSize: 13,
      fontWeight: "700",
      color: "#fff",
    },
    typeWrongInfo: {
      marginTop: 8,
      padding: 10,
      backgroundColor: "rgba(248,113,113,0.08)",
      borderRadius: 8,
    },
    typeWrongText: {
      fontSize: 13,
      color: colors.error,
      fontWeight: "600",
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
      backgroundColor: colors.primary,
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
  });
