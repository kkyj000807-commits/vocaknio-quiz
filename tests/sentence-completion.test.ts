import { describe, expect, it } from "vitest";
import { sentenceCompletionCatalogSchema, validateSentenceCompletionCatalog, SENTENCE_COMPLETION_QUESTIONS, blankPosition, sentenceCompletionKey } from "@/lib/sentence-completion";
import { buildQuizQuestions, isChoiceCorrect, validateQuestion } from "@/lib/quiz-engine";
import { getItemLearningTargets, getQuestionLearningTargetKey, parseLearningReviewKeys } from "@/lib/canonical-learning";
import { VOCAB_BY_ID } from "@/lib/vocab";
import { createEmptyQuestionViewState, parseQuizSession } from "@/lib/quiz-session";

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
const first = SENTENCE_COMPLETION_QUESTIONS[0];
describe("Sentence Completion uses the existing question contract", () => {
  it("supports 12 logic relationships, three difficulties and one/short-context blanks", () => {
    expect(SENTENCE_COMPLETION_QUESTIONS).toHaveLength(12);
    expect(new Set(SENTENCE_COMPLETION_QUESTIONS.map(q => q.logicType)).size).toBe(12);
    expect(new Set(SENTENCE_COMPLETION_QUESTIONS.map(q => q.difficulty)).size).toBe(3);
    expect(SENTENCE_COMPLETION_QUESTIONS.every(q => q.authorship === "generated")).toBe(true);
    for (const q of SENTENCE_COMPLETION_QUESTIONS) {
      const position = blankPosition(q);
      expect(q.passageEn.slice(position.start, position.end)).toBe("____");
      expect(q.evidence.every(cue => q.passageEn.includes(cue))).toBe(true);
    }
  });
  it.each(["blank", "second-blank", "choice-id", "choice-text", "answer", "answer-reason", "missing-reason", "cue", "sense", "source", "original"])("rejects invalid registration: %s", fault => {
    const q = clone(first);
    if (fault === "blank") q.passageEn = q.passageEn.replace("____", "something");
    if (fault === "second-blank") q.passageEn += " ____";
    if (fault === "choice-id") q.choices[1].id = q.choices[0].id;
    if (fault === "choice-text") q.choices[1].text = ` ${q.choices[0].text.toUpperCase()} `;
    if (fault === "answer") q.correctChoiceId = "absent";
    if (fault === "answer-reason") q.correctChoiceId = q.choices[1].id;
    if (fault === "missing-reason") q.choices[1].explanationKo = "";
    if (fault === "cue") q.evidence = ["a cue absent from this passage"];
    if (fault === "sense") q.relatedSenseId = "unverified-sense";
    if (fault === "source") q.authorship = "past-exam";
    if (fault === "original") { q.authorship = "past-exam"; q.sourceUrl = "https://example.org/past-exam"; q.originalText = "unaltered source text"; }
    expect(() => validateSentenceCompletionCatalog({ schema: 1, questions: [q] })).toThrow();
  });
  it("rejects duplicate IDs, passages and competing active source anchors", () => {
    for (const field of ["id", "itemId", "passageEn"] as const) {
      const questions = clone(SENTENCE_COMPLETION_QUESTIONS);
      questions[1][field] = questions[0][field];
      expect(sentenceCompletionCatalogSchema.safeParse({ schema: 1, questions }).success).toBe(false);
    }
  });
  it("keeps the answer tied to its ID through repeated choice shuffles", () => {
    for (let i = 0; i < 8; i++) for (const source of SENTENCE_COMPLETION_QUESTIONS) {
      const item = VOCAB_BY_ID.get(source.itemId)!;
      const q = buildQuizQuestions({ mode: "sentence-completion", itemNums: [item.num], count: 1 })[0];
      expect(validateQuestion(q)).toBe(true);
      expect(q.id).toBe(source.id);
      expect(q.choices.filter(c => isChoiceCorrect(q, c)).map(c => c.id)).toEqual([`${source.id}:${source.correctChoiceId}`]);
      const forged = clone(q); forged.choices.forEach(c => { c.isCorrect = !c.isCorrect; });
      expect(validateQuestion(forged)).toBe(false);
    }
  });
  it("keeps logic targets separate from vocabulary mastery and exact review links", () => {
    const item = VOCAB_BY_ID.get(first.itemId)!;
    const key = sentenceCompletionKey(first);
    const options = { mode: "sentence-completion" as const, itemNums: [item.num], count: 1 };
    const q = buildQuizQuestions({ ...options, masteredTargetKeys: getItemLearningTargets(item).map(t => t.key), masteredNums: [item.num] })[0];
    expect(q).toBeTruthy(); expect(getQuestionLearningTargetKey(q)).toBe(key);
    expect(buildQuizQuestions({ ...options, masteredTargetKeys: [key] })).toEqual([]);
    expect(parseLearningReviewKeys(JSON.stringify([key]), [item])).toEqual([key]);
    expect(buildQuizQuestions({ ...options, learningTargetKeys: ["sentence:unknown"] })).toEqual([]);
    expect(buildQuizQuestions({ mode: "sentence-completion", itemNums: [1], count: 1 })).toEqual([]);
  });
  it("restores the actual shuffled choices and rejects stale/corrupt answer content", () => {
    const item = VOCAB_BY_ID.get(first.itemId)!;
    const q = buildQuizQuestions({ mode: "sentence-completion", itemNums: [item.num], count: 1 })[0];
    const state = { ...createEmptyQuestionViewState(), answered: true, selectedChoice: q.choices.findIndex(c => c.isCorrect) };
    const session = { schema: 1, requestKey: "sentence", sessionId: "restore-sc", questions: [q], states: [state], currentIndex: 0, completed: false };
    expect(parseQuizSession(clone(session))?.questions[0]).toEqual(q);
    const invalid = clone(session); invalid.questions[0].sentenceCompletion!.correctChoiceId = "b";
    expect(parseQuizSession(invalid)).toBeNull();
  });
});
