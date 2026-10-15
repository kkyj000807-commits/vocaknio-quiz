import AsyncStorage from "@react-native-async-storage/async-storage";

/** These are the existing store/journal/migration keys, not a key-prefix scan.
 * Settings and theme deliberately remain on the existing AsyncStorage path. */
export const INDEXED_LEARNING_KEYS = [
  "vocaknio_stats", "vocaknio_bookmarks", "vocaknio_wrong_words", "vocaknio_mastered",
  "vocaknio_study_time", "vocaknio_adaptive_quiz_history_v1", "vocaknio_sense_learning_state_v1",
  "vocaknio_problem_session_v1", "vocaknio_problem_session_archive_v1",
  "vocaknio_learning_write_journal_v1", "vocaknio_vocab_storage_version",
  "vocaknio_vocab_v1_4_migration_backup",
] as const;
export const LEARNING_DATABASE_NAME = "finetune_learning_v1";
const RECORDS = "records";
const MARKER = "__finetune_idb_migration_v1__";
const BASELINE = "__finetune_legacy_baseline_v1__";
const ORIGINAL = "__finetune_legacy_original_v1__";
const allowed = new Set<string>(INDEXED_LEARNING_KEYS);
type Snapshot = Record<string, string | null>;
export interface LearningStorageChange { key: string; before: string | null; after: string | null }
interface LegacyStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
  multiSet(entries: [string, string][]): Promise<void>;
}
export interface LearningWebEnvironment {
  indexedDB: IDBFactory | undefined;
  readLegacy(key: string): string | null;
}

export class LearningStorageConflictError extends Error {
  constructor() { super("learning-storage-conflict"); this.name = "LearningStorageConflictError"; }
}
export class LearningStorageError extends Error {
  constructor(readonly code: string) { super(code); this.name = "LearningStorageError"; }
}
function storageError(error: unknown, fallback: string): LearningStorageError {
  const name = error && typeof error === "object" && "name" in error ? error.name : undefined;
  return new LearningStorageError(name === "QuotaExceededError" ? "quota"
    : name === "SecurityError" || name === "NotAllowedError" ? "permission" : fallback);
}
function safeFailure(error: unknown): Error {
  return error instanceof LearningStorageError || error instanceof LearningStorageConflictError
    ? error : storageError(error, "indexeddb-request-failed");
}

function webEnvironment(): LearningWebEnvironment | null {
  if (typeof window === "undefined") return null;
  try { return { indexedDB: window.indexedDB, readLegacy: key => window.localStorage.getItem(key) }; }
  catch (error) { throw storageError(error, "indexeddb-access-failed"); }
}

function snapshot(env: LearningWebEnvironment): Snapshot {
  const values: Snapshot = {};
  try {
    for (const key of INDEXED_LEARNING_KEYS) values[key] = env.readLegacy(key);
  } catch (error) { throw storageError(error, "legacy-read-failed"); }
  return values;
}
function validSnapshot(value: unknown): value is Snapshot {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Snapshot;
  return Object.keys(record).length === INDEXED_LEARNING_KEYS.length
    && INDEXED_LEARNING_KEYS.every(key => Object.hasOwn(record, key) && (record[key] === null || typeof record[key] === "string"));
}
function assertLegacy(env: LearningWebEnvironment, baseline: Snapshot): void {
  const current = snapshot(env);
  if (INDEXED_LEARNING_KEYS.some(key => current[key] !== baseline[key])) throw new LearningStorageConflictError();
}

