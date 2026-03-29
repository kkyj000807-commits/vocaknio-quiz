import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  TextInput,
  Pressable,
  StyleSheet,
  Platform,
  TouchableOpacity,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  FadeIn,
  FadeOut,
  Layout,
} from "react-native-reanimated";

import { ScreenContainer } from "@/components/screen-container";
import { VOCAB, VocabItem } from "@/lib/vocab";
import { loadBookmarks, toggleBookmark } from "@/lib/store";
import { useColors } from "@/hooks/use-colors";
import * as Haptics from "expo-haptics";

const RANGE_OPTIONS = [
  { label: "전체", start: 0, end: VOCAB.length - 1 },
  { label: "1~1000", start: 0, end: 999 },
  { label: "1001~2000", start: 1000, end: 1999 },
  { label: "2001~3000", start: 2000, end: 2999 },
  { label: "3001~4000", start: 3000, end: 3999 },
  { label: "4001~5000", start: 4000, end: 4999 },
  { label: "5001~6000", start: 5000, end: 5999 },
  { label: "6001~7000", start: 6000, end: 6999 },
  { label: "7001~끝", start: 7000, end: VOCAB.length - 1 },
];

// 단어 카드 (접기/펼치기)
function WordCard({
  item,
  bookmarks,
  onToggleBookmark,
  colors,
}: {
  item: VocabItem;
  bookmarks: Set<number>;
  onToggleBookmark: (num: number) => void;
  colors: ReturnType<typeof useColors>;
}) {
  const [expanded, setExpanded] = useState(false);
  const isBookmarked = bookmarks.has(item.num);
  const s = cardStyles(colors);

  const handlePress = useCallback(() => {
    setExpanded((v) => !v);
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, []);

  const handleBookmark = useCallback(
    (e: any) => {
      e.stopPropagation?.();
      onToggleBookmark(item.num);
    },
    [item.num, onToggleBookmark]
  );

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [s.card, pressed && { opacity: 0.85 }]}
    >
      {/* 상단 행: 번호 + 단어 + 북마크 */}
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

      {/* 한국어 뜻 (항상 표시) */}
      <Text style={s.korText} numberOfLines={expanded ? undefined : 2}>
        {item.k_short}
      </Text>

      {/* 펼쳐진 상태: 동의어 태그 */}
      {expanded && item.s.length > 0 && (
        <Animated.View entering={FadeIn.duration(180)} style={s.synRow}>
          {item.s.map((syn, i) => (
            <View key={i} style={s.synTag}>
              <Text style={s.synTagText}>{syn}</Text>
            </View>
          ))}
        </Animated.View>
      )}

      {/* 펼치기 힌트 */}
      <Text style={s.expandHint}>{expanded ? "▲ 접기" : "▼ 동의어 보기"}</Text>
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
    wordArea: {
      flex: 1,
    },
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
      padding: 2,
      flexShrink: 0,
    },
    korText: {
      fontSize: 13,
      color: colors.muted,
      lineHeight: 19,
      marginBottom: 4,
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
    synTagText: {
      fontSize: 11,
      color: colors.primary,
    },
    expandHint: {
      fontSize: 10,
      color: colors.dim,
      marginTop: 4,
      textAlign: "right",
    },
  });

