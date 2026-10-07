import { z } from "zod";
import catalog from "@/data/sentence-completion.json";
import { VOCAB_BY_ID, type VocabItem } from "@/lib/vocab";
import { ACTIVE_RECALL_SENSES, activeRecallMatchesItem } from "@/lib/active-recall";
import type { ReasoningQuestion } from "@/lib/reasoning-practice";

export const LOGIC_TYPE_LABELS = {
  elaboration: "순접·부연", concession: "역접·양보", "cause-effect": "원인 → 결과",
  "effect-cause": "결과 → 원인", "general-specific": "일반 → 구체", "claim-evidence": "주장 → 근거",
  "problem-solution": "문제 → 해결", attitude: "평가·태도", polarity: "긍정·부정 방향",
  comparison: "비교·대조", condition: "조건·가정", "time-change": "시간적 변화",
} as const;
export const DIFFICULTY_LABELS = { low: "하", medium: "중", high: "상" } as const;
const text = z.string().trim().min(1);
// Reuse the existing contextual-question contract, not its feedback-only store.
export const sentenceCompletionSchema = z.object({
  id: text.regex(/^sc-[a-z0-9-]+$/), itemId: text, relatedSenseId: text,
  passageEn: text, promptKo: text, blankMarker: z.literal("____"),
  choices: z.array(z.object({ id: text, text, errorType: z.enum(["supported", "sequence", "scope", "degree", "polarity", "modality", "causality", "relation", "unsupported", "sense"]), explanationKo: text })).length(4),
  correctChoiceId: text, evidence: z.array(text).min(1), translationKo: text,
  relationKo: text, requiredMeaningKo: text,
  logicType: z.enum(Object.keys(LOGIC_TYPE_LABELS) as [keyof typeof LOGIC_TYPE_LABELS, ...(keyof typeof LOGIC_TYPE_LABELS)[]]),
  difficulty: z.enum(["low", "medium", "high"]), authorship: z.enum(["generated", "past-exam", "adapted"]),
  sourceNote: text, sourceUrl: z.string().url().startsWith("https://").optional(), originalText: text.optional(),
}).superRefine((q, ctx) => {
  const reject = (message: string) => ctx.addIssue({ code: z.ZodIssueCode.custom, message });
  if (q.passageEn.split(q.blankMarker).length !== 2 || /_{2,}|\[blank\]/i.test(q.passageEn.replace(q.blankMarker, ""))) reject("Exactly one blank is required");
  if (/[가-힣]/u.test(q.passageEn) || q.choices.some(c => /[가-힣]/u.test(c.text))) reject("English prompt and options required");
  if (new Set(q.choices.map(c => c.id)).size !== 4 || new Set(q.choices.map(c => c.text.toLowerCase().replace(/\s+/g, " "))).size !== 4) reject("Duplicate options");
  if (q.choices.filter(c => c.errorType === "supported").length !== 1 || !q.choices.some(c => c.id === q.correctChoiceId && c.errorType === "supported")) reject("Answer reference/explanation mismatch");
  if (q.evidence.some(cue => !q.passageEn.includes(cue) || cue.includes(q.blankMarker))) reject("Evidence must occur outside the blank");
  if (q.authorship !== "generated" && (!q.sourceUrl || !q.originalText)) reject("Source and original text required");
  if (q.authorship === "past-exam" && q.passageEn !== q.originalText) reject("Past-exam original must not be edited");
});
export type SentenceCompletionQuestion = z.infer<typeof sentenceCompletionSchema> & ReasoningQuestion;
export const sentenceCompletionCatalogSchema = z.object({ schema: z.literal(1), questions: z.array(sentenceCompletionSchema).min(1) }).superRefine((data, ctx) => {
  for (const values of [data.questions.map(q => q.id), data.questions.map(q => q.itemId), data.questions.map(q => q.passageEn.toLowerCase().replace(/\s+/g, " "))]) {
    if (new Set(values).size !== values.length) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Duplicate question ID, active source anchor or passage" });
  }
});
// One active question per canonical source anchor preserves the current (mode,num)
// adaptive identity. Reject conflicting imports rather than merging their records.
export const SENTENCE_COMPLETION_QUESTIONS: SentenceCompletionQuestion[] = sentenceCompletionCatalogSchema.parse(catalog).questions;
function hasVerifiedSourceLink(q: SentenceCompletionQuestion) {
  const item = VOCAB_BY_ID.get(q.itemId);
  const sense = ACTIVE_RECALL_SENSES.find(s => s.senseId === q.relatedSenseId && s.status === "production");
  return !!item && !!sense && activeRecallMatchesItem(sense, item);
}
// Shape validation is independent of the loaded vocabulary (including small test
// fixtures). Registration/build audits still require every actual source link.
export function validateSentenceCompletionCatalog(value: unknown) {
  const parsed = sentenceCompletionCatalogSchema.parse(value);
  for (const q of parsed.questions) {
    if (!hasVerifiedSourceLink(q)) throw new Error(`Unverified vocabulary/sense link: ${q.id}`);
  }
  return parsed;
}
const byItemId = new Map(SENTENCE_COMPLETION_QUESTIONS.map(q => [q.itemId, q]));
const byId = new Map(SENTENCE_COMPLETION_QUESTIONS.map(q => [q.id, q]));
export const sentenceCompletionKey = (q: Pick<SentenceCompletionQuestion, "id">) => `sentence:${q.id}`;
export function getSentenceCompletion(itemId: string) {
  const q = byItemId.get(itemId);
  return q && hasVerifiedSourceLink(q) ? q : undefined;
}
export function getSentenceCompletionByKey(key: string) {
  const q = key.startsWith("sentence:") ? byId.get(key.slice(9)) : undefined;
  return q && hasVerifiedSourceLink(q) ? q : undefined;
}
export function isCurrentSentenceCompletion(q: SentenceCompletionQuestion, item: VocabItem) {
  const current = byId.get(q.id);
  return !!current && hasVerifiedSourceLink(current) && current.itemId === item.id && JSON.stringify(current) === JSON.stringify(q);
}
export function sentenceCompletionMetadata() {
  return SENTENCE_COMPLETION_QUESTIONS.filter(hasVerifiedSourceLink).map(q => {
    const item = VOCAB_BY_ID.get(q.itemId)!;
    return { num: item.num, word: item.w, sourceId: item.id, groupId: item.group,
      mode: "sentence-completion", learningKey: sentenceCompletionKey(q), conceptId: q.id };
  });
}
export function blankPosition(q: SentenceCompletionQuestion) {
  const start = q.passageEn.indexOf(q.blankMarker);
  return { start, end: start + q.blankMarker.length };
}
