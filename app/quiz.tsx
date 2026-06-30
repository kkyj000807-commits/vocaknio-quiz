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
import { SpeakerButton } from "@/components/speaker-button";
import {
  VOCAB,
  VocabItem,
  type QuizMode,
  shuffle,
  getSynDistractors,
  getKorDistractors,
  getSynWithKorDistractors,
  makeSynKorLabel,
} from "@/lib/vocab";
import { updateStatsAfterQuiz, toggleBookmark, loadBookmarks, addWrongWords, recordOneAnswer, loadMastered, addMastered } from "@/lib/store";
import { useColors } from "@/hooks/use-colors";

interface QuizQuestion {
  item: VocabItem;
  choices: string[];
  correct: string;
}

// 웹(Safari)에서는 스와이프 제스처가 세로 스크롤을 막으므로 GestureDetector를 끼우지 않는다.
// 네이티브(iOS/Android 앱)에서만 좌우 스와이프 제스처를 활성화한다.
function SwipeWrapper({
  enabled,
  gesture,
  children,
}: {
  enabled: boolean;
  gesture: ReturnType<typeof Gesture.Pan>;
  children: React.ReactElement;
}) {
  if (!enabled) return children;
  return <GestureDetector gesture={gesture}>{children}</GestureDetector>;
}

