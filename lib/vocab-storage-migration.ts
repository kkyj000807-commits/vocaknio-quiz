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

export type VocabStorageFailure = "read-blocked" | "read-failed" | "storage-full" | "write-failed" | "record-format" | "recovery-conflict" | "recovery-unreadable" | "recovery-failed";

/** Only a fixed code crosses the UI boundary; never retain raw browser errors. */
export class VocabStorageError extends Error {
  constructor(readonly code: VocabStorageFailure) {
    super(code);
    this.name = "VocabStorageError";
  }
}

export function getVocabStorageFailureMessage(error: unknown): string {
  if (!(error instanceof VocabStorageError)) return "시작 단계의 기록 확인을 완료하지 못했습니다. 원본을 유지하고 다시 시도해 주세요. (STARTUP)";
  const messages: Record<VocabStorageFailure, string> = {
    "read-blocked": "브라우저가 이 사이트의 저장소 접근을 거부했습니다. 같은 Safari의 일반 탭에서 공식 주소를 열어 주세요. 웹사이트 데이터는 삭제하지 마세요. (READ_BLOCKED)",
    "read-failed": "브라우저 저장소를 읽지 못했습니다. 데이터 손상 여부는 아직 확인되지 않았습니다. 다시 시도해 주세요. (READ_FAILED)",
    "storage-full": "브라우저가 저장 공간 부족 오류를 반환했습니다. 기존 기록을 삭제하지 말고 먼저 백업 파일을 보관해 주세요. (STORAGE_FULL)",
    "write-failed": "이전 기록을 보존하는 변환 작업의 저장을 완료하지 못했습니다. 원본 백업을 유지하고 다시 시도해 주세요. (WRITE_FAILED)",
    "record-format": "기존 목록 또는 변환 백업의 형식을 읽을 수 없습니다. 자동 초기화를 중단했습니다. 복구용 백업과 이 안내 코드를 보관해 주세요. (RECORD_FORMAT)",
    "recovery-conflict": "미완료 저장과 현재 기록이 충돌합니다. 어느 기록도 임의로 선택하지 않았습니다. 복구용 백업을 먼저 보관해 주세요. (RECOVERY_CONFLICT)",
    "recovery-unreadable": "미완료 저장의 복구 정보를 해석할 수 없습니다. 원본을 유지했으며 복구용 백업이 필요합니다. (RECOVERY_FORMAT)",
    "recovery-failed": "미완료 저장의 확인·복구를 완료하지 못했습니다. 저장소 접근 또는 저장 실패일 수 있습니다. 다시 시도하거나 복구용 백업을 보관해 주세요. (RECOVERY_FAILED)",
  };
  return messages[error.code];
}

async function storageOperation<T>(operation: () => Promise<T>, read: boolean): Promise<T> {
  try { return await operation(); }
  catch (error) {
    const name = error && typeof error === "object" && "name" in error ? error.name : "";
    throw new VocabStorageError(read ? (name === "SecurityError" || name === "NotAllowedError" ? "read-blocked" : "read-failed")
      : name === "QuotaExceededError" ? "storage-full" : "write-failed");
  }
}

export interface VocabStorageAdapter {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  setItems(entries: [string, string][]): Promise<void>;
  /** Resolves only after an atomic comparison/write transaction commits. */
  compareAndSet?(changes: { key: string; before: string | null; after: string | null }[]): Promise<void>;
}

function parseNumberList(raw: string | null, key: string): number[] {
  if (raw === null) return [];
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed) || !parsed.every(value => Number.isInteger(value) && value > 0))
    throw new Error(`${key} is not a number array`);
  return parsed;
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
    !Array.isArray(original.mastered) ||
    ![original.bookmarks, original.wrongWords, original.mastered].every(
      list => list.every(value => Number.isInteger(value) && value > 0),
    )
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
  const guarded: VocabStorageAdapter = {
    getItem: key => storageOperation(() => storage.getItem(key), true),
    setItem: (key, value) => storageOperation(() => storage.setItem(key, value), false),
    setItems: entries => storageOperation(() => storage.setItems(entries), false),
    ...(storage.compareAndSet ? { compareAndSet: async (changes: { key: string; before: string | null; after: string | null }[]) => {
      try { await storage.compareAndSet!(changes); }
      catch (error) {
        if (error && typeof error === "object" && "name" in error && error.name === "LearningStorageConflictError")
          throw new VocabStorageError("recovery-conflict");
        await storageOperation(async () => { throw error; }, false);
      }
    } } : {}),
  };
  try { return await migrateVocabStorageUnsafe(guarded); }
  catch (error) {
    if (error instanceof VocabStorageError) throw error;
    throw new VocabStorageError("record-format");
  }
}

