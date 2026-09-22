import { ACTIVE_RECALL_SENSES, getActiveRecallCoverage } from "../lib/active-recall";
import { VOCAB } from "../lib/vocab";

const coverage = getActiveRecallCoverage();
const rowsWithLegacySynonyms = VOCAB.filter(item => item.s.length > 0).length;
const phraseRows = VOCAB.filter(item => item.type !== "word").length;
const enrichedPhraseRows = new Set(ACTIVE_RECALL_SENSES.filter(entry => /\s/.test(entry.headword)).flatMap(entry => entry.itemIds)).size;
const failures = Object.fromEntries(
  [...new Set(ACTIVE_RECALL_SENSES.map(entry => entry.enrichmentStatus))]
    .filter(status => status !== "complete")
    .map(status => [status, ACTIVE_RECALL_SENSES.filter(entry => entry.enrichmentStatus === status).length]),
);

console.log(JSON.stringify({
  totalVocabularyRows: VOCAB.length,
  productionSenseCount: coverage.senses,
  englishDefinitionRows: coverage.rows,
  conciseDefinitionRows: coverage.rows,
  exampleRows: coverage.examples === coverage.senses ? coverage.rows : 0,
  senseSafeSynonymOrVariantRows: coverage.synonymRelations === coverage.senses ? coverage.rows : 0,
  legacyHeadwordSynonymRows: rowsWithLegacySynonyms,
  phraseRows,
  enrichedPhraseRows,
  englishToEnglishQuestionRows: coverage.rows,
  failures,
}, null, 2));
