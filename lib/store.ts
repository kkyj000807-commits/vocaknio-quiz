import AsyncStorage from "@react-native-async-storage/async-storage";
import { LEARNING_WRITE_JOURNAL_KEY, recoverLearningJournal, writeLearningJournal, withLearningStorageLock, type JournalStatus } from "@/lib/learning-write-journal";
import { LEARNING_BACKUP_FORMAT, parseLearningBackup, previewLearningBackup, type LearningBackup, type LearningBackupPreview } from "@/lib/learning-backup";
import { DEFAULT_PRONUNCIATION, normalizePronunciationPreference, type PronunciationPreference } from "@/lib/pronunciation-preference";
import {
  deserializeAdaptiveHistory,
  isReadableAdaptiveHistory,
  recordAdaptiveAnswer,
  recordAdaptiveSession,
  selectAdaptiveItemNums,
  serializeAdaptiveHistory,
  type AdaptiveAnswerInput,
  type AdaptiveCandidate,
} from "@/lib/adaptive-quiz";
import {
  migrateVocabStorage,
  VOCAB_LIST_STORAGE_KEYS,
} from "@/lib/vocab-storage-migration";
import type { QuizMode } from "@/lib/vocab";
import { getVocabItem } from "@/lib/vocab";
import { getItemLearningTargets } from "@/lib/canonical-learning";
import {
  applyLearningEvent,
  getLearningTargetState,
  createEmptySenseLearningState,
  isReadableSenseLearningState,
  parseSenseLearningState,
  type LearningEventInput,
  type SenseLearningState,
} from "@/lib/learning-state";
import { learningDay } from "@/lib/learning-analytics";
import { QUIZ_SESSION_KEY, QUIZ_SESSION_ARCHIVE_KEY, parseQuizSession, parseStoredQuizSession, parseQuizSessionArchive, mergeQuizSessionProgress, type QuizSession } from "@/lib/quiz-session";
import { THEME_KEY, LEGACY_THEME_KEY, isThemeMode, resolveThemePreference, type ThemeMode } from "@/lib/theme-preference";

export interface StatsData {
  totalAnswered: number;
  totalCorrect: number;
  todayAnswered: number;
  todayDate: string;
  streak: number;
  lastStudyDate: string;
}

const STATS_KEY = "vocaknio_stats";
const BOOKMARKS_KEY = VOCAB_LIST_STORAGE_KEYS.bookmarks;
const WRONG_WORDS_KEY = VOCAB_LIST_STORAGE_KEYS.wrongWords;
const MASTERED_KEY = VOCAB_LIST_STORAGE_KEYS.mastered;
const STUDY_TIME_KEY = "vocaknio_study_time";
const NUMBER_LIST_KEYS: readonly string[] = [BOOKMARKS_KEY, WRONG_WORDS_KEY, MASTERED_KEY];
export const ADAPTIVE_QUIZ_HISTORY_KEY = "vocaknio_adaptive_quiz_history_v1";
export const SENSE_LEARNING_STATE_KEY = "vocaknio_sense_learning_state_v1";
const LEARNING_RECORD_KEYS = [STATS_KEY, BOOKMARKS_KEY, WRONG_WORDS_KEY, MASTERED_KEY, STUDY_TIME_KEY, ADAPTIVE_QUIZ_HISTORY_KEY, SENSE_LEARNING_STATE_KEY, QUIZ_SESSION_KEY, QUIZ_SESSION_ARCHIVE_KEY];
const BACKUP_RECORD_KEYS = LEARNING_RECORD_KEYS;
let journalStatus: JournalStatus = "clear";

let learningStorageQueue: Promise<void> = Promise.resolve();
const pendingLearningWrites = new Map<string, string>();
const lastLearningValues = new Map<string, string>();
// Keep disk snapshots separate from optimistic UI values. A failed write must
// not erase the baseline used to detect another tab's changes on retry.
const learningDiskBaselines = new Map<string, string | null>();
const lastLearningWriteAttempts = new Map<string, string>();
const conflictingLearningKeys = new Set<string>();
const unreadableLearningKeys = new Set<string>();
const corruptLearningKeys = new Set<string>();
let pendingThemePreference: ThemeMode | null = null;
let learningWriteFailed = false;
const learningStorageListeners = new Set<() => void>();

function validateLearningValue(key: string, raw: string): void {
  if (key === THEME_KEY) {
    if (!isThemeMode(JSON.parse(raw))) throw new Error("Invalid theme preference");
    return;
  }
  const value: unknown = JSON.parse(raw);
  const isObject = (v: unknown): v is Record<string, unknown> =>
    !!v && typeof v === "object" && !Array.isArray(v);
  const isCount = (v: unknown) =>
    typeof v === "number" && Number.isFinite(v) && v >= 0;
  let valid = false;
  if (NUMBER_LIST_KEYS.includes(key)) {
    valid =
      Array.isArray(value) && value.every((n) => Number.isInteger(n) && n > 0);
  } else if (key === ADAPTIVE_QUIZ_HISTORY_KEY) {
    valid = isReadableAdaptiveHistory(value);
  } else if (key === SENSE_LEARNING_STATE_KEY) {
    valid = isReadableSenseLearningState(value);
  } else if (key === QUIZ_SESSION_KEY) {
    valid = parseStoredQuizSession(value) !== null;
  } else if (key === QUIZ_SESSION_ARCHIVE_KEY) {
    valid = parseQuizSessionArchive(value) !== null;
  } else if (isObject(value)) {
    const counts =
      key === STATS_KEY
        ? ["totalAnswered", "totalCorrect", "todayAnswered", "streak"]
        : ["todaySeconds", "weekSeconds", "totalSeconds"];
    const dates =
      key === STATS_KEY
        ? ["todayDate", "lastStudyDate"]
        : ["todayDate", "weekKey"];
    valid =
      counts.every(
        (field) => value[field] === undefined || isCount(value[field]),
      ) &&
      dates.every(
        (field) =>
          value[field] === undefined || typeof value[field] === "string",
      );
    if (key === STUDY_TIME_KEY)
      valid &&=
        value.dailyLog === undefined ||
        (isObject(value.dailyLog) &&
          Object.values(value.dailyLog).every(isCount));
  }
  if (!valid) throw new Error(`Unreadable learning record: ${key}`);
}

