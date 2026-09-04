import {
  useState,
  useCallback,
  useEffect,
  useRef,
  type ReactElement,
} from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Platform,
  type GestureResponderEvent,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  runOnJS,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";

import { ScreenContainer } from "@/components/screen-container";
import { PronunciationButton } from "@/components/pronunciation-button";
import { LearningDetails } from "@/components/learning-details";
import { type VocabItem } from "@/lib/vocab";
import {
  buildReviewQuestions,
  isChoiceCorrect,
  type QuizQuestion,
} from "@/lib/quiz-engine";
import { loadBookmarks, recordOneAnswer, toggleBookmark } from "@/lib/store";
import { useColors } from "@/hooks/use-colors";

function NativeSwipeBoundary({
  gesture,
  children,
}: {
  gesture: ReturnType<typeof Gesture.Pan>;
  children: ReactElement;
}) {
  if (Platform.OS === "web") return children;
  return <GestureDetector gesture={gesture}>{children}</GestureDetector>;
}

type WebSwipeTrace = {
  startX: number;
  startY: number;
  lastX: number;
  lastY: number;
};

function getTouchPoint(event: GestureResponderEvent, useChangedTouch = false) {
  const nativeEvent = event.nativeEvent;
  const touch = useChangedTouch
    ? (nativeEvent.changedTouches[0] ?? nativeEvent)
    : (nativeEvent.touches[0] ?? nativeEvent.changedTouches[0] ?? nativeEvent);
  return { x: touch.pageX, y: touch.pageY };
}

type WrongQuizQuestionViewState = {
  answered: boolean;
  selectedChoice: number | null;
  skipped: boolean;
};

