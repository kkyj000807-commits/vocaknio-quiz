import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { bookReadingContrast } from '../lib/book-reading-contrast';
import type { BookEntry } from '../lib/book-edition';
import lessons from '../data/book-reading-contrasts.json';
import manifest from '../assets/public-book-manifest.json';
import { quizBookCategory } from '../lib/wordbook-concepts';

const book = JSON.parse(readFileSync('public/' + manifest.file, 'utf8')).current;
const entries = new Map<string,BookEntry>(book.entries.map((e: BookEntry) => [e.id,e]));

describe('교재 상세의 의미 대조', () => {
  it('집필한 모든 행이 현행 교재 의미 한 곳에만 붙고 모든 구간에 실례가 있다', () => {
    const used = new Set<string>(), sections = new Set<string>();
    for (const lesson of lessons) {
      expect([lesson.focus,lesson.en,lesson.ko,lesson.distinction].every(s => s.trim().length > 10)).toBe(true);
      for (const t of lesson.targets) {
        expect(used.has(t.id)).toBe(false);
        used.add(t.id);
        sections.add(t.section);
        expect(bookReadingContrast(entries.get(t.id)!)).toEqual(lesson);
      }
    }
    expect([...sections].sort()).toEqual([...book.sections].sort());
  });
  it('동철자·이전 판·다른 뜻으로 자동 전파하지 않는다', () => {
    const e = entries.get('study-00084')!;
    expect(bookReadingContrast({...e,historical:true})).toBeUndefined();
    expect(bookReadingContrast({...e,word:'replace'})).toBeUndefined();
    expect(bookReadingContrast({...e,display:{...e.display!,meaning_display:'다른 뜻'}})).toBeUndefined();
  });
  it('제출 후에만 원래 범주를 표시하고, 없는 범주를 단어 뜻으로 만들지 않는다', () => {
    const forEntry = (book: BookEntry, answered = true) => quizBookCategory({id:'',w:book.word,k:'',group:book.section,book},answered);
    const attract = entries.get('study-03133')!, abound = entries.get('study-06583')!;
    expect(forEntry(attract,false)).toBeNull();
    expect(forEntry(attract)).toContain('유쾌/불쾌 → 매혹시키다');
    expect(forEntry(abound)).toContain('001. 가득하다');
    expect(forEntry({...abound,display:{...abound.display!,meaning_display:'다른 뜻'}})).toContain('미확인');
    expect(forEntry({...abound,historical:true})).toBeNull();
    expect(forEntry({...abound,section:'V201'})).toBeNull();
    expect(forEntry({...abound,appIds:[...abound.appIds,...abound.appIds]})).toBe(forEntry(abound));
  });
});
