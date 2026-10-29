import { ProblemSenseContext } from "@/components/problem-sense-context";
import {
  ActiveRecallAnswer,
  ActiveRecallPrompt,
  DefinitionRecallAnswer,
  DefinitionRecallPrompt,
  SynonymRecallAnswer,
} from "@/components/active-recall-card";
import { MnemonicCue } from "@/components/mnemonic-cue";
import {
  useState,
  useCallback,
  useRef,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type ReactElement,
} from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  TextInput,
  KeyboardAvoidingView,
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
import { resultReviewParams } from '@/lib/result-review';
import { QUIZ_CONTENT_MAX_WIDTH, STUDY_PAGE_GUTTER, STUDY_CARD_PADDING } from "@/lib/layout";
import { FlipCard } from "@/components/flip-card";
import { PronunciationButton } from "@/components/pronunciation-button";
import { LearningDetails } from "@/components/learning-details";
import { BookLearningDetails } from "@/components/book-learning-details";
import { WordPronunciation } from "@/components/word-pronunciation";
import { SynonymDetails } from "@/components/synonym-details";
import { QuizEmptyState, QuizSessionHold, type QuizPreparationFailure } from "@/components/quiz-empty-state";
import { SentenceCompletionAnswer, SentenceCompletionPrompt } from "@/components/sentence-completion-card";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { getVocabItem, type QuizMode, type VocabItem } from "@/lib/vocab";
import {
  buildQuizQuestions,
  getQuizCandidateItems,
  isChoiceCorrect,
  isTypedAnswerCorrect,
  type ChoiceLang,
  type QuizQuestion,
} from "@/lib/quiz-engine";
import {
  loadBookmarks,
  loadMastered,
  loadSenseLearningState,
  loadLearningSnapshot,
  markLearningTargetMastered,
  loadQuizSessionForStudy,
  retryLearningStorage,
  getQuizStorageIssue,
  getLearningStorageRecovery,
  subscribeLearningStorage,
  saveQuizSession,
  prepareAdaptiveQuizSession,
  recordOneAnswer,
  recordSenseLearningEvent,
  toggleBookmark,
  type AdaptiveAnswerContext,
} from "@/lib/store";
import {
  getItemLearningTargets,
  getQuizLearningTargets,
  getQuestionLearningTargetKey,
  parseLearningReviewKeys,
} from "@/lib/canonical-learning";
import {
  getLearningTargetState,
  learningPriority,
  masteredTargetKeys,
} from "@/lib/learning-state";
import { getMnemonicVisual } from "@/lib/mnemonic-visual";
import { useColors } from "@/hooks/use-colors";
import { useQuestionTimer } from "@/hooks/use-question-timer";
import { selectAdaptiveItemNums } from "@/lib/adaptive-quiz";
import { ADAPTIVE_POLICY } from "@/lib/learning-analytics";
import { classifyQuizSwipe, getNextQuizIndex, canReorderQuizQuestion } from "@/lib/quiz-navigation";
import {
  createEmptyQuestionViewState,
  summarizeQuizSession,
  type QuizQuestionViewState,
  type QuizSession,
} from "@/lib/quiz-session";

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
  vertical: boolean;
};

function getTouchPoint(event: GestureResponderEvent, useChangedTouch = false) {
  const nativeEvent = event.nativeEvent;
  const touch = useChangedTouch
    ? (nativeEvent.changedTouches[0] ?? nativeEvent)
    : (nativeEvent.touches[0] ?? nativeEvent.changedTouches[0] ?? nativeEvent);
  return { x: touch.pageX, y: touch.pageY };
}

