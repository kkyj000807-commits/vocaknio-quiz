import { describe, expect, it } from "vitest";
import { VOCAB, getSynonymDetails } from "@/lib/vocab";
import { SENSE_QUESTIONS } from "@/lib/sense-questions";
import { auditLegacySynonyms } from "../scripts/lib/legacy-synonym-audit";

const row = (num: number, w: string, k: string, conceptId: string, s: string[] = []) =>
  ({ num, id: `row-${num}`, w, k, conceptId, s, type: "word" as const });

describe("legacy synonym review queue, not a semantic certificate", () => {
  it("traces concept matches before global matches and deduplicates repeated meanings", () => {
    const rows = [row(1, "source", "원뜻", "a", ["target"]),
      row(2, "target", "같은 뜻", "a"), row(3, "target", "같은 뜻", "a"),
      row(4, "target", "다른 뜻", "b")];
    expect(auditLegacySynonyms(rows).summary.candidateRelations).toBe(0);
    rows[2].k = "추가 뜻";
    const [risk] = auditLegacySynonyms(rows).candidates;
    expect(risk.reasons).toEqual(["multiple-target-meanings"]);
    expect(risk.targetRows.map(r => r.num)).toEqual([2, 3]);
    expect(risk.renderedMeaning).toBe("같은 뜻 / 추가 뜻");
  });

  it("flags missing targets and global fallback without asserting wrong meanings", () => {
    const rows = [row(1, "source", "원뜻", "a", ["target", "missing"]), row(2, "target", "뜻", "b")];
    const audit = auditLegacySynonyms(rows);
    expect(audit.summary.reasons).toEqual({ "missing-target": 1, "headword-fallback": 2, "multiple-target-meanings": 0 });
    expect(audit.candidates.every(c => c.status === "candidate")).toBe(true);
    expect(audit.candidates.find(c => c.synonym === "missing")?.targetRows).toEqual([]);
    expect(auditLegacySynonyms(rows, new Set(["row-1"])).summary).toMatchObject({ contextualRelations: 2, legacyRelations: 0, candidateRelations: 0 });
  });

  it("reproduces the actual production lookup for every flagged corpus relation without mutating data", () => {
    const before = JSON.stringify(VOCAB);
    const reviewed = new Set(SENSE_QUESTIONS.flatMap(q => q.itemIds));
    const audit = auditLegacySynonyms(VOCAB, reviewed);
    const byId = new Map(VOCAB.map(r => [r.id, r]));
    expect(audit.summary.candidateRelations).toBeGreaterThan(0);
    for (const c of audit.candidates) {
      expect(reviewed.has(c.itemId)).toBe(false);
      const actual = getSynonymDetails(byId.get(c.itemId)!).find(d => d.word.trim().toLowerCase() === c.synonym);
      expect(actual?.meaning ?? "").toBe(c.renderedMeaning);
    }
    expect(JSON.stringify(VOCAB)).toBe(before);
    expect(new Set(audit.candidates.map(c => c.id)).size).toBe(audit.candidates.length);
  });
});
