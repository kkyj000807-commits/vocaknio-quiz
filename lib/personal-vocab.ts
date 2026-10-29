import raw from "@/assets/personal-vocab.json";

export interface PersonalVocabEntry {
  id: string;
  num: number;
  key: string;
  word: string;
  gloss: string;
  sourceSection: string;
  sourceBookId?: number;
  sourceStudyId?: string | null;
  ipa?: string;
  koreanPronunciation?: string;
  pronunciationStatus?: string;
  koreanPronunciationStatus?: string;
  sourceReview?: Record<string, unknown>;
  studyHoldReason?: string;
  studyStatus?: "SOURCE_STUDY_HOLD" | "PRIVATE_REFERENCE_ONLY";
  retired?: boolean;
  retirementStatus?: "RETIRED_REFERENCE_ONLY";
  retiredFromSourceSha256?: string | null;
  retirementReason?: string;
  sources: { id: string; text: string; page: number; locator: string; status: string; [key: string]: unknown }[];
  notes: string[];
  examples: string[];
  relationHints: string[];
}

export const PERSONAL_VOCAB_DATA = raw as unknown as {
  schema: number; requiresAccess: boolean; sourceSha256?: string; entries: PersonalVocabEntry[];
  retiredEntries?: PersonalVocabEntry[];
};
export const personalWordKey = (word: string) => word.trim().toLowerCase().replace(/[‘’]/g, "'").replace(/\s+/g, " ");
const byWord = new Map(PERSONAL_VOCAB_DATA.entries.map(entry => [entry.key, entry]));
export function getPersonalVocabReference(word: string): PersonalVocabEntry | undefined {
  return byWord.get(personalWordKey(word));
}

export function makePersonalStudyItems(baseline: readonly { w: string }[], entries = PERSONAL_VOCAB_DATA.entries) {
  const known = new Set(baseline.map(item => personalWordKey(item.w)));
  return entries.filter(entry => !known.has(entry.key)).map(personalReferenceItem);
}

// Lookup only: retain old bookmark/learning references without adding another
// book row or redirecting the learner's history to a guessed representative.
export function makeRetiredPersonalReferenceItems(entries = PERSONAL_VOCAB_DATA.retiredEntries ?? []) {
  return entries.map(entry => ({ ...personalReferenceItem(entry), retiredReferenceOnly: true as const }));
}

function personalReferenceItem(entry: PersonalVocabEntry) {
  return {
    num: entry.num, id: entry.id, sourceIndex: -1, sourceNumber: entry.id,
    // p is pronunciation, never POS. Missing source IPA stays empty.
    w: entry.word, k: entry.gloss, p: entry.ipa ?? "", group: "PERSONAL" as const,
    koreanPronunciation: entry.koreanPronunciation ?? "",
    pronunciationStatus: entry.pronunciationStatus ?? "",
    koreanPronunciationStatus: entry.koreanPronunciationStatus ?? "",
    sourceStudyId: entry.sourceStudyId ?? null,
    sourceReview: entry.sourceReview ?? {},
    studyHoldReason: entry.studyHoldReason ?? "",
    studyStatus: entry.studyStatus ?? "PRIVATE_REFERENCE_ONLY",
    retirementStatus: entry.retirementStatus,
    retirementReason: entry.retirementReason,
    retiredFromSourceSha256: entry.retiredFromSourceSha256,
    conceptId: "", conceptLabel: "개인 통합 단어장", majorConceptLabel: entry.sourceSection,
    s: [] as string[], k_short: entry.gloss, category: entry.sourceSection,
    type: /\s/.test(entry.word) ? "phrase" as const : "word" as const,
    referenceOnly: true as const,
  };
}
