import { useEffect, useState } from 'react';
import type { SenseLearningState } from '@/lib/learning-state';
import { QUIZ_MODES, type QuizMode, type VocabItem } from '@/lib/vocab';
import { inspectWordbookPractice, practiceMasteredKeys } from '@/lib/wordbook-practice';

export function useWordbookPractice(open: boolean, items: readonly VocabItem[], state: SenseLearningState | null, includeMastered: boolean) {
  const [result, setResult] = useState<{ items: readonly VocabItem[]; state: SenseLearningState;
    includeMastered: boolean; counts: Partial<Record<QuizMode, number>>; failed?: boolean } | null>(null);
  useEffect(() => {
    if (!open || !state) return;
    let cancelled = false;
    const counts: Partial<Record<QuizMode, number>> = {};
    setResult({ items, state, includeMastered, counts });
    const run = async () => {
      const itemNums = items.map(item => item.num);
      const masteredTargetKeys = practiceMasteredKeys(state, includeMastered);
      for (const mode of QUIZ_MODES) {
        await new Promise<void>(resolve => setTimeout(resolve, 0));
        if (cancelled) return;
        const inspected = await inspectWordbookPractice({ mode: mode.id, count: 30, itemNums, masteredTargetKeys }, state, 30, () => cancelled);
        if (!inspected || cancelled) return;
        counts[mode.id] = inspected.count;
        setResult({ items, state, includeMastered, counts: { ...counts } });
      }
    };
    void run().catch(() => { if (!cancelled) setResult({ items, state, includeMastered, counts: {}, failed: true }); });
    return () => { cancelled = true; };
  }, [open, items, state, includeMastered]);
  // A previous filter must never enable a different request while its effect waits.
  return result?.items === items && result.state === state && result.includeMastered === includeMastered
    ? result : { counts: {} as Partial<Record<QuizMode, number>>, failed: false };
}
