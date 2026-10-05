/** Shared evidence contract for selection and the existing statistics tab.
 * This is an extension of adaptive history, not a second learner database.
 */
export const ADAPTIVE_POLICY = Object.freeze({
  unknownPenalty: 6, wrongPenalty: 4, slowCorrectPenalty: 1.8,
  fastCorrectReward: 0.55, lapsePenalty: 1.6, recentFailureWeight: 2,
  typeWeaknessWeight: 1.5, repeatedFailureWeight: 0.45,
  minimumWeight: 0.025, recentPenalty: 0.08, newWordShare: 0.2,
  fastRatio: 0.65, slowRatio: 1.8, fallbackResponseMs: 5000,
  maxResponseMs: 120000, spacedSuccessGapMs: 6 * 60 * 60 * 1000,
  recentEventLimit: 1000, itemRecentLimit: 10, dailyRetentionDays: 365,
  masterProtectionMs: 86400000, initialElapsedDays: 30,
  maximumForgettingRisk: 6, forgettingFloor: 0.12, maximumStabilityDays: 90,
  maximumSpacedPower: 6, maximumFailureStreak: 6, maximumRewardSuccesses: 8,
  spacedSuccessReward: 0.7, maximumLapses: 4, legacyWrongBonus: 2,
  stateWeights: { NEW: 1.4, ACTIVE: 1, WEAK: 3, MASTERED: 0.08, RELEARNING: 4 },
  highNeed: 5, veryHighNeed: 20,
});

export type EvidenceStatus = "NEW" | "ACTIVE" | "WEAK" | "MASTERED" | "RELEARNING";
export interface ItemEvidence {
  targetKey: string; groupId: string; sourceId: string;
  correctStreak: number; spacedSuccesses: number; lastSuccessAt: number;
  lastFailureAt: number; lastResponseMs: number | null;
  responseCount: number; responseTotalMs: number; slowCorrect: number;
  fastCorrect: number; lapses: number; masterChecks: number; masterRetained: number;
  newAttempts: number; classifiedAttempts: number; lastHintUsed: boolean;
  recent: { at: number; outcome: string; responseMs: number | null }[];
}
export interface LearningAnswerEvent {
  id: string; sessionId: string; itemNum: number; sourceId: string;
  targetKey: string; groupId: string; mode: string; outcome: string;
  presentedAt: number | null; answeredAt: number; responseMs: number | null;
  statusBefore: EvidenceStatus | null; statusAfter: EvidenceStatus | null;
  hintUsed: boolean;
}
export interface PerformanceCounts {
  attempts: number; correct: number; wrong: number; unknown: number;
  responseCount: number; responseTotalMs: number; slowCorrect: number;
  newAttempts: number; classifiedAttempts: number; masterChecks: number; masterRetained: number; lapses: number;
}
export interface DailyPerformance extends PerformanceCounts {
  day: string; groupId: string; mode: string;
}
export const emptyPerformance = (): PerformanceCounts => ({
  attempts: 0, correct: 0, wrong: 0, unknown: 0, responseCount: 0,
  responseTotalMs: 0, slowCorrect: 0, newAttempts: 0, classifiedAttempts: 0,
  masterChecks: 0, masterRetained: 0, lapses: 0,
});
export const emptyEvidence = (): ItemEvidence => ({
  targetKey: "", groupId: "", sourceId: "", correctStreak: 0,
  spacedSuccesses: 0, lastSuccessAt: 0, lastFailureAt: 0, lastResponseMs: null,
  responseCount: 0, responseTotalMs: 0, slowCorrect: 0, fastCorrect: 0,
  lapses: 0, masterChecks: 0, masterRetained: 0, newAttempts: 0, classifiedAttempts: 0, lastHintUsed: false, recent: [],
});
export function validResponseMs(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0 &&
    value <= ADAPTIVE_POLICY.maxResponseMs ? Math.round(value) : null;
}
export function learningDay(at: number): string {
  return new Date(at + 9 * 3600000).toISOString().slice(0, 10);
}
export function accuracyPercent(counts: { attempts: number; correct: number }): number | null {
  return counts.attempts > 0 ? Math.round(100 * counts.correct / counts.attempts) : null;
}
export function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}
export function responseBaseline(events: LearningAnswerEvent[], mode: string): number {
  const values = events.filter(e => e.mode === mode && !e.hintUsed)
    .map(e => validResponseMs(e.responseMs)).filter((v): v is number => v !== null);
  return values.length >= 5 ? median(values)! : ADAPTIVE_POLICY.fallbackResponseMs;
}
export function mergePerformance(rows: Partial<PerformanceCounts>[]): PerformanceCounts {
  const result = emptyPerformance();
  for (const row of rows) for (const key of Object.keys(result) as (keyof PerformanceCounts)[])
    result[key] += Math.max(0, row[key] ?? 0);
  return result;
}
export function eventPerformance(event: LearningAnswerEvent, baseline: number = ADAPTIVE_POLICY.fallbackResponseMs): PerformanceCounts {
  const success = event.outcome === "correct" || event.outcome === "mastered";
  const time = validResponseMs(event.responseMs);
  const master = event.statusBefore === "MASTERED";
  return { attempts: 1, correct: success ? 1 : 0, wrong: event.outcome === "wrong" ? 1 : 0,
    unknown: event.outcome === "skip" ? 1 : 0, responseCount: time === null ? 0 : 1,
    responseTotalMs: time ?? 0, slowCorrect: success && time !== null && time > baseline * ADAPTIVE_POLICY.slowRatio ? 1 : 0,
    newAttempts: event.statusBefore === "NEW" ? 1 : 0,
    classifiedAttempts: event.statusBefore ? 1 : 0,
    masterChecks: master ? 1 : 0, masterRetained: master && success ? 1 : 0,
    lapses: master && !success ? 1 : 0 };
}

