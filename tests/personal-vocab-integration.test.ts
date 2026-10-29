import { expect, it, vi } from "vitest";

vi.mock("@/assets/personal-vocab.json", () => ({ default: { schema: 1, requiresAccess: true, entries: [
  { id: "personal-fixture", num: 1000000001, key: "private fixture phrase", word: "private fixture phrase",
    gloss: "개인 참고 뜻", sourceSection: "보카바이블 B", sources: [], notes: [], examples: [], relationHints: [],
    sourceStudyId: "source-stable-fixture", ipa: "/ˈfɪkstʃər/", koreanPronunciation: "픽스처",
    pronunciationStatus: "source_checked", koreanPronunciationStatus: "approximate_aid",
    studyStatus: "SOURCE_STUDY_HOLD", studyHoldReason: "원문 검토 보류",
    sourceReview: { review_level: "source_only" } },
  { id: "personal-existing", num: 1000000002, key: "capricious", word: "capricious",
    gloss: "별도 참고 뜻", sourceSection: "보카바이블 B", sources: [], notes: [], examples: [], relationHints: [] },
], retiredEntries: [
  { id: "personal-retired", num: 1000000003, key: "private old phrase", word: "private old phrase",
    gloss: "구판 원문 뜻", sourceSection: "구판", sources: [], notes: [], examples: [], relationHints: [],
    ipa: "/əʊld/", studyHoldReason: "구판 보류 그대로", studyStatus: "SOURCE_STUDY_HOLD",
    retired: true, retirementStatus: "RETIRED_REFERENCE_ONLY", retirementReason: "구판 읽기 참조" },
] } }));

import { VOCAB, WORDBOOK_VOCAB, WORDBOOK_RANGES, getWordbookRangeItems, VOCAB_BY_ID, VOCAB_BY_NUM, formatVocabSections } from "../lib/vocab";
import { getPersonalVocabReference } from "../lib/personal-vocab";
import { buildQuizQuestions, buildReviewQuestions } from "../lib/quiz-engine";

it("adds private words to the actual wordbook/ranges/maps without replacing canonical words", () => {
  expect(VOCAB).toHaveLength(38163);
  expect(WORDBOOK_VOCAB).toHaveLength(38164);
  const added = VOCAB_BY_ID.get("personal-fixture")!;
  expect(added).toMatchObject({ num: 1000000001, referenceOnly: true, p: "/ˈfɪkstʃər/", s: [],
    koreanPronunciation: "픽스처", sourceStudyId: "source-stable-fixture",
    studyStatus: "SOURCE_STUDY_HOLD", studyHoldReason: "원문 검토 보류" });
  expect(getWordbookRangeItems(WORDBOOK_RANGES.find(range => range.id === "personal")!)).toEqual([added]);
  expect(formatVocabSections(["PERSONAL"])).toContain("개인 통합");
  expect(VOCAB.filter(item => item.w === "capricious").every(item => item.k !== "별도 참고 뜻")).toBe(true);
  expect(getPersonalVocabReference("CAPRICIOUS")?.gloss).toBe("별도 참고 뜻");
});

it("does not promote source-transcription content into normal or review answers", () => {
  expect(buildQuizQuestions({ mode: "kor-choice", itemNums: [1000000001], count: 1 })).toEqual([]);
  expect(buildReviewQuestions([1000000001], 1)).toEqual([]);
  expect(buildQuizQuestions({ mode: "kor-choice", itemNums: [4], count: 1 })).toHaveLength(1);
});

it("resolves retired bookmark IDs and nums only as original read-only references, never as list or quiz rows", () => {
  const retired = VOCAB_BY_ID.get("personal-retired")!;
  expect(retired).toMatchObject({ num: 1000000003, w: "private old phrase", k: "구판 원문 뜻",
    p: "/əʊld/", referenceOnly: true, retiredReferenceOnly: true, studyStatus: "SOURCE_STUDY_HOLD",
    studyHoldReason: "구판 보류 그대로", retirementStatus: "RETIRED_REFERENCE_ONLY" });
  expect(VOCAB_BY_NUM.get(1000000003)).toBe(retired);
  expect(WORDBOOK_VOCAB.some(item => item.id === retired.id)).toBe(false);
  expect(VOCAB.some(item => item.id === retired.id)).toBe(false);
  expect(getPersonalVocabReference("private old phrase")).toBeUndefined();
  expect(buildQuizQuestions({ mode: "kor-choice", itemNums: [1000000003], count: 1 })).toEqual([]);
  expect(buildReviewQuestions([1000000003], 1)).toEqual([]);
});
