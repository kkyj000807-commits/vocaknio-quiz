import {
  RANGES,
  VOCAB,
  VOCAB_WITH_SYNONYMS,
  getRelatedWords,
  getSynonymDetails,
  getVocabItem,
  isAcceptedSynonym,
  meaningsOverlap,
  normalizeMeaning,
  normalizeWord,
  shuffle,
  type QuizMode,
  type SynonymDetail,
  type VocabItem,
} from "@/lib/vocab";

export type ChoiceLang = "korean" | "english";
export type QuizAnswerKind = "synonym" | "meaning" | "self";

export interface QuizChoice {
  id: string;
  value: string;
  label: string;
  word: string;
  meaning: string;
  isCorrect: boolean;
}

export interface QuizQuestion {
  id: string;
  item: VocabItem;
  mode: QuizMode;
  answerKind: QuizAnswerKind;
  choices: QuizChoice[];
  correct: string;
  acceptedAnswers: string[];
}

export interface BuildQuizOptions {
  mode: QuizMode;
  rangeStart?: number;
  rangeEnd?: number;
  rangeId?: string;
  count: number;
  choiceLang?: ChoiceLang;
  masteredNums?: number[];
  itemNums?: number[];
  /**
   * 동의어 데이터가 없는 항목을 검증된 한국어 뜻 4지선다로 전환합니다.
   * 기본값은 false라서 기존 직접 호출의 동작은 그대로 유지됩니다.
   */
  allowMeaningFallback?: boolean;
  /** 적응형 엔진이 정한 항목 순서를 셔플하지 않고 그대로 사용합니다. */
  preserveItemOrder?: boolean;
}

interface SynonymOption extends SynonymDetail {
  key: string;
}

const synonymOptionMap = new Map<string, SynonymOption>();
for (const item of VOCAB_WITH_SYNONYMS) {
  for (const detail of getSynonymDetails(item)) {
    const key = `${normalizeWord(detail.word)}\u0000${normalizeMeaning(detail.meaning)}`;
    if (!synonymOptionMap.has(key))
      synonymOptionMap.set(key, { ...detail, key });
  }
}
const SYNONYM_OPTIONS = [...synonymOptionMap.values()];

function pickUnique<T>(
  pool: readonly T[],
  count: number,
  keyOf: (item: T) => string,
  canUse: (item: T) => boolean,
): T[] {
  const selected: T[] = [];
  const used = new Set<string>();
  if (pool.length === 0) return selected;

  const start = Math.floor(Math.random() * pool.length);
  for (
    let offset = 0;
    offset < pool.length && selected.length < count;
    offset += 1
  ) {
    const candidate = pool[(start + offset) % pool.length];
    const key = keyOf(candidate);
    if (used.has(key) || !canUse(candidate)) continue;
    used.add(key);
    selected.push(candidate);
  }
  return selected;
}

function synonymChoice(
  detail: SynonymDetail,
  isCorrect: boolean,
  includeMeaning: boolean,
  index: number,
): QuizChoice {
  return {
    id: `${normalizeWord(detail.word)}-${index}`,
    value: detail.word,
    label: includeMeaning ? `${detail.word} (${detail.meaning})` : detail.word,
    word: detail.word,
    meaning: detail.meaning,
    isCorrect,
  };
}

function buildSynonymChoices(
  item: VocabItem,
  includeMeaning: boolean,
): QuizChoice[] | null {
  const correctDetails = getSynonymDetails(item);
  if (correctDetails.length === 0) return null;

  const correct =
    correctDetails[Math.floor(Math.random() * correctDetails.length)];
  const related = getRelatedWords(item);
  const targetMeanings = [
    item.k,
    item.conceptLabel,
    ...correctDetails.map((detail) => detail.meaning),
  ].filter(Boolean);
  const distractors = pickUnique(
    SYNONYM_OPTIONS,
    3,
    (option) => normalizeWord(option.word),
    (option) => {
      const word = normalizeWord(option.word);
      if (related.has(word) || isAcceptedSynonym(item, option.word))
        return false;
      return !targetMeanings.some((meaning) =>
        meaningsOverlap(meaning, option.meaning),
      );
    },
  );
  if (distractors.length !== 3) return null;

  return shuffle([
    synonymChoice(correct, true, includeMeaning, 0),
    ...distractors.map((detail, index) =>
      synonymChoice(detail, false, includeMeaning, index + 1),
    ),
  ]);
}

