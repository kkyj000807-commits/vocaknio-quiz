import React, { useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useColors } from "@/hooks/use-colors";
import { useAmericanVoices, usePronunciationPreference, updatePronunciationPreference } from "@/hooks/use-pronunciation";
import type { PronunciationPreference } from "@/lib/pronunciation-preference";
import { selectAmericanVoice } from "@/lib/us-pronunciation";
import { PronunciationButton } from "./pronunciation-button";

export function PronunciationSettings() {
  const colors = useColors();
  const preference = usePronunciationPreference();
  const voices = useAmericanVoices();
  const [expanded, setExpanded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  if (Platform.OS !== "web") return null;
  const selected = selectAmericanVoice(voices, preference.voiceURI);
  const choose = async (value: PronunciationPreference) => {
    setSaving(true); setError(false);
    try { await updatePronunciationPreference(value); } catch { setError(true); }
    finally { setSaving(false); }
  };
  const option = (key: string, label: string, active: boolean, onPress: () => void) => (
    <Pressable key={key} accessibilityRole="button" accessibilityState={{ selected: active, disabled: saving }}
      disabled={saving} onPress={onPress} style={[s.option, { backgroundColor: active ? colors.surface : colors.card, borderColor: active ? colors.primary : colors.border }]}>
      <Text style={{ color: active ? colors.primary : colors.foreground, flexShrink: 1 }}>{active ? "✓ " : ""}{label}</Text>
    </Pressable>
  );
  return <View style={s.section}>
    <Text style={[s.heading, { color: colors.foreground }]}>영어 음성</Text>
    <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={{ color: colors.foreground }}>미국 영어 · 자연스러운 속도 0.95</Text>
      <Text style={[s.note, { color: colors.muted }]}>자동 선택은 지원되는 여성 음성을 우선합니다. 실제 음색과 품질은 기기마다 달라요.</Text>
      <View style={s.preview}>
        <Text style={[s.previewText, { color: colors.foreground }]}>Take your time. A clear example makes the meaning easier to understand.</Text>
        <PronunciationButton text="Take your time. A clear example makes the meaning easier to understand." />
      </View>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded }} onPress={() => setExpanded(!expanded)} style={s.option}>
        <Text style={{ color: colors.primary }}>음성 선택 · {selected?.name ?? "기기 기본 미국 영어"} {expanded ? "−" : "+"}</Text>
      </Pressable>
      {expanded && <View style={s.options}>
        {option("auto", "자동 · 여성 음성 우선", !preference.voiceURI, () => { void choose({ ...preference, voiceURI: null }); })}
        {voices.map(voice => option(voice.voiceURI, voice.name, voice.voiceURI === preference.voiceURI, () => { void choose({ ...preference, voiceURI: voice.voiceURI }); }))}
        {!voices.length && <Text style={[s.note, { color: colors.muted }]}>아직 미국 영어 음성 목록이 없습니다. 목록이 제공되면 여기에 표시됩니다.</Text>}
        {preference.voiceURI && !voices.some(voice => voice.voiceURI === preference.voiceURI) && <Text style={[s.note, { color: colors.muted }]}>저장한 음성이 이 기기에 없어 자동 선택을 사용합니다.</Text>}
      </View>}
      {option("recording", "단어는 이용 허가된 실제 녹음 우선", preference.preferRecording, () => { void choose({ ...preference, preferRecording: !preference.preferRecording }); })}
      <Text style={[s.note, { color: colors.muted }]}>실제 녹음이 없는 단어와 예문은 선택한 합성음으로 읽습니다. 녹음에는 성별 보장이 없습니다.</Text>
      {error && <Text accessibilityRole="alert" style={{ color: colors.error }}>설정을 저장하지 못했습니다. 기존 설정은 유지됩니다. 다시 선택해 주세요.</Text>}
    </View>
  </View>;
}

const s = StyleSheet.create({
  section: { gap: 10, marginBottom: 24 }, heading: { fontSize: 16, fontWeight: "700" },
  card: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 12 },
  note: { fontSize: 13, lineHeight: 20 }, options: { gap: 8 },
  option: { minHeight: 44, borderWidth: 1, borderColor: "transparent", borderRadius: 10, padding: 10, justifyContent: "center" },
  preview: { flexDirection: "row", alignItems: "center", gap: 12 }, previewText: { flex: 1, fontSize: 15, lineHeight: 23 },
});
