import pronunciation from "@/assets/korean-pronunciation.json";

type PronunciationEntry = { w: string; p: string; ko: string; ids: string[] };
const byWord = new Map<string, PronunciationEntry>(pronunciation.entries.map(entry => [entry.w, entry]));

/** No spelling fallback, no borrowing another IPA or an unaudited occurrence. */
export function getKoreanPronunciation(item: { id: string; w: string; p: string }): string | null {
  const entry = byWord.get(item.w.trim().toLowerCase());
  return entry && entry.p === item.p && entry.ids.includes(item.id) ? entry.ko : null;
}
