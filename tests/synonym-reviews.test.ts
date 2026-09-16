import { expect, it } from "vitest";
import catalog from "../data/synonym-reviews.json";
import { VOCAB } from "@/lib/vocab";
import { auditLegacySynonyms } from "../scripts/lib/legacy-synonym-audit";
import { attachSynonymReviews, synonymReviewCatalogSchema, synonymReviewSchema } from "../scripts/lib/synonym-reviews";

it("binds the cross-check to exactly two inspected rows without publishing it", () => {
  const reviews = synonymReviewCatalogSchema.parse(catalog).entries.filter(r => r.headword === "blind alley");
  expect(attachSynonymReviews(VOCAB, reviews)).toMatchObject({ crossCheckedRelations: 2, staleRelations: 0, productionRelations: 0 });
  const changed = structuredClone(VOCAB);
  changed.find(c => c.id === reviews[0].sourceRows[0].id)!.k = "changed";
  expect(attachSynonymReviews(changed, reviews)).toMatchObject({ crossCheckedRelations: 1, staleRelations: 1, productionRelations: 0 });
  const regrouped = structuredClone(VOCAB);
  regrouped.find(c => c.id === reviews[0].sourceRows[0].id)!.conceptId = "changed-group";
  expect(attachSynonymReviews(regrouped, reviews).staleRelations).toBe(1);
});

it("rejects fake publication, insufficient sources, lost evidence and conflicting mappings", () => {
  const r = catalog.entries[0];
  expect(synonymReviewSchema.safeParse({ ...r, status: "production" }).success).toBe(false);
  expect(synonymReviewSchema.safeParse({ ...r, sources: [r.sources[0], r.sources[0]] }).success).toBe(false);
  expect(synonymReviewSchema.safeParse({ ...r, examples: [{ ...r.examples[0], evidence: "not in example" }] }).success).toBe(false);
  expect(synonymReviewSchema.safeParse({ ...r, excludedSenseIds: [r.targetSenseId] }).success).toBe(false);
  expect(synonymReviewCatalogSchema.safeParse({ ...catalog, entries: [r, { ...r, id: "duplicate-mapping" }] }).success).toBe(false);
});

it("can inspect a requested sense relation even when one translation string hides multiple senses", () => {
  const source = VOCAB.find(r => r.id === "JBKROW000003")!;
  const review = synonymReviewSchema.parse({ ...catalog.entries[0],
    id: "capricious-review-fixture", headword: source.w,
    sourceRows: [{ id: source.id, meaning: source.k }], synonym: "mercurial",
    expectedConceptId: source.conceptId,
    expectedTargetRowIds: ["JBKROW026195", "JBKROW032448"],
    expectedRenderedMeaning: "변덕스러운; 활발한",
  });
  const report = auditLegacySynonyms(VOCAB);
  expect(report.candidates.some(c => c.itemId === source.id && c.synonym === "mercurial")).toBe(false);
  expect(attachSynonymReviews(VOCAB, [review])).toMatchObject({ crossCheckedRelations: 1, staleRelations: 0, productionRelations: 0 });
  const withoutRelation = VOCAB.map(r => r.id === source.id ? { ...r, s: r.s.filter(s => s !== "mercurial") } : r);
  expect(attachSynonymReviews(withoutRelation, [review]).staleRelations).toBe(1);
  const withoutSource = VOCAB.filter(r => r.id !== source.id);
  expect(attachSynonymReviews(withoutSource, [review]).staleRelations).toBe(1);
  const changedTarget = VOCAB.map(r => r.id === "JBKROW026195" ? { ...r, k: "수은의" } : r);
  expect(attachSynonymReviews(changedTarget, [review]).staleRelations).toBe(1);
  const withoutTarget = VOCAB.filter(r => r.id !== "JBKROW026195");
  expect(attachSynonymReviews(withoutTarget, [review]).staleRelations).toBe(1);
});

it("binds the full editorial catalog without treating cross-checks as production coverage", () => {
  const before = JSON.stringify(VOCAB);
  const reviews = synonymReviewCatalogSchema.parse(catalog).entries;
  expect(reviews).toHaveLength(2);
  const result = attachSynonymReviews(VOCAB, reviews);
  expect(result).toMatchObject({ crossCheckedRelations: 6, staleRelations: 0, productionRelations: 0 });
  expect(result.bindings).toHaveLength(6);
  expect(JSON.stringify(VOCAB)).toBe(before);
});
