import type { VocabItem } from "../../lib/vocab";

type Row = Pick<VocabItem, "id" | "num" | "w" | "k" | "s" | "conceptId" | "type">;
type Reason = "missing-target" | "headword-fallback" | "multiple-target-meanings";

/** Structural review candidates, never semantic judgments or production data. */
export function auditLegacySynonyms(rows: readonly Row[], contextualItemIds: ReadonlySet<string> = new Set()) {
  const byWord = new Map<string, Row[]>();
  const normalize = (word: string) => word.trim().toLowerCase();
  for (const row of rows) {
    const key = normalize(row.w);
    const matches = byWord.get(key) ?? [];
    matches.push(row);
    byWord.set(key, matches);
  }
  const candidates: {
    id: string; status: "candidate"; itemId: string; num: number;
    headword: string; meaning: string; type: Row["type"]; conceptId: string;
    synonym: string; lookup: "concept" | "headword"; reasons: Reason[];
    targetRows: { id: string; num: number; meaning: string; conceptId: string }[];
    renderedMeaning: string;
  }[] = [];
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
      const matches = byWord.get(synonym) ?? [];
      const conceptMatches = item.conceptId
        ? matches.filter(row => row.conceptId === item.conceptId) : [];
      const targets = conceptMatches.length ? conceptMatches : matches;
      const meanings = [...new Set(targets.map(row => row.k).filter(Boolean))];
      const flags: Reason[] = [];
      if (!meanings.length) flags.push("missing-target");
      if (!conceptMatches.length) flags.push("headword-fallback");
      if (meanings.length > 1) flags.push("multiple-target-meanings");
      if (!flags.length) continue;
      for (const flag of flags) reasons[flag]++;
      candidates.push({ id: `${item.id}:${synonym}`, status: "candidate",
        itemId: item.id, num: item.num, headword: item.w, meaning: item.k,
        type: item.type, conceptId: item.conceptId, synonym,
        lookup: conceptMatches.length ? "concept" : "headword", reasons: flags,
        targetRows: targets.map(row => ({ id: row.id, num: row.num, meaning: row.k, conceptId: row.conceptId })),
        renderedMeaning: meanings.join(" / "),
      });
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
