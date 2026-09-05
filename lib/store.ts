import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  deserializeAdaptiveHistory,
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
export const ADAPTIVE_QUIZ_HISTORY_KEY = "vocaknio_adaptive_quiz_history_v1";

let learningStorageQueue: Promise<void> = Promise.resolve();
const pendingLearningWrites = new Map<string, string>();
const lastLearningValues = new Map<string, string>();

async function readLearningItem(key: string): Promise<string | null> {
  if (pendingLearningWrites.has(key)) return pendingLearningWrites.get(key)!;
  try {
    const value = await AsyncStorage.getItem(key);
    if (value === null) lastLearningValues.delete(key);
    else lastLearningValues.set(key, value);
    return value;
  } catch {
    return lastLearningValues.get(key) ?? null;
  }
}

async function persistLearningEntries(entries: [string, string][]): Promise<void> {
  for (const [key, value] of entries) {
    pendingLearningWrites.set(key, value);
    lastLearningValues.set(key, value);
  }
  const pending = [...pendingLearningWrites.entries()];
  try {
    await AsyncStorage.multiSet(pending);
    for (const [key, value] of pending) {
      if (pendingLearningWrites.get(key) === value) pendingLearningWrites.delete(key);
    }
  } catch {
    // Keep answers and sessions in this tab and retry them on the next mutation.
  }
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
  try {
    await enqueueLearningStorageTask(() =>
      AsyncStorage.setItem(STATS_KEY, JSON.stringify(stats)),
    );
  } catch {}
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

    try {
      await AsyncStorage.setItem(STATS_KEY, JSON.stringify(stats));
    } catch {}
    return stats;
  });
}

// ─── Bookmarks ────────────────────────────────────────────────────────────────

export async function loadBookmarks(): Promise<number[]> {
  try {
    const raw = await AsyncStorage.getItem(BOOKMARKS_KEY);
    if (raw) return JSON.parse(raw) as number[];
  } catch {}
  return [];
}

export async function saveBookmarks(nums: number[]): Promise<void> {
  try {
    await AsyncStorage.setItem(BOOKMARKS_KEY, JSON.stringify(nums));
  } catch {}
}

export async function toggleBookmark(num: number): Promise<number[]> {
  const bookmarks = await loadBookmarks();
  const idx = bookmarks.indexOf(num);
  if (idx >= 0) {
    bookmarks.splice(idx, 1);
  } else {
    bookmarks.push(num);
  }
  await saveBookmarks(bookmarks);
  return bookmarks;
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
  try {
    const normalized = [
      ...new Set(nums.filter((value) => Number.isInteger(value) && value > 0)),
    ];
    await enqueueLearningStorageTask(() =>
      AsyncStorage.setItem(WRONG_WORDS_KEY, JSON.stringify(normalized)),
    );
  } catch {}
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
    try {
      await AsyncStorage.setItem(WRONG_WORDS_KEY, JSON.stringify(merged));
    } catch {}
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
    try {
      await AsyncStorage.setItem(WRONG_WORDS_KEY, JSON.stringify(updated));
    } catch {}
    return updated;
  });
}

/**
 * 오답 목록 전체를 초기화합니다.
 */
export async function clearWrongWords(): Promise<void> {
  try {
    await enqueueLearningStorageTask(() =>
      AsyncStorage.setItem(WRONG_WORDS_KEY, JSON.stringify([])),
    );
  } catch {}
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
): Promise<void> {
  try {
    await enqueueLearningStorageTask(async () => {
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

      if (context) {
        const history = await readAdaptiveHistoryUnsafe();
        const nextHistory = recordAdaptiveAnswer(history, context);
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

const MASTERED_KEY = VOCAB_LIST_STORAGE_KEYS.mastered;

/**
 * 마스터 처리된 단어 num 목록을 불러옵니다.
 */
export async function loadMastered(): Promise<number[]> {
  try {
    const raw = await AsyncStorage.getItem(MASTERED_KEY);
    if (raw) return JSON.parse(raw) as number[];
  } catch {}
  return [];
}

/**
 * 단어를 마스터 목록에 추가합니다.
 */
export async function addMastered(num: number): Promise<number[]> {
  const existing = await loadMastered();
  if (existing.includes(num)) return existing;
  const updated = [...existing, num];
  try {
    await AsyncStorage.setItem(MASTERED_KEY, JSON.stringify(updated));
  } catch {}
  return updated;
}

/**
 * 마스터 목록 전체를 초기화합니다 (리셋).
 */
export async function clearMastered(): Promise<void> {
  try {
    await AsyncStorage.setItem(MASTERED_KEY, JSON.stringify([]));
  } catch {}
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

const STUDY_TIME_KEY = "vocaknio_study_time";

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
  try {
    const raw = await AsyncStorage.getItem(STUDY_TIME_KEY);
    if (raw) return JSON.parse(raw) as StudyTimeData;
  } catch {}
  return {
    todayDate: "",
    todaySeconds: 0,
    weekSeconds: 0,
    weekKey: "",
    totalSeconds: 0,
    dailyLog: {},
  };
}

export async function saveStudyTime(data: StudyTimeData): Promise<void> {
  try {
    await AsyncStorage.setItem(STUDY_TIME_KEY, JSON.stringify(data));
  } catch {}
}

/**
 * 학습 시간(초)을 누적합니다.
 * - 오늘/이번 주가 바뀌면 자동으로 리셋 후 누적
 * - dailyLog는 최근 30일만 유지
 */
export async function addStudySeconds(seconds: number): Promise<StudyTimeData> {
  if (seconds <= 0) return loadStudyTime();

  const data = await loadStudyTime();
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

  await saveStudyTime(data);
  return data;
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
