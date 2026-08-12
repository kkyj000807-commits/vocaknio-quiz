import { describe, expect, it } from "vitest";

import { VOCAB_META } from "@/lib/vocab";
import { VOCAB_STORAGE_VERSION } from "@/lib/vocab-migration";
import {
  migrateVocabStorage,
  VOCAB_LIST_STORAGE_KEYS,
  VOCAB_STORAGE_BACKUP_KEY,
  VOCAB_STORAGE_VERSION_KEY,
  type VocabStorageAdapter,
} from "@/lib/vocab-storage-migration";

class MemoryStorage implements VocabStorageAdapter {
  readonly values = new Map<string, string>();

  async getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  async setItem(key: string, value: string) {
    this.values.set(key, value);
  }

  async setItems(entries: Array<[string, string]>) {
    for (const [key, value] of entries) this.values.set(key, value);
  }
}

describe("runtime vocabulary storage migration", () => {
  it("backs up originals before writing mapped v1.4 lists", async () => {
    const mappedLegacyNum = Number(Object.keys(VOCAB_META.legacyMigration.numMap)[0]);
    const unresolvedLegacyNum = VOCAB_META.legacyMigration.unresolvedNums[0];
    const storage = new MemoryStorage();
    storage.values.set(
      VOCAB_LIST_STORAGE_KEYS.bookmarks,
      JSON.stringify([mappedLegacyNum, unresolvedLegacyNum]),
    );
    storage.values.set(VOCAB_LIST_STORAGE_KEYS.wrongWords, JSON.stringify([mappedLegacyNum]));

    const result = await migrateVocabStorage(storage);
    const mappedNum = VOCAB_META.legacyMigration.numMap[String(mappedLegacyNum)];

    expect(result?.original.bookmarks).toEqual([mappedLegacyNum, unresolvedLegacyNum]);
    expect(result?.lists.bookmarks.unresolved).toEqual([unresolvedLegacyNum]);
    expect(JSON.parse(storage.values.get(VOCAB_STORAGE_BACKUP_KEY)!)).toMatchObject({
      original: { bookmarks: [mappedLegacyNum, unresolvedLegacyNum] },
    });
    expect(JSON.parse(storage.values.get(VOCAB_LIST_STORAGE_KEYS.bookmarks)!)).toEqual([mappedNum]);
    expect(JSON.parse(storage.values.get(VOCAB_LIST_STORAGE_KEYS.wrongWords)!)).toEqual([mappedNum]);
    expect(storage.values.get(VOCAB_STORAGE_VERSION_KEY)).toBe(VOCAB_STORAGE_VERSION);
  });

  it("is idempotent after the version marker is written", async () => {
    const storage = new MemoryStorage();
    storage.values.set(VOCAB_LIST_STORAGE_KEYS.bookmarks, JSON.stringify([1]));
    await migrateVocabStorage(storage);
    const snapshot = new Map(storage.values);

    expect(await migrateVocabStorage(storage)).toBeNull();
    expect(storage.values).toEqual(snapshot);
  });

  it("retries from the original backup instead of partially migrated lists", async () => {
    const mappedLegacyNum = Number(Object.keys(VOCAB_META.legacyMigration.numMap)[0]);
    const mappedNum = VOCAB_META.legacyMigration.numMap[String(mappedLegacyNum)];
    const storage = new MemoryStorage();
    storage.values.set(VOCAB_LIST_STORAGE_KEYS.bookmarks, JSON.stringify([mappedLegacyNum]));
    await migrateVocabStorage(storage);

    storage.values.delete(VOCAB_STORAGE_VERSION_KEY);
    storage.values.set(VOCAB_LIST_STORAGE_KEYS.bookmarks, JSON.stringify([999999]));
    await migrateVocabStorage(storage);

    expect(JSON.parse(storage.values.get(VOCAB_LIST_STORAGE_KEYS.bookmarks)!)).toEqual([mappedNum]);
  });
});
