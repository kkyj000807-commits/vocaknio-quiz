import { z } from "zod";

import rawCatalog from "@/assets/vocab-definition-quiz-oewn-2025.json";

const nonempty = z.string().trim().min(1);

export const definitionQuizEntrySchema = z.object({
  headword: nonempty,
  senseId: nonempty,
  partOfSpeech: nonempty,
  definition: nonempty,
  lexicographerFile: nonempty,
  synsetMembers: z.array(nonempty).min(1),
  antonyms: z.array(nonempty),
});

export type DefinitionQuizEntry = z.infer<typeof definitionQuizEntrySchema>;
export type DefinitionQuizCandidate = DefinitionQuizEntry & {
  itemId: string;
  relation: "antonym" | "unrelated";
};

type DefinitionQuizCatalog = {
  schema: 1;
  version: string;
  coverage: {
    eligibleHeadwords: number;
    eligibleRows: number;
    excludedDefinitionLeakageHeadwords: number;
  };
  items: Record<string, string>;
  entries: Record<string, DefinitionQuizEntry>;
};

const catalog = rawCatalog as DefinitionQuizCatalog;
const itemEntry = new Map<string, DefinitionQuizEntry>();
const representativeItemId = new Map<string, string>();
const entriesByPartOfSpeech = new Map<string, DefinitionQuizEntry[]>();
const allEntries = Object.values(catalog.entries);

for (const [itemId, normalizedHeadword] of Object.entries(catalog.items)) {
  const entry = catalog.entries[normalizedHeadword];
  if (!entry) continue;
  itemEntry.set(itemId, entry);
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