export function getLearningStorageIssue(): string | null {
  if (journalStatus === "conflict" || journalStatus === "unreadable")
    return "다른 창의 변경 또는 복구 기록 충돌로 저장을 보류했습니다. 현재 기록과 미저장 기록을 백업한 뒤 확인해 주세요.";
  if (journalStatus === "failed")
    return "학습 기록의 저장·복구를 완료하지 못했습니다. 저장 상태를 다시 확인하거나 백업해 주세요.";
  if (conflictingLearningKeys.size)
    return "다른 창에서 학습 기록이 변경되어 덮어쓰기를 막았습니다. 이 창의 미저장 기록도 보존 중입니다. 백업 후 충돌을 확인해 주세요.";
  if (unreadableLearningKeys.size)
    return "기존 학습 기록을 읽지 못해 덮어쓰기를 막았습니다. 이번 응답은 저장되지 않을 수 있어요.";
  if (pendingLearningWrites.size && learningWriteFailed)
    return "아직 이 기기에 저장되지 않은 학습 기록이 있습니다. 저장될 때까지 이 창을 닫지 마세요.";
  return null;
}
function notifyLearningStorage() {
  learningStorageListeners.forEach((listener) => listener());
}
export function subscribeLearningStorage(listener: () => void) {
  learningStorageListeners.add(listener);
  return () => {
    learningStorageListeners.delete(listener);
  };
}
export async function retryLearningStorage(): Promise<void> {
  await enqueueLearningStorageTask(async () => {
    for (const key of [...unreadableLearningKeys]) {
      if (!pendingLearningWrites.has(key)) await readLearningItem(key);
    }
    await persistLearningEntries([]);
    if (pendingThemePreference) {
      try { await writeThemePreferenceUnsafe(pendingThemePreference); } catch {}
    }
  });
}

async function readLearningItem(key: string): Promise<string | null> {
  if (pendingLearningWrites.has(key)) return pendingLearningWrites.get(key)!;
  try {
    const value = await AsyncStorage.getItem(key);
    if (value !== null) {
      try {
        validateLearningValue(key, value);
      } catch {
        // Preserve the exact on-disk bytes; retry may re-read a repaired record,
        // but must never silently reset corrupt data to an empty history.
        unreadableLearningKeys.add(key);
        corruptLearningKeys.add(key);
        notifyLearningStorage();
        return null;
      }
    }
    unreadableLearningKeys.delete(key);
    corruptLearningKeys.delete(key);
    learningDiskBaselines.set(key, value);
    notifyLearningStorage();
    if (value === null) lastLearningValues.delete(key);
    else lastLearningValues.set(key, value);
    return value;
  } catch {
    // An earlier successful read does not make its cache current. Another tab
    // may have written since then. Keep the cache for display only and block
    // read-modify-write until a fresh read succeeds.
    unreadableLearningKeys.add(key);
    notifyLearningStorage();
    return lastLearningValues.get(key) ?? null;
  }
}

async function persistLearningEntries(
  entries: [string, string][],
): Promise<void> {
  // Never replace unreadable prior records with a new empty baseline.
  if (unreadableLearningKeys.size && entries.length) {
    // A previously validated baseline can support pending work in this tab.
    // It cannot authorize a disk write: retry must reread and compare every key.
    // Never build pending aggregates from corrupt or never-read prior values.
    if (!corruptLearningKeys.size && entries.every(([key]) => learningDiskBaselines.has(key))) {
      for (const [key, value] of entries) {
        validateLearningValue(key, value);
        pendingLearningWrites.set(key, value);
        lastLearningValues.set(key, value);
      }
      learningWriteFailed = true;
    }
    notifyLearningStorage();
    return;
  }
  for (const [key, value] of entries) {
    pendingLearningWrites.set(key, value);
    lastLearningValues.set(key, value);
  }
  // A recovery write may still fail while reads and optimistic state are sound.
  // Keep subsequent responses in memory; only defer their disk flush.
  if (["conflict", "unreadable", "failed"].includes(journalStatus)) { learningWriteFailed = true; notifyLearningStorage(); return; }
  notifyLearningStorage();
  const pending = [...pendingLearningWrites.entries()];
  try {
    for (const [key] of pending) {
      const current = await AsyncStorage.getItem(key);
      // Theme is an explicitly replaceable preference, not learning history.
      if (key !== THEME_KEY && current !== null) {
        try { validateLearningValue(key, current); }
        catch { unreadableLearningKeys.add(key); corruptLearningKeys.add(key); continue; }
      }
      unreadableLearningKeys.delete(key);
      corruptLearningKeys.delete(key);
      if (key !== THEME_KEY && learningDiskBaselines.has(key) &&
          current !== learningDiskBaselines.get(key) &&
          current !== lastLearningWriteAttempts.get(key)) {
        conflictingLearningKeys.add(key);
      } else {
        conflictingLearningKeys.delete(key);
        // A prior multiSet may have partly succeeded. Its exact written value
        // is a valid retry baseline; a different value is never overwritten.
        learningDiskBaselines.set(key, current);
      }
    }
    if (unreadableLearningKeys.size || conflictingLearningKeys.size) {
      learningWriteFailed = true;
      notifyLearningStorage();
      return;
    }
    for (const [key, value] of pending) lastLearningWriteAttempts.set(key, value);
    await writeLearningJournal(AsyncStorage, pending, learningDiskBaselines);
    learningWriteFailed = false;
    for (const [key, value] of pending) {
      learningDiskBaselines.set(key, value);
      lastLearningWriteAttempts.delete(key);
      if (pendingLearningWrites.get(key) === value)
        pendingLearningWrites.delete(key);
    }
  } catch {
    // Keep answers and sessions in this tab and retry them on the next mutation.
    learningWriteFailed = true;
  }
  notifyLearningStorage();
}

