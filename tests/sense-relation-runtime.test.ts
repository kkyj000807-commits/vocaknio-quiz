import { expect, it } from "vitest";
import { VOCAB } from "@/lib/vocab";
import { getProductionSenseQuestions, SENSE_QUESTIONS, senseMatchesItem } from "@/lib/sense-questions";
import { buildQuizQuestions, buildReviewQuestions, isChoiceCorrect, validateQuestion } from "@/lib/quiz-engine";
import { createEmptyQuestionViewState, parseQuizSession, summarizeQuizSession } from "@/lib/quiz-session";

const rows = VOCAB.filter(v => ["JBKROW009289", "JBKROW011482"].includes(v.id));
const make = () => buildQuizQuestions({ mode: "syn-choice", itemNums: [rows[0].num], count: 1 })[0];
const sessionFor = (q: ReturnType<typeof make>) => ({ schema: 1, requestKey: "relation", sessionId: "relation-session",
  currentIndex: 0, completed: false, questions: [q],
  states: [{ ...createEmptyQuestionViewState(), answered: true, selectedChoice: q.choices.findIndex(c => c.isCorrect) }],
});

const capriciousIds = ["JBKROW000003", "JBKROW002257", "JBKROW026187", "JBKROW030584"];

it("keeps the capricious mood sense and adjective distractors in each reviewed row", () => {
  const original = JSON.stringify(VOCAB);
  for (const id of capriciousIds) {
    const row = VOCAB.find(v => v.id === id)!;
    for (const mode of ["syn-choice", "kor-choice", "syn-kor-choice"] as const) for (let repeat = 0; repeat < 12; repeat++) {
      const q = buildQuizQuestions({ mode, itemNums: [row.num], count: 1 })[0];
      expect(q.sense?.senseId).toBe("capricious:unpredictable-whims");
      expect(q.sense?.relation?.targetSenseId).toBe("mercurial:unpredictable-mood-change");
      expect(q.sense?.partOfSpeech).toBe("형용사");
      expect(q.choices.map(c => c.word).sort()).toEqual(["calculating", "indecisive", "irritable", "mercurial"]);
      expect(q.choices.some(c => /활발|활달|수은|filthy|mucky|도주/.test(c.label))).toBe(false);
      expect(q.choices.filter(c => isChoiceCorrect(q, c))).toHaveLength(1);
      expect(q.choices.find(c => isChoiceCorrect(q, c))?.meaning).toBe("기분에 따라 태도가 급변하는");
      expect(validateQuestion({ ...q, choices: [...q.choices].reverse() })).toBe(true);
    }
  }
  for (const row of VOCAB.filter(v => v.w === "capricious" && !capriciousIds.includes(v.id))) {
    expect(getProductionSenseQuestions(row.id)).toEqual([]);
  }
  expect(JSON.stringify(VOCAB)).toBe(original);
});

it("restores the same capricious answer, reuses it in review and rejects old mixed-sense choices", () => {
  for (const id of capriciousIds) {
    const row = VOCAB.find(v => v.id === id)!;
    const q = buildQuizQuestions({ mode: "syn-choice", itemNums: [row.num], count: 1 })[0];
    const saved = sessionFor(q);
    expect(parseQuizSession(JSON.parse(JSON.stringify(saved)))).toEqual(saved);
    expect(summarizeQuizSession(saved)).toMatchObject({ correctCount: 1, wrongCount: 0 });
    expect(buildReviewQuestions([row.num], 1)[0].sense).toEqual(q.sense);
    const old = { ...q, sense: undefined, acceptedAnswers: row.s };
    expect(parseQuizSession(sessionFor(old))).toBeNull();
    expect(old.item).toEqual(row);
    for (const mode of ["flashcard", "syn-type"] as const) {
      expect(buildQuizQuestions({ mode, itemNums: [row.num], count: 1 })).toHaveLength(1);
    }
  }
});

