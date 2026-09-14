import { VOCAB } from "../lib/vocab";
import { SENSE_QUESTIONS } from "../lib/sense-questions";
import { auditLegacySynonyms } from "./lib/legacy-synonym-audit";

const args = process.argv.slice(2);
if (args.length > 1) throw Error("Usage: node --import tsx scripts/audit-legacy-synonyms.ts [headword|--all]");
const report = auditLegacySynonyms(VOCAB, new Set(SENSE_QUESTIONS.flatMap(q => q.itemIds)));
const selected = args[0] && args[0] !== "--all"
  ? report.candidates.filter(c => c.headword.toLowerCase() === args[0].toLowerCase())
  : report.candidates;
const shown = args[0] === "--all" ? selected : selected.slice(0, 12);
console.log(JSON.stringify({ ...report, candidates: shown,
  matchingCandidates: selected.length, omittedCandidates: selected.length - shown.length }, null, 2));
