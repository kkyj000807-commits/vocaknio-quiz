import vocabRaw from "@/assets/vocab.json";

export interface VocabItem {
  num: number;
  w: string;     // word
  k: string;     // Korean meaning (full)
  k_short: string; // Korean meaning (short)
  s: string[];   // synonyms
  p: string;     // IPA pronunciation
}

export const VOCAB: VocabItem[] = vocabRaw as VocabItem[];

export const VOCAB_WITH_SYNONYMS = VOCAB.filter(
  (v) => v.s && v.s.length > 0
);

// All unique synonyms for distractor generation
export const ALL_SYNONYMS: string[] = Array.from(
  new Set(VOCAB.flatMap((v) => v.s))
);

export const RANGES = [
  { id: "0-999",    label: "1~1000번",    start: 0,    end: 999 },
  { id: "1000-1999", label: "1001~2000번", start: 1000, end: 1999 },
  { id: "2000-2999", label: "2001~3000번", start: 2000, end: 2999 },
  { id: "3000-3999", label: "3001~4000번", start: 3000, end: 3999 },
  { id: "4000-4999", label: "4001~5000번", start: 4000, end: 4999 },
  { id: "5000-5999", label: "5001~6000번", start: 5000, end: 5999 },
  { id: "6000-6999", label: "6001~7000번", start: 6000, end: 6999 },
  { id: "7000-7586", label: "7001~7587번", start: 7000, end: 7586 },
  { id: "all",      label: "전체",         start: 0,    end: VOCAB.length - 1 },
];

export const COUNTS = [10, 20, 30, 50];

export type QuizMode = "syn-choice" | "kor-choice" | "flashcard" | "syn-type";

export const QUIZ_MODES: { id: QuizMode; icon: string; title: string; desc: string }[] = [
  { id: "syn-choice", icon: "🔗", title: "동의어 고르기",   desc: "영어 단어 → 동의어 4택" },
  { id: "kor-choice", icon: "🇰🇷", title: "한국어 뜻 고르기", desc: "영어 단어 → 한국어 뜻 4택" },
  { id: "flashcard",  icon: "⚡", title: "플래시카드",      desc: "뜻 확인 후 자가 채점" },
  { id: "syn-type",   icon: "✍️", title: "동의어 입력",     desc: "동의어를 직접 타이핑" },
];

// Shuffle array (Fisher-Yates)
export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Get distractors for synonym choice
export function getSynDistractors(
  target: VocabItem,
  correctSyn: string,
  count = 3
): string[] {
  const distractors: string[] = [];
  const used = new Set([correctSyn, ...target.s]);
  const pool = shuffle(ALL_SYNONYMS);
  for (const syn of pool) {
    if (!used.has(syn) && distractors.length < count) {
      distractors.push(syn);
      used.add(syn);
    }
    if (distractors.length >= count) break;
  }
  return distractors;
}

// Get distractors for Korean meaning choice
export function getKorDistractors(
  target: VocabItem,
  pool: VocabItem[],
  count = 3
): string[] {
  const distractors: string[] = [];
  const used = new Set([target.k]);
  const shuffled = shuffle(pool);
  for (const item of shuffled) {
    if (!used.has(item.k) && item.k && item.k.length > 2 && distractors.length < count) {
      distractors.push(item.k);
      used.add(item.k);
    }
    if (distractors.length >= count) break;
  }
  return distractors;
}
