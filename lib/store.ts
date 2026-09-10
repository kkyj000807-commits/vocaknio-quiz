import AsyncStorage from "@react-native-async-storage/async-storage";
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
import { QUIZ_SESSION_KEY, parseQuizSession, type QuizSession } from "@/lib/quiz-session";

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

let learningStorageQueue: Promise<void> = Promise.resolve();
const pendingLearningWrites = new Map<string, string>();
const lastLearningValues = new Map<string, string>();
const unreadableLearningKeys = new Set<string>();
const knownLearningKeys = new Set<string>();
let learningWriteFailed = false;
const learningStorageListeners = new Set<() => void>();

function validateLearningValue(key: string, raw: string): void {
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
  } else if (key === QUIZ_SESSION_KEY) {
    valid = parseQuizSession(value) !== null;
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
    for (const key of [...unreadableLearningKeys]) await readLearningItem(key);
    if (!unreadableLearningKeys.size) await persistLearningEntries([]);
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
        notifyLearningStorage();
        return null;
      }
    }
    knownLearningKeys.add(key);
    unreadableLearningKeys.delete(key);
    notifyLearningStorage();
    if (value === null) lastLearningValues.delete(key);
    else lastLearningValues.set(key, value);
    return value;
  } catch {
    if (!knownLearningKeys.has(key)) {
      unreadableLearningKeys.add(key);
      notifyLearningStorage();
    }
    return lastLearningValues.get(key) ?? null;
  }
}

