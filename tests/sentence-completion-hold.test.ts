import { expect, it, vi } from "vitest";
import catalog from "@/data/sentence-completion.json";
import { SENTENCE_COMPLETION_QUESTIONS, getSentenceCompletion, getSentenceCompletionByKey, isCurrentSentenceCompletion,
  isSentenceCompletionEligible, sentenceCompletionMetadata, sentenceCompletionSchema } from "@/lib/sentence-completion";
import { VOCAB_BY_ID } from "@/lib/vocab";
vi.mock("@/lib/vocab", async () => {
  const { default: data } = await import("@/data/sentence-completion.json");
  return { VOCAB_BY_ID: new Map(data.questions.map((q, i) => [q.itemId, { id: q.itemId, num: i + 1, w: q.itemId, group: "V101" }])) };
});
vi.mock("@/lib/active-recall", async () => {
  const { default: data } = await import("@/data/sentence-completion.json");
  return { ACTIVE_RECALL_SENSES: data.questions.map(q => ({ senseId: q.relatedSenseId, status: "production" })), activeRecallMatchesItem: () => true };
});

it("retains all source records while exposing only 11 eligible questions", () => {
  expect(SENTENCE_COMPLETION_QUESTIONS).toHaveLength(12);
  expect(SENTENCE_COMPLETION_QUESTIONS.filter(isSentenceCompletionEligible)).toHaveLength(11);
  const held = SENTENCE_COMPLETION_QUESTIONS.find(q => q.reviewHold)!;
  expect(held.id).toBe("sc-condition-grant-v1");
  expect(getSentenceCompletion(held.itemId)).toBeUndefined();
  expect(getSentenceCompletionByKey(`sentence:${held.id}`)).toBeUndefined();
  expect(sentenceCompletionMetadata().some(q => q.learningKey === `sentence:${held.id}`)).toBe(true);
});
it("rejects an old session snapshot even if it predates the hold field", () => {
  const held = SENTENCE_COMPLETION_QUESTIONS.find(q => q.reviewHold)!;
  const old = { ...held }; delete old.reviewHold;
  expect(isCurrentSentenceCompletion(old, VOCAB_BY_ID.get(held.itemId)!)).toBe(false);
  const active = SENTENCE_COMPLETION_QUESTIONS.find(isSentenceCompletionEligible)!;
  expect(isCurrentSentenceCompletion(active, VOCAB_BY_ID.get(active.itemId)!)).toBe(true);
});
it("requires a traceable review hold instead of an empty unexplained block", () => {
  const held = catalog.questions.find(q => q.id === "sc-condition-grant-v1")!;
  expect(sentenceCompletionSchema.safeParse({ ...held, reviewHold: { reason: "", reviewedAt: "today" } }).success).toBe(false);
});
