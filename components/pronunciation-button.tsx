import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Platform,
  Pressable,
  AccessibilityInfo,
  StyleSheet,
  type GestureResponderEvent,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { loadLearningAudio, type LearningAudio } from "@/lib/vocab-learning";
import { playPronunciation, type PronunciationStatus } from "@/lib/pronunciation-playback";
import { usePronunciationPreference } from "@/hooks/use-pronunciation";

type PronunciationButtonProps = {
  text: string;
  itemId?: string;
  style?: StyleProp<ViewStyle>;
  compact?: boolean;
};

export function PronunciationButton({
  text,
  itemId,
  style,
  compact = false,
}: PronunciationButtonProps) {
  const colors = useColors();
  const stopRef = useRef<(() => void) | null>(null);
  const preference = usePronunciationPreference();
  const [licensedAudio, setLicensedAudio] = useState<LearningAudio | null>(null);
  const [status, setStatus] = useState<PronunciationStatus>({ speaking: false, source: "synthesis", failed: false });
  const { speaking } = status;

  useEffect(() => {
    if (Platform.OS === "web" && typeof window !== "undefined") window.speechSynthesis?.getVoices();
    return () => { stopRef.current?.(); stopRef.current = null; };
  }, [text, itemId, preference]);

  useEffect(() => {
    let cancelled = false;
    setLicensedAudio(null);
    if (!itemId || Platform.OS !== "web") return;
    loadLearningAudio(itemId)
      .then((audio) => {
        if (!cancelled) setLicensedAudio(audio);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [itemId]);

  const handlePress = useCallback(
    (event: GestureResponderEvent) => {
      event.stopPropagation?.();
      if (Platform.OS !== "web" || typeof window === "undefined") return;

      if (speaking) {
        stopRef.current?.();
        return;
      }
      stopRef.current = playPronunciation({ text, preference, recordingUrl: licensedAudio?.url, onStatus: value => {
        setStatus(value);
        if (value.failed) AccessibilityInfo.announceForAccessibility("음성을 재생할 수 없습니다. 기기의 영어 음성 설정을 확인하고 다시 눌러 주세요.");
      } });
    },
    [text, preference, licensedAudio, speaking],
  );

  if (Platform.OS !== "web") return null;

  const sourceLabel = (speaking ? status.source === "recording" : preference.preferRecording && licensedAudio)
    ? "라이선스가 확인된 미국식 실제 녹음"
    : "미국 영어 합성음";

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${text} 미국식 발음 ${speaking ? "멈추기" : "듣기"} · ${sourceLabel}${status.failed ? " · 재생 실패, 다시 시도" : ""}`}
      accessibilityHint="설정에서 미국 영어 음성을 고를 수 있습니다. 재생 중 다시 누르면 멈춥니다."
      hitSlop={compact ? 5 : 4}
      onPress={handlePress}
      style={({ pressed }) => [
        styles.button,
        compact && styles.compactButton,
        {
          backgroundColor: speaking ? `${colors.primary}22` : colors.card,
          borderColor: speaking ? colors.primary : colors.border,
        },
        pressed && styles.pressed,
        style,
      ]}
    >
      <IconSymbol
        name="speaker.wave.2.fill"
        size={compact ? 16 : 20}
        color={speaking ? colors.primary : colors.muted}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  compactButton: {
    width: 34,
    height: 34,
    borderRadius: 10,
  },
  pressed: {
    opacity: 0.72,
    transform: [{ scale: 0.96 }],
  },
});