/**
 * Stats, wrong-word and adaptive-history mutations are read-modify-write
 * operations. Serializing them prevents a fast second answer from overwriting
 * the first answer with a stale AsyncStorage snapshot. A rejected task is
 * deliberately swallowed only by the queue tail so later tasks can continue;
 * the original caller still receives the rejection.
 */
function enqueueLearningStorageTask<T>(task: () => Promise<T>, recover = true): Promise<T> {
  const guarded = () => withLearningStorageLock(async () => {
    if (recover) {
      journalStatus = await recoverLearningJournal(AsyncStorage, LEARNING_RECORD_KEYS, validateLearningValue);
      notifyLearningStorage();
    }
    return task();
  });
  const result = learningStorageQueue.then(guarded, guarded);
  learningStorageQueue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

/** User-requested local export only. Never enumerate storage/auth keys. Raw
 * unreadable values and pending writes are preserved separately for recovery.
 */
export function exportLearningBackup(): Promise<LearningBackup> {
  return enqueueLearningStorageTask(async () => {
    const records: LearningBackup["records"] = {};
    const unreadableKeys: string[] = [];
    for (const key of BACKUP_RECORD_KEYS) {
      try { records[key] = await AsyncStorage.getItem(key); }
      catch { records[key] = null; unreadableKeys.push(key); }
    }
    let vocabStorageVersion: string | null = null;
    let recoveryJournal: string | null = null;
    try { vocabStorageVersion = await AsyncStorage.getItem("vocaknio_vocab_storage_version"); }
    catch { unreadableKeys.push("vocabStorageVersion"); }
    try { recoveryJournal = await AsyncStorage.getItem(LEARNING_WRITE_JOURNAL_KEY); }
    catch { unreadableKeys.push("recoveryJournal"); }
    return { format: LEARNING_BACKUP_FORMAT, createdAt: new Date().toISOString(), vocabStorageVersion,
      records, pending: Object.fromEntries([...pendingLearningWrites].filter(([key]) => BACKUP_RECORD_KEYS.includes(key))), recoveryJournal, unreadableKeys };
  }, false);
}

export function inspectLearningBackup(text: string): Promise<LearningBackupPreview> {
  return enqueueLearningStorageTask(async () => {
    const backup = parseLearningBackup(text, BACKUP_RECORD_KEYS, validateLearningValue, [QUIZ_SESSION_ARCHIVE_KEY]);
    const current: Record<string, string | null> = {};
    for (const key of BACKUP_RECORD_KEYS) current[key] = await AsyncStorage.getItem(key);
    const preview = previewLearningBackup(backup, current, isEmptyLearningRecord);
    if (pendingLearningWrites.size || await AsyncStorage.getItem(LEARNING_WRITE_JOURNAL_KEY) !== null) preview.conflicts.push("current-pending");
    return preview;
  }, false);
}

function isEmptyLearningRecord(key: string, raw: string | null): boolean {
  if (raw === null) return true;
  try {
    validateLearningValue(key, raw);
    const value = JSON.parse(raw);
    if (NUMBER_LIST_KEYS.includes(key)) return value.length === 0;
    if (key === SENSE_LEARNING_STATE_KEY) {
      const state = parseSenseLearningState(value);
      return !!state && Object.keys(state.targets).length === 0 && state.revision <= 1;
    }
    if (key === ADAPTIVE_QUIZ_HISTORY_KEY) {
      const history = deserializeAdaptiveHistory(raw);
      return history.revision === 0 && !Object.keys(history.stats).length && !history.recentSessions.length && !history.processedAnswerKeys.length;
    }
    if (key === STATS_KEY) return Object.entries(value).every(([field, item]) =>
      ["totalAnswered", "totalCorrect", "todayAnswered", "streak"].includes(field) ? item === 0 :
        ["todayDate", "lastStudyDate"].includes(field) && item === "");
  } catch { /* unreadable never means empty */ }
  return false;
}

export function restoreLearningBackup(preview: LearningBackupPreview): Promise<void> {
  // Capture and revalidate the preview; callers cannot change it while queued.
  const captured = JSON.parse(JSON.stringify(preview)) as LearningBackupPreview;
  return enqueueLearningStorageTask(async () => {
    const backup = parseLearningBackup(JSON.stringify(captured.backup), BACKUP_RECORD_KEYS, validateLearningValue, [QUIZ_SESSION_ARCHIVE_KEY]);
    const current: Record<string, string | null> = {};
    for (const key of BACKUP_RECORD_KEYS) {
      current[key] = await AsyncStorage.getItem(key);
      if (current[key] !== captured.current[key]) throw new Error("Backup preview is stale");
    }
    const checked = previewLearningBackup(backup, current, isEmptyLearningRecord);
    if (checked.conflicts.length || pendingLearningWrites.size || await AsyncStorage.getItem(LEARNING_WRITE_JOURNAL_KEY) !== null)
      throw new Error("Backup conflict; current records preserved");
    if (!checked.entries.length) return;
    for (const [key, value] of Object.entries(current)) learningDiskBaselines.set(key, value);
    // Persist the ID schema before restoring numeric lists. No number remap.
    await AsyncStorage.setItem("vocaknio_vocab_storage_version", backup.vocabStorageVersion!);
    await persistLearningEntries(checked.entries);
    if (pendingLearningWrites.size || getLearningStorageIssue()) throw new Error("Restore not completed");
  });
}

// Share the write queue, but an unreadable theme must not disable scoring.
async function writeThemePreferenceUnsafe(mode: ThemeMode): Promise<void> {
  pendingThemePreference = mode;
  await AsyncStorage.setItem(THEME_KEY, JSON.stringify(mode));
  if (pendingThemePreference === mode) pendingThemePreference = null;
}

export function loadThemePreference(): Promise<ThemeMode> {
  return enqueueLearningStorageTask(async () => {
    const current = await AsyncStorage.getItem(THEME_KEY);
    const legacy = current === null ? await AsyncStorage.getItem(LEGACY_THEME_KEY) : null;
    const mode = resolveThemePreference(current, legacy);
    if (current === null) await writeThemePreferenceUnsafe(mode);
    return mode;
  });
}

export function saveThemePreference(mode: ThemeMode): Promise<void> {
  return enqueueLearningStorageTask(async () => {
    if (!isThemeMode(mode)) throw new Error("Invalid theme preference");
    // Explicit selection replaces only this preference, never learning data.
    await writeThemePreferenceUnsafe(mode);
  });
}

const EMPTY_STATS: StatsData = {
  totalAnswered: 0,
  totalCorrect: 0,
  todayAnswered: 0,
  todayDate: "",
  streak: 0,
  lastStudyDate: "",
};

async function readStatsUnsafe(): Promise<StatsData> {
  try {
    const raw = await readLearningItem(STATS_KEY);
    if (raw)
      return { ...EMPTY_STATS, ...(JSON.parse(raw) as Partial<StatsData>) };
  } catch {}
  return { ...EMPTY_STATS };
}

function parseNumberList(raw: string | null): number[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return [
      ...new Set(
        parsed.filter(
          (value): value is number =>
            Number.isInteger(value) && (value as number) > 0,
        ),
      ),
    ];
  } catch {
    return [];
  }
}

