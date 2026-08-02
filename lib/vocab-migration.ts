import { VOCAB_META, migrateLegacyNum } from "@/lib/vocab";

export const VOCAB_STORAGE_VERSION = "v1.4";

export interface LegacyVocabLists {
  bookmarks: number[];
  wrongWords: number[];
  mastered: number[];
}

export interface MigratedVocabList {
  mapped: number[];
  unresolved: number[];
}

export interface VocabMigrationResult {
  version: typeof VOCAB_STORAGE_VERSION;
  sourceVersion: "legacy";
  sourceCount: number;
  mappedCount: number;
  unresolvedCount: number;
  original: LegacyVocabLists;
  lists: Record<keyof LegacyVocabLists, MigratedVocabList>;
}

function uniqueValidNums(values: readonly number[]): number[] {
  return [...new Set(values.filter((value) => Number.isInteger(value) && value > 0))];
}

function migrateList(values: readonly number[]): MigratedVocabList {
  const mapped: number[] = [];
  const unresolved: number[] = [];

  for (const legacyNum of uniqueValidNums(values)) {
    const nextNum = migrateLegacyNum(legacyNum);
    if (nextNum === undefined) unresolved.push(legacyNum);
    else mapped.push(nextNum);
  }

  return {
    mapped: [...new Set(mapped)],
    unresolved,
  };
}

export function buildVocabMigrationBackup(input: LegacyVocabLists): VocabMigrationResult {
  const original: LegacyVocabLists = {
    bookmarks: uniqueValidNums(input.bookmarks),
    wrongWords: uniqueValidNums(input.wrongWords),
    mastered: uniqueValidNums(input.mastered),
  };
  const lists = {
    bookmarks: migrateList(original.bookmarks),
    wrongWords: migrateList(original.wrongWords),
    mastered: migrateList(original.mastered),
  };

  return {
    version: VOCAB_STORAGE_VERSION,
    sourceVersion: "legacy",
    sourceCount: VOCAB_META.legacyMigration.sourceCount,
    mappedCount: VOCAB_META.legacyMigration.mappedCount,
    unresolvedCount: VOCAB_META.legacyMigration.unresolvedCount,
    original,
    lists,
  };
}
