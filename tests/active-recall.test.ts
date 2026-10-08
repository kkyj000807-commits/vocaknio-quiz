import { afterEach, describe, expect, it, vi } from "vitest";

import { ACTIVE_RECALL_SENSES, getActiveRecallCoverage, getActiveRecallSenses } from "@/lib/active-recall";
import { getItemLearningTargets } from "@/lib/canonical-learning";
import { buildQuizQuestions, buildReviewQuestions, isChoiceCorrect, validateQuestion } from "@/lib/quiz-engine";
import { VOCAB } from "@/lib/vocab";

const juryRows = VOCAB.filter(item => item.w === "jury foreman");
const cartHorseRows = VOCAB.filter(item => item.w === "put the cart before the horse");
const takeForGrantedRows = VOCAB.filter(item => item.w === "take for granted");
const workOutRows = VOCAB.filter(item => item.w === "work out");
const abideByRows = VOCAB.filter(item => item.w === "abide by");
const teemWithRows = VOCAB.filter(item => item.w === "teem with");
const wrapUpRows = VOCAB.filter(item => item.w === "wrap up");
const ruleOfThumbRows = VOCAB.filter(item => item.w === "rule of thumb");
const conduciveToRows = VOCAB.filter(item => item.w === "conducive to");
const wideRangeRows = VOCAB.filter(item => item.w === "a wide range of");
const zoomInOnRows = VOCAB.filter(item => item.w === "zoom in on");
const withoutFailRows = VOCAB.filter(item => item.w === "without fail");
const glossOverRows = VOCAB.filter(item => item.w === "gloss over");
const takeIntoAccountRows = VOCAB.filter(item => item.w === "take into account");
const fallShortRows = VOCAB.filter(item => item.w === "fall short of");

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
    expect(getActiveRecallCoverage()).toEqual({
      senses: 20,
      rows: 37,
      definitions: 20,
      examples: 20,
      contextualizedExamples: 20,
      contextExplanations: 20,
      synonymRelations: 20,
    });
  });

  it("fall short of의 기준 미달 한 sense를 두 반복 행에 공유하고 개선 전무와 구분한다", () => {
    expect(fallShortRows.map(item => item.id)).toEqual(["JBKROW019982", "JBKROW022793"]);
    expect(fallShortRows.map(item => item.k)).toEqual(["기대에 못 미치다", "기대에 못 미치다"]);
    const sense = getActiveRecallSenses(fallShortRows[0].id)[0];
    expect(getActiveRecallSenses(fallShortRows[1].id)[0]).toBe(sense);
    expect(sense.senseId).toBe("fall-short-of:below-required-standard");
    expect(sense.exampleSentences).toHaveLength(2);
    expect(sense.contextExplanationKo).toContain("아무 성과도 없었다는 뜻은 아니다");
    expect(new Set(sense.sources.map(source => source.independenceGroup)).size).toBe(2);
    for (const word of [...sense.exactSynonyms, ...sense.nearSynonyms, ...sense.antonyms, ...sense.variants]) expect(sense.relationMeaningsKo?.[word]).toBeTruthy();
    for (const item of fallShortRows) {
      const [question] = buildQuizQuestions({ mode: "definition-choice", count: 1, itemNums: [item.num], preserveItemOrder: true });
      expect(question.recall?.senseId).toBe(sense.senseId);
      expect(question.choices.filter(choice => isChoiceCorrect(question, choice))).toHaveLength(1);
      expect(validateQuestion(question)).toBe(true);
    }
  });

  it("definition → target 문제를 만들고 정답을 하나로 유지한다", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const [question] = buildQuizQuestions({ mode: "definition-choice", count: 1, itemNums: [juryRows[0].num], preserveItemOrder: true });
    expect(question.recall?.prompts.find(prompt => prompt.id === question.recallPromptId)?.kind).toBe("definition-recall");
    expect(question.answerKind).toBe("target");
    expect(question.item.w).toBe("jury foreman");
    expect(question.choices.filter(choice => isChoiceCorrect(question, choice))).toHaveLength(1);
    expect(validateQuestion(question)).toBe(true);
  });

  it("영영 정의 문제와 오답 복습도 같은 sense 계약을 사용한다", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.9);
    const [question] = buildQuizQuestions({ mode: "definition-choice", count: 1, itemNums: [juryRows[1].num], preserveItemOrder: true });
    expect(question.recall?.prompts.find(prompt => prompt.id === question.recallPromptId)?.kind).toBe("definition-recall");
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
      sourceCheckedAt: "2026.10.06",
    });
    expect(sense.exampleSentences).toHaveLength(1);
    expect(sense.distractors.find(choice => choice.word === "jump the gun")?.reasonKo).toContain("순서");
  });

  it("cart-before-horse의 누락 관계어만 보강하고 순서·시기·품사와 기존 학습 키를 보존한다", () => {
    const [sense] = getActiveRecallSenses(cartHorseRows[0].id);
    expect(Object.keys(sense.relationMeaningsKo!)).toEqual(["reverse the proper order", "get things backward", "jump the gun"]);
    expect(sense.relationMeaningsKo?.["reverse the proper order"]).toContain("타동사");
    expect(sense.relationMeaningsKo?.["reverse the proper order"]).toContain("최종 결론까지 반드시 거짓인 것은 아니다");
    expect(sense.relationMeaningsKo?.["get things backward"]).toContain("의존하는 관계까지 특정하지는 않는다");
    expect(sense.relationMeaningsKo?.["get things backward"]).toContain("발전이 뒤떨어졌다는 별도 뜻은 아니다");
    expect(sense.relationMeaningsKo?.["jump the gun"]).toContain("반드시 단계 순서를 뒤집은 것은 아니다");
    expect(sense.nearSynonyms).toEqual(["reverse the proper order", "get things backward"]);
    expect(sense.relatedWords).toEqual(["jump the gun"]);
    expect(sense.englishDefinition).toBe("To do a later step before the earlier step on which it logically depends, reversing the proper order.");
    expect(sense.exampleSentences[0].en).toBe("Buying equipment before deciding what to build puts the cart before the horse.");
    expect(cartHorseRows.map(item => item.id)).toEqual(["JBKROW022984"]);
    expect(cartHorseRows[0].group).toBe("V501");
    expect(getItemLearningTargets(cartHorseRows[0]).map(target => target.key)).toEqual(["sense:put-the-cart-before-the-horse%3Areverse-dependent-order"]);
    expect(sense.sources[0].url).toBe("https://idioms.thefreedictionary.com/put+the+cart+before+the+horse");
    expect(sense.sources).toHaveLength(7);
    expect(new Set(sense.sources.map(source => source.independenceGroup)).size).toBe(3);
  });

  it("숙어의 definition 문제도 정답 하나와 현재 sense 계약을 유지한다", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const [definition] = buildQuizQuestions({ mode: "definition-choice", count: 1, itemNums: [cartHorseRows[0].num], preserveItemOrder: true });
    expect(definition.recallPromptId).toBe("definition");
    expect(definition.choices.filter(choice => isChoiceCorrect(definition, choice))).toHaveLength(1);
    expect(validateQuestion(definition)).toBe(true);
  });

  it("rule of thumb을 경험 기반 근사 기준 sense와 원문·초월번역 해설에 연결한다", () => {
    expect(ruleOfThumbRows.map(item => item.id)).toEqual(["APPROW01877"]);
    const [sense] = getActiveRecallSenses(ruleOfThumbRows[0].id);
    expect(sense).toMatchObject({
      senseId: "rule-of-thumb:practical-approximate-guide",
      conciseEnglishDefinition: "a practical but approximate guide based on experience",
      koreanMeaning: "경험에 근거한 실용적 어림 기준",
      nearSynonyms: ["practical guideline", "rough guide"],
      antonyms: [],
    });
    expect(sense.contextExplanationKo).toContain("개념 이미지");
    expect(sense.exampleSentences[0]).toMatchObject({ type: "editorial" });
    expect(sense.distractors.find(choice => choice.word === "hard-and-fast rule")?.reasonKo).toContain("반대");

    vi.spyOn(Math, "random").mockReturnValue(0);
    const [question] = buildQuizQuestions({ mode: "definition-choice", count: 1, itemNums: [ruleOfThumbRows[0].num], preserveItemOrder: true });
    expect(question.recall?.senseId).toBe(sense.senseId);
    expect(question.choices.map(choice => choice.value)).toContain("hard-and-fast rule");
    expect(question.choices.filter(choice => isChoiceCorrect(question, choice))).toHaveLength(1);
    expect(validateQuestion(question)).toBe(true);
  });

  it("rule of thumb의 누락 관계어 뜻만 보강하고 근사 기준·복수형·heuristic 품사 경계를 보존한다", () => {
    const [sense] = getActiveRecallSenses(ruleOfThumbRows[0].id);
    expect(Object.keys(sense.relationMeaningsKo!)).toEqual(["practical guideline", "rough guide", "rules of thumb", "heuristic"]);
    expect(sense.relationMeaningsKo?.["practical guideline"]).toContain("뜻까지 포함하지 않으므로");
    expect(sense.relationMeaningsKo?.["rough guide"]).toContain("대략적이라는 뜻");
    expect(sense.relationMeaningsKo?.["rules of thumb"]).toContain("rules에만 복수형");
    expect(sense.relationMeaningsKo?.heuristic).toContain("명사");
    expect(sense.relationMeaningsKo?.heuristic).toContain("형용사");
    expect(sense.exactSynonyms).toEqual([]);
    expect(sense.relatedWords).toEqual(["heuristic"]);
    expect(sense.variants).toEqual(["rules of thumb"]);
    expect(sense.sources[0].url).toBe("https://www.thefreedictionary.com/rule+of+thumb");
    expect(sense.sources).toHaveLength(6);
    expect(new Set(sense.sources.map(source => source.independenceGroup)).size).toBe(4);
    expect(sense.sourceCheckedAt).toBe("2026.10.06");
  });

  it("conducive to의 중복 6행을 결과 가능성을 높이는 한 sense와 반대축에 연결한다", () => {
    expect(conduciveToRows.map(item => item.id)).toEqual([
      "JBKROW001279",
      "JBKROW002322",
      "JBKROW004080",
      "JBKROW018320",
      "JBKROW021061",
      "JBKROW023530",
    ]);
    const senseIds = new Set(conduciveToRows.flatMap(item => getActiveRecallSenses(item.id).map(sense => sense.senseId)));
    expect([...senseIds]).toEqual(["conducive-to:make-result-more-likely"]);
    const [sense] = getActiveRecallSenses(conduciveToRows[0].id);
    expect(sense).toMatchObject({
      conciseEnglishDefinition: "helping to make a particular result more likely",
      koreanMeaning: "특정 결과가 일어나기 좋은 조건을 만드는",
      nearSynonyms: ["favorable to", "helpful to"],
      antonyms: ["detrimental to", "unfavorable to"],
    });
    expect(sense.contextExplanationKo).toContain("보장");
    expect(sense.distractors.find(choice => choice.word === "detrimental to")?.reasonKo).toContain("반대");

    vi.spyOn(Math, "random").mockReturnValue(0);
    const [question] = buildQuizQuestions({ mode: "definition-choice", count: 1, itemNums: [conduciveToRows[0].num], preserveItemOrder: true });
    expect(question.recall?.senseId).toBe(sense.senseId);
    expect(question.choices.map(choice => choice.value)).toContain("detrimental to");
    expect(question.choices.filter(choice => isChoiceCorrect(question, choice))).toHaveLength(1);
    expect(validateQuestion(question)).toBe(true);
  });

  it("conducive to의 누락 관계어 6개만 보강하고 6행의 공유 학습키·구문 경계를 유지한다", () => {
    const [sense] = getActiveRecallSenses(conduciveToRows[0].id);
    expect(Object.keys(sense.relationMeaningsKo!)).toEqual(["favorable to", "helpful to", "detrimental to", "unfavorable to", "promote", "facilitate"]);
    expect(sense.relationMeaningsKo?.["favorable to"]).toContain("호의적인 의견");
    expect(sense.relationMeaningsKo?.["helpful to"]).toContain("넓은 뜻");
    expect(sense.relationMeaningsKo?.["detrimental to"]).toContain("피해·손상");
    expect(sense.relationMeaningsKo?.["unfavorable to"]).toContain("반드시 단정하지는");
    expect(sense.relationMeaningsKo?.promote).toContain("타동사");
    expect(sense.relationMeaningsKo?.promote).toContain("빈칸에 그대로 넣을 수 없다");
    expect(sense.relationMeaningsKo?.facilitate).toContain("결과가 보장되는 것은 아니다");
    expect(sense.exactSynonyms).toEqual([]);
    expect(sense.relatedWords).toEqual(["promote", "facilitate"]);
    expect(sense.exampleSentences[0].en).toBe("Quiet rooms and clear instructions are conducive to careful reading.");
    const keys = new Set(conduciveToRows.flatMap(item => getItemLearningTargets(item).map(target => target.key)));
    expect([...keys]).toEqual(["sense:conducive-to%3Amake-result-more-likely"]);
    expect(sense.sources[0].url).toBe("https://www.thefreedictionary.com/conducive");
    expect(sense.sources).toHaveLength(9);
    expect(new Set(sense.sources.map(source => source.independenceGroup)).size).toBe(3);
    expect(sense.sourceCheckedAt).toBe("2026.10.06");
  });

  it("a wide range of의 중복 2행을 다양성 sense 하나와 반대축에 연결한다", () => {
    expect(wideRangeRows.map(item => item.id)).toEqual(["JBKROW000017", "JBKROW002047"]);
    const senseIds = new Set(wideRangeRows.flatMap(item => getActiveRecallSenses(item.id).map(sense => sense.senseId)));
    expect([...senseIds]).toEqual(["a-wide-range-of:many-different-kinds"]);
    const [sense] = getActiveRecallSenses(wideRangeRows[0].id);
    expect(sense).toMatchObject({
      conciseEnglishDefinition: "a large variety of things of the same general kind",
      koreanMeaning: "같은 범주 안의 매우 다양한 여러 ~",
      exactSynonyms: ["a broad range of"],
      antonyms: ["a narrow range of", "a limited range of"],
    });
    expect(sense.contextExplanationKo).toContain("종류의 폭");
    expect(sense.distractors.find(choice => choice.word === "a narrow range of")?.reasonKo).toContain("반대");

    vi.spyOn(Math, "random").mockReturnValue(0);
    const [question] = buildQuizQuestions({ mode: "definition-choice", count: 1, itemNums: [wideRangeRows[0].num], preserveItemOrder: true });
    expect(question.recall?.senseId).toBe(sense.senseId);
    expect(question.choices.map(choice => choice.value)).toContain("a narrow range of");
    expect(question.choices.filter(choice => isChoiceCorrect(question, choice))).toHaveLength(1);
    expect(validateQuestion(question)).toBe(true);
  });

  it("a wide range of의 관계어 7개를 보강하되 종류·수량·품사와 두 행의 공유 학습키를 구분한다", () => {
    const [sense] = getActiveRecallSenses(wideRangeRows[0].id);
    expect(Object.keys(sense.relationMeaningsKo!)).toEqual(["a broad range of", "a wide variety of", "a broad spectrum of", "a narrow range of", "a limited range of", "diverse", "variety"]);
    expect(sense.relationMeaningsKo?.["a broad range of"]).toContain("모든 결합에서 같은 뜻인 것은 아니며");
    expect(sense.relationMeaningsKo?.["a wide variety of"]).toContain("상한·하한");
    expect(sense.relationMeaningsKo?.["a broad spectrum of"]).toContain("빠짐없이 포함한다고 단정하지");
    expect(sense.relationMeaningsKo?.["a narrow range of"]).toContain("개체가 많이 있어도");
    expect(sense.relationMeaningsKo?.["a limited range of"]).toContain("순위를 매기지");
    expect(sense.relationMeaningsKo?.diverse).toContain("형용사");
    expect(sense.relationMeaningsKo?.diverse).toContain("문장을 바꿔야");
    expect(sense.relationMeaningsKo?.variety).toContain("명사이며");
    expect(sense.relationMeaningsKo?.variety).toContain("별도 뜻");
    expect(sense.exactSynonyms).toEqual(["a broad range of"]);
    expect(sense.nearSynonyms).toEqual(["a wide variety of", "a broad spectrum of"]);
    expect(sense.relatedWords).toEqual(["diverse", "variety"]);
    expect(sense.englishDefinition).toBe("A large variety of people or things belonging to the same general category.");
    expect(sense.exampleSentences[0].en).toBe("The reading course introduces students to a wide range of arguments, from causal claims to ethical dilemmas.");
    const keys = new Set(wideRangeRows.flatMap(item => getItemLearningTargets(item).map(target => target.key)));
    expect([...keys]).toEqual(["sense:a-wide-range-of%3Amany-different-kinds"]);
    expect(sense.sources[0].url).toBe("https://www.thefreedictionary.com/range");
    expect(sense.sources).toHaveLength(9);
    expect(new Set(sense.sources.map(source => source.independenceGroup)).size).toBe(3);
    expect(sense.sourceCheckedAt).toBe("2026.10.06");
  });

  it("zoom in on의 중복 2행을 비유적 주의 집중 sense 하나와 반대축에 연결한다", () => {
    expect(zoomInOnRows.map(item => item.id)).toEqual(["JBKROW000093", "JBKROW004059"]);
    const senseIds = new Set(zoomInOnRows.flatMap(item => getActiveRecallSenses(item.id).map(sense => sense.senseId)));
    expect([...senseIds]).toEqual(["zoom-in-on:give-close-attention"]);
    const [sense] = getActiveRecallSenses(zoomInOnRows[0].id);
    expect(sense).toMatchObject({
      conciseEnglishDefinition: "to give especially close attention to one particular thing",
      koreanMeaning: "특정 대상에 초점을 좁혀 집중하다",
      exactSynonyms: ["focus on"],
      antonyms: ["zoom out from", "gloss over"],
    });
    expect(sense.contextExplanationKo).toContain("비유적 주의 집중 sense");
    expect(sense.distractors.find(choice => choice.word === "gloss over")?.reasonKo).toContain("자세히");

    vi.spyOn(Math, "random").mockReturnValue(0);
    const [question] = buildQuizQuestions({ mode: "definition-choice", count: 1, itemNums: [zoomInOnRows[0].num], preserveItemOrder: true });
    expect(question.recall?.senseId).toBe(sense.senseId);
    expect(question.choices.map(choice => choice.value)).toContain("zoom out from");
    expect(question.choices.filter(choice => isChoiceCorrect(question, choice))).toHaveLength(1);
    expect(validateQuestion(question)).toBe(true);
  });

  it("zoom in on의 누락 관계어 7개를 보강하되 집중·정확한 특정·구문과 두 행의 공유 키를 구분한다", () => {
    const [sense] = getActiveRecallSenses(zoomInOnRows[0].id);
    expect(Object.keys(sense.relationMeaningsKo!)).toEqual(["focus on", "concentrate on", "zero in on", "zoom out from", "gloss over", "scrutinize", "pinpoint"]);
    expect(sense.relationMeaningsKo?.["focus on"]).toContain("전체를 본 뒤 한 세부로 좁힌다는 흐름까지");
    expect(sense.relationMeaningsKo?.["concentrate on"]).toContain("용액을 농축한다는 별도 뜻");
    expect(sense.relationMeaningsKo?.["zero in on"]).toContain("정답을 정확히 찾아냈다고 단정하지");
    expect(sense.relationMeaningsKo?.["zoom out from"]).toContain("무시한다는 뜻은 아니다");
    expect(sense.relationMeaningsKo?.["gloss over"]).toContain("zoom out from과 같지는 않다");
    expect(sense.relationMeaningsKo?.scrutinize).toContain("on까지 남겨 바꾸면 안 된다");
    expect(sense.relationMeaningsKo?.pinpoint).toContain("정확한 특정이라는 의미가 추가될 수");
    expect(sense.exactSynonyms).toEqual(["focus on"]);
    expect(sense.nearSynonyms).toEqual(["concentrate on", "zero in on"]);
    expect(sense.relatedWords).toEqual(["scrutinize", "pinpoint"]);
    expect(sense.englishDefinition).toBe("To notice one particular part of a larger subject and give it especially close attention.");
    expect(sense.exampleSentences[0].en).toBe("After surveying the entire passage, the editor zoomed in on the sentence that reversed the author's conclusion.");
    const keys = new Set(zoomInOnRows.flatMap(item => getItemLearningTargets(item).map(target => target.key)));
    expect([...keys]).toEqual(["sense:zoom-in-on%3Agive-close-attention"]);
    expect(sense.sources[0].url).toBe("https://idioms.thefreedictionary.com/zoom+in+on");
    expect(sense.sources).toHaveLength(10);
    expect(new Set(sense.sources.map(source => source.independenceGroup)).size).toBe(4);
    expect(sense.sourceCheckedAt).toBe("2026.10.06");
  });

  it("gloss over의 중복 8행을 세부 회피 sense 하나와 개별 관계 뜻에 연결한다", () => {
    expect(glossOverRows.map(item => item.id)).toEqual([
      "JBKROW001061",
      "JBKROW002838",
      "JBKROW005017",
      "JBKROW007057",
      "JBKROW009466",
      "JBKROW012192",
      "JBKROW018844",
      "JBKROW021403",
    ]);
    const [sense] = getActiveRecallSenses(glossOverRows[0].id);
    expect(sense).toMatchObject({
      senseId: "gloss-over:avoid-unpleasant-detail",
      conciseEnglishDefinition: "to avoid dealing with an unpleasant matter in enough detail",
      koreanMeaning: "불편하거나 중요한 사실을 자세히 다루지 않고 얼버무리다",
      nearSynonyms: ["play down", "skim over", "paper over"],
      antonyms: ["dwell on", "confront directly"],
      relationMeaningsKo: {
        "play down": "실제보다 덜 중요하게 보이도록 말하다",
        "dwell on": "한 문제를 오래 자세히 말하거나 생각하다",
      },
    });
    expect(sense.contextExplanationKo).toContain("역사적 어원 설명이 아니다");

    vi.spyOn(Math, "random").mockReturnValue(0);
    const [question] = buildQuizQuestions({ mode: "definition-choice", count: 1, itemNums: [glossOverRows[0].num], preserveItemOrder: true });
    expect(question.recall?.senseId).toBe(sense.senseId);
    expect(question.choices.map(choice => choice.value)).toContain("dwell on");
    expect(question.choices.filter(choice => isChoiceCorrect(question, choice))).toHaveLength(1);
    expect(validateQuestion(question)).toBe(true);
  });

  it("take into account는 고려를 찬성·사실 전제와 구별하고 개별 한국어 뜻을 갖는다", () => {
    expect(takeIntoAccountRows.map(item => item.id)).toEqual(["APPROW02130"]);
    const [sense] = getActiveRecallSenses(takeIntoAccountRows[0].id);
    expect(sense.senseId).toBe("take-into-account:consider-factor");
    expect(sense.koreanMeaning).toBe("판단·결정할 때 관련 사실이나 사정을 고려에 넣다");
    expect(sense.exactSynonyms).toEqual(["take into consideration", "take account of"]);
    expect(sense.contextExplanationKo).toContain("take it into account");
    expect(sense.exampleSentences[0].cueKo).toContain("동의");
    for (const word of [...sense.exactSynonyms, ...sense.nearSynonyms, ...sense.antonyms, ...sense.variants]) {
      expect(sense.relationMeaningsKo?.[word]).toBeTruthy();
    }
    expect(sense.distractors.find(choice => choice.word === "approve of")?.reasonKo).toContain("동의하지 않을");
  });

  it("take into account 본 문항·오답 복습은 같은 단일 정답 계약을 사용한다", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const [question] = buildQuizQuestions({ mode: "definition-choice", count: 1, itemNums: [takeIntoAccountRows[0].num], preserveItemOrder: true });
    expect(question.recall?.senseId).toBe("take-into-account:consider-factor");
    expect(question.choices.filter(choice => isChoiceCorrect(question, choice))).toHaveLength(1);
    expect(question.choices.map(choice => choice.value)).toEqual(expect.arrayContaining(["take into account", "take for granted", "approve of", "account for"]));
    expect(validateQuestion(question)).toBe(true);
    const [review] = buildReviewQuestions([takeIntoAccountRows[0].num], 1);
    expect(review.recall?.senseId).toBe(question.recall?.senseId);
    expect(review.choices.filter(choice => isChoiceCorrect(review, choice))).toHaveLength(1);
  });

  it("without fail의 의무·반복 sense를 분리하고 각각 단일정답 문제로 만든다", () => {
    expect(withoutFailRows.map(item => item.id)).toEqual(["APPROW02335"]);
    const senses = getActiveRecallSenses(withoutFailRows[0].id);
    expect(senses.map(sense => sense.senseId)).toEqual([
      "without-fail:required-certainty",
      "without-fail:every-time-no-exception",
    ]);
    expect(senses[0]).toMatchObject({
      conciseEnglishDefinition: "definitely, with no failure to do the required action",
      koreanMeaning: "명령·약속에서 반드시, 틀림없이",
      exactSynonyms: ["definitely"],
    });
    expect(senses[1]).toMatchObject({
      conciseEnglishDefinition: "on every occasion, with no exception",
      koreanMeaning: "반복되는 모든 경우에 예외 없이, 매번",
      exactSynonyms: ["without exception"],
    });
    expect(senses[0].contextExplanationKo).toContain("별도 sense");
    expect(senses[1].contextExplanationKo).toContain("반복 빈도");

    const firstRandom = vi.spyOn(Math, "random").mockReturnValue(0);
    const [required] = buildQuizQuestions({ mode: "definition-choice", count: 1, itemNums: [withoutFailRows[0].num], preserveItemOrder: true });
    expect(required.recall?.senseId).toBe("without-fail:required-certainty");
    expect(required.choices.filter(choice => isChoiceCorrect(required, choice))).toHaveLength(1);
    expect(validateQuestion(required)).toBe(true);
    firstRandom.mockRestore();

    vi.spyOn(Math, "random").mockReturnValue(0.9);
    const [repeated] = buildQuizQuestions({ mode: "definition-choice", count: 1, itemNums: [withoutFailRows[0].num], preserveItemOrder: true });
    expect(repeated.recall?.senseId).toBe("without-fail:every-time-no-exception");
    expect(repeated.choices.filter(choice => isChoiceCorrect(repeated, choice))).toHaveLength(1);
    expect(validateQuestion(repeated)).toBe(true);
  });

  it("without fail 반복 뜻의 모든 관계어를 보강하되 빈도·규칙성 경계를 유지한다", () => {
    const [required, repeated] = getActiveRecallSenses(withoutFailRows[0].id);
    expect(required.sourceCheckedAt).toBe("2026.10.06");
    expect(required.relationMeaningsKo?.perhaps).toBeTruthy();
    const relations = [...repeated.exactSynonyms, ...repeated.nearSynonyms, ...repeated.antonyms, ...repeated.relatedWords];
    expect(Object.keys(repeated.relationMeaningsKo!)).toEqual(relations);
    expect(repeated.relationMeaningsKo?.["not always"]).toContain("never가 아니다");
    expect(repeated.relationMeaningsKo?.["not always"]).toContain("가끔인지 대체로 그런지까지 정해 주지는 않는다");
    expect(repeated.relationMeaningsKo?.["like clockwork"]).toContain("늘 바꿔 쓸 수는 없다");
    expect(repeated.exactSynonyms).not.toContain("like clockwork");
    expect(repeated.nearSynonyms).not.toContain("like clockwork");
    expect(repeated.sourceCheckedAt).toBe("2026.10.06");
    expect(new Set(repeated.sources.map(source => source.independenceGroup))).toEqual(new Set(["Oxford", "Collins"]));
    expect(repeated.sources.map(source => source.url)).toContain("https://www.collinsdictionary.com/dictionary/english/like-clockwork");
    expect(repeated.prompts.map(prompt => prompt.id)).toEqual(["definition", "context"]);
    expect(repeated.exampleSentences).toHaveLength(1);
    expect(repeated.exampleSentences[0].en).toBe("During the review month, she checked the error log every evening without fail.");
  });

  it("without fail 의무 뜻의 관계어에서 확실성·조건·가능성을 섞지 않는다", () => {
    const [required, repeated] = getActiveRecallSenses(withoutFailRows[0].id);
    const relations = [...required.exactSynonyms, ...required.nearSynonyms, ...required.antonyms, ...required.relatedWords];
    expect(Object.keys(required.relationMeaningsKo!)).toEqual(relations);
    expect(required.relationMeaningsKo?.definitely).toContain("언제나 반드시 해야 한다는 의무를 뜻하지는 않는다");
    expect(required.relationMeaningsKo?.["for certain"]).toContain("의무 강조가 약해지거나 구문이 어색해질 수 있다");
    expect(required.relationMeaningsKo?.["no matter what"]).toContain("조건이 달라져도 바뀌지 않는다는 초점");
    expect(required.relationMeaningsKo?.["if possible"]).toContain("불가능하다고 단정하는 말은 아니다");
    expect(required.relationMeaningsKo?.perhaps).toContain("금지나 절대 일어나지 않는다는 뜻은 아니다");
    expect(required.relatedWords).toEqual(["without exception"]);
    expect(required.nearSynonyms).not.toContain("without exception");
    expect(required.prompts.map(prompt => prompt.id)).toEqual(["definition", "context"]);
    expect(required.exampleSentences[0].en).toBe("Submit the revised statement by noon tomorrow without fail.");
    expect(required.englishDefinition).toBe("Used to stress that a required action will definitely be done, especially by a stated time.");
    expect(new Set(required.sources.map(source => source.independenceGroup))).toEqual(new Set(["Oxford", "Collins"]));
    expect(required.sources).toHaveLength(9);
    expect(repeated.relationMeaningsKo?.["not always"]).toContain("never가 아니다");
    expect(repeated.sources).toHaveLength(8);
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
    const [assumption] = buildQuizQuestions({ mode: "definition-choice", count: 1, itemNums: [takeForGrantedRows[0].num], preserveItemOrder: true });
    expect(assumption.recall?.senseId).toBe("take-for-granted:assume-without-checking");
    expect(assumption.choices.filter(choice => isChoiceCorrect(assumption, choice))).toHaveLength(1);
    expect(validateQuestion(assumption)).toBe(true);
    firstRandom.mockRestore();

    vi.spyOn(Math, "random").mockReturnValue(0.9);
    const [appreciation] = buildQuizQuestions({ mode: "definition-choice", count: 1, itemNums: [takeForGrantedRows[0].num], preserveItemOrder: true });
    expect(appreciation.recall?.senseId).toBe("take-for-granted:fail-to-appreciate");
    expect(appreciation.recall?.prompts.find(prompt => prompt.id === appreciation.recallPromptId)?.kind).toBe("definition-recall");
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
    vi.spyOn(Math, "random").mockReturnValue(0);
    const [question] = buildQuizQuestions({ mode: "definition-choice", count: 1, itemNums: [workOutRows[0].num], preserveItemOrder: true });
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

  it("abide by의 관계어 뜻만 보강하고 준수·무시·관찰 경계와 두 행의 공유 학습 키를 보존한다", () => {
    const [sense] = getActiveRecallSenses(abideByRows[0].id);
    expect(Object.keys(sense.relationMeaningsKo!)).toEqual(["comply with", "adhere to", "violate", "disregard", "observe"]);
    expect(sense.relationMeaningsKo?.["comply with"]).toContain("초점까지 항상 같지는 않다");
    expect(sense.relationMeaningsKo?.["adhere to"]).toContain("물체가 달라붙는 별도 뜻이 아니다");
    expect(sense.relationMeaningsKo?.violate).toContain("by를 남기지 않는다");
    expect(sense.relationMeaningsKo?.disregard).toContain("모든 용례가 규칙 위반인 것은 아니며");
    expect(sense.relationMeaningsKo?.observe).toContain("관찰하거나 알아차린다는 뜻이 아니다");
    expect(sense.englishDefinition).toBe("To follow a rule or decision, or honor an agreement that governs what you should do.");
    expect(sense.exampleSentences[0].en).toBe("Even members who opposed the decision agreed to abide by it until the review was complete.");
    expect(sense.nearSynonyms).toEqual(["comply with", "adhere to"]);
    expect(sense.antonyms).toEqual(["violate", "disregard"]);
    expect(sense.relatedWords).toEqual(["observe"]);
    expect(abideByRows.map(item => [item.id, item.num, item.group])).toEqual([["JBKROW000004", 2, "V101"], ["JBKROW002049", 2006, "V101"]]);
    for (const row of abideByRows) expect(getItemLearningTargets(row).map(target => target.key)).toEqual(["sense:abide-by%3Afollow-governing-rule"]);
    expect(sense.sources[0].url).toBe("https://idioms.thefreedictionary.com/abide+by");
    expect(sense.sources).toHaveLength(8);
    expect(new Set(sense.sources.map(source => source.independenceGroup)).size).toBe(3);
  });

  it("abide by 영영 문제도 정답 하나와 현재 sense 계약을 유지한다", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const [question] = buildQuizQuestions({ mode: "definition-choice", count: 1, itemNums: [abideByRows[0].num], preserveItemOrder: true });
    expect(question.recall?.senseId).toBe("abide-by:follow-governing-rule");
    expect(question.choices.filter(choice => isChoiceCorrect(question, choice))).toHaveLength(1);
    expect(validateQuestion(question)).toBe(true);
  });

  it("teem with를 많은 대상의 활발한 밀집 sense로 두 행에 연결한다", () => {
    expect(teemWithRows.map(item => item.id)).toEqual(["JBKROW000005", "JBKROW003863"]);
    const sense = getActiveRecallSenses(teemWithRows[0].id)[0];
    expect(sense).toMatchObject({
      senseId: "teem-with:contain-many-active-things",
      conciseEnglishDefinition: "to contain very many active people, animals, or things",
      koreanMeaning: "사람·생물 등으로 가득하다; 북적거리다",
      nearSynonyms: ["be full of", "abound with"],
      variants: ["be teeming with"],
    });
    expect(sense.distractors.find(choice => choice.word === "team up with")?.reasonKo).toContain("철자");
    expect(getActiveRecallSenses(teemWithRows[1].id)[0].senseId).toBe(sense.senseId);
  });

  it("teem with 관계어만 부분 보강하고 부재·부족·활동성과 두 행의 공유 키를 보존한다", () => {
    const [sense] = getActiveRecallSenses(teemWithRows[0].id);
    expect(Object.keys(sense.relationMeaningsKo!)).toEqual(["be full of", "abound with", "be devoid of", "lack", "be teeming with", "swarm with"]);
    expect(sense.relationMeaningsKo?.["be full of"]).toContain("느낌까지 항상 같지는 않다");
    expect(sense.relationMeaningsKo?.["abound with"]).toContain("be를 앞에 붙이지 않는다");
    expect(sense.relationMeaningsKo?.["be devoid of"]).toContain("부정문이 곧 완전한 부재라는 뜻은 아니다");
    expect(sense.relationMeaningsKo?.lack).toContain("with나 of를 넣지 않는다");
    expect(sense.relationMeaningsKo?.["be teeming with"]).toContain("was teeming with");
    expect(sense.relationMeaningsKo?.["swarm with"]).toContain("더 강하다고 단정할 수는 없다");
    expect(sense.englishDefinition).toBe("For a place or area to contain very many people, animals, or things, often with a sense of active abundance.");
    expect(sense.exampleSentences[0].en).toBe("By midsummer, the wetland teemed with insects and nesting birds.");
    expect(sense.exactSynonyms).toEqual([]);
    expect(sense.nearSynonyms).toEqual(["be full of", "abound with"]);
    expect(sense.antonyms).toEqual(["be devoid of", "lack"]);
    expect(teemWithRows.map(item => [item.id, item.num, item.group])).toEqual([["JBKROW000005", 3, "V101"], ["JBKROW003863", 3801, "V101"]]);
    for (const row of teemWithRows) expect(getItemLearningTargets(row).map(target => target.key)).toEqual(["sense:teem-with%3Acontain-many-active-things"]);
    expect(sense.sources[0].url).toBe("https://www.thefreedictionary.com/teem");
    expect(sense.sources).toHaveLength(12);
    expect(new Set(sense.sources.map(source => source.independenceGroup))).toEqual(new Set(["American Heritage", "Collins"]));
  });

  it("teem with 영영 문제도 정답 하나와 현재 sense 계약을 유지한다", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const [question] = buildQuizQuestions({ mode: "definition-choice", count: 1, itemNums: [teemWithRows[0].num], preserveItemOrder: true });
    expect(question.recall?.senseId).toBe("teem-with:contain-many-active-things");
    expect(question.choices.map(choice => choice.value)).toContain("team up with");
    expect(question.choices.filter(choice => isChoiceCorrect(question, choice))).toHaveLength(1);
    expect(validateQuestion(question)).toBe(true);
  });

  it("wrap up의 업무 마무리 sense만 두 행에 연결한다", () => {
    expect(wrapUpRows.map(item => item.id)).toEqual(["JBKROW000016", "JBKROW004042"]);
    const sense = getActiveRecallSenses(wrapUpRows[0].id)[0];
    expect(sense).toMatchObject({
      senseId: "wrap-up:finish-activity",
      conciseEnglishDefinition: "to finish an activity by completing its final details",
      koreanMeaning: "일·회의의 남은 부분을 정리해 마무리하다",
      nearSynonyms: ["bring to a close", "finish up"],
      variants: ["wrap it up"],
    });
    expect(sense.englishDefinition).not.toContain("warm");
    expect(sense.englishDefinition).not.toContain("paper");
    expect(sense.distractors.find(choice => choice.word === "sum up")?.reasonKo).toContain("간추리는");
    expect(getActiveRecallSenses(wrapUpRows[1].id)[0].senseId).toBe(sense.senseId);
  });

  it("wrap up 영영 문제도 정답 하나와 현재 sense 계약을 유지한다", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const [question] = buildQuizQuestions({ mode: "definition-choice", count: 1, itemNums: [wrapUpRows[0].num], preserveItemOrder: true });
    expect(question.recall?.senseId).toBe("wrap-up:finish-activity");
    expect(question.choices.map(choice => choice.value)).toContain("sum up");
    expect(question.choices.filter(choice => isChoiceCorrect(question, choice))).toHaveLength(1);
    expect(validateQuestion(question)).toBe(true);
  });
});