async function readWrongWordsUnsafe(): Promise<number[]> {
  try {
    return parseNumberList(await readLearningItem(WRONG_WORDS_KEY));
  } catch {
    return [];
  }
}

export async function migrateStoredVocabLists() {
  return enqueueLearningStorageTask(async () => {
    if (["conflict", "unreadable", "failed"].includes(journalStatus)) throw new Error("Learning recovery required before migration");
    return migrateVocabStorage({
    getItem: (key) => AsyncStorage.getItem(key),
    setItem: (key, value) => AsyncStorage.setItem(key, value),
    setItems: (entries) => AsyncStorage.multiSet(entries),
    });
  });
}

// ─── Stats ────────────────────────────────────────────────────────────────────

export async function loadStats(): Promise<StatsData> {
  return enqueueLearningStorageTask(readStatsUnsafe);
}

export async function saveStats(stats: StatsData): Promise<void> {
  await enqueueLearningStorageTask(async () => {
    await readStatsUnsafe();
    await persistLearningEntries([[STATS_KEY, JSON.stringify(stats)]]);
  });
}

export async function updateStatsAfterQuiz(
  correct: number,
  total: number,
): Promise<StatsData> {
  return enqueueLearningStorageTask(async () => {
    const stats = await readStatsUnsafe();
    const today = new Date().toISOString().slice(0, 10);

    if (stats.todayDate !== today) {
      stats.todayAnswered = 0;
      stats.todayDate = today;
    }

    const yesterday = new Date(Date.now() - 86400000)
      .toISOString()
      .slice(0, 10);
    if (stats.lastStudyDate === yesterday) {
      stats.streak += 1;
    } else if (stats.lastStudyDate !== today) {
      stats.streak = 1;
    }
    stats.lastStudyDate = today;

    stats.totalAnswered += total;
    stats.totalCorrect += correct;
    stats.todayAnswered += total;

    await persistLearningEntries([[STATS_KEY, JSON.stringify(stats)]]);
    return stats;
  });
}

// ─── Bookmarks ────────────────────────────────────────────────────────────────

export async function loadBookmarks(): Promise<number[]> {
  return enqueueLearningStorageTask(() => readNumberListUnsafe(BOOKMARKS_KEY));
}

export async function saveBookmarks(nums: number[]): Promise<void> {
  await saveNumberList(BOOKMARKS_KEY, nums);
}

export async function toggleBookmark(num: number): Promise<number[]> {
  return enqueueLearningStorageTask(async () => {
    const bookmarks = await readNumberListUnsafe(BOOKMARKS_KEY);
    if (!Number.isInteger(num) || num <= 0) return bookmarks;
    const updated = bookmarks.includes(num)
      ? bookmarks.filter((n) => n !== num)
      : [...bookmarks, num];
    await persistLearningEntries([[BOOKMARKS_KEY, JSON.stringify(updated)]]);
    return updated;
  });
}

async function readNumberListUnsafe(key: string): Promise<number[]> {
  return parseNumberList(await readLearningItem(key));
}

