import { getActiveRecallSenses } from "@/lib/active-recall";
import { getProductionSenseQuestions } from "@/lib/sense-questions";
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
  return `sense:${encodeKeyPart(senseId)}`;
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
}): string {
  return getLearningTargetKey(
    question.item,
    question.recall?.senseId ?? question.sense?.senseId,
  );
}

export function itemIsFullyMastered(
  item: VocabItem,
  masteredKeys: ReadonlySet<string>,
): boolean {
  const targets = getItemLearningTargets(item);
  return targets.length > 0 && targets.every((target) => masteredKeys.has(target.key));
}
