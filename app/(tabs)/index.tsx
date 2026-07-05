import React, { useState, useCallback, useMemo, useEffect } from "react";
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
  runOnJS,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import * as Haptics from "expo-haptics";

import { ScreenContainer } from "@/components/screen-container";
import { SpeakerButton } from "@/components/speaker-button";
import { useColors } from "@/hooks/use-colors";
import { recordOneAnswer, loadBookmarks, toggleBookmark } from "@/lib/store";
import { VOCAB, korGloss } from "@/lib/vocab";
import {
  examQuestions,
  shuffleQuestions,
  shuffleChoices,
  getQuestionsByYear,
  getQuestionsByType,
  isGoldQuestion,
  sectionOf,
  type SectionType,
  type ExamQuestion,
  type QuestionType,
} from "@/lib/exam-questions";
import { EXAM_STATS, provenanceOf } from "@/lib/exam-stats";

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

type FilterYear = "all" | 2020 | 2021 | 2022 | 2023 | 2024 | 2025 | 2026;
type FilterType = "all" | SectionType;
type FilterSchool = "all" | "hanyang" | "sungkyunkwan" | "sogang" | "chungang" | "konkuk" | "gachon" | "logic";

const SCHOOL_OPTIONS: { id: FilterSchool; label: string; icon: string; available: boolean }[] = [
  { id: "all",          label: "전체",      icon: "🏫", available: true },
  { id: "hanyang",      label: "한양대",    icon: "🔵", available: true },
  { id: "sungkyunkwan", label: "성균관대",  icon: "🟡", available: true },
  { id: "logic",        label: "논리 시리즈", icon: "🟣", available: true },
  { id: "sogang",       label: "서강대",    icon: "🔴", available: false },
  { id: "chungang",     label: "중앙대",    icon: "🟢", available: false },
  { id: "konkuk",       label: "건국대",    icon: "🟠", available: false },
  { id: "gachon",       label: "가천대",    icon: "⚪", available: false },
];

const YEAR_OPTIONS: { id: FilterYear; label: string }[] = [
  { id: "all", label: "전체" },
  { id: 2026, label: "2026" },
  { id: 2025, label: "2025" },
  { id: 2024, label: "2024" },
  { id: 2023, label: "2023" },
  { id: 2022, label: "2022" },
  { id: 2021, label: "2021" },
  { id: 2020, label: "2020" },
];

// 섹션 = 지시문·요구 사고 기준 분류 (sectionOf) — 파일명/기존 라벨 아님
const TYPE_OPTIONS: { id: FilterType; label: string; icon: string }[] = [
  { id: "all",                 label: "전체",     icon: "📚" },
  { id: "vocabulary",          label: "어휘",     icon: "🔤" },
  { id: "sentence_completion", label: "논리완성", icon: "🔗" },
  { id: "reading",             label: "독해",     icon: "📖" },
  { id: "grammar",             label: "문법",     icon: "✏️" },
  { id: "discourse",           label: "표현·담화", icon: "💬" },
];

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

/**
 * 텍스트에서 밑줄 단어(underlined)를 찾아 강조 색상으로 렌더링합니다.
 * - question 필드: [단어] 대괄호 패턴
 * - passage 필드: underlined 문자열을 직접 검색
 */
function HighlightText({
  text,
  underlined,
  baseStyle,
  highlightColor,
  isBold = false,
}: {
  text: string;
  underlined?: string;
  baseStyle: object;
  highlightColor: string;
  isBold?: boolean;
}) {
  // [단어] 패턴 처리 (question 필드)
  const bracketPattern = /\[([^\]]+)\]/g;
  const hasBracket = bracketPattern.test(text);

  if (hasBracket) {
    const parts: { text: string; highlight: boolean }[] = [];
    let lastIndex = 0;
    const regex = /\[([^\]]+)\]/g;
    let match;
    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push({ text: text.slice(lastIndex, match.index), highlight: false });
      }
      parts.push({ text: match[1], highlight: true });
      lastIndex = match.index + match[0].length;
    }
    if (lastIndex < text.length) {
      parts.push({ text: text.slice(lastIndex), highlight: false });
    }
    return (
      <Text style={baseStyle}>
        {parts.map((p, i) =>
          p.highlight ? (
            <Text
              key={i}
              style={{
                color: highlightColor,
                fontWeight: "800",
                textDecorationLine: "underline",
                textDecorationColor: highlightColor,
              }}
            >
              {p.text}
            </Text>
          ) : (
            <Text key={i}>{p.text}</Text>
          )
        )}
      </Text>
    );
  }

  // underlined 문자열 직접 검색 (passage 필드)
  if (underlined && text.includes(underlined)) {
    const idx = text.indexOf(underlined);
    const before = text.slice(0, idx);
    const after = text.slice(idx + underlined.length);
    return (
      <Text style={baseStyle}>
        <Text>{before}</Text>
        <Text
          style={{
            color: highlightColor,
            fontWeight: isBold ? "800" : "700",
            textDecorationLine: "underline",
            textDecorationColor: highlightColor,
          }}
        >
          {underlined}
        </Text>
        <Text>{after}</Text>
      </Text>
    );
  }

  return <Text style={baseStyle}>{text}</Text>;
}