async function saveNumberList(key: string, nums: number[]): Promise<void> {
  await enqueueLearningStorageTask(async () => {
    await readNumberListUnsafe(key);
    const normalized = [
      ...new Set(nums.filter((n) => Number.isInteger(n) && n > 0)),
    ];
    await persistLearningEntries([[key, JSON.stringify(normalized)]]);
  });
}

// ─── Wrong Words (오답 누적) ──────────────────────────────────────────────────

/**
 * 오답 단어 num 목록을 불러옵니다.
 */
export async function loadWrongWords(): Promise<number[]> {
  return enqueueLearningStorageTask(readWrongWordsUnsafe);
}

/**
 * 오답 단어 num 목록을 저장합니다.
 */
export async function saveWrongWords(nums: number[]): Promise<void> {
  await saveNumberList(WRONG_WORDS_KEY, nums);
}

/**
 * 퀴즈 결과의 오답 num 배열을 기존 오답 목록에 누적 추가합니다.
 * 중복은 제거됩니다.
 */
export async function addWrongWords(newNums: number[]): Promise<number[]> {
  return enqueueLearningStorageTask(async () => {
    const existing = await readWrongWordsUnsafe();
    if (newNums.length === 0) return existing;
    const merged = [
      ...new Set([
        ...existing,
        ...newNums.filter((value) => Number.isInteger(value) && value > 0),
      ]),
    ];
    await persistLearningEntries([[WRONG_WORDS_KEY, JSON.stringify(merged)]]);
    return merged;
  });
}

/**
 * 특정 단어를 오답 목록에서 제거합니다 (마스터 처리).
 */
export async function removeWrongWord(num: number): Promise<number[]> {
  return enqueueLearningStorageTask(async () => {
    const existing = await readWrongWordsUnsafe();
    const updated = existing.filter((n) => n !== num);
    await persistLearningEntries([[WRONG_WORDS_KEY, JSON.stringify(updated)]]);
    return updated;
  });
}

/**
 * 오답 목록 전체를 초기화합니다.
 */
export async function clearWrongWords(): Promise<void> {
  await saveWrongWords([]);
}

// ─── Adaptive quiz history ──────────────────────────────────────────────────

export interface PrepareAdaptiveQuizSessionInput {
  sessionId: string;
  rangeId: string;
  mode: QuizMode;
  candidates: AdaptiveCandidate[];
  count: number;
}

export type AdaptiveAnswerContext = AdaptiveAnswerInput & {
  learningTargetKey?: string;
  learningEvent?: LearningEventInput["type"];
  hintUsed?: boolean;
  responseMs?: number;
};

async function readSenseLearningStateUnsafe(): Promise<SenseLearningState> {
  const raw = await readLearningItem(SENSE_LEARNING_STATE_KEY);
  const parsed = raw ? parseSenseLearningState(JSON.parse(raw)) : createEmptySenseLearningState();
  if (!parsed) throw new Error("Unreadable sense learning state");
  if (parsed.legacyMasteredMigrated) return parsed;

  let migrated = parsed;
  const legacyNums = await readNumberListUnsafe(MASTERED_KEY);
  for (const num of legacyNums) {
    const item = getVocabItem(num);
    if (!item) continue;
    const targets = getItemLearningTargets(item);
    // An old word-level flag cannot safely certify several distinct senses.
    if (targets.length !== 1) continue;
    migrated = applyLearningEvent(migrated, {
      targetKey: targets[0].key,
      type: "mastered",
      occurredAt: 0,
      questionType: "legacy-mastered-migration",
    });
  }
  migrated = {
    ...migrated,
    revision: migrated.revision + 1,
    legacyMasteredMigrated: true,
  };
  await persistLearningEntries([[SENSE_LEARNING_STATE_KEY, JSON.stringify(migrated)]]);
  return migrated;
}

export function loadSenseLearningState(): Promise<SenseLearningState> {
  return enqueueLearningStorageTask(readSenseLearningStateUnsafe);
}

export function recordSenseLearningEvent(input: LearningEventInput): Promise<SenseLearningState> {
  return enqueueLearningStorageTask(async () => {
    const current = await readSenseLearningStateUnsafe();
    const next = applyLearningEvent(current, input);
    await persistLearningEntries([[SENSE_LEARNING_STATE_KEY, JSON.stringify(next)]]);
    return next;
  });
}

export function markLearningTargetMastered(targetKey: string, num?: number): Promise<SenseLearningState> {
  return enqueueLearningStorageTask(async () => {
    const current = await readSenseLearningStateUnsafe();
    const next = applyLearningEvent(current, { targetKey, type: "mastered" });
    const entries: [string, string][] = [[SENSE_LEARNING_STATE_KEY, JSON.stringify(next)]];
    // New canonical mastery is sense-level. Only legacy-equivalence targets
    // mirror the old word-number list; doing that for a canonical sense would
    // hide every other sense of the same source row in legacy flashcards.
    if (targetKey.startsWith("legacy:v1:") && Number.isInteger(num) && (num ?? 0) > 0) {
      const legacy = await readNumberListUnsafe(MASTERED_KEY);
      entries.push([MASTERED_KEY, JSON.stringify([...new Set([...legacy, num!])])]);
    }
    await persistLearningEntries(entries);
    return next;
  });
}

export function startLearningTargetAgain(targetKey: string): Promise<SenseLearningState> {
  return recordSenseLearningEvent({ targetKey, type: "relearning" });
}

async function readAdaptiveHistoryUnsafe() {
  try {
    return deserializeAdaptiveHistory(
      await readLearningItem(ADAPTIVE_QUIZ_HISTORY_KEY),
    );
  } catch {
    return deserializeAdaptiveHistory(null);
  }
}