function createEmptyQuestionViewState(): WrongQuizQuestionViewState {
  return {
    answered: false,
    selectedChoice: null,
    skipped: false,
  };
}

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
    buildReviewQuestions(wrongNums, count),
  );
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answered, setAnswered] = useState(false);
  const [selectedChoice, setSelectedChoice] = useState<number | null>(null);
  const [skipped, setSkipped] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [wrongCount, setWrongCount] = useState(0);
  const [wrongItems, setWrongItems] = useState<VocabItem[]>([]);
  const [bookmarks, setBookmarks] = useState<number[]>([]);
  const scrollRef = useRef<ScrollView>(null);
  const webSwipeTraceRef = useRef<WebSwipeTrace | null>(null);
  const isMovingRef = useRef(false);
  const questionViewStatesRef = useRef(
    new Map<number, WrongQuizQuestionViewState>(),
  );
  const sessionIdRef = useRef(
    `wrong-review-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`,
  );

  const cardScale = useSharedValue(1);
  const cardAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: cardScale.value }],
  }));

  useEffect(() => {
    loadBookmarks().then(setBookmarks);
  }, []);

  const haptic = useCallback(
    (type: "light" | "success" | "error" = "light") => {
      if (Platform.OS === "web") return;
      if (type === "light")
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      else if (type === "success")
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      else if (type === "error")
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    },
    [],
  );

  const animateCard = useCallback(() => {
    cardScale.value = withSequence(
      withTiming(0.97, { duration: 80 }),
      withTiming(1, { duration: 120 }),
    );
  }, [cardScale]);

  const q = questions[currentIdx];
  const isBookmarked = q ? bookmarks.includes(q.item.num) : false;

  const captureQuestionViewState = useCallback(() => {
    questionViewStatesRef.current.set(currentIdx, {
      answered,
      selectedChoice,
      skipped,
    });
  }, [answered, currentIdx, selectedChoice, skipped]);

  const restoreQuestionViewState = useCallback((index: number) => {
    const saved =
      questionViewStatesRef.current.get(index) ??
      createEmptyQuestionViewState();
    setAnswered(saved.answered);
    setSelectedChoice(saved.selectedChoice);
    setSkipped(saved.skipped);
  }, []);

  const releaseMovingLock = useCallback(() => {
    setTimeout(() => {
      isMovingRef.current = false;
    }, 180);
  }, []);

  const handleBookmark = useCallback(async () => {
    if (!q) return;
    haptic("light");
    const updated = await toggleBookmark(q.item.num);
    setBookmarks(updated);
  }, [q, haptic]);

  const handleChoiceSelect = useCallback(
    (idx: number) => {
      if (answered || questionViewStatesRef.current.get(currentIdx)?.answered)
        return;
      haptic("light");
      animateCard();
      questionViewStatesRef.current.set(currentIdx, {
        answered: true,
        selectedChoice: idx,
        skipped: false,
      });
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
      recordOneAnswer(isCorrect, isCorrect ? undefined : q.item.num, {
        sessionId: sessionIdRef.current,
        itemNum: q.item.num,
        mode: q.answerKind === "synonym" ? "syn-choice" : "kor-choice",
        outcome: isCorrect ? "correct" : "wrong",
        responseKey: choice?.value,
        answeredAt: Date.now(),
      });
    },
    [answered, currentIdx, q, haptic, animateCard],
  );

  const handleSkip = useCallback(() => {
    if (answered || questionViewStatesRef.current.get(currentIdx)?.answered)
      return;
    haptic("error");
    animateCard();
    questionViewStatesRef.current.set(currentIdx, {
      answered: true,
      selectedChoice: null,
      skipped: true,
    });
    setAnswered(true);
    setSkipped(true);
    setSelectedChoice(null);
    setWrongCount((w) => w + 1);
    setWrongItems((prev) => [...prev, q.item]);
    recordOneAnswer(false, q.item.num, {
      sessionId: sessionIdRef.current,
      itemNum: q.item.num,
      mode: q.answerKind === "synonym" ? "syn-choice" : "kor-choice",
      outcome: "skip",
      answeredAt: Date.now(),
    });
  }, [answered, currentIdx, q, haptic, animateCard]);

  const handleNext = useCallback(async () => {
    if (isMovingRef.current || !answered) return;
    isMovingRef.current = true;
    haptic("light");
    captureQuestionViewState();
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
    const targetIndex = currentIdx + 1;
    restoreQuestionViewState(targetIndex);
    setCurrentIdx(targetIndex);
    scrollRef.current?.scrollTo({ y: 0, animated: true });
    releaseMovingLock();
  }, [
    answered,
    captureQuestionViewState,
    correctCount,
    currentIdx,
    haptic,
    questions.length,
    releaseMovingLock,
    restoreQuestionViewState,
    router,
    wrongItems,
  ]);

  const handlePrevious = useCallback(() => {
    if (isMovingRef.current || currentIdx <= 0) return;
    isMovingRef.current = true;
    haptic("light");
    captureQuestionViewState();
    const targetIndex = currentIdx - 1;
    restoreQuestionViewState(targetIndex);
    setCurrentIdx(targetIndex);
    scrollRef.current?.scrollTo({ y: 0, animated: true });
    releaseMovingLock();
  }, [
    captureQuestionViewState,
    currentIdx,
    haptic,
    releaseMovingLock,
    restoreQuestionViewState,
  ]);

  const handleBackToWrongList = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)/wrong");
  }, [router]);

  const handleWebTouchStart = useCallback((event: GestureResponderEvent) => {
    if (Platform.OS !== "web") return;
    const point = getTouchPoint(event);
    webSwipeTraceRef.current = {
      startX: point.x,
      startY: point.y,
      lastX: point.x,
      lastY: point.y,
    };
  }, []);

  const handleWebTouchMove = useCallback((event: GestureResponderEvent) => {
    if (Platform.OS !== "web" || !webSwipeTraceRef.current) return;
    const point = getTouchPoint(event);
    webSwipeTraceRef.current.lastX = point.x;
    webSwipeTraceRef.current.lastY = point.y;
  }, []);

  const handleWebTouchEnd = useCallback(
    (event: GestureResponderEvent) => {
      if (Platform.OS !== "web") return;
      const trace = webSwipeTraceRef.current;
      webSwipeTraceRef.current = null;
      if (!trace) return;

      const point = getTouchPoint(event, true);
      const deltaX = point.x - trace.startX;
      const deltaY = point.y - trace.startY;
      const isClearHorizontalSwipe =
        Math.abs(deltaX) >= 56 && Math.abs(deltaX) > Math.abs(deltaY) * 1.35;

      if (!isClearHorizontalSwipe) return;
      if (deltaX < 0 && answered) handleNext();
      else if (deltaX > 0 && currentIdx > 0) handlePrevious();
    },
    [answered, currentIdx, handleNext, handlePrevious],
  );

  const swipeGesture = Gesture.Pan()
    .activeOffsetX([-24, 24])
    .failOffsetY([-18, 18])
    .onEnd((event) => {
      if (answered && event.translationX < -50) {
        runOnJS(handleNext)();
      } else if (currentIdx > 0 && event.translationX > 50) {
        runOnJS(handlePrevious)();
      }
    });

  const s = styles(colors);

  if (!q) {
    return (
      <ScreenContainer containerClassName="bg-background">
        <View style={s.emptyContainer}>
          <Text style={s.emptyEmoji}>📭</Text>
          <Text style={s.emptyTitle}>복습할 오답이 없습니다</Text>
          <Text style={s.emptyText}>
            오답 목록으로 돌아가 학습할 단어를 확인해 주세요.
          </Text>
          <Pressable
            style={s.emptyButton}
            onPress={() => router.replace("/(tabs)/wrong")}
          >
            <Text style={s.emptyButtonText}>오답 목록으로 돌아가기</Text>
          </Pressable>
        </View>
      </ScreenContainer>
    );
  }

  const pct = Math.round((currentIdx / questions.length) * 100);

  return (
    <ScreenContainer containerClassName="bg-background">
      <NativeSwipeBoundary gesture={swipeGesture}>
        <ScrollView
          ref={scrollRef}
          style={[
            { flex: 1 },
            Platform.OS === "web" && ({ touchAction: "pan-y" } as any),
          ]}
          contentContainerStyle={{ paddingBottom: 32 }}
          showsVerticalScrollIndicator={false}
          onTouchStart={handleWebTouchStart}
          onTouchMove={handleWebTouchMove}
          onTouchEnd={handleWebTouchEnd}
          onScrollBeginDrag={() => {
            webSwipeTraceRef.current = null;
          }}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="오답 목록으로 돌아가기"
            hitSlop={4}
            onPress={handleBackToWrongList}
            style={({ pressed }) => [
              s.backToListBtn,
              pressed && { opacity: 0.72 },
            ]}
          >
            <Text style={s.backToListText}>← 오답 목록</Text>
          </Pressable>

          {/* Header Banner */}
          <View style={s.wrongBanner}>
            <Text style={s.wrongBannerText}>🔴 오답 문제 풀이</Text>
            <Text style={s.wrongBannerSub}>틀린 단어만 모아서 복습</Text>
            <Text style={s.swipeHint}>
              위아래 스크롤 · 정답 후 왼쪽=다음 · 오른쪽=이전
            </Text>
          </View>

          {/* Stats Row */}
          <View style={s.statsRow}>
            <View style={[s.statBox]}>
              <Text style={[s.statNum, { color: colors.success }]}>
                {correctCount}
              </Text>
              <Text style={s.statLabel}>정답</Text>
            </View>
            <View style={s.statBox}>
              <Text style={[s.statNum, { color: colors.error }]}>
                {wrongCount}
              </Text>
              <Text style={s.statLabel}>오답</Text>
            </View>
            <View style={s.statBox}>
              <Text style={[s.statNum, { color: colors.primary2 as string }]}>
                {currentIdx}
              </Text>
              <Text style={s.statLabel}>진행</Text>
            </View>
          </View>

          {/* Progress Bar */}
          <View style={s.progressContainer}>
            <View style={s.progressInfo}>
              <Text style={s.progressText}>
                {currentIdx + 1} / {questions.length}
              </Text>
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
                {q.answerKind === "synonym"
                  ? "동의어 고르기"
                  : "한국어 뜻 고르기"}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={
                  isBookmarked ? "북마크 해제" : "북마크 추가"
                }
                onPress={handleBookmark}
                style={s.bookmarkBtn}
              >
                <Text style={{ fontSize: 20 }}>
                  {isBookmarked ? "🔖" : "🏷️"}
                </Text>
              </Pressable>
            </View>

            <View style={s.wordPronunciationRow}>
              <Text style={s.wordText}>{q.item.w}</Text>
              <PronunciationButton itemId={q.item.id} text={q.item.w} />
            </View>
            {q.item.p ? <Text style={s.ipaText}>{q.item.p}</Text> : null}

            <Text style={s.hintText}>
              {q.answerKind === "synonym"
                ? "올바른 동의어는?"
                : "올바른 한국어 뜻은?"}
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
                    <View
                      style={[
                        s.choiceNum,
                        answered &&
                          choiceIsCorrect && {
                            backgroundColor: colors.success,
                          },
                        answered &&
                          idx === selectedChoice &&
                          !choiceIsCorrect && { backgroundColor: colors.error },
                      ]}
                    >
                      <Text
                        style={[
                          s.choiceNumText,
                          answered &&
                            (choiceIsCorrect || idx === selectedChoice) && {
                              color: "#000",
                            },
                        ]}
                      >
                        {["①", "②", "③", "④"][idx]}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={textStyle} numberOfLines={2}>
                        {choice.label}
                      </Text>
                      {answered &&
                      choice.meaning &&
                      choice.meaning !== choice.label ? (
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

            {answered && <LearningDetails itemId={q.item.id} />}

            {(currentIdx > 0 || answered) && (
              <View style={s.questionNavRow}>
                {currentIdx > 0 ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="이전 문제"
                    style={({ pressed }) => [
                      s.previousBtn,
                      pressed && { opacity: 0.78 },
                    ]}
                    onPress={handlePrevious}
                  >
                    <Text style={s.previousBtnText}>← 이전 문제</Text>
                  </Pressable>
                ) : null}
                {answered ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={
                      currentIdx + 1 >= questions.length
                        ? "결과 보기"
                        : "다음 문제"
                    }
                    style={({ pressed }) => [
                      s.nextBtn,
                      pressed && { opacity: 0.85 },
                    ]}
                    onPress={handleNext}
                  >
                    <Text style={s.nextBtnText}>
                      {currentIdx + 1 >= questions.length
                        ? "결과 보기 →"
                        : "다음 문제 →"}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            )}
          </Animated.View>
        </ScrollView>
      </NativeSwipeBoundary>
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
    emptyText: {
      marginTop: 8,
      fontSize: 14,
      lineHeight: 21,
      textAlign: "center",
      color: colors.dim,
    },
    emptyButton: {
      marginTop: 20,
      minHeight: 44,
      borderRadius: 12,
      paddingHorizontal: 18,
      paddingVertical: 12,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.primary,
    },
    emptyButtonText: { color: "#FFFFFF", fontWeight: "700" },
    backToListBtn: {
      alignSelf: "flex-start",
      minHeight: 44,
      marginTop: 8,
      marginHorizontal: 16,
      paddingHorizontal: 4,
      alignItems: "center",
      justifyContent: "center",
    },
    backToListText: {
      fontSize: 14,
      fontWeight: "700",
      color: colors.foreground,
    },
    wrongBanner: {
      marginHorizontal: 16,
      marginTop: 4,
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
    swipeHint: {
      fontSize: 10,
      lineHeight: 15,
      color: colors.dim,
      marginTop: 5,
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
      width: 44,
      height: 44,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
    },
    wordPronunciationRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
      marginBottom: 4,
    },
    wordText: {
      flex: 1,
      fontSize: 30,
      fontWeight: "800",
      color: colors.foreground,
      letterSpacing: -1,
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
      minHeight: 52,
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
      flex: 1,
      minHeight: 50,
      backgroundColor: colors.error,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
    },
    nextBtnText: {
      fontSize: 14,
      fontWeight: "700",
      color: "#fff",
      letterSpacing: 0.5,
    },
    skipBtn: {
      marginTop: 12,
      minHeight: 44,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      paddingVertical: 11,
      alignItems: "center" as const,
      backgroundColor: "rgba(255,255,255,0.03)",
    },
    questionNavRow: {
      flexDirection: "row",
      gap: 10,
      marginTop: 14,
    },
    previousBtn: {
      flex: 1,
      minHeight: 50,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.card,
    },
    previousBtnText: {
      fontSize: 14,
      fontWeight: "700",
      color: colors.foreground,
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
