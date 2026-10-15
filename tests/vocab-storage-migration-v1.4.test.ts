import { describe, expect, it } from "vitest";

import { VOCAB_META } from "@/lib/vocab";
import { VOCAB_STORAGE_VERSION } from "@/lib/vocab-migration";
import {
  migrateVocabStorage,
  VOCAB_LIST_STORAGE_KEYS,
  VOCAB_STORAGE_BACKUP_KEY,
  VOCAB_STORAGE_VERSION_KEY,
  type VocabStorageAdapter,
  getVocabStorageFailureMessage,
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
  it("never stamps a completed migration when a web-style batch continues after one list fails", async () => {
    const storage = new MemoryStorage();
    const legacy = Number(Object.keys(VOCAB_META.legacyMigration.numMap)[0]);
    storage.values.set(VOCAB_LIST_STORAGE_KEYS.bookmarks, JSON.stringify([legacy]));
    storage.setItems = async entries => {
      let failed = false;
      for (const [key, value] of entries) {
        if (key === VOCAB_LIST_STORAGE_KEYS.bookmarks) failed = true;
        else storage.values.set(key, value);
      }
      if (failed) throw Object.assign(new Error("quota"), { name: "QuotaExceededError" });
    };
    await expect(migrateVocabStorage(storage)).rejects.toMatchObject({ code: "storage-full" });
    expect(storage.values.has(VOCAB_STORAGE_VERSION_KEY)).toBe(false);
    expect(storage.values.get(VOCAB_LIST_STORAGE_KEYS.bookmarks)).toBe(JSON.stringify([legacy]));
    expect(JSON.parse(storage.values.get(VOCAB_STORAGE_BACKUP_KEY)!).original.bookmarks).toEqual([legacy]);
  });

  it("does not mark a silently dropped list write as a completed migration", async () => {
    const storage = new MemoryStorage();
    storage.setItems = async entries => {
      for (const [key, value] of entries) if (key !== VOCAB_LIST_STORAGE_KEYS.mastered) storage.values.set(key, value);
    };
    await expect(migrateVocabStorage(storage)).rejects.toMatchObject({ code: "write-failed" });
    expect(storage.values.has(VOCAB_STORAGE_VERSION_KEY)).toBe(false);
    expect(storage.values.has(VOCAB_STORAGE_BACKUP_KEY)).toBe(true);
  });

  it("never replaces learner lists if preserving the original backup was silently dropped", async () => {
    const storage = new MemoryStorage();
    storage.values.set(VOCAB_LIST_STORAGE_KEYS.bookmarks, "[1]");
    const before = new Map(storage.values);
    storage.setItem = async () => {};
    await expect(migrateVocabStorage(storage)).rejects.toMatchObject({ code: "write-failed" });
    expect(storage.values).toEqual(before);
  });

  it("reports a silently dropped final version marker without claiming success", async () => {
    const storage = new MemoryStorage();
    const set = storage.setItem.bind(storage);
    storage.setItem = async (key, value) => { if (key !== VOCAB_STORAGE_VERSION_KEY) await set(key, value); };
    await expect(migrateVocabStorage(storage)).rejects.toMatchObject({ code: "write-failed" });
    expect(storage.values.has(VOCAB_STORAGE_VERSION_KEY)).toBe(false);
    expect(storage.values.has(VOCAB_STORAGE_BACKUP_KEY)).toBe(true);
  });

  it.each(['[1,"2"]', "[1,-3]", "[1,2.5]", "[1,null]"])("preserves malformed original list bytes instead of filtering them: %s", async raw => {
    const storage = new MemoryStorage();
    storage.values.set(VOCAB_LIST_STORAGE_KEYS.bookmarks, raw);
    const before = new Map(storage.values);
    await expect(migrateVocabStorage(storage)).rejects.toMatchObject({ code: "record-format" });
    expect(storage.values).toEqual(before);
  });

  it("preserves a malformed original backup instead of normalizing away entries", async () => {
    const storage = new MemoryStorage();
    storage.values.set(VOCAB_STORAGE_BACKUP_KEY, JSON.stringify({ original: { bookmarks: [1, "2"], wrongWords: [], mastered: [] } }));
    const before = new Map(storage.values);
    await expect(migrateVocabStorage(storage)).rejects.toMatchObject({ code: "record-format" });
    expect(storage.values).toEqual(before);
  });

  it("uses one atomic comparison for lists, preserved originals and the version marker", async () => {
    const storage = new MemoryStorage() as MemoryStorage & Required<Pick<VocabStorageAdapter, "compareAndSet">>;
    storage.values.set(VOCAB_LIST_STORAGE_KEYS.bookmarks, "[1]");
    let transactions = 0;
    storage.compareAndSet = async changes => {
      transactions++;
      expect(changes.map(change => change.key).sort()).toEqual([
        ...Object.values(VOCAB_LIST_STORAGE_KEYS), VOCAB_STORAGE_BACKUP_KEY, VOCAB_STORAGE_VERSION_KEY,
      ].sort());
      for (const change of changes) expect(storage.values.get(change.key) ?? null).toBe(change.before);
      for (const change of changes) {
        if (change.after === null) storage.values.delete(change.key);
        else storage.values.set(change.key, change.after);
      }
    };
    storage.setItem = async () => { throw new Error("Must use transaction"); };
    storage.setItems = async () => { throw new Error("Must use transaction"); };
    await migrateVocabStorage(storage);
    expect(transactions).toBe(1);
    expect(storage.values.get(VOCAB_STORAGE_VERSION_KEY)).toBe(VOCAB_STORAGE_VERSION);
    expect(JSON.parse(storage.values.get(VOCAB_STORAGE_BACKUP_KEY)!).original.bookmarks).toEqual([1]);
  });

  it("preserves a concurrent edit and reports fixed conflict when atomic comparison rejects", async () => {
    const storage = new MemoryStorage() as MemoryStorage & Required<Pick<VocabStorageAdapter, "compareAndSet">>;
    storage.values.set(VOCAB_LIST_STORAGE_KEYS.bookmarks, "[1]");
    storage.compareAndSet = async changes => {
      expect(changes.find(change => change.key === VOCAB_LIST_STORAGE_KEYS.bookmarks)?.before).toBe("[1]");
      storage.values.set(VOCAB_LIST_STORAGE_KEYS.bookmarks, "[1,2]");
      throw Object.assign(new Error("private transaction detail"), { name: "LearningStorageConflictError" });
    };
    const error = await migrateVocabStorage(storage).catch(error => error);
    expect(error.code).toBe("recovery-conflict");
    expect(String(error)).not.toContain("private transaction detail");
    expect([...storage.values]).toEqual([[VOCAB_LIST_STORAGE_KEYS.bookmarks, "[1,2]"]]);
  });

  it("does not reinterpret already-versioned lists even if an old backup is present", async () => {
    const storage = new MemoryStorage();
    storage.values.set(VOCAB_STORAGE_VERSION_KEY, VOCAB_STORAGE_VERSION);
    storage.values.set(VOCAB_LIST_STORAGE_KEYS.bookmarks, "[999999]");
    storage.values.set(VOCAB_STORAGE_BACKUP_KEY, "{old-unreadable-backup");
    const before = new Map(storage.values);
    expect(await migrateVocabStorage(storage)).toBeNull();
    expect(storage.values).toEqual(before);
  });

  it("distinguishes blocked reads without exposing the original storage error or writing records", async () => {
    const storage = new MemoryStorage();
    storage.values.set(VOCAB_LIST_STORAGE_KEYS.bookmarks, "[1]");
    storage.getItem = async () => { throw Object.assign(new Error("private browser detail"), { name: "SecurityError" }); };
    const error = await migrateVocabStorage(storage).catch(error => error);
    expect(error.code).toBe("read-blocked");
    expect(getVocabStorageFailureMessage(error)).toContain("접근");
    expect(String(error)).not.toContain("private browser detail");
    expect([...storage.values]).toEqual([[VOCAB_LIST_STORAGE_KEYS.bookmarks, "[1]"]]);
  });

  it("preserves malformed source bytes and reports format failure, not storage-access failure", async () => {
    const storage = new MemoryStorage();
    storage.values.set(VOCAB_LIST_STORAGE_KEYS.bookmarks, "{broken");
    const before = new Map(storage.values);
    const error = await migrateVocabStorage(storage).catch(error => error);
    expect(error.code).toBe("record-format");
    expect(storage.values).toEqual(before);
  });

  it("reports quota failure while preserving originals and succeeds on an explicitly retried recovered adapter", async () => {
    const storage = new MemoryStorage();
    storage.values.set(VOCAB_LIST_STORAGE_KEYS.bookmarks, "[1]");
    const write = storage.setItem.bind(storage);
    storage.setItem = async () => { throw Object.assign(new Error("private quota detail"), { name: "QuotaExceededError" }); };
    const error = await migrateVocabStorage(storage).catch(error => error);
    expect(error.code).toBe("storage-full");
    expect(storage.values.get(VOCAB_LIST_STORAGE_KEYS.bookmarks)).toBe("[1]");
    expect(storage.values.has(VOCAB_STORAGE_VERSION_KEY)).toBe(false);
    storage.setItem = write;
    await migrateVocabStorage(storage);
    expect(storage.values.get(VOCAB_STORAGE_VERSION_KEY)).toBe(VOCAB_STORAGE_VERSION);
  });

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

  it("retries only known original or mapped lists from the original backup", async () => {
    const mappedLegacyNum = Number(Object.keys(VOCAB_META.legacyMigration.numMap)[0]);
    const mappedNum = VOCAB_META.legacyMigration.numMap[String(mappedLegacyNum)];
    const storage = new MemoryStorage();
    storage.values.set(VOCAB_LIST_STORAGE_KEYS.bookmarks, JSON.stringify([mappedLegacyNum]));
    await migrateVocabStorage(storage);

    storage.values.delete(VOCAB_STORAGE_VERSION_KEY);
    storage.values.set(VOCAB_LIST_STORAGE_KEYS.bookmarks, JSON.stringify([mappedLegacyNum]));
    await migrateVocabStorage(storage);

    expect(JSON.parse(storage.values.get(VOCAB_LIST_STORAGE_KEYS.bookmarks)!)).toEqual([mappedNum]);
  });

  it.each([false, true])("never accepts a new legacy-tab list as the baseline for stale-backup replay (atomic=%s)", async atomic => {
    const storage = new MemoryStorage() as MemoryStorage & Pick<VocabStorageAdapter, "compareAndSet">;
    storage.values.set(VOCAB_LIST_STORAGE_KEYS.bookmarks, "[1]");
    await migrateVocabStorage(storage);
    storage.values.delete(VOCAB_STORAGE_VERSION_KEY);
    storage.values.set(VOCAB_LIST_STORAGE_KEYS.bookmarks, "[1,999999]");
    const before = new Map(storage.values);
    let atomicCalls = 0;
    if (atomic) storage.compareAndSet = async changes => {
      atomicCalls++;
      for (const change of changes) {
        if (change.after === null) storage.values.delete(change.key);
        else storage.values.set(change.key, change.after);
      }
    };
    await expect(migrateVocabStorage(storage)).rejects.toMatchObject({ code: "recovery-conflict" });
    expect(atomicCalls).toBe(0);
    expect(storage.values).toEqual(before);
  });

  it("permits missing original-empty lists on resume but not missing nonempty originals mapped to empty", async () => {
    const storage = new MemoryStorage();
    const unresolved = VOCAB_META.legacyMigration.unresolvedNums[0];
    expect(unresolved).toBeDefined();
    storage.values.set(VOCAB_LIST_STORAGE_KEYS.bookmarks, JSON.stringify([unresolved]));
    await migrateVocabStorage(storage);
    storage.values.delete(VOCAB_STORAGE_VERSION_KEY);
    storage.values.delete(VOCAB_LIST_STORAGE_KEYS.wrongWords);
    storage.values.delete(VOCAB_LIST_STORAGE_KEYS.mastered);
    // The written empty bookmark list is a known mapped value; the other two
    // lists were originally empty and may still be absent after interruption.
    await migrateVocabStorage(storage);
    storage.values.delete(VOCAB_STORAGE_VERSION_KEY);
    storage.values.delete(VOCAB_LIST_STORAGE_KEYS.bookmarks);
    const before = new Map(storage.values);
    await expect(migrateVocabStorage(storage)).rejects.toMatchObject({ code: "recovery-conflict" });
    expect(storage.values).toEqual(before);
  });

  it("does not normalize a newly duplicated item away when resuming", async () => {
    const storage = new MemoryStorage();
    const originals = Object.keys(VOCAB_META.legacyMigration.numMap).slice(0, 2).map(Number);
    storage.values.set(VOCAB_LIST_STORAGE_KEYS.bookmarks, JSON.stringify(originals));
    await migrateVocabStorage(storage);
    storage.values.delete(VOCAB_STORAGE_VERSION_KEY);
    storage.values.set(VOCAB_LIST_STORAGE_KEYS.bookmarks, JSON.stringify([...originals, originals[0]]));
    const before = new Map(storage.values);
    await expect(migrateVocabStorage(storage)).rejects.toMatchObject({ code: "recovery-conflict" });
    expect(storage.values).toEqual(before);
  });
});