/**
 * Selects and records one quiz session inside the same storage queue. Existing
 * wrong words seed the first adaptive sessions, so legacy users do not lose
 * their known weak-word signal while the new item history is still empty.
 */
export async function prepareAdaptiveQuizSession({
  sessionId,
  rangeId,
  mode,
  candidates,
  count,
}: PrepareAdaptiveQuizSessionInput): Promise<number[]> {
  return enqueueLearningStorageTask(async () => {
    const [history, legacyWrongNums] = await Promise.all([
      readAdaptiveHistoryUnsafe(),
      readWrongWordsUnsafe(),
    ]);
    const itemNums = selectAdaptiveItemNums({
      candidates,
      count,
      mode,
      rangeId,
      history,
      legacyWrongNums,
      strategy: candidates.some(candidate => candidate.learningStatus) ? "weighted" : "coverage",
    });
    const nextHistory = recordAdaptiveSession(history, {
      sessionId,
      rangeId,
      mode,
      itemNums,
    });
    await persistLearningEntries([
      [ADAPTIVE_QUIZ_HISTORY_KEY, serializeAdaptiveHistory(nextHistory)],
    ]);
    return itemNums;
  });
}

export async function loadAdaptiveQuizHistory() {
  return enqueueLearningStorageTask(readAdaptiveHistoryUnsafe);
}

/** One serialized snapshot: statistics cannot race an in-flight answer. */
export function loadLearningSnapshot() {
  return enqueueLearningStorageTask(async () => {
    if (["conflict", "unreadable", "failed"].includes(journalStatus))
      throw new Error("Learning recovery is incomplete; original values are preserved");
    const snapshot = { stats: await readStatsUnsafe(), history: await readAdaptiveHistoryUnsafe(),
      learning: await readSenseLearningStateUnsafe(), legacyWrongNums: await readWrongWordsUnsafe() };
    if ([STATS_KEY, ADAPTIVE_QUIZ_HISTORY_KEY, SENSE_LEARNING_STATE_KEY].some(key => unreadableLearningKeys.has(key)))
      throw new Error("Learning evidence is unreadable; original values are preserved");
    return snapshot;
  });
}

async function readQuizSessionUnsafe(): Promise<QuizSession | null> {
  const raw = await readLearningItem(QUIZ_SESSION_KEY);
  return raw ? parseStoredQuizSession(JSON.parse(raw)) : null;
}

export function loadQuizSession(): Promise<QuizSession | null> {
  return enqueueLearningStorageTask(readQuizSessionUnsafe);
}

async function archiveSessionEntryUnsafe(raw: string): Promise<[string, string]> {
  const archiveRaw = await readLearningItem(QUIZ_SESSION_ARCHIVE_KEY);
  const archive = archiveRaw ? parseQuizSessionArchive(JSON.parse(archiveRaw)) : { schema: 1 as const, sessions: [] as string[] };
  if (!archive) throw new Error("Historical session archive cannot be read");
  if (!archive.sessions.includes(raw)) archive.sessions.push(raw);
  return [QUIZ_SESSION_ARCHIVE_KEY, JSON.stringify(archive)];
}

export function saveQuizSession(session: QuizSession): Promise<void> {
  // Capture before joining the queue, so later UI edits cannot change this write.
  const raw = JSON.stringify(session);
  const snapshot: QuizSession = JSON.parse(raw);
  validateLearningValue(QUIZ_SESSION_KEY, raw);
  if (!parseQuizSession(snapshot)) return Promise.reject(new Error("This session cannot be used with current content"));
  return enqueueLearningStorageTask(async () => {
    const previousRaw = await readLearningItem(QUIZ_SESSION_KEY);
    const previous = previousRaw ? parseStoredQuizSession(JSON.parse(previousRaw)) : null;
    if (previous?.sessionId === snapshot.sessionId && previous.completed && !snapshot.completed) return;
    const mergedRaw = JSON.stringify(mergeQuizSessionProgress(previous, snapshot));
    const entries: [string, string][] = [];
    if (mergedRaw !== raw) {
      // Keep a conflicting incoming snapshot for diagnosis; never rewrite the
      // already committed answer to match another tab's late UI state.
      entries.push(await archiveSessionEntryUnsafe(raw));
    } else if (previous && previousRaw && ((!previous.completed && previous.sessionId !== snapshot.sessionId) || JSON.stringify(previous.questions) !== JSON.stringify(snapshot.questions) || !parseQuizSession(previous) || previous.questions.some(q => JSON.stringify(q.item) !== JSON.stringify(getVocabItem(q.item.num))))) {
      // Preserve exact old bytes in the same recoverable transaction as replacement.
      entries.push(await archiveSessionEntryUnsafe(previousRaw));
    }
    entries.push([QUIZ_SESSION_KEY, mergedRaw]);
    await persistLearningEntries(entries);
  });
}

// ─── Per-question realtime update ───────────────────────────────────────────────

/**
 * 한 문제 결과를 즉시 통계에 반영합니다.
 * - isCorrect: 정답 여부
 * - wrongNum: 오답일 경우 단어 num (정답이면 undefined)
 * - context: 새 적응형 출제에 필요한 항목별 응답 정보 (선택)
 */
