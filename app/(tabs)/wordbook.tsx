import { useState, useCallback, useMemo, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  ScrollView,
  TextInput,
  Pressable,
  StyleSheet,
  Platform,
  TouchableOpacity,
} from "react-native";
import Animated, {
  FadeIn,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  runOnJS,
  interpolate,
  Extrapolation,
} from "react-native-reanimated";

import { ScreenContainer } from "@/components/screen-container";
import { SpeakerButton } from "@/components/speaker-button";
import { VOCAB, VocabItem, synWithKor } from "@/lib/vocab";
import {
  loadBookmarks,
  toggleBookmark,
  loadMastered,
  addMastered,
  removeMastered,
  loadMemos,
  saveMemo,
} from "@/lib/store";
import { useColors } from "@/hooks/use-colors";
import * as Haptics from "expo-haptics";
import { useAudioPlayer, setAudioModeAsync } from "expo-audio";
import { Modal } from "react-native";
import conceptGroupsRaw from "@/assets/concept-groups.json";

// 개념(동의어) 묶음 데이터 — 같은 뜻 단어끼리 모아 암기
interface ConceptGroup {
  label: string;
  kor: string;
  nums: number[];
  isCategory?: boolean;
}
const CONCEPT_GROUPS = conceptGroupsRaw as ConceptGroup[];
const VOCAB_BY_NUM: Map<number, VocabItem> = new Map(VOCAB.map((v) => [v.num, v]));

// 개념별 보기용 리스트 아이템 (헤더 또는 단어)
type ConceptRow =
  | { kind: "header"; id: string; label: string; kor: string; count: number; isCategory?: boolean; open?: boolean }
  | { kind: "word"; id: string; item: VocabItem };

const RANGE_OPTIONS = [
  { label: "전체", start: 0, end: VOCAB.length - 1, isIdiom: false },
  { label: "숙어·표현", start: 0, end: VOCAB.length - 1, isIdiom: true },
  { label: "1~1000", start: 0, end: 999, isIdiom: false },
  { label: "1001~2000", start: 1000, end: 1999, isIdiom: false },
  { label: "2001~3000", start: 2000, end: 2999, isIdiom: false },
  { label: "3001~4000", start: 3000, end: 3999, isIdiom: false },
  { label: "4001~5000", start: 4000, end: 4999, isIdiom: false },
  { label: "5001~6000", start: 5000, end: 5999, isIdiom: false },
  { label: "6001~7000", start: 6000, end: 6999, isIdiom: false },
  { label: "7001~8000", start: 7000, end: 7999, isIdiom: false },
  { label: "8001~9517", start: 8000, end: VOCAB.length - 1, isIdiom: false },
];

