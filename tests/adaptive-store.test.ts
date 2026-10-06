import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  ADAPTIVE_QUIZ_HISTORY_KEY,
  loadAdaptiveQuizHistory,
  loadStats,
  loadWrongWords,
  prepareAdaptiveQuizSession,
  recordOneAnswer,
  getLearningStorageIssue,
  retryLearningStorage,
  loadLearningSnapshot,
} from "@/lib/store";
import { VOCAB } from "@/lib/vocab";
import { getItemLearningTargets, getQuestionLearningTargetKey, parseLearningReviewKeys } from "@/lib/canonical-learning";
import { buildLearningStatistics, buildStatisticsReviewParams } from "@/lib/learning-statistics";
import { buildQuizQuestions } from "@/lib/quiz-engine";

const storageMock = vi.hoisted(() => {
  const values = new Map<string, string>();
  let failNextMultiSet = false;
  let storageUnavailable = false;

  return {
    values,
    reset() {
      values.clear();
      failNextMultiSet = false;
      storageUnavailable = false;
    },
    failOneMultiSet() {
      failNextMultiSet = true;
    },
    setUnavailable(value: boolean) { storageUnavailable = value; },
    async getItem(key: string) {
      if (storageUnavailable) throw new Error("storage unavailable");
      // Yield once so parallel answer calls would overlap without serialization.
      await Promise.resolve();
      return values.get(key) ?? null;
    },
    async setItem(key: string, value: string) {
      await Promise.resolve();
      values.set(key, value);
    },
    async multiSet(entries: [string, string][]) {
      if (storageUnavailable) throw new Error("storage unavailable");
      await Promise.resolve();
      if (failNextMultiSet) {
        failNextMultiSet = false;
        throw new Error("simulated storage failure");
      }
      for (const [key, value] of entries) values.set(key, value);
    },
  };
});

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: storageMock.getItem,
    setItem: storageMock.setItem,
    multiSet: storageMock.multiSet,
  },
}));