export async function recordOneAnswer(
  isCorrect: boolean,
  wrongNum?: number,
  context?: AdaptiveAnswerContext,
  session?: QuizSession,
): Promise<void> {
  const answerCorrect = context ? context.outcome === "correct" || context.outcome === "mastered" : isCorrect;
  const sessionRaw = session ? JSON.stringify(session) : null;
  const snapshot: QuizSession | null = sessionRaw ? JSON.parse(sessionRaw) : null;
  if (sessionRaw) validateLearningValue(QUIZ_SESSION_KEY, sessionRaw);
  if (snapshot && !parseQuizSession(snapshot)) throw new Error("Outdated or held questions cannot create new grades");
  try {
    await enqueueLearningStorageTask(async () => {
      if (sessionRaw) await readQuizSessionUnsafe();
      const history = context ? await readAdaptiveHistoryUnsafe() : null;
      const currentLearning = context?.learningTargetKey
        ? await readSenseLearningStateUnsafe()
        : null;
      let nextLearning = currentLearning;
      if (currentLearning && context?.learningTargetKey) {
        const eventType = context.learningEvent ??
          (context.outcome === "correct" ? "correct"
            : context.outcome === "mastered" ? "mastered"
            : context.outcome === "skip" ? "unknown" : "wrong");
        nextLearning = applyLearningEvent(currentLearning, {
          targetKey: context.learningTargetKey,
          type: eventType,
          occurredAt: context.answeredAt,
          responseMs: context.responseMs,
          questionType: context.mode,
          usedHint: context.hintUsed,
        });
        if (context.hintUsed) {
          nextLearning = applyLearningEvent(nextLearning, {
            targetKey: context.learningTargetKey,
            type: "hint",
            occurredAt: context.answeredAt,
            questionType: context.mode,
          });
        }
      }
      const item = context ? getVocabItem(context.itemNum) : undefined;
      const nextHistory = history && context ? recordAdaptiveAnswer(history, {
        ...context,
        answeredAt: context.answeredAt ?? Date.now(),
        targetKey: context.targetKey ?? context.learningTargetKey,
        sourceId: item?.id,
        groupId: item?.group,
        statusBefore: currentLearning && context.learningTargetKey ? getLearningTargetState(currentLearning, context.learningTargetKey).status : undefined,
        statusAfter: nextLearning && context.learningTargetKey ? getLearningTargetState(nextLearning, context.learningTargetKey).status : undefined,
      }) : null;
      // A duplicate response must not increment global stats while adaptive stats reject it.
      if (history && nextHistory && nextHistory.revision === history.revision)
        return;
      const stats = await readStatsUnsafe();
      const today = learningDay(context?.answeredAt ?? Date.now());

      if (stats.todayDate !== today) {
        stats.todayAnswered = 0;
        stats.todayDate = today;
      }

      const yesterday = learningDay((context?.answeredAt ?? Date.now()) - 86400000);
      if (stats.lastStudyDate === yesterday) {
        stats.streak += 1;
      } else if (stats.lastStudyDate !== today) {
        stats.streak = 1;
      }
      stats.lastStudyDate = today;
      stats.totalAnswered += 1;
      stats.todayAnswered += 1;
      if (answerCorrect) stats.totalCorrect += 1;

      const entries: [string, string][] = [[STATS_KEY, JSON.stringify(stats)]];
      if (sessionRaw && snapshot) {
        const currentSession = await readQuizSessionUnsafe();
        // An answer from another tab must not replace the session currently
        // occupying the resume slot. Keep that answer snapshot in the archive.
        if (currentSession && currentSession.sessionId !== snapshot.sessionId) entries.push(await archiveSessionEntryUnsafe(sessionRaw));
        else {
          const mergedRaw = JSON.stringify(mergeQuizSessionProgress(currentSession, snapshot));
          if (mergedRaw !== sessionRaw) entries.push(await archiveSessionEntryUnsafe(sessionRaw));
          entries.push([QUIZ_SESSION_KEY, mergedRaw]);
        }
      }

      // Logic failures are retained by the same adaptive history/target state
      // and shown in wrong notes as exact questions, not duplicate word errors.
      const wrongItemNum = !answerCorrect && context?.mode !== "sentence-completion"
        ? (context?.itemNum ?? wrongNum)
        : undefined;
      if (wrongItemNum !== undefined) {
        const wrongWords = await readWrongWordsUnsafe();
        entries.push([
          WRONG_WORDS_KEY,
          JSON.stringify([...new Set([...wrongWords, wrongItemNum])]),
        ]);
      }

      if (nextHistory) {
        entries.push([
          ADAPTIVE_QUIZ_HISTORY_KEY,
          serializeAdaptiveHistory(nextHistory),
        ]);
      }
      if (nextLearning && nextLearning !== currentLearning) {
        entries.push([
          SENSE_LEARNING_STATE_KEY,
          JSON.stringify(nextLearning),
        ]);
      }

      await persistLearningEntries(entries);
    });
  } catch {
    // A persistence failure must not freeze quiz interaction. The queue tail is
    // already recovered by enqueueLearningStorageTask, so later answers retry.
  }
}

// ─── Mastered Words (플래시카드 마스터 제외) ─────────────────────────────────────

/**
 * 마스터 처리된 단어 num 목록을 불러옵니다.
 */
export async function loadMastered(): Promise<number[]> {
  return enqueueLearningStorageTask(() => readNumberListUnsafe(MASTERED_KEY));
}

/**
 * 단어를 마스터 목록에 추가합니다.
 */
export async function addMastered(num: number): Promise<number[]> {
  return enqueueLearningStorageTask(async () => {
    const existing = await readNumberListUnsafe(MASTERED_KEY);
    if (!Number.isInteger(num) || num <= 0 || existing.includes(num))
      return existing;
    const updated = [...existing, num];
    await persistLearningEntries([[MASTERED_KEY, JSON.stringify(updated)]]);
    return updated;
  });
}

/**
 * 마스터 목록 전체를 초기화합니다 (리셋).
 */
export async function clearMastered(): Promise<void> {
  await saveNumberList(MASTERED_KEY, []);
}

