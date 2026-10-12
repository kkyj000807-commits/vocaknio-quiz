/** Structural completeness only. This list does not certify semantic quality. */
export const CANONICAL_REQUIRED_FIELDS = Object.freeze([
  "englishDefinition", "koreanMeaning", "contextExplanation",
  "exampleSentence", "exampleTranslation", "exampleExplanation",
  "synonyms", "distinctionNote", "sourceIds",
]);

const text = value => String(value ?? "").trim().replace(/\s+/g, " ");
const nullableText = value => text(value) || null;

export function canonicalFieldPresent(record, field) {
  return Array.isArray(record[field]) ? record[field].length > 0 : Boolean(text(record[field]));
}

export function canonicalMissingFields(record) {
  return CANONICAL_REQUIRED_FIELDS.filter(field => !canonicalFieldPresent(record, field));
}

/** Copy the selected source's claims, without inferring rights or a new review. */
export function makeExampleProvenance(entry, layer, example = {}, fields = {}) {
  const sourceFields = ["name", "publisher", "url", "license", "edition", "attribution", "role", "independenceGroup", "note"];
  return {
    layer,
    entryId: nullableText(entry.id),
    senseId: nullableText(entry.senseId),
    fields: { ...fields },
    kind: nullableText(example.kind ?? example.type),
    exampleLicense: nullableText(example.license),
    exampleSourceUrl: nullableText(example.sourceUrl ?? example.url),
    exampleAttribution: nullableText(example.attribution),
    modified: typeof example.modified === "boolean" ? example.modified : null,
    sources: (entry.sources ?? []).map(source => Object.fromEntries(sourceFields
      .filter(field => text(source[field]))
      .map(field => [field, text(source[field])]))),
    sourceReview: {
      status: nullableText(entry.verification?.status ?? entry.status),
      checkedAt: nullableText(entry.verification?.checkedAtKst ?? entry.sourceCheckedAt ?? entry.reviewedAt ?? entry.checkedAt),
      reviewer: nullableText(entry.verification?.reviewer ?? entry.reviewer),
      scope: "inherited-source-metadata-not-a-new-review",
    },
    rightsScope: "source-reference-licenses-do-not-automatically-license-this-example",
  };
}

const tupleKey = example => JSON.stringify([example.en, example.ko, example.cueKo]);
const complete = example => Boolean(example.en && example.ko && example.cueKo);

/**
 * First complete source wins. An incomplete source can be replaced only as a
 * whole tuple, never by borrowing another example's translation or context cue.
 * Different tuples remain inspectable; this function does not mutate inputs.
 */
export function selectCanonicalExample(record, example, provenance) {
  if (provenance.senseId !== record.senseId) throw new Error("Canonical example source sense mismatch");
  const current = {
    en: nullableText(record.exampleSentence),
    ko: nullableText(record.exampleTranslation),
    cueKo: nullableText(record.exampleExplanation),
    provenance: record.exampleProvenance ?? null,
  };
  const next = {
    en: nullableText(example.en), ko: nullableText(example.ko), cueKo: nullableText(example.cueKo), provenance,
  };
  const useNext = Boolean(next.en) && (!current.en || (!complete(current) && complete(next)));
  const selected = useNext ? next : current;
  const alternative = useNext ? current : next;
  const alternateExamples = [...(record.alternateExamples ?? [])];
  if ((alternative.en || alternative.ko || alternative.cueKo)
    && tupleKey(alternative) !== tupleKey(selected)
    && !alternateExamples.some(value => tupleKey(value) === tupleKey(alternative))) {
    alternateExamples.push(alternative);
  }
  return {
    exampleSentence: selected.en,
    exampleTranslation: selected.ko,
    exampleExplanation: selected.cueKo,
    exampleProvenance: selected.provenance,
    alternateExamples,
  };
}

export function canonicalAuditSample(record) {
  return {
    senseId: record.senseId,
    word: record.word,
    status: record.definitionStatus,
    checkedFields: Object.fromEntries(CANONICAL_REQUIRED_FIELDS.map(field => [field, canonicalFieldPresent(record, field)])),
    // Keep the legacy report key but check an actual source identifier instead
    // of treating an always-empty conflicts array as proof of meaning accuracy.
    sameSenseContract: Boolean(record.exampleProvenance?.senseId
      && record.exampleProvenance.senseId === record.senseId),
    sameSenseContractScope: "selected-example-source-sense-id-only",
    semanticReview: "NOT_VERIFIED_BY_THIS_AUDIT",
  };
}

export function summarizeLearningExport(entries, items) {
  return {
    learningDetailExportEntryCount: entries.length,
    learningDetailSenseCount: new Set(entries.map(entry => entry.senseId).filter(Boolean)).size,
    learningDetailRowCount: Object.keys(items).length,
  };
}
