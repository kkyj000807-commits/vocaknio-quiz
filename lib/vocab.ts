import vocabRaw from "@/assets/vocab.json";

export interface VocabItem {
  num: number;
  w: string;     // word
  k: string;     // Korean meaning (full)
  k_short: string; // Korean meaning (short)
  s: string[];   // synonyms
  p: string;     // IPA pronunciation
  category?: string; // semantic category
  type?: 'word' | 'idiom' | 'phrase'; // entry type
  antonym?: string[]; // antonyms (반의어) - 오답 선지 우선 사용
}

// antonym -> 해당 반의어를 가진 단어(w)들의 집합 (역방향 인덱스)
const ANTONYM_TO_WORDS: Map<string, Set<string>> = new Map();

export const VOCAB: VocabItem[] = vocabRaw as VocabItem[];

export const VOCAB_WITH_SYNONYMS = VOCAB.filter(
  (v) => v.s && v.s.length > 0
);

// All unique synonyms for distractor generation
export const ALL_SYNONYMS: string[] = Array.from(
  new Set(VOCAB.flatMap((v) => v.s))
);

// ─── 역방향 인덱스 빌드 ───────────────────────────────────────────────────────
// syn -> 해당 동의어를 가진 단어(w)들의 집합
const SYN_TO_WORDS: Map<string, Set<string>> = new Map();
for (const item of VOCAB) {
  for (const s of item.s) {
    if (!SYN_TO_WORDS.has(s)) SYN_TO_WORDS.set(s, new Set());
    SYN_TO_WORDS.get(s)!.add(item.w);
  }
}

// word -> 동의어 집합
const WORD_TO_SYNS: Map<string, Set<string>> = new Map();
for (const item of VOCAB) {
  WORD_TO_SYNS.set(item.w, new Set(item.s));
}

// antonym 역방향 인덱스 빌드
for (const item of VOCAB) {
  if (!item.antonym) continue;
  for (const ant of item.antonym) {
    if (!ANTONYM_TO_WORDS.has(ant)) ANTONYM_TO_WORDS.set(ant, new Set());
    ANTONYM_TO_WORDS.get(ant)!.add(item.w);
  }
}

/**
 * 특정 단어의 반의어 목록을 반환한다.
 * vocab.json의 antonym 필드 + 역방향 인덱스(다른 단어의 antonym에 이 단어가 포함된 경우) 합산.
 */
export function getAntonyms(item: VocabItem): string[] {
  const result = new Set<string>(item.antonym ?? []);
  // 다른 단어들의 antonym에 이 단어(w)가 포함되어 있으면, 그 단어의 antonym들도 반의어
  const reverseAnts = ANTONYM_TO_WORDS.get(item.w);
  if (reverseAnts) {
    for (const antWord of reverseAnts) {
      const antItem = VOCAB.find(v => v.w === antWord);
      if (antItem?.antonym) {
        for (const a of antItem.antonym) result.add(a);
      }
    }
  }
  // 자기 자신과 자신의 동의어는 제외
  result.delete(item.w);
  for (const s of item.s) result.delete(s);
  return Array.from(result);
}

/**
 * 특정 단어에 대해 오답 보기로 사용할 수 없는 동의어 집합을 반환한다.
 *
 * 금지 범위:
 *  1. 단어 자신 (w)
 *  2. 단어의 직접 동의어 (s[])
 *  3. 직접 동의어를 공유하는 다른 단어들의 동의어
 *     (= 같은 의미 그룹에 속하는 "형제 동의어")
 *
 * 이렇게 하면 정답과 의미적으로 겹치는 단어가 오답 보기에 나오지 않는다.
 */
export function getForbiddenSyns(item: VocabItem): Set<string> {
  const forbidden = new Set<string>(item.s);
  forbidden.add(item.w);

  for (const syn of item.s) {
    const siblingWords = SYN_TO_WORDS.get(syn);
    if (!siblingWords) continue;
    for (const siblingWord of siblingWords) {
      if (siblingWord === item.w) continue;
      const sibSyns = WORD_TO_SYNS.get(siblingWord);
      if (sibSyns) {
        for (const ss of sibSyns) forbidden.add(ss);
      }
    }
  }

  return forbidden;
}

