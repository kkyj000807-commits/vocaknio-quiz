import { afterEach, describe, expect, it, vi } from "vitest";

import { ACTIVE_RECALL_SENSES, getActiveRecallCoverage, getActiveRecallSenses } from "@/lib/active-recall";
import { buildQuizQuestions, buildReviewQuestions, isChoiceCorrect, validateQuestion } from "@/lib/quiz-engine";
import { VOCAB } from "@/lib/vocab";

const juryRows = VOCAB.filter(item => item.w === "jury foreman");
const cartHorseRows = VOCAB.filter(item => item.w === "put the cart before the horse");
const takeForGrantedRows = VOCAB.filter(item => item.w === "take for granted");
const workOutRows = VOCAB.filter(item => item.w === "work out");
const abideByRows = VOCAB.filter(item => item.w === "abide by");

afterEach(() => vi.restoreAllMocks());

describe("영어→영어 active recall", () => {
  it("jury foreman의 sense 데이터와 예문·variant를 두 원본 행에 연결한다", () => {
    expect(juryRows.map(item => item.id)).toEqual(["JBKROW019189", "JBKROW023301"]);
    const sense = ACTIVE_RECALL_SENSES.find(entry => entry.headword === "jury foreman");
    expect(sense).toMatchObject({
      conciseEnglishDefinition: "the juror who leads discussions and speaks for the jury",
      variants: ["jury foreperson"],
      koreanMeaning: "배심원 대표",
      enrichmentStatus: "complete",
    });
    expect(sense?.exampleSentences.length).toBeGreaterThanOrEqual(1);
    expect(sense?.exactSynonyms).not.toContain("supervisor");
    expect(sense?.exactSynonyms).not.toContain("overseer");
    expect(getActiveRecallSenses(juryRows[0].id)).toHaveLength(1);
    expect(getActiveRecallCoverage()).toEqual({ senses: 9, rows: 10, definitions: 9, examples: 9, synonymRelations: 9 });
  });

  it("definition → target 문제를 만들고 정답을 하나로 유지한다", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const [question] = buildQuizQuestions({ mode: "syn-choice", count: 1, itemNums: [juryRows[0].num], preserveItemOrder: true });
    expect(question.recall?.prompts.find(prompt => prompt.id === question.recallPromptId)?.kind).toBe("definition-recall");
    expect(question.answerKind).toBe("target");
    expect(question.item.w).toBe("jury foreman");
    expect(question.choices.filter(choice => isChoiceCorrect(question, choice))).toHaveLength(1);
    expect(validateQuestion(question)).toBe(true);
  });

  it("context → target 문제와 오답 복습도 같은 sense 계약을 사용한다", () => {
    const random = vi.spyOn(Math, "random").mockReturnValue(0);
    random.mockReturnValueOnce(0).mockReturnValueOnce(0.9);
    const [question] = buildQuizQuestions({ mode: "syn-choice", count: 1, itemNums: [juryRows[1].num], preserveItemOrder: true });
    expect(question.recall?.prompts.find(prompt => prompt.id === question.recallPromptId)?.kind).toBe("context-recall");
    const [review] = buildReviewQuestions([juryRows[0].num], 1);
    expect(review.recall?.senseId).toBe("jury-foreman:leader-of-jury");
    expect(review.answerKind).toBe("target");
  });

  it("put the cart before the horse를 순서 오류 sense와 결합 이미지에만 연결한다", () => {
    expect(cartHorseRows).toHaveLength(1);
    const sense = getActiveRecallSenses(cartHorseRows[0].id)[0];
    expect(sense).toMatchObject({
      conciseEnglishDefinition: "to do dependent steps in the wrong order",
      koreanMeaning: "일의 선후를 뒤바꾸다",
      exactSynonyms: [],
      relatedWords: ["jump the gun"],
      sourceCheckedAt: "2026.09.05",
    });
    expect(sense.exampleSentences).toHaveLength(1);
    expect(sense.distractors.find(choice => choice.word === "jump the gun")?.reasonKo).toContain("순서");
  });

  it("숙어의 definition/context 문제 모두 정답 하나와 현재 sense 계약을 유지한다", () => {
    const random = vi.spyOn(Math, "random").mockReturnValue(0);
    const [definition] = buildQuizQuestions({ mode: "syn-choice", count: 1, itemNums: [cartHorseRows[0].num], preserveItemOrder: true });
    expect(definition.recallPromptId).toBe("definition");
    expect(definition.choices.filter(choice => isChoiceCorrect(definition, choice))).toHaveLength(1);
    expect(validateQuestion(definition)).toBe(true);

    random.mockRestore();
    const contextRandom = vi.spyOn(Math, "random").mockReturnValue(0);
    contextRandom.mockReturnValueOnce(0).mockReturnValueOnce(0.9);
    const [context] = buildQuizQuestions({ mode: "syn-choice", count: 1, itemNums: [cartHorseRows[0].num], preserveItemOrder: true });
    expect(context.recallPromptId).toBe("context");
    expect(context.choices.filter(choice => isChoiceCorrect(context, choice))).toHaveLength(1);
  });

  it("take for granted의 사실 전제와 가치 간과를 서로 다른 sense로 유지한다", () => {
    expect(takeForGrantedRows).toHaveLength(1);
    const senses = getActiveRecallSenses(takeForGrantedRows[0].id);
    expect(senses.map(sense => sense.senseId)).toEqual([
      "take-for-granted:assume-without-checking",
      "take-for-granted:fail-to-appreciate",
    ]);
    expect(senses[0].koreanMeaning).toBe("확인 없이 사실로 전제하다");
    expect(senses[1].koreanMeaning).toBe("익숙해서 소중함·고마움을 모르다");
    expect(senses[0].nearSynonyms).not.toContain("fail to appreciate");
    expect(senses[1].nearSynonyms).not.toContain("assume without question");
    expect(senses.every(sense => sense.exactSynonyms.length === 0)).toBe(true);
  });

  it("take for granted 두 sense가 각각 독립된 단일정답 영영 문제를 만든다", () => {
    const firstRandom = vi.spyOn(Math, "random").mockReturnValue(0);
    const [assumption] = buildQuizQuestions({ mode: "syn-choice", count: 1, itemNums: [takeForGrantedRows[0].num], preserveItemOrder: true });
    expect(assumption.recall?.senseId).toBe("take-for-granted:assume-without-checking");
    expect(assumption.choices.filter(choice => isChoiceCorrect(assumption, choice))).toHaveLength(1);
    expect(validateQuestion(assumption)).toBe(true);
    firstRandom.mockRestore();

    const secondRandom = vi.spyOn(Math, "random").mockReturnValue(0);
    secondRandom.mockReturnValueOnce(0.9).mockReturnValueOnce(0.9);
    const [appreciation] = buildQuizQuestions({ mode: "syn-choice", count: 1, itemNums: [takeForGrantedRows[0].num], preserveItemOrder: true });
    expect(appreciation.recall?.senseId).toBe("take-for-granted:fail-to-appreciate");
    expect(appreciation.recallPromptId).toBe("context");
    expect(appreciation.choices.filter(choice => isChoiceCorrect(appreciation, choice))).toHaveLength(1);
    expect(validateQuestion(appreciation)).toBe(true);
  });

  it("work out의 해결·계산·성공적 결과·운동을 네 sense로 분리한다", () => {
    expect(workOutRows.map(item => item.id)).toEqual([
      "JBKROW000044",
      "JBKROW004038",
      "JBKROW006121",
      "JBKROW008146",
    ]);
    const senses = getActiveRecallSenses(workOutRows[0].id);
    expect(senses.map(sense => sense.senseId)).toEqual([
      "work-out:solve-problem",
      "work-out:calculate-value",
      "work-out:end-successfully",
      "work-out:exercise-body",
    ]);
    expect(new Set(senses.map(sense => sense.conciseEnglishDefinition)).size).toBe(4);
    expect(senses.every(sense => sense.itemIds.length === 4)).toBe(true);
    expect(senses.every(sense => sense.exampleSentences.length === 1)).toBe(true);
    expect(senses.every(sense => sense.sources.length === 2)).toBe(true);
  });

  it("work out 영영 문제도 정답 하나와 sense 계약을 유지한다", () => {
    const random = vi.spyOn(Math, "random").mockReturnValue(0);
    const [question] = buildQuizQuestions({ mode: "syn-choice", count: 1, itemNums: [workOutRows[0].num], preserveItemOrder: true });
    expect(question.recall?.senseId).toBe("work-out:solve-problem");
    expect(question.answerKind).toBe("target");
    expect(question.choices.filter(choice => isChoiceCorrect(question, choice))).toHaveLength(1);
    expect(validateQuestion(question)).toBe(true);
  });

  it("abide by를 동의 여부와 분리된 규칙 준수 sense로 두 행에 연결한다", () => {
    expect(abideByRows.map(item => item.id)).toEqual(["JBKROW000004", "JBKROW002049"]);
    const sense = getActiveRecallSenses(abideByRows[0].id)[0];
    expect(sense).toMatchObject({
      senseId: "abide-by:follow-governing-rule",
      conciseEnglishDefinition: "to follow and honor a governing rule or decision",
      koreanMeaning: "규칙·결정·약속을 따르고 지키다",
      exactSynonyms: [],
      nearSynonyms: ["comply with", "adhere to"],
    });
    expect(sense.distractors.find(choice => choice.word === "agree with")?.reasonKo).toContain("반대해도");
    expect(getActiveRecallSenses(abideByRows[1].id)[0].senseId).toBe(sense.senseId);
  });

  it("abide by 영영 문제도 정답 하나와 현재 sense 계약을 유지한다", () => {
    const random = vi.spyOn(Math, "random").mockReturnValue(0);
    const [question] = buildQuizQuestions({ mode: "syn-choice", count: 1, itemNums: [abideByRows[0].num], preserveItemOrder: true });
    expect(question.recall?.senseId).toBe("abide-by:follow-governing-rule");
    expect(question.choices.filter(choice => isChoiceCorrect(question, choice))).toHaveLength(1);
    expect(validateQuestion(question)).toBe(true);
  });
});
