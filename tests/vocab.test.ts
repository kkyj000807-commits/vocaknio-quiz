import { describe, it, expect, vi } from "vitest";

// Preserve the original regression scenarios, migrated to the shared v1.4 engine.
const fixture = vi.hoisted(() => {
  const groups = [
    { words: ["apogee", "apex", "pinnacle", "zenith", "summit", "climax"], meaning: "정점, 절정" },
    { words: ["abnegate", "abdicate", "renounce", "relinquish", "resign"], meaning: "포기하다" },
    { words: ["revoke", "nullify", "annul", "rescind", "void"], meaning: "취소하다, 무효화하다" },
    { words: ["elucidate", "clarify", "explain"], meaning: "설명하다, 해명하다" },
    { words: ["obfuscate", "confuse", "muddle"], meaning: "흐리게 하다, 혼란시키다" },
    { words: ["loquacious", "garrulous", "verbose"], meaning: "수다스러운" },
  ];
  let num = 1;
  return {
    concepts: groups.map((g, i) => ({ id: "test-" + i, words: g.words })),
    items: groups.flatMap((g, i) => g.words.map((w) => ({
      num: num++, id: "test-" + w, sourceIndex: num - 1, sourceNumber: num - 1,
      w, k: g.meaning, p: "", group: "V101", conceptId: "test-" + i,
      conceptLabel: g.meaning, majorConceptLabel: "", s: g.words.filter((other) => other !== w),
    }))),
  };
});
vi.mock("@/assets/vocab-v1.4.json", () => ({ default: fixture.items }));
vi.mock("@/assets/vocab-meta-v1.4.json", () => ({ default: { concepts: fixture.concepts, sections: [], legacyMigration: { numMap: {}, unresolvedNums: [] } } }));

import { VOCAB, shuffle, getRelatedWords } from "@/lib/vocab";
import { buildQuizQuestions, buildReviewQuestions, isChoiceCorrect, validateQuestion } from "@/lib/quiz-engine";

function question(word: string, mode: "syn-choice" | "kor-choice" = "syn-choice") {
  const item = VOCAB.find((v) => v.w === word)!;
  const questions = buildQuizQuestions({ itemNums: [item.num], mode, count: 1 });
  expect(questions).toHaveLength(1);
  return questions[0];
}

describe("shuffle", () => {
  it("returns same length array", () => expect(shuffle([1,2,3,4,5])).toHaveLength(5));
  it("contains all original elements", () => expect(shuffle(["a","b","c"]).sort()).toEqual(["a","b","c"]));
  it("does not mutate original array", () => { const a = [1,2,3]; shuffle(a); expect(a).toEqual([1,2,3]); });
});
describe("related-word exclusions (former getForbiddenSyns)", () => {
  const apogee = () => VOCAB.find((v) => v.w === "apogee")!;
  it("includes the word itself", () => expect(getRelatedWords(apogee()).has("apogee")).toBe(true));
  it("includes direct synonyms", () => expect(getRelatedWords(apogee()).has("apex")).toBe(true));
  it("includes sibling synonyms", () => {
    for (const word of ["zenith","summit","climax"]) expect(getRelatedWords(apogee()).has(word)).toBe(true);
  });
});
describe("synonym distractors through the current engine", () => {
  it("returns exactly three distractors", () => expect(question("elucidate").choices.filter(c=>!c.isCorrect)).toHaveLength(3));
  it("does not include the correct synonym as a distractor", () => {
    const q=question("elucidate"); expect(q.choices.filter(c=>!c.isCorrect).map(c=>c.value)).not.toContain(q.correct);
  });
  it("does not include any accepted synonym among distractors", () => {
    const q=question("elucidate"); for(const c of q.choices.filter(c=>!c.isCorrect)) expect(q.item.s).not.toContain(c.value);
  });
  it("does not include sibling synonyms among distractors", () => {
    const q=question("apogee"); for(const c of q.choices.filter(c=>!c.isCorrect)) expect(getRelatedWords(q.item).has(c.value)).toBe(false);
  });
  it("returns no duplicate distractors", () => {
    const a=question("apogee").choices.filter(c=>!c.isCorrect).map(c=>c.value); expect(new Set(a).size).toBe(a.length);
  });
});
describe("Korean meaning choices through the current engine", () => {
  it("excludes the target meaning from distractors", () => {
    const q=question("elucidate","kor-choice"); expect(q.choices.filter(c=>!c.isCorrect).map(c=>c.meaning)).not.toContain(q.item.k);
  });
  it("returns unique meanings", () => {
    const q=question("apogee","kor-choice"); expect(new Set(q.choices.map(c=>c.meaning)).size).toBe(4);
  });
  it("contains one correct answer even after shuffling", () => {
    const q=question("loquacious","kor-choice"); expect(q.choices).toHaveLength(4);
    q.choices=shuffle(q.choices); expect(validateQuestion(q)).toBe(true);
    expect(q.choices.filter(c=>isChoiceCorrect(q,c))).toHaveLength(1);
    expect(q.choices.find(c=>isChoiceCorrect(q,c))?.meaning).toBe(q.item.k);
  });
});
describe("invalid and duplicate quiz inputs", () => {
  it("does not create a full-range session from invalid counts", () => {
    for(const count of [0,-1,NaN,Infinity,1.5,999999]) {
      expect(buildQuizQuestions({mode:"kor-choice",count})).toEqual([]);
      expect(buildReviewQuestions([1,2],count)).toEqual([]);
    }
  });
  it("keeps empty selections empty and deduplicates supplied IDs", () => {
    expect(buildQuizQuestions({mode:"kor-choice",count:10,itemNums:[]})).toEqual([]);
    expect(buildReviewQuestions([1,1,1],10)).toHaveLength(1);
    expect(buildQuizQuestions({mode:"kor-choice",count:10,itemNums:[1,1,1]})).toHaveLength(1);
  });
});
