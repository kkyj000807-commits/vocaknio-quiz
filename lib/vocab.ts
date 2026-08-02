import vocabRaw from "@/assets/vocab-v1.4.json";
import vocabMetaRaw from "@/assets/vocab-meta-v1.4.json";

export type VocabGroup =
  | "V101"
  | "V201"
  | "V301"
  | "V401"
  | "V501"
  | "V502"
  | "V601"
  | "APPENDIX";

interface RawVocabItem {
  num: number;
  id: string;
  sourceIndex: number;
  sourceNumber: number | string;
  w: string;
  k: string;
  p: string;
  group: VocabGroup;
  conceptId: string;
  conceptLabel: string;
  majorConceptLabel: string;
  s: string[];
}

interface VocabMeta {
  version: string;
  sourceRows: number;
  sourceEntries: number;
  sourceSha256: string;
  groupCounts: Record<VocabGroup, number>;
  sections: Array<{
    id: string;
    group: VocabGroup;
    label: string;
    start: number;
    end: number;
    count: number;
  }>;
  concepts: Array<{
    id: string;
    group: VocabGroup;
    label: string;
    majorLabel: string;
    words: string[];
  }>;
  confirmedPairCount: number;
  synonymEntryCount: number;
  legacyMigration: {
    sourceCount: number;
    mappedCount: number;
    unresolvedCount: number;
    numMap: Record<string, number>;
    unresolvedNums: number[];
  };
}

export interface VocabItem extends RawVocabItem {
  k_short: string;
  category: string;
  type: "word" | "idiom" | "phrase";
}

export interface SynonymDetail {
  word: string;
  meaning: string;
  conceptId: string;
}

export interface VocabRange {
  id: string;
  label: string;
  start: number;
  end: number;
  count: number;
  group?: VocabGroup;
  kind: "section" | "all" | "idioms";
  core?: boolean;
}

export const VOCAB_META = vocabMetaRaw as VocabMeta;

function inferType(word: string): VocabItem["type"] {
  if (!/\s/.test(word.trim())) return "word";
  return /\b(to|one|one's|someone|something)\b|\b(by|for|from|in|into|of|on|out|over|up|with)\b/i.test(
    word,
  )
    ? "idiom"
    : "phrase";
}

export const VOCAB: VocabItem[] = (vocabRaw as RawVocabItem[]).map((item) => ({
  ...item,
  k_short: item.k,
  category: item.majorConceptLabel || item.conceptLabel || item.group,
  type: inferType(item.w),
}));

export const VOCAB_BY_NUM = new Map(VOCAB.map((item) => [item.num, item]));
export const VOCAB_WITH_SYNONYMS = VOCAB.filter((item) => item.s.length > 0);
export const VOCAB_IDIOMS = VOCAB.filter(
  (item) => item.type === "idiom" || item.type === "phrase",
);
export const VOCAB_WORDS_ONLY = VOCAB.filter((item) => item.type === "word");

const CORE_GROUPS = new Set<VocabGroup>(["V301", "V501", "V502"]);

export const RANGES: VocabRange[] = [
  ...VOCAB_META.sections.map((section) => ({
    ...section,
    kind: "section" as const,
    core: CORE_GROUPS.has(section.group),
  })),
  {
    id: "idioms",
    label: "숙어·표현",
    start: 0,
    end: VOCAB.length - 1,
    count: VOCAB_IDIOMS.length,
    kind: "idioms",
  },
  {
    id: "all",
    label: "전체",
    start: 0,
    end: VOCAB.length - 1,
    count: VOCAB.length,
    kind: "all",
  },
];

export const CORE_RANGES = RANGES.filter((range) => range.core);
export const SECTION_RANGES = RANGES.filter((range) => range.kind === "section");
export const COUNTS = [10, 20, 30];

export type QuizMode =
  | "syn-choice"
  | "kor-choice"
  | "syn-kor-choice"
  | "flashcard"
  | "syn-type";

export const QUIZ_MODES: Array<{
  id: QuizMode;
  icon: string;
  title: string;
  desc: string;
  primary?: boolean;
}> = [
  { id: "syn-choice", icon: "🔗", title: "동의어", desc: "검증된 동의어 4택", primary: true },
  { id: "kor-choice", icon: "🇰🇷", title: "뜻", desc: "정확한 뜻 4택", primary: true },
  { id: "flashcard", icon: "⚡", title: "빠른 암기", desc: "뜻 확인 후 채점", primary: true },
  { id: "syn-kor-choice", icon: "🔀", title: "동의어+뜻", desc: "뜻까지 함께 구분" },
  { id: "syn-type", icon: "✍️", title: "직접 입력", desc: "동의어 타이핑" },
];