export const RANGES = [
  { id: "0-999",    label: "1~1000번",    start: 0,    end: 999 },
  { id: "1000-1999", label: "1001~2000번", start: 1000, end: 1999 },
  { id: "2000-2999", label: "2001~3000번", start: 2000, end: 2999 },
  { id: "3000-3999", label: "3001~4000번", start: 3000, end: 3999 },
  { id: "4000-4999", label: "4001~5000번", start: 4000, end: 4999 },
  { id: "5000-5999", label: "5001~6000번", start: 5000, end: 5999 },
  { id: "6000-6999", label: "6001~7000번", start: 6000, end: 6999 },
  { id: "7000-7999", label: "7001~8000번", start: 7000, end: 7999 },
  { id: "8000-9516", label: "8001~9517번", start: 8000, end: 9516 },
  { id: "idioms",   label: "숙어·표현",    start: 0,    end: VOCAB.length - 1 },
  { id: "all",      label: "전체",         start: 0,    end: VOCAB.length - 1 },
];

// 숙어 필터
export const VOCAB_IDIOMS = VOCAB.filter(
  (v) => v.type === 'idiom' || v.type === 'phrase'
);

// 단어만 (숙어 제외)
export const VOCAB_WORDS_ONLY = VOCAB.filter(
  (v) => !v.type || v.type === 'word'
);

export const COUNTS = [10, 20, 30, 50];

export type QuizMode = "syn-choice" | "kor-choice" | "syn-kor-choice" | "flashcard" | "syn-type";

