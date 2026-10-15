import { describe, expect, it, vi } from "vitest";
vi.mock("@react-native-async-storage/async-storage", () => ({ default: {
  getItem: vi.fn(), setItem: vi.fn(), removeItem: vi.fn(), multiSet: vi.fn(),
} }));
import { createLearningStorageAdapter, INDEXED_LEARNING_KEYS, LearningStorageConflictError } from "../lib/learning-storage";

type RequestStub = { result?: unknown; onsuccess?: () => void; onerror?: () => void };

/** Small deterministic transaction double, not a claim of Safari/IDB coverage.
 * It serializes transactions and applies writes only on transaction completion. */
class MemoryDatabase {
  data = new Map<string, unknown>();
  queue: MemoryTransaction[] = [];
  failKey: string | undefined;
  pauseCommit = false;
  present = false;
  onversionchange?: () => void;
  onclose?: () => void;
  closed = false;
  objectStoreNames = { contains: () => this.present };
  createObjectStore() { this.present = true; }
  close() { this.closed = true; }
  transaction(_name: string, mode: string) {
    if (this.closed) throw new Error("closed");
    const tx = new MemoryTransaction(this, mode);
    this.queue.push(tx);
    if (this.queue.length === 1) queueMicrotask(() => tx.start());
    return tx;
  }
  finished(tx: MemoryTransaction) {
    this.queue = this.queue.filter(item => item !== tx);
    if (this.queue[0]) queueMicrotask(() => this.queue[0]?.start());
  }
}
class MemoryTransaction {
  oncomplete?: () => void;
  onabort?: () => void;
  onerror?: () => void;
  private working = new Map<string, unknown>();
  private jobs: (() => void)[] = [];
  private started = false;
  private ended = false;
  private pumping = false;
  constructor(private db: MemoryDatabase, private mode: string) {}
  start() {
    if (this.started || this.ended) return;
    this.started = true; this.working = new Map(this.db.data); this.pump();
  }
  private request(action: () => unknown): RequestStub {
    const request: RequestStub = {};
    this.jobs.push(() => {
      try { request.result = action(); request.onsuccess?.(); }
      catch { request.onerror?.(); this.onerror?.(); this.abort(); }
    });
    if (this.started) this.pump();
    return request;
  }
  private pump() {
    if (this.pumping || this.ended) return;
    this.pumping = true;
    queueMicrotask(() => {
      this.pumping = false;
      if (this.ended) return;
      const next = this.jobs.shift();
      if (next) { next(); this.pump(); }
      else if (!this.db.pauseCommit) this.commit();
    });
  }
  commit() {
    if (this.ended || !this.started || this.jobs.length) return;
    this.ended = true;
    if (this.mode === "readwrite") this.db.data = new Map(this.working);
    this.oncomplete?.(); this.db.finished(this);
  }
  abort() {
    if (this.ended) throw new Error("ended");
    this.ended = true; this.onabort?.(); this.db.finished(this);
  }
  objectStore() {
    return {
      get: (key: string) => this.request(() => this.working.get(key)),
      getAllKeys: () => this.request(() => [...this.working.keys()]),
      put: (value: unknown, key: string) => this.request(() => {
        if (key === this.db.failKey) throw new Error("quota");
        this.working.set(key, structuredClone(value));
      }),
      delete: (key: string) => this.request(() => this.working.delete(key)),
    };
  }
}

const STATS = "vocaknio_stats";
const WRONG = "vocaknio_wrong_words";
function fixture() {
  const raw = new Map<string, string>();
  const db = new MemoryDatabase();
  let openFailure = false;
  let blocked = false;
  let opens = 0;
  const legacy = {
    getItem: vi.fn(async (key: string) => raw.get(key) ?? null),
    setItem: vi.fn(async (key: string, value: string) => { raw.set(key, value); }),
    removeItem: vi.fn(async (key: string) => { raw.delete(key); }),
    multiSet: vi.fn(async (entries: [string, string][]) => { for (const [key, value] of entries) raw.set(key, value); }),
  };
  const factory = { open: () => {
    opens++;
    const request: { result: MemoryDatabase; onupgradeneeded?: () => void; onsuccess?: () => void; onerror?: () => void; onblocked?: () => void } = { result: db };
    queueMicrotask(() => {
      if (blocked) { request.onblocked?.(); return; }
      if (openFailure) { request.onerror?.(); return; }
      db.closed = false;
      if (!db.present) request.onupgradeneeded?.();
      request.onsuccess?.();
    });
    return request;
  } } as unknown as IDBFactory;
  const env = { indexedDB: factory, readLegacy: (key: string) => raw.get(key) ?? null };
  const adapter = createLearningStorageAdapter(legacy, () => env);
  return { adapter, db, raw, legacy, env, opens: () => opens,
    failOpen: (value: boolean) => { openFailure = value; }, blocked: (value: boolean) => { blocked = value; } };
}

