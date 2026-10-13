import { expect, it } from "vitest";
import { LEARNING_BACKUP_FORMAT, parseLearningBackup, previewLearningBackup, type LearningBackup } from "@/lib/learning-backup";
const sample: LearningBackup = { format: LEARNING_BACKUP_FORMAT, createdAt: "2026-10-12T15:00:00Z", vocabStorageVersion: "v1.4", records: { list: "[1,2]", stats: "[3]" }, pending: {}, recoveryJournal: null, unreadableKeys: [] };
const parse = (value: unknown) => parseLearningBackup(JSON.stringify(value), ["list", "stats"], (_key, raw) => { if (!Array.isArray(JSON.parse(raw))) throw new Error("Invalid record"); });
it("accepts a current complete backup without converting learner IDs or values", () => expect(parse(sample)).toEqual(sample));
it("keeps optional raw migration evidence without treating it as restorable learner entries", () => {
  const backup = parse({ ...sample, migrationBackup: "{legacy-unreadable-evidence" });
  expect(backup.migrationBackup).toBe("{legacy-unreadable-evidence");
  expect(previewLearningBackup(backup, { list: null, stats: null }).entries.map(([key]) => key)).toEqual(["list", "stats"]);
  expect(() => parse({ ...sample, migrationBackup: { untrusted: true } })).toThrow();
});
it.each([
  { vocabStorageVersion: "legacy" }, { records: { list: "[]" } }, { unreadableKeys: ["stats"] },
  { records: { list: "[]", stats: "broken" } }, { pending: { auth: "[]" } }, { format: "v2" },
])("rejects unsupported/incomplete backup: %j", change => expect(() => parse({ ...sample, ...change })).toThrow());
it("never sums/MAX-merges histories from different snapshots or silently drops current-only keys", () => {
  expect(previewLearningBackup(sample, { list: "[8]", stats: null }).conflicts.length).toBeGreaterThan(0);
  expect(previewLearningBackup({ ...sample, records: { list: null, stats: "[3]" } }, { list: "[8]", stats: "[3]" }).conflicts).toContain("list");
});
it("keeps optimistic/recovery records separate and blocks automatic restoration", () => {
  expect(previewLearningBackup({ ...sample, pending: { list: "[9]" } }, { list: null, stats: null }).conflicts).toContain("pending-recovery");
});
