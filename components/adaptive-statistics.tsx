import React, { useMemo, useState } from "react";
import { View, Text, Pressable, TextInput } from "react-native";
import { useColors } from "@/hooks/use-colors";
import { accuracyPercent, type EvidenceStatus } from "@/lib/learning-analytics";
import type { LearningStatistics, PerformanceRow, WordPerformance } from "@/lib/learning-statistics";

export const QUESTION_TYPE_LABELS: Record<string, string> = {
  "definition-choice": "영영 정의 → 단어", "syn-choice": "영어 동의어",
  "syn-kor-choice": "동의어 해설형", "kor-choice": "영어 → 한글",
  "syn-type": "동의어 직접 입력", flashcard: "빠른 암기 · 자기채점",
};
const statusLabels: Record<EvidenceStatus, string> = { NEW: "미학습", ACTIVE: "학습 중", MASTERED: "MASTER", WEAK: "WEAK", RELEARNING: "RELEARNING" };
export const percentLabel = (value: number | null) => value === null ? "기록 없음" : `${value}%`;
const timeLabel = (value: number | null) => value === null ? "기록 없음" : `${(value / 1000).toFixed(1)}초`;

export function AdaptiveStatistics({ model, lifetime, onGroup, onMode, onPeriod, groupId, mode, period }: {
  model: LearningStatistics; lifetime: { totalAnswered: number; totalCorrect: number };
  onGroup: (value: string) => void; onMode: (value: string) => void;
  onPeriod: (value: "lifetime" | "today" | "7days") => void;
  groupId: string; mode: string; period: "lifetime" | "today" | "7days";
}) {
  const colors = useColors();
  const [status, setStatus] = useState(""); const [sort, setSort] = useState("need");
  const [query, setQuery] = useState(""); const [outcome, setOutcome] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const card = { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 14, padding: 14, marginBottom: 12 };
  const heading = { color: colors.foreground, fontSize: 17, fontWeight: "800" as const, marginBottom: 10 };
  const text = { color: colors.foreground, fontSize: 14, lineHeight: 22 };
  const note = { color: colors.muted, fontSize: 12, lineHeight: 19 };
  const chip = (label: string, value: string, selected: string, select: (value: string) => void) => (
    <Pressable key={value || "all"} accessibilityRole="button" accessibilityState={{ selected: selected === value }} onPress={() => select(value)}
      style={{ paddingHorizontal: 12, paddingVertical: 10, minHeight: 44, borderRadius: 10, backgroundColor: selected === value ? colors.primary : colors.card, borderColor: colors.border, borderWidth: 1 }}>
      <Text style={{ fontSize: 13, fontWeight: "700", color: selected === value ? "#fff" : colors.foreground }}>{label}</Text>
    </Pressable>);
  const controls = { flexDirection: "row" as const, flexWrap: "wrap" as const, gap: 6, marginBottom: 10 };
  const words = useMemo(() => {
    const result = model.words.filter(w => (!status || w.status === status) && (!query || w.word.toLowerCase().includes(query.toLowerCase().trim())) && (!outcome || w.stats.lastOutcome === outcome));
    const rate = (w: WordPerformance) => accuracyPercent(w.stats) ?? 101;
    return result.sort((a, b) => sort === "accuracy" ? rate(a) - rate(b) : sort === "recent" ? (a.recentAccuracy ?? 101) - (b.recentAccuracy ?? 101)
      : sort === "wrong" ? b.stats.wrong - a.stats.wrong : sort === "unknown" ? b.stats.skips - a.stats.skips
      : sort === "time" ? (b.meanMs ?? -1) - (a.meanMs ?? -1) : sort === "old" ? a.stats.lastAnsweredAt - b.stats.lastAnsweredAt : b.need.score - a.need.score);
  }, [model.words, status, query, outcome, sort]);
  const kpis: [string, string, string][] = [
    ["기존 포함 누적", percentLabel(lifetime.totalAnswered ? Math.round(100 * lifetime.totalCorrect / lifetime.totalAnswered) : null), `${lifetime.totalCorrect}/${lifetime.totalAnswered} 정답`],
    ["선택 범위 정답률", percentLabel(model.accuracy), `${model.performance.correct}/${model.performance.attempts} 정답`],
    ["최근 최대 100문제", percentLabel(model.recentAccuracy), `${model.recent.correct}/${model.recent.attempts} 정답`],
    ["오늘 정답률 · KST", percentLabel(accuracyPercent(model.todayPerformance)), `${model.todayPerformance.correct}/${model.todayPerformance.attempts} 정답`],
    ["선택 범위 풀이", `${model.performance.attempts.toLocaleString()}회`, `오늘 ${model.todayPerformance.attempts}회`],
    ["학습한 고유 표현", `${model.uniqueWords.toLocaleString()}개`, "같은 표현의 반복 풀이와 구분"],
    ["평균 응답시간", timeLabel(model.meanMs), `유효 시간 ${model.performance.responseCount}건`],
    ["최근 응답 중앙값", timeLabel(model.medianMs), "2분 초과·누락 제외"],
    ["최근 평균 응답", timeLabel(model.recentMeanMs), `유효 시간 ${model.recent.responseCount}건`],
    ["MASTER 유지율", percentLabel(model.masterRetention), `${model.performance.masterRetained}/${model.performance.masterChecks} 재검증 성공`],
  ];
  const table = (title: string, rows: PerformanceRow[], kind: "group" | "mode") => <View style={card}>
    <Text style={heading}>{title}</Text>
    {rows.map(row => <Pressable key={row.id} accessibilityRole="button" onPress={() => kind === "group" ? onGroup(row.id) : onMode(row.id)} style={{ paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 10 }}><Text style={{ ...text, fontWeight: "700", flexShrink: 1 }}>{kind === "group" ? row.id.toUpperCase() : QUESTION_TYPE_LABELS[row.id] ?? row.id}</Text><Text style={{ ...text, fontWeight: "800", color: colors.primary }}>{percentLabel(row.accuracy)}</Text></View>
      <Text style={note}>{row.correct}/{row.attempts} 정답 · 최근 {percentLabel(row.recentAccuracy)} ({row.recentCount}건) · 평균 {timeLabel(row.meanMs)}</Text>
      <Text style={note}>고유 표현 {row.uniqueWords}개 · WEAK {row.weakCount} · RELEARNING {row.relearningCount}{row.attempts > 0 && row.attempts < 5 ? " · 표본 부족" : ""}</Text>
    </Pressable>)}
  </View>;
  return <View style={{ paddingHorizontal: 16 }}>
    <View style={card}>
      <Text style={heading}>범위·기간·문제 유형</Text>
      <View style={controls}>{chip("전체", "", groupId, onGroup)}{["V101", "V201", "V301", "V401", "V501", "V502", "V601", "APPENDIX"].map(id => chip(id, id, groupId, onGroup))}</View>
      <View style={controls}>{chip("누적", "lifetime", period, v => onPeriod(v as typeof period))}{chip("오늘 · KST", "today", period, v => onPeriod(v as typeof period))}{chip("최근 7일", "7days", period, v => onPeriod(v as typeof period))}</View>
      <View style={controls}>{chip("모든 유형", "", mode, onMode)}{Object.entries(QUESTION_TYPE_LABELS).map(([id, label]) => chip(label, id, mode, onMode))}</View>
    </View>
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 12 }}>
      {kpis.map(([label, value, sample]) => <View key={label} style={{ ...card, flexGrow: 1, flexBasis: 145, marginBottom: 0 }}><Text style={note}>{label}</Text><Text style={{ color: colors.primary, fontSize: 25, fontWeight: "800", marginVertical: 6 }}>{value}</Text><Text style={note}>{sample}</Text></View>)}
    </View>
    <View style={card}>
      <Text style={heading}>현재 학습 상태 · 의미별</Text>
      <Text style={text}>{Object.entries(model.stateCounts).map(([key, count]) => `${statusLabels[key as EvidenceStatus]} ${count.toLocaleString()}`).join("  ·  ")}</Text>
      <Text style={note}>MASTER 보호 중 {model.stableMaster} · 재검증 가능 {model.dueMaster} · 기록된 lapse {model.performance.lapses}회</Text>
      <Text style={note}>직접 외움 표시도 보존합니다. MASTER 개수와 실제 재검증 유지율은 서로 다른 지표입니다.</Text>
    </View>
    {table("단어장별 성과", model.groups, "group")}
    {table("문제 유형별 성과", model.modes, "mode")}
    <View style={card}>
      <Text style={heading}>최근 일별 성과 · KST</Text>
      {model.trend.length ? model.trend.map(row => <View key={row.day} style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: 6, paddingVertical: 6 }}><Text style={text}>{row.day}</Text><Text style={text}>{percentLabel(accuracyPercent(row))} · {row.correct}/{row.attempts} · {timeLabel(row.responseCount ? row.responseTotalMs / row.responseCount : null)}</Text></View>) : <Text style={note}>날짜가 있는 풀이 기록이 아직 없습니다.</Text>}
      <Text style={note}>관측 신규 {model.performance.newAttempts}회 · 관측 복습 {model.performance.classifiedAttempts - model.performance.newAttempts}회 · 상태 기록 {model.performance.classifiedAttempts}/{model.performance.attempts}건. 예전 상태가 없는 응답은 신규/복습 비율에 소급 배정하지 않습니다.</Text>
    </View>
    <View style={card}>
      <Text style={heading}>복습 우선순위 · 단어 상세</Text>
      <TextInput accessibilityLabel="통계 단어 검색" placeholder="단어 검색" placeholderTextColor={colors.muted} value={query} onChangeText={setQuery} style={{ ...text, minHeight: 44, padding: 10, borderWidth: 1, borderColor: colors.border, borderRadius: 10, marginBottom: 10 }} />
      <View style={controls}>{chip("모든 상태", "", status, setStatus)}{(["MASTERED", "WEAK", "RELEARNING", "ACTIVE"] as const).map(id => chip(statusLabels[id], id, status, setStatus))}</View>
      <View style={controls}>{chip("모든 마지막 응답", "", outcome, setOutcome)}{chip("정답", "correct", outcome, setOutcome)}{chip("오답", "wrong", outcome, setOutcome)}{chip("모름", "skip", outcome, setOutcome)}</View>
      <View style={controls}>{[["need", "필요도"], ["accuracy", "정답률"], ["recent", "최근 정답률"], ["wrong", "오답 수"], ["unknown", "모름 수"], ["time", "느린 순"], ["old", "오래된 순"]].map(([id, label]) => chip(label, id, sort, setSort))}</View>
      <Text style={note}>{words.length}개 중 최대 30개 표시 · 상세 수치는 단어의 누적 기록이며 현재 상태를 기준으로 정렬합니다.</Text>
      {words.slice(0, 30).map((word, i) => <View key={word.key} style={{ paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <Pressable accessibilityRole="button" accessibilityState={{ expanded: expanded === word.key }} onPress={() => setExpanded(expanded === word.key ? null : word.key)}>
          <Text style={{ ...text, fontWeight: "800" }}>{i + 1}. {word.word} · {statusLabels[word.status]} · {word.need.level}</Text>
          <Text style={note}>누적 {percentLabel(accuracyPercent(word.stats))} ({word.stats.correct}/{word.stats.attempts}) · 최근 {percentLabel(word.recentAccuracy)} · 평균 {timeLabel(word.meanMs)}</Text>
          <Text style={note}>{word.need.reasons.slice(0, 2).join(" · ")} {expanded === word.key ? "−" : "+"}</Text>
        </Pressable>
        {expanded === word.key ? <View style={{ marginTop: 8, gap: 4 }}>
          <Text style={text}>오답 {word.stats.wrong} · 모름 {word.stats.skips} · 연속 정답 {word.stats.evidence?.correctStreak ?? "기록 없음"}</Text>
          <Text style={text}>최근 응답 {timeLabel(word.lastResponseMs)} · 최근 실패 {word.stats.evidence?.lastFailureAt ? learningDate(word.stats.evidence.lastFailureAt) : "기록 없음"}</Text>
          {word.modes.map(row => <Text key={row.mode} style={text}>{QUESTION_TYPE_LABELS[row.mode] ?? row.mode}: {percentLabel(accuracyPercent(row))} ({row.correct}/{row.attempts}) · 평균 {timeLabel(row.evidence?.responseCount ? row.evidence.responseTotalMs / row.evidence.responseCount : null)}</Text>)}
          {word.need.reasons.map(reason => <Text key={reason} style={note}>• {reason}</Text>)}
        </View> : null}
      </View>)}
      {!words.length ? <Text style={note}>조건에 맞는 풀이 기록이 없습니다.</Text> : null}
    </View>
    <View style={card}>
      <Text style={heading}>숫자 읽는 법</Text>
      <Text style={note}>정답률 = 정답 / 실제 응답 수. 모름은 실패에 포함하고, 미응답·중복 응답은 제외합니다. 빠른 암기는 자기채점 기록입니다.</Text>
      <Text style={note}>범위·유형별 누적은 기존 적응형 기록에서 계산합니다. 범위/기간 필터는 선택 범위 수치에만 적용하고, 전체 누적 카드는 기존 기록을 포함한 전체 성과입니다.</Text>
      <Text style={note}>일별 집계 시작: {model.dateCoverageStart ?? "기록 없음"}. 최근 원자료는 최대 1,000건, 최근 성과는 조건에 맞는 그중 최대 100건입니다. 날짜 집계는 최근 365일이며 누적 기록은 삭제하지 않습니다.</Text>
      <Text style={note}>시간은 이 유형의 평소 속도와 비교합니다. 2분 초과·누락은 정답률에는 포함하고 시간 계산에서만 제외합니다. 학습 필요도는 출제 가중치이지 실제 기억 확률이나 시험 점수가 아닙니다. 기기 로컬 기록이며 자동 계정 동기화되지 않습니다.</Text>
    </View>
  </View>;
}
function learningDate(at: number) { return new Date(at).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" }); }
