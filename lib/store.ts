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

// ─── Quiz Settings ────────────────────────────────────────────────────────────

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
