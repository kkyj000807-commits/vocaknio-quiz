import source from "@/assets/wordbook-concepts.json";

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
