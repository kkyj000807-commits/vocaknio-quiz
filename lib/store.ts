import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useContext } from "react";

export interface StatsData {
  totalAnswered: number;
  totalCorrect: number;
  todayAnswered: number;
  todayDate: string;
  streak: number;
  lastStudyDate: string;
}

export interface BookmarkData {
  wordNums: number[];
}

const STATS_KEY = "vocaknio_stats";
const BOOKMARKS_KEY = "vocaknio_bookmarks";

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

  // Reset today count if new day
  if (stats.todayDate !== today) {
    stats.todayAnswered = 0;
    stats.todayDate = today;
  }

  // Update streak
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
