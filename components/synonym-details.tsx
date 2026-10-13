import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { getSynonymDetails, getSynonymSourceGroups, type VocabItem } from "@/lib/vocab";
import { WordSectionLabel } from "@/components/word-section-label";
import { RelationChips } from "@/components/relation-chips";
import { getDefinitionQuizEntry, getDefinitionRelationMeanings, getDefinitionAnswerRelations } from "@/lib/definition-quiz";
import { normalizeWord } from "@/lib/vocab";
import { useColors } from "@/hooks/use-colors";

interface SynonymDetailsProps {
  item: VocabItem;
  limit?: number;
  compact?: boolean;
}

export function SynonymDetails({ item, limit }: SynonymDetailsProps) {
  const details = getSynonymDetails(item);
  const colors = useColors();
  const [sourceOpen, setSourceOpen] = useState(false);
  const reference = getDefinitionQuizEntry(item.id);
  const meanings = new Map((reference ? getDefinitionRelationMeanings(reference, item.k_short) : [])
    .filter(value => value.source === "same-sense-vocab")
    .map(value => [normalizeWord(value.word), value.meaning]));
  const dictionaryWords = reference ? getDefinitionAnswerRelations(reference).synonyms : [];
  const primary = dictionaryWords.length ? dictionaryWords.map(word => ({ word,
    meaningKo: meanings.get(normalizeWord(word)), glossEligible: meanings.has(normalizeWord(word)) }))
    : details.map(detail => ({ word: detail.word, meaningKo: detail.meaning, glossEligible: false }));
  const dictionaryKeys = new Set(dictionaryWords.map(normalizeWord));
  const additional = dictionaryWords.length ? details.filter(detail => !dictionaryKeys.has(normalizeWord(detail.word))) : [];
  if (primary.length === 0) return null;
  const sourceLabel = (word: string) => {
    const groups = getSynonymSourceGroups(item, word);
    return groups.length ? <WordSectionLabel groups={groups} /> : null;
  };

  return (
    <View>
      <Text style={{ color: colors.dim, fontSize: 11 }}>{dictionaryWords.length ? "같은 사전 sense 동의어 · OEWN 2025" : "원자료 관계 · 의미 대조 전"} · 개별 뜻 미대조 항목은 영어만 표시</Text>
      <RelationChips terms={primary}
        limit={limit ?? 5}
        renderSource={sourceLabel} />
      {additional.length > 0 && <Pressable accessibilityRole="button" accessibilityState={{ expanded: sourceOpen }} onPress={() => setSourceOpen(value => !value)} style={{ minHeight: 44, justifyContent: "center" }}>
        <Text style={{ color: colors.dim, fontSize: 12 }}>원자료 추가 관계 · 의미 대조 전 {sourceOpen ? "접기" : "보기"}</Text>
      </Pressable>}
      {sourceOpen && <RelationChips terms={additional.map(detail => ({ word: detail.word, meaningKo: detail.meaning, glossEligible: false }))} renderSource={sourceLabel} />}
    </View>
  );
}
