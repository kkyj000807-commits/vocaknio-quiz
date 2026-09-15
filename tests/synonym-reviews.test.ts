import { expect, it } from "vitest";
import catalog from "../data/synonym-reviews.json";
import { VOCAB } from "@/lib/vocab";
import { auditLegacySynonyms } from "../scripts/lib/legacy-synonym-audit";
import { attachSynonymReviews, synonymReviewCatalogSchema, synonymReviewSchema } from "../scripts/lib/synonym-reviews";

it("binds the cross-check to exactly two inspected rows without publishing it", () => {
  const reviews = synonymReviewCatalogSchema.parse(catalog).entries;
  const report = auditLegacySynonyms(VOCAB);
  expect(attachSynonymReviews(report, reviews)).toMatchObject({ crossCheckedRelations: 2, staleRelations: 0, productionRelations: 0 });
  const changed = structuredClone(report);
  changed.candidates.find(c => c.itemId === reviews[0].sourceRows[0].id && c.synonym === "cul-de-sac")!.renderedMeaning = "changed";
  expect(attachSynonymReviews(changed, reviews)).toMatchObject({ crossCheckedRelations: 1, staleRelations: 1, productionRelations: 0 });
  const regrouped = structuredClone(report);
  regrouped.candidates.find(c => c.itemId === reviews[0].sourceRows[0].id && c.synonym === "cul-de-sac")!.conceptId = "changed-group";
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
