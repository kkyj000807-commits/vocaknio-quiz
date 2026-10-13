export const LEARNING_BACKUP_FORMAT = "finetune-learning-backup-v1";
export const BACKUP_MAX_BYTES = 30 * 1024 * 1024;
export interface LearningBackup {
  format: typeof LEARNING_BACKUP_FORMAT;
  createdAt: string;
  vocabStorageVersion: string | null;
  records: Record<string, string | null>;
  pending: Record<string, string>;
  recoveryJournal: string | null;
  /** Raw legacy originals for manual recovery only; never automatically applied. */
  migrationBackup?: string | null;
  unreadableKeys: string[];
}
export interface LearningBackupPreview {
  backup: LearningBackup;
  current: Record<string, string | null>;
  entries: [string, string][];
  conflicts: string[];
  unchanged: number;
}

/** Do not execute arbitrary keys, migrations, URLs or payload properties. */
export function parseLearningBackup(text: string, allowed: readonly string[], validate: (key: string, value: string) => void, additiveOptionalKeys: readonly string[] = []): LearningBackup {
  if (text.length > BACKUP_MAX_BYTES) throw new Error("Backup too large");
  const data = JSON.parse(text) as LearningBackup;
  const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
  if (!data || data.format !== LEARNING_BACKUP_FORMAT || !Number.isFinite(Date.parse(data.createdAt)) ||
      data.vocabStorageVersion !== "v1.4" || !object(data.records) || !object(data.pending) ||
      !Array.isArray(data.unreadableKeys) || data.unreadableKeys.length ||
      !(data.recoveryJournal === null || typeof data.recoveryJournal === "string")) throw new Error("Unsupported or incomplete backup");
  for (const key of additiveOptionalKeys) {
    if (!allowed.includes(key)) throw new Error("Unsupported optional record");
    if (!(key in data.records)) data.records[key] = null;
  }
  if (!(data.migrationBackup === undefined || data.migrationBackup === null || typeof data.migrationBackup === "string")) throw new Error("Unsupported migration backup");
  if (Object.keys(data.records).length !== allowed.length || allowed.some(key => !(key in data.records))) throw new Error("Incomplete backup");
  for (const [key, raw] of Object.entries(data.records)) {
    if (!allowed.includes(key) || !(raw === null || typeof raw === "string")) throw new Error("Unsupported record");
    if (raw !== null) validate(key, raw);
  }
  for (const [key, raw] of Object.entries(data.pending)) {
    if (!allowed.includes(key) || typeof raw !== "string") throw new Error("Unsupported pending record");
    validate(key, raw);
  }
  return data;
}

/** Exact snapshots restore into empty keys only. Mixing answer counters/history
 * from different snapshots would silently double-count or erase evidence.
 * Conflicting devices keep their original records; no automatic MAX/sum merge.
 */
export function previewLearningBackup(backup: LearningBackup, current: Record<string, string | null>, isEmpty: (key: string, raw: string | null) => boolean = (_key, raw) => raw === null): LearningBackupPreview {
  const entries: [string, string][] = [];
  const conflicts: string[] = [];
  let unchanged = 0;
  for (const [key, raw] of Object.entries(backup.records)) {
    if (raw === current[key]) unchanged++;
    else if (!isEmpty(key, current[key])) conflicts.push(key);
    else if (raw !== null) entries.push([key, raw]);
  }
  // Missing keys alone are not proof that snapshots can be combined. A partial
  // snapshot must not be patched with unrelated answer events from another one.
  if (entries.length && Object.entries(current).some(([key, raw]) => !isEmpty(key, raw))) {
    for (const [key] of entries) if (!conflicts.includes(key)) conflicts.push(key);
  }
  if (Object.keys(backup.pending).length || backup.recoveryJournal !== null) conflicts.push("pending-recovery");
  return { backup, current, entries, conflicts, unchanged };
}