export function shuffle<T>(items: readonly T[]): T[] {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const target = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[target]] = [shuffled[target], shuffled[index]];
  }
  return shuffled;
}

export function normalizeWord(value: string): string {
  return value.trim().toLowerCase();
}

export function normalizeMeaning(value: string): string {
  return value
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/[^a-z가-힣]+/g, " ")
    .trim();
}

function meaningTokens(value: string): Set<string> {
  return new Set(
    normalizeMeaning(value)
      .split(/\s+/)
      .filter((token) => token.length > 1),
  );
}

export function meaningsOverlap(left: string, right: string): boolean {
  const normalizedLeft = normalizeMeaning(left);
  const normalizedRight = normalizeMeaning(right);
  if (!normalizedLeft || !normalizedRight) return false;
  if (normalizedLeft === normalizedRight) return true;
  if (normalizedLeft.includes(normalizedRight) || normalizedRight.includes(normalizedLeft)) return true;

  const leftTokens = meaningTokens(normalizedLeft);
  const rightTokens = meaningTokens(normalizedRight);
  for (const token of leftTokens) {
    if (rightTokens.has(token)) return true;
  }
  return false;
}

const CONCEPTS_BY_ID = new Map(VOCAB_META.concepts.map((concept) => [concept.id, concept]));
const ITEMS_BY_CONCEPT_AND_WORD = new Map<string, VocabItem[]>();
const ITEMS_BY_WORD = new Map<string, VocabItem[]>();
const RELATED_WORDS_BY_WORD = new Map<string, Set<string>>();

for (const concept of VOCAB_META.concepts) {
  for (const word of concept.words) {
    if (!RELATED_WORDS_BY_WORD.has(word)) RELATED_WORDS_BY_WORD.set(word, new Set());
    const related = RELATED_WORDS_BY_WORD.get(word)!;
    for (const candidate of concept.words) related.add(candidate);
  }
}

for (const item of VOCAB) {
  const normalized = normalizeWord(item.w);
  if (!ITEMS_BY_WORD.has(normalized)) ITEMS_BY_WORD.set(normalized, []);
  ITEMS_BY_WORD.get(normalized)!.push(item);

  if (item.conceptId) {
    const key = `${item.conceptId}\u0000${normalized}`;
    if (!ITEMS_BY_CONCEPT_AND_WORD.has(key)) ITEMS_BY_CONCEPT_AND_WORD.set(key, []);
    ITEMS_BY_CONCEPT_AND_WORD.get(key)!.push(item);
  }
}

export function getVocabItem(num: number): VocabItem | undefined {
  return VOCAB_BY_NUM.get(num);
}

export function getRangeItems(range: VocabRange): VocabItem[] {
  if (range.kind === "idioms") return VOCAB_IDIOMS;
  if (range.kind === "all") return VOCAB;
  return VOCAB.slice(range.start, range.end + 1);
}

export function getAcceptedSynonyms(item: VocabItem): string[] {
  return item.s;
}

export function isAcceptedSynonym(item: VocabItem, candidate: string): boolean {
  const normalized = normalizeWord(candidate);
  return item.s.some((synonym) => normalizeWord(synonym) === normalized);
}

export function getRelatedWords(item: VocabItem): Set<string> {
  const related = new Set<string>([normalizeWord(item.w), ...item.s.map(normalizeWord)]);
  const wordsToExpand = [...related];
  for (const word of wordsToExpand) {
    for (const candidate of RELATED_WORDS_BY_WORD.get(word) ?? []) related.add(candidate);
  }
  return related;
}

export function getSynonymDetails(item: VocabItem): SynonymDetail[] {
  const details: SynonymDetail[] = [];
  for (const synonym of item.s) {
    const normalized = normalizeWord(synonym);
    const conceptMatches = item.conceptId
      ? ITEMS_BY_CONCEPT_AND_WORD.get(`${item.conceptId}\u0000${normalized}`) ?? []
      : [];
    const candidates = conceptMatches.length > 0 ? conceptMatches : ITEMS_BY_WORD.get(normalized) ?? [];
    const meanings = [...new Set(candidates.map((candidate) => candidate.k).filter(Boolean))];
    if (meanings.length === 0) continue;
    details.push({
      word: candidates[0]?.w ?? synonym,
      meaning: meanings.join(" / "),
      conceptId: item.conceptId,
    });
  }
  return details;
}

export function getConceptWords(item: VocabItem): string[] {
  if (!item.conceptId) return [];
  return CONCEPTS_BY_ID.get(item.conceptId)?.words ?? [];
}

export function migrateLegacyNum(num: number): number | undefined {
  return VOCAB_META.legacyMigration.numMap[String(num)];
}

export function isLegacyNumUnresolved(num: number): boolean {
  return VOCAB_META.legacyMigration.unresolvedNums.includes(num);
}
