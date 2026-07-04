import vocabRaw from "@/assets/vocab.json";
import synGlossRaw from "@/assets/syn-gloss.json";

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
  wrongPool?: string[]; // 오답 선지 블랙리스트 (w값) - 오개념 유발 단어 제외
  etym?: string; // 어원/암기 첨언 (영영사전 기준, 왜 이런 뜻이 되는지 설명)
  def?: string; // 영영사전 정의
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

// word(소문자) -> VocabItem (표제어 조회용)
const WORD_TO_ITEM: Map<string, VocabItem> = new Map();
for (const item of VOCAB) {
  const key = item.w.toLowerCase();
  if (!WORD_TO_ITEM.has(key)) WORD_TO_ITEM.set(key, item);
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
  // ── DAY 단위 (50개씩, 1~1000번) ─────────────────────────────────────────
  { id: "d01", label: "DAY 01  (1~50)", start: 0, end: 49 },
  { id: "d02", label: "DAY 02  (51~100)", start: 50, end: 99 },
  { id: "d03", label: "DAY 03  (101~150)", start: 100, end: 149 },
  { id: "d04", label: "DAY 04  (151~200)", start: 150, end: 199 },
  { id: "d05", label: "DAY 05  (201~250)", start: 200, end: 249 },
  { id: "d06", label: "DAY 06  (251~300)", start: 250, end: 299 },
  { id: "d07", label: "DAY 07  (301~350)", start: 300, end: 349 },
  { id: "d08", label: "DAY 08  (351~400)", start: 350, end: 399 },
  { id: "d09", label: "DAY 09  (401~450)", start: 400, end: 449 },
  { id: "d10", label: "DAY 10  (451~500)", start: 450, end: 499 },
  { id: "d11", label: "DAY 11  (501~550)", start: 500, end: 549 },
  { id: "d12", label: "DAY 12  (551~600)", start: 550, end: 599 },
  { id: "d13", label: "DAY 13  (601~650)", start: 600, end: 649 },
  { id: "d14", label: "DAY 14  (651~700)", start: 650, end: 699 },
  { id: "d15", label: "DAY 15  (701~750)", start: 700, end: 749 },
  { id: "d16", label: "DAY 16  (751~800)", start: 750, end: 799 },
  { id: "d17", label: "DAY 17  (801~850)", start: 800, end: 849 },
  { id: "d18", label: "DAY 18  (851~900)", start: 850, end: 899 },
  { id: "d19", label: "DAY 19  (901~950)", start: 900, end: 949 },
  { id: "d20", label: "DAY 20  (951~1000)", start: 950, end: 999 },
  // ── 100단위 (1001번 이후) ────────────────────────────────────────────────
  { id: "w1000", label: "1001~1100번", start: 1000, end: 1099 },
  { id: "w1100", label: "1101~1200번", start: 1100, end: 1199 },
  { id: "w1200", label: "1201~1300번", start: 1200, end: 1299 },
  { id: "w1300", label: "1301~1400번", start: 1300, end: 1399 },
  { id: "w1400", label: "1401~1500번", start: 1400, end: 1499 },
  { id: "w1500", label: "1501~1600번", start: 1500, end: 1599 },
  { id: "w1600", label: "1601~1700번", start: 1600, end: 1699 },
  { id: "w1700", label: "1701~1800번", start: 1700, end: 1799 },
  { id: "w1800", label: "1801~1900번", start: 1800, end: 1899 },
  { id: "w1900", label: "1901~2000번", start: 1900, end: 1999 },
  { id: "w2000", label: "2001~2100번", start: 2000, end: 2099 },
  { id: "w2100", label: "2101~2200번", start: 2100, end: 2199 },
  { id: "w2200", label: "2201~2300번", start: 2200, end: 2299 },
  { id: "w2300", label: "2301~2400번", start: 2300, end: 2399 },
  { id: "w2400", label: "2401~2500번", start: 2400, end: 2499 },
  { id: "w2500", label: "2501~2600번", start: 2500, end: 2599 },
  { id: "w2600", label: "2601~2700번", start: 2600, end: 2699 },
  { id: "w2700", label: "2701~2800번", start: 2700, end: 2799 },
  { id: "w2800", label: "2801~2900번", start: 2800, end: 2899 },
  { id: "w2900", label: "2901~3000번", start: 2900, end: 2999 },
  { id: "w3000", label: "3001~3100번", start: 3000, end: 3099 },
  { id: "w3100", label: "3101~3200번", start: 3100, end: 3199 },
  { id: "w3200", label: "3201~3300번", start: 3200, end: 3299 },
  { id: "w3300", label: "3301~3400번", start: 3300, end: 3399 },
  { id: "w3400", label: "3401~3500번", start: 3400, end: 3499 },
  { id: "w3500", label: "3501~3600번", start: 3500, end: 3599 },
  { id: "w3600", label: "3601~3700번", start: 3600, end: 3699 },
  { id: "w3700", label: "3701~3800번", start: 3700, end: 3799 },
  { id: "w3800", label: "3801~3900번", start: 3800, end: 3899 },
  { id: "w3900", label: "3901~4000번", start: 3900, end: 3999 },
  { id: "w4000", label: "4001~4100번", start: 4000, end: 4099 },
  { id: "w4100", label: "4101~4200번", start: 4100, end: 4199 },
  { id: "w4200", label: "4201~4300번", start: 4200, end: 4299 },
  { id: "w4300", label: "4301~4400번", start: 4300, end: 4399 },
  { id: "w4400", label: "4401~4500번", start: 4400, end: 4499 },
  { id: "w4500", label: "4501~4600번", start: 4500, end: 4599 },
  { id: "w4600", label: "4601~4700번", start: 4600, end: 4699 },
  { id: "w4700", label: "4701~4800번", start: 4700, end: 4799 },
  { id: "w4800", label: "4801~4900번", start: 4800, end: 4899 },
  { id: "w4900", label: "4901~5000번", start: 4900, end: 4999 },
  { id: "w5000", label: "5001~5100번", start: 5000, end: 5099 },
  { id: "w5100", label: "5101~5200번", start: 5100, end: 5199 },
  { id: "w5200", label: "5201~5300번", start: 5200, end: 5299 },
  { id: "w5300", label: "5301~5400번", start: 5300, end: 5399 },
  { id: "w5400", label: "5401~5500번", start: 5400, end: 5499 },
  { id: "w5500", label: "5501~5600번", start: 5500, end: 5599 },
  { id: "w5600", label: "5601~5700번", start: 5600, end: 5699 },
  { id: "w5700", label: "5701~5800번", start: 5700, end: 5799 },
  { id: "w5800", label: "5801~5900번", start: 5800, end: 5899 },
  { id: "w5900", label: "5901~6000번", start: 5900, end: 5999 },
  { id: "w6000", label: "6001~6100번", start: 6000, end: 6099 },
  { id: "w6100", label: "6101~6200번", start: 6100, end: 6199 },
  { id: "w6200", label: "6201~6300번", start: 6200, end: 6299 },
  { id: "w6300", label: "6301~6400번", start: 6300, end: 6399 },
  { id: "w6400", label: "6401~6500번", start: 6400, end: 6499 },
  { id: "w6500", label: "6501~6600번", start: 6500, end: 6599 },
  { id: "w6600", label: "6601~6700번", start: 6600, end: 6699 },
  { id: "w6700", label: "6701~6800번", start: 6700, end: 6799 },
  { id: "w6800", label: "6801~6900번", start: 6800, end: 6899 },
  { id: "w6900", label: "6901~7000번", start: 6900, end: 6999 },
  { id: "w7000", label: "7001~7100번", start: 7000, end: 7099 },
  { id: "w7100", label: "7101~7200번", start: 7100, end: 7199 },
  { id: "w7200", label: "7201~7300번", start: 7200, end: 7299 },
  { id: "w7300", label: "7301~7400번", start: 7300, end: 7399 },
  { id: "w7400", label: "7401~7500번", start: 7400, end: 7499 },
  { id: "w7500", label: "7501~7600번", start: 7500, end: 7599 },
  { id: "w7600", label: "7601~7700번", start: 7600, end: 7699 },
  { id: "w7700", label: "7701~7800번", start: 7700, end: 7799 },
  { id: "w7800", label: "7801~7900번", start: 7800, end: 7899 },
  { id: "w7900", label: "7901~8000번", start: 7900, end: 7999 },
  { id: "w8000", label: "8001~8100번", start: 8000, end: 8099 },
  { id: "w8100", label: "8101~8200번", start: 8100, end: 8199 },
  { id: "w8200", label: "8201~8300번", start: 8200, end: 8299 },
  { id: "w8300", label: "8301~8400번", start: 8300, end: 8399 },
  { id: "w8400", label: "8401~8500번", start: 8400, end: 8499 },
  { id: "w8500", label: "8501~8600번", start: 8500, end: 8599 },
  { id: "w8600", label: "8601~8700번", start: 8600, end: 8699 },
  { id: "w8700", label: "8701~8800번", start: 8700, end: 8799 },
  { id: "w8800", label: "8801~8900번", start: 8800, end: 8899 },
  { id: "w8900", label: "8901~9000번", start: 8900, end: 8999 },
  { id: "w9000", label: "9001~9100번", start: 9000, end: 9099 },
  { id: "w9100", label: "9101~9200번", start: 9100, end: 9199 },
  { id: "w9200", label: "9201~9300번", start: 9200, end: 9299 },
  { id: "w9300", label: "9301~9400번", start: 9300, end: 9399 },
  { id: "w9400", label: "9401~9500번", start: 9400, end: 9499 },
  { id: "w9500", label: "9501~9517번", start: 9500, end: 9516 },
  { id: "idioms", label: "숙어·표현",    start: 0,    end: VOCAB.length - 1 },
  { id: "all",    label: "전체",         start: 0,    end: VOCAB.length - 1 },
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
 * 반의어 방향(반대 의미) 후보 목록: 반의어 자체 + 반의어 표제어의 동의어들.
 * 정답과 의미가 겹치는 단어(forbidden)는 호출부에서 걸러진다.
 */
export function getAntonymDirection(target: VocabItem): string[] {
  const result = new Set<string>(getAntonyms(target));
  for (const ant of Array.from(result)) {
    const antSyns = WORD_TO_SYNS.get(ant);
    if (antSyns) {
      for (const s of antSyns) result.add(s);
    }
  }
  result.delete(target.w);
  for (const s of target.s) result.delete(s);
  return Array.from(result);
}

/**
 * 동의어 고르기 모드용 오답 보기 생성
 *
 * 오답 구성 원칙 (오개념 방지, 전 섹션 공통):
 * - 정답 방향과 헷갈릴 여지가 없도록, 오답 = 반의어 방향 단어들 + 아예 무관한 단어 1개
 * - getForbiddenSyns()로 의미적으로 겹치는 동의어 전체를 금지
 * - 반의어 방향 후보가 부족하면 무관 단어로 채움 (유사어로는 절대 채우지 않음)
 */
export function getSynDistractors(
  target: VocabItem,
  correctSyn: string,
  count = 3
): string[] {
  const forbidden = getForbiddenSyns(target);
  forbidden.add(correctSyn);

  // wrongPool 단어들의 동의어도 오답 선지에서 제외
  if (target.wrongPool && target.wrongPool.length > 0) {
    for (const wpWord of target.wrongPool) {
      const wpSyns = WORD_TO_SYNS.get(wpWord);
      if (wpSyns) {
        for (const s of wpSyns) forbidden.add(s);
      }
    }
  }

  const distractors: string[] = [];

  // 반의어 방향 단어: 최대 count-1개 (마지막 1자리는 무관 단어 몫)
  const antonymSlots = count - 1;
  const antDirection = shuffle(getAntonymDirection(target));
  const antSet = new Set(antDirection);
  for (const ant of antDirection) {
    if (!forbidden.has(ant) && distractors.length < antonymSlots) {
      distractors.push(ant);
      forbidden.add(ant);
    }
  }

  // 무관 단어: 반의어 방향도 아니고 의미도 겹치지 않는 단어로 나머지 자리 채움
  if (distractors.length < count) {
    const pool = shuffle(ALL_SYNONYMS);
    for (const syn of pool) {
      if (!forbidden.has(syn) && !antSet.has(syn)) {
        distractors.push(syn);
        forbidden.add(syn);
      }
      if (distractors.length >= count) break;
    }
  }

  // 풀이 부족한 극단적 케이스 - 단어 자체(w)로 보충
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

  // 1) 오개념 방지: 반의어 방향 단어를 최대 count-1개 (마지막 1자리는 무관 단어 몫)
  const antonymSlots = count - 1;
  for (const ant of shuffle(getAntonymDirection(target))) {
    if (distractors.length >= antonymSlots) break;
    if (usedSyn.has(ant)) continue;
    const g = korGloss(ant);
    if (!g || usedK.has(g)) continue;
    distractors.push(`${ant} (${g})`);
    usedSyn.add(ant);
    usedK.add(g);
  }

  // 2) 무관 단어로 나머지 자리 채움
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

// ─── 동의어 한글 병기 (TFD식 시소러스 + 한국인용 괄호 한글뜻) ─────────────────

// 단어장에 없는 동의어용 보조 한글뜻 사전
const SYN_GLOSS: Record<string, string> = synGlossRaw as Record<string, string>;

// 표제어 → 짧은 한글뜻 (lazy 초기화)
let WORD_KOR: Map<string, string> | null = null;

// k_short에서 짧은 대표 한글뜻만 추출 (품사표기·괄호·뒷의미 제거)
function shortKor(k: string): string {
  let s = k.replace(/^[a-z]{1,4}\.\s*/i, "");
  s = s.split(";")[0];
  s = s.replace(/\([^)]*\)/g, "").replace(/\s+/g, " ").trim();
  const parts = s.split(",").map((x) => x.trim()).filter(Boolean);
  s = parts.slice(0, 2).join(", ");
  if (s.length > 14) s = s.slice(0, 14) + "…";
  return s;
}

/**
 * 동의어의 짧은 한글뜻을 반환. 표제어로 있으면 그 뜻, 없으면 syn-gloss 사전, 둘 다 없으면 null.
 */
export function korGloss(syn: string): string | null {
  const key = syn.trim().toLowerCase();
  if (!key) return null;
  if (!WORD_KOR) {
    WORD_KOR = new Map();
    for (const v of VOCAB) {
      const w = v.w.toLowerCase();
      if (!WORD_KOR.has(w) && v.k_short) {
        const sk = shortKor(v.k_short);
        if (sk) WORD_KOR.set(w, sk);
      }
    }
  }
  return WORD_KOR.get(key) ?? SYN_GLOSS[key] ?? null;
}

/** "synonym(한글뜻)" 라벨 — 한글뜻 없으면 synonym만 */
export function synWithKor(syn: string): string {
  const g = korGloss(syn);
  return g ? `${syn}(${g})` : syn;
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

  // wrongPool 단어들의 k도 오답 선지에서 제외
  const wrongPoolWords = new Set<string>(target.wrongPool ?? []);
  for (const wpWord of wrongPoolWords) {
    const wpItem = VOCAB.find(v => v.w === wpWord);
    if (wpItem) {
      if (wpItem.k) forbiddenK.add(wpItem.k);
      if (wpItem.k_short) forbiddenK.add(wpItem.k_short);
    }
  }

  const distractors: string[] = [];
  const usedK = new Set<string>(forbiddenK);

  // 1) 오개념 방지: 반의어 방향 단어의 한국어 뜻을 최대 count-1개
  const antonymSlots = count - 1;
  for (const ant of shuffle(getAntonymDirection(target))) {
    if (distractors.length >= antonymSlots) break;
    const antItem = WORD_TO_ITEM.get(ant.toLowerCase());
    if (!antItem || wrongPoolWords.has(antItem.w)) continue;
    if (!antItem.k || antItem.k.length <= 2 || usedK.has(antItem.k)) continue;
    distractors.push(antItem.k);
    usedK.add(antItem.k);
    if (antItem.k_short) usedK.add(antItem.k_short);
  }

  // 2) 무관 단어의 뜻으로 나머지 자리 채움
  const shuffled = shuffle(pool);

  for (const item of shuffled) {
    if (
      item.w !== target.w &&
      !wrongPoolWords.has(item.w) &&
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
