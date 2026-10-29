import React from "react";
import { Platform, StyleSheet, Text, View, type StyleProp, type TextStyle } from "react-native";
import { useColors } from "@/hooks/use-colors";
import { getKoreanPronunciation } from "@/lib/korean-pronunciation-data";
import type { BookEntry } from "@/lib/book-edition";

/** Study/answer only. The required context prevents a pronunciation hint in a prompt. */
export function WordPronunciation({ item, context, ipaStyle }: {
  item: { id: string; w: string; p: string; book?: BookEntry };
  context: "study" | "answer" | "question";
  ipaStyle?: StyleProp<TextStyle>;
}) {
  const colors = useColors();
  if (!item.p && !item.book?.pronunciation) return null;
  const korean = context === "question" ? null : item.book?.pronunciation?.korean_pronunciation.replace(/^≈\s*/, '') || getKoreanPronunciation(item);
  return <View style={s.row}>
    <Text style={[s.ipa, { color: colors.primary }, ipaStyle]}>{item.p || 'IPA 미확인'}</Text>
    {korean && <Text
      testID="korean-pronunciation"
      accessibilityLabel={`한글 발음 근사치 ${korean}. 정확한 발음은 IPA와 음성을 확인하세요.`}
      style={[s.korean, { color: colors.metadata ?? colors.muted }]}
    >≈ {korean}</Text>}
  </View>;
}

const s = StyleSheet.create({
  row: { flexDirection: "row", flexWrap: "wrap", alignItems: "baseline", columnGap: 6, rowGap: 1, minWidth: 0, maxWidth: "100%" },
  ipa: { fontSize: 11, fontFamily: Platform.OS === "ios" ? "Courier" : "monospace", flexShrink: 1 },
  korean: { fontSize: 11, lineHeight: 16, flexShrink: 1, maxWidth: "100%" },
});
