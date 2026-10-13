import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useColors } from "@/hooks/use-colors";
import { KoreanReveal } from "@/components/korean-reveal";
import { shortRelationGloss, type SemanticRelationTerm } from "@/lib/semantic-cluster";

type ChipTerm = Pick<SemanticRelationTerm, "word" | "meaningKo"> & { kind?: SemanticRelationTerm["kind"]; glossEligible?: boolean };

/** One presentation for reviewed sense relations and original vocabulary links. */
export function RelationChips({ terms, limit = 5, showNotes = false, renderSource }: {
  terms: readonly ChipTerm[];
  limit?: number;
  showNotes?: boolean;
  renderSource?: (word: string) => React.ReactNode;
}) {
  const colors = useColors();
  const [allOpen, setAllOpen] = useState(false);
  const count = Number.isFinite(limit) ? Math.max(1, Math.floor(limit)) : 5;
  const visible = allOpen ? terms : terms.slice(0, count);
  const notes = visible.filter(term => term.meaningKo);
  return <View style={s.body}>
    <View style={s.chips}>
      {visible.map(term => <View key={`${term.kind ?? "source"}:${term.word}`} style={[s.chip, { backgroundColor: colors.background }]}>
        <Text style={[s.word, { color: colors.foreground }]}>
          {term.kind === "near" ? "≈ " : ""}{term.word}
        </Text>
        {renderSource?.(term.word)}
      </View>)}
    </View>
    {terms.length > count && <Pressable accessibilityRole="button" accessibilityState={{ expanded: allOpen }} onPress={() => setAllOpen(value => !value)} style={s.button}>
      <Text style={{ color: colors.primary }}>{allOpen ? "접기" : `더보기 · ${terms.length - count}개`}</Text>
    </Pressable>}
    {notes.length > 0 && <KoreanReveal key={terms.map(term => `${term.word}:${term.meaningKo ?? ""}`).join("|")} label="관계어 뜻·차이" defaultOpen={showNotes}>
      {notes.map(term => <Text key={`note:${term.word}`} style={[s.note, { color: colors.muted }]}>
        {term.word}{term.glossEligible !== false && shortRelationGloss(term.meaningKo) ? ` (${shortRelationGloss(term.meaningKo)})` : ` — ${term.meaningKo}`}
      </Text>)}
    </KoreanReveal>}
  </View>;
}

const s = StyleSheet.create({
  body: { gap: 4 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: { maxWidth: "100%", paddingHorizontal: 9, paddingVertical: 6, borderRadius: 8, gap: 2 },
  word: { fontSize: 14, lineHeight: 22, fontWeight: "600", flexShrink: 1 },
  gloss: { fontSize: 12, fontWeight: "400" },
  button: { minHeight: 44, justifyContent: "center", alignSelf: "flex-start" },
  note: { fontSize: 12, lineHeight: 20 },
});