describe("web learning storage adapter", () => {
  it("copies exact raw bytes and nulls atomically without editing legacy records", async () => {
    const f = fixture(); f.raw.set(STATS, " { broken but preserved }"); f.raw.set(WRONG, "[1, 2]");
    expect(await f.adapter.getItem(STATS)).toBe(" { broken but preserved }");
    const original = await f.adapter.exportMigrationOriginalBackup();
    expect(original?.[STATS]).toBe(f.raw.get(STATS));
    expect(Object.keys(original!)).toHaveLength(INDEXED_LEARNING_KEYS.length);
    expect(original?.vocaknio_mastered).toBeNull();
    await f.adapter.setItem(STATS, "new");
    expect(await f.adapter.getItem(STATS)).toBe("new");
    expect(f.raw.get(STATS)).toBe(" { broken but preserved }");
    expect((await f.adapter.exportMigrationOriginalBackup())?.[STATS]).toBe(" { broken but preserved }");
    expect(f.legacy.setItem).not.toHaveBeenCalled();
    expect(f.legacy.removeItem).not.toHaveBeenCalled();
  });

  it("rolls back failed migration including marker and backup, then permits retry", async () => {
    const f = fixture(); f.raw.set(STATS, "original"); f.db.failKey = STATS;
    await expect(f.adapter.getItem(STATS)).rejects.toThrow();
    expect(f.db.data.size).toBe(0); expect(f.raw.get(STATS)).toBe("original");
    f.db.failKey = undefined;
    expect(await f.adapter.getItem(STATS)).toBe("original");
  });

  it("rejects legacy mutations and preserves both legacy and migration originals", async () => {
    const f = fixture(); f.raw.set(STATS, "old"); await f.adapter.getItem(STATS);
    f.raw.set(STATS, "old-tab-newer");
    await expect(f.adapter.setItem(STATS, "stale-new-tab")).rejects.toBeInstanceOf(LearningStorageConflictError);
    await expect(f.adapter.getItem(STATS)).rejects.toBeInstanceOf(LearningStorageConflictError);
    expect(f.db.data.get(STATS)).toBe("old"); expect(f.raw.get(STATS)).toBe("old-tab-newer");
    expect((await f.adapter.exportLegacyLearningBackup()).records[STATS]).toBe("old-tab-newer");
    expect((await f.adapter.exportMigrationOriginalBackup())?.[STATS]).toBe("old");
    expect((await f.adapter.exportCurrentIndexedBackup())?.[STATS]).toBe("old");
  });

  it("rejects a legacy change between the two initial byte snapshots", async () => {
    const f = fixture(); let reads = 0;
    f.env.readLegacy = key => {
      if (key === STATS) return ++reads === 1 ? "before" : "after";
      return null;
    };
    await expect(f.adapter.getItem(STATS)).rejects.toBeInstanceOf(LearningStorageConflictError);
    expect(f.db.data.size).toBe(0);
  });

  it("does not overwrite a database containing records without a migration marker", async () => {
    const f = fixture(); f.db.present = true; f.db.data.set(STATS, "unmarked-but-preserve");
    await expect(f.adapter.getItem(STATS)).rejects.toThrow("migration-marker-missing");
    expect(f.db.data.get(STATS)).toBe("unmarked-but-preserve");
  });

  it("compares every key before atomically writing or removing any CAS value", async () => {
    const f = fixture(); f.raw.set(STATS, "0"); f.raw.set(WRONG, "[]"); await f.adapter.getItem(STATS);
    await f.adapter.compareAndSet!([{ key: STATS, before: "0", after: "1" }, { key: WRONG, before: "[]", after: "[5]" }]);
    await expect(f.adapter.compareAndSet!([{ key: STATS, before: "0", after: "2" }, { key: WRONG, before: "[5]", after: null }])).rejects.toBeInstanceOf(LearningStorageConflictError);
    expect(await f.adapter.readSnapshot([STATS, WRONG])).toEqual({ [STATS]: "1", [WRONG]: "[5]" });
    await f.adapter.compareAndSet!([{ key: WRONG, before: "[5]", after: null }]);
    expect(await f.adapter.getItem(WRONG)).toBeNull(); expect(f.raw.get(WRONG)).toBe("[]");
  });

  it("allows only one concurrent CAS writer to claim the same before value", async () => {
    const f = fixture(); f.raw.set(STATS, "0"); await f.adapter.getItem(STATS);
    const results = await Promise.allSettled([1, 2].map(n => f.adapter.compareAndSet!([{ key: STATS, before: "0", after: String(n) }])));
    expect(results.filter(result => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter(result => result.status === "rejected")).toHaveLength(1);
  });

  it("waits for commit and rolls back an entire multi-key write on abort", async () => {
    const f = fixture(); await f.adapter.getItem(STATS);
    f.db.pauseCommit = true;
    let resolved = false;
    const pending = f.adapter.multiSet([[STATS, "new"], [WRONG, "[1]"]]).then(() => { resolved = true; });
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(resolved).toBe(false); expect(f.db.data.has(STATS)).toBe(false);
    f.db.pauseCommit = false; f.db.queue[0].commit(); await pending;
    f.db.failKey = WRONG;
    await expect(f.adapter.multiSet([[STATS, "bad"], [WRONG, "bad"]])).rejects.toThrow();
    expect(f.db.data.get(STATS)).toBe("new"); expect(f.db.data.get(WRONG)).toBe("[1]");
  });

  it("never falls back on unavailable/failed/blocked IndexedDB and retries failed opens", async () => {
    const f = fixture(); f.raw.set(STATS, "legacy");
    f.failOpen(true); await expect(f.adapter.getItem(STATS)).rejects.toThrow("indexeddb-open-failed");
    expect(f.legacy.getItem).not.toHaveBeenCalled();
    f.failOpen(false); f.blocked(true); await expect(f.adapter.getItem(STATS)).rejects.toThrow("indexeddb-open-blocked");
    f.blocked(false); expect(await f.adapter.getItem(STATS)).toBe("legacy"); expect(f.opens()).toBe(3);
    const noIdb = createLearningStorageAdapter(f.legacy, () => ({ ...f.env, indexedDB: undefined }));
    await expect(noIdb.getItem(STATS)).rejects.toThrow("indexeddb-unavailable");
  });

  it("keeps theme/settings on legacy storage and rejects mixed batches before writes", async () => {
    const f = fixture(); await f.adapter.setItem("vocaknio_quiz_settings", "settings");
    expect(f.legacy.setItem).toHaveBeenCalledWith("vocaknio_quiz_settings", "settings"); expect(f.opens()).toBe(0);
    await expect(f.adapter.multiSet([[STATS, "x"], ["vocaknio_quiz_settings", "y"]])).rejects.toThrow("mixed-storage-batch");
    expect(f.opens()).toBe(0); expect(f.raw.get("vocaknio_quiz_settings")).toBe("settings");
  });

  it("native/SSR exposes no atomic CAS capability and retains existing storage", async () => {
    const f = fixture(); const native = createLearningStorageAdapter(f.legacy, () => null);
    expect(native.compareAndSet).toBeUndefined(); await native.setItem(STATS, "native");
    expect(await native.getItem(STATS)).toBe("native"); expect(f.opens()).toBe(0);
  });

  it("classifies permission and quota errors without exposing native messages", async () => {
    const f = fixture();
    f.env.readLegacy = () => { throw Object.assign(new Error("private browser details"), { name: "SecurityError" }); };
    await expect(f.adapter.getItem(STATS)).rejects.toMatchObject({ code: "permission", message: "permission" });
    const quota = createLearningStorageAdapter(f.legacy, () => ({
      indexedDB: { open: () => { throw Object.assign(new Error("private quota details"), { name: "QuotaExceededError" }); } } as unknown as IDBFactory,
      readLegacy: () => null,
    }));
    await expect(quota.getItem(STATS)).rejects.toMatchObject({ code: "quota", message: "quota" });
  });

  it("aborts pending writes on versionchange instead of claiming a successful commit", async () => {
    const f = fixture(); await f.adapter.getItem(STATS); f.db.pauseCommit = true;
    const pending = f.adapter.setItem(STATS, "not-committed");
    const rejected = expect(pending).rejects.toThrow();
    await new Promise(resolve => setTimeout(resolve, 0));
    f.db.onversionchange?.(); await rejected;
    expect(f.db.data.has(STATS)).toBe(false); expect(f.db.closed).toBe(true);
  });
});
