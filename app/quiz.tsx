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
  runOnJS,
  interpolate,
  Extrapolation,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";

import { ScreenContainer } from "@/components/screen-container";
import { FlipCard } from "@/components/flip-card";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { type QuizMode, type VocabItem } from "@/lib/vocab";
import {
  buildQuizQuestions,
  isChoiceCorrect,
  isTypedAnswerCorrect,
  type ChoiceLang,
  type QuizQuestion,
} from "@/lib/quiz-engine";
import { updateStatsAfterQuiz, toggleBookmark, loadBookmarks, addWrongWords, recordOneAnswer, loadMastered, addMastered } from "@/lib/store";
import { useColors } from "@/hooks/use-colors";

export default function QuizScreen() {
  const colors = useColors();
  const router = useRouter();
  const isMovingRef = useRef(false);
  const params = useLocalSearchParams<{
    mode: QuizMode;
    rangeStart: string;
    rangeEnd: string;
    count: string;
    rangeId?: string;
    choiceLang?: string;
    bookmarkNums?: string;
  }>();

  const mode = params.mode ?? "syn-choice";
  const rangeStart = parseInt(params.rangeStart ?? "0");
  const rangeEnd = parseInt(params.rangeEnd ?? "999");
  const count = parseInt(params.count ?? "20");
  const rangeId = params.rangeId ?? "";
  const choiceLang: ChoiceLang = params.choiceLang === "english" ? "english" : "korean";
  const itemNums = [...new Set(
    (params.bookmarkNums ?? "")
      .split(",")
      .map((value) => Number(value))
      .filter((value) => Number.isInteger(value) && value > 0),
  )];

  const [masteredNums, setMasteredNums] = useState<number[]>([]);
  const [questionsReady, setQuestionsReady] = useState(mode !== "flashcard");
  const [questions, setQuestions] = useState<QuizQuestion[]>(() =>
    mode === "flashcard"
      ? []
      : buildQuizQuestions({
          mode,
          rangeStart,
          rangeEnd,
          count,
          rangeId,
          choiceLang,
          itemNums: itemNums.length > 0 ? itemNums : undefined,
        })
  );
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answered, setAnswered] = useState(false);
  const [selectedChoice, setSelectedChoice] = useState<number | null>(null);
  const [skipped, setSkipped] = useState(false);
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
  // 카드 슬라이드 전환용 shared values
  const cardTranslateX = useSharedValue(0);
  const cardOpacity = useSharedValue(1);

  const cardAnimStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: cardScale.value },
      { translateX: cardTranslateX.value },
    ],
    opacity: cardOpacity.value,
  }));

  useEffect(() => {
    loadBookmarks().then(setBookmarks);
    if (mode === "flashcard") {
      loadMastered().then((loadedMastered) => {
        setMasteredNums(loadedMastered);
        setQuestions(
          buildQuizQuestions({
            mode,
            rangeStart,
            rangeEnd,
            count,
            rangeId,
            choiceLang,
            masteredNums: loadedMastered,
            itemNums: itemNums.length > 0 ? itemNums : undefined,
          }),
        );
        setQuestionsReady(true);
      });
    }
  }, [choiceLang, count, mode, params.bookmarkNums, rangeEnd, rangeId, rangeStart]);

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

  // 카드 슬라이드 전환 애니메이션 (다음 문제로 이동 시)
  const slideToNext = useCallback((onComplete: () => void) => {
    // 현재 카드를 왼쪽으로 슬라이드 아웃
    cardTranslateX.value = withTiming(-60, { duration: 180 });
    cardOpacity.value = withTiming(0, { duration: 180 }, () => {
      // 오른쪽에서 새 카드 진입
      cardTranslateX.value = 60;
      cardOpacity.value = 0;
      runOnJS(onComplete)();
      cardTranslateX.value = withTiming(0, { duration: 220 });
      cardOpacity.value = withTiming(1, { duration: 220 });
    });
  }, [cardTranslateX, cardOpacity]);

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
      // 한 문제 단위 즉시 저장
      recordOneAnswer(isCorrect, isCorrect ? undefined : q.item.num);
    },
    [answered, q, haptic, animateCard]
  );

  // "모르겠다" 패스 — 오답 처리 + 오답 노트 저장
  const handleSkip = useCallback(() => {
    if (answered) return;
    haptic("error");
    animateCard();
    setAnswered(true);
    setSkipped(true);
    setSelectedChoice(null);
    setWrongCount((w) => w + 1);
    setWrongItems((prev) => [...prev, q.item]);
    // 패스도 오답으로 즉시 저장
    recordOneAnswer(false, q.item.num);
  }, [answered, q, haptic, animateCard]);

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
      // 플래시카드 채점 즉시 저장
      recordOneAnswer(grade === "correct", grade === "correct" ? undefined : q.item.num);
    },
    [haptic, q]
  );

  // 플래시카드 마스터 처리 — 이 단어를 마스터 목록에 추가
  const handleFlashMaster = useCallback(async () => {
    if (!q) return;
    haptic("success");
    const updated = await addMastered(q.item.num);
    setMasteredNums(updated);
    // 마스터 처리 후 자동으로 다음 문제로 이동
    if (currentIdx + 1 >= questions.length) {
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
    setSkipped(false);
    setRevealed(false);
    setFlashGrade(null);
  }, [q, haptic, currentIdx, questions.length, correctCount, wrongItems, router]);

  const handleTypeSubmit = useCallback(() => {
    if (!typedAnswer.trim()) return;
    haptic("light");
    const isCorrect = isTypedAnswerCorrect(q, typedAnswer);
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
    // 타이핑 정답 즉시 저장
    recordOneAnswer(isCorrect, isCorrect ? undefined : q.item.num);
  }, [typedAnswer, q, haptic]);

  const handleNext = useCallback(async () => {
    if (isMovingRef.current) return;
    isMovingRef.current = true;
    haptic("light");
    if (currentIdx + 1 >= questions.length) {
      const finalWrongNums = wrongItems.map((w) => w.num);
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
    // 슬라이드 애니메이션 후 다음 문제로 전환
    slideToNext(() => {
      setCurrentIdx((i) => i + 1);
      setAnswered(false);
      setSelectedChoice(null);
      setSkipped(false);
      setRevealed(false);
      setFlashGrade(null);
      setTypedAnswer("");
      setTypeResult(null);
      setHintLevel(0);
      isMovingRef.current = false;
    });
  }, [currentIdx, questions.length, correctCount, wrongItems, haptic, router, slideToNext]);

  // 스와이프 제스처 — 정답 확인 후 왼쪽 스와이프로 다음 문제
  const swipeGesture = Gesture.Pan()
    .activeOffsetX([-20, 20])
    .failOffsetY([-15, 15])
    .onEnd((e) => {
      if (answered && e.translationX < -50) {
        runOnJS(handleNext)();
      }
    });

  const s = styles(colors);

  if (!q) {
    return (
      <ScreenContainer containerClassName="bg-background">
        <View style={s.emptyContainer}>
          <Text style={s.emptyEmoji}>{questionsReady ? "📭" : "⏳"}</Text>
          <Text style={s.emptyTitle}>
            {questionsReady ? "출제할 문제가 없습니다" : "문제를 준비하고 있습니다"}
          </Text>
          {questionsReady ? (
            <>
              <Text style={s.emptyText}>
                선택한 범위나 모드를 바꾼 뒤 다시 시도해 주세요.
              </Text>
              <Pressable style={s.emptyButton} onPress={() => router.replace("/")}>
                <Text style={s.emptyButtonText}>퀴즈 설정으로 돌아가기</Text>
              </Pressable>
            </>
          ) : null}
        </View>
      </ScreenContainer>
    );
  }

  const pct = Math.round((currentIdx / questions.length) * 100);

  const isChoiceMode = mode === "syn-choice" || mode === "kor-choice" || mode === "syn-kor-choice";

  const getModeLabel = () => {
    if (mode === "syn-choice") return "동의어 고르기";
    if (mode === "kor-choice") {
      return choiceLang === "english" ? "동의어 고르기 (영어)" : "한국어 뜻 고르기";
    }
    if (mode === "syn-kor-choice") return "동의어+뜻 고르기";
    if (mode === "flashcard") return "플래시카드";
    return "동의어 입력";
  };

  const getHintText = () => {
    if (mode === "syn-choice") return "올바른 동의어는?";
    if (mode === "kor-choice") {
      return choiceLang === "english" ? "올바른 동의어는? (영어)" : "올바른 한국어 뜻은?";
    }
    return "올바른 동의어(한글뜻)는?";
  };

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
        <GestureDetector gesture={swipeGesture}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: 32 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={s.navigationRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="퀴즈 설정으로 돌아가기"
              hitSlop={6}
              style={({ pressed }) => [s.backBtn, pressed && { opacity: 0.7 }]}
              onPress={() => {
                if (router.canGoBack()) router.back();
                else router.replace("/");
              }}
            >
              <IconSymbol name="arrow.left" size={20} color={colors.foreground} />
              <Text style={s.backBtnText}>퀴즈 설정</Text>
            </Pressable>
            <Text style={s.swipeHint}>정답 후 왼쪽으로 밀어 넘기기</Text>
          </View>

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
                문제 {currentIdx + 1} · {getModeLabel()}
              </Text>
              <Pressable onPress={handleBookmark} style={s.bookmarkBtn}>
                <Text style={{ fontSize: 20 }}>{isBookmarked ? "🔖" : "🏷️"}</Text>
              </Pressable>
            </View>

            <Text style={s.wordText}>{q.item.w}</Text>
            {q.item.p ? (
              <Text style={s.ipaText}>{q.item.p}</Text>
            ) : null}

            {/* 4지선다 모드 */}
            {isChoiceMode && (
              <>
                <Text style={s.hintText}>{getHintText()}</Text>
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
                          <Text style={textStyle} numberOfLines={3}>
                            {choice.label}
                          </Text>
                          {answered && choice.meaning && choice.meaning !== choice.label ? (
                            <Text style={s.choiceKorText}>{choice.meaning}</Text>
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
              </>
            )}

            {/* 플래시카드 모드 */}
            {mode === "flashcard" && (
              <View style={s.flashContainer}>
                <FlipCard
                  flipped={revealed}
                  style={s.flipCardWrapper}
                  front={
                    <View style={s.flipFront}>
                      <Text style={s.flashHint}>뜻을 떠올린 후 확인 버튼을 누르세요</Text>
                      <Pressable style={s.revealBtn} onPress={handleReveal}>
                        <Text style={s.revealBtnText}>🔍 뜻 확인</Text>
                      </Pressable>
                    </View>
                  }
                  back={
                    <View style={s.flipBack}>
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
                    </View>
                  }
                />
                {revealed && !answered && (
                  <View style={{ marginTop: 14, gap: 8 }}>
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
                    {/* 마스터 버튼 — 이 단어는 완전히 알아서 앞으로 출제 제외 */}
                    <Pressable
                      style={s.masterBtn}
                      onPress={handleFlashMaster}
                    >
                      <Text style={s.masterBtnText}>⭐ 마스터 — 다음부터 이 단어 제외</Text>
                    </Pressable>
                  </View>
                )}
              </View>
            )}

            {/* 동의어 입력 모드 */}
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

            {/* 해설 패널 */}
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

            {/* 다음 버튼 */}
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
        </GestureDetector>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const styles = (colors: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    emptyContainer: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 32,
    },
    emptyEmoji: { fontSize: 48, marginBottom: 16 },
    emptyTitle: { fontSize: 19, fontWeight: "700", color: colors.foreground },
    emptyText: { marginTop: 8, fontSize: 14, lineHeight: 21, textAlign: "center", color: colors.dim },
    emptyButton: { marginTop: 20, borderRadius: 12, paddingHorizontal: 18, paddingVertical: 12, backgroundColor: colors.primary },
    emptyButtonText: { color: "#FFFFFF", fontWeight: "700" },
    statsRow: {
      flexDirection: "row",
      gap: 8,
      paddingHorizontal: 16,
      paddingTop: 4,
      marginBottom: 14,
    },
    navigationRow: {
      minHeight: 52,
      paddingHorizontal: 16,
      paddingTop: 6,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
    },
    backBtn: {
      minWidth: 44,
      minHeight: 44,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 4,
      paddingHorizontal: 8,
      borderRadius: 10,
    },
    backBtnText: {
      fontSize: 13,
      fontWeight: "700",
      color: colors.foreground,
    },
    swipeHint: {
      flexShrink: 1,
      fontSize: 10,
      color: colors.dim,
      textAlign: "right",
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
      width: 44,
      height: 44,
      alignItems: "center",
      justifyContent: "center",
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
      minHeight: 52,
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
    skipBtn: {
      marginTop: 12,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      paddingVertical: 11,
      minHeight: 44,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: "rgba(255,255,255,0.03)",
    },
    skipBtnText: {
      fontSize: 13,
      color: colors.dim,
      fontWeight: "600",
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
      fontWeight: "700",
      letterSpacing: 1,
      textTransform: "uppercase",
      marginBottom: 4,
    },
    skipResultAnswer: {
      fontSize: 16,
      fontWeight: "700",
      color: colors.foreground,
    },
    flashContainer: {
      marginTop: 8,
    },
    flipCardWrapper: {
      minHeight: 160,
      width: "100%",
    },
    flipFront: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 16,
    },
    flipBack: {
      flex: 1,
      paddingVertical: 4,
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
      minHeight: 50,
      alignItems: "center",
      marginTop: 14,
    },
    nextBtnText: {
      fontSize: 14,
      fontWeight: "700",
      color: "#fff",
      letterSpacing: 0.5,
    },
    choiceKorText: {
      fontSize: 11,
      color: colors.dim,
      marginTop: 3,
      lineHeight: 15,
    },
    masterBtn: {
      backgroundColor: "rgba(251,191,36,0.12)",
      borderWidth: 1,
      borderColor: "rgba(251,191,36,0.35)",
      borderRadius: 12,
      paddingVertical: 12,
      alignItems: "center",
    },
    masterBtnText: {
      fontSize: 13,
      fontWeight: "700",
      color: "#F59E0B",
    },
  });
