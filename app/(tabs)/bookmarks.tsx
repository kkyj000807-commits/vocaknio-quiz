import { useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  Platform,
  Alert,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";

import { ScreenContainer } from "@/components/screen-container";
import { SpeakerButton } from "@/components/speaker-button";
import { VOCAB, type VocabItem } from "@/lib/vocab";
import { loadBookmarks, toggleBookmark } from "@/lib/store";
import { useColors } from "@/hooks/use-colors";

export default function BookmarksScreen() {
  const colors = useColors();
  const router = useRouter();
  const [bookmarkNums, setBookmarkNums] = useState<number[]>([]);

  useFocusEffect(
    useCallback(() => {
      loadBookmarks().then(setBookmarkNums);
    }, [])
  );

  const bookmarkedItems = bookmarkNums
    .map((num) => VOCAB.find((v) => v.num === num))
    .filter(Boolean) as VocabItem[];

  const haptic = () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const handleRemoveBookmark = useCallback(async (num: number) => {
    haptic();
    const updated = await toggleBookmark(num);
    setBookmarkNums(updated);
  }, []);

  const handleStartQuiz = useCallback(() => {
    haptic();
    if (bookmarkedItems.length === 0) return;
    // Navigate to quiz with bookmark mode
    router.push({
      pathname: "/quiz",
      params: {
        mode: "syn-choice",
        rangeStart: 0,
        rangeEnd: VOCAB.length - 1,
        count: Math.min(bookmarkedItems.length, 20),
        bookmarkNums: bookmarkNums.join(","),
      },
    });
  }, [bookmarkedItems, bookmarkNums, router]);

  const s = styles(colors);

  const renderItem = ({ item }: { item: VocabItem }) => (
    <View style={s.wordCard}>
      <View style={s.wordCardHeader}>
        <View style={s.wordInfo}>
          <Text style={s.wordText}>{item.w}</Text>
          {item.p ? <Text style={s.ipaText}>{item.p}</Text> : null}
        </View>
        <SpeakerButton text={item.w} size={32} />
        <Pressable
          style={s.removeBtn}
          onPress={() => handleRemoveBookmark(item.num)}
        >
          <Text style={{ fontSize: 18 }}>🔖</Text>
        </Pressable>
      </View>
      <Text style={s.korText} numberOfLines={2}>
        {item.k_short}
      </Text>
      {item.s.length > 0 && (
        <View style={s.synTagRow}>
          {item.s.slice(0, 4).map((syn, i) => (
            <View key={i} style={s.synTag}>
              <Text style={s.synTagText}>{syn}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );

  return (
    <ScreenContainer containerClassName="bg-background">
      {/* Header */}
      <View style={s.header}>
        <View>
          <Text style={s.headerTitle}>북마크</Text>
          <Text style={s.headerSub}>{bookmarkedItems.length}개 단어 저장됨</Text>
        </View>
        {bookmarkedItems.length > 0 && (
          <Pressable
            style={({ pressed }) => [s.quizBtn, pressed && { opacity: 0.85 }]}
            onPress={handleStartQuiz}
          >
            <Text style={s.quizBtnText}>문제풀이 시작</Text>
          </Pressable>
        )}
      </View>

      {bookmarkedItems.length === 0 ? (
        <View style={s.emptyContainer}>
          <Text style={s.emptyEmoji}>🏷️</Text>
          <Text style={s.emptyTitle}>북마크가 없어요</Text>
          <Text style={s.emptyText}>
            문제풀이 중 단어 옆 🏷️ 버튼을 눌러{"\n"}북마크에 추가해 보세요
          </Text>
        </View>
      ) : (
        <FlatList
          data={bookmarkedItems}
          keyExtractor={(item) => item.num.toString()}
          renderItem={renderItem}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        />
      )}
    </ScreenContainer>
  );
}

const styles = (colors: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingTop: 28,
      paddingBottom: 16,
      paddingHorizontal: 16,
    },
    headerTitle: {
      fontSize: 26,
      fontWeight: "800",
      color: colors.foreground,
      letterSpacing: -0.5,
    },
    headerSub: {
      fontSize: 13,
      color: colors.dim,
      marginTop: 4,
    },
    quizBtn: {
      backgroundColor: colors.primary,
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 10,
    },
    quizBtnText: {
      fontSize: 13,
      fontWeight: "700",
      color: "#fff",
    },
    emptyContainer: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 32,
    },
    emptyEmoji: {
      fontSize: 56,
      marginBottom: 16,
    },
    emptyTitle: {
      fontSize: 18,
      fontWeight: "700",
      color: colors.foreground,
      marginBottom: 8,
    },
    emptyText: {
      fontSize: 14,
      color: colors.dim,
      textAlign: "center",
      lineHeight: 22,
    },
    wordCard: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 14,
      padding: 16,
    },
    wordCardHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      marginBottom: 6,
    },
    wordInfo: {
      flex: 1,
      flexDirection: "row",
      alignItems: "baseline",
      gap: 8,
      flexWrap: "wrap",
    },
    wordText: {
      fontSize: 17,
      fontWeight: "700",
      color: colors.foreground,
    },
    ipaText: {
      fontSize: 11,
      color: colors.dim,
      fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    },
    removeBtn: {
      padding: 4,
    },
    korText: {
      fontSize: 13,
      color: colors.muted,
      lineHeight: 18,
      marginBottom: 8,
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
  });
