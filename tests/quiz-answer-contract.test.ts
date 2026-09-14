import { describe, expect, it } from "vitest";
import { buildQuizQuestions, isChoiceCorrect, validateQuestion, type QuizQuestion } from "@/lib/quiz-engine";
import { createEmptyQuestionViewState, parseQuizSession, summarizeQuizSession, type QuizSession } from "@/lib/quiz-session";

function question(mode: "kor-choice" | "syn-choice"): QuizQuestion {
  const q = buildQuizQuestions({ mode, itemNums: [1], count: 1 })[0];
  expect(q).toBeDefined();
  expect(q.sense).toBeUndefined();
  return q;
}

function saved(q: QuizQuestion): QuizSession {
  return { schema: 1, requestKey: "answer-contract", sessionId: "answer-contract",
    questions: [q], states: [createEmptyQuestionViewState()], currentIndex: 0, completed: false };
}

describe("legacy question answer contract", () => {
  it.each(["kor-choice", "syn-choice"] as const)("%s rejects choices outside the current question", mode => {
    const q = question(mode);
    const right = q.choices.find(c => c.isCorrect)!;
    const wrong = q.choices.find(c => !c.isCorrect)!;
    expect(isChoiceCorrect(q, { ...right, id: "another-question" })).toBe(false);
    expect(isChoiceCorrect(q, { ...wrong, value: right.value, isCorrect: true })).toBe(false);
    expect(isChoiceCorrect(q, { ...wrong, isCorrect: true })).toBe(false);
    // Callers do not control grading through their copy of the display flag.
    expect(isChoiceCorrect(q, { ...right, isCorrect: false })).toBe(true);
  });

  it.each(["kor-choice", "syn-choice"] as const)("%s refuses a saved key that marks a distractor correct", mode => {
    const q = question(mode);
    const wrong = q.choices.find(c => !c.isCorrect)!;
    q.choices.forEach(c => { c.isCorrect = c.id === wrong.id; });
    q.correct = wrong.label;
    expect(validateQuestion(q)).toBe(false);
    expect(parseQuizSession(saved(q))).toBeNull();
  });

  it.each(["kor-choice", "syn-choice"] as const)("%s preserves valid choices and scores through JSON and reordering", mode => {
    const q = question(mode);
    q.choices.reverse();
    const session = saved(q);
    session.states[0] = { ...session.states[0], answered: true,
      selectedChoice: q.choices.findIndex(c => c.isCorrect) };
    const restored = parseQuizSession(JSON.parse(JSON.stringify(session)));
    expect(restored).toEqual(session);
    expect(summarizeQuizSession(restored!)).toMatchObject({ correctCount: 1, wrongCount: 0 });
  });
});
