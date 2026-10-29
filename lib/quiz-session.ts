import { z } from "zod";
import { getVocabItem, isAcceptedSynonym, normalizeWord, type VocabItem } from "@/lib/vocab";
import { senseQuestionSchema } from "@/lib/sense-questions";
import { activeRecallSenseSchema } from "@/lib/active-recall";
import { definitionQuizEntrySchema, getDefinitionAnswerRelations } from "@/lib/definition-quiz";
import { sentenceCompletionSchema } from "@/lib/sentence-completion";
import {
  isChoiceCorrect,
  isTypedAnswerCorrect,
  validateQuestion,
  type QuizQuestion,
} from "@/lib/quiz-engine";

export const QUIZ_SESSION_KEY = "vocaknio_problem_session_v1";
export const QUIZ_SESSION_ARCHIVE_KEY = "vocaknio_problem_session_archive_v1";

const viewStateSchema = z.object({
  answered: z.boolean(),
  selectedChoice: z.number().int().min(0).max(3).nullable(),
  skipped: z.boolean(),
  revealed: z.boolean(),
  flashGrade: z.enum(["correct", "wrong"]).nullable(),
  typedAnswer: z.string(),
  typeResult: z.enum(["correct", "wrong"]).nullable(),
  hintLevel: z.number().int().min(0).max(3),
  mastered: z.boolean(),
});
export type QuizQuestionViewState = z.infer<typeof viewStateSchema>;

export function createEmptyQuestionViewState(): QuizQuestionViewState {
  return {
    answered: false,
    selectedChoice: null,
    skipped: false,
    revealed: false,
    flashGrade: null,
    typedAnswer: "",
    typeResult: null,
    hintLevel: 0,
    mastered: false,
  };
}

// Store the actual options, not just item numbers: rebuilding random choices
// would make a restored answer point at a different option.
const storedQuestionSchema = z
  .object({
    id: z.string().min(1),
    item: z.object({
      num: z.number().int().positive(),
      id: z.string(),
      w: z.string(),
      k: z.string(),
      s: z.array(z.string()),
      k_short: z.string(),
      category: z.string(),
      type: z.enum(["word", "idiom", "phrase"]),
      sourceIndex: z.number(),
      sourceNumber: z.union([z.number(), z.string()]),
      p: z.string(),
      group: z.enum([
        "V101",
        "V201",
        "V301",
        "V401",
        "V501",
        "V502",
        "V601",
        "APPENDIX",
        "PERSONAL",
      ]),
      conceptId: z.string(),
      conceptLabel: z.string(),
      majorConceptLabel: z.string(),
    }),
    mode: z.enum([
      "sentence-completion",
      "definition-choice",
      "syn-choice",
      "kor-choice",
      "syn-kor-choice",
      "flashcard",
      "syn-type",
    ]),
    answerKind: z.enum(["synonym", "meaning", "target", "self", "completion"]),
    choices: z
      .array(
        z.object({
          id: z.string(),
          value: z.string(),
          label: z.string(),
          word: z.string(),
          meaning: z.string(),
          isCorrect: z.boolean(),
        }),
      )
      .max(4),
    correct: z.string(),
    acceptedAnswers: z.array(z.string()),
    sense: senseQuestionSchema.optional(),
    recall: activeRecallSenseSchema.optional(),
    recallPromptId: z.string().optional(),
    definitionRecall: definitionQuizEntrySchema.optional(),
    synonymRecall: definitionQuizEntrySchema.optional(),
    sentenceCompletion: sentenceCompletionSchema.optional(),
  })
  .refine((q) => {
    // Readability is a snapshot contract, not a lookup in today's catalog.
    // A held/corrected question is preserved, never regraded here.
    if (!hasConsistentStoredAnswer(q as QuizQuestion)) return false;
    if (q.sense && (!q.sense.itemIds.includes(q.item.id) || q.sense.headword !== q.item.w ||
      q.sense.status !== "production" ||
      !q.choices.every(c => q.sense!.choices.some(source => c.id === `${q.sense!.id}:${source.id}` &&
        c.value === (q.answerKind === "synonym" ? source.en : source.ko) &&
        c.isCorrect === (source.id === q.sense!.correctId))))) return false;
    if (q.mode === "flashcard" || q.mode === "syn-type")
      return q.choices.length === 0;
    return (
      q.choices.length === 4 &&
      q.choices.filter((c) => c.isCorrect).length === 1 &&
      new Set(q.choices.map((c) => c.id)).size === 4 &&
      new Set(q.choices.map((c) => c.value.trim().toLowerCase())).size === 4 &&
      q.choices.some((c) => c.isCorrect && c.label === q.correct)
    );
  });

