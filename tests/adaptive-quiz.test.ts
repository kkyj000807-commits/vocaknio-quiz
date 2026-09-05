import { describe, expect, it } from "vitest";

import {
  ADAPTIVE_HISTORY_SCHEMA_VERSION,
  createEmptyAdaptiveHistory,
  deserializeAdaptiveHistory,
  recordAdaptiveAnswer,
  recordAdaptiveSession,
  sanitizeAdaptiveHistory,
  selectAdaptiveItemNums,
  serializeAdaptiveHistory,
  type AdaptiveCandidate,
  type AdaptiveHistory,
  type AdaptiveItemStats,
} from "@/lib/adaptive-quiz";

const MODE = "syn-choice";

function candidates(count: number, conceptSize = 1): AdaptiveCandidate[] {
  return Array.from({ length: count }, (_, index) => ({
    num: index + 1,
    conceptId: `concept-${Math.floor(index / conceptSize) + 1}`,
  }));
}

function constantRandom(value = 0.5): () => number {
  return () => value;
}

function deterministicRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = Math.imul(state, 1664525) + 1013904223;
    return (state >>> 0) / 4294967296;
  };
}

function itemStats(
  history: AdaptiveHistory,
  mode: string,
  num: number,
): AdaptiveItemStats | undefined {
  return Object.values(history.stats).find(
    (stats) => stats.mode === mode && stats.num === num,
  );
}

function putStats(
  history: AdaptiveHistory,
  mode: string,
  num: number,
  overrides: Partial<AdaptiveItemStats>,
): void {
  history.stats[`${mode}\u0000${num}`] = {
    mode,
    num,
    exposures: 0,
    attempts: 0,
    correct: 0,
    wrong: 0,
    skips: 0,
    mastered: 0,
    wrongStreak: 0,
    lastSeenSequence: 0,
    lastAnsweredAt: 0,
    lastOutcome: null,
    confusions: [],
    ...overrides,
  };
}

