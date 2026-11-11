import { useSyncExternalStore } from 'react';
import { getStudyVocab, subscribeStudyVocab } from '@/lib/vocab';
export function useStudyVocab() {
  // Return the subscribed immutable array itself. A separate getter with an
  // ignored revision can be memoized by React Compiler across book activation.
  return useSyncExternalStore(subscribeStudyVocab, getStudyVocab, getStudyVocab);
}