it("uses only the reviewed figurative relation for both mapped rows and three modes", () => {
  expect(rows).toHaveLength(2);
  const original = JSON.stringify(VOCAB);
  for (const row of rows) for (const mode of ["syn-choice", "kor-choice", "syn-kor-choice"] as const) {
    for (let repeat = 0; repeat < 12; repeat++) {
      const q = buildQuizQuestions({ mode, itemNums: [row.num], count: 1 })[0];
      expect(q.sense?.senseId).toBe("blind-alley:fruitless-course");
      expect(q.sense?.relation?.targetSenseId).toBe("cul-de-sac:fruitless-course");
      expect(validateQuestion(q)).toBe(true);
      expect(q.choices.map(c => c.word).sort()).toEqual(["cul-de-sac", "detour", "temporary setback", "turning point"]);
      expect(q.choices.some(c => /맹장|병목|bottleneck/.test(c.label))).toBe(false);
      expect(q.choices.filter(c => isChoiceCorrect(q, c))).toHaveLength(1);
      expect(validateQuestion({ ...q, choices: [...q.choices].reverse() })).toBe(true);
    }
  }
  expect(JSON.stringify(VOCAB)).toBe(original);
  for (const row of VOCAB.filter(v => v.w === "blind alley" && !rows.includes(v))) {
    expect(getProductionSenseQuestions(row.id)).toEqual([]);
    expect(senseMatchesItem(make().sense!, row)).toBe(false);
  }
});

it("shares exactly the same answer contract in review and restored sessions", () => {
  const q = make();
  const snapshot = sessionFor(q);
  const restored = parseQuizSession(JSON.parse(JSON.stringify(snapshot)));
  expect(restored).toEqual(snapshot);
  expect(summarizeQuizSession(restored!)).toEqual({ correctCount: 1, wrongCount: 0, wrongItems: [] });
  const review = buildReviewQuestions(rows.map(r => r.num), 2);
  expect(review).toHaveLength(2);
  expect(review.every(r => r.sense?.relation?.targetWord === "cul-de-sac" && validateQuestion(r))).toBe(true);
});

it("rejects a coherently forged sense key instead of trusting its own production flag", () => {
  const q = structuredClone(make());
  const wrong = q.sense!.choices.find(c => c.id !== q.sense!.correctId)!;
  q.sense!.correctId = wrong.id;
  // Also forge the relation and all visible flags; no isolated format error is needed.
  q.sense!.relation!.targetWord = wrong.en;
  q.choices.forEach(c => { c.isCorrect = c.word === wrong.en; });
  q.correct = wrong.en;
  q.acceptedAnswers = [wrong.en];
  expect(validateQuestion(q)).toBe(false);
  expect(q.choices.some(c => isChoiceCorrect(q, c))).toBe(false);
  const raw = JSON.stringify(sessionFor(q));
  expect(parseQuizSession(JSON.parse(raw))).toBeNull();
  expect(JSON.stringify(sessionFor(q))).toBe(raw);
});

it("withholds retired snapshots and changed source bindings without rebuilding or regrading them", () => {
  const q = make();
  const current = SENSE_QUESTIONS.find(s => s.id === q.sense!.id)!;
  const previous = current.status;
  try {
    current.status = "reviewed";
    expect(parseQuizSession(sessionFor(q))).toBeNull();
    expect(buildQuizQuestions({ mode: "syn-choice", itemNums: [rows[0].num], count: 1, allowMeaningFallback: true })).toEqual([]);
    expect(buildReviewQuestions([rows[0].num], 1)).toEqual([]);
  } finally { current.status = previous; }
  for (const item of [{ ...q.item, k: "다른 의미" }, { ...q.item, conceptId: "other" }]) {
    expect(validateQuestion({ ...q, item })).toBe(false);
    expect(senseMatchesItem(q.sense!, item)).toBe(false);
  }
});

it("does not restore an old headword-level choice after a sense boundary is published", () => {
  const q = make();
  const old = { ...q, sense: undefined, id: `${q.item.id}-syn-choice`,
    choices: ["cul-de-sac", "detour", "temporary setback", "turning point"].map((word, index) => ({
      id: `legacy-${index}`, value: word, label: word, word, meaning: "legacy meaning", isCorrect: index === 0,
    })), correct: "cul-de-sac", acceptedAnswers: q.item.s };
  expect(parseQuizSession(sessionFor(old))).toBeNull();
  for (const mode of ["flashcard", "syn-type"] as const) {
    expect(buildQuizQuestions({ mode, itemNums: [rows[0].num], count: 1 })).toHaveLength(1);
  }
});
