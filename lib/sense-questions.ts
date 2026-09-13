import { z } from "zod";
import catalog from "../data/sense-questions.json";

const nonempty = z.string().trim().min(1);
export const senseQuestionSchema = z.object({
  id: nonempty, headword: nonempty, itemIds: z.array(nonempty).min(1),
  senseId: nonempty, conceptId: nonempty, partOfSpeech: nonempty,
  status: z.enum(["candidate", "cross-checked", "reviewed", "production"]),
  quality: z.enum(["A", "B", "C"]),
  definitionKo: nonempty, bridgeKo: nonempty,
  contextEn: nonempty, contextKo: nonempty, evidence: nonempty, correctId: nonempty,
  choices: z.array(z.object({
    id: nonempty, en: nonempty, ko: nonempty, reasonKo: nonempty, plausible: z.boolean(),
  })).length(4),
  sources: z.array(z.object({ publisher: nonempty, url: z.url(), note: nonempty })),
  reviewedAt: nonempty, reviewer: nonempty, reviewNote: nonempty,
}).superRefine((q, ctx) => {
  const fail = (message: string) => ctx.addIssue({ code: "custom", message });
  if (!q.contextEn.includes(q.evidence)) fail("Missing contextual evidence");
  if (q.choices.filter(c => c.id === q.correctId).length !== 1) fail("Exactly one correct ID required");
  for (const field of ["id", "en", "ko"] as const) {
    if (new Set(q.choices.map(c => c[field].trim().toLowerCase())).size !== 4) fail("Duplicate choice " + field);
  }
  if (new Set(q.itemIds).size !== q.itemIds.length) fail("Duplicate item mapping");
  if (q.status === "production") {
    if (q.quality === "C") fail("C quality cannot ship");
    if (new Set(q.sources.map(s => s.publisher)).size < 2) fail("Two independent publishers required");
    if (q.choices.filter(c => c.id !== q.correctId && c.plausible).length < 2) fail("Two plausible distractors required");
  }
});
export type SenseQuestion = z.infer<typeof senseQuestionSchema>;

export const SENSE_QUESTIONS = z.object({ schema: z.literal(1), entries: z.array(senseQuestionSchema) })
  .parse(catalog).entries;

export function getProductionSenseQuestions(itemId: string): SenseQuestion[] {
  return SENSE_QUESTIONS.filter(q => q.status === "production" && q.quality !== "C" && q.itemIds.includes(itemId));
}

export function hasSenseQuestionMapping(itemId: string): boolean {
  return SENSE_QUESTIONS.some(q => q.itemIds.includes(itemId));
}

/** These counts measure reviewed content, not proof of learning efficacy. */
export function getSenseQuestionCoverage() {
  const production = SENSE_QUESTIONS.filter(q => q.status === "production");
  return {
    expressions: new Set(production.map(q => q.headword)).size,
    senses: new Set(production.map(q => q.senseId)).size,
    questions: production.length,
    mappedRows: new Set(production.flatMap(q => q.itemIds)).size,
    byStatus: Object.fromEntries(["candidate", "cross-checked", "reviewed", "production"].map(
      status => [status, SENSE_QUESTIONS.filter(q => q.status === status).length],
    )),
  };
}