// 단어 길이에 따라 폰트 크기 동적 조절 — 웹(adjustsFontSizeToFit 미지원)에서도 한 줄 유지
function wordFontSize(w: string): number {
  const n = w.length;
  if (n <= 8) return 18;
  if (n <= 10) return 16;
  if (n <= 13) return 14;
  if (n <= 17) return 12;
  if (n <= 24) return 10;
  return 9;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ─── 단어 카드 ────────────────────────────────────────────────────────────────
function WordCard({
  item,
  bookmarks,
  onToggleBookmark,
  colors,
  maskMode,
  onPlayHide,
  onPlayReveal,
  isMastered,
  onToggleMaster,
  memo,
  onEditMemo,
}: {
  item: VocabItem;
  bookmarks: Set<number>;
  onToggleBookmark: (num: number) => void;
  colors: ReturnType<typeof useColors>;
  maskMode: boolean;
  onPlayHide: () => void;
  onPlayReveal: () => void;
  isMastered: boolean;
  onToggleMaster: (num: number) => void;
  memo?: string;
  onEditMemo: (num: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  // 전체 가리기 모드에서 개별 공개 여부
  const [revealed, setRevealed] = useState(false);
  // 개별 가리기 (전체 가리기 모드와 독립)
  const [indivMasked, setIndivMasked] = useState(false);
  const isBookmarked = bookmarks.has(item.num);
  const s = cardStyles(colors);

  // 개별 가리기 공개 애니메이션 (높이 0 → auto 효과를 opacity+translateY로 구현)
  // 기본값 1(보임) — 가리기 모드가 아니면 뜻이 항상 보이도록 (웹에서 effect 타이밍으로 숨겨지는 버그 방지)
  const revealAnim = useSharedValue(1); // 0=가려짐, 1=공개
  const revealStyle = useAnimatedStyle(() => ({
    opacity: revealAnim.value,
    transform: [{ translateY: interpolate(revealAnim.value, [0, 1], [-8, 0], Extrapolation.CLAMP) }],
  }));

  // maskMode가 꺼지면 revealed 초기화 (개별 가리기 상태에 맞춰 표시)
  useEffect(() => {
    if (!maskMode) {
      setRevealed(false);
      revealAnim.value = indivMasked ? 0 : 1;
    }
  }, [maskMode, indivMasked]);

  // 전체 가리기 모드에서 탭 → 공개
  const handlePress = useCallback(() => {
    if (maskMode) {
      const next = !revealed;
      setRevealed(next);
      if (next) {
        // 공개
        revealAnim.value = withSpring(1, { damping: 18, stiffness: 200 });
        runOnJS(onPlayReveal)();
        if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } else {
        // 다시 가리기
        revealAnim.value = withTiming(0, { duration: 150 });
        runOnJS(onPlayHide)();
        if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } else {
      // 일반 모드: 동의어 펼치기/접기
      setExpanded((v) => !v);
      if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, [maskMode, revealed, onPlayReveal, onPlayHide]);

  // 개별 가리기 토글 (전체 가리기 모드와 무관하게 동작)
  const handleIndivMask = useCallback(
    (e: any) => {
      e.stopPropagation?.();
      const next = !indivMasked;
      setIndivMasked(next);
      if (next) {
        revealAnim.value = withTiming(0, { duration: 150 });
        runOnJS(onPlayHide)();
        if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } else {
        revealAnim.value = withSpring(1, { damping: 18, stiffness: 200 });
        runOnJS(onPlayReveal)();
        if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
    },
    [indivMasked, onPlayHide, onPlayReveal]
  );

  const handleBookmark = useCallback(
    (e: any) => {
      e.stopPropagation?.();
      onToggleBookmark(item.num);
    },
    [item.num, onToggleBookmark]
  );

  // 개별 가리기 초기화 (카드가 처음 마운트될 때 revealAnim 초기화)
  useEffect(() => {
    if (!indivMasked) {
      revealAnim.value = 1; // 기본은 공개 상태
    }
  }, []);

  // 전체 가리기 모드일 때: maskMode && !revealed → 가림
  // 개별 가리기일 때: indivMasked → 가림
  const isMaskedByAll = maskMode && !revealed;
  const isHidden = isMaskedByAll || indivMasked;

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [s.card, pressed && { opacity: 0.85 }]}
    >
      <View style={s.topRow}>
        <View style={s.numBadge}>
          <Text style={s.numText}>{item.num}</Text>
        </View>
        <View style={s.wordArea}>
          <Text
            style={[s.wordText, { fontSize: wordFontSize(item.w) }]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.5}
          >
            {item.w}
          </Text>
          {item.p ? (
            <Text style={[s.ipaText, item.p.length > 16 && { fontSize: 9 }]} numberOfLines={1}>
              {item.p}
            </Text>
          ) : null}
        </View>
        {/* 발음 듣기 */}
        <SpeakerButton text={item.w} size={32} />
        {/* 메모 버튼 */}
        <TouchableOpacity
          onPress={(e) => { e.stopPropagation?.(); onEditMemo(item.num); }}
          style={[s.bookmarkBtn, { marginRight: 2 }]}
          hitSlop={8}
        >
          <Text style={{ fontSize: 16 }}>{memo ? "📝" : "🗒️"}</Text>
        </TouchableOpacity>
        {/* 마스터 버튼 — 누르면 마스터 섹션으로 이동 */}
        <TouchableOpacity
          onPress={(e) => { e.stopPropagation?.(); onToggleMaster(item.num); }}
          style={[s.bookmarkBtn, { marginRight: 2 }]}
          hitSlop={8}
        >
          <Text style={{ fontSize: 18 }}>{isMastered ? "⭐" : "☆"}</Text>
        </TouchableOpacity>
        {/* 개별 가리기 버튼 */}
        <TouchableOpacity
          onPress={handleIndivMask}
          style={[s.bookmarkBtn, { marginRight: 4 }]}
          hitSlop={8}
        >
          <Text style={{ fontSize: 16 }}>{indivMasked ? "🔒" : "🔓"}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleBookmark} style={s.bookmarkBtn} hitSlop={8}>
          <Text style={{ fontSize: 18 }}>{isBookmarked ? "🔖" : "🏷️"}</Text>
        </TouchableOpacity>
      </View>

      {/* 한글 뜻 — 가려진 상태 */}
      {isHidden ? (
        <Pressable
          onPress={handlePress}
          style={s.maskBox}
        >
          <Text style={s.maskHintText}>
            {isMaskedByAll ? "👆 탭하여 뜻 보기" : "🔒 가림 · 🔓 버튼으로 해제"}
          </Text>
        </Pressable>
      ) : (
        <Animated.View style={revealStyle}>
          <Text style={s.korText} numberOfLines={maskMode ? undefined : (expanded ? undefined : 2)}>
            {item.k_short}
          </Text>

          {/* 동의어 (한글뜻 병기) */}
          {(maskMode || expanded) && item.s.length > 0 && (
            <View style={s.synRow}>
              {item.s.map((syn, i) => (
                <View key={i} style={s.synTag}>
                  <Text style={s.synTagText}>{synWithKor(syn)}</Text>
                </View>
              ))}
            </View>
          )}

          {/* 영영 정의 */}
          {(maskMode || expanded) && item.def ? (
            <View style={s.defBox}>
              <Text style={s.defText}>📖 {item.def}</Text>
            </View>
          ) : null}

          {/* 첨언 (어원/뉘앙스) — 왜 이런 뜻인지 이해 보조 */}
          {(maskMode || expanded) && item.etym ? (
            <View style={s.etymBox}>
              <Text style={s.etymText}>💡 {item.etym}</Text>
            </View>
          ) : null}

          {/* 개인 메모 */}
          {memo ? (
            <TouchableOpacity onPress={(e) => { e.stopPropagation?.(); onEditMemo(item.num); }} style={s.memoBox}>
              <Text style={s.memoText}>📝 {memo}</Text>
            </TouchableOpacity>
          ) : null}
        </Animated.View>
      )}

      {/* 힌트 텍스트 */}
      {!maskMode && !indivMasked && (
        <Text style={s.expandHint}>{expanded ? "▲ 접기" : "▼ 동의어 보기"}</Text>
      )}
      {maskMode && !isMaskedByAll && !indivMasked && (
        <Text style={s.expandHint}>👆 탭하여 다시 가리기</Text>
      )}
    </Pressable>
  );
}

const cardStyles = (colors: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 14,
      padding: 14,
      marginHorizontal: 16,
      marginBottom: 10,
    },
    topRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 10,
      marginBottom: 6,
    },
    numBadge: {
      minWidth: 40,
      backgroundColor: colors.primary + "22",
      borderRadius: 8,
      paddingHorizontal: 6,
      paddingVertical: 3,
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
    },
    numText: {
      fontSize: 11,
      fontWeight: "700",
      color: colors.primary,
      fontVariant: ["tabular-nums"],
    },
    wordArea: { flex: 1 },
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
    bookmarkBtn: { padding: 2, flexShrink: 0 },
    korText: {
      fontSize: 13,
      color: colors.muted,
      lineHeight: 19,
      marginBottom: 4,
    },
    // 마스크 박스 — 뜻을 가리는 영역
    maskBox: {
      height: 38,
      borderRadius: 8,
      backgroundColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 4,
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
      backgroundColor: colors.primary + "18",
      borderWidth: 1,
      borderColor: colors.primary + "35",
      borderRadius: 20,
      paddingHorizontal: 9,
      paddingVertical: 3,
    },
    synTagText: { fontSize: 11, color: colors.primary },
    defBox: {
      marginTop: 8,
      paddingHorizontal: 10,
      paddingVertical: 8,
      borderRadius: 8,
      backgroundColor: colors.primary + "12",
      borderLeftWidth: 3,
      borderLeftColor: colors.primary + "88",
    },
    defText: {
      fontSize: 12,
      lineHeight: 18,
      color: colors.muted,
      fontStyle: "italic",
    },
    etymBox: {
      marginTop: 8,
      paddingHorizontal: 10,
      paddingVertical: 8,
      borderRadius: 8,
      backgroundColor: colors.warning + "14",
      borderLeftWidth: 3,
      borderLeftColor: colors.warning + "88",
    },
    etymText: {
      fontSize: 12,
      lineHeight: 18,
      color: colors.muted,
    },
    memoBox: {
      marginTop: 8,
      paddingHorizontal: 10,
      paddingVertical: 8,
      borderRadius: 8,
      backgroundColor: colors.success + "14",
      borderLeftWidth: 3,
      borderLeftColor: colors.success + "88",
    },
    memoText: {
      fontSize: 12,
      lineHeight: 18,
      color: colors.foreground,
    },
    expandHint: {
      fontSize: 10,
      color: colors.muted,
      marginTop: 4,
      textAlign: "right",
    },
  });

// ─── 메인 화면 ────────────────────────────────────────────────────────────────
export default function WordbookScreen() {
  const colors = useColors();

  const [searchQuery, setSearchQuery] = useState("");
  // 검색 디바운스 — 9천 단어 필터링이 매 키입력마다 돌지 않도록 200ms 지연
  const [debouncedQuery, setDebouncedQuery] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(searchQuery), 200);
    return () => clearTimeout(t);
  }, [searchQuery]);
  const [selectedRange, setSelectedRange] = useState(0);
  const [bookmarks, setBookmarks] = useState<Set<number>>(new Set());
  const [showOnlyBookmarks, setShowOnlyBookmarks] = useState(false);
  // 마스터한 단어 — 본목록에서 제외하고 별도 섹션으로
  const [mastered, setMastered] = useState<Set<number>>(new Set());
  const [masterView, setMasterView] = useState(false); // true=마스터 단어만 보기
  // 개인 메모
  const [memos, setMemos] = useState<Record<number, string>>({});
  const [memoEditNum, setMemoEditNum] = useState<number | null>(null);
  const [memoDraft, setMemoDraft] = useState("");
  const [isShuffled, setIsShuffled] = useState(false);
  const [maskMode, setMaskMode] = useState(false);
  const [conceptMode, setConceptMode] = useState(false);
  // 개념별 아코디언 — 펼쳐진 개념 라벨 집합
  const [expandedConcepts, setExpandedConcepts] = useState<Set<string>>(new Set());

  const toggleConcept = useCallback((label: string) => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setExpandedConcepts((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  }, []);

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
      try { hidePlayer.seekTo(0); hidePlayer.play(); } catch {}
    }
  }, [hidePlayer]);

  const playReveal = useCallback(() => {
    if (Platform.OS !== "web") {
      try { revealPlayer.seekTo(0); revealPlayer.play(); } catch {}
    }
  }, [revealPlayer]);

  // 리스트 전환 애니메이션
  const listTranslateX = useSharedValue(0);
  const listOpacity = useSharedValue(1);
  const listAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: listTranslateX.value }],
    opacity: listOpacity.value,
    flex: 1,
  }));

  const slideList = useCallback((direction: 'left' | 'right', onComplete: () => void) => {
    const outX = direction === 'left' ? -40 : 40;
    const inX = direction === 'left' ? 40 : -40;
    listTranslateX.value = withTiming(outX, { duration: 160 });
    listOpacity.value = withTiming(0, { duration: 160 }, () => {
      listTranslateX.value = inX;
      listOpacity.value = 0;
      runOnJS(onComplete)();
      listTranslateX.value = withTiming(0, { duration: 200 });
      listOpacity.value = withTiming(1, { duration: 200 });
    });
  }, [listTranslateX, listOpacity]);

  useEffect(() => {
    loadBookmarks().then((arr) => setBookmarks(new Set(arr)));
    loadMastered().then((arr) => setMastered(new Set(arr)));
    loadMemos().then(setMemos);
  }, []);

  const handleToggleMaster = useCallback(async (num: number) => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const isM = mastered.has(num);
    const updated = isM ? await removeMastered(num) : await addMastered(num);
    setMastered(new Set(updated));
  }, [mastered]);

  const openMemo = useCallback((num: number) => {
    setMemoEditNum(num);
    setMemoDraft(memos[num] ?? "");
  }, [memos]);

  const submitMemo = useCallback(async () => {
    if (memoEditNum == null) return;
    const updated = await saveMemo(memoEditNum, memoDraft);
    setMemos(updated);
    setMemoEditNum(null);
    setMemoDraft("");
  }, [memoEditNum, memoDraft]);

  const handleToggleBookmark = useCallback(async (num: number) => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    const updated = await toggleBookmark(num);
    setBookmarks(new Set(updated));
  }, []);

  const filteredVocab = useMemo(() => {
    const range = RANGE_OPTIONS[selectedRange];
    let list: VocabItem[];
    if (range.isIdiom) {
      list = VOCAB.filter((v) => v.type === "idiom" || v.type === "phrase");
    } else {
      list = VOCAB.slice(range.start, range.end + 1);
    }

    if (showOnlyBookmarks) {
      list = list.filter((v) => bookmarks.has(v.num));
    }

    // 마스터 단어: 마스터 보기면 마스터만, 아니면 본목록에서 제외
    if (masterView) list = list.filter((v) => mastered.has(v.num));
    else if (mastered.size > 0) list = list.filter((v) => !mastered.has(v.num));

    if (searchQuery.trim()) {
      const q = debouncedQuery.trim().toLowerCase();

      // ── 3단계 우선순위 정렬 ────────────────────────────────────────────
      // 0: 단어(w)가 q로 시작  ← 가장 높은 우선순위 (사전식 자동완성)
      // 1: 단어(w) 중간에 q 포함
      // 2: 뜻(k/k_short) 또는 동의어(s)에 q 포함
      // 해당 없으면 결과에서 제외
      type Scored = { item: VocabItem; score: number };
      const scored: Scored[] = [];

      for (const v of list) {
        const wLow = v.w.toLowerCase();
        const kLow = v.k.toLowerCase();
        const ksLow = v.k_short.toLowerCase();
        const synMatch = v.s.some((s) => s.toLowerCase().includes(q));

        if (wLow.startsWith(q)) {
          // 같은 score 0 안에서도 알파벳 순 유지를 위해 소수점 활용
          scored.push({ item: v, score: 0 });
        } else if (wLow.includes(q)) {
          scored.push({ item: v, score: 1 });
        } else if (kLow.includes(q) || ksLow.includes(q) || synMatch) {
          scored.push({ item: v, score: 2 });
        }
        // 매칭 없으면 제외
      }

      // score 오름차순 → 같은 score 내에서는 단어 알파벳 순
      scored.sort((a, b) => {
        if (a.score !== b.score) return a.score - b.score;
        if (a.score === 0) {
          // score 0: q가 단어에서 나타나는 위치(index)가 작을수록 우선 → 같으면 알파벳 순
          const idxA = a.item.w.toLowerCase().indexOf(q);
          const idxB = b.item.w.toLowerCase().indexOf(q);
          if (idxA !== idxB) return idxA - idxB;
          return a.item.w.localeCompare(b.item.w);
        }
        // score 1: 단어 알파벳 순
        if (a.score === 1) return a.item.w.localeCompare(b.item.w);
        // score 2: 원래 번호 순 유지
        return a.item.num - b.item.num;
      });

      list = scored.map((s) => s.item);
    }

    if (isShuffled) {
      list = shuffle(list);
    }

    return list;
  }, [debouncedQuery, selectedRange, bookmarks, showOnlyBookmarks, isShuffled, masterView, mastered]);

  // 개념별 보기 — 사전식 아코디언 (헤더 탭 → 단어 펼침)
  const conceptRows = useMemo<ConceptRow[]>(() => {
    if (!conceptMode) return [];
    const q = debouncedQuery.trim().toLowerCase();
    const searchActive = q.length > 0;
    const rows: ConceptRow[] = [];
    for (const g of CONCEPT_GROUPS) {
      let items = g.nums
        .map((n) => VOCAB_BY_NUM.get(n))
        .filter((v): v is VocabItem => !!v);
      if (showOnlyBookmarks) items = items.filter((v) => bookmarks.has(v.num));
      if (masterView) items = items.filter((v) => mastered.has(v.num));
      else if (mastered.size > 0) items = items.filter((v) => !mastered.has(v.num));
      if (q) {
        items = items.filter(
          (v) =>
            v.w.toLowerCase().includes(q) ||
            v.k.toLowerCase().includes(q) ||
            v.s.some((s) => s.toLowerCase().includes(q))
        );
      }
      if (items.length === 0) continue;
      // 검색 중이면 자동 펼침, 아니면 펼쳐진 개념만 단어 표시 (사전식 인덱스)
      const isOpen = searchActive || expandedConcepts.has(g.label);
      rows.push({
        kind: "header",
        id: `h_${g.label}_${rows.length}`,
        label: g.label,
        kor: g.kor,
        count: items.length,
        isCategory: g.isCategory,
        open: isOpen,
      });
      if (isOpen) {
        for (const v of items) rows.push({ kind: "word", id: `w_${v.num}`, item: v });
      }
    }
    return rows;
  }, [conceptMode, debouncedQuery, showOnlyBookmarks, bookmarks, expandedConcepts, masterView, mastered]);

  const renderItem = useCallback(
    ({ item }: { item: VocabItem }) => (
      <WordCard
        item={item}
        bookmarks={bookmarks}
        onToggleBookmark={handleToggleBookmark}
        colors={colors}
        maskMode={maskMode}
        onPlayHide={playHide}
        onPlayReveal={playReveal}
        isMastered={mastered.has(item.num)}
        onToggleMaster={handleToggleMaster}
        memo={memos[item.num]}
        onEditMemo={openMemo}
      />
    ),
    [bookmarks, handleToggleBookmark, colors, maskMode, playHide, playReveal, mastered, handleToggleMaster, memos, openMemo]
  );

  const keyExtractor = useCallback((item: VocabItem) => String(item.num), []);

  // 개념별 보기 렌더 (헤더 / 단어)
  const renderConceptRow = useCallback(
    ({ item: row }: { item: ConceptRow }) => {
      if (row.kind === "header") {
        const primaryLabel = row.kor && !row.isCategory ? row.kor : row.label;
        const subLabel = row.kor && !row.isCategory ? row.label : "";
        return (
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => toggleConcept(row.label)}
            style={[
              styles.conceptHeader,
              {
                backgroundColor: row.open ? colors.primary + "22" : colors.primary + "10",
                borderColor: row.open ? colors.primary + "66" : colors.primary + "2A",
              },
            ]}
          >
            <Text style={[styles.conceptChevron, { color: colors.primary }]}>
              {row.open ? "▾" : "▸"}
            </Text>
            <Text style={[styles.conceptLabel, { color: colors.primary }]} numberOfLines={1}>
              {row.isCategory ? "🗂 " : ""}
              {primaryLabel}
              {subLabel ? <Text style={[styles.conceptSub, { color: colors.muted }]}>  {subLabel}</Text> : null}
            </Text>
            <Text style={[styles.conceptCount, { color: colors.muted }]}>{row.count}</Text>
          </TouchableOpacity>
        );
      }
      return (
        <WordCard
          item={row.item}
          bookmarks={bookmarks}
          onToggleBookmark={handleToggleBookmark}
          colors={colors}
          maskMode={maskMode}
          onPlayHide={playHide}
          onPlayReveal={playReveal}
          isMastered={mastered.has(row.item.num)}
          onToggleMaster={handleToggleMaster}
          memo={memos[row.item.num]}
          onEditMemo={openMemo}
        />
      );
    },
    [bookmarks, handleToggleBookmark, colors, maskMode, playHide, playReveal, toggleConcept, mastered, handleToggleMaster, memos, openMemo]
  );

  const conceptKeyExtractor = useCallback((row: ConceptRow) => row.id, []);

  const handleShuffle = useCallback(() => {
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

  return (
    <ScreenContainer containerClassName="bg-background">
      {/* 헤더 */}
      <View style={styles.header}>
        <View>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>단어장</Text>
          <Text style={[styles.headerSub, { color: colors.muted }]}>
            총 {VOCAB.length.toLocaleString()}개 단어
          </Text>
        </View>
        {/* 버튼 그룹 */}
        <View style={styles.headerBtns}>
          {/* 뜻 가리기 버튼 */}
          <TouchableOpacity
            style={[
              styles.headerBtn,
              {
                backgroundColor: maskMode ? colors.warning + "22" : colors.surface,
                borderColor: maskMode ? colors.warning : colors.border,
              },
            ]}
            onPress={handleMaskToggle}
          >
            <Text style={[styles.headerBtnText, { color: maskMode ? colors.warning : colors.muted }]}>
              {maskMode ? "🔒 전체 가리기 ON" : "🔓 전체 가리기"}
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
          >
            <Text style={[styles.headerBtnText, { color: isShuffled ? "#fff" : colors.muted }]}>
              🔀 {isShuffled ? "랜덤 ON" : "랜덤"}
            </Text>
          </TouchableOpacity>
          {/* 개념별 보기 버튼 */}
          <TouchableOpacity
            style={[
              styles.headerBtn,
              {
                backgroundColor: conceptMode ? colors.primary : colors.surface,
                borderColor: conceptMode ? colors.primary : colors.border,
              },
            ]}
            onPress={() => {
              setConceptMode((v) => !v);
              if (Platform.OS !== "web") {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              }
            }}
          >
            <Text style={[styles.headerBtnText, { color: conceptMode ? "#fff" : colors.muted }]}>
              🧩 {conceptMode ? "개념별 ON" : "개념별"}
            </Text>
          </TouchableOpacity>
          {/* 마스터 단어 보기 토글 */}
          <TouchableOpacity
            style={[
              styles.headerBtn,
              {
                backgroundColor: masterView ? "#F59E0B" : colors.surface,
                borderColor: masterView ? "#F59E0B" : colors.border,
              },
            ]}
            onPress={() => {
              setMasterView((v) => !v);
              if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            }}
          >
            <Text style={[styles.headerBtnText, { color: masterView ? "#fff" : colors.muted }]}>
              ⭐ 마스터 {mastered.size > 0 ? `(${mastered.size})` : ""}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 마스터 보기 안내 배너 */}
      {masterView && (
        <Animated.View
          entering={FadeIn.duration(200)}
          style={[styles.maskBanner, { backgroundColor: "#F59E0B22", borderColor: "#F59E0B55" }]}
        >
          <Text style={[styles.maskBannerText, { color: "#F59E0B" }]}>
            ⭐ 마스터한 단어 보기 — ☆를 누르면 다시 본목록으로 돌아가요
          </Text>
        </Animated.View>
      )}

      {/* 마스크 모드 안내 배너 */}
      {maskMode && (
        <Animated.View
          entering={FadeIn.duration(200)}
          style={[styles.maskBanner, { backgroundColor: colors.warning + "18", borderColor: colors.warning + "55" }]}
        >
          <Text style={[styles.maskBannerText, { color: colors.warning }]}>
            📖 플래시카드 모드 — 카드를 탭하면 뜻이 보입니다
          </Text>
        </Animated.View>
      )}

      {/* 검색창 + 북마크 필터 */}
      <View style={styles.searchRow}>
        <View style={[styles.searchBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={[styles.searchInput, { color: colors.foreground }]}
            value={searchQuery}
            onChangeText={setSearchQuery}
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
              backgroundColor: showOnlyBookmarks ? colors.primary + "22" : colors.surface,
              borderColor: showOnlyBookmarks ? colors.primary : colors.border,
            },
          ]}
          onPress={() => setShowOnlyBookmarks((v) => !v)}
        >
          <Text style={{ fontSize: 16 }}>🔖</Text>
        </TouchableOpacity>
      </View>

      {/* 단어 목록 — 필터·결과를 리스트 헤더로 넣어 함께 스크롤(통일감) */}
      {conceptMode ? (
        <FlatList
          data={conceptRows}
          keyExtractor={conceptKeyExtractor}
          renderItem={renderConceptRow}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          initialNumToRender={25}
          maxToRenderPerBatch={25}
          windowSize={10}
          removeClippedSubviews={Platform.OS !== "web"}
          ListHeaderComponent={
            <View style={styles.conceptInfoRow}>
              <Text style={[styles.resultText, { color: colors.muted, flex: 1 }]}>
                🧩 뜻을 탭하면 펼쳐져요 · {CONCEPT_GROUPS.length.toLocaleString()}개 개념
              </Text>
              <TouchableOpacity
                onPress={() => {
                  if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setExpandedConcepts((prev) =>
                    prev.size > 0 ? new Set() : new Set(CONCEPT_GROUPS.map((g) => g.label))
                  );
                }}
                style={[styles.expandAllBtn, { borderColor: colors.border }]}
              >
                <Text style={[styles.expandAllText, { color: colors.primary }]}>
                  {expandedConcepts.size > 0 ? "모두 접기" : "모두 펼치기"}
                </Text>
              </TouchableOpacity>
            </View>
          }
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Text style={styles.emptyIcon}>📭</Text>
              <Text style={[styles.emptyText, { color: colors.muted }]}>
                검색 결과가 없습니다
              </Text>
            </View>
          }
        />
      ) : (
        <FlatList
          data={filteredVocab}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          initialNumToRender={20}
          maxToRenderPerBatch={20}
          windowSize={10}
          removeClippedSubviews={Platform.OS !== "web"}
          ListHeaderComponent={
            <View>
              {/* 구간 필터 (리스트와 함께 스크롤) */}
              <View style={styles.rangeWrapper}>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.rangeContent}
                  keyboardShouldPersistTaps="handled"
                  bounces={false}
                >
                  {RANGE_OPTIONS.map((item, index) => (
                    <TouchableOpacity
                      key={index}
                      activeOpacity={0.7}
                      style={[
                        styles.rangeChip,
                        {
                          backgroundColor: selectedRange === index ? colors.primary : colors.surface,
                          borderColor: selectedRange === index ? colors.primary : colors.border,
                        },
                      ]}
                      onPress={() => {
                        if (index === selectedRange) return;
                        if (Platform.OS !== "web") {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        }
                        setSelectedRange(index);
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
                        {item.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
              {/* 결과 수 */}
              <View style={styles.resultRow}>
                <Text style={[styles.resultText, { color: colors.muted }]}>
                  {filteredVocab.length.toLocaleString()}개
                  {debouncedQuery ? ` · "${debouncedQuery}" 검색 결과` : ""}
                  {showOnlyBookmarks ? " · 북마크만" : ""}
                  {isShuffled ? " · 랜덤 순서" : ""}
                  {maskMode ? " · 플래시카드 모드" : ""}
                </Text>
              </View>
            </View>
          }
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Text style={styles.emptyIcon}>📭</Text>
              <Text style={[styles.emptyText, { color: colors.muted }]}>
                {debouncedQuery ? "검색 결과가 없습니다" : "단어가 없습니다"}
              </Text>
            </View>
          }
        />
      )}

      {/* 개인 메모 편집 모달 */}
      <Modal visible={memoEditNum != null} transparent animationType="fade" onRequestClose={() => setMemoEditNum(null)}>
        <Pressable style={styles.memoBackdrop} onPress={() => setMemoEditNum(null)}>
          <Pressable
            style={[styles.memoSheet, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={(e) => e.stopPropagation?.()}
          >
            <Text style={[styles.memoTitle, { color: colors.foreground }]}>
              📝 {memoEditNum != null ? VOCAB_BY_NUM.get(memoEditNum)?.w : ""} — 내 메모
            </Text>
            <TextInput
              style={[styles.memoInput, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
              value={memoDraft}
              onChangeText={setMemoDraft}
              placeholder="이 단어에 대한 나만의 메모를 적어보세요"
              placeholderTextColor={colors.muted}
              multiline
              autoFocus
            />
            <View style={styles.memoBtnRow}>
              <TouchableOpacity style={[styles.memoBtn, { borderColor: colors.border }]} onPress={() => setMemoEditNum(null)}>
                <Text style={[styles.memoBtnText, { color: colors.muted }]}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.memoBtn, { backgroundColor: colors.primary, borderColor: colors.primary }]} onPress={submitMemo}>
                <Text style={[styles.memoBtnText, { color: "#fff" }]}>저장</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  conceptHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginHorizontal: 16,
    marginTop: 14,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  conceptInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 6,
    gap: 8,
  },
  expandAllBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
  },
  expandAllText: {
    fontSize: 11,
    fontWeight: "700",
  },
  memoBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    padding: 24,
  },
  memoSheet: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 20,
  },
  memoTitle: { fontSize: 15, fontWeight: "800", marginBottom: 12 },
  memoInput: {
    minHeight: 90,
    borderWidth: 1.5,
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    textAlignVertical: "top",
  },
  memoBtnRow: { flexDirection: "row", gap: 10, marginTop: 14 },
  memoBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
  },
  memoBtnText: { fontSize: 13, fontWeight: "700" },
  conceptChevron: {
    fontSize: 13,
    fontWeight: "800",
    marginRight: 8,
  },
  conceptLabel: {
    fontSize: 15,
    fontWeight: "800",
    flex: 1,
  },
  conceptSub: {
    fontSize: 12,
    fontWeight: "600",
  },
  conceptCount: {
    fontSize: 11,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  headerSub: {
    fontSize: 12,
    marginTop: 2,
  },
  headerBtns: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  headerBtn: {
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  headerBtnText: {
    fontSize: 12,
    fontWeight: "600",
  },
  // 마스크 모드 안내 배너
  maskBanner: {
    marginHorizontal: 16,
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
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 10,
  },
  searchBox: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === "ios" ? 10 : 6,
    gap: 8,
  },
  searchIcon: { fontSize: 15 },
  searchInput: {
    flex: 1,
    fontSize: 14,
    padding: 0,
  },
  iconBtn: {
    width: 42,
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  // ★ 핵심 수정: 구간 필터를 독립 View로 감싸서 높이를 명시적으로 확보
  rangeWrapper: {
    height: 46,
    marginBottom: 2,
  },
  rangeContent: {
    paddingHorizontal: 16,
    gap: 6,
    alignItems: "center",
    height: 46,
  },
  rangeChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  rangeChipText: {
    fontSize: 12,
  },
  resultRow: {
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: 6,
  },
  resultText: { fontSize: 11 },
  listContent: {
    paddingTop: 4,
    paddingBottom: 32,
  },
  emptyBox: {
    alignItems: "center",
    paddingTop: 80,
    gap: 12,
  },
  emptyIcon: { fontSize: 40 },
  emptyText: { fontSize: 14 },
});
