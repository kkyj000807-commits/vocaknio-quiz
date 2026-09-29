import { z } from "zod";

import rawCatalog from "@/assets/vocab-definition-quiz-oewn-2025.json";
import { VOCAB_BY_ID } from "@/lib/vocab";

const nonempty = z.string().trim().min(1);

export const definitionQuizEntrySchema = z.object({
  headword: nonempty,
  senseId: nonempty,
  partOfSpeech: nonempty,
  definition: nonempty,
  lexicographerFile: nonempty,
  synsetMembers: z.array(nonempty).min(1),
  antonyms: z.array(nonempty),
  examples: z.array(nonempty),
});

export type DefinitionQuizEntry = z.infer<typeof definitionQuizEntrySchema>;
export type DefinitionQuizCandidate = DefinitionQuizEntry & {
  itemId: string;
  relation: "antonym" | "unrelated";
};

export type DefinitionAnswerRelations = {
  synonyms: string[];
  antonyms: string[];
};

export type DefinitionRelationMeaning = {
  word: string;
  meaning: string;
  relation: "synonym" | "antonym";
  source: "same-sense-vocab" | "shared-sense-core" | "linked-antonym-vocab" | "pending-review";
};

type DefinitionQuizCatalog = {
  schema: 1;
  version: string;
  coverage: {
    eligibleHeadwords: number;
    eligibleRows: number;
    excludedDefinitionLeakageHeadwords: number;
    exampleHeadwords: number;
    exampleRows: number;
  };
  items: Record<string, string>;
  entries: Record<string, DefinitionQuizEntry>;
};

const catalog = rawCatalog as DefinitionQuizCatalog;
const itemEntry = new Map<string, DefinitionQuizEntry>();
const representativeItemId = new Map<string, string>();
const itemIdsByHeadword = new Map<string, string[]>();
const entriesByPartOfSpeech = new Map<string, DefinitionQuizEntry[]>();
const allEntries = Object.values(catalog.entries);

for (const [itemId, normalizedHeadword] of Object.entries(catalog.items)) {
  const entry = catalog.entries[normalizedHeadword];
  if (!entry) continue;
  itemEntry.set(itemId, entry);
  const itemIds = itemIdsByHeadword.get(normalizedHeadword) ?? [];
  itemIds.push(itemId);
  itemIdsByHeadword.set(normalizedHeadword, itemIds);
  if (!representativeItemId.has(normalizedHeadword)) {
    representativeItemId.set(normalizedHeadword, itemId);
  }
}

for (const entry of allEntries) {
  const byPos = entriesByPartOfSpeech.get(entry.partOfSpeech) ?? [];
  byPos.push(entry);
  entriesByPartOfSpeech.set(entry.partOfSpeech, byPos);

}

function normalized(value: string): string {
  return value.trim().toLowerCase().replace(/_/g, " ").replace(/\s+/g, " ");
}

