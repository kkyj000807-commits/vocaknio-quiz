import { describe, expect, it, vi } from "vitest";
import { SENSE_QUESTIONS, getProductionSenseQuestions, getSenseQuestionCoverage, senseQuestionSchema } from "@/lib/sense-questions";
import { buildQuizQuestions, buildReviewQuestions, isChoiceCorrect, validateQuestion } from "@/lib/quiz-engine";
import { VOCAB } from "@/lib/vocab";
import { createEmptyQuestionViewState, parseQuizSession, summarizeQuizSession, type QuizSession } from "@/lib/quiz-session";

describe("sense-first production gate", () => {
  it("maps every repeated row without rewriting vocabulary/record IDs", () => {
    expect(getSenseQuestionCoverage()).toMatchObject({ expressions: 4, senses: 6, questions: 6, mappedRows: 16 });
    for (const template of SENSE_QUESTIONS) {
      const expected = template.relation ? template.relation.sourceRows.map(row => row.id) : VOCAB.filter(v => v.w === template.headword).map(v => v.id);
      expect(template.itemIds.slice().sort()).toEqual(expected.sort());
    }
  });

  it("rejects missing evidence, sources, duplicate choices and unreviewed quality", () => {
    const base = SENSE_QUESTIONS[0];
    for (const patch of [
      { sources: base.sources.slice(0, 1) }, { quality: "C" }, { correctId: "missing" },
      { evidence: "not in this context" },
      { choices: [base.choices[0], base.choices[0], ...base.choices.slice(2)] },
      { choices: base.choices.map(c => ({ ...c, plausible: false })) },
    ]) expect(senseQuestionSchema.safeParse({ ...base, ...patch }).success).toBe(false);
    expect(getProductionSenseQuestions("unknown")).toEqual([]);
  });

  it("keeps one sense and answer across English/Korean choices and repeated randomization", () => {
    const seen = new Set<string>();
    // Seed only question ordering; expected answers come from independently reviewed fixtures.
    const random = vi.spyOn(Math, "random");
    try {
      for (let seed = 1; seed <= 24; seed++) {
        let state = seed;
        random.mockImplementation(() => ((state = (state * 1664525 + 1013904223) >>> 0) / 2 ** 32));
        for (const mode of ["syn-choice", "kor-choice", "syn-kor-choice"] as const) {
          for (const num of [281, 496, 25986]) {
            const q = buildQuizQuestions({ mode, itemNums: [num], count: 1 })[0];
            expect(q.sense).toBeDefined();
            expect(validateQuestion(q)).toBe(true);
            seen.add(q.sense!.senseId);
            const expected = q.sense!.choices.find(c => c.id === q.sense!.correctId)!;
            const right = q.choices.filter(c => isChoiceCorrect(q, c));
            expect(right).toHaveLength(1);
            expect(right[0].meaning).toBe(expected.ko);
            expect(q.choices.some(c => /용모|faddish|erratic/.test(c.label))).toBe(false);
            const reordered = { ...q, choices: [...q.choices].reverse() };
            expect(reordered.choices.filter(c => isChoiceCorrect(reordered, c))).toEqual(right);
            expect(isChoiceCorrect(q, { ...right[0], value: "approve", id: "foreign-answer", isCorrect: true })).toBe(false);
          }
        }
      }
    } finally { random.mockRestore(); }
    expect(seen.size).toBe(4);
  });

  it("does not bypass withheld content through legacy meaning fallback or review", () => {
    const withheld = SENSE_QUESTIONS.filter(q => q.headword === "sanction");
    const previous = withheld.map(q => q.status);
    try {
      withheld.forEach(q => { q.status = "candidate"; });
      expect(buildQuizQuestions({ mode: "syn-choice", itemNums: [496], count: 1, allowMeaningFallback: true })).toEqual([]);
      expect(buildReviewQuestions([496], 1)).toEqual([]);
    } finally { withheld.forEach((q, i) => { q.status = previous[i]; }); }
  });

  it("preserves sense, actual choice order and scores on resume and review", () => {
    const questions = buildQuizQuestions({ mode: "syn-choice", itemNums: [281, 496], count: 2, preserveItemOrder: true });
    const session: QuizSession = {
      schema: 1, requestKey: "sense-test", sessionId: "sense-session", currentIndex: 1, completed: false,
      questions, states: questions.map(q => ({ ...createEmptyQuestionViewState(), answered: true, selectedChoice: q.choices.findIndex(c => c.isCorrect) })),
    };
    const restored = parseQuizSession(JSON.parse(JSON.stringify(session)));
    expect(restored).toEqual(session);
    expect(summarizeQuizSession(restored!)).toEqual({ correctCount: 2, wrongCount: 0, wrongItems: [] });
    const review = buildReviewQuestions([281, 496], 2);
    expect(review).toHaveLength(2);
    expect(review.every(q => q.sense && validateQuestion(q))).toBe(true);
    const corrupt = structuredClone(session);
    corrupt.questions[0].choices[0].label = "다른 뜻";
    expect(parseQuizSession(corrupt)).toBeNull();
  });
});
