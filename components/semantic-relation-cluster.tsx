import { StyleSheet, Text, View } from "react-native";

import { useColors } from "@/hooks/use-colors";
import {
  buildSemanticCluster,
  type RelationMeaningSource,
  type SemanticRelationTerm,
} from "@/lib/semantic-cluster";

type SemanticRelationClusterProps = {
  headword: string;
  coreMeaningKo: string;
  bridgeKo?: string;
  exactSynonyms?: readonly string[];
  nearSynonyms?: readonly string[];
  antonyms?: readonly string[];
  variants?: readonly string[];
  relatedWords?: readonly string[];
  choiceMeanings?: readonly RelationMeaningSource[];
};

const kindLabel = {
  exact: "Exact",
  near: "Near",
  opposite: "반의어",
  variant: "Variant",
  related: "Related",
} as const;

function RelationTerms({
  terms,
  tone,
}: {
  terms: SemanticRelationTerm[];
  tone: "same" | "opposite" | "neutral";
}) {
  const colors = useColors();
  const toneColor = tone === "same" ? colors.success : tone === "opposite" ? colors.error : colors.muted;
  return (
    <View style={styles.terms}>
      {terms.map((term) => (
        <View
          key={`${term.kind}:${term.word}`}
          style={[styles.term, { borderColor: toneColor, backgroundColor: colors.surface }]}
        >
          <View style={styles.termTop}>
            <Text style={[styles.kind, { color: toneColor }]}>{kindLabel[term.kind]}</Text>
            <Text style={[styles.word, { color: colors.foreground }]}>{term.word}</Text>
          </View>
          {term.meaningKo ? (
            <Text style={[styles.meaning, { color: colors.muted }]}>{term.meaningKo}</Text>
          ) : null}
        </View>
      ))}
    </View>
  );
}

export function SemanticRelationCluster({
  headword,
  coreMeaningKo,
  bridgeKo,
  exactSynonyms,
  nearSynonyms,
  antonyms,
  variants,
  relatedWords,
  choiceMeanings,
}: SemanticRelationClusterProps) {
  const colors = useColors();
  const cluster = buildSemanticCluster({
    exactSynonyms,
    nearSynonyms,
    antonyms,
    variants,
    relatedWords,
    choiceMeanings,
  });

  return (
    <View
      accessible
      accessibilityLabel={`${headword} 의미 클러스터. 같은 의미축과 반대 의미축`}
      style={[styles.cluster, { borderColor: colors.border, backgroundColor: colors.surface }]}
    >
      <Text style={[styles.title, { color: colors.primary }]}>의미 클러스터</Text>

      {cluster.synonyms.length > 0 ? (
        <View style={styles.axis}>
          <Text style={[styles.axisLabel, { color: colors.success }]}>≒ 같은 의미축</Text>
          <RelationTerms terms={cluster.synonyms} tone="same" />
        </View>
      ) : null}

      <View style={[styles.core, { borderColor: colors.primary, backgroundColor: colors.card }]}>
        <Text style={[styles.coreLabel, { color: colors.primary }]}>핵심 의미</Text>
        <Text style={[styles.headword, { color: colors.foreground }]}>{headword}</Text>
        <Text style={[styles.coreMeaning, { color: colors.foreground }]}>{coreMeaningKo}</Text>
        {bridgeKo ? <Text style={[styles.bridge, { color: colors.muted }]}>{bridgeKo}</Text> : null}
      </View>

      {cluster.opposites.length > 0 ? (
        <View style={styles.axis}>
          <Text style={[styles.axisLabel, { color: colors.error }]}>←→ 반대 의미축</Text>
          <RelationTerms terms={cluster.opposites} tone="opposite" />
        </View>
      ) : (
        <Text style={[styles.emptyOpposite, { color: colors.muted }]}>←→ 검증된 반의어 관계 없음</Text>
      )}

      {cluster.auxiliaries.length > 0 ? (
        <View style={styles.axis}>
          <Text style={[styles.auxLabel, { color: colors.muted }]}>↳ 형태·관련 표현</Text>
          <RelationTerms terms={cluster.auxiliaries} tone="neutral" />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  cluster: { gap: 10, marginTop: 5, padding: 12, borderWidth: 1, borderRadius: 12 },
  title: { fontSize: 11, lineHeight: 17, fontWeight: "900", letterSpacing: 0.8 },
  axis: { gap: 6 },
  axisLabel: { fontSize: 12, lineHeight: 18, fontWeight: "900" },
  auxLabel: { fontSize: 11, lineHeight: 17, fontWeight: "800" },
  terms: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  term: { maxWidth: "100%", gap: 2, borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 9, paddingVertical: 6 },
  termTop: { flexDirection: "row", alignItems: "baseline", flexWrap: "wrap", gap: 5 },
  kind: { fontSize: 9, lineHeight: 14, fontWeight: "900" },
  word: { fontSize: 12, lineHeight: 18, fontWeight: "700", flexShrink: 1 },
  meaning: { fontSize: 10, lineHeight: 15 },
  core: { gap: 3, padding: 11, borderWidth: 1.5, borderRadius: 10 },
  coreLabel: { fontSize: 9, lineHeight: 14, fontWeight: "900", letterSpacing: 0.8 },
  headword: { fontSize: 18, lineHeight: 24, fontWeight: "900" },
  coreMeaning: { fontSize: 14, lineHeight: 21, fontWeight: "800" },
  bridge: { fontSize: 12, lineHeight: 19 },
  emptyOpposite: { fontSize: 11, lineHeight: 17, fontWeight: "700" },
});
