import fs from "node:fs";
import crypto from "node:crypto";
import { describe, expect, it } from "vitest";

import {
  CANONICAL_REQUIRED_FIELDS,
  canonicalAuditSample,
  canonicalMissingFields,
  makeExampleProvenance,
  selectCanonicalExample,
  summarizeLearningExport,
} from "../scripts/lib/canonical-content-contract.mjs";

const empty = () => ({ senseId: "fixture:sense", exampleSentence: null, exampleTranslation: null,
  exampleExplanation: null, exampleProvenance: null, alternateExamples: [] });
const provenance = id => ({ layer: "fixture", entryId: id, senseId: "fixture:sense" });
const merge = (record, example, id) => ({ ...record, ...selectCanonicalExample(record, example, provenance(id)) });

describe("canonical backfill source tuple contract", () => {
  it("includes the Korean example translation in structural completeness", () => {
    const fields = Object.fromEntries(CANONICAL_REQUIRED_FIELDS.map(field => [field, "present"]));
    expect(canonicalMissingFields(fields)).toEqual([]);
    expect(canonicalMissingFields({ ...fields, exampleTranslation: "  " })).toEqual(["exampleTranslation"]);
  });

  it("never borrows a translation and cue from a different partial example", () => {
    const first = merge(empty(), { en: "Example A.", cueKo: "A 단서" }, "a");
    const next = merge(first, { en: "Example B.", ko: "B 번역" }, "b");
    expect(next).toMatchObject({ exampleSentence: "Example A.", exampleTranslation: null, exampleExplanation: "A 단서" });
    expect(next.alternateExamples).toHaveLength(1);
    expect(next.alternateExamples[0]).toMatchObject({ en: "Example B.", ko: "B 번역", cueKo: null });
    expect(canonicalMissingFields(next)).toContain("exampleTranslation");
  });

  it("does not attach orphaned Korean fields without their English sentence", () => {
    const record = merge(empty(), { en: "Example A." }, "a");
    const next = merge(record, { ko: "다른 예문 번역", cueKo: "다른 단서" }, "b");
    expect(next.exampleTranslation).toBeNull();
    expect(next.exampleExplanation).toBeNull();
    expect(next.exampleProvenance.entryId).toBe("a");
  });

  it("replaces an incomplete tuple only as a whole and keeps the earlier source inspectable", () => {
    const record = merge(empty(), { en: "Partial A." }, "a");
    const next = merge(record, { en: "Complete B.", ko: "B 번역", cueKo: "B 단서" }, "b");
    expect(next).toMatchObject({ exampleSentence: "Complete B.", exampleTranslation: "B 번역", exampleExplanation: "B 단서" });
    expect(next.exampleProvenance.entryId).toBe("b");
    expect(next.alternateExamples[0]).toMatchObject({ en: "Partial A.", ko: null, provenance: { entryId: "a" } });
  });

  it("preserves an already complete example without overwriting it with another source", () => {
    const record = merge(empty(), { en: "Original.", ko: "원래 번역", cueKo: "원래 단서" }, "a");
    const next = merge(record, { en: "Alternative.", ko: "별도 번역", cueKo: "별도 단서" }, "b");
    expect(next.exampleSentence).toBe("Original.");
    expect(next.exampleTranslation).toBe("원래 번역");
    expect(next.exampleExplanation).toBe("원래 단서");
    expect(next.exampleProvenance.entryId).toBe("a");
    expect(next.alternateExamples).toHaveLength(1);
  });

  it("is repeatable without mutating its inputs or duplicating alternatives", () => {
    const record = merge(empty(), { en: "Original.", ko: "원래 번역", cueKo: "원래 단서" }, "a");
    const before = JSON.stringify(record);
    const example = { en: "Alternative.", ko: "별도 번역", cueKo: "별도 단서" };
    const next = merge(record, example, "b");
    expect(JSON.stringify(record)).toBe(before);
    expect(merge(next, example, "b")).toEqual(next);
    expect(merge(record, { en: " Original. ", ko: "원래 번역", cueKo: "원래 단서" }, "b").alternateExamples).toEqual([]);
  });

  it("rejects a different sense rather than moving its example into this record", () => {
    expect(() => selectCanonicalExample(empty(), { en: "Other sense." }, { ...provenance("a"), senseId: "other:sense" }))
      .toThrow("source sense mismatch");
  });

  it("inherits review and rights metadata without inventing example reuse permission or a new reviewer", () => {
    const entry = { id: "fixture-entry", senseId: "fixture:sense", status: "reviewed", sourceCheckedAt: "2026-10-01",
      sources: [{ publisher: "Fixture dictionary", url: "https://example.test/word", license: "CC BY 4.0", role: "reference" }] };
    const source = makeExampleProvenance(entry, "active-recall", { type: "editorial" }, { en: "exampleSentences[0].en" });
    expect(source.kind).toBe("editorial");
    expect(source.sourceReview).toEqual({ status: "reviewed", checkedAt: "2026-10-01", reviewer: null, scope: "inherited-source-metadata-not-a-new-review" });
    expect(source.sources[0].license).toBe("CC BY 4.0");
    expect(source.exampleLicense).toBeNull();
    expect(source.modified).toBeNull();
    expect(source.rightsScope).toContain("do-not-automatically-license");
    const missing = makeExampleProvenance({ id: "unknown", senseId: "fixture:sense" }, "fixture");
    expect(missing.sourceReview.status).toBeNull();
    expect(missing.sourceReview.checkedAt).toBeNull();
    expect(missing.kind).toBeNull();
  });

  it("does not turn an empty conflict list or COMPLETE fields into semantic verification", () => {
    const record = { ...empty(), conflicts: [], definitionStatus: "COMPLETE" };
    expect(canonicalAuditSample(record)).toMatchObject({ sameSenseContract: false, semanticReview: "NOT_VERIFIED_BY_THIS_AUDIT" });
    const sample = canonicalAuditSample({ ...record, exampleProvenance: provenance("a") });
    expect(sample.sameSenseContract).toBe(true);
    expect(sample.sameSenseContractScope).toBe("selected-example-source-sense-id-only");
    expect(sample.semanticReview).toBe("NOT_VERIFIED_BY_THIS_AUDIT");
  });

  it("separates repeated section exports from unique senses and occurrence pointers", () => {
    expect(summarizeLearningExport([{ senseId: "same" }, { senseId: "same" }, { senseId: "other" }], { row1: {}, row2: {}, row3: {}, row4: {} }))
      .toEqual({ learningDetailExportEntryCount: 3, learningDetailSenseCount: 2, learningDetailRowCount: 4 });
  });
});

