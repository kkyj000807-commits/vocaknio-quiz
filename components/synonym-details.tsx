import React from "react";
import { Text, View } from "react-native";
import { getSynonymDetails, getSynonymSourceGroups, type VocabItem } from "@/lib/vocab";
import { WordSectionLabel } from "@/components/word-section-label";
import { RelationChips } from "@/components/relation-chips";
import { getDefinitionQuizEntry, getDefinitionRelationMeanings } from "@/lib/definition-quiz";
import { normalizeWord } from "@/lib/vocab";
import { useColors } from "@/hooks/use-colors";

interface SynonymDetailsProps {
  item: VocabItem;
  limit?: number;
  compact?: boolean;
}

export function SynonymDetails({ item, limit, compact = false }: SynonymDetailsProps) {
  const details = getSynonymDetails(item);
  const colors = useColors();
  const reference = getDefinitionQuizEntry(item.id);
  const meanings = new Map((reference ? getDefinitionRelationMeanings(reference, item.k_short) : [])
    .filter(value => value.source === "same-sense-vocab")
    .map(value => [normalizeWord(value.word), value.meaning]));
  if (details.length === 0) return null;

  return (
    <View>
      <Text style={{ color: colors.dim, fontSize: 11 }}>원자료 동의어 · 개별 뜻 미대조 항목은 영어만 표시</Text>
      <RelationChips terms={details.map(detail => ({ word: detail.word,
        meaningKo: meanings.get(normalizeWord(detail.word)) ?? detail.meaning,
        glossEligible: meanings.has(normalizeWord(detail.word)) }))}
        limit={limit ?? 5} showNotes={!compact}
        renderSource={word => <WordSectionLabel groups={getSynonymSourceGroups(item, word)} />} />
    </View>
  );
}
