import { useMemo } from "react";
import { Modal, View, Text, Pressable, ScrollView, StyleSheet } from "react-native";

import { VOCAB, VocabItem } from "@/lib/vocab";
import { SpeakerButton } from "@/components/speaker-button";
import { useColors } from "@/hooks/use-colors";

// 선지 문자열로 가장 알맞은 사전 항목 찾기
function lookup(word: string): VocabItem | null {
  if (!word) return null;
  const w = word.trim().toLowerCase();
  // 1) 표제어 정확 일치
  let hit = VOCAB.find((v) => v.w.toLowerCase() === w);
  if (hit) return hit;
  // 2) 동의어로 포함된 표제어 (정의/첨언이 있는 것 우선)
  const cands = VOCAB.filter((v) => v.s.some((s) => s.toLowerCase() === w));
  if (cands.length > 0) {
    return cands.find((v) => v.def || v.etym) ?? cands[0];
  }
  return null;
}

/**
 * 선지 단어 상세 학습 모달 — 영영사전처럼 단어를 눌러 뜻·동의어·정의·발음을 확인.
 */
export function WordDetailModal({
  word,
  onClose,
}: {
  word: string | null;
  onClose: () => void;
}) {
  const colors = useColors();
  const item = useMemo(() => (word ? lookup(word) : null), [word]);
  const s = styles(colors);
  const visible = !!word;

  // 표시할 표제어 (사전 항목이 있으면 그 표제어, 없으면 선지 문자열 그대로)
  const headword = item?.w ?? word ?? "";

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={s.backdrop} onPress={onClose}>
        <Pressable style={s.sheet} onPress={(e) => e.stopPropagation?.()}>
          <View style={s.handle} />
          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={s.headRow}>
              <Text style={s.word}>{headword}</Text>
              <SpeakerButton text={headword} size={40} />
            </View>
            {item?.p ? <Text style={s.ipa}>{item.p}</Text> : null}

            {item ? (
              <>
                <Text style={s.kor}>{item.k_short || item.k}</Text>

                {item.def ? (
                  <View style={s.defBox}>
                    <Text style={s.defText}>📖 {item.def}</Text>
                  </View>
                ) : null}

                {item.etym ? (
                  <View style={s.etymBox}>
                    <Text style={s.etymText}>💡 {item.etym}</Text>
                  </View>
                ) : null}

                {item.s.length > 0 ? (
                  <View style={s.synRow}>
                    {item.s.map((syn, i) => (
                      <View key={i} style={s.synTag}>
                        <Text style={s.synTagText}>{syn}</Text>
                      </View>
                    ))}
                  </View>
                ) : null}

                {item.antonym && item.antonym.length > 0 ? (
                  <View style={s.antBlock}>
                    <Text style={s.antLabel}>반의어</Text>
                    <View style={s.synRow}>
                      {item.antonym.map((a, i) => (
                        <View key={i} style={s.antTag}>
                          <Text style={s.antTagText}>{a}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                ) : null}
              </>
            ) : (
              <Text style={s.noInfo}>이 단어의 사전 정보는 아직 없어요. 발음만 들어볼 수 있어요.</Text>
            )}
          </ScrollView>

          <Pressable style={s.closeBtn} onPress={onClose}>
            <Text style={s.closeText}>닫기</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = (colors: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.55)",
      justifyContent: "flex-end",
    },
    sheet: {
      backgroundColor: colors.surface as string,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      borderWidth: 1,
      borderColor: colors.border as string,
      paddingHorizontal: 22,
      paddingTop: 10,
      paddingBottom: 24,
      maxHeight: "80%",
    },
    handle: {
      alignSelf: "center",
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.border as string,
      marginBottom: 16,
    },
    headRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      flexWrap: "wrap",
    },
    word: {
      fontSize: 26,
      fontWeight: "800",
      color: colors.foreground as string,
      letterSpacing: -0.5,
    },
    ipa: {
      fontSize: 13,
      color: colors.primary2 as string,
      marginTop: 4,
      fontFamily: "monospace",
    },
    kor: {
      fontSize: 15,
      color: colors.foreground as string,
      lineHeight: 22,
      marginTop: 14,
    },
    defBox: {
      marginTop: 12,
      padding: 12,
      borderRadius: 10,
      backgroundColor: (colors.primary as string) + "12",
      borderLeftWidth: 3,
      borderLeftColor: (colors.primary as string) + "88",
    },
    defText: { fontSize: 13, lineHeight: 19, color: colors.muted as string, fontStyle: "italic" },
    etymBox: {
      marginTop: 10,
      padding: 12,
      borderRadius: 10,
      backgroundColor: (colors.warning as string) + "14",
      borderLeftWidth: 3,
      borderLeftColor: (colors.warning as string) + "88",
    },
    etymText: { fontSize: 13, lineHeight: 19, color: colors.muted as string },
    synRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 14 },
    synTag: {
      backgroundColor: (colors.primary as string) + "18",
      borderWidth: 1,
      borderColor: (colors.primary as string) + "35",
      borderRadius: 20,
      paddingHorizontal: 11,
      paddingVertical: 4,
    },
    synTagText: { fontSize: 12, color: colors.primary as string },
    antBlock: { marginTop: 16 },
    antLabel: {
      fontSize: 10,
      fontWeight: "700",
      letterSpacing: 1,
      textTransform: "uppercase",
      color: colors.dim as string,
      marginBottom: 2,
    },
    antTag: {
      backgroundColor: (colors.error as string) + "14",
      borderWidth: 1,
      borderColor: (colors.error as string) + "35",
      borderRadius: 20,
      paddingHorizontal: 11,
      paddingVertical: 4,
    },
    antTagText: { fontSize: 12, color: colors.error as string },
    noInfo: { fontSize: 14, color: colors.muted as string, marginTop: 14, lineHeight: 20 },
    closeBtn: {
      marginTop: 16,
      backgroundColor: colors.primary as string,
      borderRadius: 12,
      paddingVertical: 14,
      alignItems: "center",
    },
    closeText: { fontSize: 14, fontWeight: "700", color: "#fff" },
  });