function buildMeaningChoices(item: VocabItem): QuizChoice[] | null {
  const related = getRelatedWords(item);
  const usedMeanings = new Set([normalizeMeaning(item.k)]);
  const distractors = pickUnique(
    VOCAB,
    3,
    (candidate) => normalizeMeaning(candidate.k),
    (candidate) => {
      const normalizedMeaning = normalizeMeaning(candidate.k);
      if (!normalizedMeaning || usedMeanings.has(normalizedMeaning))
        return false;
      if (related.has(normalizeWord(candidate.w))) return false;
      if (candidate.conceptId && candidate.conceptId === item.conceptId)
        return false;
      if (meaningsOverlap(item.k, candidate.k)) return false;
      usedMeanings.add(normalizedMeaning);
      return true;
    },
  );
  if (distractors.length !== 3) return null;

  return shuffle([
    {
      id: `meaning-${item.num}`,
      value: item.k,
      label: item.k,
      word: item.w,
      meaning: item.k,
      isCorrect: true,
    },
    ...distractors.map((candidate) => ({
      id: `meaning-${candidate.num}`,
      value: candidate.k,
      label: candidate.k,
      word: candidate.w,
      meaning: candidate.k,
      isCorrect: false,
    })),
  ]);
}

function makeQuestion(
  item: VocabItem,
  mode: QuizMode,
  choiceLang: ChoiceLang,
): QuizQuestion | null {
  if (mode === "flashcard") {
    return {
      id: `${item.id}-flashcard`,
      item,
      mode,
      answerKind: "self",
      choices: [],
      correct: item.k,
      acceptedAnswers: [item.k],
    };
  }

  if (mode === "syn-type") {
    if (item.s.length === 0) return null;
    return {
      id: `${item.id}-syn-type`,
      item,
      mode,
      answerKind: "synonym",
      choices: [],
      correct: item.s[0],
      acceptedAnswers: item.s,
    };
  }

  const asksForSynonym =
    mode === "syn-choice" ||
    mode === "syn-kor-choice" ||
    (mode === "kor-choice" && choiceLang === "english");
  const choices = asksForSynonym
    ? buildSynonymChoices(item, mode === "syn-kor-choice")
    : buildMeaningChoices(item);
  if (!choices) return null;

  const correctChoice = choices.find((choice) => choice.isCorrect);
  if (!correctChoice) return null;
  const question: QuizQuestion = {
    id: `${item.id}-${mode}`,
    item,
    mode,
    answerKind: asksForSynonym ? "synonym" : "meaning",
    choices,
    correct: correctChoice.label,
    acceptedAnswers: asksForSynonym ? item.s : [item.k],
  };
  return validateQuestion(question) ? question : null;
}

function resolvePool(options: BuildQuizOptions): VocabItem[] {
  if (options.itemNums) {
    return options.itemNums
      .map(getVocabItem)
      .filter((item): item is VocabItem => Boolean(item));
  }

  const range = RANGES.find((candidate) => candidate.id === options.rangeId);
  if (range?.kind === "idioms") {
    return VOCAB.filter(
      (item) => item.type === "idiom" || item.type === "phrase",
    );
  }
  if (range?.kind === "all") return VOCAB;
  const start = range?.start ?? options.rangeStart ?? 0;
  const end = range?.end ?? options.rangeEnd ?? VOCAB.length - 1;
  return VOCAB.slice(start, end + 1);
}

