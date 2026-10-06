import React from "react";
import { StyleSheet, Text } from "react-native";

import { useColors } from "@/hooks/use-colors";
import { formatVocabSections } from "@/lib/vocab";

/** Shared quiet provenance for managed words and their linked synonyms. */
export function WordSectionLabel({ groups }: { groups: readonly (string | undefined)[] }) {
  const colors = useColors();
  return (
    <Text testID="word-section-label" style={[styles.label, { color: colors.metadata }]}>
      {formatVocabSections(groups)}
    </Text>
  );
}

const styles = StyleSheet.create({
  label: {
    fontSize: 11,
    lineHeight: 16,
    fontWeight: "400",
    marginTop: 4,
    flexShrink: 1,
    maxWidth: "100%",
  },
});