// ─── Quiz Settings ────────────────────────────────────────────────────────────────

export type ChoiceLang = "korean" | "english";

const QUIZ_SETTINGS_KEY = "vocaknio_quiz_settings";

export interface QuizSettings {
  choiceLang: ChoiceLang;
  pronunciation: PronunciationPreference;
}

const DEFAULT_QUIZ_SETTINGS: QuizSettings = {
  choiceLang: "korean",
  pronunciation: DEFAULT_PRONUNCIATION,
};

function parseQuizSettingsRecord(raw: string | null): Record<string, unknown> {
  if (raw === null) return {};
  const value: unknown = JSON.parse(raw);
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Unreadable quiz settings");
  return value as Record<string, unknown>;
}

export async function loadQuizSettings(): Promise<QuizSettings> {
  return enqueueLearningStorageTask(async () => {
    try {
      const value = parseQuizSettingsRecord(await AsyncStorage.getItem(QUIZ_SETTINGS_KEY));
      return {
        choiceLang: value.choiceLang === "english" ? "english" : "korean",
        pronunciation: normalizePronunciationPreference(value.pronunciation),
      };
    } catch {
      // A display fallback is not permission to overwrite unreadable settings.
      return { ...DEFAULT_QUIZ_SETTINGS };
    }
  });
}

export async function saveQuizSettings(settings: Partial<QuizSettings>): Promise<void> {
  return enqueueLearningStorageTask(async () => {
    // Re-read inside the existing queue. Preserve unknown/legacy fields and
    // refuse writes on read/parse failure; never replace them with defaults.
    const current = parseQuizSettingsRecord(await AsyncStorage.getItem(QUIZ_SETTINGS_KEY));
    const next = { ...current, ...settings };
    if (settings.pronunciation) {
      next.pronunciation = {
        ...(current.pronunciation && typeof current.pronunciation === "object" ? current.pronunciation : {}),
        ...normalizePronunciationPreference(settings.pronunciation),
      };
    }
    await AsyncStorage.setItem(QUIZ_SETTINGS_KEY, JSON.stringify(next));
  });
}

// ─── Study Time (순공부 시간) ─────────────────────────────────────────────────

export interface StudyTimeData {
  /** 오늘 날짜 (YYYY-MM-DD) */
  todayDate: string;
  /** 오늘 학습 시간 (초) */
  todaySeconds: number;
  /** 이번 주 학습 시간 (초) — ISO 주차 기준 */
  weekSeconds: number;
  /** 이번 주 번호 (YYYY-Www) */
  weekKey: string;
  /** 누적 학습 시간 (초) */
  totalSeconds: number;
  /** 날짜별 학습 시간 기록 { "YYYY-MM-DD": seconds } — 최근 30일 */
  dailyLog: Record<string, number>;
}

function getTodayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function getWeekKey(date = new Date()): string {
  // ISO 주차: 월요일 기준
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const weekNo = Math.ceil(
    ((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7,
  );
  return `${d.getFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

export async function loadStudyTime(): Promise<StudyTimeData> {
  return enqueueLearningStorageTask(readStudyTimeUnsafe);
}

async function readStudyTimeUnsafe(): Promise<StudyTimeData> {
  const empty: StudyTimeData = {
    todayDate: "",
    todaySeconds: 0,
    weekSeconds: 0,
    weekKey: "",
    totalSeconds: 0,
    dailyLog: {},
  };
  const raw = await readLearningItem(STUDY_TIME_KEY);
  return raw ? { ...empty, ...JSON.parse(raw) } : empty;
}

export async function saveStudyTime(data: StudyTimeData): Promise<void> {
  await enqueueLearningStorageTask(async () => {
    await readStudyTimeUnsafe();
    await persistLearningEntries([[STUDY_TIME_KEY, JSON.stringify(data)]]);
  });
}

/**
 * 학습 시간(초)을 누적합니다.
 * - 오늘/이번 주가 바뀌면 자동으로 리셋 후 누적
 * - dailyLog는 최근 30일만 유지
 */
export async function addStudySeconds(seconds: number): Promise<StudyTimeData> {
  if (!Number.isFinite(seconds) || seconds <= 0) return loadStudyTime();

  return enqueueLearningStorageTask(async () => {
    const data = await readStudyTimeUnsafe();
    const today = getTodayKey();
    const weekKey = getWeekKey();

    // 날짜 리셋
    if (data.todayDate !== today) {
      data.todaySeconds = 0;
      data.todayDate = today;
    }

    // 주차 리셋
    if (data.weekKey !== weekKey) {
      data.weekSeconds = 0;
      data.weekKey = weekKey;
    }

    data.todaySeconds += seconds;
    data.weekSeconds += seconds;
    data.totalSeconds += seconds;

    // dailyLog 업데이트
    data.dailyLog[today] = (data.dailyLog[today] ?? 0) + seconds;

    // 최근 30일만 유지
    const keys = Object.keys(data.dailyLog).sort();
    if (keys.length > 30) {
      keys.slice(0, keys.length - 30).forEach((k) => delete data.dailyLog[k]);
    }

    await persistLearningEntries([[STUDY_TIME_KEY, JSON.stringify(data)]]);
    return data;
  });
}

/** 초를 "X시간 Y분" 또는 "Y분" 형식으로 변환 */
export function formatStudyTime(seconds: number): string {
  if (seconds < 60) return `${seconds}초`;
  const mins = Math.floor(seconds / 60);
  const hours = Math.floor(mins / 60);
  const remainMins = mins % 60;
  if (hours > 0)
    return remainMins > 0 ? `${hours}시간 ${remainMins}분` : `${hours}시간`;
  return `${mins}분`;
}