function getTypeColor(type: QuestionType, colors: ReturnType<typeof useColors>): string {
  if (type === "vocab-synonym" || type === "vocab-blank" || type === "reading-vocab")
    return colors.primary as string;
  if (type === "reading-main" || type === "reading-title" || type === "reading-blank")
    return colors.success as string;
  if (type === "logic-blank" || type === "grammar") return colors.warning as string;
  return colors.muted as string;
}

// 재구성 문항 뒤에 붙은 한글 번역은 정답 힌트를 유출하므로 정답 확인 전엔 분리한다.
// 한글이 앞부분(<30자)에 오는 것은 "밑줄 친 …" 같은 정상 지시문이므로 그대로 둔다.
function splitKorTranslation(text: string): { en: string; ko: string | null } {
  const i = text.search(/[가-힣]/);
  if (i < 0 || i < 30) return { en: text, ko: null };
  return {
    en: text.slice(0, i).replace(/[ ,·\-–]+$/, "").trim(),
    ko: text.slice(i).trim(),
  };
}

// 구조화 해설 파서 — 라벨 분리 (정규화 7단계 + 골드 11단계 라벨)
const EXPL_LABELS = [
  "정답", "완성 문장", "문맥 의미", "핵심 단서", "오답 이유", "해석", "출처",
  "핵심 논리", "근거 표현", "문법·논리·어조", "영영 정의", "정답 이유", "함정",
];
function parseExplanation(expl: string) {
  const get = (label: string): string | null => {
    const others = EXPL_LABELS.filter((l) => l !== label).join("|");
    const m = expl.match(
      new RegExp(`(?:^|\\n)${label}\\s*[:：]\\s*([\\s\\S]*?)(?=\\n(?:${others})\\s*[:：]|$)`)
    );
    return m ? m[1].trim() : null;
  };
  return {
    answer: get("정답"),
    restored: get("완성 문장"),
    meaning: get("문맥 의미"),
    clue: get("핵심 단서"),
    wrong: get("오답 이유"),
    trans: get("해석"),
    source: get("출처"),
    // 골드 라벨
    keyLogic: get("핵심 논리"),
    evidenceSpan: get("근거 표현"),
    grammarTone: get("문법·논리·어조"),
    engDef: get("영영 정의"),
    correctReason: get("정답 이유"),
    trap: get("함정"),
  };
}

// ─── 선지 뜻 조회 (검수된 경로만: 자기 표제어 → syn-gloss 사전) ─────────────────
// 다른 표제어의 동의어 배열에서 뜻을 가져오는 것은 오개념 버그라 금지.
const WORD_ITEM = new Map(VOCAB.map((v) => [v.w.trim().toLowerCase(), v]));

