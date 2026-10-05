import { describe, expect, it } from "vitest";
import { createEmptyAdaptiveHistory, deserializeAdaptiveHistory, recordAdaptiveAnswer, selectAdaptiveItemNums, serializeAdaptiveHistory, type AdaptiveHistory } from "@/lib/adaptive-quiz";
import { ADAPTIVE_POLICY, calculateLearningNeed, learningDay, validResponseMs } from "@/lib/learning-analytics";
import { buildLearningStatistics, type LearningItemMeta } from "@/lib/learning-statistics";
import { applyLearningEvent, createEmptySenseLearningState, getLearningTargetState } from "@/lib/learning-state";

const NOW = Date.parse("2026-10-05T12:00:00Z");
export const fixtureItems: LearningItemMeta[] = [
  { num: 1, sourceId: "TEST101", word: "abate", groupId: "v101", learningKey: "sense:abate" },
  { num: 2, sourceId: "TEST601", word: "gainsay", groupId: "v601", learningKey: "sense:gainsay" },
];
export function fixtureHistory() {
  let history = createEmptyAdaptiveHistory();
  for (const [itemNum, correct] of [[1, 7], [2, 2]]) for (let i = 0; i < 10; i++) {
    const item = fixtureItems[itemNum - 1];
    history = recordAdaptiveAnswer(history, { sessionId: `${itemNum}-${i}`, itemNum, mode: i % 2 ? "definition-choice" : "kor-choice", outcome: i < correct ? "correct" : "wrong", answeredAt: NOW - (10 - i) * 10000, presentedAt: NOW - (10 - i) * 10000 - 4200, responseMs: 4200, groupId: item.groupId, targetKey: item.learningKey, sourceId: item.sourceId, statusBefore: "ACTIVE", statusAfter: i < correct ? "ACTIVE" : "WEAK" });
  }
  return history;
}
const state = createEmptySenseLearningState();
function forOutcome(outcome: "correct" | "wrong" | "skip", ms = 5000, count = 1) {
  let history = createEmptyAdaptiveHistory();
  for (let i = 0; i < count; i++) history = recordAdaptiveAnswer(history, { sessionId: `s${i}`, itemNum: 1, mode: "definition-choice", outcome, responseMs: ms, answeredAt: NOW - (count - i - 1) * 86400000 });
  return Object.values(history.stats)[0];
}
describe("actual evidence drives selection and statistics", () => {
  it("V101 7/10 = 70%, V601 2/10 = 20%, distinct words != attempts", () => {
    const model = buildLearningStatistics(fixtureHistory(), state, fixtureItems, { now: NOW });
    expect(model.groups.find(g => g.id === "v101")).toMatchObject({ attempts: 10, correct: 7, accuracy: 70, uniqueWords: 1 });
    expect(model.groups.find(g => g.id === "v601")).toMatchObject({ attempts: 10, correct: 2, accuracy: 20, uniqueWords: 1 });
    expect(model.performance).toMatchObject({ attempts: 20, correct: 9 });
    expect(model.uniqueWords).toBe(2);
    expect(model.modes.map(m => [m.id, m.attempts, m.correct])).toEqual([["kor-choice", 10, 5], ["definition-choice", 10, 4]]);
    expect(model.meanMs).toBe(4200); expect(model.medianMs).toBe(4200);
  });
  it("unknown > wrong > slow correct > normal correct > fast correct; repetition is nonlinear", () => {
    const score = (outcome: "correct" | "wrong" | "skip", ms = 5000, count = 1) => calculateLearningNeed(forOutcome(outcome, ms, count), { now: NOW, status: "ACTIVE" }).score;
    expect(score("skip")).toBeGreaterThan(score("wrong"));
    expect(score("wrong")).toBeGreaterThan(score("correct", 20000));
    expect(score("correct", 20000)).toBeGreaterThan(score("correct", 5000));
    expect(score("correct", 5000)).toBeGreaterThan(score("correct", 2000));
    expect(score("wrong", 5000, 3)).toBeGreaterThan(score("wrong", 5000) * 2);
  });
  it("new/review allocation is observed, unknown old status is not fabricated, hints are not rewarded as fast recall", () => {
    let history = createEmptyAdaptiveHistory();
    for (const [i, statusBefore] of (["NEW", "ACTIVE", undefined] as const).entries()) history = recordAdaptiveAnswer(history, { sessionId: `allocation${i}`, itemNum: 1, mode: "kor-choice", outcome: "correct", responseMs: 1500, answeredAt: NOW + i, statusBefore });
    const model = buildLearningStatistics(history, state, fixtureItems, { now: NOW + 4 });
    expect(model.performance).toMatchObject({ newAttempts: 1, classifiedAttempts: 2, attempts: 3 });
    const hinted = recordAdaptiveAnswer(history, { sessionId: "hinted", itemNum: 1, mode: "kor-choice", outcome: "correct", responseMs: 1500, answeredAt: NOW + 5, hintUsed: true });
    const reopened = deserializeAdaptiveHistory(serializeAdaptiveHistory(hinted));
    expect(Object.values(reopened.stats)[0].evidence?.lastHintUsed).toBe(true);
    expect(calculateLearningNeed(Object.values(reopened.stats)[0], { now: NOW + 5 }).score).toBeGreaterThan(calculateLearningNeed(Object.values(history.stats)[0], { now: NOW + 5 }).score);
  });
  it("spaced fast successes reduce weight; MASTER retains nonzero weight and forgetting increases it", () => {
    const once = forOutcome("correct", 2000);
    const repeated = forOutcome("correct", 2000, 5);
    expect(repeated.evidence?.spacedSuccesses).toBe(4);
    expect(calculateLearningNeed(repeated, { now: NOW }).score).toBeLessThan(calculateLearningNeed(once, { now: NOW }).score);
    const fresh = calculateLearningNeed(repeated, { now: NOW, status: "MASTERED" }).score;
    expect(fresh).toBeGreaterThan(0);
    expect(calculateLearningNeed(repeated, { now: NOW + 90 * 86400000, status: "MASTERED" }).score).toBeGreaterThan(fresh);
  });
  it("a weak retrieval type remains weak despite success in another type", () => {
    let history = fixtureHistory();
    history = recordAdaptiveAnswer(history, { sessionId: "easy-success", itemNum: 2, mode: "kor-choice", outcome: "correct", answeredAt: NOW, responseMs: 2000, targetKey: "sense:gainsay" });
    const model = buildLearningStatistics(history, state, fixtureItems, { now: NOW });
    const word = model.words.find(w => w.word === "gainsay")!;
    expect(word.modes.find(m => m.mode === "definition-choice")?.correct).toBe(1);
    expect(word.need.reasons.some(r => r.includes("최근"))).toBe(true);
  });
  it("unknown enters RELEARNING, MASTER lapse is counted, one success cannot restore MASTER", () => {
    let learning = applyLearningEvent(state, { targetKey: "sense:abate", type: "mastered", occurredAt: NOW - 86400000 });
    learning = applyLearningEvent(learning, { targetKey: "sense:abate", type: "unknown", occurredAt: NOW });
    learning = applyLearningEvent(learning, { targetKey: "sense:abate", type: "correct", occurredAt: NOW + 1 });
    expect(getLearningTargetState(learning, "sense:abate").status).toBe("RELEARNING");
    const history = recordAdaptiveAnswer(createEmptyAdaptiveHistory(), { sessionId: "lapse", itemNum: 1, targetKey: "sense:abate", groupId: "v101", mode: "kor-choice", outcome: "wrong", answeredAt: NOW, statusBefore: "MASTERED", statusAfter: "RELEARNING" });
    const model = buildLearningStatistics(history, learning, fixtureItems, { now: NOW });
    expect(model.performance).toMatchObject({ masterChecks: 1, masterRetained: 0, lapses: 1 });
    expect(model.masterRetention).toBe(0); expect(model.stateCounts.RELEARNING).toBe(1);
  });
  it("cumulative and recent results differ; period/group/type filters reconcile with daily aggregates", () => {
    let history = fixtureHistory();
    for (let i = 0; i < 110; i++) history = recordAdaptiveAnswer(history, { sessionId: `recent-${i}`, itemNum: 1, groupId: "v101", targetKey: "sense:abate", mode: "kor-choice", outcome: "correct", answeredAt: NOW + i });
    const model = buildLearningStatistics(history, state, fixtureItems, { now: NOW + 1000 });
    expect(model.recentAccuracy).toBe(100); expect(model.accuracy).toBe(92);
    const filtered = buildLearningStatistics(history, state, fixtureItems, { now: NOW + 1000, period: "today", groupId: "v601", mode: "definition-choice" });
    expect(filtered.performance).toMatchObject({ correct: 1, attempts: 5 });
    expect(filtered.accuracy).toBe(20);
    expect(buildLearningStatistics(history, state, fixtureItems, { now: NOW + 10 * 86400000, period: "7days" }).performance.attempts).toBe(0);
  });
  it("duplicate responses, missing/idle times, and KST midnight do not corrupt measurements", () => {
    const input = { sessionId: "dup", itemNum: 1, mode: "kor-choice", outcome: "skip" as const, groupId: "v101", answeredAt: NOW, responseMs: 9_000_000 };
    const once = recordAdaptiveAnswer(createEmptyAdaptiveHistory(), input);
    expect(recordAdaptiveAnswer(once, input).revision).toBe(once.revision);
    const model = buildLearningStatistics(once, state, fixtureItems, { now: NOW });
    expect(model.performance).toMatchObject({ attempts: 1, unknown: 1, responseCount: 0 }); expect(model.meanMs).toBeNull();
    expect(validResponseMs(-10)).toBeNull(); expect(validResponseMs(NaN)).toBeNull();
    expect(learningDay(Date.parse("2026-10-05T14:59:59Z"))).toBe("2026-10-05");
    expect(learningDay(Date.parse("2026-10-05T15:00:00Z"))).toBe("2026-10-06");
  });
  it("round-trips old v1 and new telemetry without fabricating old time or events", () => {
    const old = deserializeAdaptiveHistory(JSON.stringify([1, 2, 1, [["kor-choice", 1, 7, 10, 7, 3, 0, 0, 0, 0, 0, "c", []]], [], [], []]));
    const model = buildLearningStatistics(old, state, fixtureItems, { now: NOW });
    expect(model.groups[0].accuracy).toBe(70); expect(model.meanMs).toBeNull(); expect(model.trend).toEqual([]);
    expect(deserializeAdaptiveHistory(serializeAdaptiveHistory(fixtureHistory()))).toEqual(fixtureHistory());
  });
  it("weighted sampling favors need without always picking the highest item, and avoids duplicate prompts", () => {
    const history = recordAdaptiveAnswer(createEmptyAdaptiveHistory(), { sessionId: "w", itemNum: 2, targetKey: "sense:gainsay", mode: "kor-choice", outcome: "skip", answeredAt: NOW });
    const sample = [...fixtureItems.map(i => ({ ...i, learningStatus: i.num === 2 ? "RELEARNING" as const : "MASTERED" as const })), { ...fixtureItems[1], num: 3 }];
    let seed = 12345;
    const random = () => { seed = Math.imul(seed, 1664525) + 1013904223; return (seed >>> 0) / 4294967296; };
    let weak = 0; let master = 0;
    for (let i = 0; i < 500; i++) {
      const picked = selectAdaptiveItemNums({ candidates: sample, count: 1, mode: "kor-choice", history, strategy: "weighted", random, now: NOW });
      if (picked[0] === 1) master++; else weak++;
    }
    expect(weak).toBeGreaterThan(master * 5);
    const selected = selectAdaptiveItemNums({ candidates: sample, count: 3, mode: "kor-choice", history, strategy: "weighted", random, now: NOW });
    expect(selected).toHaveLength(2);
    expect(new Set(selected)).toHaveLength(2);
  });
  it("empty users have honest no-data statistics; recent storage is bounded as lifetime grows", () => {
    const empty = buildLearningStatistics(createEmptyAdaptiveHistory(), state, fixtureItems, { now: NOW });
    expect(empty.accuracy).toBeNull(); expect(empty.masterRetention).toBeNull(); expect(empty.stateCounts.NEW).toBe(2);
    let history: AdaptiveHistory = createEmptyAdaptiveHistory();
    for (let i = 0; i < 1100; i++) history = recordAdaptiveAnswer(history, { sessionId: `bulk${i}`, itemNum: 1, mode: "kor-choice", outcome: "correct", groupId: "v101", answeredAt: NOW + i });
    expect(history.events?.length).toBe(ADAPTIVE_POLICY.recentEventLimit);
    expect(Object.values(history.stats)[0].attempts).toBe(1100);
    const start = performance.now();
    const model = buildLearningStatistics(history, state, fixtureItems, { now: NOW + 2000 });
    expect(model.performance.attempts).toBe(1100);
    expect(performance.now() - start).toBeLessThan(1000);
  });
  it("100,000 lifetime answers with 38,163 source rows aggregate without scanning 100,000 raw events", () => {
    const history = fixtureHistory();
    const [sample] = Object.values(history.stats);
    const items: LearningItemMeta[] = Array.from({ length: 38163 }, (_, i) => ({ num: i + 1, sourceId: `load-${i}`, word: `word-${i}`, groupId: i % 2 ? "v601" : "v101", learningKey: `target-${i}` }));
    history.stats = Object.fromEntries(items.map(item => [`kor-choice:${item.num}`, { ...sample, mode: "kor-choice", num: item.num, attempts: 2, correct: 1, wrong: 1, evidence: undefined }]));
    history.stats["kor-choice:1"].attempts += 100000 - 38163 * 2;
    history.stats["kor-choice:1"].wrong += 100000 - 38163 * 2;
    const started = performance.now();
    const model = buildLearningStatistics(history, state, items, { now: NOW });
    expect(model.performance.attempts).toBe(100000);
    expect(model.uniqueWords).toBe(38163); expect(model.words).toHaveLength(38163);
    expect(history.events).toHaveLength(20);
    expect(performance.now() - started).toBeLessThan(5000);
  }, 15000);
});
