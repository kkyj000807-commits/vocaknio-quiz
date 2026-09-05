import { beforeEach, describe, expect, it, vi } from "vitest";

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

import {
  ADAPTIVE_QUIZ_HISTORY_KEY,
  loadAdaptiveQuizHistory,
  loadStats,
  loadWrongWords,
  prepareAdaptiveQuizSession,
  recordOneAnswer,
} from "@/lib/store";

describe("adaptive quiz storage", () => {
  beforeEach(() => {
    storageMock.reset();
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

  it("falls back from corrupt history and changes only the new adaptive key", async () => {
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
    expect(() =>
      JSON.parse(storageMock.values.get(ADAPTIVE_QUIZ_HISTORY_KEY)!),
    ).not.toThrow();
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
