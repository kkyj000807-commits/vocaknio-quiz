import {
  buildVocabMigrationBackup,
  VOCAB_STORAGE_VERSION,
  type LegacyVocabLists,
  type VocabMigrationResult,
} from "@/lib/vocab-migration";

export const VOCAB_LIST_STORAGE_KEYS = {
  bookmarks: "vocaknio_bookmarks",
  wrongWords: "vocaknio_wrong_words",
  mastered: "vocaknio_mastered",
} as const;

export const VOCAB_STORAGE_VERSION_KEY = "vocaknio_vocab_storage_version";
export const VOCAB_STORAGE_BACKUP_KEY = "vocaknio_vocab_v1_4_migration_backup";

export interface VocabStorageAdapter {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  setItems(entries: Array<[string, string]>): Promise<void>;
}

function parseNumberList(raw: string | null, key: string): number[] {
  if (raw === null) return [];
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed)) throw new Error(`${key} is not a number array`);
  return parsed.filter((value): value is number => typeof value === "number");
}

function parseBackup(raw: string): VocabMigrationResult {
  const parsed: unknown = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object" || !("original" in parsed)) {
    throw new Error("Invalid vocabulary migration backup");
  }

  const original = (parsed as { original?: Partial<LegacyVocabLists> }).original;
  if (
    !original ||
    !Array.isArray(original.bookmarks) ||
    !Array.isArray(original.wrongWords) ||
    !Array.isArray(original.mastered)
  ) {
    throw new Error("Invalid vocabulary migration backup lists");
  }

  return buildVocabMigrationBackup({
    bookmarks: original.bookmarks,
    wrongWords: original.wrongWords,
    mastered: original.mastered,
  });
}

/**
 * Backs up legacy list numbers before replacing them with v1.4 numbers.
 * A retry always starts from the original backup, so a partial write cannot
 * remap already-migrated numbers as though they were legacy numbers.
 */
export async function migrateVocabStorage(
  storage: VocabStorageAdapter,
): Promise<VocabMigrationResult | null> {
  const currentVersion = await storage.getItem(VOCAB_STORAGE_VERSION_KEY);
  if (currentVersion === VOCAB_STORAGE_VERSION) return null;

  const storedBackup = await storage.getItem(VOCAB_STORAGE_BACKUP_KEY);
  let backup: VocabMigrationResult;

  if (storedBackup !== null) {
    backup = parseBackup(storedBackup);
  } else {
    const [bookmarks, wrongWords, mastered] = await Promise.all([
      storage.getItem(VOCAB_LIST_STORAGE_KEYS.bookmarks),
      storage.getItem(VOCAB_LIST_STORAGE_KEYS.wrongWords),
      storage.getItem(VOCAB_LIST_STORAGE_KEYS.mastered),
    ]);
    backup = buildVocabMigrationBackup({
      bookmarks: parseNumberList(bookmarks, VOCAB_LIST_STORAGE_KEYS.bookmarks),
      wrongWords: parseNumberList(wrongWords, VOCAB_LIST_STORAGE_KEYS.wrongWords),
      mastered: parseNumberList(mastered, VOCAB_LIST_STORAGE_KEYS.mastered),
    });
    await storage.setItem(VOCAB_STORAGE_BACKUP_KEY, JSON.stringify(backup));
  }

  await storage.setItems([
    [VOCAB_LIST_STORAGE_KEYS.bookmarks, JSON.stringify(backup.lists.bookmarks.mapped)],
    [VOCAB_LIST_STORAGE_KEYS.wrongWords, JSON.stringify(backup.lists.wrongWords.mapped)],
    [VOCAB_LIST_STORAGE_KEYS.mastered, JSON.stringify(backup.lists.mastered.mapped)],
    [VOCAB_STORAGE_VERSION_KEY, VOCAB_STORAGE_VERSION],
  ]);

  return backup;
}
