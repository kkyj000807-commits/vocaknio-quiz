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
import { getProductionSenseQuestions, hasSenseQuestionMapping, isCurrentSenseQuestion, senseMatchesItem, type SenseQuestion } from "@/lib/sense-questions";
import { getActiveRecallSenses, isCurrentActiveRecallSense, activeRecallMatchesItem, type ActiveRecallSense } from "@/lib/active-recall";
import {
  getDefinitionQuizDistractors,
  getDefinitionQuizEntry,
  getDefinitionAnswerRelations,
  getDefinitionRelationMeanings,
  isCurrentDefinitionQuizEntry,
  type DefinitionQuizEntry,
} from "@/lib/definition-quiz";
import {
  canonicalSenseKey,
  getItemLearningTargets,
  getLearningTargetKey,
  itemIsFullyMastered,
} from "@/lib/canonical-learning";

export type ChoiceLang = "korean" | "english";
export type QuizAnswerKind = "synonym" | "meaning" | "target" | "self";

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
  /** Present only for independently cross-checked, contextualized questions. */
  sense?: SenseQuestion;
  /** English definition/context → target-word recall, bound to one reviewed sense. */
  recall?: ActiveRecallSense;
  recallPromptId?: string;
  /** OEWN exact single-sense definition → target-word recall. */
  definitionRecall?: DefinitionQuizEntry;
  /** OEWN same-synset English → English synonym recall. */
  synonymRecall?: DefinitionQuizEntry;
}

