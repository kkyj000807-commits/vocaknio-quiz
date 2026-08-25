import { describe, expect, it } from "vitest";

import {
  RANGES,
  SECTION_RANGES,
  VOCAB,
  VOCAB_META,
  VOCAB_WITH_SYNONYMS,
  getRelatedWords,
  getSynonymDetails,
  getVocabItem,
  isAcceptedSynonym,
  normalizeWord,
} from "@/lib/vocab";
import {
  buildQuizQuestions,
  buildReviewQuestions,
  isChoiceCorrect,
  isTypedAnswerCorrect,
  validateQuestion,
} from "@/lib/quiz-engine";

const EXPECTED_GROUP_COUNTS = {
  V101: 4028,
  V201: 4016,
  V301: 4854,
  V401: 3965,
  V501: 5888,
  V502: 10127,
  V601: 2935,
  APPENDIX: 2350,
} as const;

describe("final vocabulary v1.4", () => {
  it("loads the verified final source without dropping entries", () => {
    expect(VOCAB_META.version).toBe("v1.4");
    expect(VOCAB_META.sourceRows).toBe(39750);
    expect(VOCAB_META.sourceEntries).toBe(38163);
    expect(VOCAB_META.sourceSha256).toBe(
      "6ad8b6941e8746992440ac10ec08c1ca641b37d022bffff7c65ea1236f916a84",
    );
    expect(VOCAB).toHaveLength(38163);
    expect(VOCAB_META.groupCounts).toEqual(EXPECTED_GROUP_COUNTS);
  });

  it("keeps stable unique numbers and complete section coverage", () => {
    expect(VOCAB.every((item, index) => item.num === index + 1)).toBe(true);
    expect(new Set(VOCAB.map((item) => item.id)).size).toBe(VOCAB.length);
    expect(SECTION_RANGES.reduce((sum, range) => sum + range.count, 0)).toBe(
      VOCAB.length,
    );

    for (const range of SECTION_RANGES) {
      expect(range.end - range.start + 1).toBe(range.count);
      expect(VOCAB[range.start]?.group).toBe(range.group);
      expect(VOCAB[range.end]?.group).toBe(range.group);
    }
    expect(
      RANGES.some(
        (range) => range.id === "all" && range.count === VOCAB.length,
      ),
    ).toBe(true);
  });

  it("links every accepted synonym to its own exact meaning", () => {
    expect(VOCAB_WITH_SYNONYMS).toHaveLength(11277);

    for (const item of VOCAB_WITH_SYNONYMS) {
      const details = getSynonymDetails(item);
      expect(details).toHaveLength(item.s.length);
      expect(
        new Set(details.map((detail) => normalizeWord(detail.word))).size,
      ).toBe(details.length);

      const related = getRelatedWords(item);
      for (const detail of details) {
        expect(detail.meaning.trim().length).toBeGreaterThan(0);
        expect(isAcceptedSynonym(item, detail.word)).toBe(true);
        expect(related.has(normalizeWord(detail.word))).toBe(true);
      }
    }
  });

  it("blocks confirmed wrong-sense and wrong-part-of-speech synonym answers", () => {
    const blockedCases = [
      { num: 198, id: "JBKROW000203", w: "appropriate", k: "착복하다" },
      { num: 1023, id: "JBKROW001045", w: "benign", k: "양성의" },
      {
        num: 9270,
        id: "JBKROW009645",
        w: "smolder",
        k: "(감정이) 속에서 맺히다; 그을다",
      },
      { num: 1784, id: "JBKROW001820", w: "explicit", k: "노골적인" },
      { num: 380, id: "JBKROW000388", w: "envoy", k: "특사" },
      { num: 1881, id: "JBKROW001919", w: "effeminate", k: "여성적인" },
      { num: 26006, id: "JBKROW027217", w: "refrain", k: "후렴구" },
    ];

    for (const expected of blockedCases) {
      const item = getVocabItem(expected.num);
      expect(item).toMatchObject(expected);
      expect(item?.s).toEqual([]);
      expect(
        buildQuizQuestions({
          mode: "syn-choice",
          itemNums: [expected.num],
          count: 1,
        }),
      ).toEqual([]);
      expect(
        buildQuizQuestions({
          mode: "syn-type",
          itemNums: [expected.num],
          count: 1,
        }),
      ).toEqual([]);
    }

    const carnage = getVocabItem(347);
    expect(carnage).toMatchObject({
      id: "JBKROW000355",
      w: "carnage",
      k: "대학살",
    });
    expect(carnage?.s).toEqual(["holocaust", "massacre"]);
    expect(carnage?.s).not.toContain("annihilate");
    expect(carnage?.s).not.toContain("sterilize");

    const carnageChoice = buildQuizQuestions({
      mode: "syn-choice",
      itemNums: [347],
      count: 1,
    })[0];
    const carnageTyped = buildQuizQuestions({
      mode: "syn-type",
      itemNums: [347],
      count: 1,
    })[0];
    for (const invalidAnswer of ["annihilate", "sterilize"]) {
      expect(
        isChoiceCorrect(carnageChoice, {
          id: invalidAnswer,
          value: invalidAnswer,
          label: invalidAnswer,
          word: invalidAnswer,
          meaning: "",
          isCorrect: true,
        }),
      ).toBe(false);
      expect(isTypedAnswerCorrect(carnageTyped, invalidAnswer)).toBe(false);
    }
  });

  it("preserves useful synonyms on rows whose displayed sense matches", () => {
    expect(getVocabItem(23486)?.s).toContain("apposite");
    expect(getVocabItem(23179)?.s).toContain("coda");
    expect(getVocabItem(10571)?.s).toContain("epilogue");
    expect(getVocabItem(27531)?.s).toContain("abstain");
    expect(getVocabItem(18506)?.s).toEqual(["holocaust", "massacre"]);

    expect(VOCAB_META.semanticGuard).toMatchObject({
      version: "v1",
      ruleCount: 8,
      rawSynonymEntryCount: 11318,
      rawLinkedSynonymCount: 65589,
      blockedEntryCount: 41,
      removedLinkCount: 370,
      linkedSynonymCount: 65219,
    });
  });

  it("does not label a clear-sense synonym with the target word's meaning", () => {
    const transparent = VOCAB.find(
      (item) =>
        item.w === "transparent" &&
        item.group === "V301" &&
        item.s.includes("limpid"),
    );
    expect(transparent).toBeDefined();

    const limpid = getSynonymDetails(transparent!).find(
      (detail) => detail.word === "limpid",
    );
    expect(limpid?.meaning).toContain("맑은");
    expect(limpid?.meaning).not.toBe(transparent!.k);
  });
});

