import { VOCAB } from "../lib/vocab";
import { SENSE_QUESTIONS } from "../lib/sense-questions";
import { auditLegacySynonyms } from "./lib/legacy-synonym-audit";
import reviewData from "../data/synonym-reviews.json";
import { attachSynonymReviews, synonymReviewCatalogSchema } from "./lib/synonym-reviews";

const args = process.argv.slice(2);
if (args.length > 1) throw Error("Usage: node --import tsx scripts/audit-legacy-synonyms.ts [headword|--all]");
const report = auditLegacySynonyms(VOCAB, new Set(SENSE_QUESTIONS.flatMap(q => q.itemIds)));
// Source bindings must remain inspectable after a question leaves the legacy queue.
const reviewState = attachSynonymReviews(auditLegacySynonyms(VOCAB), synonymReviewCatalogSchema.parse(reviewData).entries);
const selected = args[0] && args[0] !== "--all"
  ? report.candidates.filter(c => c.headword.toLowerCase() === args[0].toLowerCase())
  : report.candidates;
const shown = args[0] === "--all" ? selected : selected.slice(0, 12);
console.log(JSON.stringify({ ...report, reviewState, candidates: shown,
  matchingCandidates: selected.length, omittedCandidates: selected.length - shown.length }, null, 2));
