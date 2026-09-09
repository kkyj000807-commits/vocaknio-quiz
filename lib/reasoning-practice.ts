import AsyncStorage from "@react-native-async-storage/async-storage";

export interface ReasoningQuestion {
  id: string;
  passageEn: string;
  promptKo: string;
  choices: Array<{ id: string; text: string; errorType: string; explanationKo: string }>;
  correctChoiceId: string;
  evidence: string[];
  translationKo: string;
  relationKo: string;
}

export interface ReasoningLesson {
  id: string;
  literalKo: string;
  bridgeKo: string;
  originStatus: "mnemonic";
  originNoteKo: string;
  neighbors: Array<{ expression: string; noteKo: string }>;
  questions: ReasoningQuestion[];
  authorship: string;
  checkedAtKst: string;
}

export interface PracticeAttempt {
  questionId: string;
  choiceId: string;
  elapsedMs: number;
  answeredAt: string;
}

const key = (id: string) => `vocanexus:context-practice:v1:${id}`;

/** Feedback practice is intentionally separate from the adaptive quiz/mastery store. */
export async function readPracticeAttempt(question: ReasoningQuestion): Promise<PracticeAttempt | null> {
  const raw = await AsyncStorage.getItem(key(question.id));
  if (raw === null) return null;
  const value = JSON.parse(raw) as Partial<PracticeAttempt>;
  if (value.questionId !== question.id || !question.choices.some((choice) => choice.id === value.choiceId) ||
      typeof value.elapsedMs !== "number" || !Number.isFinite(value.elapsedMs) || value.elapsedMs < 0 ||
      typeof value.answeredAt !== "string" || !Number.isFinite(Date.parse(value.answeredAt))) {
    throw new Error("연습 기록 형식을 확인할 수 없습니다.");
  }
  return value as PracticeAttempt;
}

export async function savePracticeAttempt(question: ReasoningQuestion, choiceId: string, elapsedMs: number): Promise<PracticeAttempt> {
  if (!question.choices.some((choice) => choice.id === choiceId) || !Number.isFinite(elapsedMs) || elapsedMs < 0) throw new Error("잘못된 연습 응답입니다.");
  const attempt = { questionId: question.id, choiceId, elapsedMs, answeredAt: new Date().toISOString() };
  await AsyncStorage.setItem(key(question.id), JSON.stringify(attempt));
  return attempt;
}

export function isPracticeAnswerCorrect(question: ReasoningQuestion, choiceId: string): boolean {
  return question.choices.some((choice) => choice.id === choiceId) && question.correctChoiceId === choiceId;
}
