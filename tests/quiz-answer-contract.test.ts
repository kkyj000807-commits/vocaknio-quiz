import { describe, expect, it } from "vitest";
import { buildQuizQuestions, choiceGloss, isChoiceCorrect, validateQuestion, type QuizQuestion } from "@/lib/quiz-engine";
import { createEmptyQuestionViewState, parseQuizSession, summarizeQuizSession, type QuizSession } from "@/lib/quiz-session";
import { canonicalSenseKey, getQuestionLearningTargetKey, getQuizLearningTargets } from "@/lib/canonical-learning";
import { CONTEXT_DRILLS, contextTargetSpan, SENSE_QUESTIONS } from "@/lib/sense-questions";
import { SECTION_RANGES } from "@/lib/vocab";

function question(mode: "kor-choice" | "syn-choice"): QuizQuestion {
  const q = buildQuizQuestions({ mode, itemNums: [4], count: 1 })[0];
  expect(q).toBeDefined();
  expect(q.sense).toBeUndefined();
  return q;
}

function saved(q: QuizQuestion): QuizSession {
  return { schema: 1, requestKey: "answer-contract", sessionId: "answer-contract",
    questions: [q], states: [createEmptyQuestionViewState()], currentIndex: 0, completed: false };
}

describe("underlined contextual synonym questions", () => {
  const senses = ["capricious.unpredictable-mood.v1", "blind-alley.fruitless-course.v1", "all-but.almost.v1",
    "sanction.authorize.v1", "sanction.penalize.v1"];
  it("requires a unique whole expression, not a substring or the context clue", () => {
    expect(contextTargetSpan({ headword: "all but", contextEn: "All but certain." })).toEqual({ start: 0, end: 7 });
    for (const contextEn of ["small button", "All but one; all but two.", "all-but", "not present"]) {
      expect(contextTargetSpan({ headword: "all but", contextEn })).toBeNull();
    }
  });
  it.each(["syn-context", "syn-context-basic"] as const)("%s restores the reviewed question, answer and feedback for every approved sense", mode => {
    for (const id of [...senses, ...CONTEXT_DRILLS.map(q=>q.id)]) {
      const sense = [...SENSE_QUESTIONS, ...CONTEXT_DRILLS].find(entry => entry.id === id)!;
      const key = canonicalSenseKey(sense.senseId);
      const [q] = buildQuizQuestions({ mode, rangeId: "all", count: 1, learningTargetKeys: [key] });
      expect(q.sense?.id).toBe(id);
      const span = contextTargetSpan(sense)!;
      expect(sense.contextEn.slice(span.start, span.end).toLowerCase()).toBe(sense.headword);
      expect(getQuestionLearningTargetKey(q)).toBe(key);
      expect(q.choices.filter(c => isChoiceCorrect(q, c)).map(c => c.value)).toEqual([q.correct]);
      for (const c of q.choices) {
        const source = sense.choices.find(o => c.id === `${sense.id}:${o.id}`)!;
        expect(c.label).toBe(source.en);
        expect(source.reasonKo).toBeTruthy();
        expect(choiceGloss(q, c, false)).toBe(mode === "syn-context-basic" ? source.ko : "");
        expect(choiceGloss(q, c, true)).toBe(source.ko);
      }
      const session = saved(q);
      session.states[0] = { ...session.states[0], answered: true, selectedChoice: q.choices.findIndex(c => c.isCorrect) };
      const restored = parseQuizSession(JSON.parse(JSON.stringify(session)));
      expect(restored).toEqual(session);
      expect(summarizeQuizSession(restored!)).toMatchObject({ correctCount: 1, wrongCount: 0 });
      for (const tampered of [{ ...q, sense: undefined }, { ...q, acceptedAnswers: ["intruder"] },
        { ...q, choices: q.choices.map((c, i) => i ? c : { ...c, meaning: "엉뚱한 뜻" }) }]) {
        expect(validateQuestion(tampered)).toBe(false);
        expect(parseQuizSession(saved(tampered))).toBeNull();
      }
      const rewritten = { ...q, sense: { ...sense, choices: sense.choices.map((option, i) =>
        i ? option : { ...option, reasonKo: "관계 없는 해설" }) } };
      expect(validateQuestion(rewritten)).toBe(false);
      expect(parseQuizSession(saved(rewritten))).toBeNull();
      expect(buildQuizQuestions({ mode, count: 1, itemNums: [q.item.num], learningTargetKeys: [key],
        masteredTargetKeys: [key], allowMeaningFallback: true })).toEqual([]);
    }
  });
  it("does not inflate coverage with repeated rows or fall back to a non-substitutable answer", () => {
    const options = { mode: "syn-context" as const, count: 30, rangeId: "all", allowMeaningFallback: true };
    const questions = buildQuizQuestions(options);
    expect(questions).toHaveLength(4 + CONTEXT_DRILLS.length);
    expect(new Set(questions.map(q => q.item.w)).size).toBe(questions.length);
    const excluded = SENSE_QUESTIONS.find(entry => entry.id === "all-but.except.v1")!;
    const allBut = questions.find(q => q.item.w === "all but")!;
    expect(getQuizLearningTargets(allBut.item, options.mode)).toEqual([{ key: getQuestionLearningTargetKey(allBut) }]);
    expect(getQuizLearningTargets(allBut.item, "kor-choice").map(target => target.key)).toContain(canonicalSenseKey(excluded.senseId));
    expect(buildQuizQuestions({ ...options, learningTargetKeys: [canonicalSenseKey(excluded.senseId)] })).toEqual([]);
    expect(buildQuizQuestions({ ...options, itemNums: [4] })).toEqual([]);
  });
  it("has contextual questions in every printed section and in idioms without changing legacy quiz answers", () => {
    for (const rangeId of [...SECTION_RANGES.map(s=>s.id), "idioms"]) {
      const qs = buildQuizQuestions({ mode: "syn-context", rangeId, count: 5 });
      expect(qs.length, rangeId).toBeGreaterThanOrEqual(2);
      expect(qs.every(q=>q.sense && validateQuestion(q))).toBe(true);
    }
    const [q] = buildQuizQuestions({ mode:"syn-context", itemNums:[1423],count:1 });
    expect(q.sense?.contextBinding?.meaning).toBe("격분한");
    expect(validateQuestion({...q,mode:"syn-choice"})).toBe(false);
    expect(validateQuestion({...q,item:{...q.item,k:"그저 불편한"}})).toBe(false);
    expect(buildQuizQuestions({mode:"kor-choice",itemNums:[1423], count:1})[0]?.sense?.id).toBeUndefined();
  });
});

describe("legacy question answer contract", () => {
  it.each(["syn-choice", "syn-kor-choice"] as const)("%s keeps English answers and shows choice glosses at the right time", mode => {
    const q = buildQuizQuestions({ mode, itemNums: [1], count: 1 })[0];
    expect(q.mode).toBe(mode);
    expect(q.choices).toHaveLength(4);
    for (const c of q.choices) {
      expect(c.label).toBe(c.word);
      expect(c.value).toBe(c.word);
      if (mode === "syn-kor-choice") expect(choiceGloss(q, c, false)).toMatch(/[가-힣]/u);
      else expect(choiceGloss(q, c, false)).toBe("");
      expect(choiceGloss(q, c, true)).toBe(c.meaning);
    }
    expect(q.choices.filter(c => isChoiceCorrect(q, c))).toHaveLength(1);
    expect(parseQuizSession(saved(q))?.questions[0]).toEqual(q);
  });
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