/** 단어형 선지인가 (문장·한국어 선지는 뜻 표시 대상 아님) */
function isWordChoice(choice: string): boolean {
  return /^[A-Za-z][A-Za-z '’\-()]{0,34}$/.test(choice.trim());
}

/** 선지 뜻 — {gloss, verified(표제어 일치 여부), num(단어장 num)} 또는 null(검수 필요) */
function choiceGloss(choice: string): { gloss: string; num?: number } | null {
  const key = choice.trim().toLowerCase().replace(/^[①②③④⑤]\s*/, "");
  const item = WORD_ITEM.get(key);
  if (item?.k_short) return { gloss: item.k_short, num: item.num };
  const g = korGloss(key);
  if (g) return { gloss: g };
  return null;
}

// 선지 관계 배지 표기
const RELATION_LABEL: Record<string, string> = {
  exact: "직접 동의어",
  near: "근접어",
  contextual: "문맥상 최선답",
  wrong: "오답",
  unverified: "근거 부족",
};

function relChipColor(rel: string, colors: ReturnType<typeof useColors>): string {
  if (rel === "exact") return colors.success as string;
  if (rel === "near") return colors.warningText as string;
  if (rel === "contextual") return "#9D7BEC";
  if (rel === "unverified") return colors.dim as string;
  return colors.error as string;
}
function relChipStyle(rel: string, colors: ReturnType<typeof useColors>) {
  return {
    borderColor: relChipColor(rel, colors) + "66",
    backgroundColor: relChipColor(rel, colors) + "1A",
  };
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
  const [detailOpen, setDetailOpen] = useState(false); // 전구 박스 '더보기' 접기
  const [choicesRevealed, setChoicesRevealed] = useState(false); // 골드 빈칸: 의미 예측 후 선택지 공개

  const cardScale = useSharedValue(1);
  const cardTranslateX = useSharedValue(0);
  const cardOpacity = useSharedValue(1);
  const cardAnim = useAnimatedStyle(() => ({
    transform: [
      { scale: cardScale.value },
      { translateX: cardTranslateX.value },
    ],
    opacity: cardOpacity.value,
  }));

  // 카드 슬라이드 전환 애니메이션
  const slideToNext = useCallback((onComplete: () => void) => {
    cardTranslateX.value = withTiming(-60, { duration: 180 });
    cardOpacity.value = withTiming(0, { duration: 180 }, () => {
      cardTranslateX.value = 60;
      cardOpacity.value = 0;
      runOnJS(onComplete)();
      cardTranslateX.value = withTiming(0, { duration: 220 });
      cardOpacity.value = withTiming(1, { duration: 220 });
    });
  }, [cardTranslateX, cardOpacity]);

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
      const isCorrect = choiceIdx === q.answer;
      if (isCorrect) {
        haptic("success");
        setCorrect((c) => c + 1);
      } else {
        haptic("error");
      }
      // 한 문제 단위 즉시 저장 (기출문제 풀이는 vocab num이 없으므로 오답노트 num은 저장 불가)
      recordOneAnswer(isCorrect);
    },
    [answered, q.answer, haptic, cardScale]
  );

  const handleNext = useCallback(() => {
    haptic("light");
    if (idx + 1 >= questions.length) {
      onFinish(correct, questions.length);
      return;
    }
    slideToNext(() => {
      setIdx((i) => i + 1);
      setAnswered(false);
      setSelected(null);
      setDetailOpen(false);
      setChoicesRevealed(false);
    });
  }, [idx, questions.length, correct, haptic, onFinish, slideToNext]);

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
  const pct = Math.round((idx / questions.length) * 100);
  const typeColor = getTypeColor(q.type, colors);

  // 구조화 해설의 "오답 이유: ① … ② …"를 선지 인덱스별로 분해 (비골드 문항용)
  const wrongReasons = useMemo(() => {
    const map: Record<number, string> = {};
    const wrong = parseExplanation(q.explanation).wrong;
    if (!wrong) return map;
    for (const seg of wrong.split(/(?=[①②③④⑤])/)) {
      const m = seg.match(/^([①②③④⑤])\s*([\s\S]*)$/);
      if (m && m[2].trim()) map["①②③④⑤".indexOf(m[1])] = m[2].trim().replace(/[.。]\s*$/, "");
    }
    return map;
  }, [q.explanation]);

  // 선지 단어 → 단어장(북마크) 추가
  const [bmSet, setBmSet] = useState<Set<number>>(new Set());
  useEffect(() => {
    loadBookmarks().then((b) => setBmSet(new Set(b)));
  }, []);
  const handleAddWordbook = useCallback(async (num: number) => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const list = await toggleBookmark(num);
    setBmSet(new Set(list));
  }, []);

  return (
    <SwipeWrapper enabled={swipeEnabled} gesture={swipeGesture}>
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
      <Animated.View style={[s.card, cardAnim]}>
        {/* 유형 배지 + 검수 상태 (정답 정보 없음) */}
        <View style={s.badgeRow}>
          <View style={[s.typeBadge, { backgroundColor: typeColor + "22", borderColor: typeColor + "55" }]}>
            <Text style={[s.typeBadgeText, { color: typeColor }]}>
              {q.year}년 {getTypeLabel(q.type)} · {q.points}점
            </Text>
          </View>
          {(() => {
            const p = provenanceOf(q.id);
            const gold = isGoldQuestion(q) && q.verification?.status === "verified";
            if (gold)
              return (
                <View style={[s.statusBadge, { borderColor: (colors.success as string) + "66", backgroundColor: (colors.success as string) + "1A" }]}>
                  <Text style={[s.statusBadgeText, { color: colors.success as string }]}>
                    ✓ 골드 검수 {q.verification?.grade}
                  </Text>
                </View>
              );
            if (p === "verified")
              return (
                <View style={[s.statusBadge, { borderColor: (colors.success as string) + "66", backgroundColor: (colors.success as string) + "1A" }]}>
                  <Text style={[s.statusBadgeText, { color: colors.success as string }]}>✓ 원문 확인</Text>
                </View>
              );
            return (
              <View style={[s.statusBadge, { borderColor: (colors.warningText as string) + "66", backgroundColor: (colors.warningText as string) + "1A" }]}>
                <Text style={[s.statusBadgeText, { color: colors.warningText as string }]}>
                  ⚠️ 검수 필요 — 정답·해설 참고용
                </Text>
              </View>
            );
          })()}
        </View>

        {/* 지문 (독해) */}
        {q.passage && (
          <View style={s.passageBox}>
            <HighlightText
              text={q.passage}
              underlined={q.underlined}
              baseStyle={s.passageText}
              highlightColor={typeColor}
            />
          </View>
        )}

        {/* 문제 — 영어 원문만 표시, 한국어 해석(translationKo)은 정답 확인 후 공개 */}
        <HighlightText
          text={q.translationKo ? q.question : splitKorTranslation(q.question).en}
          underlined={q.underlined}
          baseStyle={s.questionText}
          highlightColor={typeColor}
          isBold
        />
        {/* 빈칸 위치 표시가 유실된 재구성 문항 안내 */}
        {(q.type.includes("blank") || q.type.includes("logic")) &&
          !/_{2,}|\(빈칸\)/.test(q.question) && (
            <Text style={s.blankNote}>
              ※ 빈칸 위치 표시가 없는 재구성 문항 — 문맥으로 판단하세요
            </Text>
          )}

        {/* 골드 빈칸 문항: 선택지를 숨기고 의미 예측 먼저 (원하면 바로 공개) */}
        {isGoldQuestion(q) && q.type.includes("blank") && !answered && !choicesRevealed ? (
          <View style={s.predictBox}>
            <Text style={s.predictTitle}>🧠 선택지를 보기 전에</Text>
            <Text style={s.predictText}>
              문단의 핵심을 파악하고, 빈칸에 들어갈 의미를 한국어나 쉬운 영어로
              먼저 예측해 보세요. 예측이 끝나면 선택지를 확인합니다.
            </Text>
            <Pressable
              style={s.predictBtn}
              onPress={() => setChoicesRevealed(true)}
            >
              <Text style={s.predictBtnText}>선택지 보기 →</Text>
            </Pressable>
          </View>
        ) : (
        <View style={s.choicesWrap}>
          {q.choices.map((choice, ci) => {
            // 골드 문항: 선지 문자열로 choiceAnalysis 매칭 (셔플 안전)
            const ca = q.choiceAnalysis?.find((c) => c.choice === choice);
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
                <View style={{ flex: 1 }}>
                  <Text style={[s.choiceText, { color: textColor }]}>
                    {choice}
                  </Text>
                  {/* 정답 확인 후: 모든 선지의 뜻 + 정답/오답 라벨 + 이유 공개
                      (풀기 전에는 절대 노출하지 않음 — 정답 유출 방지) */}
                  {answered && isWordChoice(choice) ? (() => {
                    const g = choiceGloss(choice);
                    return (
                      <Text style={s.choiceGlossText}>
                        {g ? g.gloss : "뜻 정보 검수 필요"}
                      </Text>
                    );
                  })() : null}
                  {answered && ca ? (
                    <>
                      <View style={s.relRow}>
                        <View style={[s.relChip, relChipStyle(ca.relation, colors)]}>
                          <Text style={[s.relChipText, { color: relChipColor(ca.relation, colors) }]}>
                            {RELATION_LABEL[ca.relation] ?? ca.relation}
                          </Text>
                        </View>
                        {!ca.grammaticalFit ? (
                          <Text style={s.relNote}>문법·문형 탈락</Text>
                        ) : null}
                      </View>
                      <Text style={s.choiceReason} numberOfLines={detailOpen ? 0 : 2}>
                        {ca.reason}
                      </Text>
                    </>
                  ) : answered && wrongReasons[ci] && !isCorrect ? (
                    <Text style={s.choiceReason} numberOfLines={detailOpen ? 0 : 2}>
                      오답 이유: {wrongReasons[ci]}
                    </Text>
                  ) : null}
                </View>
                {/* 정답 확인 후 영어 선지 발음 듣기 */}
                {answered && /[A-Za-z]/.test(choice) && (
                  <SpeakerButton text={choice} size={30} opacity={0.75} />
                )}
              </Pressable>
            );
          })}
        </View>
        )}

        {/* 해설 — 📖 원문 → ✅ 정답 복원 → 💡 전구 문맥 해설 → 해석 → 출처
            (정답 제출 전에는 어떤 번역·해설도 노출하지 않는다) */}
        {answered && (() => {
          const ev = q.evidence;
          const parsed = parseExplanation(q.explanation);
          const prov = provenanceOf(q.id);
          const answerText = q.choices[q.answer];
          const ko = parsed.trans ?? q.translationKo ?? splitKorTranslation(q.question).ko;
          // 원문: evidence 우선, 없으면 빈칸 유형의 문제 문장 자체가 원문
          const enQ = q.translationKo ? q.question : splitKorTranslation(q.question).en;
          const original =
            ev?.originalSentenceEn ??
            (q.type.includes("blank") && /_{2,}/.test(enQ) ? enQ : null);
          // 복원문: 빈칸에 정답을 기계적으로 삽입 (문장 재작성 금지)
          const restored =
            ev?.restoredSentenceEn ??
            (original && /_{2,}/.test(original)
              ? original.replace(/_{2,}/, answerText)
              : parsed.restored);
          const srcLabel =
            prov === "verified"
              ? "📖 기출 원문"
              : prov === "reconstructed"
              ? "📖 재구성 예문 (기출 아님)"
              : "📖 예문 · 기출 원문 확인 필요";
          const gold = isGoldQuestion(q);
          const anal = q.analysis;
          const verif = q.verification;
          return (
            <Animated.View entering={FadeIn.duration(300)} style={s.explBox}>
              {/* ② 정답 + 한 줄 핵심 논리 */}
              <Text style={s.answerLine}>
                정답: {["①", "②", "③", "④", "⑤"][q.answer]} {answerText}
              </Text>
              {(verif?.keyLogic ?? parsed.keyLogic) ? (
                <Text style={s.keyLogicText}>{verif?.keyLogic ?? parsed.keyLogic}</Text>
              ) : null}

              {/* 📖 원문 + ✅ 복원 */}
              {original ? (
                <View style={s.evidenceBox}>
                  <Text style={s.evidenceLabel}>{srcLabel}</Text>
                  <Text style={s.evidenceEn}>{original}</Text>
                  {restored ? (
                    <>
                      <Text style={[s.evidenceLabel, { marginTop: 8 }]}>✅ 정답 복원</Text>
                      <Text style={s.evidenceEn}>
                        {restored.split(answerText).map((part, i, arr) => (
                          <Text key={i}>
                            {part}
                            {i < arr.length - 1 && (
                              <Text style={s.evidenceAnswer}>{answerText}</Text>
                            )}
                          </Text>
                        ))}
                      </Text>
                    </>
                  ) : null}
                </View>
              ) : restored ? (
                <View style={s.evidenceBox}>
                  <Text style={s.evidenceLabel}>✅ 정답 문장</Text>
                  <Text style={s.evidenceEn}>{restored}</Text>
                </View>
              ) : null}

              {/* ③ 메인포인트 (골드) */}
              {gold && anal?.mainPoint ? (
                <View style={s.evidenceBox}>
                  <Text style={s.evidenceLabel}>📌 문단의 메인포인트</Text>
                  <Text style={s.explText}>{anal.mainPoint}</Text>
                </View>
              ) : null}

              {/* 💡 전구 박스 — ④근거 표현 ⑤표면/함의 ⑥비유·태도 */}
              {(gold && anal) || parsed.meaning || parsed.clue || ev?.contextClues?.length ? (
                <View style={s.bulbBox}>
                  {gold && anal ? (
                    <>
                      <Text style={s.bulbText}>
                        💡 근거: “{anal.evidenceSpan}”
                        {anal.blankFunction ? `\n빈칸의 역할: ${anal.blankFunction}` : ""}
                      </Text>
                      {anal.contextualMeaning ? (
                        <Text style={[s.bulbText, { marginTop: 6 }]}>
                          문맥 의미: {anal.contextualMeaning}
                        </Text>
                      ) : null}
                      {anal.impliedMeaning &&
                      (anal.inferenceConfidence === "explicit" ||
                        anal.inferenceConfidence === "strongly-implied") ? (
                        <Text style={[s.bulbText, { marginTop: 6 }]}>
                          언외적 함의: {anal.impliedMeaning}
                        </Text>
                      ) : null}
                      {anal.figurative ? (
                        <Text style={[s.bulbText, { marginTop: 6 }]}>
                          비유: {anal.figurative.expression} — 문자적으로는 “
                          {anal.figurative.literalMeaning}”, 이 문맥에서는 “
                          {anal.figurative.contextualMeaning}”
                        </Text>
                      ) : null}
                      <Text style={s.bulbMeta}>
                        논리 관계: {anal.discourseRelation} · 어조: {anal.authorTone}
                      </Text>
                    </>
                  ) : (
                    <>
                      <Text style={s.bulbText}>
                        💡 {[parsed.meaning, parsed.clue].filter(Boolean).join("\n단서: ")}
                      </Text>
                      {ev?.logicRelation ? (
                        <Text style={s.bulbMeta}>논리 관계: {ev.logicRelation}</Text>
                      ) : null}
                    </>
                  )}
                  {detailOpen && parsed.wrong ? (
                    <Text style={[s.bulbText, { marginTop: 8 }]}>
                      오답 이유{"\n"}{parsed.wrong}
                    </Text>
                  ) : null}
                  {parsed.wrong ? (
                    <Pressable onPress={() => setDetailOpen((v) => !v)} hitSlop={6}>
                      <Text style={s.bulbMore}>
                        {detailOpen ? "접기 ▲" : "오답 이유 더보기 ▼"}
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              ) : null}

              {/* ⑧ 영영 정의 + ⑪ 최강 경쟁 오답과의 차이 (골드) */}
              {gold && (parsed.engDef || anal?.strongestRival) ? (
                <View style={s.evidenceBox}>
                  {parsed.engDef ? (
                    <>
                      <Text style={s.evidenceLabel}>영영 정의</Text>
                      <Text style={s.explText}>{parsed.engDef}</Text>
                    </>
                  ) : null}
                  {anal?.strongestRival && anal?.rivalRejectionReason ? (
                    <>
                      <Text style={[s.evidenceLabel, parsed.engDef ? { marginTop: 8 } : null]}>
                        최강 경쟁 선지: {anal.strongestRival}
                      </Text>
                      <Text style={s.explText}>{anal.rivalRejectionReason}</Text>
                    </>
                  ) : null}
                </View>
              ) : null}

              {/* ⑬ 함정 (골드) */}
              {gold && verif?.trap && verif.trap !== "명시적 함정 없음" ? (
                <Text style={s.trapText}>⚠️ 출제 함정: {verif.trap}</Text>
              ) : null}

              {/* 해석 (정답 제출 후에만) */}
              {ko ? (
                <>
                  <Text style={s.explTitle}>우리말 해석</Text>
                  <Text style={[s.explText, { marginBottom: 10 }]}>{ko}</Text>
                </>
              ) : null}

              {/* 구조화 실패 시 원본 해설 전문 표시 (정보 손실 방지) */}
              {!parsed.meaning && !parsed.answer ? (
                <>
                  <Text style={s.explTitle}>해설</Text>
                  <Text style={s.explText}>{q.explanation}</Text>
                </>
              ) : null}

              {/* ⑭ 출처 + 검수등급·근거 자료 */}
              <Text style={s.sourceLine}>
                {parsed.source ??
                  (prov === "verified"
                    ? `${q.school ?? ""} ${q.year} ${q.qNum}번`
                    : prov === "reconstructed"
                    ? "재구성 연습문항 (기출 아님)"
                    : "출처 검수 대기")}
                {verif
                  ? ` · 검수등급 ${verif.grade} · 근거 ${
                      (q.choiceAnalysis ?? []).reduce(
                        (n, c) => n + (c.references?.length ?? 0), 0
                      )
                    }건 (${verif.reviewedBy.join("→")})`
                  : ""}
              </Text>
            </Animated.View>
          );
        })()}

        {/* 📚 선지 단어 정리 — 오답 선지까지 한 번에 흡수 */}
        {answered && (() => {
          const words = q.choices
            .filter((c) => isWordChoice(c))
            .map((c) => ({ choice: c, g: choiceGloss(c) }));
          if (words.length === 0) return null;
          return (
            <Animated.View entering={FadeIn.duration(300)} style={s.wordSummaryBox}>
              <Text style={s.wordSummaryTitle}>📚 선지 단어 정리</Text>
              {words.map(({ choice, g }, i) => {
                const inBook = g?.num != null && bmSet.has(g.num);
                return (
                  <View key={i} style={s.wordSummaryRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.wordSummaryWord}>
                        {choice}
                        {choice === q.choices[q.answer] ? (
                          <Text style={{ color: colors.success as string }}>  ✓ 정답</Text>
                        ) : null}
                      </Text>
                      <Text style={s.wordSummaryGloss}>
                        {g ? g.gloss : "뜻 정보 검수 필요"}
                      </Text>
                    </View>
                    {g?.num != null ? (
                      <Pressable
                        style={[
                          s.wordAddBtn,
                          inBook && {
                            backgroundColor: (colors.primary as string) + "1F",
                            borderColor: colors.primary as string,
                          },
                        ]}
                        onPress={() => handleAddWordbook(g.num!)}
                        hitSlop={6}
                      >
                        <Text style={[s.wordAddBtnText, inBook && { color: colors.primary as string }]}>
                          {inBook ? "✓ 담김" : "+ 단어장"}
                        </Text>
                      </Pressable>
                    ) : null}
                  </View>
                );
              })}
            </Animated.View>
          );
        })()}

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
    </SwipeWrapper>
  );
}