function buildQuestions(
  mode: QuizMode,
  rangeStart: number,
  rangeEnd: number,
  count: number,
  rangeId?: string,
  choiceLang?: string,
  masteredNums?: number[]
): QuizQuestion[] {
  // 숙어 범위 선택 시 숙어만 필터
  let pool: VocabItem[];
  if (rangeId === 'idioms') {
    pool = VOCAB.filter((v) => v.type === 'idiom' || v.type === 'phrase').filter((v) => v.k && v.k.length > 2);
  } else {
    pool = VOCAB.slice(rangeStart, rangeEnd + 1).filter(
      (v) => v.k && v.k.length > 2
    );
  }
  // 플래시카드 모드에서 마스터된 단어 제외
  if (mode === 'flashcard' && masteredNums && masteredNums.length > 0) {
    const masteredSet = new Set(masteredNums);
    pool = pool.filter((v) => !masteredSet.has(v.num));
  }

  let candidates: VocabItem[];
  if (mode === "syn-choice" || mode === "syn-type" || mode === "syn-kor-choice") {
    candidates = pool.filter((v) => v.s && v.s.length > 0);
  } else if (mode === "kor-choice") {
    // 영어 선지 모드에서는 동의어가 있는 단어만 출제
    if (choiceLang === "english") {
      candidates = pool.filter((v) => v.s && v.s.length > 0);
    } else {
      candidates = pool;
    }
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
      if (choiceLang === "english") {
        // 영어 선지 모드: 동의어 선지로 출제 (단어의 뜻을 영어 동의어로 고르기)
        const correctSyn = item.s[Math.floor(Math.random() * item.s.length)];
        const distractors = getSynDistractors(item, correctSyn, 3);
        const choices = shuffle([correctSyn, ...distractors]);
        return { item, choices, correct: correctSyn };
      } else {
        // 한글 선지 모드 (기본)
        const distractors = getKorDistractors(item, pool, 3);
        const choices = shuffle([item.k, ...distractors]);
        return { item, choices, correct: item.k };
      }
    } else if (mode === "syn-kor-choice") {
      const correctSyn = item.s[Math.floor(Math.random() * item.s.length)];
      const correctLabel = makeSynKorLabel(correctSyn, item);
      const distractors = getSynWithKorDistractors(item, correctSyn, 3);
      const choices = shuffle([correctLabel, ...distractors]);
      return { item, choices, correct: correctLabel };
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
    rangeId?: string;
    choiceLang?: string;
  }>();

  const mode = params.mode ?? "syn-choice";
  const rangeStart = parseInt(params.rangeStart ?? "0");
  const rangeEnd = parseInt(params.rangeEnd ?? "999");
  const count = parseInt(params.count ?? "20");
  const rangeId = params.rangeId ?? "";
  const choiceLang = params.choiceLang ?? "korean";

  const [masteredNums, setMasteredNums] = useState<number[]>([]);
  const [questions] = useState<QuizQuestion[]>(() =>
    buildQuestions(mode, rangeStart, rangeEnd, count, rangeId, choiceLang)
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

  // 뒤로가기 지원 — 이미 채점된 문제 기록 (점수 중복 집계 방지 + 복원)
  const scoredRef = useRef<Set<number>>(new Set());
  const recordRef = useRef<Record<number, { choice: number | null; skipped: boolean; flash: "correct" | "wrong" | null; typed: string; typeResult: "correct" | "wrong" | null }>>({});

  const cardScale = useSharedValue(1);
  // 카드 슬라이드 전환용 shared values
  const cardTranslateX = useSharedValue(0);
  const cardOpacity = useSharedValue(1);
  // 정답/오답 플래시 overlay
  const flashOpacity = useSharedValue(0);
  const [flashIsCorrect, setFlashIsCorrect] = useState<boolean | null>(null);

  const cardAnimStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: cardScale.value },
      { translateX: cardTranslateX.value },
    ],
    opacity: cardOpacity.value,
  }));

  const flashOverlayStyle = useAnimatedStyle(() => ({
    opacity: flashOpacity.value,
  }));

  useEffect(() => {
    loadBookmarks().then(setBookmarks);
    if (mode === 'flashcard') {
      loadMastered().then(setMasteredNums);
    }
  }, [mode]);

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

  const triggerFlash = useCallback((isCorrect: boolean) => {
    setFlashIsCorrect(isCorrect);
    flashOpacity.value = withSequence(
      withTiming(0.28, { duration: 80 }),
      withTiming(0, { duration: 500 })
    );
  }, [flashOpacity]);

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

  // 이전 문제로 이동 시 (오른쪽으로 슬라이드 아웃 → 왼쪽에서 진입)
  const slideToPrev = useCallback((onComplete: () => void) => {
    cardTranslateX.value = withTiming(60, { duration: 180 });
    cardOpacity.value = withTiming(0, { duration: 180 }, () => {
      cardTranslateX.value = -60;
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

      const isCorrect = q.choices[idx] === q.correct;
      const first = !scoredRef.current.has(currentIdx);
      if (isCorrect) {
        haptic("success");
        if (first) setCorrectCount((c) => c + 1);
      } else {
        haptic("error");
        if (first) {
          setWrongCount((w) => w + 1);
          setWrongItems((prev) => [...prev, q.item]);
        }
      }
      triggerFlash(isCorrect);
      if (first) {
        scoredRef.current.add(currentIdx);
        recordOneAnswer(isCorrect, isCorrect ? undefined : q.item.num);
      }
      recordRef.current[currentIdx] = { choice: idx, skipped: false, flash: null, typed: "", typeResult: null };
    },
    [answered, q, haptic, animateCard, triggerFlash, currentIdx]
  );

  // "모르겠다" 패스 — 오답 처리 + 오답 노트 저장
  const handleSkip = useCallback(() => {
    if (answered) return;
    haptic("error");
    animateCard();
    setAnswered(true);
    setSkipped(true);
    setSelectedChoice(null);
    const first = !scoredRef.current.has(currentIdx);
    if (first) {
      setWrongCount((w) => w + 1);
      setWrongItems((prev) => [...prev, q.item]);
      scoredRef.current.add(currentIdx);
      recordOneAnswer(false, q.item.num);
    }
    triggerFlash(false);
    recordRef.current[currentIdx] = { choice: null, skipped: true, flash: null, typed: "", typeResult: null };
  }, [answered, q, haptic, animateCard, triggerFlash, currentIdx]);

  const handleReveal = useCallback(() => {
    haptic("light");
    setRevealed(true);
  }, [haptic]);

  const handleFlashGrade = useCallback(
    (grade: "correct" | "wrong") => {
      haptic(grade === "correct" ? "success" : "error");
      setFlashGrade(grade);
      setAnswered(true);
      const first = !scoredRef.current.has(currentIdx);
      if (grade === "correct") {
        if (first) setCorrectCount((c) => c + 1);
      } else {
        if (first) {
          setWrongCount((w) => w + 1);
          setWrongItems((prev) => [...prev, q.item]);
        }
      }
      triggerFlash(grade === "correct");
      if (first) {
        scoredRef.current.add(currentIdx);
        recordOneAnswer(grade === "correct", grade === "correct" ? undefined : q.item.num);
      }
      recordRef.current[currentIdx] = { choice: null, skipped: false, flash: grade, typed: "", typeResult: null };
    },
    [haptic, q, triggerFlash, currentIdx]
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
    const userAns = typedAnswer.trim().toLowerCase();
    const allAccepted = [q.correct, ...q.item.s].map((s) => s.toLowerCase());
    const isCorrect = allAccepted.includes(userAns);
    setTypeResult(isCorrect ? "correct" : "wrong");
    setAnswered(true);
    const first = !scoredRef.current.has(currentIdx);
    if (isCorrect) {
      haptic("success");
      if (first) setCorrectCount((c) => c + 1);
    } else {
      haptic("error");
      if (first) {
        setWrongCount((w) => w + 1);
        setWrongItems((prev) => [...prev, q.item]);
      }
    }
    if (first) {
      scoredRef.current.add(currentIdx);
      recordOneAnswer(isCorrect, isCorrect ? undefined : q.item.num);
    }
    recordRef.current[currentIdx] = { choice: null, skipped: false, flash: null, typed: typedAnswer, typeResult: isCorrect ? "correct" : "wrong" };
  }, [typedAnswer, q, haptic, currentIdx]);

  const handleNext = useCallback(async () => {
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
    slideToNext(() => applyIndex(currentIdx + 1));
  }, [currentIdx, questions.length, correctCount, wrongItems, haptic, router, slideToNext]);

  // 인덱스 이동 시 상태 적용 — 이미 푼 문제면 기록 복원(리뷰), 새 문제면 초기화
  const applyIndex = useCallback((target: number) => {
    const rec = recordRef.current[target];
    if (rec) {
      setAnswered(true);
      setSelectedChoice(rec.choice);
      setSkipped(rec.skipped);
      setFlashGrade(rec.flash);
      setRevealed(rec.flash !== null);
      setTypedAnswer(rec.typed);
      setTypeResult(rec.typeResult);
    } else {
      setAnswered(false);
      setSelectedChoice(null);
      setSkipped(false);
      setRevealed(false);
      setFlashGrade(null);
      setTypedAnswer("");
      setTypeResult(null);
    }
    setHintLevel(0);
    setCurrentIdx(target);
  }, []);

  // 이전 문제로 (실수로 넘어간 단어 다시 보기) — 점수 변화 없음
  const handlePrev = useCallback(() => {
    if (currentIdx === 0) return;
    haptic("light");
    slideToPrev(() => applyIndex(currentIdx - 1));
  }, [currentIdx, haptic, applyIndex]);

  // 스와이프 제스처 — 정답 확인 후 왼쪽 스와이프로 다음 문제 (네이티브 전용)
  const swipeEnabled = Platform.OS !== "web";
  const swipeGesture = Gesture.Pan()
    .enabled(swipeEnabled)
    .activeOffsetX([-20, 20])
    .failOffsetY([-15, 15])
    .onEnd((e) => {
      if (answered && e.translationX < -50) {
        runOnJS(handleNext)();
      }
    });

  const s = styles(colors);
  const pct = Math.round((currentIdx / questions.length) * 100);

  if (!q) return null;

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
        <SwipeWrapper enabled={swipeEnabled} gesture={swipeGesture}>
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
            {/* 정답/오답 플래시 overlay */}
            <Animated.View
              pointerEvents="none"
              style={[s.flashOverlay, flashOverlayStyle, {
                backgroundColor: flashIsCorrect
                  ? colors.success
                  : colors.error,
              }]}
            />
            <View style={s.questionHeader}>
              {currentIdx > 0 ? (
                <Pressable onPress={handlePrev} style={s.prevBtn} hitSlop={8}>
                  <Text style={s.prevBtnText}>← 이전</Text>
                </Pressable>
              ) : (
                <View style={{ width: 48 }} />
              )}
              <Text style={s.questionNum}>
                문제 {currentIdx + 1} · {getModeLabel()}
              </Text>
              <Pressable onPress={handleBookmark} style={s.bookmarkBtn}>
                <Text style={{ fontSize: 20 }}>{isBookmarked ? "🔖" : "🏷️"}</Text>
              </Pressable>
            </View>

            <View style={s.wordRow}>
              <Text style={s.wordText}>{q.item.w}</Text>
              <SpeakerButton text={q.item.w} size={38} />
            </View>
            {q.item.p ? (
              <Text style={s.ipaText}>{q.item.p}</Text>
            ) : null}

            {/* 4지선다 모드 */}
            {isChoiceMode && (
              <>
                <Text style={s.hintText}>{getHintText()}</Text>
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
                        <View style={{ flex: 1 }}>
                          <Text style={textStyle} numberOfLines={3}>
                            {choice}
                          </Text>
                          {/* 정답 확인 후 선지 한글뜻 표시 */}
                          {answered && (() => {
                            const choiceItem = VOCAB.find((v) =>
                              v.w === choice ||
                              (v.s && v.s.includes(choice))
                            );
                            const kor = choiceItem?.k_short;
                            if (!kor) return null;
                            return (
                              <Text style={s.choiceKorText}>{kor}</Text>
                            );
                          })()}
                        </View>
                        {/* 정답 확인 후 영어 선지 발음 듣기 */}
                        {answered && /[A-Za-z]/.test(choice) && (
                          <SpeakerButton text={choice} size={30} />
                        )}
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
        </SwipeWrapper>
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
      overflow: "hidden",
    },
    flashOverlay: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      borderRadius: 20,
      zIndex: 10,
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
    prevBtn: {
      paddingVertical: 4,
      paddingHorizontal: 8,
      borderRadius: 8,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
    },
    prevBtnText: {
      fontSize: 11,
      fontWeight: "700",
      color: colors.primary2 as string,
    },
    wordRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      marginBottom: 4,
      flexWrap: "wrap",
    },
    wordText: {
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
    skipBtn: {
      marginTop: 12,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      paddingVertical: 11,
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
