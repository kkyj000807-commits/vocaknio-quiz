import { useSyncExternalStore } from 'react';
import { getStudyRevision, getStudyVocab, subscribeStudyVocab } from '@/lib/vocab';
export function useStudyVocab() {
  useSyncExternalStore(subscribeStudyVocab, getStudyRevision, getStudyRevision);
  return getStudyVocab();
}
