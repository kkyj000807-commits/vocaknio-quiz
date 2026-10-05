import { ACTIVE_RECALL_SENSES, getActiveRecallSenses } from "@/lib/active-recall";
import { getProductionSenseQuestions } from "@/lib/sense-questions";
import { getDefinitionQuizEntry } from "@/lib/definition-quiz";
import {
  normalizeMeaning,
  normalizeWord,
  type VocabItem,
} from "@/lib/vocab";

export type LearningTargetKind = "canonical-sense" | "legacy-equivalence";

export interface LearningTargetRef {
  key: string;
  kind: LearningTargetKind;
  senseId: string | null;
  headword: string;
  meaning: string;
  occurrenceIds: string[];
}

function encodeKeyPart(value: string): string {
  return encodeURIComponent(value.trim().replace(/\s+/g, " "));
}

export function canonicalSenseKey(senseId: string): string {
  // Content enrichment must not reset existing states or split answer history.
  // This opt-in preserves an already reviewed equivalent single-sense key;
  // the new sense ID remains the content/answer boundary, not a second store.
  const entry = ACTIVE_RECALL_SENSES.find(sense => sense.senseId === senseId && sense.status === "production");
  if (entry?.preservedLearningKey && entry.itemIds.every(id => getActiveRecallSenses(id).length === 1)) {
    return entry.preservedLearningKey;
  }
  return `sense:${encodeKeyPart(senseId)}`;
}

/** Restore known keys after a router decodes their percent-encoded parts.
 * JSON preserves commas inside legacy meanings; old CSV links still work.
 * Unknown or ambiguous values remain unmatched rather than selecting another sense.
 */
export function parseLearningReviewKeys(raw: string, items: VocabItem[]): string[] {
  if (!raw) return [];
  let values: unknown;
  try { values = raw.startsWith("[") ? JSON.parse(raw) : raw.split(","); }
  catch { return [raw]; }
  if (!Array.isArray(values) || values.some(value => typeof value !== "string")) return [raw];
  const known = [...new Set(items.flatMap(item => getItemLearningTargets(item).map(target => target.key)))];
  const decoded = (key: string) => { try { return decodeURIComponent(key); } catch { return key; } };
  return [...new Set((values as string[]).filter(Boolean).map(value => {
    if (known.includes(value)) return value;
    const matches = known.filter(key => decoded(key) === value);
    return matches.length === 1 ? matches[0] : value;
  }))];
}

/**
 * Rows without reviewed sense IDs use a versioned equivalence key. The key is
 * deliberately narrower than a headword: a different displayed meaning stays
 * a different learning target and can later be migrated to a reviewed sense.
 */
export function legacyEquivalenceKey(
  item: Pick<VocabItem, "w" | "k" | "type">,
): string {
  return `legacy:v1:${item.type}:${encodeKeyPart(normalizeWord(item.w))}:${encodeKeyPart(normalizeMeaning(item.k))}`;
}

export function getItemLearningTargets(item: VocabItem): LearningTargetRef[] {
  const reviewed = new Map<string, string>();
  for (const sense of getActiveRecallSenses(item.id)) {
    reviewed.set(sense.senseId, sense.koreanMeaning);
  }
  for (const sense of getProductionSenseQuestions(item.id)) {
    reviewed.set(sense.senseId, sense.definitionKo);
  }
  if (reviewed.size === 0) {
    const definition = getDefinitionQuizEntry(item.id);
    if (definition) reviewed.set(definition.senseId, item.k);
  }
  if (reviewed.size > 0) {
    return [...reviewed].map(([senseId, meaning]) => ({
      key: canonicalSenseKey(senseId),
      kind: "canonical-sense" as const,
      senseId,
      headword: item.w,
      meaning,
      occurrenceIds: [item.id],
    }));
  }
  return [{
    key: legacyEquivalenceKey(item),
    kind: "legacy-equivalence",
    senseId: null,
    headword: item.w,
    meaning: item.k,
    occurrenceIds: [item.id],
  }];
}

export function getLearningTargetKey(
  item: VocabItem,
  senseId?: string | null,
): string {
  return senseId ? canonicalSenseKey(senseId) : legacyEquivalenceKey(item);
}

export function getQuestionLearningTargetKey(question: {
  item: VocabItem;
  recall?: { senseId: string };
  sense?: { senseId: string };
  definitionRecall?: { senseId: string };
}): string {
  return getLearningTargetKey(
    question.item,
    question.recall?.senseId ?? question.sense?.senseId ?? question.definitionRecall?.senseId,
  );
}

export function itemIsFullyMastered(
  item: VocabItem,
  masteredKeys: ReadonlySet<string>,
): boolean {
  const targets = getItemLearningTargets(item);
  return targets.length > 0 && targets.every((target) => masteredKeys.has(target.key));
}

export function excludeFullyMasteredItems<T extends VocabItem>(
  items: readonly T[],
  masteredKeys: ReadonlySet<string>,
): T[] {
  return items.filter((item) => !itemIsFullyMastered(item, masteredKeys));
}
