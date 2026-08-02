import { describe, expect, it } from "vitest";

import {
  RANGES,
  SECTION_RANGES,
  VOCAB,
  VOCAB_META,
  VOCAB_WITH_SYNONYMS,
  getRelatedWords,
  getSynonymDetails,
  isAcceptedSynonym,
  normalizeWord,
} from "@/lib/vocab";
import {
  buildQuizQuestions,
  buildReviewQuestions,
  isChoiceCorrect,
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
    expect(SECTION_RANGES.reduce((sum, range) => sum + range.count, 0)).toBe(VOCAB.length);

    for (const range of SECTION_RANGES) {
      expect(range.end - range.start + 1).toBe(range.count);
      expect(VOCAB[range.start]?.group).toBe(range.group);
      expect(VOCAB[range.end]?.group).toBe(range.group);
    }
    expect(RANGES.some((range) => range.id === "all" && range.count === VOCAB.length)).toBe(true);
  });

  it("links every accepted synonym to its own exact meaning", () => {
    expect(VOCAB_WITH_SYNONYMS).toHaveLength(11318);

    for (const item of VOCAB_WITH_SYNONYMS) {
      const details = getSynonymDetails(item);
      expect(details).toHaveLength(item.s.length);
      expect(new Set(details.map((detail) => normalizeWord(detail.word))).size).toBe(details.length);

      const related = getRelatedWords(item);
      for (const detail of details) {
        expect(detail.meaning.trim().length).toBeGreaterThan(0);
        expect(isAcceptedSynonym(item, detail.word)).toBe(true);
        expect(related.has(normalizeWord(detail.word))).toBe(true);
      }
    }
  });

  it("does not label a clear-sense synonym with the target word's meaning", () => {
    const transparent = VOCAB.find(
      (item) => item.w === "transparent" && item.group === "V301" && item.s.includes("limpid"),
    );
    expect(transparent).toBeDefined();

    const limpid = getSynonymDetails(transparent!).find((detail) => detail.word === "limpid");
    expect(limpid?.meaning).toContain("맑은");
    expect(limpid?.meaning).not.toBe(transparent!.k);
  });
});

describe("shared quiz engine", () => {
  it("creates every available validated question up to the requested count", () => {
    const modes = ["syn-choice", "kor-choice", "syn-kor-choice"] as const;

    for (const range of SECTION_RANGES) {
      for (const mode of modes) {
        const questions = buildQuizQuestions({ mode, rangeId: range.id, count: 12 });
        const rangeItems = VOCAB.slice(range.start, range.end + 1);
        const availableCount =
          mode === "kor-choice"
            ? rangeItems.length
            : rangeItems.filter((item) => item.s.length > 0).length;
        expect(questions).toHaveLength(Math.min(12, availableCount));

        for (const question of questions) {
          expect(validateQuestion(question)).toBe(true);
          expect(question.choices).toHaveLength(4);
          expect(new Set(question.choices.map((choice) => choice.label)).size).toBe(4);
          expect(question.choices.filter((choice) => isChoiceCorrect(question, choice))).toHaveLength(1);
        }
      }
    }
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
});