function hasConsistentStoredAnswer(q: QuizQuestion): boolean {
  if (q.mode === "flashcard") return q.answerKind === "self" && q.choices.length === 0;
  if (q.mode === "syn-type") return q.answerKind === "synonym" && q.acceptedAnswers.length > 0;
  const matches = (c: QuizQuestion["choices"][number]) => {
    if (q.sentenceCompletion) {
      const source = q.sentenceCompletion;
      return q.mode === "sentence-completion" && q.answerKind === "completion"
        && c.id === `${source.id}:${source.correctChoiceId}`
        && c.value === source.choices.find(option => option.id === source.correctChoiceId)?.text;
    }
    if (q.synonymRecall) return q.answerKind === "synonym"
      && getDefinitionAnswerRelations(q.synonymRecall).synonyms.map(normalizeWord).includes(normalizeWord(c.value));
    if (q.definitionRecall) return q.answerKind === "target"
      && c.id === `${q.definitionRecall.senseId}:target` && normalizeWord(c.value) === normalizeWord(q.item.w);
    if (q.recall) return q.answerKind === "target" && c.id === `${q.recall.id}:target` && c.value === q.item.w;
    if (q.sense) {
      const correct = q.sense.choices.find(option => option.id === q.sense!.correctId);
      return c.id === `${q.sense.id}:${q.sense.correctId}` && c.value === (q.answerKind === "synonym" ? correct?.en : correct?.ko);
    }
    return q.answerKind === "synonym" ? isAcceptedSynonym(q.item, c.value)
      : q.answerKind === "meaning" && c.value === q.item.k;
  };
  return q.choices.every(c => c.isCorrect === matches(c));
}

const storedSessionSchema = z
  .object({
    schema: z.literal(1),
    requestKey: z.string().min(1),
    sessionId: z.string().min(1),
    currentIndex: z.number().int().min(0),
    completed: z.boolean(),
    questions: z.array(storedQuestionSchema).min(1).max(200),
    states: z.array(viewStateSchema).min(1).max(200),
  })
  .refine(
    (s) =>
      s.currentIndex < s.questions.length &&
      s.states.length === s.questions.length &&
      new Set(s.questions.map((q) => q.item.num)).size === s.questions.length &&
      s.states.every((state, i) => {
        const q = s.questions[i];
        if (
          state.selectedChoice !== null &&
          state.selectedChoice >= q.choices.length
        )
          return false;
        if (!state.answered)
          return (
            !state.skipped &&
            state.selectedChoice === null &&
            state.flashGrade === null &&
            state.typeResult === null &&
            !state.mastered
          );
        if (state.skipped)
          return (
            state.selectedChoice === null &&
            state.flashGrade === null &&
            state.typeResult === null &&
            !state.mastered
          );
        if (q.mode === "flashcard")
          return (
            state.revealed && (state.mastered || state.flashGrade !== null)
          );
        if (q.mode === "syn-type")
          return (
            state.typeResult ===
            (isTypedAnswerCorrect(q as QuizQuestion, state.typedAnswer)
              ? "correct"
              : "wrong")
          );
        return state.selectedChoice !== null;
      }),
  );

export interface QuizSession {
  schema: 1;
  requestKey: string;
  sessionId: string;
  currentIndex: number;
  completed: boolean;
  questions: QuizQuestion[];
  states: QuizQuestionViewState[];
}

/** Preserves readable historical content; does not authorize play or scoring. */
export function parseStoredQuizSession(value: unknown): QuizSession | null {
  const result = storedSessionSchema.safeParse(value);
  return result.success ? (value as QuizSession) : null;
}

export function parseQuizSession(value: unknown): QuizSession | null {
  const saved = parseStoredQuizSession(value);
  return saved && saved.questions.every(validateQuestion) ? saved : null;
}

export function isQuizSessionContentCurrent(saved: QuizSession): boolean {
  return !!parseQuizSession(saved) && saved.questions.every(q =>
    JSON.stringify(q.item) === JSON.stringify(getVocabItem(q.item.num)));
}

export type QuizSessionArchive = { schema: 1; sessions: string[] };
/** Preserve the first committed response; navigating back is not an undo. */
export function mergeQuizSessionProgress(previous: QuizSession | null, next: QuizSession): QuizSession {
  if (!previous || previous.sessionId !== next.sessionId || JSON.stringify(previous.questions) !== JSON.stringify(next.questions)) return next;
  const answer = (s: QuizQuestionViewState) => JSON.stringify([s.skipped, s.selectedChoice, s.flashGrade, s.typeResult, s.typedAnswer]);
  return { ...next, completed: previous.completed || next.completed, states: next.states.map((state, i) => {
    const old = previous.states[i];
    return old.answered && (!state.answered || answer(old) !== answer(state)) ? old : state;
  }) };
}

export function parseQuizSessionArchive(value: unknown): QuizSessionArchive | null {
  const parsed = z.object({ schema: z.literal(1), sessions: z.array(z.string()) }).safeParse(value);
  if (!parsed.success) return null;
  try {
    if (!parsed.data.sessions.every(raw => parseStoredQuizSession(JSON.parse(raw)))) return null;
  } catch { return null; }
  return parsed.data;
}

export function resumableQuizSession(
  saved: QuizSession | null,
  requestKey: string,
): QuizSession | null {
  if (!saved || saved.completed || saved.requestKey !== requestKey || !isQuizSessionContentCurrent(saved)) return null;
  return saved;
}

export function summarizeQuizSession(
  session: Pick<QuizSession, "questions" | "states">,
) {
  let correctCount = 0;
  const wrongItems: VocabItem[] = [];
  session.states.forEach((state, i) => {
    if (!state.answered) return;
    const q = session.questions[i];
    const correct =
      !state.skipped &&
      (q.mode === "flashcard"
        ? state.mastered || state.flashGrade === "correct"
        : q.mode === "syn-type"
          ? isTypedAnswerCorrect(q, state.typedAnswer)
          : state.selectedChoice !== null &&
            isChoiceCorrect(q, q.choices[state.selectedChoice]));
    if (correct) correctCount++;
    else wrongItems.push(q.item);
  });
  return { correctCount, wrongCount: wrongItems.length, wrongItems };
}