export const QUIZ_MODES: { id: QuizMode; icon: string; title: string; desc: string }[] = [
  { id: "syn-choice",     icon: "🔗", title: "동의어 고르기",       desc: "영어 단어 → 동의어 4택" },
  { id: "kor-choice",     icon: "🇰🇷", title: "한국어 뜻 고르기",   desc: "영어 단어 → 한국어 뜻 4택" },
  { id: "syn-kor-choice", icon: "🔀", title: "동의어+뜻 고르기",   desc: "동의어(한글뜻) 복합 4택" },
  { id: "flashcard",      icon: "⚡", title: "플래시카드",          desc: "뜻 확인 후 자가 채점" },
  { id: "syn-type",       icon: "✍️", title: "동의어 입력",         desc: "동의어를 직접 타이핑" },
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

/**
 * 동의어 고르기 모드용 오답 보기 생성
 *
 * 개선점:
 * - 반의어(antonym)를 오답 선지로 우선 사용 → 편입 시험 사고 훈련에 적합
 * - getForbiddenSyns()로 의미적으로 겹치는 동의어 전체를 금지
 * - 오답 보기가 부족할 경우 fallback으로 단순 단어(w) 목록에서 보충
 */
export function getSynDistractors(
  target: VocabItem,
  correctSyn: string,
  count = 3
): string[] {
  const forbidden = getForbiddenSyns(target);
  forbidden.add(correctSyn);

  const distractors: string[] = [];

  // 1순위: 반의어를 오답 선지로 우선 사용
  const antonyms = shuffle(getAntonyms(target));
  for (const ant of antonyms) {
    if (!forbidden.has(ant) && distractors.length < count) {
      distractors.push(ant);
      forbidden.add(ant);
    }
  }

  // 2순위: 반의어가 부족하면 일반 동의어 풀에서 보충
  if (distractors.length < count) {
    const pool = shuffle(ALL_SYNONYMS);
    for (const syn of pool) {
      if (!forbidden.has(syn)) {
        distractors.push(syn);
        forbidden.add(syn);
      }
      if (distractors.length >= count) break;
    }
  }

  // 3순위: 풀이 부족한 극단적 케이스 - 단어 자체(w)로 보충
  if (distractors.length < count) {
    const wordPool = shuffle(VOCAB.map((v) => v.w));
    for (const w of wordPool) {
      if (!forbidden.has(w) && distractors.length < count) {
        distractors.push(w);
        forbidden.add(w);
      }
    }
  }

  return distractors.slice(0, count);
}

/**
 * 동의어+한글뜻 복합 모드용 보기 생성
 * 각 보기는 "synonym (\ud55c글뜻)" 형태의 문자열.
 */
export function getSynWithKorDistractors(
  target: VocabItem,
  correctSyn: string,
  count = 3
): string[] {
  const forbidden = getForbiddenSyns(target);
  forbidden.add(correctSyn);

  const forbiddenK = new Set<string>();
  if (target.k_short) forbiddenK.add(target.k_short);
  if (target.k) forbiddenK.add(target.k);
  for (const item of VOCAB) {
    if (item.w !== target.w && item.s.some((s) => forbidden.has(s))) {
      if (item.k_short) forbiddenK.add(item.k_short);
      if (item.k) forbiddenK.add(item.k);
    }
  }

  const distractors: string[] = [];
  const usedSyn = new Set<string>(forbidden);
  const usedK = new Set<string>(forbiddenK);

  const shuffledVocab = shuffle(VOCAB);
  for (const item of shuffledVocab) {
    if (item.w === target.w) continue;
    if (!item.s || item.s.length === 0) continue;
    if (!item.k_short || item.k_short.length < 2) continue;
    if (usedK.has(item.k_short) || usedK.has(item.k)) continue;
    const availableSyns = item.s.filter((s) => !usedSyn.has(s));
    if (availableSyns.length === 0) continue;
    const syn = availableSyns[Math.floor(Math.random() * availableSyns.length)];
    distractors.push(`${syn} (${item.k_short})`);
    usedSyn.add(syn);
    usedK.add(item.k_short);
    if (item.k) usedK.add(item.k);
    if (distractors.length >= count) break;
  }

  if (distractors.length < count) {
    for (const item of shuffledVocab) {
      if (item.w === target.w) continue;
      if (!item.k_short || item.k_short.length < 2) continue;
      if (usedK.has(item.k_short)) continue;
      distractors.push(`${item.w} (${item.k_short})`);
      usedK.add(item.k_short);
      if (distractors.length >= count) break;
    }
  }

  return distractors.slice(0, count);
}

export function makeSynKorLabel(syn: string, item: VocabItem): string {
  return `${syn} (${item.k_short || item.k})`;
}

/**
 * 한국어 뜻 고르기 모드용 오답 보기 생성
 *
 * 개선점:
 * - 정답(k)과 동일한 k를 가진 항목 제외 (k 중복 방지)
 * - k_short 기준으로도 중복 체크 (의미 유사 뜻 제거)
 * - 정답 단어의 동의어들이 가진 k도 금지 (의미 그룹 중복 방지)
 */
export function getKorDistractors(
  target: VocabItem,
  pool: VocabItem[],
  count = 3
): string[] {
  // 금지할 k 값 집합 구성
  const forbiddenK = new Set<string>();
  forbiddenK.add(target.k);
  if (target.k_short) forbiddenK.add(target.k_short);

  // 정답 단어의 동의어들을 가진 단어들의 k도 금지
  const forbidden = getForbiddenSyns(target);
  for (const item of VOCAB) {
    if (item.w !== target.w && item.s.some((s) => forbidden.has(s))) {
      if (item.k) forbiddenK.add(item.k);
      if (item.k_short) forbiddenK.add(item.k_short);
    }
  }

  const distractors: string[] = [];
  const usedK = new Set<string>(forbiddenK);
  const shuffled = shuffle(pool);

  for (const item of shuffled) {
    if (
      item.w !== target.w &&
      item.k &&
      item.k.length > 2 &&
      !usedK.has(item.k)
    ) {
      distractors.push(item.k);
      usedK.add(item.k);
      // k_short도 중복 방지용으로 등록
      if (item.k_short) usedK.add(item.k_short);
    }
    if (distractors.length >= count) break;
  }

  // 풀 부족 시 전체 VOCAB에서 보충
  if (distractors.length < count) {
    const globalPool = shuffle(VOCAB);
    for (const item of globalPool) {
      if (
        item.w !== target.w &&
        item.k &&
        item.k.length > 2 &&
        !usedK.has(item.k) &&
        distractors.length < count
      ) {
        distractors.push(item.k);
        usedK.add(item.k);
      }
    }
  }

  return distractors.slice(0, count);
}
