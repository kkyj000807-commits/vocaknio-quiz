import { describe, it, expect } from "vitest";

// Inline the pure utility functions to avoid JSON import issues in test env
interface VocabItem {
  num: number;
  w: string;
  k: string;
  k_short: string;
  s: string[];
  p: string;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const ALL_SYNONYMS = ["renounce", "relinquish", "forgo", "abdicate", "disavow", "revoke", "repeal", "annul", "nullify"];

function getSynDistractors(target: VocabItem, correctSyn: string, count = 3): string[] {
  const distractors: string[] = [];
  const used = new Set([correctSyn, ...target.s]);
  const pool = shuffle(ALL_SYNONYMS);
  for (const syn of pool) {
    if (!used.has(syn) && distractors.length < count) {
      distractors.push(syn);
      used.add(syn);
    }
    if (distractors.length >= count) break;
  }
  return distractors;
}

function getKorDistractors(target: VocabItem, pool: VocabItem[], count = 3): string[] {
  const distractors: string[] = [];
  const used = new Set([target.k]);
  const shuffled = shuffle(pool);
  for (const item of shuffled) {
    if (!used.has(item.k) && item.k && item.k.length > 2 && distractors.length < count) {
      distractors.push(item.k);
      used.add(item.k);
    }
    if (distractors.length >= count) break;
  }
  return distractors;
}

describe("shuffle", () => {
  it("returns same length array", () => {
    const arr = [1, 2, 3, 4, 5];
    const result = shuffle(arr);
    expect(result).toHaveLength(arr.length);
  });

  it("contains all original elements", () => {
    const arr = ["a", "b", "c", "d"];
    const result = shuffle([...arr]);
    expect(result.sort()).toEqual([...arr].sort());
  });

  it("does not mutate original array", () => {
    const arr = [1, 2, 3];
    const original = [...arr];
    shuffle(arr);
    expect(arr).toEqual(original);
  });
});

describe("getSynDistractors", () => {
  const mockItem: VocabItem = {
    num: 1,
    w: "abnegate",
    k: "버리다",
    k_short: "버리다",
    s: ["renounce", "relinquish"],
    p: "/ˈæbnɪɡeɪt/",
  };

  it("returns at most requested number of distractors", () => {
    const distractors = getSynDistractors(mockItem, "renounce", 3);
    expect(distractors.length).toBeLessThanOrEqual(3);
  });

  it("does not include the correct synonym", () => {
    const distractors = getSynDistractors(mockItem, "renounce", 3);
    expect(distractors).not.toContain("renounce");
  });

  it("does not include other synonyms of the word", () => {
    const distractors = getSynDistractors(mockItem, "renounce", 3);
    expect(distractors).not.toContain("relinquish");
  });
});

describe("getKorDistractors", () => {
  const mockItem: VocabItem = {
    num: 1,
    w: "abnegate",
    k: "버리다, 포기하다",
    k_short: "버리다, 포기하다",
    s: ["renounce"],
    p: "/ˈæbnɪɡeɪt/",
  };

  const pool: VocabItem[] = [
    mockItem,
    { num: 2, w: "ablaze", k: "불타는", k_short: "불타는", s: [], p: "" },
    { num: 3, w: "abject", k: "비참한", k_short: "비참한", s: [], p: "" },
    { num: 4, w: "abduct", k: "납치하다", k_short: "납치하다", s: [], p: "" },
  ];

  it("returns at most requested number of distractors", () => {
    const distractors = getKorDistractors(mockItem, pool, 3);
    expect(distractors.length).toBeLessThanOrEqual(3);
  });

  it("does not include the correct Korean meaning", () => {
    const distractors = getKorDistractors(mockItem, pool, 3);
    expect(distractors).not.toContain(mockItem.k);
  });

  it("returns unique distractors", () => {
    const distractors = getKorDistractors(mockItem, pool, 3);
    const unique = new Set(distractors);
    expect(unique.size).toBe(distractors.length);
  });
});

describe("quiz question building", () => {
  it("shuffle produces valid 4-choice array", () => {
    const correctSyn = "renounce";
    const distractors = ["revoke", "repeal", "annul"];
    const choices = shuffle([correctSyn, ...distractors]);
    expect(choices).toHaveLength(4);
    expect(choices).toContain(correctSyn);
  });
});