// ─── 메인 화면 컴포넌트───────────────────────────────────────────────────────────
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
  const [schoolFilter, setSchoolFilter] = useState<FilterSchool>("all");
  const [quizQuestions, setQuizQuestions] = useState<ExamQuestion[] | null>(null);
  const [result, setResult] = useState<{ correct: number; total: number } | null>(null);

  const filteredQuestions = useMemo(() => {
    // 차단(blocked) 문항은 절대 출제하지 않는다 (오류·복수정답·빈칸 유실 등)
    let qs = examQuestions.filter((q) => provenanceOf(q.id) !== "blocked");
    if (schoolFilter !== "all") qs = qs.filter((q) => q.school === schoolFilter);
    if (yearFilter !== "all") qs = qs.filter((q) => q.year === yearFilter);
    if (typeFilter !== "all") qs = qs.filter((q) => sectionOf(q) === typeFilter);
    return qs;
  }, [yearFilter, typeFilter, schoolFilter]);

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
          <Text style={s.sessionTitle}>기출문제 풀이</Text>
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
          <Text style={s.headerTitle}>기출문제 풀이</Text>
          <Text style={s.headerSub}>편입 기출 · 한양·성균관·논리 시리즈 · 2013~2026</Text>
          {/* 검증 기준 집계 — 출처(학교·연도·원문) 확인된 자료만 '기출'로 셈 */}
          <View style={s.statChipRow}>
            <View style={s.statChip}>
              <Text style={s.statChipNum}>{EXAM_STATS.verifiedQuestions}</Text>
              <Text style={s.statChipLabel}>검증 기출 문항</Text>
            </View>
            <View style={s.statChip}>
              <Text style={s.statChipNum}>{EXAM_STATS.examWords}</Text>
              <Text style={s.statChipLabel}>기출 단어</Text>
            </View>
            <View style={s.statChip}>
              <Text style={s.statChipNum}>{EXAM_STATS.examIdioms}</Text>
              <Text style={s.statChipLabel}>기출 숙어·표현</Text>
            </View>
            <View style={s.statChip}>
              <Text style={s.statChipNum}>
                {EXAM_STATS.unverifiedQuestions + EXAM_STATS.pendingVocab}
              </Text>
              <Text style={s.statChipLabel}>검수 대기</Text>
            </View>
            <View style={s.statChip}>
              <Text style={s.statChipNum}>{EXAM_STATS.reconstructedQuestions}</Text>
              <Text style={s.statChipLabel}>재구성 문제</Text>
            </View>
          </View>
          <Text style={s.statNote}>
            재구성 연습문항은 기출 집계에서 제외
            {EXAM_STATS.blockedQuestions > 0
              ? ` · 오류 문항 ${EXAM_STATS.blockedQuestions}개 출제 차단`
              : ""}
          </Text>
        </View>

        {/* 학교 필터 */}
        <View style={s.section}>
          <Text style={s.sectionLabel}>학교</Text>
          <View style={s.chipRow}>
            {SCHOOL_OPTIONS.map((opt) => (
              <Pressable
                key={opt.id}
                style={[
                  s.chip,
                  schoolFilter === opt.id && s.chipActive,
                  !opt.available && s.chipDisabled,
                ]}
                onPress={() => opt.available && setSchoolFilter(opt.id)}
              >
                <Text style={[
                  s.chipText,
                  schoolFilter === opt.id && s.chipTextActive,
                  !opt.available && s.chipTextDisabled,
                ]}>
                  {opt.icon} {opt.label}{!opt.available ? " (준비중)" : ""}
                </Text>
              </Pressable>
            ))}
          </View>
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
            {filteredQuestions.length > 0 ? `기출문제 시작 →` : "해당 문항 없음"}
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
    statChipRow: {
      flexDirection: "row",
      gap: 8,
      marginTop: 12,
    },
    statChip: {
      flex: 1,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      paddingVertical: 8,
      paddingHorizontal: 4,
      alignItems: "center",
    },
    statChipNum: {
      fontSize: 18,
      fontWeight: "700",
      color: colors.foreground,
      fontVariant: ["tabular-nums"],
    },
    statChipLabel: {
      fontSize: 10,
      color: colors.dim,
      marginTop: 2,
      textAlign: "center",
    },
    statNote: {
      fontSize: 11,
      color: colors.dim,
      marginTop: 8,
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
      gap: 6,
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
    chipDisabled: {
      opacity: 0.4,
    },
    chipTextDisabled: {
      color: colors.muted as string,
      fontSize: 11,
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
    badgeRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 6,
      marginBottom: 14,
    },
    typeBadge: {
      alignSelf: "flex-start",
      borderWidth: 1,
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    statusBadge: {
      alignSelf: "flex-start",
      borderWidth: 1,
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    statusBadgeText: {
      fontSize: 11,
      fontWeight: "700",
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
      fontSize: 16,
      color: colors.foreground as string,
      lineHeight: 25,
    },
    questionText: {
      fontSize: 18,
      color: colors.foreground as string,
      lineHeight: 28,
      fontWeight: "600",
      marginBottom: 18,
    },
    blankNote: {
      fontSize: 11,
      color: colors.dim as string,
      marginTop: -10,
      marginBottom: 14,
    },
    choicesWrap: {
      gap: 10,
    },
    choiceBtn: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 12,
      borderWidth: 1.5,
      borderRadius: 12,
      padding: 13,
      minHeight: 48,
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
      fontSize: 17,
      flex: 1,
      lineHeight: 24,
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
    answerLine: {
      fontSize: 15,
      fontWeight: "800",
      color: colors.success as string,
      marginBottom: 4,
    },
    keyLogicText: {
      fontSize: 13.5,
      color: colors.foreground as string,
      lineHeight: 20,
      marginBottom: 10,
    },
    predictBox: {
      borderWidth: 1.5,
      borderStyle: "dashed",
      borderColor: colors.border as string,
      borderRadius: 12,
      padding: 18,
      alignItems: "center",
      gap: 10,
    },
    predictTitle: {
      fontSize: 14,
      fontWeight: "800",
      color: colors.foreground as string,
    },
    predictText: {
      fontSize: 12.5,
      color: colors.dim as string,
      lineHeight: 19,
      textAlign: "center",
    },
    predictBtn: {
      backgroundColor: colors.primary as string,
      borderRadius: 10,
      paddingVertical: 11,
      paddingHorizontal: 22,
      marginTop: 2,
    },
    predictBtnText: {
      fontSize: 13,
      fontWeight: "800",
      color: "#fff",
    },
    relRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginTop: 5,
    },
    relChip: {
      borderWidth: 1,
      borderRadius: 99,
      paddingHorizontal: 8,
      paddingVertical: 2,
    },
    relChipText: {
      fontSize: 10.5,
      fontWeight: "800",
    },
    relNote: {
      fontSize: 10.5,
      color: colors.error as string,
      fontWeight: "700",
    },
    choiceReason: {
      fontSize: 12,
      color: colors.dim as string,
      lineHeight: 17,
      marginTop: 3,
    },
    trapText: {
      fontSize: 12.5,
      color: colors.warningText as string,
      lineHeight: 19,
      marginBottom: 10,
      fontWeight: "600",
    },
    choiceGlossText: {
      fontSize: 12.5,
      color: colors.muted as string,
      marginTop: 3,
      lineHeight: 17,
    },
    wordSummaryBox: {
      marginTop: 14,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      padding: 14,
    },
    wordSummaryTitle: {
      fontSize: 12,
      fontWeight: "800",
      color: colors.foreground as string,
      marginBottom: 8,
    },
    wordSummaryRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingVertical: 6,
    },
    wordSummaryWord: {
      fontSize: 14,
      fontWeight: "700",
      color: colors.foreground as string,
    },
    wordSummaryGloss: {
      fontSize: 12,
      color: colors.muted as string,
      marginTop: 1,
    },
    wordAddBtn: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    wordAddBtnText: {
      fontSize: 11,
      fontWeight: "700",
      color: colors.dim as string,
    },
    evidenceBox: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      padding: 12,
      marginBottom: 10,
    },
    evidenceLabel: {
      fontSize: 10,
      fontWeight: "800",
      color: colors.dim as string,
      letterSpacing: 0.8,
      marginBottom: 4,
    },
    evidenceEn: {
      fontSize: 15,
      color: colors.foreground as string,
      lineHeight: 23,
    },
    evidenceAnswer: {
      fontWeight: "800",
      color: colors.success as string,
    },
    bulbBox: {
      backgroundColor: (colors.warning as string) + "1A",
      borderWidth: 1,
      borderColor: (colors.warning as string) + "59",
      borderRadius: 10,
      padding: 12,
      marginBottom: 10,
    },
    bulbText: {
      fontSize: 13.5,
      color: colors.foreground as string,
      lineHeight: 21,
    },
    bulbMeta: {
      fontSize: 12,
      color: colors.warningText as string,
      fontWeight: "700",
      marginTop: 6,
    },
    bulbMore: {
      fontSize: 12,
      color: colors.warningText as string,
      fontWeight: "700",
      marginTop: 8,
    },
    sourceLine: {
      fontSize: 11.5,
      color: colors.dim as string,
      marginTop: 2,
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
