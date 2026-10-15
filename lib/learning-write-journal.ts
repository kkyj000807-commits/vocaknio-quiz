// Additive recovery record: existing learner keys and values stay unchanged.
export const LEARNING_WRITE_JOURNAL_KEY = "vocaknio_learning_write_journal_v1";
export interface LearningStorageAdapter {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
  multiSet(entries: [string, string][]): Promise<void>;
  /** Only exposed by a backend with a real atomic transaction. */
  compareAndSet?(changes: { key: string; before: string | null; after: string | null }[]): Promise<void>;
}
type Change = { key: string; before: string | null; after: string };
export type JournalStatus = "clear" | "recovered" | "conflict" | "unreadable" | "failed";

export function parseLearningJournal(raw: string, allowedKeys: readonly string[], validate: (key: string, raw: string) => void): Change[] {
  const data = JSON.parse(raw);
  if (data?.version !== 1 || !Array.isArray(data.changes) || !data.changes.length || data.changes.length > allowedKeys.length)
    throw new Error("Invalid recovery record");
  const seen = new Set<string>();
  for (const change of data.changes) {
    if (!change || !allowedKeys.includes(change.key) || seen.has(change.key) ||
        !(change.before === null || typeof change.before === "string") || typeof change.after !== "string")
      throw new Error("Invalid recovery record");
    seen.add(change.key);
    validate(change.key, change.after);
    if (change.before !== null) validate(change.key, change.before);
  }
  return data.changes;
}

/** Replay exact bytes only when every key still matches the before/after pair.
 * Never merge counters or replay answer events: retries must not double-score.
 * Call under the shared web lock when supported. Without it, optimistic checks
 * detect observed conflicts but cannot promise cross-tab atomicity.
 */
export async function recoverLearningJournal(storage: LearningStorageAdapter, allowedKeys: readonly string[], validate: (key: string, raw: string) => void, onFailure?: (error: unknown) => void): Promise<JournalStatus> {
  try {
    const raw = await storage.getItem(LEARNING_WRITE_JOURNAL_KEY);
    if (raw === null) return "clear";
    let changes: Change[];
    try { changes = parseLearningJournal(raw, allowedKeys, validate); }
    catch { return "unreadable"; }
    if (storage.compareAndSet) {
      const checked = [];
      for (const change of changes) {
        const current = await storage.getItem(change.key);
        if (current !== change.before && current !== change.after) return "conflict";
        checked.push({ key: change.key, before: current, after: change.after });
      }
      await storage.compareAndSet([...checked, { key: LEARNING_WRITE_JOURNAL_KEY, before: raw, after: null }]);
      return "recovered";
    }
    const remaining: [string, string][] = [];
    for (const change of changes) {
      const current = await storage.getItem(change.key);
      if (current !== change.before && current !== change.after) return "conflict";
      if (current !== change.after) remaining.push([change.key, change.after]);
    }
    if (remaining.length) await storage.multiSet(remaining);
    for (const change of changes) {
      if (await storage.getItem(change.key) !== change.after) return "failed";
    }
    // Do not erase a replacement journal produced by a non-cooperating writer.
    if (await storage.getItem(LEARNING_WRITE_JOURNAL_KEY) !== raw) return "conflict";
    await storage.removeItem(LEARNING_WRITE_JOURNAL_KEY);
    return "recovered";
  } catch (error) {
    onFailure?.(error);
    return error instanceof Error && error.name === "LearningStorageConflictError" ? "conflict" : "failed";
  }
}

export async function writeLearningJournal(storage: LearningStorageAdapter, entries: [string, string][], baselines: ReadonlyMap<string, string | null>): Promise<void> {
  if (!entries.length) return;
  if (storage.compareAndSet) {
    await storage.compareAndSet([
      { key: LEARNING_WRITE_JOURNAL_KEY, before: null, after: null },
      ...entries.map(([key, after]) => ({ key, before: baselines.get(key) ?? null, after })),
    ]);
    return;
  }
  if (await storage.getItem(LEARNING_WRITE_JOURNAL_KEY) !== null) throw new Error("Recovery required");
  const raw = JSON.stringify({ version: 1, changes: entries.map(([key, after]) => ({ key, before: baselines.get(key) ?? null, after })) });
  // If this write fails (e.g. quota), no learner key has been changed.
  await storage.setItem(LEARNING_WRITE_JOURNAL_KEY, raw);
  await storage.multiSet(entries);
  for (const [key, value] of entries) {
    if (await storage.getItem(key) !== value) throw new Error("Storage verification failed");
  }
  if (await storage.getItem(LEARNING_WRITE_JOURNAL_KEY) !== raw) throw new Error("Recovery conflict");
  await storage.removeItem(LEARNING_WRITE_JOURNAL_KEY);
}

export async function withLearningStorageLock<T>(task: () => Promise<T>): Promise<T> {
  let started = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const abort = new AbortController();
  try {
    if (typeof navigator !== "undefined" && navigator.locks?.request) {
      timer = setTimeout(() => abort.abort(), 5000);
      return await navigator.locks.request("vocaknio_learning_storage_v1", { mode: "exclusive", signal: abort.signal }, () => {
        clearTimeout(timer);
        started = true;
        return task();
      });
    }
  } catch (error) {
    // Sandboxed browsers may expose the API but reject access. Fall back only
    // before the task started; never execute a rejected mutation twice.
    if (started) throw error;
    if (abort.signal.aborted) {
      const failure = new Error("Another tab is still saving");
      failure.name = "LearningStorageBusyError";
      throw failure;
    }
  } finally {
    clearTimeout(timer);
  }
  return task();
}
