import { MIN_TOUCH_TARGET, SCROLL_END_PADDING, STUDY_CARD_PADDING, STUDY_PAGE_GUTTER } from "@/lib/layout";
import { useState, useRef, useCallback, useMemo, useEffect, useSyncExternalStore } from "react";
import {
  View,
  Text,
  ScrollView,
  TextInput,
  Pressable,
  StyleSheet,
  Platform,
  TouchableOpacity,
} from "react-native";
import Animated, {
  FadeIn,
  FadeOut,
  LinearTransition,
  Easing,
  ReduceMotion,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolate,
  Extrapolation,
} from "react-native-reanimated";
import { useFocusEffect } from "expo-router";

import { ScreenContainer } from "@/components/screen-container";
import { PronunciationButton } from "@/components/pronunciation-button";
import { WordPronunciation } from "@/components/word-pronunciation";
import { LearningDetails } from "@/components/learning-details";
import { BookLearningDetails } from "@/components/book-learning-details";
import { ProblemSenseContext } from "@/components/problem-sense-context";
import { SemanticRelationCluster } from "@/components/semantic-relation-cluster";
import { SynonymDetails } from "@/components/synonym-details";
import { getDefinitionQuizEntry, getDefinitionAnswerRelations } from "@/lib/definition-quiz";
import { WordSectionLabel } from "@/components/word-section-label";
import { formatWordbookConcept } from "@/lib/wordbook-concepts";
import { WordbookPractice } from "@/components/wordbook-practice";
import { getWordbookPracticeItems } from "@/lib/wordbook-practice";
import { BOOK_EDITION } from "@/lib/book-edition";
import { getActiveBookEdition } from "@/lib/integrated-wordbook";
import { useStudyVocab } from "@/hooks/use-study-vocab";
import { arrangeWordbook, groupWordbookHeadwords, includeLegacySearch, isVolumeOneWord, type DisplayWord } from "@/lib/wordbook-display";
import { getProductionSenseQuestions, hasSenseQuestionMapping, senseMatchesItem } from "@/lib/sense-questions";
import { WORDBOOK_RANGES, getVocabItem, type VocabItem, type VocabRange } from "@/lib/vocab";
import {
  loadBookmarks,
  loadSenseLearningState,
  markLearningTargetMastered,
  startLearningTargetAgain,
  toggleBookmark,
  getLearningStorageIssue,
  subscribeLearningStorage,
} from "@/lib/store";
import { getItemLearningTargets, itemIsFullyMastered } from "@/lib/canonical-learning";
import type { LearningStatus, SenseLearningState } from "@/lib/learning-state";
import { useColors } from "@/hooks/use-colors";
import * as Haptics from "expo-haptics";
import { useAudioPlayer, setAudioModeAsync } from "expo-audio";

const RANGE_OPTIONS: (VocabRange & { bookSection?: string })[] = WORDBOOK_RANGES.filter(range => range.id !== 'book-b').sort((a, b) => Number(b.id === 'all') - Number(a.id === 'all'))
  .map(range => range.id === 'book-b' ? { ...range, bookSection: '보카바이블 B' } : range);

