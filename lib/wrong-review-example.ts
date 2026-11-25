import examples from '@/assets/wrong-review-examples.json';
import type { BookEntry } from './book-edition';
import type { VocabItem } from './vocab';
import type { VocabDefinitionEntry } from './vocab-definitions';

/** Dictionary illustration, never a Korean answer key. Keep it paired with its own definition. */
export function dictionaryUsage(entry: VocabDefinitionEntry | null | undefined, word: string, linkedSenseId?: string) {
  const norm = (s:string) => s.trim().toLowerCase().replace(/_/g,' ').replace(/\s+/g,' ');
  const key = norm(word);
  if (!entry || !key || norm(entry.headword) !== key || entry.status === 'dictionary_alias_unreviewed') return;
  for (const sense of entry.senses) {
    if (linkedSenseId ? linkedSenseId !== sense.senseId : entry.status !== 'single_sense' || entry.senses.length !== 1) continue;
    const candidates = sense.examples?.filter(en =>
      (' '+norm(en).replace(/[^a-z0-9' -]/g,' ')+' ').includes(' '+key+' '));
    if (!candidates?.length) continue;
    const translated = sense.reviewedExamples?.find(x=>candidates.includes(x.en) && x.ko);
    return {en:translated?.en ?? candidates[0], ko:translated?.ko, definition:sense.definition};
  }
}

const byId = new Map<string,{ row:typeof examples[number]; gloss:string; section:string }[]>();
for (const row of examples) for (const { id, gloss, section } of row.links) {
  const values = byId.get(id) ?? [];
  values.push({ row, gloss, section });
  byId.set(id, values);
}

export function wrongReviewExample(item?: Pick<VocabItem,'id'|'w'|'k'|'group'>, book?: BookEntry) {
  if (book?.historical) return;
  const id = book?.id ?? item?.id;
  if (!id) return;
  return byId.get(id)?.find(x => x.row.word === (book ? book.word : item?.w)
    && x.section === (book ? book.section : item?.group)
    && x.gloss === (book ? book.display?.meaning_display : item?.k))?.row;
}