export interface PriorityInput {
  attempts: number; correct: number; wrong: number; skips: number; wrongStreak: number;
  lastOutcome: string | null; lastAnsweredAt: number; evidence?: ItemEvidence;
}
/** Explainable scheduling heuristic, not a calibrated probability of remembering. */
export function calculateLearningNeed(stats: PriorityInput | undefined, options: {
  status?: EvidenceStatus; now?: number; lastStudiedAt?: number;
  baselineMs?: number; recentlySeen?: boolean; legacyWrong?: boolean;
} = {}) {
  const now = options.now ?? Date.now();
  const status = options.status === "NEW" && stats?.attempts ? "ACTIVE" : options.status ?? (stats?.attempts ? "ACTIVE" : "NEW");
  const evidence = stats?.evidence;
  const successAt = evidence?.lastSuccessAt ||
    ((stats?.lastOutcome === "correct" || stats?.lastOutcome === "mastered") ? stats.lastAnsweredAt : 0) || options.lastStudiedAt || 0;
  const elapsedDays = successAt ? Math.max(0, (now - successAt) / 86400000) : ADAPTIVE_POLICY.initialElapsedDays;
  const stabilityDays = Math.min(ADAPTIVE_POLICY.maximumStabilityDays, Math.pow(2, Math.min(ADAPTIVE_POLICY.maximumSpacedPower, evidence?.spacedSuccesses ?? 0)));
  const forgettingRisk = ADAPTIVE_POLICY.forgettingFloor + Math.min(ADAPTIVE_POLICY.maximumForgettingRisk, elapsedDays / stabilityDays);
  const attempts = stats?.attempts ?? 0;
  const typeFailure = attempts ? ((stats?.wrong ?? 0) + (stats?.skips ?? 0)) / attempts : 0;
  const recent = evidence?.recent ?? [];
  const recentFailures = recent.filter(e => e.outcome === "wrong" || e.outcome === "skip").length;
  const recentRate = recent.length ? recentFailures / recent.length : typeFailure;
  const repeated = 1 + ADAPTIVE_POLICY.repeatedFailureWeight * Math.pow(Math.min(ADAPTIVE_POLICY.maximumFailureStreak, stats?.wrongStreak ?? 0), 2);
  const lastTime = evidence?.lastResponseMs;
  const baseline = options.baselineMs ?? ADAPTIVE_POLICY.fallbackResponseMs;
  const slow = stats?.lastOutcome === "correct" && lastTime != null && lastTime > baseline * ADAPTIVE_POLICY.slowRatio;
  const fast = stats?.lastOutcome === "correct" && !evidence?.lastHintUsed && lastTime != null && lastTime < baseline * ADAPTIVE_POLICY.fastRatio;
  const lastPenalty = stats?.lastOutcome === "skip" ? ADAPTIVE_POLICY.unknownPenalty
    : stats?.lastOutcome === "wrong" ? ADAPTIVE_POLICY.wrongPenalty
    : slow ? ADAPTIVE_POLICY.slowCorrectPenalty : fast ? ADAPTIVE_POLICY.fastCorrectReward : 1;
  const stateWeight = ADAPTIVE_POLICY.stateWeights[status];
  const difficulty = 1 + typeFailure * ADAPTIVE_POLICY.typeWeaknessWeight;
  const recentWeight = 1 + recentRate * ADAPTIVE_POLICY.recentFailureWeight;
  const successReward = Math.pow(ADAPTIVE_POLICY.spacedSuccessReward, Math.min(ADAPTIVE_POLICY.maximumRewardSuccesses, evidence?.spacedSuccesses ?? 0));
  const lapseWeight = 1 + Math.min(ADAPTIVE_POLICY.maximumLapses, evidence?.lapses ?? 0) * ADAPTIVE_POLICY.lapsePenalty;
  const cooldown = options.recentlySeen && stats?.lastOutcome !== "wrong" && stats?.lastOutcome !== "skip" ? ADAPTIVE_POLICY.recentPenalty : 1;
  const score = Math.max(ADAPTIVE_POLICY.minimumWeight,
    forgettingRisk * difficulty * recentWeight * repeated * lastPenalty * stateWeight * successReward * lapseWeight * cooldown + (options.legacyWrong ? ADAPTIVE_POLICY.legacyWrongBonus : 0));
  const reasons: string[] = [];
  if (!attempts) reasons.push("아직 풀이 기록이 없습니다");
  if (stats?.lastOutcome === "skip") reasons.push("마지막 응답이 모름입니다");
  if (stats?.lastOutcome === "wrong") reasons.push("마지막 응답이 오답입니다");
  if (recentFailures) reasons.push(`최근 ${recent.length}회 중 ${recentFailures}회 실패`);
  if (attempts) reasons.push(`이 유형 ${stats?.correct ?? 0}/${attempts} 정답`);
  if (slow) reasons.push("이 유형의 평소 속도보다 느린 정답");
  if (evidence?.lastHintUsed) reasons.push("마지막 정답에 힌트 사용");
  if (cooldown < 1) reasons.push("최근 출제되어 반복을 잠시 줄입니다");
  if (options.legacyWrong) reasons.push("오답 목록에 등록된 표현입니다");
  if (evidence?.lapses) reasons.push(`MASTER 이후 기억 실패 ${evidence.lapses}회`);
  if (status === "MASTERED" && elapsedDays >= stabilityDays) reasons.push("시간이 지나 기억 재검증 예정");
  if (evidence?.spacedSuccesses) reasons.push(`시간 간격을 둔 성공 ${evidence.spacedSuccesses}회`);
  return { score, level: score >= ADAPTIVE_POLICY.veryHighNeed ? "매우 높음" : score >= ADAPTIVE_POLICY.highNeed ? "높음" : score >= 1 ? "보통" : "낮음", reasons, stabilityDays, elapsedDays };
}