function getRangeChipLabel(range: (typeof RANGE_OPTIONS)[number]) {
  if (range.bookSection) return range.bookSection;
  if (range.group === "PERSONAL") return "개인 통합";
  if (range.group === "APPENDIX") return "부록";
  return range.group ?? range.label;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const CARD_EXIT = FadeOut.duration(160).easing(Easing.out(Easing.cubic)).reduceMotion(ReduceMotion.System);
const CARD_LAYOUT = LinearTransition.duration(240).easing(Easing.out(Easing.cubic)).reduceMotion(ReduceMotion.System);

// ─── 단어 카드 ────────────────────────────────────────────────────────────────
function WordCard({
  item,
  bookmarks,
  onToggleBookmark,
  colors,
  maskMode,
  onPlayHide,
  onPlayReveal,
  learningStatus,
  getLearningStatus,
  onLearningStatusPress,
  readOnly = false,
  nested = false,
  animateExit = false,
}: {
  item: DisplayWord;
  bookmarks: Set<number>;
  onToggleBookmark: (num: number) => void;
  colors: ReturnType<typeof useColors>;
  maskMode: boolean;
  onPlayHide: () => void;
  onPlayReveal: () => void;
  learningStatus: LearningStatus;
  getLearningStatus: (item: VocabItem) => LearningStatus;
  onLearningStatusPress: (item: VocabItem) => void;
  readOnly?: boolean;
  nested?: boolean;
  animateExit?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [relationDetailsOpen, setRelationDetailsOpen] = useState(false);
  const [duplicatesOpen, setDuplicatesOpen] = useState(false);
  const [meaningHidden, setMeaningHidden] = useState(maskMode);
  const isBookmarked = bookmarks.has(item.num);
  const chunkMeaning = item.book?.section === 'V301' ? item.book.chunk?.trim() : '';
  const displayMeaning = item.book?.display?.meaning_display ?? item.k_short;
  const s = cardStyles(colors);
  const hasReviewedMapping = hasSenseQuestionMapping(item.id);
  const dictionaryEntry = getDefinitionQuizEntry(item.id);
  const hasDictionarySynonyms = !!dictionaryEntry && getDefinitionAnswerRelations(dictionaryEntry).synonyms.length > 0;
  const reviewedSenses = getProductionSenseQuestions(item.id).filter(sense => senseMatchesItem(sense, item));

  // 상태는 즉시 바꾸고 회전은 표시 효과만 담당해 Safari에서도 멈추지 않습니다.
  const flipRotation = useSharedValue(0);
  const meaningFlipStyle = useAnimatedStyle(() => ({
    transform: [{ perspective: 900 }, { rotateY: `${flipRotation.value}deg` }],
    opacity: interpolate(
      Math.abs(flipRotation.value),
      [0, 18],
      [1, 0.72],
      Extrapolation.CLAMP,
    ),
    backfaceVisibility: "hidden",
  }));

  const handleMeaningPress = useCallback(() => {
    const nextHidden = !meaningHidden;
    setMeaningHidden(nextHidden);
    flipRotation.value = nextHidden ? 18 : -18;
    flipRotation.value = withTiming(0, {
      duration: 240,
      easing: Easing.out(Easing.cubic),
      reduceMotion: ReduceMotion.System,
    });
    if (nextHidden) onPlayHide();
    else onPlayReveal();
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, [flipRotation, meaningHidden, onPlayHide, onPlayReveal]);

  const handleSynonymToggle = useCallback(() => {
    setExpanded((value) => !value);
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, []);

  // 전체 가리기 전환 시 모든 카드가 같은 기준 상태에서 시작합니다.
  useEffect(() => {
    flipRotation.value = 0;
    setMeaningHidden(maskMode);
  }, [flipRotation, item.num, maskMode]);

  const handleBookmark = useCallback(
    (e: any) => {
      e.stopPropagation?.();
      if (readOnly) return;
      onToggleBookmark(item.num);
    },
    [item.num, onToggleBookmark, readOnly],
  );

  return (
    <Animated.View exiting={animateExit ? CARD_EXIT : undefined} style={s.card}>
      <View style={s.topRow}>
        <View style={s.wordArea}>
          <Text style={s.wordText}>{item.w}</Text>
          <WordPronunciation item={item} context="study" ipaStyle={s.ipaText} />
        </View>
        <PronunciationButton itemId={item.id} text={item.w} compact style={{ width: MIN_TOUCH_TARGET, height: MIN_TOUCH_TARGET }} />
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={`${item.w} ${isBookmarked ? "북마크 해제" : "북마크 추가"}`}
          disabled={readOnly} accessibilityState={{ disabled: readOnly }}
          onPress={handleBookmark}
          style={s.bookmarkBtn}
          hitSlop={4}
        >
          <Text style={{ fontSize: 18 }}>{isBookmarked ? "🔖" : "🏷️"}</Text>
        </TouchableOpacity>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${item.w} 한글 뜻 ${meaningHidden ? "보기" : "가리기"}`}
        accessibilityHint="누르면 카드가 뒤집힙니다"
        accessibilityState={{ expanded: !meaningHidden }}
        onPress={handleMeaningPress}
        style={({ pressed }) => [
          s.meaningTouch,
          pressed && s.meaningTouchPressed,
        ]}
      >
        <Animated.View style={[s.meaningFace, meaningFlipStyle]}>
          {meaningHidden ? (
            <View style={s.maskBox}>
              <Text style={s.maskHintText}>탭하여 한글 뜻 보기</Text>
            </View>
          ) : (
            <View>
              {item.book?.gradingReview?.status === 'requires_editorial_policy_review' && <Text style={s.korText}>뜻 확인 필요 · 아래 정정 참고</Text>}
              {!!chunkMeaning && chunkMeaning !== displayMeaning && <Text style={s.korText}>{chunkMeaning}</Text>}
              <Text style={s.korText}>{displayMeaning}</Text>
              {(item.group === "V301" || item.group === "V502") && !(item.book?.concept || item.book?.chunk) && (
                <Text testID="wordbook-original-concept" style={s.numText}>
                  {formatWordbookConcept(item)}
                </Text>
              )}
            </View>
          )}
        </Animated.View>
      </Pressable>

      <View style={s.metadataRow}>
        <View style={s.sourceMetadata}>
          <Text style={s.numText}>{nested ? "다른 용법" : item.book ? `#${item.book.printedNumber ?? item.book.order}` : item.localBook ? "내 교재 · 빠른 암기" : item.referenceOnly ? "추가 단어 · 검수 중" : `#${item.num}`}</Text>
          {item.book ? <Text style={s.numText}>{item.book.section}</Text> : <WordSectionLabel groups={item.displaySourceGroups ?? [item.group]} />}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={learningStatus === "MASTERED" ? `${item.w} 다시 학습` : `${item.w} 마스터`}
          disabled={readOnly} accessibilityState={{ disabled: readOnly }}
          onPress={() => onLearningStatusPress(getVocabItem(item.num) ?? item)}
          style={({ pressed }) => [s.learningStateButton, pressed && { opacity: 0.65 }]}
        >
          <Text style={[s.learningStateText, { color: learningStatus === "MASTERED" ? colors.warning : colors.muted }]}>
            {learningStatus === "MASTERED" ? "↻ 다시 학습" : learningStatus === "RELEARNING" ? "재학습 중" : "✓ 마스터"}
          </Text>
        </Pressable>
      </View>
      {!meaningHidden && expanded && !hasReviewedMapping && <SynonymDetails item={item} compact />}
      {!meaningHidden && (hasReviewedMapping || item.s.length > 0 || hasDictionarySynonyms) && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${item.w} 동의어 ${expanded ? "접기" : "보기"}`}
          accessibilityState={{ expanded }}
          onPress={handleSynonymToggle}
          style={({ pressed }) => [
            s.expandButton,
            pressed && { opacity: 0.65 },
          ]}
        >
          <Text style={s.expandHint}>
            {expanded ? "▲ 동의어 접기" : "▼ 동의어 보기"}
          </Text>
        </Pressable>
      )}
      {!meaningHidden && expanded && hasReviewedMapping && <View>
        <Text style={s.expandHint}>검수된 문맥별 뜻 · 다른 뜻과 섞지 않아요</Text>
        {reviewedSenses.length === 0 && <Text style={s.expandHint}>의미 관계 재검수 중</Text>}
        {reviewedSenses.map(sense => <View key={sense.id}>
          <Text style={s.expandHint}>{sense.partOfSpeech} · {sense.definitionKo}</Text>
          <SemanticRelationCluster headword={sense.headword} coreMeaningKo={sense.definitionKo} showDefinitionBridge={false}
            nearSynonyms={sense.relation ? [sense.relation.targetWord] : []}
            choiceMeanings={sense.choices.filter(choice => choice.id === sense.correctId).map(choice => ({ word: choice.en, meaning: choice.ko }))} />
          <Pressable accessibilityRole="button" accessibilityState={{ expanded: relationDetailsOpen }} onPress={() => setRelationDetailsOpen(value => !value)} style={s.expandButton}>
            <Text style={s.expandHint}>문맥·선지 차이 {relationDetailsOpen ? "접기" : "보기"}</Text>
          </Pressable>
          {relationDetailsOpen && <><Text style={s.korText}>{sense.contextEn}</Text><ProblemSenseContext sense={sense} answered /></>}
        </View>)}
      </View>}
      {!meaningHidden && <BookLearningDetails entry={item.book} />}
      {!meaningHidden && <LearningDetails itemId={item.id} />}
      {!!item.displayDuplicates?.length && <>
        <Pressable accessibilityRole="button" accessibilityState={{ expanded: duplicatesOpen }} onPress={() => setDuplicatesOpen(value => !value)} style={s.expandButton}>
          <Text style={s.expandHint}>다른 항목 · {duplicatesOpen ? '접기' : '기록과 용법 보기'}</Text>
        </Pressable>
        {duplicatesOpen && item.displayDuplicates.map(duplicate => <WordCard key={duplicate.id} item={duplicate} bookmarks={bookmarks}
          onToggleBookmark={onToggleBookmark} colors={colors} maskMode={maskMode} onPlayHide={onPlayHide} onPlayReveal={onPlayReveal}
          learningStatus={getLearningStatus(duplicate)} getLearningStatus={getLearningStatus} onLearningStatusPress={onLearningStatusPress} readOnly={readOnly} nested />)}
      </>}
    </Animated.View>
  );
}

const cardStyles = (colors: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 14,
      padding: STUDY_CARD_PADDING,
      marginHorizontal: STUDY_PAGE_GUTTER,
      marginBottom: 8,
    },
    topRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginBottom: 2,
    },
    metadataRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
    sourceMetadata: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "baseline", gap: 6, flexWrap: "wrap" },
    numText: {
      fontSize: 11,
      fontWeight: "400",
      color: colors.metadata,
      fontVariant: ["tabular-nums"],
    },
    wordArea: { flex: 1, minWidth: 0 },
    wordText: {
      fontSize: 18,
      fontWeight: "800",
      color: colors.foreground,
      letterSpacing: -0.5,
    },
    ipaText: {
      fontSize: 11,
      color: colors.primary,
      fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
      marginTop: 2,
      letterSpacing: 0.3,
    },
    bookmarkBtn: {
      width: MIN_TOUCH_TARGET,
      height: MIN_TOUCH_TARGET,
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
    },
    learningStateButton: {
      minHeight: MIN_TOUCH_TARGET,
      justifyContent: "center",
      paddingHorizontal: 8,
      flexShrink: 0,
    },
    learningStateText: { fontSize: 12, fontWeight: "700" },
    korText: {
      fontSize: 13,
      color: colors.muted,
      lineHeight: 19,
    },
    meaningTouch: {
      minHeight: MIN_TOUCH_TARGET,
      borderRadius: 9,
      justifyContent: "center",
      overflow: "hidden",
    },
    meaningTouchPressed: {
      opacity: 0.96,
    },
    meaningFace: {
      minHeight: MIN_TOUCH_TARGET,
      justifyContent: "center",
      paddingHorizontal: 2,
      paddingVertical: 3,
    },
    // 마스크 박스 — 뜻을 가리는 영역
    maskBox: {
      minHeight: MIN_TOUCH_TARGET,
      borderRadius: 8,
      backgroundColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 12,
      overflow: "hidden",
    },
    maskHintText: {
      fontSize: 12,
      color: colors.muted,
      fontWeight: "600",
    },
    synRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 5,
      marginTop: 6,
      marginBottom: 4,
    },
    synTag: {
      maxWidth: "100%",
      flexShrink: 1,
      backgroundColor: colors.primary + "18",
      borderWidth: 1,
      borderColor: colors.primary + "35",
      borderRadius: 20,
      paddingHorizontal: 9,
      paddingVertical: 3,
    },
    synTagText: { fontSize: 11, color: colors.primary },
    expandHint: {
      fontSize: 10,
      color: colors.muted,
      textAlign: "right",
    },
    expandButton: {
      minHeight: 44,
      alignSelf: "flex-end",
      justifyContent: "center",
      paddingHorizontal: 4,
      marginTop: 2,
    },
  });

// ─── 메인 화면 ────────────────────────────────────────────────────────────────
export default function WordbookScreen() {
  const colors = useColors();
  const storageIssue = useSyncExternalStore(subscribeLearningStorage, getLearningStorageIssue, () => null);

  const [edition, setEdition] = useState(getActiveBookEdition() ?? BOOK_EDITION);
  const revisedIdiomCount = edition.sourceCounts['숙어'];
  const rangeOptions = useMemo(() => edition.privateContent ? [RANGE_OPTIONS.find(range => range.id === 'all')!,
    ...edition.sections.filter(section => section !== '보카바이블 B').map(section => RANGE_OPTIONS.find(range => section === '숙어' ? range.kind === 'idioms'
      : section === '보카바이블 B' ? range.id === 'book-b' : (range.group === 'APPENDIX' ? '부록' : range.group) === section)!)] : RANGE_OPTIONS, [edition]);
  const VOCAB = useStudyVocab();
  const VOCAB_HEADWORD_COUNT = useMemo(() => new Set(VOCAB.map(item => item.w)).size, [VOCAB]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRange, setSelectedRange] = useState(Math.max(0, RANGE_OPTIONS.findIndex(range => range.id === 'all')));
  const [concept, setConcept] = useState('');
  const [bookmarks, setBookmarks] = useState<Set<number>>(new Set());
  const [showOnlyBookmarks, setShowOnlyBookmarks] = useState(false);
  const [showMastered, setShowMastered] = useState(false);
  // The book's main volume and whole-book search retain printed placements.
  const includeLegacy = includeLegacySearch(edition.privateContent, searchQuery, rangeOptions[selectedRange] ?? rangeOptions[0], edition.edition);
  const [isShuffled, setIsShuffled] = useState(false);
  const [maskMode, setMaskMode] = useState(false);
  const [learningState, setLearningState] = useState<SenseLearningState | null>(null);
  const masteryPending = useRef(false);
  const [isUpdatingMaster, setIsUpdatingMaster] = useState(false);
  const [masteryMotionItem, setMasteryMotionItem] = useState<number | null>(null);

  // ─── 사운드 (개별/전체 가리기 피드백) ─────────────────────────────────────
  const hidePlayer = useAudioPlayer(require("@/assets/sounds/hide.wav"));
  const revealPlayer = useAudioPlayer(require("@/assets/sounds/reveal.wav"));

  useEffect(() => {
    if (Platform.OS !== "web") {
      setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
    }
  }, []);

  const playHide = useCallback(() => {
    if (Platform.OS !== "web") {
      try {
        hidePlayer.seekTo(0);
        hidePlayer.play();
      } catch {}
    }
  }, [hidePlayer]);

  const playReveal = useCallback(() => {
    if (Platform.OS !== "web") {
      try {
        revealPlayer.seekTo(0);
        revealPlayer.play();
      } catch {}
    }
  }, [revealPlayer]);

  useFocusEffect(useCallback(() => {
    setEdition(getActiveBookEdition() ?? BOOK_EDITION);
    loadBookmarks().then((arr) => setBookmarks(new Set(arr))).catch(() => undefined);
    loadSenseLearningState().then(setLearningState).catch(() => undefined);
  }, []));

  const handleLearningStatusPress = useCallback(async (item: VocabItem) => {
    if (masteryPending.current || getLearningStorageIssue()) return;
    const targets = getItemLearningTargets(item);
    if (targets.length !== 1) return;
    masteryPending.current = true;
    setIsUpdatingMaster(true);
    setMasteryMotionItem(item.num);
    try {
      const current = learningState?.targets[targets[0].key]?.status ?? "NEW";
      const next = current === "MASTERED"
        ? await startLearningTargetAgain(targets[0].key)
        : await markLearningTargetMastered(targets[0].key, item.num);
      // Commit the list change only after persistence succeeds; never hide on failure.
      setLearningState(next);
    } catch {
      // The store reports the protection issue. Keep the card and original state.
      setMasteryMotionItem(null);
    } finally {
      masteryPending.current = false;
      setIsUpdatingMaster(false);
    }
  }, [learningState]);

  const handleToggleBookmark = useCallback(async (num: number) => {
    if (getLearningStorageIssue()) return;
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    const updated = await toggleBookmark(num);
    setBookmarks(new Set(updated));
  }, []);

  const practiceScope = useMemo(() => ({ rangeId: rangeOptions[selectedRange]?.id ?? 'all', concept, query: searchQuery,
    bookmarksOnly: showOnlyBookmarks, includeMastered: showMastered || !!searchQuery.trim(), includeLegacy }), [rangeOptions, selectedRange, concept, searchQuery, showOnlyBookmarks, showMastered, includeLegacy]);
  const practiceItems = useMemo(() => {
    const items = VOCAB.length ? getWordbookPracticeItems(practiceScope, bookmarks, learningState) : [];
    if (!showMastered) return items;
    const keys = new Set(Object.values(learningState?.targets ?? {}).filter(target => target.status === 'MASTERED').map(target => target.key));
    return items.filter(item => itemIsFullyMastered(item, keys));
  }, [practiceScope, bookmarks, learningState, VOCAB, showMastered]);
  const firstLegacySection = useMemo(() => {
    const first = new Map<string, string>();
    for (const item of VOCAB) {
      if (!isVolumeOneWord(item)) continue;
      const key = item.w.trim().toLowerCase().replace(/\s+/g, ' ');
      if (key && !first.has(key)) first.set(key, item.group);
    }
    return first;
  }, [VOCAB]);
  const filteredVocab = useMemo(() => {
    if (edition.privateContent && !includeLegacy) return isShuffled ? shuffle(practiceItems) : practiceItems;
    const active = rangeOptions[selectedRange];
    // In the legacy-only list, a word belongs to its first original section.
    // Bookmark-only views remain able to reach every old individual record.
    const sectionItems = !edition.privateContent && !showOnlyBookmarks && active?.kind === 'section' && active.group
      ? practiceItems.filter(item => !isVolumeOneWord(item) || firstLegacySection.get(item.w.trim().toLowerCase().replace(/\s+/g, ' ')) === active.group)
      : practiceItems;
    const rows = arrangeWordbook(sectionItems, item => JSON.stringify([
      bookmarks.has(item.num),
      getItemLearningTargets(item).map(target => [item.localBook ? 'local' : target.key, learningState?.targets[target.key] ?? null]),
    ]), edition.privateContent);
    const grouped = groupWordbookHeadwords(rows);
    return isShuffled ? shuffle(grouped) : grouped;
  }, [practiceItems, bookmarks, isShuffled, learningState, edition, includeLegacy, firstLegacySection, rangeOptions, selectedRange, showOnlyBookmarks]);

  const renderRecord = useCallback(
    (item: DisplayWord) => (
      <WordCard
        item={item}
        bookmarks={bookmarks}
        onToggleBookmark={handleToggleBookmark}
        colors={colors}
        maskMode={maskMode}
        onPlayHide={playHide}
        onPlayReveal={playReveal}
        learningStatus={learningState?.targets[getItemLearningTargets(item)[0]?.key]?.status ?? "NEW"}
        getLearningStatus={row => learningState?.targets[getItemLearningTargets(row)[0]?.key]?.status ?? "NEW"}
        onLearningStatusPress={handleLearningStatusPress}
        readOnly={!!storageIssue || isUpdatingMaster}
        animateExit={item.num === masteryMotionItem}
      />
    ),
    [bookmarks, handleLearningStatusPress, handleToggleBookmark, colors, learningState, maskMode, playHide, playReveal, storageIssue, isUpdatingMaster, masteryMotionItem],
  );

  const renderItem = useCallback(({ item }: { item: DisplayWord }) => renderRecord(item), [renderRecord]);
  const keyExtractor = useCallback((item: DisplayWord) => item.id, []);

  const handleShuffle = useCallback(() => {
    setMasteryMotionItem(null);
    setIsShuffled((v) => !v);
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  }, []);

  const handleMaskToggle = useCallback(() => {
    setMaskMode((v) => !v);
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  }, []);

  const activeRange = rangeOptions[selectedRange] ?? rangeOptions[0];
  const activeBookSection = activeRange.bookSection ?? (activeRange.group === 'APPENDIX' ? '부록' : activeRange.group);
  const conceptSection = activeRange.kind === 'idioms' ? '숙어' : activeBookSection;
  const concepts = useMemo(() => edition.privateContent && (conceptSection === 'V301' || conceptSection === 'V502' || conceptSection === '숙어')
    ? [...new Set(edition.entries.filter(entry => entry.section === conceptSection).map(entry => entry.concept).filter(Boolean))] : [], [edition, conceptSection]);

  const listHeader = (
    <>
      {/* 헤더 */}
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>
            단어장
          </Text>
          <Text style={[styles.headerSub, { color: colors.muted }]}>
            {edition.privateContent ? `단권화 v${edition.edition} · ${(edition.entries.length - (edition.sourceCounts['숙어'] ?? 0) + (revisedIdiomCount ?? edition.sourceCounts['숙어'] ?? 0)).toLocaleString()}개 · 책 순서` : `단어 ${VOCAB_HEADWORD_COUNT.toLocaleString()}개`}
          </Text>
        </View>
        {/* 버튼 그룹 */}
        <View style={styles.headerBtns}>
          {/* 전체 카드 학습 버튼 */}
          <TouchableOpacity
            style={[
              styles.headerBtn,
              {
                backgroundColor: maskMode
                  ? colors.warning + "22"
                  : colors.surface,
                borderColor: maskMode ? colors.warning : colors.border,
              },
            ]}
            onPress={handleMaskToggle}
            accessibilityRole="button"
            accessibilityLabel={
              maskMode ? "전체 한글 뜻 보이기" : "전체 한글 뜻 가리기"
            }
            accessibilityState={{ selected: maskMode }}
          >
            <Text
              style={[
                styles.headerBtnText,
                { color: maskMode ? colors.warning : colors.muted },
              ]}
            >
              {maskMode ? "뜻 보기" : "뜻 가리기"}
            </Text>
          </TouchableOpacity>
          {/* 셔플 버튼 */}
          <TouchableOpacity
            style={[
              styles.headerBtn,
              {
                backgroundColor: isShuffled ? colors.primary : colors.surface,
                borderColor: isShuffled ? colors.primary : colors.border,
              },
            ]}
            onPress={handleShuffle}
            accessibilityRole="button"
            accessibilityLabel={isShuffled ? "원래 단어 순서로 보기" : "단어 무작위로 보기"}
            accessibilityState={{ selected: isShuffled }}
          >
            <Text
              style={[
                styles.headerBtnText,
                { color: isShuffled ? "#fff" : colors.muted },
              ]}
            >
              🔀 {isShuffled ? "랜덤 ON" : "랜덤"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>


      {/* 마스크 모드 안내 배너 */}
      {maskMode && (
        <Animated.View
          entering={FadeIn.duration(200)}
          style={[
            styles.maskBanner,
            {
              backgroundColor: colors.warning + "18",
              borderColor: colors.warning + "55",
            },
          ]}
        >
          <Text style={[styles.maskBannerText, { color: colors.warning }]}>
            카드 학습 — 한글 뜻 영역을 눌러 뒤집어 확인하세요
          </Text>
        </Animated.View>
      )}

      {/* 검색창 + 북마크 필터 */}
      <View style={styles.searchRow}>
        <View
          style={[
            styles.searchBox,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={[styles.searchInput, { color: colors.foreground }]}
            value={searchQuery}
            onChangeText={value => { setMasteryMotionItem(null); setSearchQuery(value); }}
            placeholder="단어, 뜻, 동의어 검색..."
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
        </View>
        <TouchableOpacity
          style={[
            styles.iconBtn,
            {
              backgroundColor: showOnlyBookmarks
                ? colors.primary + "22"
                : colors.surface,
              borderColor: showOnlyBookmarks ? colors.primary : colors.border,
            },
          ]}
          onPress={() => { setMasteryMotionItem(null); setShowOnlyBookmarks((v) => !v); }}
          accessibilityRole="button"
          accessibilityLabel={showOnlyBookmarks ? "북마크 필터 해제" : "북마크한 단어만 보기"}
          accessibilityState={{ selected: showOnlyBookmarks }}
        >
          <Text style={{ fontSize: 16 }}>🔖</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.masteredFilterButton,
            {
              backgroundColor: showMastered ? colors.warning + "22" : colors.surface,
              borderColor: showMastered ? colors.warning : colors.border,
            },
          ]}
          onPress={() => { setMasteryMotionItem(null); setShowMastered((value) => !value); }}
          accessibilityRole="button"
          accessibilityLabel={showMastered ? "학습할 단어 목록으로 돌아가기" : "외운 단어 목록 보기"}
          accessibilityState={{ selected: showMastered }}
        >
          <Text style={[styles.masteredFilterText, { color: showMastered ? colors.warning : colors.muted }]}>
            {showMastered ? "외운 단어 ✓" : "외운 단어"}
          </Text>
        </TouchableOpacity>
      </View>

      {/* 구간 필터 — 독립적인 View로 높이 고정 */}
      <View style={styles.rangeWrapper}>
        <ScrollView
          horizontal
          style={
            Platform.OS === "web"
              ? ([styles.rangeScroller, { touchAction: "pan-x", overscrollBehaviorX: "contain" }] as any)
              : styles.rangeScroller
          }
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.rangeContent}
          keyboardShouldPersistTaps="handled"
          directionalLockEnabled
          nestedScrollEnabled
        >
          {rangeOptions.map((item, index) => (
            <TouchableOpacity
              key={item.id}
              activeOpacity={0.7}
              style={[
                styles.rangeChip,
                {
                  backgroundColor:
                    selectedRange === index ? colors.primary : colors.surface,
                  borderColor:
                    selectedRange === index ? colors.primary : colors.border,
                },
              ]}
              onPress={() => {
                if (index === selectedRange) return;
                if (Platform.OS !== "web") {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }
                setSelectedRange(index);
                setMasteryMotionItem(null);
                setConcept('');
              }}
            >
              <Text
                style={[
                  styles.rangeChipText,
                  {
                    color: selectedRange === index ? "#fff" : colors.muted,
                    fontWeight: selectedRange === index ? "700" : "500",
                  },
                ]}
              >
                {getRangeChipLabel(item)}{edition.privateContent && item.id !== 'all' ? ` ${(item.kind === 'idioms' ? revisedIdiomCount ?? edition.sourceCounts['숙어'] : edition.sourceCounts[item.bookSection ?? (item.group === 'APPENDIX' ? '부록' : item.group ?? '')])?.toLocaleString() ?? ''}` : ''}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {concepts.length > 0 && <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rangeContent}>
        {['', ...concepts].map(value => <Pressable key={value} accessibilityRole="button" accessibilityState={{ selected: value === concept }}
          onPress={() => { setMasteryMotionItem(null); setConcept(value); }} style={[styles.rangeChip, { backgroundColor: value === concept ? colors.primary : colors.surface, borderColor: colors.border }]}>
          <Text style={{ color: value === concept ? '#fff' : colors.foreground }}>{value || (conceptSection === '숙어' ? '숙어 전체' : '개념 전체')}</Text>
        </Pressable>)}
      </ScrollView>}

      {/* 결과 수 */}
      <View style={styles.resultRow}>
        <Text style={[styles.resultText, { color: colors.muted }]}>
          {filteredVocab.length.toLocaleString()}개
          {searchQuery ? ` · "${searchQuery}" 검색 결과` : ""}
          {showOnlyBookmarks ? " · 북마크만" : ""}
          {showMastered ? " · 외운 단어만" : searchQuery.trim() ? " · 외운 단어 포함" : " · 외운 단어 제외"}
          {isShuffled ? " · 랜덤 순서" : ""}
          {maskMode ? " · 플래시카드 모드" : ""}
        </Text>
      </View>
      {storageIssue && <Text style={{ color: colors.muted, paddingHorizontal: STUDY_PAGE_GUTTER, paddingBottom: 12 }}>학습은 계속할 수 있어요. 기존 기록은 보호됩니다.</Text>}
      <WordbookPractice scope={practiceScope} label={getRangeChipLabel(activeRange)} items={practiceItems} learningState={learningState}
        hasLocalContent={practiceItems.some(item => item.localBook)} />
    </>
  );

  return (
    <ScreenContainer containerClassName="bg-background">
      <Animated.FlatList
        itemLayoutAnimation={masteryMotionItem !== null ? CARD_LAYOUT : undefined}
        style={styles.list}
        data={filteredVocab}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        ListHeaderComponent={listHeader}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
        initialNumToRender={20}
        maxToRenderPerBatch={20}
        windowSize={10}
        removeClippedSubviews={Platform.OS !== "web"}
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Text style={styles.emptyIcon}>📭</Text>
            <Text style={[styles.emptyText, { color: colors.muted }]}>
              {searchQuery ? "검색 결과가 없습니다" : "단어가 없습니다"}
            </Text>
          </View>
        }
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  list: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    paddingHorizontal: STUDY_PAGE_GUTTER,
    paddingTop: 10,
    paddingBottom: 8,
  },
  headerCopy: { flex: 1, minWidth: 0 },
  headerTitle: {
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  headerSub: {
    fontSize: 10,
    marginTop: 2,
  },
  headerBtns: {
    flexDirection: "row",
    gap: 4,
    alignItems: "center",
  },
  headerBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    minHeight: 44,
    justifyContent: "center",
  },
  headerBtnText: {
    fontSize: 12,
    fontWeight: "600",
  },
  // 마스크 모드 안내 배너
  maskBanner: {
    marginHorizontal: STUDY_PAGE_GUTTER,
    marginBottom: 8,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  maskBannerText: {
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: STUDY_PAGE_GUTTER,
    gap: 6,
    marginBottom: 6,
  },
  searchBox: {
    flex: 1,
    minWidth: 0,
    minHeight: MIN_TOUCH_TARGET,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 9,
    paddingVertical: 6,
    gap: 6,
  },
  searchIcon: { fontSize: 15 },
  searchInput: {
    flex: 1,
    minWidth: 0,
    fontSize: 16,
    padding: 0,
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  masteredFilterButton: {
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  masteredFilterText: { fontSize: 11, fontWeight: "700" },
  // ★ 핵심 수정: 구간 필터를 독립 View로 감싸서 높이를 명시적으로 확보
  rangeWrapper: {
    height: 46,
    marginBottom: 2,
    width: '100%',
    minWidth: 0,
    overflow: 'hidden',
  },
  rangeScroller: { width: '100%', minWidth: 0, flexGrow: 0 },
  rangeContent: {
    paddingHorizontal: STUDY_PAGE_GUTTER,
    gap: 6,
    alignItems: "center",
    height: 46,
  },
  rangeChip: {
    flexShrink: 0,
    paddingHorizontal: 12,
    paddingVertical: 7,
    minHeight: 44,
    justifyContent: "center",
    borderRadius: 20,
    borderWidth: 1,
  },
  rangeChipText: {
    fontSize: 12,
  },
  resultRow: {
    minHeight: MIN_TOUCH_TARGET + 4,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    paddingHorizontal: STUDY_PAGE_GUTTER,
    paddingTop: 2,
    paddingBottom: 2,
  },
  resultText: { fontSize: 11, flex: 1 },
  directProblemButton: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    borderRadius: 12,
    paddingHorizontal: 12,
    flexShrink: 0,
  },
  directProblemButtonText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "800",
  },
  listContent: {
    paddingTop: 4,
    paddingBottom: SCROLL_END_PADDING,
  },
  emptyBox: {
    alignItems: "center",
    paddingTop: 80,
    gap: 12,
  },
  emptyIcon: { fontSize: 40 },
  emptyText: { fontSize: 14 },
});
