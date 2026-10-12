import { afterEach, expect, it, vi } from "vitest";
import { LEARNING_WRITE_JOURNAL_KEY as KEY, parseLearningJournal, recoverLearningJournal, writeLearningJournal, withLearningStorageLock } from "@/lib/learning-write-journal";
const validate = (_key: string, raw: string) => { if (!Array.isArray(JSON.parse(raw))) throw new Error("Invalid list"); };
afterEach(() => vi.unstubAllGlobals());
function fixture() {
  const values = new Map<string, string>();
  return { values,
    getItem: async (key: string) => values.get(key) ?? null,
    setItem: async (key: string, raw: string) => { values.set(key, raw); },
    removeItem: async (key: string) => { values.delete(key); },
    multiSet: async (entries: [string, string][]) => { for (const [key, raw] of entries) values.set(key, raw); },
  };
}
it("does not touch learner values when a journal cannot be persisted", async () => {
  const storage = fixture(); storage.values.set("list", "[1]");
  storage.setItem = async () => { throw new Error("quota"); };
  await expect(writeLearningJournal(storage, [["list", "[1,2]"]], new Map([["list", "[1]"]]))).rejects.toThrow();
  expect(storage.values.get("list")).toBe("[1]");
});
it("recovery after journal cleanup failure preserves exact bytes and never replays events", async () => {
  const storage = fixture(); const remove = storage.removeItem;
  storage.removeItem = async () => { throw new Error("cleanup failed"); };
  await expect(writeLearningJournal(storage, [["list", "[1,2]"]], new Map([["list", null]]))).rejects.toThrow();
  expect(storage.values.has(KEY)).toBe(true);
  storage.removeItem = remove;
  expect(await recoverLearningJournal(storage, ["list"], validate)).toBe("recovered");
  expect(storage.values.get("list")).toBe("[1,2]");
  expect(await recoverLearningJournal(storage, ["list"], validate)).toBe("clear");
});
it.each([
  { key: "auth", before: null, after: "[]" },
  { key: "list", before: "broken", after: "[]" },
  { key: "list", before: null, after: "{}" },
])("keeps malformed/disallowed recovery data without executing it: %j", change => {
  expect(() => parseLearningJournal(JSON.stringify({ version: 1, changes: [change] }), ["list"], validate)).toThrow();
});
it("rejects duplicate recovery keys and a future schema", () => {
  const change = { key: "list", before: null, after: "[]" };
  expect(() => parseLearningJournal(JSON.stringify({ version: 1, changes: [change, change] }), ["list", "other"], validate)).toThrow();
  expect(() => parseLearningJournal(JSON.stringify({ version: 2, changes: [change] }), ["list"], validate)).toThrow();
});
it("uses one cooperative cross-tab lock around read and mutation", async () => {
  let tail = Promise.resolve(); let count = 0;
  const request = vi.fn((_name: string, _options: unknown, task: () => Promise<void>) => {
    const result = tail.then(task); tail = result; return result;
  });
  vi.stubGlobal("navigator", { locks: { request } });
  await Promise.all(Array.from({ length: 3 }, () => withLearningStorageLock(async () => {
    const previous = count; await Promise.resolve(); count = previous + 1;
  })));
  expect(count).toBe(3);
  expect(request).toHaveBeenCalledWith("vocaknio_learning_storage_v1", { mode: "exclusive" }, expect.any(Function));
});
it("still works without Web Locks without claiming cross-tab atomicity", async () => {
  vi.stubGlobal("navigator", {});
  expect(await withLearningStorageLock(async () => 7)).toBe(7);
});
it("falls back if lock permission is unavailable, but never repeats a task failure", async () => {
  vi.stubGlobal("navigator", { locks: { request: async () => { throw new Error("Denied"); } } });
  const task = vi.fn(async () => 7);
  expect(await withLearningStorageLock(task)).toBe(7);
  expect(task).toHaveBeenCalledTimes(1);
  vi.stubGlobal("navigator", { locks: { request: async (_name: string, _options: unknown, callback: () => Promise<unknown>) => callback() } });
  const failedTask = vi.fn(async () => { throw new Error("write failed"); });
  await expect(withLearningStorageLock(failedTask)).rejects.toThrow("write failed");
  expect(failedTask).toHaveBeenCalledTimes(1);
});
