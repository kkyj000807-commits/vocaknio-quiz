import AsyncStorage from "@react-native-async-storage/async-storage";

export interface StatsData {
  totalAnswered: number;
  totalCorrect: number;
  todayAnswered: number;
  todayDate: string;
  streak: number;
  lastStudyDate: string;
}

const STATS_KEY = "vocaknio_stats";
const BOOKMARKS_KEY = "vocaknio_bookmarks";
const WRONG_WORDS_KEY = "vocaknio_wrong_words";

// ─── Stats ────────────────────────────────────────────────────────────────────

export async function loadStats(): Promise<StatsData> {
  try {
    const raw = await AsyncStorage.getItem(STATS_KEY);
    if (raw) return JSON.parse(raw) as StatsData;
  } catch {}
  return {
    totalAnswered: 0,
    totalCorrect: 0,
    todayAnswered: 0,
    todayDate: "",
    streak: 0,
    lastStudyDate: "",
  };
}

export async function saveStats(stats: StatsData): Promise<void> {
  try {
    await AsyncStorage.setItem(STATS_KEY, JSON.stringify(stats));
  } catch {}
}

export async function updateStatsAfterQuiz(
  correct: number,
  total: number
): Promise<StatsData> {
  const stats = await loadStats();
  const today = new Date().toISOString().slice(0, 10);

  if (stats.todayDate !== today) {
    stats.todayAnswered = 0;
    stats.todayDate = today;
  }

  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  if (stats.lastStudyDate === yesterday) {
    stats.streak += 1;
  } else if (stats.lastStudyDate !== today) {
    stats.streak = 1;
  }
  stats.lastStudyDate = today;

  stats.totalAnswered += total;
  stats.totalCorrect += correct;
  stats.todayAnswered += total;

  await saveStats(stats);
  return stats;
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
  try {
    const raw = await AsyncStorage.getItem(WRONG_WORDS_KEY);
    if (raw) return JSON.parse(raw) as number[];
  } catch {}
  return [];
}

/**
 * 오답 단어 num 목록을 저장합니다.
 */
export async function saveWrongWords(nums: number[]): Promise<void> {
  try {
    await AsyncStorage.setItem(WRONG_WORDS_KEY, JSON.stringify(nums));
  } catch {}
}

/**
 * 퀴즈 결과의 오답 num 배열을 기존 오답 목록에 누적 추가합니다.
 * 중복은 제거됩니다.
 */
export async function addWrongWords(newNums: number[]): Promise<number[]> {
  if (newNums.length === 0) return loadWrongWords();
  const existing = await loadWrongWords();
  const merged = Array.from(new Set([...existing, ...newNums]));
  await saveWrongWords(merged);
  return merged;
}

/**
 * 특정 단어를 오답 목록에서 제거합니다 (마스터 처리).
 */
export async function removeWrongWord(num: number): Promise<number[]> {
  const existing = await loadWrongWords();
  const updated = existing.filter((n) => n !== num);
  await saveWrongWords(updated);
  return updated;
}

/**
 * 오답 목록 전체를 초기화합니다.
 */
export async function clearWrongWords(): Promise<void> {
  await saveWrongWords([]);
}

// ─── Per-question realtime update ───────────────────────────────────────────────

/**
 * 한 문제 결과를 즉시 통계에 반영합니다.
 * - isCorrect: 정답 여부
 * - wrongNum: 오답일 경우 단어 num (정답이면 undefined)
 */
export async function recordOneAnswer(
  isCorrect: boolean,
  wrongNum?: number
): Promise<void> {
  // 1) 통계 업데이트
  const stats = await loadStats();
  const today = new Date().toISOString().slice(0, 10);

  if (stats.todayDate !== today) {
    stats.todayAnswered = 0;
    stats.todayDate = today;
  }

  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  if (stats.lastStudyDate === yesterday) {
    stats.streak += 1;
  } else if (stats.lastStudyDate !== today) {
    stats.streak = 1;
  }
  stats.lastStudyDate = today;

  stats.totalAnswered += 1;
  stats.todayAnswered += 1;
  if (isCorrect) stats.totalCorrect += 1;

  await saveStats(stats);

  // 2) 오답이면 오답노트에 추가
  if (!isCorrect && wrongNum !== undefined) {
    await addWrongWords([wrongNum]);
  }
}

// ─── Mastered Words (플래시카드 마스터 제외) ─────────────────────────────────────

const MASTERED_KEY = "vocaknio_mastered";

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
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
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
  if (hours > 0) return remainMins > 0 ? `${hours}시간 ${remainMins}분` : `${hours}시간`;
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
