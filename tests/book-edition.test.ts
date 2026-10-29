import { describe, expect, it } from 'vitest';
import { BOOK_EDITION, bookMeanings, bookStudyDetails, bookNeedsEditorialReview, bookPronunciation, selectBookEntries, type BookEntry } from '../lib/book-edition';
import { VOCAB_BY_ID } from '../lib/vocab';

describe('v1.5 edition display adapter: never learner migration', () => {
  it('connects the verified PDF publication and exact dataset', () => {
    expect(BOOK_EDITION.edition).toBe('1.5');
    expect(BOOK_EDITION.datasetSha256).toBe('8e89a38006943729043354ef30500f41da5341441f77333efd83137c7a5e6fa9');
    expect(BOOK_EDITION.pdfSha256).toBe('d330bbdf9ddf2e154b82da8434a98195e2d5dcbf7d6c7ab44e955f299cce30d5');
    expect(Object.values(BOOK_EDITION.sourceCounts).reduce((a, b) => a + b, 0)).toBe(25114);
    expect(BOOK_EDITION.sections).toEqual(['V101','V201','V301','V401','V501','V502','V601','부록','보카바이블 B','숙어']);
  });
  it('public projection contains no private content or fabricated grading eligibility', () => {
    expect(BOOK_EDITION.privateContent).toBe(false);
    expect(new Set(BOOK_EDITION.entries.map(e => e.id)).size).toBe(BOOK_EDITION.entries.length);
    for (const entry of BOOK_EDITION.entries) {
      expect(entry.display).toBeUndefined();
      expect(entry.pronunciation).toBeUndefined();
      expect(entry.automaticGrading).toBe(false);
      expect(entry.appIds.length).toBeGreaterThan(0);
      for (const id of entry.appIds) expect(VOCAB_BY_ID.get(id)?.w).toBe(entry.word);
    }
  });
  it('uses print order rather than old dataset order, keeping source meanings separate', () => {
    const first = selectBookEntries('V101', '', '')[0];
    expect(first.word).toBe('docile');
    expect(first.order).toBe(1);
    expect(bookMeanings(first)).toBeTruthy();
    const attract = selectBookEntries('V301', '01. 유쾌/불쾌', 'attract');
    expect(attract.some(e => e.word === 'attract' && e.chunk === '매혹시키다')).toBe(true);
    const before = JSON.stringify(BOOK_EDITION);
    selectBookEntries('숙어', '', 'up');
    expect(JSON.stringify(BOOK_EDITION)).toBe(before);
  });
  it('keeps original meanings separate from labelled corrections and editorial examples', () => {
    const entry: BookEntry = { id: 'fixture-only', order: 1, section: '숙어', word: 'fixture', appIds: [],
      concept: '', chunk: '', chapter: null, automaticGrading: false,
      display: { meaning_display: '원문 뜻', patterns: [],
        annotations: [{ kind: '교정', text: '교정 설명', source: '검수 근거' }],
        examples: [{ text: '학습 예문', source: '편집 예문' }] },
      gradingReview: { status: 'requires_editorial_policy_review', original_answer_preserved: true } };
    const before = JSON.stringify(entry);
    expect(bookStudyDetails(entry)).toEqual([
      { label: '교정', text: '교정 설명', source: '검수 근거' },
      { label: '예문', text: '학습 예문', source: '편집 예문' },
    ]);
    expect(bookNeedsEditorialReview(entry)).toBe(true);
    expect(entry.automaticGrading).toBe(false);
    expect(JSON.stringify(entry)).toBe(before);
    entry.pronunciation = { ipa: '', korean_pronunciation: '≈ 스플릿 더 신', pronunciation_status: null };
    expect(bookPronunciation(entry)).toBe('IPA 미확인 · ≈ 스플릿 더 신');
    entry.pronunciation.korean_pronunciation = '다설';
    expect(bookPronunciation(entry)).toBe('IPA 미확인 · ≈ 다설');
  });
});