async function migrateVocabStorageUnsafe(storage: VocabStorageAdapter): Promise<VocabMigrationResult | null> {
  const currentVersion = await storage.getItem(VOCAB_STORAGE_VERSION_KEY);
  if (currentVersion === VOCAB_STORAGE_VERSION) return null;

  const storedBackup = await storage.getItem(VOCAB_STORAGE_BACKUP_KEY);
  const listKeys = Object.values(VOCAB_LIST_STORAGE_KEYS);
  const originals = await Promise.all(listKeys.map(key => storage.getItem(key)));
  let backup: VocabMigrationResult;

  if (storedBackup !== null) {
    backup = parseBackup(storedBackup);
    // A current value is not automatically a safe CAS baseline: a legacy tab
    // may have edited it since this backup was captured. Resume only values
    // attributable to this migration, without merging or normalizing records.
    for (const [index, name] of (Object.keys(VOCAB_LIST_STORAGE_KEYS) as (keyof LegacyVocabLists)[]).entries()) {
      const raw = originals[index];
      const original = backup.original[name];
      if (raw === null) {
        // An absent originally-empty key may not have been written yet. A
        // nonempty original mapped to [] does NOT explain a missing key.
        if (original.length !== 0) throw new VocabStorageError("recovery-conflict");
        continue;
      }
      const current = parseNumberList(raw, listKeys[index]);
      const matches = (expected: number[]) => current.length === expected.length && current.every((value, position) => value === expected[position]);
      if (!matches(original) && !matches(backup.lists[name].mapped)) throw new VocabStorageError("recovery-conflict");
    }
  } else {
    const [bookmarks, wrongWords, mastered] = originals;
    backup = buildVocabMigrationBackup({
      bookmarks: parseNumberList(bookmarks, VOCAB_LIST_STORAGE_KEYS.bookmarks),
      wrongWords: parseNumberList(wrongWords, VOCAB_LIST_STORAGE_KEYS.wrongWords),
      mastered: parseNumberList(mastered, VOCAB_LIST_STORAGE_KEYS.mastered),
    });
  }

  const backupRaw = storedBackup ?? JSON.stringify(backup);
  const entries: [string, string][] = [
    [VOCAB_LIST_STORAGE_KEYS.bookmarks, JSON.stringify(backup.lists.bookmarks.mapped)],
    [VOCAB_LIST_STORAGE_KEYS.wrongWords, JSON.stringify(backup.lists.wrongWords.mapped)],
    [VOCAB_LIST_STORAGE_KEYS.mastered, JSON.stringify(backup.lists.mastered.mapped)],
  ];
  if (storage.compareAndSet) {
    await storage.compareAndSet([
      ...entries.map(([key, after], index) => ({ key, before: originals[index], after })),
      { key: VOCAB_STORAGE_BACKUP_KEY, before: storedBackup, after: backupRaw },
      { key: VOCAB_STORAGE_VERSION_KEY, before: currentVersion, after: VOCAB_STORAGE_VERSION },
    ]);
  } else {
    // Legacy backends can partially succeed. Preserve originals first and never
    // place the version marker in a non-atomic multiSet with the learner lists.
    if (storedBackup === null) await storage.setItem(VOCAB_STORAGE_BACKUP_KEY, backupRaw);
    if (await storage.getItem(VOCAB_STORAGE_BACKUP_KEY) !== backupRaw) throw new VocabStorageError("write-failed");
    await storage.setItems(entries);
    for (const [key, expected] of entries) {
      if (await storage.getItem(key) !== expected) throw new VocabStorageError("write-failed");
    }
    await storage.setItem(VOCAB_STORAGE_VERSION_KEY, VOCAB_STORAGE_VERSION);
  }
  // Adapter acknowledgement is not proof of persisted data on every backend.
  for (const [key, expected] of [...entries, [VOCAB_STORAGE_BACKUP_KEY, backupRaw], [VOCAB_STORAGE_VERSION_KEY, VOCAB_STORAGE_VERSION]]) {
    if (await storage.getItem(key) !== expected) throw new VocabStorageError("write-failed");
  }

  return backup;
}