describe("adaptive quiz history", () => {
  it("creates schema v1 and recovers safely from corrupt or unsupported state", () => {
    expect(createEmptyAdaptiveHistory()).toEqual({
      schemaVersion: ADAPTIVE_HISTORY_SCHEMA_VERSION,
      revision: 0,
      nextSessionSequence: 1,
      stats: {},
      recentSessions: [],
      seenSessionIds: [],
      processedAnswerKeys: [],
    });
    expect(deserializeAdaptiveHistory("{broken")).toEqual(
      createEmptyAdaptiveHistory(),
    );
    expect(deserializeAdaptiveHistory(null)).toEqual(
      createEmptyAdaptiveHistory(),
    );
    expect(
      sanitizeAdaptiveHistory({ schemaVersion: 99, stats: { bad: true } }),
    ).toEqual(createEmptyAdaptiveHistory());
  });

  it("serializes schema v1 as compact tuples and round-trips sanitized history", () => {
    let history = recordAdaptiveSession(createEmptyAdaptiveHistory(), {
      sessionId: "session-1",
      rangeId: "v601",
      mode: MODE,
      itemNums: [3, 3, 4],
    });
    history = recordAdaptiveAnswer(history, {
      sessionId: "session-1",
      itemNum: 3,
      mode: MODE,
      outcome: "wrong",
      responseKey: "confused-with-9",
      answeredAt: 1234,
    });

    const serialized = serializeAdaptiveHistory(history);
    const raw = JSON.parse(serialized);
    expect(Array.isArray(raw)).toBe(true);
    expect(raw[0]).toBe(1);
    expect(Array.isArray(raw[3][0])).toBe(true);
    expect(deserializeAdaptiveHistory(serialized)).toEqual(
      sanitizeAdaptiveHistory(history),
    );
  });

  it("keeps stats sparse by mode and item number", () => {
    let history = recordAdaptiveSession(createEmptyAdaptiveHistory(), {
      sessionId: "syn-session",
      rangeId: "all",
      mode: "syn-choice",
      itemNums: [7],
    });
    history = recordAdaptiveSession(history, {
      sessionId: "meaning-session",
      rangeId: "all",
      mode: "kor-choice",
      itemNums: [7],
    });

    expect(Object.values(history.stats)).toHaveLength(2);
    expect(itemStats(history, "syn-choice", 7)?.exposures).toBe(1);
    expect(itemStats(history, "kor-choice", 7)?.exposures).toBe(1);
  });

  it("ignores a duplicate session id without double-counting exposure", () => {
    const once = recordAdaptiveSession(createEmptyAdaptiveHistory(), {
      sessionId: "same-session",
      rangeId: "idioms",
      mode: MODE,
      itemNums: [1, 2],
    });
    const twice = recordAdaptiveSession(once, {
      sessionId: "same-session",
      rangeId: "idioms",
      mode: MODE,
      itemNums: [1, 2, 3],
    });

    expect(twice.revision).toBe(once.revision);
    expect(twice.recentSessions).toHaveLength(1);
    expect(itemStats(twice, MODE, 1)?.exposures).toBe(1);
    expect(itemStats(twice, MODE, 3)).toBeUndefined();
  });

  it("ignores repeated answers for the same session, mode, and item", () => {
    let history = recordAdaptiveSession(createEmptyAdaptiveHistory(), {
      sessionId: "answer-session",
      rangeId: "v601",
      mode: MODE,
      itemNums: [5],
    });
    history = recordAdaptiveAnswer(history, {
      sessionId: "answer-session",
      itemNum: 5,
      mode: MODE,
      outcome: "wrong",
      responseKey: "first-choice",
    });
    const duplicate = recordAdaptiveAnswer(history, {
      sessionId: "answer-session",
      itemNum: 5,
      mode: MODE,
      outcome: "correct",
      responseKey: "second-choice",
    });

    expect(duplicate.revision).toBe(history.revision);
    expect(itemStats(duplicate, MODE, 5)).toMatchObject({
      attempts: 1,
      correct: 0,
      wrong: 1,
      wrongStreak: 1,
      confusions: [{ key: "first-choice", count: 1 }],
    });
  });

  it("keeps only the three strongest confusion keys", () => {
    let history = createEmptyAdaptiveHistory();
    const responses = ["alpha", "beta", "gamma", "delta", "alpha", "beta"];
    responses.forEach((responseKey, index) => {
      history = recordAdaptiveAnswer(history, {
        sessionId: `confusion-session-${index}`,
        itemNum: 9,
        mode: MODE,
        outcome: "wrong",
        responseKey,
      });
    });

    expect(itemStats(history, MODE, 9)?.confusions).toEqual([
      { key: "alpha", count: 2 },
      { key: "beta", count: 2 },
      { key: "delta", count: 2 },
    ]);
  });

  it("caps recent sessions at twelve while retaining session-id idempotency", () => {
    let history = createEmptyAdaptiveHistory();
    for (let index = 1; index <= 15; index += 1) {
      history = recordAdaptiveSession(history, {
        sessionId: `session-${index}`,
        rangeId: "all",
        mode: MODE,
        itemNums: [index],
      });
    }

    expect(history.recentSessions).toHaveLength(12);
    expect(history.recentSessions[0].sessionId).toBe("session-4");
    expect(history.recentSessions[11].sessionId).toBe("session-15");

    const duplicateOldSession = recordAdaptiveSession(history, {
      sessionId: "session-1",
      rangeId: "all",
      mode: MODE,
      itemNums: [99],
    });
    expect(duplicateOldSession.revision).toBe(history.revision);
    expect(itemStats(duplicateOldSession, MODE, 99)).toBeUndefined();
  });
});

