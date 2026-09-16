import { z } from "zod";
import { createLegacySynonymLookup, type SynonymAuditRow } from "./legacy-synonym-audit";

const text = z.string().trim().min(1);
export const synonymReviewSchema = z.object({
  id: text, status: z.enum(["candidate", "cross-checked", "reviewed"]), headword: text,
  sourceRows: z.array(z.object({ id: text, meaning: text })).min(1),
  synonym: text, expectedConceptId: text, expectedTargetRowIds: z.array(text).min(1),
  expectedRenderedMeaning: text, senseId: text, targetSenseId: text,
  partOfSpeech: text, definitionKo: text, bridgeKo: text,
  bridgeKind: z.literal("conceptual-not-etymology"), constraintKo: text,
  excludedSenseIds: z.array(text).min(1),
  examples: z.array(z.object({ en: text, ko: text, evidence: text, noteKo: text })).min(1),
  sources: z.array(z.object({ publisher: text, url: z.url(), note: text })),
  checkedAt: z.iso.date(), reviewer: text, remaining: text,
}).superRefine((review, ctx) => {
  if (new Set(review.sourceRows.map(r => r.id)).size !== review.sourceRows.length)
    ctx.addIssue({ code: "custom", message: "Duplicate source mapping" });
  if (new Set(review.expectedTargetRowIds).size !== review.expectedTargetRowIds.length)
    ctx.addIssue({ code: "custom", message: "Duplicate target mapping" });
  if (review.status !== "candidate" && new Set(review.sources.map(s => s.publisher)).size < 2)
    ctx.addIssue({ code: "custom", message: "Two independent publishers required" });
  if (review.examples.some(e => !e.en.includes(e.evidence)))
    ctx.addIssue({ code: "custom", message: "Example evidence missing" });
  if (review.excludedSenseIds.includes(review.targetSenseId))
    ctx.addIssue({ code: "custom", message: "Included and excluded target sense conflict" });
});

export const synonymReviewCatalogSchema = z.object({ schema: z.literal(1), entries: z.array(synonymReviewSchema) })
  .superRefine((catalog, ctx) => {
    const keys = catalog.entries.flatMap(r => r.sourceRows.map(row => `${row.id}:${r.synonym.toLowerCase()}`));
    if (new Set(keys).size !== keys.length || new Set(catalog.entries.map(r => r.id)).size !== catalog.entries.length)
      ctx.addIssue({ code: "custom", message: "Conflicting review mapping" });
  });

// Editorial status is valid only for the exact data inspected. This is NOT a
// runtime whitelist: no question or learner record imports this module.
export function attachSynonymReviews(
  rows: readonly SynonymAuditRow[],
  reviews: z.infer<typeof synonymReviewSchema>[],
) {
  const lookup = createLegacySynonymLookup(rows);
  const bindings = reviews.flatMap(review => review.sourceRows.map(row => {
    const candidate = lookup(row.id, review.synonym);
    const current = candidate?.headword === review.headword && candidate.meaning === row.meaning &&
      candidate.conceptId === review.expectedConceptId &&
      candidate.targetRows.every(r => r.conceptId === review.expectedConceptId) &&
      JSON.stringify(candidate.targetRows.map(r => r.id).sort()) === JSON.stringify([...review.expectedTargetRowIds].sort()) &&
      candidate.renderedMeaning === review.expectedRenderedMeaning;
    return { reviewId: review.id, itemId: row.id, synonym: review.synonym,
      status: current ? review.status : "candidate", stale: !current,
      reason: current ? "Matches reviewed lookup snapshot; runtime approval is evaluated separately" : "Lookup changed or disappeared; recheck before reuse" };
  }));
  return { bindings, crossCheckedRelations: bindings.filter(b => !b.stale && b.status === "cross-checked").length,
    staleRelations: bindings.filter(b => b.stale).length, productionRelations: 0 };
}
