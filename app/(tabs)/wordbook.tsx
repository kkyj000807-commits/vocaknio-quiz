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
import { PronunciationButton } from "@/components/pronunciation-button";
import { IconSymbol } from "@/components/ui/icon-symbol";
import {
  getRangeItems,
  RANGES,
  VOCAB,
  type VocabItem,
} from "@/lib/vocab";
import { loadBookmarks, toggleBookmark } from "@/lib/store";
import { useColors } from "@/hooks/use-colors";
import * as Haptics from "expo-haptics";
import { useAudioPlayer, setAudioModeAsync } from "expo-audio";

const RANGE_OPTIONS = [
  ...RANGES.filter((range) => range.kind === "all"),
  ...RANGES.filter((range) => range.kind === "section"),
  ...RANGES.filter((range) => range.kind === "idioms"),
];

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
  // 전체 가리기 모드에서 개별 공개 여부
  const [revealed, setRevealed] = useState(false);
  // 개별 가리기 (전체 가리기 모드와 독립)
  const [indivMasked, setIndivMasked] = useState(false);
  const isBookmarked = bookmarks.has(item.num);
  const s = cardStyles(colors);

  // 개별 가리기 공개 애니메이션 (높이 0 → auto 효과를 opacity+translateY로 구현)
  const revealAnim = useSharedValue(0); // 0=가려짐, 1=공개
  const revealStyle = useAnimatedStyle(() => ({
    opacity: revealAnim.value,
    transform: [{ translateY: interpolate(revealAnim.value, [0, 1], [-8, 0], Extrapolation.CLAMP) }],
  }));

  // maskMode가 꺼지면 revealed 초기화
  useEffect(() => {
    if (!maskMode) {
      setRevealed(false);
      revealAnim.value = 0;
    }
  }, [maskMode]);

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
          <Text style={s.wordText}>{item.w}</Text>
          {item.p ? <Text style={s.ipaText}>{item.p}</Text> : null}
        </View>
        <PronunciationButton text={item.w} style={{ marginRight: 4 }} />
        {/* 개별 가리기 버튼 */}
        <TouchableOpacity
          onPress={handleIndivMask}
          style={[s.bookmarkBtn, { marginRight: 4 }]}
          hitSlop={8}
        >
          <IconSymbol
            name={indivMasked ? "lock.fill" : "lock.open.fill"}
            size={17}
            color={indivMasked ? colors.warning : colors.muted}
          />
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
            {isMaskedByAll ? "탭하여 뜻 보기" : "개별 가리기 중 · 잠금 버튼으로 해제"}
          </Text>
        </Pressable>
      ) : (
        <Animated.View style={revealStyle}>
          <Text style={s.korText} numberOfLines={maskMode ? undefined : (expanded ? undefined : 2)}>
            {item.k_short}
          </Text>

          {/* 동의어 */}
          {(maskMode || expanded) && item.s.length > 0 && (
            <View style={s.synRow}>
              {item.s.map((syn, i) => (
                <View key={i} style={s.synTag}>
                  <Text style={s.synTagText}>{syn}</Text>
                </View>
              ))}
            </View>
          )}
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
  const [selectedRange, setSelectedRange] = useState(0);
  const [bookmarks, setBookmarks] = useState<Set<number>>(new Set());
  const [showOnlyBookmarks, setShowOnlyBookmarks] = useState(false);
  const [isShuffled, setIsShuffled] = useState(false);
  const [maskMode, setMaskMode] = useState(false);

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
    [bookmarks, handleToggleBookmark, colors, maskMode, playHide, playReveal]
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
            <IconSymbol
              name={maskMode ? "lock.fill" : "lock.open.fill"}
              size={15}
              color={maskMode ? colors.warning : colors.muted}
            />
            <Text style={[styles.headerBtnText, { color: maskMode ? colors.warning : colors.muted }]}>
              {maskMode ? "전체 가리기 ON" : "전체 가리기"}
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
        </View>
      </View>

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

      {/* 구간 필터 — 독립적인 View로 높이 고정 */}
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
                // 카테고리 번호가 올라가면 오른쪽에서, 내려가면 왼쪽에서 진입
                const direction = index > selectedRange ? 'left' : 'right';
                slideList(direction, () => setSelectedRange(index));
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
      </View>

      {/* 단어 목록 */}
      <Animated.View style={listAnimStyle}>
        <FlatList
          data={filteredVocab}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
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
      </Animated.View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
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