describe("adaptive quiz selection", () => {
  it("does not repeat a correct prompt under a different source number", () => {
    let history = recordAdaptiveSession(createEmptyAdaptiveHistory(), { sessionId: "duplicate-word", rangeId: "idioms", mode: MODE, itemNums: [1] });
    history = recordAdaptiveAnswer(history, { sessionId: "duplicate-word", itemNum: 1, mode: MODE, outcome: "correct", answeredAt: 1000 });
    const selected = selectAdaptiveItemNums({
      candidates: [{ num: 1, word: "sort out" }, { num: 2, word: " SORT   OUT " }, { num: 3, word: "give up" }],
      count: 1, mode: MODE, history, random: constantRandom(),
    });
    expect(selected).toEqual([3]);
  });

  it("covers unseen prompts before reusing answered-correct rows despite old wrong records", () => {
    const pool = candidates(160).map((item) => ({ ...item, word: `word ${item.num}` }));
    let history = createEmptyAdaptiveHistory();
    const seen = new Set<number>();
    const oldWrong: number[] = [];
    for (let session = 0; session < 8; session += 1) {
      const itemNums = selectAdaptiveItemNums({ candidates: pool, count: 20, mode: MODE, history, legacyWrongNums: oldWrong });
      expect(itemNums.filter((num) => seen.has(num))).toEqual([]);
      history = recordAdaptiveSession(history, { sessionId: `correct-${session}`, rangeId: "v601", mode: MODE, itemNums });
      for (const itemNum of itemNums) {
        seen.add(itemNum);
        oldWrong.push(itemNum);
        history = recordAdaptiveAnswer(history, { sessionId: `correct-${session}`, itemNum, mode: MODE, outcome: "correct", answeredAt: 1000 + session });
      }
    }
    expect(seen.size).toBe(160);
  });

  it("protects correct prompts for three relevant sessions after full coverage", () => {
    const pool = candidates(80);
    let history = createEmptyAdaptiveHistory();
    const sessions: number[][] = [];
    for (let session = 0; session < 10; session += 1) {
      const selected = selectAdaptiveItemNums({ candidates: pool, count: 20, mode: MODE, history });
      const protectedNums = new Set(sessions.slice(-3).flat());
      expect(selected.some((num) => protectedNums.has(num))).toBe(false);
      history = recordAdaptiveSession(history, { sessionId: `cycle-${session}`, rangeId: "idioms", mode: MODE, itemNums: selected });
      for (const itemNum of selected) history = recordAdaptiveAnswer(history, { sessionId: `cycle-${session}`, itemNum, mode: MODE, outcome: "correct", answeredAt: 1000 + session });
      sessions.push(selected);
    }
  });

  it("excludes the immediately previous session whenever enough alternatives exist", () => {
    const history = recordAdaptiveSession(createEmptyAdaptiveHistory(), {
      sessionId: "previous",
      rangeId: "v601",
      mode: MODE,
      itemNums: [1, 2, 3, 4, 5, 6, 7, 8],
    });
    const selected = selectAdaptiveItemNums({
      candidates: candidates(20),
      count: 8,
      mode: MODE,
      history,
      random: constantRandom(),
    });

    expect(selected).toHaveLength(8);
    expect(selected.every((num) => num > 8)).toBe(true);
  });

  it("relaxes immediate exclusion only enough to fill a small pool", () => {
    const history = recordAdaptiveSession(createEmptyAdaptiveHistory(), {
      sessionId: "previous-small",
      rangeId: "idioms",
      mode: MODE,
      itemNums: [1, 2, 3, 4],
    });
    const selected = selectAdaptiveItemNums({
      candidates: candidates(6),
      count: 5,
      mode: MODE,
      history,
      random: constantRandom(),
    });

    expect(selected).toHaveLength(5);
    expect(new Set(selected)).toHaveLength(5);
    expect(selected).toEqual(expect.arrayContaining([5, 6]));
  });

  it("covers the full candidate range before starting an avoidable repeat cycle", () => {
    const pool = candidates(24);
    let history = createEmptyAdaptiveHistory();
    const covered = new Set<number>();

    for (let session = 1; session <= 4; session += 1) {
      const selected = selectAdaptiveItemNums({
        candidates: pool,
        count: 6,
        mode: MODE,
        history,
        random: deterministicRandom(session),
      });
      expect(selected).toHaveLength(6);
      selected.forEach((num) => covered.add(num));
      history = recordAdaptiveSession(history, {
        sessionId: `coverage-${session}`,
        rangeId: "v601",
        mode: MODE,
        itemNums: selected,
      });
    }

    expect(covered.size).toBe(24);
    expect(
      Object.values(history.stats).every((stats) => stats.exposures === 1),
    ).toBe(true);
  });

  it("reserves no more than 25 percent for weak repeats and at least 75 percent for coverage", () => {
    const history = createEmptyAdaptiveHistory();
    for (let num = 1; num <= 4; num += 1) {
      putStats(history, MODE, num, {
        exposures: 5,
        attempts: 5,
        wrong: 5,
        wrongStreak: 5,
        lastOutcome: "wrong",
      });
    }
    const selected = selectAdaptiveItemNums({
      candidates: candidates(20),
      count: 8,
      mode: MODE,
      history,
      random: constantRandom(),
    });
    const weakSelected = selected.filter((num) => num <= 4);
    const unseenSelected = selected.filter((num) => num > 4);

    expect(weakSelected).toHaveLength(2);
    expect(unseenSelected).toHaveLength(6);
  });

  it("brings wrong and skipped items back after one protected session", () => {
    const pool = candidates(32);
    let history = recordAdaptiveSession(createEmptyAdaptiveHistory(), {
      sessionId: "weak-source",
      rangeId: "v601",
      mode: MODE,
      itemNums: [1, 2, 3, 4, 5, 6, 7, 8],
    });
    history = recordAdaptiveAnswer(history, {
      sessionId: "weak-source",
      itemNum: 1,
      mode: MODE,
      outcome: "wrong",
      responseKey: "confusion-a",
    });
    history = recordAdaptiveAnswer(history, {
      sessionId: "weak-source",
      itemNum: 2,
      mode: MODE,
      outcome: "skip",
    });

    const protectedSession = selectAdaptiveItemNums({
      candidates: pool,
      count: 8,
      mode: MODE,
      history,
      random: constantRandom(),
    });
    expect(protectedSession).not.toContain(1);
    expect(protectedSession).not.toContain(2);
    history = recordAdaptiveSession(history, {
      sessionId: "protected",
      rangeId: "v601",
      mode: MODE,
      itemNums: protectedSession,
    });

    const nextSession = selectAdaptiveItemNums({
      candidates: pool,
      count: 8,
      mode: MODE,
      history,
      random: constantRandom(),
    });
    expect(nextSession).toEqual(expect.arrayContaining([1, 2]));
  });

  it("retires the legacy wrong prior after a correct adaptive answer", () => {
    const history = createEmptyAdaptiveHistory();
    putStats(history, MODE, 1, { exposures: 8, attempts: 8, correct: 8, lastOutcome: "correct" });
    putStats(history, MODE, 2, { exposures: 8, attempts: 8, correct: 8, lastOutcome: "correct" });

    const selected = selectAdaptiveItemNums({
      candidates: candidates(20),
      count: 8,
      mode: MODE,
      history,
      legacyWrongNums: [1, 2],
      random: constantRandom(),
    });

    expect(selected.filter((num) => num <= 2)).toHaveLength(0);
  });

  it("promotes a repeatedly selected wrong item and its concept without exceeding 25 percent review", () => {
    const pool = candidates(20).map((candidate) => ({
      ...candidate,
      word: `word-${candidate.num}`,
    }));
    pool[0] = { num: 1, conceptId: "confused-concept", word: "look alike" };
    pool[1] = { num: 2, conceptId: "confused-concept", word: "concept peer" };

    const history = createEmptyAdaptiveHistory();
    putStats(history, MODE, 1, { exposures: 8, attempts: 8, correct: 8 });
    putStats(history, MODE, 2, { exposures: 8, attempts: 8, correct: 8 });
    putStats(history, MODE, 99, {
      attempts: 3,
      wrong: 3,
      wrongStreak: 3,
      lastOutcome: "wrong",
      confusions: [{ key: " LOOK   ALIKE ", count: 3 }],
    });

    const selected = selectAdaptiveItemNums({
      candidates: pool,
      count: 8,
      mode: MODE,
      history,
      random: constantRandom(),
    });
    const broadCoverage = selected.filter((num) => num >= 3 && num <= 20);

    expect(selected).toEqual(expect.arrayContaining([1, 2]));
    expect(selected.filter((num) => num === 1 || num === 2)).toHaveLength(2);
    expect(broadCoverage).toHaveLength(6);

    const baseline = sanitizeAdaptiveHistory(history);
    const source = itemStats(baseline, MODE, 99)!;
    source.confusions = [{ key: "not-in-the-pool", count: 3 }];
    const withoutMatchingResponse = selectAdaptiveItemNums({
      candidates: pool,
      count: 8,
      mode: MODE,
      history: baseline,
      random: constantRandom(),
    });
    expect(withoutMatchingResponse).not.toContain(1);
    expect(withoutMatchingResponse).not.toContain(2);
  });

  it("prefers a more recent equal-frequency confusion signal deterministically", () => {
    const pool = candidates(10).map((candidate) => ({
      ...candidate,
      word: `word-${candidate.num}`,
    }));
    const history = createEmptyAdaptiveHistory();
    history.nextSessionSequence = 11;
    putStats(history, MODE, 1, { exposures: 5, attempts: 5, correct: 5 });
    putStats(history, MODE, 2, { exposures: 5, attempts: 5, correct: 5 });
    putStats(history, MODE, 98, {
      lastSeenSequence: 1,
      confusions: [{ key: "word-2", count: 2 }],
    });
    putStats(history, MODE, 99, {
      lastSeenSequence: 10,
      confusions: [{ key: "word-1", count: 2 }],
    });

    const selected = selectAdaptiveItemNums({
      candidates: pool,
      count: 4,
      mode: MODE,
      history,
      random: constantRandom(),
    });

    expect(selected).toContain(1);
    expect(selected).not.toContain(2);
    expect(selected.filter((num) => num >= 3)).toHaveLength(3);
  });

  it("spreads a session across concepts before relaxing the diversity guard", () => {
    const pool: AdaptiveCandidate[] = [
      { num: 1, conceptId: "a" },
      { num: 2, conceptId: "a" },
      { num: 3, conceptId: "b" },
      { num: 4, conceptId: "b" },
      { num: 5, conceptId: "c" },
      { num: 6, conceptId: "c" },
      { num: 7, conceptId: "d" },
      { num: 8, conceptId: "d" },
    ];
    const selected = selectAdaptiveItemNums({
      candidates: pool,
      count: 4,
      mode: MODE,
      history: createEmptyAdaptiveHistory(),
      random: constantRandom(),
    });
    const concepts = new Set(
      selected.map(
        (num) => pool.find((candidate) => candidate.num === num)?.conceptId,
      ),
    );

    expect(concepts.size).toBe(4);
  });

  it("selects the same normalized prompt word only once when alternatives exist", () => {
    const pool: AdaptiveCandidate[] = [
      { num: 1, conceptId: "a", word: "Sort   Out" },
      { num: 2, conceptId: "b", word: " sort out " },
      { num: 3, conceptId: "c", word: "dig up" },
      { num: 4, conceptId: "d", word: "blind alley" },
      { num: 5, conceptId: "e", word: "curry favor" },
      { num: 6, conceptId: "f", word: "abide by" },
    ];
    const selected = selectAdaptiveItemNums({
      candidates: pool,
      count: 5,
      mode: MODE,
      history: createEmptyAdaptiveHistory(),
      random: constantRandom(),
    });

    expect(selected).toHaveLength(5);
    expect(selected.filter((num) => num === 1 || num === 2)).toHaveLength(1);
  });

  it("relaxes prompt-word diversity when a tiny pool cannot otherwise fill the count", () => {
    const pool: AdaptiveCandidate[] = [
      { num: 1, conceptId: "a", word: "sort out" },
      { num: 2, conceptId: "a", word: "SORT OUT" },
      { num: 3, conceptId: "a", word: " sort   out " },
    ];
    const selected = selectAdaptiveItemNums({
      candidates: pool,
      count: 3,
      mode: MODE,
      history: createEmptyAdaptiveHistory(),
      random: constantRandom(),
    });

    expect(selected).toHaveLength(3);
    expect(new Set(selected)).toHaveLength(3);
  });

  it("is reproducible with an injected RNG and removes invalid or duplicate candidates", () => {
    const pool = [
      ...candidates(16),
      { num: 1, conceptId: "duplicate" },
      { num: 0, conceptId: "invalid" },
      { num: Number.NaN, conceptId: "invalid" },
    ];
    const options = {
      candidates: pool,
      count: 8,
      mode: MODE,
      history: createEmptyAdaptiveHistory(),
    };
    const first = selectAdaptiveItemNums({
      ...options,
      random: deterministicRandom(42),
    });
    const second = selectAdaptiveItemNums({
      ...options,
      random: deterministicRandom(42),
    });

    expect(second).toEqual(first);
    expect(first).toHaveLength(8);
    expect(new Set(first)).toHaveLength(8);
    expect(first.every((num) => Number.isInteger(num) && num > 0)).toBe(true);
  });
});
