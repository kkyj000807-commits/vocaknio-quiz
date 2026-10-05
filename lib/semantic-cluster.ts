export type SemanticRelationKind = "exact" | "near" | "opposite" | "variant" | "related";

export type SemanticRelationTerm = {
  word: string;
  kind: SemanticRelationKind;
  meaningKo?: string;
};

export type RelationMeaningSource = {
  word: string;
  meaning: string;
};

type BuildSemanticClusterInput = {
  exactSynonyms?: readonly string[];
  nearSynonyms?: readonly string[];
  antonyms?: readonly string[];
  variants?: readonly string[];
  relatedWords?: readonly string[];
  choiceMeanings?: readonly RelationMeaningSource[];
};

function normalized(value: string): string {
  return value.trim().toLowerCase().replace(/_/g, " ").replace(/\s+/g, " ");
}

function uniqueTerms(
  values: readonly string[],
  kind: SemanticRelationKind,
  excluded: Set<string> = new Set(),
): SemanticRelationTerm[] {
  const seen = new Set<string>();
  return values.flatMap((value) => {
    const word = value.trim();
    const key = normalized(word);
    if (!key || seen.has(key) || excluded.has(key)) return [];
    seen.add(key);
    return [{ word, kind }];
  });
}

function cleanMeaningKo(value: string | undefined): string | undefined {
  const cleaned = value
    ?.replace(/^\s*(?:반대축|비교선지)\s*·\s*/u, "")
    .trim();
  if (!cleaned || cleaned === "뜻 확인") return undefined;
  return cleaned;
}

/**
 * 관계를 UI용 의미축으로만 묶는다. 새로운 동의·반의 관계를 추론하지 않는다.
 * 반의어의 한국어 뜻도 실제 문제 선지에 저장된 뜻과 일치할 때만 붙인다.
 */
export function buildSemanticCluster(input: BuildSemanticClusterInput) {
  const exact = uniqueTerms(input.exactSynonyms ?? [], "exact");
  const exactKeys = new Set(exact.map((term) => normalized(term.word)));
  const near = uniqueTerms(input.nearSynonyms ?? [], "near", exactKeys);
  const synonymKeys = new Set([...exactKeys, ...near.map((term) => normalized(term.word))]);
  const meaningByWord = new Map(
    (input.choiceMeanings ?? []).map((choice) => [
      normalized(choice.word),
      cleanMeaningKo(choice.meaning),
    ]),
  );
  const withMeaning = (term: SemanticRelationTerm): SemanticRelationTerm => {
    const meaningKo = meaningByWord.get(normalized(term.word));
    return meaningKo ? { ...term, meaningKo } : term;
  };
  const synonyms = [...exact, ...near].map(withMeaning);
  const opposites = uniqueTerms(input.antonyms ?? [], "opposite", synonymKeys).map((term) => ({
    ...term,
    ...(meaningByWord.get(normalized(term.word)) ? { meaningKo: meaningByWord.get(normalized(term.word)) } : {}),
  }));
  const used = new Set([
    ...synonymKeys,
    ...opposites.map((term) => normalized(term.word)),
  ]);
  const variants = uniqueTerms(input.variants ?? [], "variant", used);
  variants.forEach((term) => used.add(normalized(term.word)));
  const related = uniqueTerms(input.relatedWords ?? [], "related", used);

  return {
    synonyms,
    opposites,
    auxiliaries: [...variants, ...related].map(withMeaning),
  };
}