describe("shared quiz engine", () => {
  it("creates every available validated question up to the requested count", () => {
    const modes = ["syn-choice", "kor-choice", "syn-kor-choice"] as const;

    for (const range of SECTION_RANGES) {
      for (const mode of modes) {
        const questions = buildQuizQuestions({
          mode,
          rangeId: range.id,
          count: 12,
        });
        const rangeItems = VOCAB.slice(range.start, range.end + 1);
        const availableCount =
          mode === "kor-choice"
            ? rangeItems.length
            : rangeItems.filter((item) => item.s.length > 0).length;
        expect(questions).toHaveLength(Math.min(12, availableCount));

        for (const question of questions) {
          expect(validateQuestion(question)).toBe(true);
          expect(question.choices).toHaveLength(4);
          expect(
            new Set(question.choices.map((choice) => choice.label)).size,
          ).toBe(4);
          expect(
            question.choices.filter((choice) =>
              isChoiceCorrect(question, choice),
            ),
          ).toHaveLength(1);
        }
      }
    }
  });

  it("fills sparse-synonym ranges with validated meaning questions", () => {
    for (const rangeId of ["idioms", "v601", "appendix"] as const) {
      const questions = buildQuizQuestions({
        mode: "syn-choice",
        rangeId,
        count: 20,
        allowMeaningFallback: true,
      });

      expect(questions).toHaveLength(20);
      expect(new Set(questions.map((question) => question.item.num)).size).toBe(
        20,
      );
      expect(questions.every(validateQuestion)).toBe(true);
      expect(
        questions.some((question) => question.answerKind === "meaning"),
      ).toBe(true);
    }
  });

  it("keeps synonym-plus-meaning questions in their requested format", () => {
    const questions = buildQuizQuestions({
      mode: "syn-kor-choice",
      itemNums: [1, 2],
      count: 2,
      allowMeaningFallback: true,
      preserveItemOrder: true,
    });

    expect(questions).toHaveLength(1);
    expect(questions[0]?.item.num).toBe(1);
    expect(questions[0]?.mode).toBe("syn-kor-choice");
    expect(questions[0]?.answerKind).toBe("synonym");
    expect(
      questions[0]?.choices.every(
        (choice) =>
          Boolean(choice.word) &&
          Boolean(choice.meaning) &&
          choice.label === `${choice.word} (${choice.meaning})`,
      ),
    ).toBe(true);
    expect(
      questions[0]?.choices.filter((choice) =>
        isChoiceCorrect(questions[0]!, choice),
      ),
    ).toHaveLength(1);
  });

  it("does not restore blocked synonyms when a question falls back to meaning", () => {
    const question = buildQuizQuestions({
      mode: "syn-choice",
      itemNums: [198],
      count: 1,
      allowMeaningFallback: true,
      preserveItemOrder: true,
    })[0];

    expect(question).toBeDefined();
    if (!question) throw new Error("meaning fallback question was not created");
    expect(question.answerKind).toBe("meaning");
    expect(question.mode).toBe("kor-choice");
    expect(
      question.choices.filter((choice) => isChoiceCorrect(question, choice)),
    ).toHaveLength(1);
  });

  it("accepts every verified answer in direct-input questions", () => {
    const questions = buildQuizQuestions({
      mode: "syn-type",
      rangeId: "v502",
      count: 30,
    });
    expect(questions).toHaveLength(30);
    for (const question of questions) {
      expect(question.acceptedAnswers).toEqual(question.item.s);
      expect(question.acceptedAnswers.length).toBeGreaterThan(0);
    }
  });

  it("uses the same validated flow for wrong-answer review", () => {
    const nums = VOCAB_WITH_SYNONYMS.slice(0, 30).map((item) => item.num);
    const questions = buildReviewQuestions(nums, 20);
    expect(questions).toHaveLength(20);
    expect(questions.every(validateQuestion)).toBe(true);
  });

  it("restricts a bookmarked quiz to the explicitly supplied item numbers", () => {
    const bookmarked = VOCAB_WITH_SYNONYMS.slice(0, 7).map((item) => item.num);
    const questions = buildQuizQuestions({
      mode: "syn-choice",
      count: 20,
      itemNums: bookmarked,
    });

    expect(questions).toHaveLength(bookmarked.length);
    expect(
      questions.every((question) => bookmarked.includes(question.item.num)),
    ).toBe(true);
    expect(new Set(questions.map((question) => question.item.num))).toEqual(
      new Set(bookmarked),
    );
  });

  it("returns an empty flashcard session when every selected item is mastered", () => {
    const nums = VOCAB.slice(0, 5).map((item) => item.num);
    expect(
      buildQuizQuestions({
        mode: "flashcard",
        count: 5,
        itemNums: nums,
        masteredNums: nums,
      }),
    ).toEqual([]);
  });
});
