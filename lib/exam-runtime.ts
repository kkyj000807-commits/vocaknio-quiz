// Browser-safe contracts and shuffling. Legacy source text stays in the audit module.
export type QuestionType = "vocab-synonym" | "vocab-blank" | "logic-blank" | "reading-main"
  | "reading-vocab" | "reading-blank" | "reading-title" | "grammar";
export interface ExamQuestion {
  id: string;
  school?: string;
  year: number;
  qNum: number;
  type: QuestionType;
  passage?: string;
  question: string;
  underlined?: string;
  choices: string[];
  answer: number;
  explanation: string;
  points: number;
  originalChoiceIndices?: number[];
}
function shuffleExamValues<T>(values: readonly T[], random = Math.random): T[] {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
export function shuffleQuestions(questions: ExamQuestion[]): ExamQuestion[] {
  return shuffleExamValues(questions);
}
export function shuffleChoices(question: ExamQuestion, random = Math.random): ExamQuestion {
  const indexed = question.choices.map((choice, i) => ({ choice, isAnswer: i === question.answer,
    originalIndex: question.originalChoiceIndices?.[i] ?? i }));
  const shuffled = shuffleExamValues(indexed, random);
  return { ...question, choices: shuffled.map(c => c.choice),
    answer: shuffled.findIndex(c => c.isAnswer), originalChoiceIndices: shuffled.map(c => c.originalIndex) };
}
