import { useCallback, useEffect, useRef, useState, type MutableRefObject } from "react";
import {
  Platform,
  Pressable,
  StyleSheet,
  type GestureResponderEvent,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { loadLearningAudio, type LearningAudio } from "@/lib/vocab-learning";
import { selectAmericanVoice } from "@/lib/us-pronunciation";

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
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [licensedAudio, setLicensedAudio] = useState<LearningAudio | null>(null);
  const [speaking, setSpeaking] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLicensedAudio(null);
    audioRef.current?.pause();
    audioRef.current = null;
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

  useEffect(() => {
    if (!licensedAudio || Platform.OS !== "web" || typeof window === "undefined") return;
    const audio = new window.Audio(licensedAudio.url);
    audio.preload = "metadata";
    audio.onplay = () => setSpeaking(true);
    audio.onended = () => setSpeaking(false);
    audio.onerror = () => setSpeaking(false);
    audioRef.current = audio;
    return () => {
      audio.pause();
      audioRef.current = null;
    };
  }, [licensedAudio]);

  const handlePress = useCallback(
    (event: GestureResponderEvent) => {
      event.stopPropagation?.();
      if (Platform.OS !== "web" || typeof window === "undefined") return;

      const recordedAudio = audioRef.current;
      if (recordedAudio) {
        window.speechSynthesis?.cancel();
        recordedAudio.currentTime = 0;
        void recordedAudio.play().catch(() => {
          setSpeaking(false);
          speakWithAmericanFallback(text, utteranceRef, setSpeaking);
        });
        return;
      }

      speakWithAmericanFallback(text, utteranceRef, setSpeaking);
    },
    [text],
  );

  if (Platform.OS !== "web") return null;

  const sourceLabel = licensedAudio
    ? "라이선스가 확인된 미국식 실제 녹음"
    : "미국 영어 합성음";

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${text} 미국식 발음 듣기 · ${sourceLabel}`}
      accessibilityHint={licensedAudio ? "Wikimedia Commons의 이용 허가된 녹음을 재생합니다." : "기기의 미국 영어 음성을 사용합니다."}
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

function speakWithAmericanFallback(
  text: string,
  utteranceRef: MutableRefObject<SpeechSynthesisUtterance | null>,
  setSpeaking: (value: boolean) => void,
) {
  if (typeof window === "undefined") return;

  const synth = window.speechSynthesis;
  const Utterance = window.SpeechSynthesisUtterance;
  const pronunciation = text.trim();
  if (!synth || !Utterance || !pronunciation) return;

  synth.cancel();
  const utterance = new Utterance(pronunciation);
  utterance.lang = "en-US";
  utterance.rate = 0.85;
  utterance.pitch = 1;
  utterance.volume = 1;

  const voices = synth.getVoices();
  utterance.voice = selectAmericanVoice(voices);

  utterance.onstart = () => setSpeaking(true);
  utterance.onend = () => {
    if (utteranceRef.current === utterance) setSpeaking(false);
  };
  utterance.onerror = () => {
    if (utteranceRef.current === utterance) setSpeaking(false);
  };
  utteranceRef.current = utterance;
  synth.speak(utterance);
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