function canFallBackToMeaning(mode: QuizMode, choiceLang: ChoiceLang): boolean {
  return (
    mode === "syn-choice" ||
    mode === "syn-kor-choice" ||
    mode === "syn-type" ||
    (mode === "kor-choice" && choiceLang === "english")
  );
}

/**
 * 실제로 출제 대상으로 사용할 수 있는 항목을 반환합니다.
 * 적응형 선정기는 이 목록만 받아 최근 노출과 정답률을 기준으로 순서를 정합니다.
 */
export function getQuizCandidateItems(options: BuildQuizOptions): VocabItem[] {
  const choiceLang = options.choiceLang ?? "korean";
  const mastered = new Set(options.masteredNums ?? []);
  let pool = resolvePool(options).filter((item) => item.k.length > 0);
  if (options.mode === "flashcard" && mastered.size > 0) {
    pool = pool.filter((item) => !mastered.has(item.num));
  }
  const meaningFallback =
    options.allowMeaningFallback &&
    canFallBackToMeaning(options.mode, choiceLang);
  if (
    !meaningFallback &&
    (options.mode === "syn-choice" ||
      options.mode === "syn-kor-choice" ||
      options.mode === "syn-type")
  ) {
    pool = pool.filter((item) => item.s.length > 0);
  }
  if (
    !meaningFallback &&
    options.mode === "kor-choice" &&
    choiceLang === "english"
  ) {
    pool = pool.filter((item) => item.s.length > 0);
  }
  return pool;
}

function makeQuestionWithFallback(
  item: VocabItem,
  options: BuildQuizOptions,
  choiceLang: ChoiceLang,
): QuizQuestion | null {
  const primary = makeQuestion(item, options.mode, choiceLang);
  if (primary || !options.allowMeaningFallback) return primary;
  if (!canFallBackToMeaning(options.mode, choiceLang)) return null;
  return makeQuestion(item, "kor-choice", "korean");
}

export function buildQuizQuestions(options: BuildQuizOptions): QuizQuestion[] {
  const choiceLang = options.choiceLang ?? "korean";
  const pool = getQuizCandidateItems(options);
  const orderedPool = options.preserveItemOrder ? pool : shuffle(pool);

  const questions: QuizQuestion[] = [];
  for (const item of orderedPool) {
    const question = makeQuestionWithFallback(item, options, choiceLang);
    if (question) questions.push(question);
    if (questions.length >= options.count) break;
  }
  return questions;
}

export function buildReviewQuestions(
  itemNums: number[],
  count: number,
): QuizQuestion[] {
  const questions: QuizQuestion[] = [];
  const items = shuffle(
    itemNums
      .map(getVocabItem)
      .filter((item): item is VocabItem => Boolean(item)),
  );
  for (const item of items) {
    const mode: QuizMode = item.s.length > 0 ? "syn-choice" : "kor-choice";
    const question = makeQuestion(item, mode, "korean");
    if (question) questions.push(question);
    if (questions.length >= count) break;
  }
  return questions;
}

export function isChoiceCorrect(
  question: QuizQuestion,
  choice: QuizChoice,
): boolean {
  if (question.answerKind === "synonym") {
    return isAcceptedSynonym(question.item, choice.value);
  }
  return choice.isCorrect;
}

export function isTypedAnswerCorrect(
  question: QuizQuestion,
  answer: string,
): boolean {
  if (question.answerKind !== "synonym") return false;
  return isAcceptedSynonym(question.item, answer);
}

export function validateQuestion(question: QuizQuestion): boolean {
  if (question.answerKind === "self") return question.choices.length === 0;
  if (question.mode === "syn-type") return question.acceptedAnswers.length > 0;
  if (question.choices.length !== 4) return false;
  if (new Set(question.choices.map((choice) => choice.label)).size !== 4)
    return false;
  return (
    question.choices.filter((choice) => isChoiceCorrect(question, choice))
      .length === 1
  );
}
