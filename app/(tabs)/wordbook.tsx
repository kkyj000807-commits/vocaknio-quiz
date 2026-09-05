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
  interpolate,
  Extrapolation,
} from "react-native-reanimated";
import { useRouter } from "expo-router";

import { ScreenContainer } from "@/components/screen-container";
import { PronunciationButton } from "@/components/pronunciation-button";
import { LearningDetails } from "@/components/learning-details";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { getRangeItems, WORDBOOK_RANGES, VOCAB, type VocabItem } from "@/lib/vocab";
import {
  loadBookmarks,
  loadQuizSettings,
  toggleBookmark,
  type ChoiceLang,
} from "@/lib/store";
import { useColors } from "@/hooks/use-colors";
import * as Haptics from "expo-haptics";
import { useAudioPlayer, setAudioModeAsync } from "expo-audio";

const RANGE_OPTIONS = WORDBOOK_RANGES;

function getRangeChipLabel(range: (typeof RANGE_OPTIONS)[number]) {
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

// ─── 단어 카드 ────────────────────────────────────────────────────────────────
function WordCard({
  item,
  bookmarks,
  onToggleBookmark,
  colors,
  maskMode,
  onPlayHide,
  onPlayReveal,
}: {
  item: VocabItem;
  bookmarks: Set<number>;
  onToggleBookmark: (num: number) => void;
  colors: ReturnType<typeof useColors>;
  maskMode: boolean;
  onPlayHide: () => void;
  onPlayReveal: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [meaningHidden, setMeaningHidden] = useState(maskMode);
  const isBookmarked = bookmarks.has(item.num);
  const s = cardStyles(colors);

  // 상태는 즉시 바꾸고 회전은 표시 효과만 담당해 Safari에서도 멈추지 않습니다.
  const flipRotation = useSharedValue(0);
  const meaningFlipStyle = useAnimatedStyle(() => ({
    transform: [{ perspective: 900 }, { rotateY: `${flipRotation.value}deg` }],
    opacity: interpolate(
      Math.abs(flipRotation.value),
      [0, 74, 82],
      [1, 0.35, 0],
      Extrapolation.CLAMP,
    ),
    backfaceVisibility: "hidden",
  }));

  const handleMeaningPress = useCallback(() => {
    const nextHidden = !meaningHidden;
    setMeaningHidden(nextHidden);
    flipRotation.value = nextHidden ? 82 : -82;
    flipRotation.value = withTiming(0, { duration: 190 });
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
      onToggleBookmark(item.num);
    },
    [item.num, onToggleBookmark],
  );

  return (
    <View style={s.card}>
      <View style={s.topRow}>
        <View style={s.numBadge}>
          <Text style={s.numText}>{item.num}</Text>
        </View>
        <View style={s.wordArea}>
          <Text style={s.wordText}>{item.w}</Text>
          {item.p ? <Text style={s.ipaText}>{item.p}</Text> : null}
        </View>
        <PronunciationButton itemId={item.id} text={item.w} compact style={{ marginRight: 2 }} />
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={`${item.w} ${isBookmarked ? "북마크 해제" : "북마크 추가"}`}
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
              <Text style={s.korText} numberOfLines={expanded ? undefined : 2}>
                {item.k_short}
              </Text>
              {expanded && item.s.length > 0 && (
                <View style={s.synRow}>
                  {item.s.map((syn, i) => (
                    <View key={`${item.num}-${syn}-${i}`} style={s.synTag}>
                      <Text style={s.synTagText}>{syn}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}
        </Animated.View>
      </Pressable>

      {!meaningHidden && item.s.length > 0 && (
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
      {!meaningHidden && <LearningDetails itemId={item.id} />}
    </View>
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
      alignItems: "center",
      gap: 10,
      marginBottom: 8,
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
    bookmarkBtn: {
      width: 44,
      height: 44,
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
    },
    korText: {
      fontSize: 13,
      color: colors.muted,
      lineHeight: 19,
    },
    meaningTouch: {
      minHeight: 48,
      borderRadius: 9,
      justifyContent: "center",
      overflow: "hidden",
    },
    meaningTouchPressed: {
      opacity: 0.78,
    },
    meaningFace: {
      minHeight: 48,
      justifyContent: "center",
      paddingHorizontal: 2,
      paddingVertical: 5,
    },
    // 마스크 박스 — 뜻을 가리는 영역
    maskBox: {
      minHeight: 48,
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
  const router = useRouter();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRange, setSelectedRange] = useState(0);
  const [bookmarks, setBookmarks] = useState<Set<number>>(new Set());
  const [showOnlyBookmarks, setShowOnlyBookmarks] = useState(false);
  const [isShuffled, setIsShuffled] = useState(false);
  const [maskMode, setMaskMode] = useState(false);
  const [choiceLang, setChoiceLang] = useState<ChoiceLang>("korean");

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

  useEffect(() => {
    loadBookmarks().then((arr) => setBookmarks(new Set(arr)));
    loadQuizSettings().then((settings) => setChoiceLang(settings.choiceLang));
  }, []);

  const handleToggleBookmark = useCallback(async (num: number) => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    const updated = await toggleBookmark(num);
    setBookmarks(new Set(updated));
  }, []);

  const filteredVocab = useMemo(() => {
    const range = RANGE_OPTIONS[selectedRange];
    let list: VocabItem[] = getRangeItems(range);

    if (showOnlyBookmarks) {
      list = list.filter((v) => bookmarks.has(v.num));
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();

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
  }, [searchQuery, selectedRange, bookmarks, showOnlyBookmarks, isShuffled]);

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
      />
    ),
    [bookmarks, handleToggleBookmark, colors, maskMode, playHide, playReveal],
  );

  const keyExtractor = useCallback((item: VocabItem) => String(item.num), []);

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

  const activeRange = RANGE_OPTIONS[selectedRange];
  const directProblemCount = Math.min(10, activeRange?.count ?? 0);

  const handleStartRangeProblems = useCallback(() => {
    const range = RANGE_OPTIONS[selectedRange];
    if (!range || range.count === 0) return;
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    router.push({
      pathname: "/quiz",
      params: {
        mode: "syn-choice",
        rangeStart: range.start,
        rangeEnd: range.end,
        count: Math.min(10, range.count),
        rangeId: range.id,
        choiceLang,
      },
    });
  }, [choiceLang, router, selectedRange]);

  const listHeader = (
    <>
      {/* 헤더 */}
      <View style={styles.header}>
        <View>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>
            단어장
          </Text>
          <Text style={[styles.headerSub, { color: colors.muted }]}>
            총 {VOCAB.length.toLocaleString()}개 단어
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
              {maskMode ? "카드 학습 ON" : "전체 뜻 가리기"}
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
              backgroundColor: showOnlyBookmarks
                ? colors.primary + "22"
                : colors.surface,
              borderColor: showOnlyBookmarks ? colors.primary : colors.border,
            },
          ]}
          onPress={() => setShowOnlyBookmarks((v) => !v)}
        >
          <Text style={{ fontSize: 16 }}>🔖</Text>
        </TouchableOpacity>
      </View>

      {/* 구간 필터 — 독립적인 View로 높이 고정 */}
      <View style={styles.rangeWrapper}>
        <ScrollView
          horizontal
          style={
            Platform.OS === "web"
              ? ({ touchAction: "pan-x pan-y" } as any)
              : undefined
          }
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.rangeContent}
          keyboardShouldPersistTaps="handled"
          directionalLockEnabled
          nestedScrollEnabled
        >
          {RANGE_OPTIONS.map((item, index) => (
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
                {getRangeChipLabel(item)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* 결과 수 */}
      <View style={styles.resultRow}>
        <Text style={[styles.resultText, { color: colors.muted }]}>
          {filteredVocab.length.toLocaleString()}개
          {searchQuery ? ` · "${searchQuery}" 검색 결과` : ""}
          {showOnlyBookmarks ? " · 북마크만" : ""}
          {isShuffled ? " · 랜덤 순서" : ""}
          {maskMode ? " · 플래시카드 모드" : ""}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${activeRange?.label ?? "선택 범위"}에서 ${directProblemCount}문제 풀기`}
          disabled={directProblemCount === 0}
          onPress={handleStartRangeProblems}
          style={({ pressed }) => [
            styles.directProblemButton,
            { backgroundColor: colors.primary },
            pressed && { opacity: 0.78, transform: [{ scale: 0.98 }] },
            directProblemCount === 0 && { opacity: 0.45 },
          ]}
        >
          <IconSymbol name="play.fill" size={15} color="#fff" />
          <Text style={styles.directProblemButtonText}>
            {directProblemCount}문제 풀기
          </Text>
        </Pressable>
      </View>
    </>
  );

  return (
    <ScreenContainer containerClassName="bg-background">
      <FlatList
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
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 11,
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
    width: 44,
    height: 44,
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
    minHeight: 44,
    justifyContent: "center",
    borderRadius: 20,
    borderWidth: 1,
  },
  rangeChipText: {
    fontSize: 12,
  },
  resultRow: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: 6,
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