export interface BuildQuizOptions {
  mode: QuizMode;
  rangeStart?: number;
  rangeEnd?: number;
  rangeId?: string;
  count: number;
  choiceLang?: ChoiceLang;
  masteredNums?: number[];
  masteredTargetKeys?: string[];
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

let synonymOptions: SynonymOption[] | undefined;
const vocabById = new Map(VOCAB.map((item) => [item.id, item]));
// These rows are the regression fixtures that originally exposed a confirmed
// wrong-sense or wrong-part-of-speech synonym.  Their legacy synonym links were
// deliberately removed by the v1 semantic guard.  Do not silently reintroduce
// a different OEWN sense merely because the same headword has a safe synset.
const SYNONYM_EXPANSION_BLOCKED_ITEM_IDS = new Set([
  "JBKROW000203", // appropriate · 착복하다
  "JBKROW001045", // benign · 양성의
  "JBKROW009645", // smolder · 감정이 맺히다/그을다
  "JBKROW001820", // explicit · 노골적인
  "JBKROW000388", // envoy · 특사
  "JBKROW001919", // effeminate · 여성적인
  "JBKROW027217", // refrain · 후렴구
]);
function getSynonymOptions(): SynonymOption[] {
  if (synonymOptions) return synonymOptions;
  // Restoring or grading an existing question does not need the distractor pool.
  const options = new Map<string, SynonymOption>();
  for (const item of VOCAB_WITH_SYNONYMS) {
    for (const detail of getSynonymDetails(item)) {
      const key = `${normalizeWord(detail.word)}\u0000${normalizeMeaning(detail.meaning)}`;
      if (!options.has(key)) options.set(key, { ...detail, key });
    }
  }
  synonymOptions = [...options.values()];
  return synonymOptions;
}

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
    getSynonymOptions(),
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

function buildReviewedDefinitionQuestion(
  item: VocabItem,
  recall: ActiveRecallSense,
): QuizQuestion | null {
  const prompt = recall.prompts.find((candidate) => candidate.kind === "definition-recall");
  if (!prompt) return null;
  const choices = shuffle([
    {
      id: `${recall.id}:target`,
      value: item.w,
      label: item.w,
      word: item.w,
      meaning: recall.koreanMeaning,
      isCorrect: true,
    },
    ...recall.distractors.map((distractor, index) => ({
      id: `${recall.id}:distractor:${index}`,
      value: distractor.word,
      label: distractor.word,
      word: distractor.word,
      meaning: `${recall.antonyms.some((value) => normalizeWord(value) === normalizeWord(distractor.word)) ? "반대축" : "비교선지"} · ${distractor.meaningKo}`,
      isCorrect: false,
    })),
  ]);
  const question: QuizQuestion = {
    id: `${item.id}-definition-choice-${recall.id}-${prompt.id}`,
    item,
    mode: "definition-choice",
    answerKind: "target",
    choices,
    correct: item.w,
    acceptedAnswers: [item.w],
    recall,
    recallPromptId: prompt.id,
  };
  return validateQuestion(question) ? question : null;
}

function buildOewnDefinitionQuestion(item: VocabItem): QuizQuestion | null {
  const definitionRecall = getDefinitionQuizEntry(item.id);
  if (!definitionRecall) return null;
  const distractors = getDefinitionQuizDistractors(definitionRecall, 3);
  if (distractors.length !== 3) return null;
  const choices = shuffle([
    {
      id: `${definitionRecall.senseId}:target`,
      value: item.w,
      label: item.w,
      word: item.w,
      meaning: item.k_short,
      isCorrect: true,
    },
    ...distractors.map((distractor, index) => {
      const distractorItem = vocabById.get(distractor.itemId);
      return {
        id: `${definitionRecall.senseId}:distractor:${index}`,
        value: distractor.headword,
        label: distractor.headword,
        word: distractor.headword,
        meaning: `${distractor.relation === "antonym" ? "반대축" : "비교선지"} · ${distractorItem?.k_short ?? "뜻 확인"}`,
        isCorrect: false,
      };
    }),
  ]);
  const question: QuizQuestion = {
    id: `${item.id}-definition-choice-${definitionRecall.senseId}`,
    item,
    mode: "definition-choice",
    answerKind: "target",
    choices,
    correct: item.w,
    acceptedAnswers: [item.w],
    definitionRecall,
  };
  return validateQuestion(question) ? question : null;
}

function buildOewnSynonymQuestion(
  item: VocabItem,
  mode: "syn-choice" | "syn-kor-choice",
): QuizQuestion | null {
  if (SYNONYM_EXPANSION_BLOCKED_ITEM_IDS.has(item.id)) return null;
  const synonymRecall = getDefinitionQuizEntry(item.id);
  if (!synonymRecall) return null;
  const exactSynonyms = getDefinitionAnswerRelations(synonymRecall).synonyms;
  if (exactSynonyms.length === 0) return null;
  const correctWord = exactSynonyms[Math.floor(Math.random() * exactSynonyms.length)];
  const relationMeanings = new Map(
    getDefinitionRelationMeanings(synonymRecall, item.k_short)
      .map((relation) => [normalizeWord(relation.word), relation.meaning]),
  );
  const reviewedMeanings = new Map(
    getSynonymDetails(item)
      .map((relation) => [normalizeWord(relation.word), relation.meaning]),
  );
  const distractors = getDefinitionQuizDistractors(synonymRecall, 3);
  if (distractors.length !== 3) return null;
  const choices = shuffle([
    {
      id: `${synonymRecall.senseId}:synonym:${normalizeWord(correctWord)}`,
      value: correctWord,
      label: correctWord,
      word: correctWord,
      meaning: reviewedMeanings.get(normalizeWord(correctWord)) ??
        relationMeanings.get(normalizeWord(correctWord)) ??
        `같은 sense의 핵심 뜻 · ${item.k_short}`,
      isCorrect: true,
    },
    ...distractors.map((distractor, index) => ({
      id: `${synonymRecall.senseId}:distractor:${index}`,
      value: distractor.headword,
      label: distractor.headword,
      word: distractor.headword,
      meaning: `${distractor.relation === "antonym" ? "반의어" : "다른 의미"} · ${vocabById.get(distractor.itemId)?.k_short ?? "한국어 뜻 검수 대기"}`,
      isCorrect: false,
    })),
  ]);
  const question: QuizQuestion = {
    id: `${item.id}-${mode}-${synonymRecall.senseId}`,
    item,
    mode,
    answerKind: "synonym",
    choices,
    correct: correctWord,
    acceptedAnswers: exactSynonyms,
    synonymRecall,
  };
  return validateQuestion(question) ? question : null;
}

function makeQuestion(
  item: VocabItem,
  mode: QuizMode,
  choiceLang: ChoiceLang,
  masteredTargetKeys: ReadonlySet<string> = new Set(),
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

  if (mode === "definition-choice") {
    const recallEntries = getActiveRecallSenses(item.id).filter(entry =>
      activeRecallMatchesItem(entry, item) &&
      !masteredTargetKeys.has(canonicalSenseKey(entry.senseId)));
    if (recallEntries.length > 0) {
      const recall = recallEntries[Math.floor(Math.random() * recallEntries.length)];
      return buildReviewedDefinitionQuestion(item, recall);
    }
    const definitionRecall = getDefinitionQuizEntry(item.id);
    if (definitionRecall && masteredTargetKeys.has(canonicalSenseKey(definitionRecall.senseId))) return null;
    return buildOewnDefinitionQuestion(item);
  }

  const asksForSynonym =
    mode === "syn-choice" ||
    mode === "syn-kor-choice" ||
    (mode === "kor-choice" && choiceLang === "english");
  const reviewed = getProductionSenseQuestions(item.id).filter(sense =>
    senseMatchesItem(sense, item) &&
    !masteredTargetKeys.has(canonicalSenseKey(sense.senseId)));
  // A withheld sense must not quietly fall back to the old headword-level question.
  if (hasSenseQuestionMapping(item.id) && reviewed.length === 0) return null;
  if (reviewed.length) {
    const sense = reviewed[Math.floor(Math.random() * reviewed.length)];
    const choices = shuffle(sense.choices.map((choice): QuizChoice => ({
      id: `${sense.id}:${choice.id}`,
      value: asksForSynonym ? choice.en : choice.ko,
      label: asksForSynonym ? choice.en : choice.ko,
      word: choice.en,
      meaning: choice.ko,
      isCorrect: choice.id === sense.correctId,
    })));
    const correct = choices.find(c => c.isCorrect)!;
    const question: QuizQuestion = {
      id: `${item.id}-${mode}-${sense.id}`, item, mode,
      answerKind: asksForSynonym ? "synonym" : "meaning",
      choices, correct: correct.label, acceptedAnswers: [correct.value], sense,
    };
    return validateQuestion(question) ? question : null;
  }
  if (masteredTargetKeys.has(getLearningTargetKey(item))) return null;
  if (mode === "syn-choice" || mode === "syn-kor-choice") {
    const oewnQuestion = buildOewnSynonymQuestion(item, mode);
    if (oewnQuestion) return oewnQuestion;
  }
  const choices = asksForSynonym
    ? buildSynonymChoices(item, false)
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
    return [...new Set(options.itemNums)]
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
  void mode;
  void choiceLang;
  return false;
}

/**
 * 실제로 출제 대상으로 사용할 수 있는 항목을 반환합니다.
 * 적응형 선정기는 이 목록만 받아 최근 노출과 정답률을 기준으로 순서를 정합니다.
 */
export function getQuizCandidateItems(options: BuildQuizOptions): VocabItem[] {
  if (!Number.isInteger(options.count) || options.count <= 0 || options.count > 200 ||
      !["definition-choice", "syn-choice", "syn-kor-choice", "syn-type", "kor-choice", "flashcard"].includes(options.mode)) return [];
  const choiceLang = options.choiceLang ?? "korean";
  const mastered = new Set(options.masteredNums ?? []);
  const masteredTargets = new Set(options.masteredTargetKeys ?? []);
  let pool = resolvePool(options).filter((item) => item.k.length > 0);
  if (masteredTargets.size > 0)
    pool = pool.filter((item) => !itemIsFullyMastered(item, masteredTargets));
  // Keep the legacy flashcard-only list until its one-time sense migration has
  // run. New state uses masteredTargetKeys in every mode.
  if (options.mode === "flashcard" && mastered.size > 0)
    pool = pool.filter((item) =>
      !mastered.has(item.num) || getItemLearningTargets(item).length > 1);
  const meaningFallback =
    options.allowMeaningFallback &&
    canFallBackToMeaning(options.mode, choiceLang);
  if (options.mode === "definition-choice") {
    pool = pool.filter((item) =>
      getActiveRecallSenses(item.id).some((entry) =>
        entry.prompts.some((prompt) => prompt.kind === "definition-recall"),
      ) || Boolean(getDefinitionQuizEntry(item.id)),
    );
  }
  if (
    !meaningFallback &&
    (options.mode === "syn-choice" ||
      options.mode === "syn-kor-choice" ||
      options.mode === "syn-type")
  ) {
    pool = pool.filter((item) => item.s.length > 0 ||
      Boolean(!SYNONYM_EXPANSION_BLOCKED_ITEM_IDS.has(item.id) &&
        getDefinitionQuizEntry(item.id) &&
        getDefinitionAnswerRelations(getDefinitionQuizEntry(item.id)!).synonyms.length > 0) ||
      getActiveRecallSenses(item.id).length > 0 ||
      (options.mode !== "syn-type" && getProductionSenseQuestions(item.id).length > 0));
  }
  if (
    !meaningFallback &&
    options.mode === "kor-choice" &&
    choiceLang === "english"
  ) {
    pool = pool.filter((item) => item.s.length > 0 || getActiveRecallSenses(item.id).length > 0 || getProductionSenseQuestions(item.id).length > 0);
  }
  return pool;
}

function makeQuestionWithFallback(
  item: VocabItem,
  options: BuildQuizOptions,
  choiceLang: ChoiceLang,
): QuizQuestion | null {
  const masteredTargets = new Set(options.masteredTargetKeys ?? []);
  const primary = makeQuestion(item, options.mode, choiceLang, masteredTargets);
  if (primary || !options.allowMeaningFallback) return primary;
  if (!canFallBackToMeaning(options.mode, choiceLang)) return null;
  return makeQuestion(item, "kor-choice", "korean", masteredTargets);
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
  if (!Number.isInteger(count) || count <= 0 || count > 200) return [];
  const questions: QuizQuestion[] = [];
  const items = shuffle(
    [...new Set(itemNums)]
      .map(getVocabItem)
      .filter((item): item is VocabItem => Boolean(item)),
  );
  for (const item of items) {
    const mode: QuizMode = getActiveRecallSenses(item.id).some((entry) =>
      entry.prompts.some((prompt) => prompt.kind === "definition-recall"),
    ) || getDefinitionQuizEntry(item.id)
      ? "definition-choice"
      : item.s.length > 0
        ? "syn-choice"
        : "kor-choice";
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
  const selected = question.choices.find(c => c.id === choice.id && c.value === choice.value);
  if (!selected) return false;
  return selected.isCorrect && matchesAnswerKey(question, selected);
}

// Check the stored key independently of its display flag. Otherwise a corrupt
// flag can make both grading and validation agree on the same wrong answer.
function matchesAnswerKey(question: QuizQuestion, choice: QuizChoice): boolean {
  if (question.synonymRecall) {
    if (!isCurrentDefinitionQuizEntry(question.synonymRecall, question.item)) return false;
    const accepted = new Set(getDefinitionAnswerRelations(question.synonymRecall).synonyms.map(normalizeWord));
    return (question.mode === "syn-choice" || question.mode === "syn-kor-choice") &&
      question.answerKind === "synonym" && accepted.has(normalizeWord(choice.value));
  }
  if (question.definitionRecall) {
    if (!isCurrentDefinitionQuizEntry(question.definitionRecall, question.item)) return false;
    return question.mode === "definition-choice" && question.answerKind === "target" &&
      choice.id === `${question.definitionRecall.senseId}:target` &&
      normalizeWord(choice.value) === normalizeWord(question.item.w);
  }
  if (question.recall) {
    if (!isCurrentActiveRecallSense(question.recall, question.item)) return false;
    return question.answerKind === "target" && choice.id === `${question.recall.id}:target` && choice.value === question.item.w;
  }
  if (question.sense) {
    if (!isCurrentSenseQuestion(question.sense, question.item)) return false;
    // Never regrade a contextual answer against the headword-level synonym list.
    const correct = question.sense.choices.find(c => c.id === question.sense!.correctId);
    return choice.id === `${question.sense.id}:${question.sense.correctId}` &&
      choice.value === (question.answerKind === "synonym" ? correct?.en : correct?.ko);
  }
  if (question.answerKind === "synonym") {
    return isAcceptedSynonym(question.item, choice.value);
  }
  return question.answerKind === "meaning" && choice.value === question.item.k;
}

export function isTypedAnswerCorrect(
  question: QuizQuestion,
  answer: string,
): boolean {
  if (question.answerKind !== "synonym") return false;
  return isAcceptedSynonym(question.item, answer);
}

export function validateQuestion(question: QuizQuestion): boolean {
  if (question.synonymRecall) {
    if ((question.mode !== "syn-choice" && question.mode !== "syn-kor-choice") ||
      question.answerKind !== "synonym" ||
      !isCurrentDefinitionQuizEntry(question.synonymRecall, question.item) ||
      question.choices.length !== 4 || question.choices.filter(choice => choice.isCorrect).length !== 1 ||
      question.choices.some(choice => /[가-힣]/u.test(choice.label)) ||
      !question.choices.every(choice => choice.isCorrect === matchesAnswerKey(question, choice))) return false;
  }
  if (question.definitionRecall) {
    if (question.mode !== "definition-choice" || question.answerKind !== "target" ||
      !isCurrentDefinitionQuizEntry(question.definitionRecall, question.item) ||
      question.choices.length !== 4 || question.choices.filter(choice => choice.isCorrect).length !== 1 ||
      !question.choices.every(choice => choice.isCorrect === matchesAnswerKey(question, choice))) return false;
  }
  if (question.recall) {
    const recall = question.recall;
    const prompt = recall.prompts.find(candidate => candidate.id === question.recallPromptId);
    if (!prompt || prompt.kind !== "definition-recall" || question.mode !== "definition-choice" ||
      question.answerKind !== "target" || !isCurrentActiveRecallSense(recall, question.item) ||
      question.choices.length !== 4 || question.choices.filter(choice => choice.isCorrect).length !== 1 ||
      !question.choices.every(choice => choice.isCorrect === matchesAnswerKey(question, choice))) return false;
  }
  if (!question.sense && question.mode !== "flashcard" && question.mode !== "syn-type" &&
    !question.recall && !question.definitionRecall && !question.synonymRecall && hasSenseQuestionMapping(question.item.id)) return false;
  if (question.sense) {
    const sense = question.sense;
    if (!isCurrentSenseQuestion(sense, question.item) || sense.status !== "production" ||
      !sense.itemIds.includes(question.item.id) || sense.headword !== question.item.w ||
      !question.choices.every(c => sense.choices.some(source => {
        const value = question.answerKind === "synonym" ? source.en : source.ko;
        const label = value;
        return c.id === `${sense.id}:${source.id}` && c.value === value && c.label === label &&
          c.meaning === source.ko && c.isCorrect === (source.id === sense.correctId);
      }))) return false;
  }
  if (question.answerKind === "self") return question.choices.length === 0;
  if (question.mode === "syn-type") return question.acceptedAnswers.length > 0;
  if (question.choices.length !== 4) return false;
  if (new Set(question.choices.map(choice => choice.id)).size !== 4) return false;
  if (!question.choices.some(choice => choice.isCorrect && choice.label === question.correct)) return false;
  if (new Set(question.choices.map((choice) => choice.label)).size !== 4)
    return false;
  if (!question.choices.every(choice => choice.isCorrect === matchesAnswerKey(question, choice)))
    return false;
  return (
    question.choices.filter((choice) => isChoiceCorrect(question, choice))
      .length === 1
  );
}
