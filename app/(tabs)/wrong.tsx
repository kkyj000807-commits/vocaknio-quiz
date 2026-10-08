import { SCROLL_END_PADDING } from "@/lib/layout";
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
import { IconSymbol } from "@/components/ui/icon-symbol";
import { WordSectionLabel } from "@/components/word-section-label";
import { VOCAB, getSynonymSourceGroups, type VocabItem } from "@/lib/vocab";
import {
  loadWrongWords,
  markLearningTargetMastered,
  removeWrongWord,
  clearWrongWords,
  loadLearningSnapshot,
} from "@/lib/store";
import { buildLearningStatistics, buildStatisticsReviewParams, statisticsReviewCandidates, type WordPerformance } from "@/lib/learning-statistics";
import { getSentenceCompletionByKey, LOGIC_TYPE_LABELS, sentenceCompletionMetadata } from "@/lib/sentence-completion";
import { getItemLearningTargets } from "@/lib/canonical-learning";
import { useColors } from "@/hooks/use-colors";

export default function WrongScreen() {
  const colors = useColors();
  const router = useRouter();
  const [wrongNums, setWrongNums] = useState<number[]>([]);
  const [logicModel, setLogicModel] = useState<ReturnType<typeof buildLearningStatistics> | null>(null);
  const logicWords: WordPerformance[] = logicModel ? statisticsReviewCandidates(logicModel) : [];
  // 가리기 모드 ON/OFF
  const [hideMode, setHideMode] = useState(false);
  // 개별 카드 공개 상태 (num -> revealed)
  const [revealed, setRevealed] = useState<Record<number, boolean>>({});

  useFocusEffect(
    useCallback(() => {
      let active = true;
      loadWrongWords().then(setWrongNums);
      loadLearningSnapshot().then(snapshot => {
        if (active) setLogicModel(buildLearningStatistics(snapshot.history, snapshot.learning, sentenceCompletionMetadata(), { mode: "sentence-completion" }));
      }).catch(() => { /* Preserve ordinary wrong words; never reset unreadable evidence. */ });
      // 탭 전환 시 가리기 상태 초기화
      setHideMode(false);
      setRevealed({});
      return () => { active = false; };
    }, [])
  );

  const wrongItems = wrongNums
    .map((num) => VOCAB.find((v) => v.num === num))
    .filter(Boolean) as VocabItem[];

  const haptic = () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const handleMaster = useCallback(
    async (item: VocabItem) => {
      haptic();
      const targets = getItemLearningTargets(item);
      // The visible legacy card represents one exact displayed meaning. A
      // reviewed multi-sense card must be mastered inside its specific problem.
      if (targets.length !== 1) return;
      await markLearningTargetMastered(targets[0].key, item.num);
      const updated = await removeWrongWord(item.num);
      setWrongNums(updated);
      // 마스터 처리된 카드 공개 상태 제거
      setRevealed((prev) => {
        const next = { ...prev };
        delete next[item.num];
        return next;
      });
    },
    []
  );

  const handleClearAll = useCallback(() => {
    haptic();
    Alert.alert(
      "오답 목록 초기화",
      "모든 오답 단어를 삭제하시겠습니까?",
      [
        { text: "취소", style: "cancel" },
        {
          text: "초기화",
          style: "destructive",
          onPress: async () => {
            await clearWrongWords();
            setWrongNums([]);
            setRevealed({});
          },
        },
      ]
    );
  }, []);

  const handleStartQuiz = useCallback(() => {
    haptic();
    if (wrongItems.length === 0) return;
    router.push({
      pathname: "/wrong-quiz",
      params: {
        wrongNums: wrongNums.join(","),
        count: Math.min(wrongItems.length, 20),
      },
    });
  }, [wrongItems, wrongNums, router]);

  const toggleHideMode = useCallback(() => {
    haptic();
    setHideMode((prev) => {
      if (!prev) {
        // 가리기 ON: 모든 카드 가리기
        setRevealed({});
      }
      return !prev;
    });
  }, []);

  const toggleReveal = useCallback((num: number) => {
    if (!hideMode) return;
    haptic();
    setRevealed((prev) => ({ ...prev, [num]: !prev[num] }));
  }, [hideMode]);

  const logicHeader = logicWords.length ? <View style={{ marginBottom: 16, gap: 8 }}>
    <Text style={{ color: colors.foreground, fontSize: 17, fontWeight: "600" }}>Sentence Completion · 논리 복습</Text>
    <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 19 }}>실제 논리 응답에서 필요한 문항 · 단어 암기 목록과 별도로 유지</Text>
    {logicWords.slice(0, 12).map(word => <View key={word.key} style={{ borderBottomWidth: 1, borderColor: colors.border, paddingBottom: 8 }}>
      <Text style={{ color: colors.foreground, fontSize: 14 }}>{word.word} · {LOGIC_TYPE_LABELS[getSentenceCompletionByKey(word.key)!.logicType]} · {word.need.level}</Text>
      <WordSectionLabel groups={[word.groupId]} />
      <Pressable accessibilityRole="button" accessibilityLabel={`${word.word} 논리 복습 시작`} style={{ minHeight: 44, justifyContent: "center" }} onPress={() => {
        const params = logicModel ? buildStatisticsReviewParams(logicModel, "", word) : null;
        if (params) router.push({ pathname: "/quiz", params });
      }}><Text style={{ color: colors.primary }}>이 논리 문제 복습 →</Text></Pressable>
    </View>)}
  </View> : null;

  const s = styles(colors);

  const renderItem = ({ item }: { item: VocabItem }) => {
    const isRevealed = !hideMode || revealed[item.num];

    return (
      <Pressable
        style={s.wordCard}
        onPress={() => toggleReveal(item.num)}
        disabled={!hideMode}
      >
        <View style={s.wordCardHeader}>
          <View style={s.wordInfo}>
            <Text style={s.wordText}>{item.w}</Text>
            {item.p ? <Text style={s.ipaText}>{item.p}</Text> : null}
          </View>
          <Pressable
            style={s.masterBtn}
            onPress={() => handleMaster(item)}
          >
            <Text style={s.masterBtnText}>✓ 마스터</Text>
          </Pressable>
        </View>

        {/* 뜻 영역 - 가리기 모드에서 마스킹 */}
        {isRevealed ? (
          <>
            <Text style={s.korText} numberOfLines={2}>
              {item.k_short}
            </Text>
            {item.s.length > 0 && (
              <View style={s.synTagRow}>
                {item.s.slice(0, 4).map((syn, i) => (
                  <View key={i} style={s.synTag}>
                    <Text style={s.synTagText}>{syn}</Text>
                    <WordSectionLabel groups={getSynonymSourceGroups(item, syn)} />
                  </View>
                ))}
              </View>
            )}
          </>
        ) : (
          <View style={s.maskedArea}>
            <Text style={s.maskedText}>탭하여 뜻 확인</Text>
          </View>
        )}
        <WordSectionLabel groups={[item.group]} />
      </Pressable>
    );
  };

  return (
    <ScreenContainer containerClassName="bg-background">
      {/* Header */}
      <View style={s.header}>
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitle}>오답 노트</Text>
          <Text style={s.headerSub}>
            {wrongItems.length || logicWords.length
              ? `${wrongItems.length}개 단어 · 논리 복습 ${logicWords.length}문항`
              : "아직 오답이 없어요"}
          </Text>
        </View>
        {wrongItems.length > 0 && (
          <View style={s.headerBtns}>
            {/* 가리기 토글 */}
            <Pressable
              style={[s.hideBtn, hideMode && s.hideBtnActive]}
              onPress={toggleHideMode}
            >
              <IconSymbol
                name={hideMode ? "lock.open.fill" : "lock.fill"}
                size={14}
                color={hideMode ? colors.primary : colors.muted}
              />
              <Text style={[s.hideBtnText, hideMode && s.hideBtnTextActive]}>
                {hideMode ? "보기" : "가리기"}
              </Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [s.quizBtn, pressed && { opacity: 0.85 }]}
              onPress={handleStartQuiz}
            >
              <Text style={s.quizBtnText}>오답 문제 풀기</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [s.clearBtn, pressed && { opacity: 0.85 }]}
              onPress={handleClearAll}
            >
              <Text style={s.clearBtnText}>초기화</Text>
            </Pressable>
          </View>
        )}
      </View>

      {wrongItems.length === 0 && logicWords.length === 0 ? (
        <View style={s.emptyContainer}>
          <Text style={s.emptyEmoji}>🎯</Text>
          <Text style={s.emptyTitle}>오답 단어가 없어요</Text>
          <Text style={s.emptyText}>
            문제 풀이에서 틀린 단어가{"\n"}여기에 자동으로 쌓입니다
          </Text>
        </View>
      ) : (
        <FlatList
          data={wrongItems}
          keyExtractor={(item) => item.num.toString()}
          renderItem={renderItem}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: SCROLL_END_PADDING }}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          ListHeaderComponent={
            <>{logicHeader}{wrongItems.length ? hideMode ? (
              <View style={s.hideModeInfoBox}>
                <Text style={s.hideModeInfoText}>
                  뜻 가리기 모드 — 각 카드를 탭하면 뜻이 공개됩니다
                </Text>
                <Text style={[s.hideModeInfoText, { marginTop: 4, color: colors.dim }]}>
                  {Object.values(revealed).filter(Boolean).length} / {wrongItems.length}개 확인
                </Text>
              </View>
            ) : (
              <View style={s.infoBox}>
                <Text style={s.infoText}>
                  💡 단어를 완전히 외웠다면 <Text style={{ color: colors.success }}>✓ 마스터</Text> 버튼으로 목록에서 제거하세요
                </Text>
              </View>
            ) : null}</>
          }
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
      alignItems: "flex-start",
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
      fontSize: 12,
      color: colors.dim,
      marginTop: 4,
    },
    headerBtns: {
      flexDirection: "row",
      gap: 6,
      alignItems: "center",
      flexWrap: "wrap",
      justifyContent: "flex-end",
      maxWidth: 200,
    },
    hideBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingHorizontal: 10,
      paddingVertical: 7,
      minHeight: 44,
      justifyContent: "center",
    },
    hideBtnActive: {
      backgroundColor: "rgba(108,99,255,0.15)",
      borderColor: colors.primary,
    },
    hideBtnText: {
      fontSize: 11,
      fontWeight: "700",
      color: colors.muted,
    },
    hideBtnTextActive: {
      color: colors.primary,
    },
    quizBtn: {
      backgroundColor: colors.error,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 7,
      minHeight: 44,
      justifyContent: "center",
    },
    quizBtnText: {
      fontSize: 11,
      fontWeight: "700",
      color: "#fff",
    },
    clearBtn: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingHorizontal: 10,
      paddingVertical: 7,
      minHeight: 44,
      justifyContent: "center",
    },
    clearBtnText: {
      fontSize: 11,
      fontWeight: "600",
      color: colors.dim,
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
    infoBox: {
      backgroundColor: "rgba(248,113,113,0.08)",
      borderWidth: 1,
      borderColor: "rgba(248,113,113,0.2)",
      borderRadius: 12,
      padding: 12,
      marginBottom: 12,
    },
    infoText: {
      fontSize: 12,
      color: colors.muted,
      lineHeight: 18,
    },
    hideModeInfoBox: {
      backgroundColor: "rgba(108,99,255,0.08)",
      borderWidth: 1,
      borderColor: "rgba(108,99,255,0.2)",
      borderRadius: 12,
      padding: 12,
      marginBottom: 12,
    },
    hideModeInfoText: {
      fontSize: 12,
      color: colors.primary,
      lineHeight: 18,
      fontWeight: "600",
    },
    wordCard: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: "rgba(248,113,113,0.2)",
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
      color: colors.error,
    },
    ipaText: {
      fontSize: 11,
      color: colors.dim,
      fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    },
    masterBtn: {
      backgroundColor: "rgba(52,211,153,0.12)",
      borderWidth: 1,
      borderColor: "rgba(52,211,153,0.3)",
      borderRadius: 10,
      paddingHorizontal: 10,
      paddingVertical: 5,
    },
    masterBtnText: {
      fontSize: 11,
      fontWeight: "700",
      color: colors.success,
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
      maxWidth: "100%",
      flexShrink: 1,
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
    maskedArea: {
      backgroundColor: "rgba(108,99,255,0.08)",
      borderWidth: 1,
      borderColor: "rgba(108,99,255,0.2)",
      borderRadius: 8,
      paddingVertical: 12,
      alignItems: "center",
    },
    maskedText: {
      fontSize: 12,
      color: colors.primary,
      fontWeight: "600",
    },
  });