// ─── 메인 화면 ───────────────────────────────────────────────────────────────
export default function WordbookScreen() {
  const colors = useColors();
  const s = styles(colors);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRange, setSelectedRange] = useState(0); // 0 = 전체
  const [bookmarks, setBookmarks] = useState<Set<number>>(new Set());
  const [showOnlyBookmarks, setShowOnlyBookmarks] = useState(false);

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

  // 필터링된 단어 목록
  const filteredVocab = useMemo(() => {
    const range = RANGE_OPTIONS[selectedRange];
    let list = VOCAB.slice(range.start, range.end + 1);

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

    return list;
  }, [searchQuery, selectedRange, bookmarks, showOnlyBookmarks]);

  const renderItem = useCallback(
    ({ item }: { item: VocabItem }) => (
      <WordCard
        item={item}
        bookmarks={bookmarks}
        onToggleBookmark={handleToggleBookmark}
        colors={colors}
      />
    ),
    [bookmarks, handleToggleBookmark, colors]
  );

  const keyExtractor = useCallback((item: VocabItem) => String(item.num), []);

  return (
    <ScreenContainer containerClassName="bg-background">
      {/* 헤더 */}
      <View style={s.header}>
        <Text style={s.headerTitle}>단어장</Text>
        <Text style={s.headerSub}>총 {VOCAB.length.toLocaleString()}개 단어</Text>
      </View>

      {/* 검색창 */}
      <View style={s.searchRow}>
        <View style={s.searchBox}>
          <Text style={s.searchIcon}>🔍</Text>
          <TextInput
            style={s.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="단어, 뜻, 동의어 검색..."
            placeholderTextColor={colors.dim}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
        </View>
        <TouchableOpacity
          style={[s.bookmarkFilterBtn, showOnlyBookmarks && s.bookmarkFilterActive]}
          onPress={() => setShowOnlyBookmarks((v) => !v)}
        >
          <Text style={{ fontSize: 16 }}>🔖</Text>
        </TouchableOpacity>
      </View>

      {/* 범위 필터 */}
      <FlatList
        horizontal
        data={RANGE_OPTIONS}
        keyExtractor={(_, i) => String(i)}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.rangeList}
        renderItem={({ item, index }) => (
          <Pressable
            style={[s.rangeChip, selectedRange === index && s.rangeChipActive]}
            onPress={() => {
              setSelectedRange(index);
              if (Platform.OS !== "web") {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }
            }}
          >
            <Text
              style={[
                s.rangeChipText,
                selectedRange === index && s.rangeChipTextActive,
              ]}
            >
              {item.label}
            </Text>
          </Pressable>
        )}
        style={s.rangeScroll}
      />

      {/* 결과 수 */}
      <View style={s.resultRow}>
        <Text style={s.resultText}>
          {filteredVocab.length.toLocaleString()}개
          {searchQuery ? ` · "${searchQuery}" 검색 결과` : ""}
          {showOnlyBookmarks ? " · 북마크만" : ""}
        </Text>
      </View>

      {/* 단어 목록 */}
      <FlatList
        data={filteredVocab}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        contentContainerStyle={s.listContent}
        showsVerticalScrollIndicator={false}
        initialNumToRender={20}
        maxToRenderPerBatch={20}
        windowSize={10}
        removeClippedSubviews={Platform.OS !== "web"}
        ListEmptyComponent={
          <View style={s.emptyBox}>
            <Text style={s.emptyIcon}>📭</Text>
            <Text style={s.emptyText}>
              {searchQuery ? "검색 결과가 없습니다" : "단어가 없습니다"}
            </Text>
          </View>
        }
      />
    </ScreenContainer>
  );
}

const styles = (colors: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    header: {
      paddingHorizontal: 20,
      paddingTop: 20,
      paddingBottom: 12,
    },
    headerTitle: {
      fontSize: 28,
      fontWeight: "800",
      color: colors.foreground,
      letterSpacing: -0.5,
    },
    headerSub: {
      fontSize: 12,
      color: colors.dim,
      marginTop: 2,
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
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: Platform.OS === "ios" ? 10 : 6,
      gap: 8,
    },
    searchIcon: {
      fontSize: 15,
    },
    searchInput: {
      flex: 1,
      fontSize: 14,
      color: colors.foreground,
      padding: 0,
    },
    bookmarkFilterBtn: {
      width: 42,
      height: 42,
      borderRadius: 12,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
    },
    bookmarkFilterActive: {
      backgroundColor: colors.primary + "22",
      borderColor: colors.primary,
    },
    rangeScroll: {
      flexGrow: 0,
    },
    rangeList: {
      paddingHorizontal: 16,
      gap: 6,
      paddingBottom: 4,
    },
    rangeChip: {
      paddingHorizontal: 14,
      paddingVertical: 7,
      borderRadius: 20,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    rangeChipActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    rangeChipText: {
      fontSize: 12,
      fontWeight: "600",
      color: colors.muted,
    },
    rangeChipTextActive: {
      color: "#fff",
    },
    resultRow: {
      paddingHorizontal: 20,
      paddingTop: 10,
      paddingBottom: 6,
    },
    resultText: {
      fontSize: 11,
      color: colors.dim,
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
    emptyIcon: {
      fontSize: 40,
    },
    emptyText: {
      fontSize: 15,
      color: colors.dim,
    },
  });
