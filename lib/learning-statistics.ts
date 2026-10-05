import { buildAdaptiveEvidenceIndex, mergeAdaptiveStats, type AdaptiveCandidate, type AdaptiveHistory, type AdaptiveItemStats } from "./adaptive-quiz";
import { ADAPTIVE_POLICY, accuracyPercent, calculateLearningNeed, eventPerformance, learningDay, median, mergePerformance, responseBaseline, type EvidenceStatus, type PerformanceCounts } from "./learning-analytics";
import { getLearningTargetState, type SenseLearningState } from "./learning-state";
import type { QuizMode } from "./vocab";

export interface LearningItemMeta extends AdaptiveCandidate { word: string; groupId: string; sourceId: string }
export interface StatisticsFilter { groupId?: string; mode?: string; period?: "lifetime" | "today" | "7days"; now?: number; legacyWrongNums?: number[] }
export interface PerformanceRow extends PerformanceCounts { id: string; accuracy: number | null; recentAccuracy: number | null; recentCount: number; uniqueWords: number; meanMs: number | null; weakCount: number; relearningCount: number }
export interface WordPerformance {
  key: string; word: string; groupId: string; sourceId: string; num: number;
  status: EvidenceStatus; stats: AdaptiveItemStats; modes: AdaptiveItemStats[];
  need: ReturnType<typeof calculateLearningNeed>; recentAccuracy: number | null;
  lastResponseMs: number | null; meanMs: number | null;
  /** Question type whose existing adaptive need selected the displayed score. */
  reviewMode: string;
}
export function buildLearningStatistics(history: AdaptiveHistory, learning: SenseLearningState, items: LearningItemMeta[], filter: StatisticsFilter = {}) {
  const now = filter.now ?? Date.now();
  const today = learningDay(now);
  const cutoff = filter.period === "today" ? today : filter.period === "7days" ? learningDay(now - 6 * 86400000) : "";
  const byNum = new Map(items.map(item => [item.num, item]));
  const all = Object.values(history.stats).filter(row => row.attempts > 0);
  const meta = (row: AdaptiveItemStats): LearningItemMeta => byNum.get(row.num) ?? { num: row.num, word: `기록 항목 #${row.num}`, groupId: row.evidence?.groupId || "unrecorded", sourceId: row.evidence?.sourceId || "", learningKey: row.evidence?.targetKey };
  const matches = (group: string, mode: string) => (!filter.groupId || group === filter.groupId) && (!filter.mode || mode === filter.mode);
  const selected = all.filter(row => matches(meta(row).groupId, row.mode));
  const events = (history.events ?? []).filter(e => matches(e.groupId, e.mode) && (!cutoff || learningDay(e.answeredAt) >= cutoff));
  const days = Object.values(history.daily ?? {}).filter(row => matches(row.groupId, row.mode) && (!cutoff || row.day >= cutoff));
  const todayPerformance = mergePerformance(Object.values(history.daily ?? {}).filter(row => matches(row.groupId, row.mode) && row.day === today));
  const countsFor = (rows: AdaptiveItemStats[]): PerformanceCounts => mergePerformance(rows.map(row => ({
    attempts: row.attempts, correct: row.correct, wrong: row.wrong, unknown: row.skips,
    responseCount: row.evidence?.responseCount ?? 0, responseTotalMs: row.evidence?.responseTotalMs ?? 0,
    slowCorrect: row.evidence?.slowCorrect ?? 0, masterChecks: row.evidence?.masterChecks ?? 0,
    masterRetained: row.evidence?.masterRetained ?? 0, lapses: row.evidence?.lapses ?? 0,
    newAttempts: row.evidence?.newAttempts ?? 0, classifiedAttempts: row.evidence?.classifiedAttempts ?? 0,
  })));
  const performance = cutoff ? mergePerformance(days) : countsFor(selected);
  const recentEvents = events.slice(-100);
  const recent = mergePerformance(recentEvents.map(e => eventPerformance(e)));
  const rowFor = (id: string, rows: AdaptiveItemStats[], kind: "group" | "mode"): PerformanceRow => {
    const relevantEvents = events.filter(e => (kind === "group" ? e.groupId : e.mode) === id).slice(-100);
    const relevantDays = days.filter(e => (kind === "group" ? e.groupId : e.mode) === id);
    const counts = cutoff ? mergePerformance(relevantDays) : countsFor(rows);
    const recentCounts = mergePerformance(relevantEvents.map(e => eventPerformance(e)));
    const rowNums = new Set(rows.map(row => row.num));
    const targets = [...new Set(items.filter(item => kind === "group" ? item.groupId === id : rowNums.has(item.num)).map(item => item.learningKey).filter((key): key is string => !!key))];
    return { id, ...counts, accuracy: accuracyPercent(counts), recentAccuracy: accuracyPercent(recentCounts), recentCount: recentCounts.attempts,
      weakCount: targets.filter(key => getLearningTargetState(learning, key).status === "WEAK").length,
      relearningCount: targets.filter(key => getLearningTargetState(learning, key).status === "RELEARNING").length,
      uniqueWords: new Set(rows.filter(r => !cutoff || learningDay(r.lastAnsweredAt) >= cutoff).map(r => meta(r).word.toLowerCase())).size,
      meanMs: counts.responseCount ? counts.responseTotalMs / counts.responseCount : null };
  };
  const groups = [...new Set(items.map(i => i.groupId).concat(selected.map(r => meta(r).groupId)))].filter(id => !filter.groupId || id === filter.groupId)
    .map(id => rowFor(id, selected.filter(r => meta(r).groupId === id), "group"));
  const modes = [...new Set(selected.map(r => r.mode).concat(days.map(r => r.mode)))].map(id => rowFor(id, selected.filter(r => r.mode === id), "mode"));
  const index = buildAdaptiveEvidenceIndex(history, items);
  const wordRows = new Map<string, { item: LearningItemMeta; modes: AdaptiveItemStats[] }>();
  for (const row of selected) {
    const item = meta(row); const key = row.evidence?.targetKey || item.learningKey || `num:${row.num}`;
    const record = wordRows.get(key) ?? { item, modes: [] }; record.modes.push(row); wordRows.set(key, record);
  }
  const baselineByMode = new Map([...new Set(all.map(s => s.mode))].map(mode => [mode, responseBaseline(history.events ?? [], mode)]));
  const recentByMode = new Map([...new Set(all.map(s => s.mode))].map(mode => [mode, new Set(history.recentSessions.filter(s => s.mode === mode).slice(-3).flatMap(s => s.itemNums))]));
  const legacyWrong = new Set(filter.legacyWrongNums ?? []);
  const words: WordPerformance[] = [...wordRows].map(([key, { item, modes: raw }]) => {
    const modes = [...new Set(raw.map(r => r.mode))].map(mode => mergeAdaptiveStats(raw.filter(r => r.mode === mode))!);
    const stats = mergeAdaptiveStats(modes)!;
    const target = getLearningTargetState(learning, key);
    const status = target.status === "NEW" && stats.attempts ? "ACTIVE" : target.status;
    const typed = modes.map(row => ({ row, need: calculateLearningNeed(index.get(`${row.mode}\u0000${key}`) ?? row, { status, now, lastStudiedAt: target.lastStudiedAt, baselineMs: baselineByMode.get(row.mode), recentlySeen: recentByMode.get(row.mode)?.has(item.num), legacyWrong: legacyWrong.has(item.num) }) })).sort((a, b) => b.need.score - a.need.score);
    const recentResults = stats.evidence?.recent ?? [];
    return { key, word: item.word, num: item.num, groupId: item.groupId, sourceId: item.sourceId, status, stats, modes,
      need: typed[0].need, reviewMode: typed[0].row.mode, recentAccuracy: recentResults.length ? Math.round(100 * recentResults.filter(r => r.outcome === "correct" || r.outcome === "mastered").length / recentResults.length) : null,
      lastResponseMs: stats.evidence?.lastResponseMs ?? null,
      meanMs: stats.evidence?.responseCount ? stats.evidence.responseTotalMs / stats.evidence.responseCount : null };
  });
  const stateCounts: Record<EvidenceStatus, number> = { NEW: 0, ACTIVE: 0, MASTERED: 0, WEAK: 0, RELEARNING: 0 };
  const uniqueTargets = new Map(items.filter(i => !filter.groupId || i.groupId === filter.groupId).map(i => [i.learningKey || `num:${i.num}`, i]));
  for (const key of uniqueTargets.keys()) stateCounts[getLearningTargetState(learning, key).status]++;
  const trend = [...new Set(days.map(d => d.day))].sort().slice(-14).map(day => ({ day, ...mergePerformance(days.filter(d => d.day === day)) }));
  const times = events.map(e => e.responseMs).filter((v): v is number => v !== null && v > 0);
  const stableMaster = [...uniqueTargets.keys()].filter(key => {
    const target = getLearningTargetState(learning, key);
    return target.status === "MASTERED" && target.lastStudiedAt > 0 && now - target.lastStudiedAt < ADAPTIVE_POLICY.masterProtectionMs;
  }).length;
  return { performance, accuracy: accuracyPercent(performance), recent, recentAccuracy: accuracyPercent(recent), today, todayPerformance,
    groups, modes, words, stateCounts, trend, stableMaster, dueMaster: stateCounts.MASTERED - stableMaster,
    allLifetimeAttempts: countsFor(all).attempts,
    missingStateTargets: words.filter(word => getLearningTargetState(learning, word.key).status === "NEW").length,
    masterRetention: performance.masterChecks ? Math.round(100 * performance.masterRetained / performance.masterChecks) : null,
    meanMs: performance.responseCount ? performance.responseTotalMs / performance.responseCount : null,
    medianMs: median(times), recentMeanMs: recent.responseCount ? recent.responseTotalMs / recent.responseCount : null,
    uniqueWords: new Set(selected.filter(r => !cutoff || learningDay(r.lastAnsweredAt) >= cutoff).map(r => meta(r).word.toLowerCase())).size,
    recordedEvents: history.events?.length ?? 0,
    dateCoverageStart: Object.values(history.daily ?? {}).map(d => d.day).sort()[0] ?? null,
  };
}
export type LearningStatistics = ReturnType<typeof buildLearningStatistics>;

/** View/action selection only: uses the engine's need, never a second weakness score. */
export function statisticsReviewCandidates(model: LearningStatistics, groupId = "") {
  return model.words.filter(word => (!groupId || word.groupId === groupId) &&
    (word.status === "WEAK" || word.status === "RELEARNING" || word.need.level === "높음" || word.need.level === "매우 높음"))
    .sort((a, b) => b.need.score - a.need.score);
}

export function buildStatisticsReviewParams(model: LearningStatistics, groupId = "", word?: WordPerformance) {
  const words = word ? [word] : statisticsReviewCandidates(model, groupId).slice(0, 20);
  if (!words.length) return null;
  const mode: QuizMode = ["definition-choice", "syn-choice", "syn-kor-choice", "kor-choice", "syn-type", "flashcard"].includes(words[0].reviewMode) ? words[0].reviewMode as QuizMode : "kor-choice";
  return { mode, rangeId: "statistics-review", count: String(Math.min(10, words.length)),
    bookmarkNums: [...new Set(words.map(row => row.num))].join(","),
    reviewKeys: JSON.stringify([...new Set(words.map(row => row.key))]), choiceLang: "korean" };
}
