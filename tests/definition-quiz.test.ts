import { describe, expect, it, vi } from "vitest";

import {
  buildDefinitionMeaningBridgeKo,
  getDefinitionAnswerRelations,
  getDefinitionQuizCoverage,
  getDefinitionQuizDistractors,
  getDefinitionQuizEntry,
} from "@/lib/definition-quiz";
import {
  buildQuizQuestions,
  isChoiceCorrect,
  validateQuestion,
} from "@/lib/quiz-engine";
import { VOCAB } from "@/lib/vocab";

describe("영영 정의 → 정확한 표제어", () => {
  it("검증 가능한 OEWN 단일-sense 정의를 별도 출제 자산으로 제공한다", () => {
    expect(getDefinitionQuizCoverage()).toEqual({
      eligibleHeadwords: 4114,
      eligibleRows: 11360,
      excludedDefinitionLeakageHeadwords: 171,
      exampleHeadwords: 2023,
      exampleRows: 6405,
    });
  });

  it("정의만 제시하고 같은 품사의 영어 표제어 4개 중 정답 하나를 만든다", () => {
    const item = VOCAB.find((candidate) => candidate.w === "abase");
    expect(item).toBeDefined();
    vi.spyOn(Math, "random").mockReturnValue(0);
    const [question] = buildQuizQuestions({
      mode: "definition-choice",
      count: 1,
      itemNums: [item!.num],
      preserveItemOrder: true,
    });

    expect(question.mode).toBe("definition-choice");
    expect(question.answerKind).toBe("target");
    expect(question.definitionRecall).toMatchObject({
      headword: "abase",
      partOfSpeech: "verb",
      definition: "cause to feel shame; hurt the pride of",
    });
    expect(question.choices).toHaveLength(4);
    expect(new Set(question.choices.map((choice) => choice.value)).size).toBe(4);
    expect(question.choices.filter((choice) => isChoiceCorrect(question, choice))).toHaveLength(1);
    expect(validateQuestion(question)).toBe(true);
  });

  it("영영 정의 모드와 동의어 모드를 서로 섞지 않는다", () => {
    const item = VOCAB.find((candidate) => candidate.w === "capricious");
    expect(item).toBeDefined();
    const [synonymQuestion] = buildQuizQuestions({
      mode: "syn-choice",
      count: 1,
      itemNums: [item!.num],
      preserveItemOrder: true,
    });
    expect(synonymQuestion.mode).toBe("syn-choice");
    expect(synonymQuestion.answerKind).toBe("synonym");
    expect(synonymQuestion.recall).toBeUndefined();
    expect(synonymQuestion.definitionRecall).toBeUndefined();
  });

  it("정의 선지는 검증된 반의어를 먼저 쓰고 나머지는 다른 의미권에서 고른다", () => {
    const item = VOCAB.find((candidate) => candidate.w === "adroit");
    expect(item).toBeDefined();
    const target = getDefinitionQuizEntry(item!.id)!;
    vi.spyOn(Math, "random").mockReturnValue(0);
    const distractors = getDefinitionQuizDistractors(target, 3);
    expect(distractors).toHaveLength(3);
    expect(distractors).toContainEqual(expect.objectContaining({
      headword: "maladroit",
      relation: "antonym",
    }));
    expect(distractors.filter((candidate) => candidate.relation === "unrelated").every(
      (candidate) => candidate.partOfSpeech !== target.partOfSpeech ||
        candidate.lexicographerFile !== target.lexicographerFile,
    )).toBe(true);
  });

  it("정답 해설은 같은 sense의 동의어와 명시된 반의어만 분리해 제공한다", () => {
    const abase = getDefinitionQuizEntry(VOCAB.find((item) => item.w === "abase")!.id)!;
    expect(getDefinitionAnswerRelations(abase)).toEqual({
      synonyms: ["humiliate", "mortify", "chagrin", "humble"],
      antonyms: [],
    });

    const adroit = getDefinitionQuizEntry(VOCAB.find((item) => item.w === "adroit")!.id)!;
    expect(getDefinitionAnswerRelations(adroit)).toEqual({
      synonyms: [],
      antonyms: ["maladroit"],
    });
  });

  it("사전 원문과 분리된 초월번역 핵심 이미지를 만든다", () => {
    expect(buildDefinitionMeaningBridgeKo("낮추다 · 창피를 주다")).toBe(
      "영영 정의가 가리키는 중심 장면은 ‘낮추다 · 창피를 주다’이다. 이 장면에서 영어 표제어를 다시 꺼내는 방식으로 기억한다.",
    );
  });

  it("OEWN이 제공한 현재 sense의 예문 원문을 정답 해설 데이터로 보존한다", () => {
    const abase = getDefinitionQuizEntry(VOCAB.find((item) => item.w === "abase")!.id)!;
    expect(abase.examples).toContain(
      "He humiliated his colleague by criticising him in front of the boss",
    );
  });

  it("다의어·별칭·정답 노출 정의는 일반 정의 출제 대상에서 제외한다", () => {
    const excluded = VOCAB.find((item) => item.w === "general");
    if (excluded) expect(getDefinitionQuizEntry(excluded.id)).toBeUndefined();
    const eligible = VOCAB.filter((item) => getDefinitionQuizEntry(item.id));
    expect(eligible).toHaveLength(11360);
  });
});