async function persistLearningEntries(
  entries: [string, string][],
): Promise<void> {
  // Never replace unreadable prior records with a new empty baseline.
  if (unreadableLearningKeys.size) {
    notifyLearningStorage();
    return;
  }
  for (const [key, value] of entries) {
    pendingLearningWrites.set(key, value);
    lastLearningValues.set(key, value);
  }
  notifyLearningStorage();
  const pending = [...pendingLearningWrites.entries()];
  try {
    await AsyncStorage.multiSet(pending);
    learningWriteFailed = false;
    for (const [key, value] of pending) {
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
function enqueueLearningStorageTask<T>(task: () => Promise<T>): Promise<T> {
  const result = learningStorageQueue.then(task, task);
  learningStorageQueue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
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
  return migrateVocabStorage({
    getItem: (key) => AsyncStorage.getItem(key),
    setItem: (key, value) => AsyncStorage.setItem(key, value),
    setItems: (entries) => AsyncStorage.multiSet(entries),
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

export type AdaptiveAnswerContext = AdaptiveAnswerInput;

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

async function readQuizSessionUnsafe(): Promise<QuizSession | null> {
  const raw = await readLearningItem(QUIZ_SESSION_KEY);
  return raw ? parseQuizSession(JSON.parse(raw)) : null;
}

export function loadQuizSession(): Promise<QuizSession | null> {
  return enqueueLearningStorageTask(readQuizSessionUnsafe);
}

export function saveQuizSession(session: QuizSession): Promise<void> {
  // Capture before joining the queue, so later UI edits cannot change this write.
  const raw = JSON.stringify(session);
  validateLearningValue(QUIZ_SESSION_KEY, raw);
  return enqueueLearningStorageTask(async () => {
    const previous = await readQuizSessionUnsafe();
    if (previous?.sessionId === session.sessionId && previous.completed && !session.completed) return;
    await persistLearningEntries([[QUIZ_SESSION_KEY, raw]]);
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
  const sessionRaw = session ? JSON.stringify(session) : null;
  if (sessionRaw) validateLearningValue(QUIZ_SESSION_KEY, sessionRaw);
  try {
    await enqueueLearningStorageTask(async () => {
      if (sessionRaw) await readQuizSessionUnsafe();
      const history = context ? await readAdaptiveHistoryUnsafe() : null;
      const nextHistory =
        history && context ? recordAdaptiveAnswer(history, context) : null;
      // A duplicate response must not increment global stats while adaptive stats reject it.
      if (history && nextHistory && nextHistory.revision === history.revision)
        return;
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
      stats.totalAnswered += 1;
      stats.todayAnswered += 1;
      if (isCorrect) stats.totalCorrect += 1;

      const entries: [string, string][] = [[STATS_KEY, JSON.stringify(stats)]];
      if (sessionRaw) entries.push([QUIZ_SESSION_KEY, sessionRaw]);

      const wrongItemNum = !isCorrect
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
}

const DEFAULT_QUIZ_SETTINGS: QuizSettings = {
  choiceLang: "korean",
};

export async function loadQuizSettings(): Promise<QuizSettings> {
  try {
    const raw = await AsyncStorage.getItem(QUIZ_SETTINGS_KEY);
    if (raw) return { ...DEFAULT_QUIZ_SETTINGS, ...JSON.parse(raw) };
  } catch {}
  return { ...DEFAULT_QUIZ_SETTINGS };
}

export async function saveQuizSettings(settings: QuizSettings): Promise<void> {
  try {
    await AsyncStorage.setItem(QUIZ_SETTINGS_KEY, JSON.stringify(settings));
  } catch {}
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

// ─── Study Schedule (학습 일정 관리) ─────────────────────────────────────────────

const SCHEDULE_KEY = "vocaknio_schedule";

export interface ScheduleItem {
  /** 고유 ID */
  id: string;
  /** 일정 제목 (예: "동의어 100단어 복습") */
  title: string;
  /** 날짜 (YYYY-MM-DD) */
  date: string;
  /** 시간 (HH:MM) — 선택 */
  time?: string;
  /** 메모 — 선택 */
  memo?: string;
  /** 완료 여부 */
  done: boolean;
  /** 생성 시각 (ms) */
  createdAt: number;
}

/** 일정 정렬: 날짜 → 시간(없으면 뒤) → 생성순 */
function sortSchedules(items: ScheduleItem[]): ScheduleItem[] {
  return [...items].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    const at = a.time ?? "99:99";
    const bt = b.time ?? "99:99";
    if (at !== bt) return at < bt ? -1 : 1;
    return a.createdAt - b.createdAt;
  });
}

/** 일정 목록을 불러옵니다 (날짜·시간순 정렬). */
export async function loadSchedules(): Promise<ScheduleItem[]> {
  try {
    const raw = await AsyncStorage.getItem(SCHEDULE_KEY);
    if (raw) return sortSchedules(JSON.parse(raw) as ScheduleItem[]);
  } catch {}
  return [];
}

/** 일정 목록을 저장합니다. */
export async function saveSchedules(items: ScheduleItem[]): Promise<void> {
  try {
    await AsyncStorage.setItem(SCHEDULE_KEY, JSON.stringify(items));
  } catch {}
}

/** 새 일정을 추가하고 정렬된 전체 목록을 반환합니다. */
export async function addSchedule(input: {
  title: string;
  date: string;
  time?: string;
  memo?: string;
}): Promise<ScheduleItem[]> {
  const items = await loadSchedules();
  const now = Date.now();
  const item: ScheduleItem = {
    id: `${now}_${Math.floor(Math.random() * 1e6)}`,
    title: input.title.trim(),
    date: input.date,
    time: input.time?.trim() || undefined,
    memo: input.memo?.trim() || undefined,
    done: false,
    createdAt: now,
  };
  const updated = sortSchedules([...items, item]);
  await saveSchedules(updated);
  return updated;
}

/** 기존 일정을 수정합니다. */
export async function updateSchedule(
  id: string,
  patch: Partial<Omit<ScheduleItem, "id" | "createdAt">>
): Promise<ScheduleItem[]> {
  const items = await loadSchedules();
  const updated = sortSchedules(
    items.map((it) =>
      it.id === id
        ? {
            ...it,
            ...patch,
            time: patch.time !== undefined ? patch.time || undefined : it.time,
            memo: patch.memo !== undefined ? patch.memo || undefined : it.memo,
          }
        : it
    )
  );
  await saveSchedules(updated);
  return updated;
}

/** 일정 완료 상태를 토글합니다. */
export async function toggleSchedule(id: string): Promise<ScheduleItem[]> {
  const items = await loadSchedules();
  const updated = items.map((it) =>
    it.id === id ? { ...it, done: !it.done } : it
  );
  await saveSchedules(updated);
  return sortSchedules(updated);
}

/** 일정을 삭제합니다. */
export async function removeSchedule(id: string): Promise<ScheduleItem[]> {
  const items = await loadSchedules();
  const updated = items.filter((it) => it.id !== id);
  await saveSchedules(updated);
  return updated;
}

/** 완료된 일정을 모두 삭제합니다. */
export async function clearDoneSchedules(): Promise<ScheduleItem[]> {
  const items = await loadSchedules();
  const updated = items.filter((it) => !it.done);
  await saveSchedules(updated);
  return updated;
}