describe("adaptive quiz storage", () => {
  beforeEach(() => {
    storageMock.reset();
  });
  it("does not present corrupted evidence as healthy zero statistics", async () => {
    storageMock.values.set(ADAPTIVE_QUIZ_HISTORY_KEY, "{broken");
    await expect(loadLearningSnapshot()).rejects.toThrow("unreadable");
    expect(storageMock.values.get(ADAPTIVE_QUIZ_HISTORY_KEY)).toBe("{broken");
  });

  it.each([["without fail", 1], ["rule of thumb", 0], ["conducive to", 0], ["a wide range of", 0], ["zoom in on", 0]] as const)("connects %s response to weakness, exact-sense review and the next saved result", async (headword, targetIndex) => {
    const item = VOCAB.find(row => row.w === headword)!;
    const targets = getItemLearningTargets(item);
    expect(targets.length).toBe(headword === "without fail" ? 2 : 1);
    const key = targets[targetIndex].key;
    const question = buildQuizQuestions({ mode: "definition-choice", itemNums: [item.num], learningTargetKeys: [key], count: 1 })[0];
    expect(getQuestionLearningTargetKey(question)).toBe(key);
    await recordOneAnswer(false, item.num, { sessionId: "stats-flow-failure", itemNum: item.num, mode: question.mode, outcome: "skip", learningTargetKey: key, answeredAt: Date.now(), responseMs: 4200 });
    const metadata = targets.map(target => ({ num: item.num, word: item.w, sourceId: item.id, groupId: item.group, learningKey: target.key }));
    const first = await loadLearningSnapshot();
    const model = buildLearningStatistics(first.history, first.learning, metadata);
    expect(model.words[0].status).toBe("RELEARNING");
    const params = buildStatisticsReviewParams(model)!;
    expect(params).toMatchObject({ mode: "definition-choice", bookmarkNums: String(item.num), reviewKeys: JSON.stringify([key]) });
    const selected = await prepareAdaptiveQuizSession({ sessionId: "stats-flow-review", mode: params.mode, rangeId: params.rangeId, count: 1, candidates: [{ num: item.num, word: item.w, learningKey: key, learningStatus: model.words[0].status }] });
    const review = buildQuizQuestions({ mode: "definition-choice", itemNums: selected, learningTargetKeys: parseLearningReviewKeys(decodeURIComponent(params.reviewKeys), [item]), count: 1 })[0];
    expect(getQuestionLearningTargetKey(review)).toBe(key);
    const response = { sessionId: "stats-flow-review", itemNum: item.num, mode: review.mode, outcome: "correct" as const, learningTargetKey: key, answeredAt: Date.now(), responseMs: 2000 };
    await recordOneAnswer(true, undefined, response); await recordOneAnswer(true, undefined, response);
    const reopened = await loadLearningSnapshot();
    const updated = buildLearningStatistics(reopened.history, reopened.learning, metadata);
    expect(reopened.stats).toMatchObject({ totalAnswered: 2, totalCorrect: 1 });
    expect(reopened.history.events).toHaveLength(2);
    expect(updated.accuracy).toBe(50);
    expect(updated.words[0].need.score).toBeLessThan(model.words[0].need.score);
    for (const other of targets.filter(target => target.key !== key)) expect(reopened.learning.targets[other.key]).toBeUndefined();
    expect(updated.stateCounts.MASTERED).toBe(0);
    expect(buildStatisticsReviewParams(updated, item.group === "V101" ? "V601" : "V101")).toBeNull();
  });

  it("restores exact keys after URL decoding and never maps an unknown key to another meaning", () => {
    const item = VOCAB.find(row => row.w === "without fail")!;
    const key = getItemLearningTargets(item)[1].key;
    expect(parseLearningReviewKeys(decodeURIComponent(key), [item])).toEqual([key]);
    expect(parseLearningReviewKeys(decodeURIComponent(JSON.stringify([key])), [item])).toEqual([key]);
    const unknown = "sense:without-fail:unknown";
    expect(buildQuizQuestions({ mode: "definition-choice", itemNums: [item.num], learningTargetKeys: parseLearningReviewKeys(unknown, [item]), count: 1 })).toEqual([]);
    const legacy = VOCAB.find(row => getItemLearningTargets(row)[0].kind === "legacy-equivalence" && getItemLearningTargets(row)[0].key.includes("%2C"))!;
    expect(legacy).toBeTruthy();
    const legacyKey = getItemLearningTargets(legacy)[0].key;
    expect(parseLearningReviewKeys(decodeURIComponent(JSON.stringify([legacyKey])), [legacy])).toEqual([legacyKey]);
  });

  it("persists actual source-group responses once and reopens the same 70/20 aggregation", async () => {
    const items = [VOCAB.find(item => item.group === "V101")!, VOCAB.find(item => item.group === "V601")!];
    for (const [index, correct] of [[0, 7], [1, 2]]) for (let i = 0; i < 10; i++) {
      const item = items[index]; const correctAnswer = i < correct;
      const context = { sessionId: `source-${index}-${i}`, itemNum: item.num, mode: "kor-choice", outcome: correctAnswer ? "correct" as const : "skip" as const,
        responseMs: 4200, answeredAt: Date.now(), learningTargetKey: getItemLearningTargets(item)[0].key };
      await recordOneAnswer(correctAnswer, item.num, context);
      await recordOneAnswer(correctAnswer, item.num, context);
    }
    const reopened = await loadLearningSnapshot();
    const metadata = items.map(item => ({ num: item.num, word: item.w, sourceId: item.id, groupId: item.group, learningKey: getItemLearningTargets(item)[0].key }));
    const model = buildLearningStatistics(reopened.history, reopened.learning, metadata);
    expect(reopened.stats).toMatchObject({ totalAnswered: 20, totalCorrect: 9 });
    expect(model.groups.find(row => row.id === "V101")?.accuracy).toBe(70);
    expect(model.groups.find(row => row.id === "V601")?.accuracy).toBe(20);
    expect(reopened.history.events).toHaveLength(20);
    expect(model.performance.responseCount).toBe(20);
    expect(model.stateCounts.RELEARNING).toBe(2);
    expect(storageMock.values.get(ADAPTIVE_QUIZ_HISTORY_KEY)).toContain("4200");
  });

  it("counts one answer once even when the same event is delivered in parallel", async () => {
    const answer = { sessionId: "double-tap", itemNum: 900, mode: "kor-choice", outcome: "wrong" as const };
    await Promise.all(Array.from({ length: 8 }, () => recordOneAnswer(false, 900, answer)));
    expect(await loadStats()).toMatchObject({ totalAnswered: 1, totalCorrect: 0 });
    expect(await loadWrongWords()).toEqual([900]);
    const history = await loadAdaptiveQuizHistory();
    expect(Object.values(history.stats)[0].attempts).toBe(1);
    await recordOneAnswer(true, undefined, { ...answer, sessionId: "next-session", outcome: "correct" });
    expect(await loadStats()).toMatchObject({ totalAnswered: 2, totalCorrect: 1 });
  });

  it("reports unsaved writes and retries without adding another answer", async () => {
    await loadStats(); await loadWrongWords(); await loadAdaptiveQuizHistory();
    storageMock.failOneMultiSet();
    await recordOneAnswer(true, undefined, { sessionId: "retry-test", itemNum: 800, mode: "kor-choice", outcome: "correct" });
    expect(getLearningStorageIssue()).not.toBeNull();
    await retryLearningStorage();
    expect(getLearningStorageIssue()).toBeNull();
    expect(await loadStats()).toMatchObject({ totalAnswered: 1, totalCorrect: 1 });
  });

  it("serializes 20 parallel answers without losing stats, wrong words, or item history", async () => {
    await Promise.all(
      Array.from({ length: 20 }, (_, index) => {
        const itemNum = 1000 + index;
        const isCorrect = index % 2 === 0;
        return recordOneAnswer(isCorrect, isCorrect ? undefined : itemNum, {
          sessionId: "parallel-session",
          itemNum,
          mode: "kor-choice",
          outcome: isCorrect ? "correct" : "wrong",
          answeredAt: 1_700_000_000_000 + index,
        });
      }),
    );

    const [stats, wrongWords, history] = await Promise.all([
      loadStats(),
      loadWrongWords(),
      loadAdaptiveQuizHistory(),
    ]);

    expect(stats.totalAnswered).toBe(20);
    expect(stats.totalCorrect).toBe(10);
    expect(wrongWords).toEqual(
      Array.from({ length: 10 }, (_, index) => 1001 + index * 2),
    );
    expect(Object.keys(history.stats)).toHaveLength(20);
    expect(
      Object.values(history.stats).every((item) => item.attempts === 1),
    ).toBe(true);
  });

  it("recovers the mutation queue after one storage write fails", async () => {
    storageMock.failOneMultiSet();
    await recordOneAnswer(false, 2001, {
      sessionId: "failure-session",
      itemNum: 2001,
      mode: "kor-choice",
      outcome: "wrong",
    });
    await recordOneAnswer(true, undefined, {
      sessionId: "recovery-session",
      itemNum: 2002,
      mode: "kor-choice",
      outcome: "correct",
    });

    const [stats, wrongWords, history] = await Promise.all([
      loadStats(),
      loadWrongWords(),
      loadAdaptiveQuizHistory(),
    ]);
    expect(stats.totalAnswered).toBe(2);
    expect(stats.totalCorrect).toBe(1);
    expect(wrongWords).toEqual([2001]);
    expect(Object.keys(history.stats)).toHaveLength(2);
  });

  it("keeps legacy recordOneAnswer calls compatible and does not create adaptive data", async () => {
    await recordOneAnswer(false, 777);
    await recordOneAnswer(true);

    expect(await loadStats()).toMatchObject({
      totalAnswered: 2,
      totalCorrect: 1,
    });
    expect(await loadWrongWords()).toEqual([777]);
    expect(storageMock.values.has(ADAPTIVE_QUIZ_HISTORY_KEY)).toBe(false);
  });

  it("retains answers and rotates sessions through storage failure, then persists them", async () => {
    const options = {
      rangeId: "idioms", mode: "kor-choice" as const, count: 8,
      candidates: Array.from({ length: 40 }, (_, i) => ({ num: i + 1, word: `phrase ${i + 1}` })),
    };
    const first = await prepareAdaptiveQuizSession({ ...options, sessionId: "offline-first" });
    await loadStats();
    storageMock.setUnavailable(true);
    for (const itemNum of first) await recordOneAnswer(true, undefined, { sessionId: "offline-first", itemNum, mode: options.mode, outcome: "correct" });
    const second = await prepareAdaptiveQuizSession({ ...options, sessionId: "offline-second" });
    expect(second.some((num) => first.includes(num))).toBe(false);
    const third = await prepareAdaptiveQuizSession({ ...options, sessionId: "offline-third" });
    expect(third.some((num) => first.includes(num) || second.includes(num))).toBe(false);
    storageMock.setUnavailable(false);
    await prepareAdaptiveQuizSession({ ...options, sessionId: "online-fourth" });
    const history = await loadAdaptiveQuizHistory();
    expect(history.recentSessions).toHaveLength(4);
    expect(Object.values(history.stats).filter((item) => item.lastOutcome === "correct")).toHaveLength(8);
    expect((await loadStats()).totalCorrect).toBe(8);
  });

  it("can show questions without overwriting corrupt history or unrelated records", async () => {
    storageMock.values.set(ADAPTIVE_QUIZ_HISTORY_KEY, "{broken");
    storageMock.values.set("vocaknio_wrong_words", JSON.stringify([2]));
    storageMock.values.set("vocaknio_bookmarks", "bookmark-sentinel");
    storageMock.values.set("vocaknio_mastered", "mastered-sentinel");
    storageMock.values.set("vocaknio_vocab_storage_version", "v1.4");

    const selected = await prepareAdaptiveQuizSession({
      sessionId: "corrupt-fallback-session",
      rangeId: "v601",
      mode: "kor-choice",
      candidates: [1, 2, 3, 4].map((num) => ({ num, conceptId: `c${num}` })),
      count: 2,
    });

    expect(selected).toHaveLength(2);
    expect(new Set(selected).size).toBe(2);
    expect(storageMock.values.get(ADAPTIVE_QUIZ_HISTORY_KEY)).toBe("{broken");
    expect(getLearningStorageIssue()).not.toBeNull();
    await retryLearningStorage();
    expect(storageMock.values.get(ADAPTIVE_QUIZ_HISTORY_KEY)).toBe("{broken");
    expect(storageMock.values.get("vocaknio_wrong_words")).toBe(
      JSON.stringify([2]),
    );
    expect(storageMock.values.get("vocaknio_bookmarks")).toBe(
      "bookmark-sentinel",
    );
    expect(storageMock.values.get("vocaknio_mastered")).toBe(
      "mastered-sentinel",
    );
    expect(storageMock.values.get("vocaknio_vocab_storage_version")).toBe(
      "v1.4",
    );
  });
});
