import type { VocabItem } from "../../lib/vocab";

export type SynonymAuditRow = Pick<VocabItem, "id" | "num" | "w" | "k" | "s" | "conceptId" | "type">;
type Reason = "missing-target" | "headword-fallback" | "multiple-target-meanings";
const normalize = (word: string) => word.trim().toLowerCase();

/** Trace any explicitly requested relation; structural flags are not a review whitelist. */
export function createLegacySynonymLookup(rows: readonly SynonymAuditRow[]) {
  const byId = new Map(rows.map(row => [row.id, row]));
  const byWord = new Map<string, SynonymAuditRow[]>();
  for (const row of rows) {
    const key = normalize(row.w);
    const matches = byWord.get(key) ?? [];
    matches.push(row);
    byWord.set(key, matches);
  }
  return (itemId: string, word: string) => {
    const item = byId.get(itemId);
    const synonym = normalize(word);
    if (!item || !item.s.some(s => normalize(s) === synonym)) return undefined;
    const matches = byWord.get(synonym) ?? [];
    const conceptMatches = item.conceptId
      ? matches.filter(row => row.conceptId === item.conceptId) : [];
    const targets = conceptMatches.length ? conceptMatches : matches;
    const meanings = [...new Set(targets.map(row => row.k).filter(Boolean))];
    const reasons: Reason[] = [];
    if (!meanings.length) reasons.push("missing-target");
    if (!conceptMatches.length) reasons.push("headword-fallback");
    if (meanings.length > 1) reasons.push("multiple-target-meanings");
    return { id: `${item.id}:${synonym}`, status: "candidate" as const,
      itemId: item.id, num: item.num, headword: item.w, meaning: item.k,
      type: item.type, conceptId: item.conceptId, synonym,
      lookup: conceptMatches.length ? "concept" as const : "headword" as const, reasons,
      targetRows: targets.map(row => ({ id: row.id, num: row.num, meaning: row.k, conceptId: row.conceptId })),
      renderedMeaning: meanings.join(" / "),
    };
  };
}

/** Structural review candidates, never semantic judgments or production data. */
export function auditLegacySynonyms(rows: readonly SynonymAuditRow[], contextualItemIds: ReadonlySet<string> = new Set()) {
  const lookup = createLegacySynonymLookup(rows);
  const candidates: NonNullable<ReturnType<typeof lookup>>[] = [];
  let legacyRelations = 0;
  let contextualRelations = 0;
  const reasons: Record<Reason, number> = {
    "missing-target": 0, "headword-fallback": 0, "multiple-target-meanings": 0,
  };
  for (const item of rows) {
    for (const synonym of new Set(item.s.map(normalize))) {
      // Both published and withheld contextual mappings bypass legacy generation.
      if (contextualItemIds.has(item.id)) { contextualRelations++; continue; }
      legacyRelations++;
      const relation = lookup(item.id, synonym)!;
      if (!relation.reasons.length) continue;
      for (const flag of relation.reasons) reasons[flag]++;
      candidates.push(relation);
    }
  }
  candidates.sort((a, b) => Number(a.type === "word") - Number(b.type === "word") ||
    b.reasons.length - a.reasons.length || a.num - b.num || a.synonym.localeCompare(b.synonym, "en"));
  return {
    schema: 1,
    status: "review-queue",
    scope: "legacy multiple-choice synonym lookup; excludes published or withheld contextual item IDs",
    summary: { rows: rows.length, legacyRelations, contextualRelations,
      candidateRelations: candidates.length, candidateRows: new Set(candidates.map(c => c.itemId)).size,
      candidateExpressions: new Set(candidates.map(c => normalize(c.headword))).size,
      idiomOrPhraseRows: new Set(candidates.filter(c => c.type !== "word").map(c => c.itemId)).size, reasons },
    limitations: "Structural risk only. Different translations may express the same sense; one translation may hide multiple senses. No POS/source sufficiency, synonym truth, or distractor plausibility certification. Unflagged does not mean verified. Nothing is auto-promoted or removed from production.",
    candidates,
  };
}
