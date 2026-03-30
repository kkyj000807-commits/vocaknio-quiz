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
import Animated, { FadeIn, useSharedValue, useAnimatedStyle, withTiming, runOnJS } from "react-native-reanimated";

import { ScreenContainer } from "@/components/screen-container";
import { VOCAB, VocabItem } from "@/lib/vocab";
import { loadBookmarks, toggleBookmark } from "@/lib/store";
import { useColors } from "@/hooks/use-colors";
import * as Haptics from "expo-haptics";

const RANGE_OPTIONS = [
  { label: "전체", start: 0, end: VOCAB.length - 1, isIdiom: false },
  { label: "1~1000", start: 0, end: 999, isIdiom: false },
  { label: "1001~2000", start: 1000, end: 1999, isIdiom: false },
  { label: "2001~3000", start: 2000, end: 2999, isIdiom: false },
  { label: "3001~4000", start: 3000, end: 3999, isIdiom: false },
  { label: "4001~5000", start: 4000, end: 4999, isIdiom: false },
  { label: "5001~6000", start: 5000, end: 5999, isIdiom: false },
  { label: "6001~7000", start: 6000, end: 6999, isIdiom: false },
  { label: "7001~8000", start: 7000, end: 7999, isIdiom: false },
  { label: "8001~9517", start: 8000, end: VOCAB.length - 1, isIdiom: false },
  { label: "숙어·표현", start: 0, end: VOCAB.length - 1, isIdiom: true },
];

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
}: {
  item: VocabItem;
  bookmarks: Set<number>;
  onToggleBookmark: (num: number) => void;
  colors: ReturnType<typeof useColors>;
  maskMode: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  // 마스크 모드에서 개별 카드의 공개 여부
  const [revealed, setRevealed] = useState(false);
  const isBookmarked = bookmarks.has(item.num);
  const s = cardStyles(colors);

  // maskMode가 꺼지면 revealed 초기화
  useEffect(() => {
    if (!maskMode) setRevealed(false);
  }, [maskMode]);

  const handlePress = useCallback(() => {
    if (maskMode) {
      // 마스크 모드: 탭으로 뜻 공개/가리기 토글
      setRevealed((v) => !v);
    } else {
      // 일반 모드: 동의어 펼치기/접기
      setExpanded((v) => !v);
    }
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, [maskMode]);

  const handleBookmark = useCallback(
    (e: any) => {
      e.stopPropagation?.();
      onToggleBookmark(item.num);
    },
    [item.num, onToggleBookmark]
  );

  const isMasked = maskMode && !revealed;

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
        <TouchableOpacity onPress={handleBookmark} style={s.bookmarkBtn} hitSlop={8}>
          <Text style={{ fontSize: 18 }}>{isBookmarked ? "🔖" : "🏷️"}</Text>
        </TouchableOpacity>
      </View>

      {/* 한글 뜻 — 마스크 모드에서 가리기 */}
      {isMasked ? (
        <View style={s.maskBox}>
          <Text style={s.maskHintText}>👆 탭하여 뜻 보기</Text>
        </View>
      ) : (
        <>
          <Text style={s.korText} numberOfLines={maskMode ? undefined : (expanded ? undefined : 2)}>
            {item.k_short}
          </Text>

          {/* 동의어 — 마스크 해제 시 항상 표시, 일반 모드는 expanded일 때만 */}
          {(maskMode || expanded) && item.s.length > 0 && (
            <Animated.View entering={FadeIn.duration(180)} style={s.synRow}>
              {item.s.map((syn, i) => (
                <View key={i} style={s.synTag}>
                  <Text style={s.synTagText}>{syn}</Text>
                </View>
              ))}
            </Animated.View>
          )}
        </>
      )}

      {/* 힌트 텍스트 */}
      {!maskMode && (
        <Text style={s.expandHint}>{expanded ? "▲ 접기" : "▼ 동의어 보기"}</Text>
      )}
      {maskMode && !isMasked && (
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
    let list: VocabItem[];
    if (range.isIdiom) {
      list = VOCAB.filter((v) => v.type === "idiom" || v.type === "phrase");
    } else {
      list = VOCAB.slice(range.start, range.end + 1);
    }

    if (showOnlyBookmarks) {
      list = list.filter((v) => bookmarks.has(v.num));
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(
        (v) =>
          v.w.toLowerCase().includes(q) ||
          v.k.toLowerCase().includes(q) ||
          v.k_short.toLowerCase().includes(q) ||
          v.s.some((s) => s.toLowerCase().includes(q))
      );
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
      />
    ),
    [bookmarks, handleToggleBookmark, colors, maskMode]
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
            <Text style={[styles.headerBtnText, { color: maskMode ? colors.warning : colors.muted }]}>
              {maskMode ? "👁 가리기 ON" : "👁 가리기"}
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
              key={index}
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
