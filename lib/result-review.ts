import { summarizeQuizSession, type QuizSession } from '@/lib/quiz-session';
import { getQuestionLearningTargetKey } from '@/lib/canonical-learning';
import type { QuizMode } from '@/lib/vocab';

/** Retain exact failed targets and mode; never merge a user's stored records. */
export function resultReviewParams(session: Pick<QuizSession, 'questions' | 'states'>, mode: QuizMode, choiceLang: string) {
  const keys = session.questions.flatMap((question, index) => {
    const state = session.states[index];
    return state?.answered && summarizeQuizSession({ questions: [question], states: [state] }).wrongCount
      ? [getQuestionLearningTargetKey(question)] : [];
  });
  return { reviewMode: mode, choiceLang, reviewKeys: JSON.stringify([...new Set(keys)]) };
}
