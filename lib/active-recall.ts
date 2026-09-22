import { z } from "zod";
import catalog from "../data/active-recall-senses.json";
import type { VocabItem } from "./vocab";

const nonempty = z.string().trim().min(1);
export const activeRecallSenseSchema = z.object({
  id: nonempty,
  headword: nonempty,
  partOfSpeech: nonempty,
  senseId: nonempty,
  itemIds: z.array(nonempty).min(1),
  englishDefinition: nonempty,
  conciseEnglishDefinition: nonempty,
  exactSynonyms: z.array(nonempty),
  nearSynonyms: z.array(nonempty),
  antonyms: z.array(nonempty),
  variants: z.array(nonempty),
  relatedWords: z.array(nonempty),
  exampleSentences: z.array(z.object({ en: nonempty, type: z.enum(["source", "editorial"]) })).min(1),
  koreanMeaning: nonempty,
  prompts: z.array(z.object({ id: nonempty, kind: z.enum(["definition-recall", "context-recall"]), text: nonempty })).min(2),
  distractors: z.array(z.object({ word: nonempty, meaningKo: nonempty, reasonKo: nonempty, plausible: z.boolean() })).length(3),
  sources: z.array(z.object({ publisher: nonempty, url: z.url(), independenceGroup: nonempty, note: nonempty })).min(2),
  sourceCheckedAt: nonempty,
  status: z.enum(["candidate", "cross-checked", "reviewed", "production"]),
  quality: z.enum(["A", "B", "C"]),
  enrichmentStatus: z.enum(["complete", "partial", "source_not_found", "parse_failed", "sense_match_failed", "write_failed", "pending_retry"]),
  failureReason: z.string().nullable(),
}).superRefine((entry, ctx) => {
  const normalized = [entry.headword, ...entry.distractors.map(item => item.word)].map(value => value.trim().toLowerCase());
  if (new Set(normalized).size !== 4) ctx.addIssue({ code: "custom", message: "Recall choices must be unique" });
  if (entry.status === "production") {
    if (entry.quality === "C" || entry.enrichmentStatus !== "complete") ctx.addIssue({ code: "custom", message: "Only complete A/B entries can ship" });
    if (new Set(entry.sources.map(source => source.independenceGroup)).size < 2) ctx.addIssue({ code: "custom", message: "Two independent sources required" });
    if (entry.distractors.filter(item => item.plausible).length < 2) ctx.addIssue({ code: "custom", message: "Two plausible distractors required" });
  }
});

export type ActiveRecallSense = z.infer<typeof activeRecallSenseSchema>;
export const ACTIVE_RECALL_SENSES = z.object({ schema: z.literal(1), entries: z.array(activeRecallSenseSchema) }).parse(catalog).entries;

export function getActiveRecallSenses(itemId: string): ActiveRecallSense[] {
  return ACTIVE_RECALL_SENSES.filter(entry => entry.status === "production" && entry.quality !== "C" && entry.itemIds.includes(itemId));
}

export function activeRecallMatchesItem(entry: ActiveRecallSense, item: Pick<VocabItem, "id" | "w">): boolean {
  return entry.itemIds.includes(item.id) && entry.headword === item.w;
}

export function isCurrentActiveRecallSense(entry: ActiveRecallSense, item: Pick<VocabItem, "id" | "w">): boolean {
  const parsed = activeRecallSenseSchema.safeParse(entry);
  const current = getActiveRecallSenses(item.id).find(candidate => candidate.id === entry.id);
  return parsed.success && !!current && activeRecallMatchesItem(current, item) && JSON.stringify(parsed.data) === JSON.stringify(current);
}

export function getActiveRecallCoverage() {
  const production = ACTIVE_RECALL_SENSES.filter(entry => entry.status === "production" && entry.quality !== "C");
  return {
    senses: production.length,
    rows: new Set(production.flatMap(entry => entry.itemIds)).size,
    definitions: production.filter(entry => entry.englishDefinition && entry.conciseEnglishDefinition).length,
    examples: production.filter(entry => entry.exampleSentences.length > 0).length,
    synonymRelations: production.filter(entry => entry.exactSynonyms.length + entry.nearSynonyms.length + entry.variants.length > 0).length,
  };
}
