import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { useColors } from "@/hooks/use-colors";
import { getSynonymDetails, getSynonymSourceGroups, type VocabItem } from "@/lib/vocab";
import { WordSectionLabel } from "@/components/word-section-label";

interface SynonymDetailsProps {
  item: VocabItem;
  limit?: number;
  compact?: boolean;
}

export function SynonymDetails({ item, limit, compact = false }: SynonymDetailsProps) {
  const colors = useColors();
  const details = getSynonymDetails(item);
  const visible = limit ? details.slice(0, limit) : details;
  if (visible.length === 0) return null;

  return (
    <View style={[styles.list, compact && styles.compactList]}>
      {visible.map((detail) => (
        <View
          key={`${detail.conceptId}:${detail.word}`}
          style={[styles.row, { borderColor: colors.border, backgroundColor: colors.card }]}
        >
          <View style={styles.content}>
            <Text style={[styles.word, { color: colors.primary }]}>{detail.word}</Text>
            <Text style={[styles.meaning, { color: colors.muted }]} numberOfLines={compact ? 1 : 3}>
              {detail.meaning}
            </Text>
          </View>
          <WordSectionLabel groups={getSynonymSourceGroups(item, detail.word)} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: 6,
  },
  compactList: {
    gap: 4,
  },
  row: {
    maxWidth: "100%",
    gap: 2,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderWidth: 1,
    borderRadius: 6,
  },
  content: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  word: {
    width: 104,
    fontSize: 13,
    fontWeight: "700",
  },
  meaning: {
    flex: 1,
    minWidth: 0,
    fontSize: 12,
    lineHeight: 17,
  },
});
