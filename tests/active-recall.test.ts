import { afterEach, describe, expect, it, vi } from "vitest";

import { ACTIVE_RECALL_SENSES, getActiveRecallCoverage, getActiveRecallSenses } from "@/lib/active-recall";
import { buildQuizQuestions, buildReviewQuestions, isChoiceCorrect, validateQuestion } from "@/lib/quiz-engine";
import { VOCAB } from "@/lib/vocab";

const juryRows = VOCAB.filter(item => item.w === "jury foreman");

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
    expect(getActiveRecallCoverage()).toEqual({ senses: 1, rows: 2, definitions: 1, examples: 1, synonymRelations: 1 });
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
});
