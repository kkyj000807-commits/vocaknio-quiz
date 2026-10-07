import { useCallback, useMemo, useState } from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { AdaptiveStatistics } from "@/components/adaptive-statistics";
import { SCROLL_END_PADDING } from "@/lib/layout";
import { loadLearningSnapshot, loadStudyTime, formatStudyTime, type StudyTimeData } from "@/lib/store";
import { VOCAB, RANGES } from "@/lib/vocab";
import { getItemLearningTargets } from "@/lib/canonical-learning";
import { buildLearningStatistics, buildStatisticsReviewParams, type LearningItemMeta, type WordPerformance } from "@/lib/learning-statistics";
import { useColors } from "@/hooks/use-colors";
import { sentenceCompletionMetadata } from "@/lib/sentence-completion";

let itemMetadata: LearningItemMeta[] | null = null;
function statisticsItems() {
  if (!itemMetadata) itemMetadata = VOCAB.flatMap(item => getItemLearningTargets(item).map(target => ({
    num: item.num, word: item.w, groupId: item.group, sourceId: item.id,
    learningKey: target.key, conceptId: item.conceptId,
  }))).concat(sentenceCompletionMetadata());
  return itemMetadata;
}
export default function StatsScreen() {
  const colors = useColors();
  const router = useRouter();
  const [showStudyTime, setShowStudyTime] = useState(false);
  const [snapshot, setSnapshot] = useState<Awaited<ReturnType<typeof loadLearningSnapshot>> | null>(null);
  const [studyTime, setStudyTime] = useState<StudyTimeData | null>(null);
  const [error, setError] = useState("");
  const [groupId, setGroupId] = useState(""); const [mode, setMode] = useState("");
  const [period, setPeriod] = useState<"lifetime" | "today" | "7days">("lifetime");
  useFocusEffect(useCallback(() => {
    let active = true;
    loadLearningSnapshot().then(value => { if (active) { setSnapshot(value); setError(""); } })
      .catch(() => { if (active) setError("학습 기록을 읽지 못했습니다. 기존 기록을 초기화하지 않고 보존합니다. 설정에서 저장 상태를 확인하세요."); });
    loadStudyTime().then(value => { if (active) setStudyTime(value); }).catch(() => {});
    return () => { active = false; };
  }, []));
  const model = useMemo(() => snapshot ? buildLearningStatistics(snapshot.history, snapshot.learning, statisticsItems(), { groupId, mode, period, legacyWrongNums: snapshot.legacyWrongNums }) : null, [snapshot, groupId, mode, period]);
  const review = (group = "", word?: WordPerformance) => {
    if (!model) return;
    const params = buildStatisticsReviewParams(model, group, word);
    if (params) router.push({ pathname: "/quiz", params });
  };
  const studyGroup = (group: string) => {
    const range = RANGES.find(row => row.kind === "section" && row.group === group);
    if (range) router.push({ pathname: "/quiz", params: { mode: "definition-choice", rangeId: range.id, rangeStart: range.start, rangeEnd: range.end, count: 10 } });
  };
  return <ScreenContainer containerClassName="bg-background">
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: SCROLL_END_PADDING }} showsVerticalScrollIndicator={false}>
      <View style={{ padding: 16, paddingTop: 28 }}><Text style={{ color: colors.foreground, fontSize: 26, fontWeight: "800" }}>학습 통계</Text><Text style={{ color: colors.muted, marginTop: 6 }}>실제 풀이 기록 · 성과와 복습 우선순위</Text></View>
      {error ? <Text accessibilityRole="alert" style={{ color: colors.error, padding: 16, lineHeight: 22 }}>{error}</Text> : null}
      {model && snapshot ? <AdaptiveStatistics model={model} lifetime={snapshot.stats} groupId={groupId} mode={mode} period={period} onGroup={setGroupId} onMode={setMode} onPeriod={setPeriod} onReview={review} onStudyGroup={studyGroup} /> : !error ? <Text style={{ padding: 16, color: colors.muted }}>학습 기록을 불러오는 중…</Text> : null}
      <View style={{ marginHorizontal: 16, backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 14, padding: 14, gap: 6 }}>
        <Pressable accessibilityRole="button" accessibilityState={{ expanded: showStudyTime }} onPress={() => setShowStudyTime(value => !value)} style={{ minHeight: 44, justifyContent: "center" }}><Text style={{ fontSize: 15, fontWeight: "600", color: colors.foreground }}>학습 시간·연속 학습일 {showStudyTime ? "−" : "+"}</Text></Pressable>
        {showStudyTime ? <>
        <Text style={{ color: colors.foreground, lineHeight: 23 }}>오늘 {formatStudyTime(studyTime?.todaySeconds ?? 0)} · 이번 주 {formatStudyTime(studyTime?.weekSeconds ?? 0)} · 누적 {formatStudyTime(studyTime?.totalSeconds ?? 0)}</Text>
        <Text style={{ color: colors.muted }}>연속 학습 {snapshot?.stats.streak ?? 0}일 · 총 풀이 {snapshot?.stats.totalAnswered ?? 0}회</Text>
        </> : null}
      </View>
    </ScrollView>
  </ScreenContainer>;
}
