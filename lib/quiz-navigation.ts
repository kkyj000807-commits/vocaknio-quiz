type NavigationState = {
  answered?: boolean;
  typedAnswer?: string;
  hintLevel?: number;
  revealed?: boolean;
  mastered?: boolean;
};

/** Navigation never grades a response or marks an unanswered session complete. */
export function getNextQuizIndex(currentIndex: number, states: readonly NavigationState[]): number | null {
  if (currentIndex + 1 < states.length) return currentIndex + 1;
  const pendingIndex = states.findIndex(state => !state.answered);
  return pendingIndex < 0 ? null : pendingIndex;
}

export function classifyQuizSwipe(dx: number, dy: number): "next" | "previous" | null {
  if (!Number.isFinite(dx) || !Number.isFinite(dy) || Math.abs(dx) < 56 || Math.abs(dx) <= Math.abs(dy) * 1.35) return null;
  return dx < 0 ? "next" : "previous";
}

export function canReorderQuizQuestion(state?: NavigationState): boolean {
  return !state || (!state.answered && !state.typedAnswer && !state.hintLevel && !state.revealed && !state.mastered);
}
