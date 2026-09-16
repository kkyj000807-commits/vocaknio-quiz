import assert from "node:assert/strict";
import { SENSE_QUESTIONS, getSenseQuestionCoverage, senseMatchesItem } from "../lib/sense-questions";
import { VOCAB } from "../lib/vocab";
import reviews from "../data/synonym-reviews.json";
import { attachSynonymReviews, synonymReviewCatalogSchema } from "./lib/synonym-reviews";

const reviewed = synonymReviewCatalogSchema.parse(reviews).entries;
const bindings = attachSynonymReviews(VOCAB, reviewed).bindings;

assert.equal(new Set(SENSE_QUESTIONS.map(q => q.id)).size, SENSE_QUESTIONS.length, "duplicate question ID");
for (const q of SENSE_QUESTIONS) {
  for (const id of q.itemIds) {
    const row = VOCAB.find(item => item.id === id);
    assert.equal(row?.w, q.headword, `${q.id}: invalid word/sense mapping ${id}`);
    assert.ok(row && senseMatchesItem(q, row), `${q.id}: source sense changed ${id}`);
  }
  if (q.relation) {
    const r = q.relation;
    const source = reviewed.find(review => review.id === r.reviewId);
    assert.ok(source && source.status !== "candidate", `${q.id}: relation not cross-checked`);
    assert.equal(q.senseId, source.senseId);
    assert.equal(r.targetSenseId, source.targetSenseId);
    assert.equal(r.targetWord, source.synonym);
    assert.deepEqual(r.excludedTargetSenseIds, source.excludedSenseIds);
    for (const id of q.itemIds) assert.ok(bindings.some(b => b.reviewId === r.reviewId && b.itemId === id && !b.stale), `${q.id}: stale relation ${id}`);
  }
}
console.log(JSON.stringify({ status: "pass", ...getSenseQuestionCoverage(),
  limitations: "Schema and mappings only; semantic plausibility requires editorial review. Legacy vocabulary questions are not A-certified." }, null, 2));
