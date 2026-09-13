import assert from "node:assert/strict";
import { SENSE_QUESTIONS, getSenseQuestionCoverage } from "../lib/sense-questions";
import { VOCAB } from "../lib/vocab";

assert.equal(new Set(SENSE_QUESTIONS.map(q => q.id)).size, SENSE_QUESTIONS.length, "duplicate question ID");
for (const q of SENSE_QUESTIONS) {
  for (const id of q.itemIds) {
    const row = VOCAB.find(item => item.id === id);
    assert.equal(row?.w, q.headword, `${q.id}: invalid word/sense mapping ${id}`);
  }
}
console.log(JSON.stringify({ status: "pass", ...getSenseQuestionCoverage(),
  limitations: "Schema and mappings only; semantic plausibility requires editorial review. Legacy vocabulary questions are not A-certified." }, null, 2));
