import { describe, it, expect, vi, beforeAll } from "vitest";

// ─── vocab.json 모킹 ──────────────────────────────────────────────────────────
vi.mock("@/assets/vocab.json", () => ({
  default: [
    { num: 1, w: "apogee",     k: "정점, 절정",           k_short: "정점",       s: ["apex"],                       p: "" },
    { num: 2, w: "pinnacle",   k: "정점, 꼭대기",          k_short: "정점",       s: ["apex", "zenith", "summit"],   p: "" },
    { num: 3, w: "zenith",     k: "천정, 절정",            k_short: "절정",       s: ["apex", "pinnacle", "climax"], p: "" },
    { num: 4, w: "abnegate",   k: "포기하다, 버리다",      k_short: "포기하다",   s: ["renounce", "relinquish"],     p: "" },
    { num: 5, w: "abdicate",   k: "포기하다, 퇴위하다",    k_short: "퇴위하다",   s: ["renounce", "resign"],         p: "" },
    { num: 6, w: "revoke",     k: "취소하다, 철회하다",    k_short: "취소하다",   s: ["annul", "rescind"],           p: "" },
    { num: 7, w: "nullify",    k: "무효화하다",            k_short: "무효화하다", s: ["annul", "void"],              p: "" },
    { num: 8, w: "elucidate",  k: "설명하다, 해명하다",    k_short: "설명하다",   s: ["clarify", "explain"],         p: "" },
    { num: 9, w: "obfuscate",  k: "흐리게 하다, 혼란시키다", k_short: "혼란시키다", s: ["confuse", "muddle"],        p: "" },
    { num: 10, w: "loquacious", k: "수다스러운",           k_short: "수다스러운", s: ["garrulous", "verbose"],       p: "" },
  ],
}));

import {
  VOCAB,
  shuffle,
  getForbiddenSyns,
  getSynDistractors,
  getKorDistractors,
  type VocabItem,
} from "@/lib/vocab";

// ─── shuffle ─────────────────────────────────────────────────────────────────

describe("shuffle", () => {
  it("returns same length array", () => {
    expect(shuffle([1, 2, 3, 4, 5])).toHaveLength(5);
  });

  it("contains all original elements", () => {
    const arr = ["a", "b", "c", "d"];
    expect(shuffle([...arr]).sort()).toEqual([...arr].sort());
  });

  it("does not mutate original array", () => {
    const arr = [1, 2, 3];
    const original = [...arr];
    shuffle(arr);
    expect(arr).toEqual(original);
  });
});

// ─── getForbiddenSyns ────────────────────────────────────────────────────────

describe("getForbiddenSyns", () => {
  it("includes the word itself", () => {
    const apogee = VOCAB.find((v) => v.w === "apogee")!;
    expect(getForbiddenSyns(apogee).has("apogee")).toBe(true);
  });

  it("includes direct synonyms", () => {
    const apogee = VOCAB.find((v) => v.w === "apogee")!;
    expect(getForbiddenSyns(apogee).has("apex")).toBe(true);
  });

  it("includes sibling synonyms (indirect duplicates)", () => {
    // apogee.s = ["apex"]
    // apex는 pinnacle, zenith도 동의어로 가짐
    // → pinnacle.s = [apex, zenith, summit], zenith.s = [apex, pinnacle, climax]
    // 따라서 apogee의 금지 목록에 zenith, summit, climax 포함되어야 함
    const apogee = VOCAB.find((v) => v.w === "apogee")!;
    const forbidden = getForbiddenSyns(apogee);
    expect(forbidden.has("zenith")).toBe(true);
    expect(forbidden.has("summit")).toBe(true);
    expect(forbidden.has("climax")).toBe(true);
  });
});

// ─── getSynDistractors ───────────────────────────────────────────────────────

describe("getSynDistractors", () => {
  it("returns exactly 3 distractors", () => {
    const target = VOCAB.find((v) => v.w === "elucidate")!;
    expect(getSynDistractors(target, "clarify", 3)).toHaveLength(3);
  });

  it("does not include the correct synonym", () => {
    const target = VOCAB.find((v) => v.w === "elucidate")!;
    expect(getSynDistractors(target, "clarify", 3)).not.toContain("clarify");
  });

  it("does not include any direct synonym of target", () => {
    const target = VOCAB.find((v) => v.w === "elucidate")!;
    const distractors = getSynDistractors(target, "clarify", 3);
    for (const syn of target.s) {
      expect(distractors).not.toContain(syn);
    }
  });

  it("does not include sibling synonyms for apogee (pinnacle, zenith, climax)", () => {
    const apogee = VOCAB.find((v) => v.w === "apogee")!;
    const distractors = getSynDistractors(apogee, "apex", 3);
    const forbidden = getForbiddenSyns(apogee);
    for (const d of distractors) {
      expect(forbidden.has(d)).toBe(false);
    }
  });

  it("returns no duplicate distractors", () => {
    const target = VOCAB.find((v) => v.s.length > 0)!;
    const distractors = getSynDistractors(target, target.s[0], 3);
    expect(new Set(distractors).size).toBe(distractors.length);
  });
});

// ─── getKorDistractors ───────────────────────────────────────────────────────

describe("getKorDistractors", () => {
  it("does not include the correct Korean meaning", () => {
    const target = VOCAB.find((v) => v.w === "elucidate")!;
    const distractors = getKorDistractors(target, VOCAB, 3);
    expect(distractors).not.toContain(target.k);
  });

  it("returns unique Korean meanings", () => {
    const target = VOCAB[0];
    const distractors = getKorDistractors(target, VOCAB, 3);
    expect(new Set(distractors).size).toBe(distractors.length);
  });

  it("4-choice array contains correct answer", () => {
    const target = VOCAB.find((v) => v.w === "loquacious")!;
    const distractors = getKorDistractors(target, VOCAB, 3);
    const choices = shuffle([target.k, ...distractors]);
    expect(choices).toHaveLength(4);
    expect(choices).toContain(target.k);
  });
});