it("preserves the 110-record content/ID/meaning/source/status baseline while enriching audit metadata", () => {
  // Keep the original hash: the explicitly approved additive batch must not
  // rewrite any of the 110 pre-existing records or weaken their baseline.
  const allEntries = JSON.parse(fs.readFileSync("assets/canonical-sense-content.json", "utf8")).entries;
  const batch = JSON.parse(fs.readFileSync("data/vocab-learning/reviewed-batch-20261014.json", "utf8"));
  const newIds = new Set(batch.map(entry => entry.senseId));
  expect(newIds.size).toBe(15);
  expect(allEntries.filter(entry => newIds.has(entry.senseId))).toHaveLength(15);
  const entries = allEntries.filter(entry => !newIds.has(entry.senseId));
  const fields = ["senseId", "word", "partOfSpeech", "englishDefinition", "koreanMeaning", "contextExplanation",
    "exampleSentence", "exampleTranslation", "exampleExplanation", "synonyms", "distinctionNote", "sourceIds", "itemIds", "definitionStatus"];
  const snapshot = entries.map(entry => Object.fromEntries(fields.map(field => [field, entry[field]])))
    .sort((left, right) => left.senseId.localeCompare(right.senseId));
  expect(entries).toHaveLength(110);
  expect(crypto.createHash("sha256").update(JSON.stringify(snapshot)).digest("hex"))
    .toBe("3125f6294ec2577d65b03315ca0efe906d62a95e2649423b131b5f809fff4e17");
});