export default function QuizScreen() {
  const colors = useColors();
  const router = useRouter();
  const isMovingRef = useRef(false);
  const scrollRef = useRef<ScrollView>(null);
  const webSwipeTraceRef = useRef<WebSwipeTrace | null>(null);
  const suppressTouchPressUntilRef = useRef(0);
  const [scrollViewportHeight, setScrollViewportHeight] = useState(0);
  const questionViewStatesRef = useRef(
    new Map<number, QuizQuestionViewState>(),
  );
  const sessionIdRef = useRef("");
  const sessionCompletedRef = useRef(false);
  const questionTimer = useQuestionTimer();
  const [restartToken, setRestartToken] = useState(0);
  const [sessionNotice, setSessionNotice] = useState("");
  const [sessionRecoveryFailed, setSessionRecoveryFailed] = useState(false);
  const [preparationFailure, setPreparationFailure] = useState<QuizPreparationFailure>("SESSION_READ");
  const [recoveryBusy, setRecoveryBusy] = useState(false);
  const recoveryBusyRef = useRef(false);
  const automaticResumeRequestRef = useRef<string | null>(null);
  const quizStorageIssue = useSyncExternalStore(subscribeLearningStorage, getQuizStorageIssue, () => null);
  const canRetryStorage = useSyncExternalStore(subscribeLearningStorage, () => getLearningStorageRecovery().canRetry, () => false);
  const params = useLocalSearchParams<{
    mode: QuizMode;
    rangeStart: string;
    rangeEnd: string;
    count: string;
    rangeId?: string;
    choiceLang?: string;
    bookmarkNums?: string;
    reviewKeys?: string;
  }>();

  const mode = params.mode ?? "definition-choice";
  const rangeStart = parseInt(params.rangeStart ?? "0");
  const rangeEnd = parseInt(params.rangeEnd ?? "999");
  const count = parseInt(params.count ?? "20");
  const rangeId = params.rangeId ?? "";
  const choiceLang: ChoiceLang =
    params.choiceLang === "english" ? "english" : "korean";
  const itemNums = useMemo(
    () => [
      ...new Set(
        (params.bookmarkNums ?? "")
          .split(",")
          .map((value) => Number(value))
          .filter((value) => Number.isInteger(value) && value > 0),
      ),
    ],
    [params.bookmarkNums],
  );
  const reviewKeys = useMemo(() => parseLearningReviewKeys(params.reviewKeys ?? "", itemNums.map(getVocabItem).filter((item): item is VocabItem => Boolean(item))), [params.reviewKeys, itemNums]);

  const [questionsReady, setQuestionsReady] = useState(false);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answered, setAnswered] = useState(false);
  const [selectedChoice, setSelectedChoice] = useState<number | null>(null);
  const [skipped, setSkipped] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [wrongCount, setWrongCount] = useState(0);
  const [wrongItems, setWrongItems] = useState<VocabItem[]>([]);
  const [revealed, setRevealed] = useState(false);
  const [flashGrade, setFlashGrade] = useState<"correct" | "wrong" | null>(
    null,
  );
  const [typedAnswer, setTypedAnswer] = useState("");
  const [typeResult, setTypeResult] = useState<"correct" | "wrong" | null>(
    null,
  );
  const [bookmarks, setBookmarks] = useState<number[]>([]);
  const [hintLevel, setHintLevel] = useState(0);
  const [imageRevealed, setImageRevealed] = useState(false);
  const [masteredOnCard, setMasteredOnCard] = useState(false);
  const requestKey = useMemo(() => JSON.stringify({ mode, rangeStart, rangeEnd, count, rangeId, choiceLang, itemNums, ...(reviewKeys.length ? { reviewKeys } : {}) }),
    [mode, rangeStart, rangeEnd, count, rangeId, choiceLang, itemNums, reviewKeys]);

  const restoreQuestionViewState = useCallback((index: number) => {
    const snapshot = questionViewStatesRef.current.get(index) ?? createEmptyQuestionViewState();
    setAnswered(snapshot.answered);
    setSelectedChoice(snapshot.selectedChoice);
    setSkipped(snapshot.skipped);
    setRevealed(snapshot.revealed);
    setFlashGrade(snapshot.flashGrade);
    setTypedAnswer(snapshot.typedAnswer);
    setTypeResult(snapshot.typeResult);
    setHintLevel(snapshot.hintLevel);
    setMasteredOnCard(snapshot.mastered);
  }, []);

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
    let cancelled = false;
    loadBookmarks().then((loaded) => {
      if (!cancelled) setBookmarks(loaded);
    }).catch(() => undefined);

    let failureStage: QuizPreparationFailure = "SESSION_READ";
    const prepareQuestions = async () => {
      setQuestionsReady(false);
      setQuestions([]);
      isMovingRef.current = false;
      sessionCompletedRef.current = false;
      setSessionNotice("");
      setSessionRecoveryFailed(false);
      const { session: saved, archived } = await loadQuizSessionForStudy(requestKey);
      if (cancelled) return;
      if (archived) setSessionNotice("이전 답안은 보관했습니다. 최신 문제로 새 학습을 시작합니다.");
      if (saved) {
        sessionIdRef.current = saved.sessionId;
        questionViewStatesRef.current = new Map(saved.states.map((state, i) => [i, state]));
        const summary = summarizeQuizSession(saved);
        setCorrectCount(summary.correctCount);
        setWrongCount(summary.wrongCount);
        setWrongItems(summary.wrongItems);
        restoreQuestionViewState(saved.currentIndex);
        setCurrentIdx(saved.currentIndex);
        setQuestions(saved.questions);
        setSessionNotice(`이전에 풀던 ${saved.currentIndex + 1}번 문제부터 이어갑니다. 이미 낸 답은 다시 채점하지 않습니다.`);
        setQuestionsReady(true);
        return;
      }
      failureStage = "LEARNING_READ";
      const [loadedMastered, learningState] = await Promise.all([
        loadMastered(),
        loadSenseLearningState(),
      ]);
      if (cancelled) return;
      // Fresh MASTER is protected for one day, not excluded forever. Older
      // MASTER rejoins the pool with a low, time-dependent sampling weight.
      const masteredKeys = [...masteredTargetKeys(learningState)].filter(key => {
        const state = getLearningTargetState(learningState, key);
        return state.lastStudiedAt > 0 && Date.now() - state.lastStudiedAt < ADAPTIVE_POLICY.masterProtectionMs;
      });

      const baseOptions = {
        mode,
        rangeStart,
        rangeEnd,
        count,
        rangeId,
        choiceLang,
        masteredNums: loadedMastered.filter(num => { const item = getVocabItem(num); return item && getItemLearningTargets(item).some(target => masteredKeys.includes(target.key)); }),
        masteredTargetKeys: masteredKeys,
        itemNums: itemNums.length > 0 ? itemNums : undefined,
        learningTargetKeys: reviewKeys.length ? reviewKeys : undefined,
        allowMeaningFallback: false,
      } as const;
      failureStage = "CONTENT_PREPARE";
      const candidates = getQuizCandidateItems(baseOptions);
      const sessionId = `problem-${Date.now().toString(36)}-${Math.random()
        .toString(36)
        .slice(2, 10)}`;
      sessionIdRef.current = sessionId;
      failureStage = "SESSION_SAVE";
      const selectedNums = await prepareAdaptiveQuizSession({
        sessionId,
        rangeId: rangeId || "custom",
        mode,
        candidates: candidates.map((item) => {
          const targets = getQuizLearningTargets(item, mode).filter(target => !reviewKeys.length || reviewKeys.includes(target.key));
          const rankedTargets = targets
            .map(target => ({ target, score: learningPriority(getLearningTargetState(learningState, target.key)) }))
            .sort((left, right) => right.score - left.score);
          return {
            num: item.num,
            conceptId: item.conceptId,
            word: item.w,
            learningKey: rankedTargets[0]?.target.key,
            learningPriority: rankedTargets[0]?.score ?? 0,
            learningStatus: rankedTargets[0] ? getLearningTargetState(learningState, rankedTargets[0].target.key).status : "NEW",
            lastStudiedAt: rankedTargets[0] ? getLearningTargetState(learningState, rankedTargets[0].target.key).lastStudiedAt : 0,
          };
        }),
        count,
      });
      if (cancelled) return;

      failureStage = "CONTENT_PREPARE";
      const nextQuestions = buildQuizQuestions({
        ...baseOptions,
        itemNums: selectedNums,
        preserveItemOrder: true,
      });
      questionViewStatesRef.current.clear();
      setCurrentIdx(0);
      setAnswered(false);
      setSelectedChoice(null);
      setSkipped(false);
      setCorrectCount(0);
      setWrongCount(0);
      setWrongItems([]);
      setRevealed(false);
      setFlashGrade(null);
      setTypedAnswer("");
      setTypeResult(null);
      setHintLevel(0);
      setMasteredOnCard(false);
      failureStage = "SESSION_SAVE";
      if (nextQuestions.length) await saveQuizSession({
        schema: 1, requestKey, sessionId, questions: nextQuestions,
        states: nextQuestions.map(() => createEmptyQuestionViewState()), currentIndex: 0, completed: false,
      });
      if (getQuizStorageIssue()) throw new Error("New session is not safely saved");
      if (cancelled) return;
      setQuestions(nextQuestions);
      setQuestionsReady(true);
    };

    prepareQuestions().catch(() => {
      if (cancelled) return;
      // Do not start an unsaved fallback or drop exact review filters on failure.
      setPreparationFailure(getQuizStorageIssue() ? "STORAGE_RECOVERY" : failureStage);
      setSessionRecoveryFailed(true);
      setQuestionsReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [choiceLang, count, itemNums, mode, rangeEnd, rangeId, rangeStart, reviewKeys, requestKey, restartToken, restoreQuestionViewState]);

  const retryPreparation = async () => {
    if (recoveryBusyRef.current) return;
    if (getQuizStorageIssue() && !getLearningStorageRecovery().canRetry) return;
    recoveryBusyRef.current = true;
    setRecoveryBusy(true);
    try {
      if (getQuizStorageIssue()) await retryLearningStorage();
      if (getQuizStorageIssue()) {
        setPreparationFailure("STORAGE_RECOVERY");
        return;
      }
      setSessionRecoveryFailed(false);
      setQuestionsReady(false);
      setRestartToken(value => value + 1);
    } catch {
      setPreparationFailure("STORAGE_RECOVERY");
    } finally {
      recoveryBusyRef.current = false;
      setRecoveryBusy(false);
    }
  };

  // A background retry can clear storage while the preparation error is visible.
  // Re-enter the normal validated restore/start path once, never an unsaved mode.
  useEffect(() => {
    if (!sessionRecoveryFailed || preparationFailure !== "STORAGE_RECOVERY"
      || quizStorageIssue || recoveryBusyRef.current
      || automaticResumeRequestRef.current === requestKey) return;
    automaticResumeRequestRef.current = requestKey;
    setSessionRecoveryFailed(false);
    setQuestionsReady(false);
    setRestartToken(value => value + 1);
  }, [sessionRecoveryFailed, preparationFailure, quizStorageIssue, requestKey, recoveryBusy]);

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

  // 문제 상태 전환은 애니메이션 완료 콜백에 의존하지 않는다.
  // Safari/RN Web에서 완료 콜백이 누락돼도 학습 진행이 멈추지 않아야 한다.
  const animateMoveCard = useCallback(
    (direction: "next" | "previous") => {
      cardTranslateX.value = direction === "next" ? 36 : -36;
      cardOpacity.value = 0;
      cardTranslateX.value = withTiming(0, { duration: 200 });
      cardOpacity.value = withTiming(1, { duration: 200 });
    },
    [cardTranslateX, cardOpacity],
  );

  const captureQuestionViewState = useCallback(
    (overrides: Partial<QuizQuestionViewState> = {}) => {
      const snapshot: QuizQuestionViewState = {
        answered,
        selectedChoice,
        skipped,
        revealed,
        flashGrade,
        typedAnswer,
        typeResult,
        hintLevel,
        mastered: masteredOnCard,
        ...overrides,
      };
      questionViewStatesRef.current.set(currentIdx, snapshot);
      return snapshot;
    },
    [
      answered,
      currentIdx,
      flashGrade,
      hintLevel,
      masteredOnCard,
      revealed,
      selectedChoice,
      skipped,
      typeResult,
      typedAnswer,
    ],
  );

  const makeSessionSnapshot = useCallback((completed = false): QuizSession => ({
    schema: 1, requestKey, sessionId: sessionIdRef.current, questions, currentIndex: currentIdx, completed,
    states: questions.map((_, i) => questionViewStatesRef.current.get(i) ?? createEmptyQuestionViewState()),
  }), [requestKey, questions, currentIdx]);

  useEffect(() => {
    if (!questionsReady || !questions.length || sessionCompletedRef.current) return;
    captureQuestionViewState();
    void saveQuizSession(makeSessionSnapshot()).catch(() => {
      setSessionNotice("이어 풀기 기록을 저장하지 못했습니다. 이번 진행은 복원되지 않을 수 있어요.");
    });
  }, [questionsReady, questions.length, captureQuestionViewState, makeSessionSnapshot]);

  const finishSession = useCallback(async () => {
    sessionCompletedRef.current = true;
    await saveQuizSession(makeSessionSnapshot(true));
  }, [makeSessionSnapshot]);

  const releaseMovingLock = useCallback(() => {
    setTimeout(() => {
      isMovingRef.current = false;
    }, 240);
  }, []);

  const q = questions[currentIdx];
  const isBookmarked = q ? bookmarks.includes(q.item.num) : false;
  const mnemonicVisual = getMnemonicVisual(
    q?.recall?.senseId ?? q?.sense?.senseId ?? q?.definitionRecall?.senseId,
  );

  const handleImageHint = useCallback(() => {
    if (!q || !mnemonicVisual || imageRevealed) return;
    haptic("light");
    setImageRevealed(true);
    void recordSenseLearningEvent({
      targetKey: getQuestionLearningTargetKey(q),
      type: "image_used",
      questionType: q.mode,
    });
  }, [haptic, imageRevealed, mnemonicVisual, q]);

  const recordImageHelped = useCallback(() => {
    if (!q || !imageRevealed) return;
    void recordSenseLearningEvent({
      targetKey: getQuestionLearningTargetKey(q),
      type: "image_helped",
      questionType: q.mode,
    });
  }, [imageRevealed, q]);

  const makeAdaptiveAnswerContext = useCallback(
    (
      outcome: AdaptiveAnswerContext["outcome"],
      responseKey?: string,
    ): AdaptiveAnswerContext | undefined => {
      if (!q || !sessionIdRef.current) return undefined;
      return {
        sessionId: sessionIdRef.current,
        itemNum: q.item.num,
        mode: q.mode,
        outcome,
        responseKey,
        answeredAt: Date.now(),
        ...questionTimer.read(),
        targetKey: getQuestionLearningTargetKey(q),
        learningTargetKey: getQuestionLearningTargetKey(q),
        learningEvent: outcome === "skip" ? "unknown" : undefined,
        hintUsed: hintLevel > 0 || imageRevealed,
      };
    },
    [hintLevel, imageRevealed, q, questionTimer],
  );

  useEffect(() => {
    questionTimer.reset();
    setImageRevealed(false);
  }, [currentIdx, q?.id, questionTimer]);

  const handleBookmark = useCallback(async () => {
    if (!q) return;
    haptic("light");
    const updated = await toggleBookmark(q.item.num);
    setBookmarks(updated);
  }, [q, haptic]);

  const handleChoiceSelect = useCallback(
    (idx: number) => {
      if (
        Date.now() < suppressTouchPressUntilRef.current ||
        answered ||
        isMovingRef.current ||
        questionViewStatesRef.current.get(currentIdx)?.answered
      )
        return;
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
      captureQuestionViewState({
        answered: true,
        selectedChoice: idx,
        skipped: false,
      });
      // 한 문제 단위 즉시 저장
      recordOneAnswer(
        isCorrect,
        isCorrect ? undefined : q.item.num,
        makeAdaptiveAnswerContext(
          isCorrect ? "correct" : "wrong",
          choice?.value,
        ),
        makeSessionSnapshot(),
      );
      if (isCorrect) recordImageHelped();
    },
    [
      answered,
      currentIdx,
      q,
      haptic,
      animateCard,
      captureQuestionViewState,
      makeAdaptiveAnswerContext,
      makeSessionSnapshot,
      recordImageHelped,
    ],
  );

  // "모르겠다" 패스 — 오답 처리 + 오답 노트 저장
  const handleSkip = useCallback(() => {
    if (
      Date.now() < suppressTouchPressUntilRef.current ||
      answered ||
      isMovingRef.current ||
      questionViewStatesRef.current.get(currentIdx)?.answered
    )
      return;
    haptic("error");
    animateCard();
    setAnswered(true);
    setSkipped(true);
    setSelectedChoice(null);
    setWrongCount((w) => w + 1);
    setWrongItems((prev) => [...prev, q.item]);
    captureQuestionViewState({
      answered: true,
      selectedChoice: null,
      skipped: true,
    });
    // 패스도 오답으로 즉시 저장
    recordOneAnswer(false, q.item.num, makeAdaptiveAnswerContext("skip"), makeSessionSnapshot());
  }, [
    answered,
    currentIdx,
    q,
    haptic,
    animateCard,
    captureQuestionViewState,
    makeAdaptiveAnswerContext,
    makeSessionSnapshot,
  ]);

  const handleReveal = useCallback(() => {
    if (Date.now() < suppressTouchPressUntilRef.current) return;
    haptic("light");
    setRevealed(true);
    captureQuestionViewState({ revealed: true });
  }, [haptic, captureQuestionViewState]);

  const handleFlashGrade = useCallback(
    (grade: "correct" | "wrong") => {
      if (
        Date.now() < suppressTouchPressUntilRef.current ||
        answered ||
        isMovingRef.current ||
        questionViewStatesRef.current.get(currentIdx)?.answered
      )
        return;
      haptic(grade === "correct" ? "success" : "error");
      setFlashGrade(grade);
      setAnswered(true);
      if (grade === "correct") {
        setCorrectCount((c) => c + 1);
      } else {
        setWrongCount((w) => w + 1);
        setWrongItems((prev) => [...prev, q.item]);
      }
      captureQuestionViewState({
        answered: true,
        revealed: true,
        flashGrade: grade,
      });
      // 플래시카드 채점 즉시 저장
      recordOneAnswer(
        grade === "correct",
        grade === "correct" ? undefined : q.item.num,
        makeAdaptiveAnswerContext(grade, grade),
        makeSessionSnapshot(),
      );
      if (grade === "correct") recordImageHelped();
    },
    [
      answered,
      currentIdx,
      haptic,
      q,
      captureQuestionViewState,
      makeAdaptiveAnswerContext,
      makeSessionSnapshot,
      recordImageHelped,
    ],
  );

  // 플래시카드 마스터 처리 — 이 단어를 마스터 목록에 추가
  const handleFlashMaster = useCallback(async () => {
    if (
      Date.now() < suppressTouchPressUntilRef.current ||
      !q ||
      answered ||
      isMovingRef.current ||
      questionViewStatesRef.current.get(currentIdx)?.answered
    )
      return;
    isMovingRef.current = true;
    haptic("success");
    try {
      await markLearningTargetMastered(getQuestionLearningTargetKey(q), q.item.num);
    } catch {
      isMovingRef.current = false;
      return;
    }
    const nextCorrectCount = correctCount + 1;
    setCorrectCount(nextCorrectCount);
    setAnswered(true);
    setRevealed(true);
    setMasteredOnCard(true);
    captureQuestionViewState({
      answered: true,
      revealed: true,
      flashGrade: null,
      mastered: true,
    });
    // '마스터'는 알고 있는 단어로 한 번만 채점한다.
    const masteredContext = makeAdaptiveAnswerContext("mastered");
    recordOneAnswer(
      true,
      undefined,
      masteredContext
        ? { ...masteredContext, learningTargetKey: undefined }
        : undefined,
      makeSessionSnapshot(),
    );
    // 마스터 처리 후 자동으로 다음 문제로 이동
    const targetIndex = getNextQuizIndex(currentIdx, makeSessionSnapshot().states);
    if (targetIndex === null) {
      await finishSession();
      router.replace({
        pathname: "/result",
        params: {
          correct: nextCorrectCount,
          total: questions.length,
          wrongNums: wrongItems.map((w) => w.num).join(","),
          ...resultReviewParams(makeSessionSnapshot(), mode, choiceLang),
        },
      });
      return;
    }
    restoreQuestionViewState(targetIndex);
    setCurrentIdx(targetIndex);
    animateMoveCard("next");
    scrollRef.current?.scrollTo({ y: 0, animated: true });
    releaseMovingLock();
  }, [
    answered,
    q,
    haptic,
    currentIdx,
    questions.length,
    correctCount,
    wrongItems,
    mode,
    choiceLang,
    router,
    captureQuestionViewState,
    restoreQuestionViewState,
    animateMoveCard,
    releaseMovingLock,
    makeAdaptiveAnswerContext,
    finishSession,
    makeSessionSnapshot,
  ]);

  const handleTypeSubmit = useCallback(() => {
    if (
      Date.now() < suppressTouchPressUntilRef.current ||
      answered ||
      isMovingRef.current ||
      questionViewStatesRef.current.get(currentIdx)?.answered ||
      !typedAnswer.trim()
    )
      return;
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
    captureQuestionViewState({
      answered: true,
      typedAnswer,
      typeResult: isCorrect ? "correct" : "wrong",
    });
    // 타이핑 정답 즉시 저장
    recordOneAnswer(
      isCorrect,
      isCorrect ? undefined : q.item.num,
      makeAdaptiveAnswerContext(isCorrect ? "correct" : "wrong", typedAnswer),
      makeSessionSnapshot(),
    );
    if (isCorrect) recordImageHelped();
  }, [
    answered,
    currentIdx,
    typedAnswer,
    q,
    haptic,
    captureQuestionViewState,
    makeAdaptiveAnswerContext,
    makeSessionSnapshot,
    recordImageHelped,
  ]);

  const handleNext = useCallback(async () => {
    if (isMovingRef.current) return;
    isMovingRef.current = true;
    haptic("light");
    captureQuestionViewState();
    const targetIndex = getNextQuizIndex(currentIdx, makeSessionSnapshot().states);
    if (targetIndex === currentIdx) {
      setSessionNotice("이 문제에 답하거나 ‘모르겠다’를 선택하면 결과를 볼 수 있어요.");
      releaseMovingLock();
      return;
    }
    if (targetIndex === null) {
      await finishSession();
      const finalWrongNums = wrongItems.map((w) => w.num);
      router.replace({
        pathname: "/result",
        params: {
          correct: correctCount,
          total: questions.length,
          wrongNums: finalWrongNums.join(","),
          ...resultReviewParams(makeSessionSnapshot(), mode, choiceLang),
        },
      });
      return;
    }
    if (targetIndex < currentIdx) setSessionNotice("아직 답하지 않은 문제로 돌아왔습니다. 이동만으로는 채점하지 않아요.");
    if (answered && targetIndex > currentIdx && canReorderQuizQuestion(questionViewStatesRef.current.get(targetIndex))) {
      // The answer write is ahead of this snapshot in the shared queue. Re-rank
      // only unanswered positions; back navigation and saved grades stay intact.
      try {
        const snapshot = await loadLearningSnapshot();
        const remaining = questions.map((question, index) => ({ question, index }))
          .filter(row => row.index >= targetIndex && canReorderQuizQuestion(questionViewStatesRef.current.get(row.index)));
        const [selectedNum] = selectAdaptiveItemNums({
          candidates: remaining.map(({ question }) => {
            const key = getQuestionLearningTargetKey(question);
            const target = getLearningTargetState(snapshot.learning, key);
            return { num: question.item.num, word: question.item.w, learningKey: key,
              conceptId: question.item.conceptId, learningStatus: target.status, lastStudiedAt: target.lastStudiedAt };
          }), count: 1, mode, history: snapshot.history, legacyWrongNums: snapshot.legacyWrongNums, strategy: "weighted",
        });
        const selectedIndex = remaining.find(row => row.question.item.num === selectedNum)?.index;
        if (selectedIndex !== undefined && selectedIndex !== targetIndex) {
          const nextQuestions = [...questions];
          [nextQuestions[targetIndex], nextQuestions[selectedIndex]] = [nextQuestions[selectedIndex], nextQuestions[targetIndex]];
          const saved = makeSessionSnapshot();
          await saveQuizSession({ ...saved, questions: nextQuestions, currentIndex: targetIndex });
          setQuestions(nextQuestions);
        }
      } catch {
        // Unreadable evidence never blocks a valid already-generated question.
      }
    }
    restoreQuestionViewState(targetIndex);
    setCurrentIdx(targetIndex);
    animateMoveCard("next");
    scrollRef.current?.scrollTo({ y: 0, animated: true });
    releaseMovingLock();
  }, [
    answered,
    currentIdx,
    questions,
    mode,
    correctCount,
    wrongItems,
    choiceLang,
    haptic,
    router,
    captureQuestionViewState,
    restoreQuestionViewState,
    animateMoveCard,
    releaseMovingLock,
    finishSession,
    makeSessionSnapshot,
  ]);

  const handlePrevious = useCallback(() => {
    if (currentIdx <= 0 || isMovingRef.current) return;
    isMovingRef.current = true;
    haptic("light");
    captureQuestionViewState();
    const targetIndex = currentIdx - 1;
    restoreQuestionViewState(targetIndex);
    setCurrentIdx(targetIndex);
    animateMoveCard("previous");
    scrollRef.current?.scrollTo({ y: 0, animated: true });
    releaseMovingLock();
  }, [
    currentIdx,
    haptic,
    captureQuestionViewState,
    restoreQuestionViewState,
    animateMoveCard,
    releaseMovingLock,
  ]);

  const handleWebTouchStart = useCallback((event: GestureResponderEvent) => {
    if (Platform.OS !== "web") return;
    webSwipeTraceRef.current = null;
    if (event.nativeEvent.touches.length !== 1) return;
    // Text editing and sliders retain their own horizontal touch interactions.
    const target = event.target as unknown as { closest?: (selector: string) => unknown };
    if (target.closest?.('input,textarea,[contenteditable="true"],[role="slider"]')) return;
    const point = getTouchPoint(event);
    webSwipeTraceRef.current = {
      startX: point.x,
      startY: point.y,
      lastX: point.x,
      lastY: point.y,
      vertical: false,
    };
  }, []);

  const handleWebTouchMove = useCallback((event: GestureResponderEvent) => {
    if (Platform.OS !== "web" || !webSwipeTraceRef.current) return;
    if (event.nativeEvent.touches.length !== 1) { webSwipeTraceRef.current = null; return; }
    const point = getTouchPoint(event);
    const trace = webSwipeTraceRef.current;
    trace.lastX = point.x;
    trace.lastY = point.y;
    const dx = point.x - trace.startX;
    const dy = point.y - trace.startY;
    if (Math.abs(dy) > 18 && Math.abs(dy) >= Math.abs(dx)) trace.vertical = true;
    if (Math.max(Math.abs(dx), Math.abs(dy)) > 18) suppressTouchPressUntilRef.current = Date.now() + 350;
  }, []);

  const handleWebTouchEnd = useCallback(
    (event: GestureResponderEvent) => {
      if (Platform.OS !== "web") return;
      const trace = webSwipeTraceRef.current;
      webSwipeTraceRef.current = null;
      if (!trace || trace.vertical) return;

      const point = getTouchPoint(event, true);
      const deltaX = point.x - trace.startX;
      const deltaY = point.y - trace.startY;
      const direction = classifyQuizSwipe(deltaX, deltaY);
      if (!direction) return;
      suppressTouchPressUntilRef.current = Date.now() + 350;
      if (direction === "next") void handleNext();
      else if (currentIdx > 0) handlePrevious();
    },
    [currentIdx, handleNext, handlePrevious],
  );

  // 네이티브 제스처도 세로 스크롤보다 명확한 가로 이동에만 반응한다.
  const swipeGesture = Gesture.Pan()
    .activeOffsetX([-24, 24])
    .failOffsetY([-18, 18])
    .onEnd((e) => {
      if (e.translationX < -56) {
        runOnJS(handleNext)();
      } else if (currentIdx > 0 && e.translationX > 56) {
        runOnJS(handlePrevious)();
      }
    });

  const s = styles(colors);

  if (!q) {
    return (
      <ScreenContainer containerClassName="bg-background">
        {sessionRecoveryFailed ? <QuizSessionHold
          failure={preparationFailure} issue={quizStorageIssue}
          canRetry={!quizStorageIssue || canRetryStorage} busy={recoveryBusy}
          onBackup={() => router.push("/(tabs)/settings")}
          onSettings={() => router.replace("/")}
          onStart={() => { void retryPreparation(); }} /> : <QuizEmptyState ready={questionsReady}
          request={{ mode, choiceLang, rangeId, rangeStart, rangeEnd, count,
            reviewKeys: params.reviewKeys, bookmarkNums: params.bookmarkNums }}
          onSettings={() => router.replace("/")}
          onMeaningStudy={(route) => router.replace(route)} />}
      </ScreenContainer>
    );
  }

  const pct = Math.round((currentIdx / questions.length) * 100);

  const questionMode = q.mode;
  const isChoiceMode = q.choices.length > 0;

  const getModeLabel = () => {
    if (q.sentenceCompletion) return "Sentence Completion · 논리";
    if (q.definitionRecall) return "영영 정의 → 정확한 단어";
    if (q.recall) {
      return "영영 정의 → 정확한 단어";
    }
    if (questionMode === "syn-choice") return "영어 동의어";
    if (questionMode === "kor-choice") {
      return q.answerKind === "synonym"
        ? "동의어 고르기 (영어)"
        : mode !== "kor-choice" ? "한국어 뜻 고르기 · 동의어 자료 부족" : "한국어 뜻 고르기";
    }
    if (questionMode === "syn-kor-choice") return "영어 동의어 · 정답 후 한국어 해설";
    if (questionMode === "flashcard") return "플래시카드";
    return "동의어 입력";
  };

  const getHintText = () => {
    if (q.sentenceCompletion) return "Which completion best fits the entire context?";
    if (q.recall || q.definitionRecall) return "영영 정의에 정확히 맞는 표현은?";
    if (q.sense) return q.answerKind === "meaning" ? "이 문맥에서 표현의 뜻은?" : "이 문맥에서 뜻이 같은 표현은?";
    if (q.answerKind === "meaning") return "올바른 한국어 뜻은?";
    if (questionMode === "syn-kor-choice") return "Which expression has the closest meaning?";
    return "올바른 동의어는?";
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
    <ScreenContainer containerClassName="bg-background" edges={["top", "left", "right", "bottom"]} contentMaxWidth={QUIZ_CONTENT_MAX_WIDTH}>
      <KeyboardAvoidingView
        style={{ flex: 1, minHeight: 0 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <NativeSwipeBoundary gesture={swipeGesture}>
          <ScrollView
            ref={scrollRef}
            style={[
              { flex: 1, minHeight: 0 },
              Platform.OS === "web" && ({ touchAction: "pan-y" } as any),
            ]}
            onLayout={(event) => setScrollViewportHeight(event.nativeEvent.layout.height)}
            contentContainerStyle={{ paddingBottom: 24, minHeight: scrollViewportHeight ? scrollViewportHeight + 44 : undefined }}
            alwaysBounceVertical
            overScrollMode="always"
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            onTouchStart={handleWebTouchStart}
            onTouchMove={handleWebTouchMove}
            onTouchEnd={handleWebTouchEnd}
            onTouchCancel={() => { webSwipeTraceRef.current = null; }}
            onScrollBeginDrag={() => {
              webSwipeTraceRef.current = null;
            }}
          >
            <View style={s.navigationRow}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="문제 풀이 설정으로 돌아가기"
                hitSlop={6}
                style={({ pressed }) => [
                  s.backBtn,
                  pressed && { opacity: 0.7 },
                ]}
                onPress={() => {
                  if (router.canGoBack()) router.back();
                  else router.replace("/");
                }}
              >
                <IconSymbol
                  name="arrow.left"
                  size={20}
                  color={colors.foreground}
                />
                <Text style={s.backBtnText}>풀이 설정</Text>
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel="같은 범위에서 새 문제 시작" style={{ minHeight: 44, justifyContent: "center", marginLeft: "auto", paddingHorizontal: 8 }} onPress={async () => {
                if (isMovingRef.current) return;
                isMovingRef.current = true;
                await finishSession();
                setRestartToken((value) => value + 1);
              }}>
                <Text style={{ color: colors.primary, fontSize: 12 }}>새 문제</Text>
              </Pressable>
            </View>

            {sessionNotice ? <Text accessibilityLiveRegion="polite" style={{ color: colors.foreground, paddingHorizontal: STUDY_PAGE_GUTTER, paddingBottom: 8, fontSize: 13, lineHeight: 20 }}>{sessionNotice}</Text> : null}

            {/* Progress Bar */}
            <View style={s.progressContainer}>
              <View style={s.progressInfo}>
                <Text style={s.progressText}>
                  {currentIdx + 1} / {questions.length}
                </Text>
                <Text style={s.progressText}>정답 {correctCount} · 오답 {wrongCount}</Text>
              </View>
              <View style={s.progressBar} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: pct }} accessibilityLabel="문제 풀이 진행률">
                <View style={[s.progressFill, { width: `${pct}%` as any }]} />
              </View>
            </View>

            {/* Question Card */}
            <Animated.View style={[s.questionCard, cardAnimStyle]}>
              <View style={s.questionHeader}>
                <Text style={s.questionNum}>
                  문제 {currentIdx + 1} · {getModeLabel()}
                </Text>
                <Pressable accessibilityRole="button" accessibilityLabel={`${q.item.w} ${isBookmarked ? "북마크 해제" : "북마크 추가"}`} onPress={handleBookmark} style={s.bookmarkBtn}>
                  <Text style={{ fontSize: 20 }}>
                    {isBookmarked ? "🔖" : "🏷️"}
                  </Text>
                </Pressable>
              </View>

              {!q.sentenceCompletion && ((!q.recall && !q.definitionRecall) || answered) ? <View style={s.wordPronunciationRow}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={s.wordText}>{q.item.w}</Text>
                  {q.item.p ? <Text style={s.ipaText}>{q.item.p}</Text> : null}
                </View>
                <PronunciationButton itemId={q.item.id} text={q.item.w} />
              </View> : null}

              {/* 4지선다 모드 */}
              {q.sentenceCompletion ? <SentenceCompletionPrompt question={q.sentenceCompletion} /> : null}
              {q.recall && !answered ? <ActiveRecallPrompt recall={q.recall} promptId={q.recallPromptId} /> : null}
              {q.definitionRecall && !answered ? <DefinitionRecallPrompt definition={q.definitionRecall.definition} /> : null}
              <ProblemSenseContext sense={q.sense} />
              {mnemonicVisual && !answered ? (
                <View style={s.mnemonicHintArea}>
                  {!imageRevealed ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="의미 선화 힌트 보기"
                      style={s.mnemonicHintBtn}
                      onPress={handleImageHint}
                    >
                      <Text style={s.mnemonicHintBtnText}>선화 힌트 보기</Text>
                    </Pressable>
                  ) : (
                    <MnemonicCue visual={mnemonicVisual} />
                  )}
                </View>
              ) : null}
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
                          textStyle = {
                            ...s.choiceText,
                            color: colors.success,
                          };
                        } else if (idx === selectedChoice) {
                          choiceStyle = { ...s.choiceBtn, ...s.choiceWrong };
                          textStyle = { ...s.choiceText, color: colors.error };
                        }
                      }
                      return (
                        <Pressable
                          key={choice.id}
                          accessibilityRole="button"
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
                                !choiceIsCorrect && {
                                  backgroundColor: colors.error,
                                },
                            ]}
                          >
                            <Text
                              style={[
                                s.choiceNumText,
                                answered &&
                                  (choiceIsCorrect ||
                                    idx === selectedChoice) && {
                                    color: "#000",
                                  },
                              ]}
                            >
                              {["①", "②", "③", "④"][idx]}
                            </Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={textStyle} numberOfLines={q.sentenceCompletion ? undefined : 3}>
                              {choice.label}
                            </Text>
                            {answered &&
                            choice.meaning &&
                            choice.meaning !== choice.label ? (
                              <Text style={s.choiceKorText}>
                                {choice.meaning}
                              </Text>
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
                  {answered && skipped && questionMode !== "sentence-completion" && (
                    <View style={s.skipResultBox}>
                      <Text style={s.skipResultLabel}>정답</Text>
                      <Text style={s.skipResultAnswer}>{q.correct}</Text>
                    </View>
                  )}
                </>
              )}

              {/* 플래시카드 모드 */}
              {questionMode === "flashcard" && (
                <View style={s.flashContainer}>
                  <FlipCard
                    flipped={revealed}
                    style={s.flipCardWrapper}
                    front={
                      <View style={s.flipFront}>
                        <Text style={s.flashHint}>
                          뜻을 떠올린 후 확인 버튼을 누르세요
                        </Text>
                        <Pressable style={s.revealBtn} onPress={handleReveal}>
                          <Text style={s.revealBtnText}>🔍 뜻 확인</Text>
                        </Pressable>
                      </View>
                    }
                    back={
                      <View style={s.flipBack}>
                        <View style={s.flashAnswer}>
                          <Text style={s.flashKorText}>{q.item.book?.gradingReview?.status === 'requires_editorial_policy_review' ? '원문 보존 뜻 (아래 교정 주석 필수): ' : ''}{q.item.k_short}</Text>
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
                  {revealed && <BookLearningDetails entry={q.item.book} />}
                  {revealed && !answered && (
                    <View style={{ marginTop: 14, gap: 8 }}>
                      <View style={s.gradeRow}>
                        <Pressable
                          style={[s.gradeBtn, s.gradeBtnWrong]}
                          onPress={() => handleFlashGrade("wrong")}
                        >
                          <Text
                            style={[s.gradeBtnText, { color: colors.error }]}
                          >
                            ❌ 모르겠어요
                          </Text>
                        </Pressable>
                        <Pressable
                          style={[s.gradeBtn, s.gradeBtnCorrect]}
                          onPress={() => handleFlashGrade("correct")}
                        >
                          <Text
                            style={[s.gradeBtnText, { color: colors.success }]}
                          >
                            ✅ 알았어요
                          </Text>
                        </Pressable>
                      </View>
                      {/* 마스터 버튼 — 이 단어는 완전히 알아서 앞으로 출제 제외 */}
                      <Pressable
                        style={s.masterBtn}
                        onPress={handleFlashMaster}
                      >
                        <Text style={s.masterBtnText}>
                          ⭐ 마스터 — 목록 제외 · 나중에 기억 재검증
                        </Text>
                      </Pressable>
                    </View>
                  )}
                  {masteredOnCard && (
                    <View style={s.masteredInfo}>
                      <Text style={s.masteredInfoText}>
                        ⭐ 마스터 완료 · 다시 채점되지 않습니다
                      </Text>
                    </View>
                  )}
                </View>
              )}

              {/* 동의어 입력 모드 */}
              {questionMode === "syn-type" && (
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
              {answered && q.sentenceCompletion ? <SentenceCompletionAnswer question={q.sentenceCompletion} selectedId={selectedChoice !== null ? q.choices[selectedChoice]?.id : undefined} /> : null}
              {answered && q.recall ? <ActiveRecallAnswer recall={q.recall} choices={q.choices} item={q.item} /> : null}
              {answered && q.definitionRecall ? (
                <DefinitionRecallAnswer recall={q.definitionRecall} koreanMeaning={q.item.k_short} choices={q.choices} item={q.item} />
              ) : null}
              {answered && q.synonymRecall ? (
                <SynonymRecallAnswer recall={q.synonymRecall} koreanMeaning={q.item.k_short} choices={q.choices} item={q.item} />
              ) : null}
              {answered && q.sense && <ProblemSenseContext sense={q.sense} answered />}
              {answered && !q.sentenceCompletion && !q.sense && !q.recall && !q.definitionRecall && !q.synonymRecall && questionMode !== "flashcard" && (
                <View style={s.explPanel}>
                  <Text style={s.explHeader}>해설</Text>
                  <View style={s.explWordRow}>
                    <Text style={s.explWord}>{q.item.w}</Text>
                    <WordPronunciation item={q.item} context="answer" ipaStyle={s.explIpa} />
                  </View>
                  <Text style={s.explKor} numberOfLines={3}>
                    {q.item.k_short}
                  </Text>
                  {q.item.s.length > 0 && (
                    <SynonymDetails item={q.item} limit={5} />
                  )}
                </View>
              )}

              {answered && !q.sentenceCompletion && !q.recall && !q.definitionRecall && <LearningDetails itemId={q.item.id} />}

            </Animated.View>
          </ScrollView>
        </NativeSwipeBoundary>
              {/* Normal flex footer, outside the scrolling explanation; no overlay/inset duplication. */}
              {questions.length > 0 && (
                <View style={s.questionNavRow}>
                  {currentIdx > 0 && (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="이전 문제로 돌아가기"
                      style={({ pressed }) => [
                        s.previousBtn,
                        pressed && { opacity: 0.75 },
                      ]}
                      onPress={handlePrevious}
                    >
                      <Text style={s.previousBtnText}>← 이전 문제</Text>
                    </Pressable>
                  )}
                  {(currentIdx + 1 < questions.length || answered || questions.length > 1) && (
                    <Pressable
                      accessibilityRole="button"
                      style={({ pressed }) => [
                        s.nextBtn,
                        pressed && { opacity: 0.85 },
                      ]}
                      onPress={handleNext}
                    >
                      <Text style={s.nextBtnText}>
                        {currentIdx + 1 >= questions.length
                          ? makeSessionSnapshot().states.every(state => state.answered) ? "결과 보기 →" : "남은 문제 →"
                          : "다음 문제 →"}
                      </Text>
                    </Pressable>
                  )}
                </View>
              )}
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const styles = (colors: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    mnemonicHintArea: { marginTop: 10 },
    mnemonicHintBtn: {
      minHeight: 44,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      paddingHorizontal: 14,
    },
    mnemonicHintBtnText: {
      color: colors.primary,
      fontSize: 13,
      fontWeight: "700",
    },
    statsRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 16,
      paddingTop: 4,
      marginBottom: 8,
    },
    navigationRow: {
      minHeight: 44,
      paddingHorizontal: STUDY_PAGE_GUTTER,
      paddingTop: 0,
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
      flexDirection: "row",
      gap: 5,
      paddingVertical: 2,
      alignItems: "center",
    },
    statOk: {},
    statErr: {},
    statNum: {
      fontSize: 14,
      fontWeight: "700",
      fontVariant: ["tabular-nums"],
    },
    statLabel: {
      fontSize: 12,
      color: colors.dim,
      textTransform: "uppercase",
      letterSpacing: 1,
      marginTop: 0,
    },
    progressContainer: {
      paddingHorizontal: STUDY_PAGE_GUTTER,
      marginBottom: 10,
    },
    progressInfo: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: 6,
    },
    progressText: {
      fontSize: 12,
      color: colors.metadata,
      fontVariant: ["tabular-nums"],
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
      marginHorizontal: STUDY_PAGE_GUTTER,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 14,
      padding: STUDY_CARD_PADDING,
      minWidth: 0,
    },
    questionHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 4,
    },
    questionNum: {
      fontSize: 12,
      lineHeight: 18,
      color: colors.metadata,
      flex: 1,
      minWidth: 0,
    },
    bookmarkBtn: {
      width: 44,
      height: 44,
      alignItems: "center",
      justifyContent: "center",
    },
    wordPronunciationRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 12,
    },
    wordText: {
      fontSize: 26,
      lineHeight: 34,
      fontWeight: "800",
      color: colors.foreground,
      letterSpacing: -1,
      marginBottom: 4,
    },
    ipaText: {
      fontSize: 13,
      color: colors.primary as string,
      fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
      letterSpacing: 0.5,
      marginBottom: 10,
    },
    hintText: {
      fontSize: 13,
      lineHeight: 19,
      color: colors.metadata,
      marginBottom: 10,
    },
    choicesContainer: {
      gap: 8,
    },
    choiceBtn: {
      backgroundColor: colors.card,
      borderWidth: 2,
      borderColor: colors.border,
      borderRadius: 12,
      padding: 12,
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
      fontSize: 16,
      color: colors.foreground,
      flex: 1,
      lineHeight: 24,
      minWidth: 0,
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
    questionNavRow: {
      flexDirection: "row",
      gap: 10,
      flexShrink: 0,
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      backgroundColor: colors.background,
    },
    previousBtn: {
      flex: 1,
      minHeight: 50,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 12,
    },
    previousBtnText: {
      fontSize: 14,
      fontWeight: "700",
      color: colors.foreground,
    },
    nextBtn: {
      flex: 1,
      backgroundColor: colors.primary,
      borderRadius: 12,
      paddingVertical: 15,
      minHeight: 50,
      alignItems: "center",
      justifyContent: "center",
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
    masteredInfo: {
      marginTop: 14,
      minHeight: 44,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 12,
      backgroundColor: "rgba(251,191,36,0.12)",
      borderWidth: 1,
      borderColor: "rgba(251,191,36,0.35)",
    },
    masteredInfoText: {
      fontSize: 12,
      fontWeight: "700",
      color: "#F59E0B",
      textAlign: "center",
    },
  });