/** Injectable only to test the same adapter without touching learner storage. */
export function createLearningStorageAdapter(
  legacy: LegacyStorage = AsyncStorage,
  environment: () => LearningWebEnvironment | null = webEnvironment,
) {
  let opening: Promise<IDBDatabase> | undefined;
  let ready: Promise<IDBDatabase> | undefined;
  const transactions = new Set<IDBTransaction>();

  function open(env: LearningWebEnvironment): Promise<IDBDatabase> {
    if (opening) return opening;
    const promise = new Promise<IDBDatabase>((resolve, reject) => {
      if (!env.indexedDB) { reject(new LearningStorageError("indexeddb-unavailable")); return; }
      let finished = false;
      let request: IDBOpenDBRequest;
      const fail = (reason: string | LearningStorageError) => {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        reject(typeof reason === "string" ? new LearningStorageError(reason) : reason);
      };
      const timer = setTimeout(() => fail("indexeddb-open-timeout"), 10000);
      try { request = env.indexedDB.open(LEARNING_DATABASE_NAME, 1); }
      catch (error) { fail(storageError(error, "indexeddb-open-failed")); return; }
      request.onblocked = () => fail("indexeddb-open-blocked");
      request.onerror = () => fail(storageError(request.error, "indexeddb-open-failed"));
      request.onupgradeneeded = () => {
        if (finished) { request.transaction?.abort(); return; }
        if (!request.result.objectStoreNames.contains(RECORDS)) request.result.createObjectStore(RECORDS);
      };
      request.onsuccess = () => {
        if (finished) { request.result.close(); return; }
        finished = true;
        clearTimeout(timer);
        const db = request.result;
        if (!db.objectStoreNames.contains(RECORDS)) {
          db.close(); reject(new LearningStorageError("indexeddb-schema-unreadable")); return;
        }
        db.onversionchange = () => {
          // A new schema must not silently use this adapter's old assumptions.
          opening = undefined; ready = undefined;
          for (const tx of transactions) { try { tx.abort(); } catch { /* already ended */ } }
          db.close();
        };
        db.onclose = () => { opening = undefined; ready = undefined; };
        resolve(db);
      };
    });
    opening = promise;
    void promise.catch(() => { if (opening === promise) opening = undefined; });
    return promise;
  }

  function transact<T>(db: IDBDatabase, mode: IDBTransactionMode,
    body: (store: IDBObjectStore, completeValue: (value: T) => void, abort: (error: Error) => void) => void,
    beforeResolve?: () => void): Promise<T> {
    return new Promise((resolve, reject) => {
      let tx: IDBTransaction;
      try { tx = db.transaction(RECORDS, mode); }
      catch (error) { opening = undefined; ready = undefined; reject(storageError(error, "indexeddb-transaction-failed")); return; }
      transactions.add(tx);
      let value: T;
      let hasValue = false;
      let failure: Error | undefined;
      const abort = (error: Error) => {
        failure = error;
        try { tx.abort(); } catch { clearTimeout(timer); transactions.delete(tx); reject(error); }
      };
      const timer = setTimeout(() => abort(new LearningStorageError("indexeddb-transaction-timeout")), 10000);
      tx.onabort = () => { clearTimeout(timer); transactions.delete(tx); reject(failure ?? storageError(tx.error, "indexeddb-transaction-aborted")); };
      tx.onerror = () => { failure ??= storageError(tx.error, "indexeddb-request-failed"); };
      tx.oncomplete = () => {
        clearTimeout(timer);
        transactions.delete(tx);
        try {
          // Legacy tabs cannot participate in an IDB transaction. If they wrote
          // during it, report conflict; never replace their raw localStorage.
          beforeResolve?.();
          if (!hasValue) throw new LearningStorageError("indexeddb-incomplete-operation");
          resolve(value);
        } catch (error) { reject(safeFailure(error)); }
      };
      try { body(tx.objectStore(RECORDS), result => { value = result; hasValue = true; }, abort); }
      catch (error) { abort(safeFailure(error)); }
    });
  }

  function initialize(env: LearningWebEnvironment): Promise<IDBDatabase> {
    if (ready) return ready;
    const promise = open(env).then(async db => {
      let baseline: Snapshot | undefined;
      await transact<void>(db, "readwrite", (store, done, abort) => {
        const request = store.get(MARKER);
        request.onsuccess = () => {
          try {
            if (request.result !== undefined) {
              if (request.result !== 1) throw new LearningStorageError("migration-marker-unreadable");
              const read = store.get(BASELINE);
              read.onsuccess = () => {
                try {
                  if (!validSnapshot(read.result)) throw new LearningStorageError("migration-baseline-unreadable");
                  baseline = read.result; assertLegacy(env, baseline); done(undefined);
                } catch (error) { abort(safeFailure(error)); }
              };
              return;
            }
            const keys = store.getAllKeys();
            keys.onsuccess = () => {
              try {
                // Partial/tampered DBs are not a license to overwrite records.
                if (keys.result.length) throw new LearningStorageError("migration-marker-missing");
                baseline = snapshot(env);
                assertLegacy(env, baseline); // second byte-for-byte read
                for (const key of INDEXED_LEARNING_KEYS) if (baseline[key] !== null) store.put(baseline[key], key);
                store.put(baseline, ORIGINAL);
                store.put(baseline, BASELINE);
                store.put(1, MARKER);
                done(undefined);
              } catch (error) { abort(safeFailure(error)); }
            };
          } catch (error) { abort(safeFailure(error)); }
        };
      }, () => { if (baseline) assertLegacy(env, baseline); });
      return db;
    });
    ready = promise;
    void promise.catch(() => { if (ready === promise) ready = undefined; });
    return promise;
  }

  async function withBaseline<T>(env: LearningWebEnvironment, mode: IDBTransactionMode,
    action: (store: IDBObjectStore, done: (value: T) => void, abort: (error: Error) => void) => void): Promise<T> {
    const db = await initialize(env);
    let baseline: Snapshot | undefined;
    return transact<T>(db, mode, (store, done, abort) => {
      const request = store.get(BASELINE);
      request.onsuccess = () => {
        try {
          if (!validSnapshot(request.result)) throw new LearningStorageError("migration-baseline-unreadable");
          baseline = request.result; assertLegacy(env, baseline);
          action(store, done, abort);
        } catch (error) { abort(safeFailure(error)); }
      };
    }, () => { if (baseline) assertLegacy(env, baseline); });
  }

  function validateChanges(changes: LearningStorageChange[]): void {
    const seen = new Set<string>();
    for (const change of changes) {
      if (!allowed.has(change.key) || seen.has(change.key)
        || !(change.before === null || typeof change.before === "string")
        || !(change.after === null || typeof change.after === "string")) throw new LearningStorageError("invalid-atomic-change");
      seen.add(change.key);
    }
  }

  async function atomicCompare(changes: LearningStorageChange[]): Promise<void> {
    const env = environment();
    if (!env) throw new LearningStorageError("atomic-storage-unavailable");
    validateChanges(changes);
    if (!changes.length) return;
    await withBaseline<void>(env, "readwrite", (store, done, abort) => {
      let remaining = changes.length;
      for (const change of changes) {
        const read = store.get(change.key);
        read.onsuccess = () => {
          if ((read.result ?? null) !== change.before) { abort(new LearningStorageConflictError()); return; }
          if (--remaining !== 0) return;
          try {
            for (const entry of changes) {
              if (entry.after === null) store.delete(entry.key);
              else store.put(entry.after, entry.key);
            }
            done(undefined);
          } catch (error) { abort(safeFailure(error)); }
        };
      }
    });
  }

  const adapter = {
    get compareAndSet(): ((changes: LearningStorageChange[]) => Promise<void>) | undefined {
      return environment() ? atomicCompare : undefined;
    },
    async readSnapshot(keys: readonly string[]): Promise<Snapshot> {
      if (keys.some(key => !allowed.has(key)) || new Set(keys).size !== keys.length) throw new LearningStorageError("invalid-snapshot-keys");
      if (!keys.length) return {};
      const env = environment();
      if (!env) {
        const values: Snapshot = {};
        for (const key of keys) values[key] = await legacy.getItem(key);
        return values;
      }
      return withBaseline<Snapshot>(env, "readonly", (store, done, abort) => {
        const values: Snapshot = {};
        let remaining = keys.length;
        for (const key of keys) {
          const read = store.get(key);
          read.onsuccess = () => {
            if (read.result !== undefined && typeof read.result !== "string") {
              abort(new LearningStorageError("learning-record-unreadable")); return;
            }
            values[key] = read.result ?? null;
            if (--remaining === 0) done(values);
          };
        }
      });
    },
    async getItem(key: string): Promise<string | null> {
      const env = allowed.has(key) ? environment() : null;
      if (!env) return legacy.getItem(key);
      return withBaseline<string | null>(env, "readonly", (store, done, abort) => {
        const request = store.get(key);
        request.onsuccess = () => {
          if (request.result !== undefined && typeof request.result !== "string") {
            abort(new LearningStorageError("learning-record-unreadable")); return;
          }
          done(request.result ?? null);
        };
      });
    },
    async setItem(key: string, value: string): Promise<void> {
      if (typeof value !== "string") throw new LearningStorageError("invalid-learning-value");
      const env = allowed.has(key) ? environment() : null;
      if (!env) return legacy.setItem(key, value);
      await withBaseline<void>(env, "readwrite", (store, done) => { store.put(value, key); done(undefined); });
    },
    async removeItem(key: string): Promise<void> {
      const env = allowed.has(key) ? environment() : null;
      if (!env) return legacy.removeItem(key);
      await withBaseline<void>(env, "readwrite", (store, done) => { store.delete(key); done(undefined); });
    },
    async multiSet(entries: [string, string][]): Promise<void> {
      if (!entries.length) return;
      if (entries.some(([key, value]) => typeof key !== "string" || typeof value !== "string")) throw new LearningStorageError("invalid-learning-value");
      const env = environment();
      if (!env || entries.every(([key]) => !allowed.has(key))) return legacy.multiSet(entries);
      // Mixed backends cannot be one atomic operation. Reject before any write.
      if (entries.some(([key]) => !allowed.has(key))) throw new LearningStorageError("mixed-storage-batch");
      await withBaseline<void>(env, "readwrite", (store, done) => {
        for (const [key, value] of entries) store.put(value, key);
        done(undefined);
      });
    },
    /** Explicit recovery source, never a successful-IDB-read fallback. */
    async exportLegacyLearningBackup(): Promise<{ source: "legacy-localStorage" | "native-async-storage"; records: Snapshot }> {
      const env = environment();
      if (env) return { source: "legacy-localStorage", records: snapshot(env) };
      const records: Snapshot = {};
      for (const key of INDEXED_LEARNING_KEYS) records[key] = await legacy.getItem(key);
      return { source: "native-async-storage", records };
    },
    /** Read the immutable migration copy even when a legacy-tab conflict blocks normal reads. */
    async exportMigrationOriginalBackup(): Promise<Snapshot | null> {
      const env = environment();
      if (!env) return null;
      const db = await open(env);
      return transact<Snapshot | null>(db, "readonly", (store, done, abort) => {
        const read = store.get(ORIGINAL);
        read.onsuccess = () => {
          if (read.result === undefined) { done(null); return; }
          if (!validSnapshot(read.result)) { abort(new LearningStorageError("migration-original-unreadable")); return; }
          done(read.result);
        };
      });
    },
    /** Explicit recovery source: current IDB bytes, even if an old tab changed
     * legacy storage. Never substitute this for normal validated learning reads. */
    async exportCurrentIndexedBackup(): Promise<Snapshot | null> {
      const env = environment();
      if (!env) return null;
      const db = await open(env);
      return transact<Snapshot | null>(db, "readonly", (store, done, abort) => {
        const marker = store.get(MARKER);
        marker.onsuccess = () => {
          if (marker.result === undefined) { done(null); return; }
          if (marker.result !== 1) { abort(new LearningStorageError("migration-marker-unreadable")); return; }
          const records: Snapshot = {};
          let remaining = INDEXED_LEARNING_KEYS.length;
          for (const key of INDEXED_LEARNING_KEYS) {
            const read = store.get(key);
            read.onsuccess = () => {
              if (read.result !== undefined && typeof read.result !== "string") {
                abort(new LearningStorageError("learning-record-unreadable")); return;
              }
              records[key] = read.result ?? null;
              if (--remaining === 0) done(records);
            };
          }
        };
      });
    },
  };
  return adapter;
}