function uniqueRelationWords(values: readonly string[], headword: string): string[] {
  const target = normalized(headword);
  const seen = new Set<string>();
  return values.filter((value) => {
    const key = normalized(value);
    if (!key || key === target || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * OEWN의 같은 synset 구성원만 동의어로, 명시된 antonym pointer만 반의어로 노출한다.
 * 빈 관계를 임의 생성하지 않는다.
 */
export function getDefinitionAnswerRelations(
  entry: DefinitionQuizEntry,
): DefinitionAnswerRelations {
  return {
    synonyms: uniqueRelationWords(entry.synsetMembers, entry.headword),
    antonyms: uniqueRelationWords(entry.antonyms, entry.headword),
  };
}

function koreanMeaningsForRelation(
  target: DefinitionQuizEntry,
  word: string,
  relation: "synonym" | "antonym",
): string[] {
  const key = normalized(word);
  const relationEntry = catalog.entries[key];
  if (!relationEntry) return [];
  if (relation === "synonym" && relationEntry.senseId !== target.senseId) return [];
  if (
    relation === "antonym" &&
    !target.antonyms.map(normalized).includes(key) &&
    !relationEntry.antonyms.map(normalized).includes(normalized(target.headword))
  ) return [];

  return [...new Set(
    (itemIdsByHeadword.get(key) ?? [])
      .map((itemId) => VOCAB_BY_ID.get(itemId)?.k_short.trim())
      .filter((meaning): meaning is string => Boolean(meaning)),
  )];
}

/**
 * 같은 OEWN sense로 확인된 영어 관계에만 한국어 뜻을 연결한다.
 * 별도 표제어 뜻이 없으면 동의어는 현재 sense의 핵심 뜻을 공유하고,
 * 반의어는 관계만 확인된 상태를 명시해 뜻을 추측하지 않는다.
 */
export function getDefinitionRelationMeanings(
  entry: DefinitionQuizEntry,
  coreMeaningKo: string,
): DefinitionRelationMeaning[] {
  const relations = getDefinitionAnswerRelations(entry);
  const synonyms = relations.synonyms.map((word): DefinitionRelationMeaning => {
    const meanings = koreanMeaningsForRelation(entry, word, "synonym");
    return {
      word,
      meaning: meanings.length > 0
        ? meanings.join(" · ")
        : `같은 sense의 핵심 뜻 · ${coreMeaningKo.trim()}`,
      relation: "synonym",
      source: meanings.length > 0 ? "same-sense-vocab" : "shared-sense-core",
    };
  });
  const antonyms = relations.antonyms.map((word): DefinitionRelationMeaning => {
    const meanings = koreanMeaningsForRelation(entry, word, "antonym");
    return {
      word,
      meaning: meanings.length > 0
        ? meanings.join(" · ")
        : "반대 관계 확인 · 개별 한국어 뜻 검수 대기",
      relation: "antonym",
      source: meanings.length > 0 ? "linked-antonym-vocab" : "pending-review",
    };
  });
  return [...synonyms, ...antonyms];
}

/**
 * 사전 원문을 바꾸지 않고, 현재 sense의 한국어 핵심 뜻을 한 장면으로 압축한다.
 * 역사적 어원이나 사전 번역으로 오인되지 않도록 UI에서 개념 설명으로 표시한다.
 */
export function buildDefinitionMeaningBridgeKo(koreanMeaning: string): string {
  return `영영 정의가 가리키는 중심 장면은 ‘${koreanMeaning.trim()}’이다. 이 장면에서 영어 표제어를 다시 꺼내는 방식으로 기억한다.`;
}

function isSafeDistractor(target: DefinitionQuizEntry, candidate: DefinitionQuizEntry): boolean {
  const targetHeadword = normalized(target.headword);
  const candidateHeadword = normalized(candidate.headword);
  if (!candidateHeadword || candidateHeadword === targetHeadword) return false;
  if (candidate.senseId === target.senseId) return false;
  if (candidate.definition.trim().toLowerCase() === target.definition.trim().toLowerCase()) return false;

  const targetSynset = new Set(target.synsetMembers.map(normalized));
  if (targetSynset.has(candidateHeadword)) return false;
  if (candidate.synsetMembers.map(normalized).includes(targetHeadword)) return false;
  return true;
}

function pickFromPool(
  target: DefinitionQuizEntry,
  pool: readonly DefinitionQuizEntry[],
  count: number,
  used: Set<string>,
  relation: DefinitionQuizCandidate["relation"],
  canUse: (candidate: DefinitionQuizEntry) => boolean = () => true,
): DefinitionQuizCandidate[] {
  if (pool.length === 0 || count <= 0) return [];
  const selected: DefinitionQuizCandidate[] = [];
  const start = Math.floor(Math.random() * pool.length);
  for (let offset = 0; offset < pool.length && selected.length < count; offset += 1) {
    const candidate = pool[(start + offset) % pool.length];
    const key = normalized(candidate.headword);
    const itemId = representativeItemId.get(key);
    if (!itemId || used.has(key) || !canUse(candidate) || !isSafeDistractor(target, candidate)) continue;
    used.add(key);
    selected.push({ ...candidate, itemId, relation });
  }
  return selected;
}

export function getDefinitionQuizEntry(itemId: string): DefinitionQuizEntry | undefined {
  return itemEntry.get(itemId);
}

export function isCurrentDefinitionQuizEntry(
  entry: DefinitionQuizEntry,
  item: { id: string; w: string },
): boolean {
  const current = itemEntry.get(item.id);
  return Boolean(
    current &&
      normalized(current.headword) === normalized(item.w) &&
      JSON.stringify(current) === JSON.stringify(entry),
  );
}

export function getDefinitionQuizDistractors(
  target: DefinitionQuizEntry,
  count = 3,
): DefinitionQuizCandidate[] {
  const used = new Set([normalized(target.headword)]);
  const antonymPool = target.antonyms
    .map((headword) => catalog.entries[normalized(headword)])
    .filter((entry): entry is DefinitionQuizEntry => Boolean(entry));
  const selected = pickFromPool(target, antonymPool, count, used, "antonym");
  if (selected.length < count) {
    selected.push(
      ...pickFromPool(
        target,
        entriesByPartOfSpeech.get(target.partOfSpeech) ?? [],
        count - selected.length,
        used,
        "unrelated",
        (candidate) => candidate.lexicographerFile !== target.lexicographerFile,
      ),
    );
  }
  if (selected.length < count) {
    selected.push(
      ...pickFromPool(
        target,
        allEntries,
        count - selected.length,
        used,
        "unrelated",
        (candidate) => candidate.partOfSpeech !== target.partOfSpeech,
      ),
    );
  }
  return selected;
}

export function getDefinitionQuizCoverage() {
  return { ...catalog.coverage };
}
