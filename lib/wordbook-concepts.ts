import source from "@/assets/wordbook-concepts.json";
import type { BookEntry } from "./book-edition";

interface ConceptItem { id: string; w: string; k: string; group: string }
interface OriginalHeading { word: string; meaning: string; group: string; major: string; detail: string; chapter: string }

/** Original occurrence headings only. Never use inherited synonym/quiz metadata here. */
export function getWordbookConcept(item: ConceptItem): OriginalHeading | null {
  if (source.schema !== 1 || !["V301", "V502"].includes(item.group)) return null;
  const entry = (source.entries as Record<string, OriginalHeading>)[item.id];
  if (!entry || entry.word !== item.w || entry.meaning !== item.k || entry.group !== item.group) return null;
  return entry;
}

export function formatWordbookConcept(item: ConceptItem): string {
  const entry = getWordbookConcept(item);
  if (!entry) return "원문 개념: 분류 확인 중";
  return `원문 개념: ${entry.major}${entry.detail ? ` → ${entry.detail}` : ""}`;
}

/** A memory cue, NOT the grading key. Only run after the answer is disclosed. */
export function quizBookCategory(item: ConceptItem & { book?: BookEntry }, answered: boolean): string | null {
  if (!answered) return null;
  const b = item.book;
  const section = b?.section ?? item.group;
  if (section !== 'V301' && section !== 'V502') return null;
  if (b?.historical) return null;
  const format = (major: string, detail: string) => [...new Set([major.trim(), detail.trim()].filter(Boolean))].join(' → ');
  const prefix = section + ' 암기 범주 · ';
  if (b?.concept?.trim()) return prefix + format(b.concept,b.chunk || '');
  if (!b) {
    const heading = getWordbookConcept(item);
    return heading?.major ? prefix + format(heading.major,heading.detail) : prefix + '미확인';
  }
  // Revised editions may combine senses. Match complete gloss units (not a substring).
  const gloss = (s: string) => s.split(/\s*[;,/·]\s*/).map(x=>x.trim()).filter(Boolean);
  const senses = '|' + gloss(b.display?.meaning_display ?? '').join('|') + '|';
  const headings = new Set<string>();
  for (const id of b.appIds) {
    const ref = (source.entries as Record<string, OriginalHeading>)[id];
    if (!ref || !ref.major || ref.group !== section || ref.word !== b.word) continue;
    const units = gloss(ref.meaning);
    if (units.length && senses.includes('|' + units.join('|') + '|')) headings.add(format(ref.major,ref.detail));
  }
  return prefix + (headings.size ? [...headings].join(' / ') : '미확인');
}
