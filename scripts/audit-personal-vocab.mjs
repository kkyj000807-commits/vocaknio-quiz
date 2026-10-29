import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import assert from "node:assert/strict";
import { convertPersonalVocabulary } from "./import-personal-vocab.mjs";
import { personalVocabPath } from "./lib/personal-vocab.cjs";

const file = personalVocabPath(process.cwd(), { FINETUNE_PERSONAL_VOCAB: "1", FINETUNE_DEPLOY_TARGET: "private" });
const current = JSON.parse(fs.readFileSync(file, "utf8"));
const snapshot = path.join(path.dirname(file), current.sourceSha256, "source.json");
const bytes = fs.readFileSync(snapshot);
assert.equal(crypto.createHash("sha256").update(bytes).digest("hex"), current.sourceSha256);
const baseline = JSON.parse(fs.readFileSync("assets/vocab-v1.4.json", "utf8"));
const { baselineSha256, ...actual } = current;
assert.match(baselineSha256, /^[a-f0-9]{64}$/);
assert.deepEqual(actual, convertPersonalVocabulary(JSON.parse(bytes), current.sourceSha256, baseline, { previous: current }));
const known = new Set(baseline.map(item => item.w.trim().toLowerCase().replace(/[‘’]/g, "'").replace(/\s+/g, " ")));
const added = current.entries.filter(entry => !known.has(entry.key));
console.log(JSON.stringify({ status: "PASS_PRIVATE_IMPORT_CONTRACT_NOT_SEMANTIC_CERTIFICATION", sourceSha256: current.sourceSha256,
  datasetEntries: current.entries.length, addedHeadwords: added.length, retainedBaseRows: baseline.length,
  retiredReferenceEntries: (current.retiredEntries ?? []).length,
  lookupIdentityCount: current.entries.length + (current.retiredEntries ?? []).length,
  studyRows: baseline.length + added.length, studyHeadwords: known.size + added.length,
  vocabibleSourceRecords: current.entries.reduce((sum, entry) => sum + entry.sources.length, 0), quizPromotion: 0,
  publicRedistribution: "NOT_AUTHORIZED" }, null, 2));
