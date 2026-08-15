import { useCallback, useRef, useState } from "react";
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

type PronunciationButtonProps = {
  text: string;
  style?: StyleProp<ViewStyle>;
};

export function PronunciationButton({ text, style }: PronunciationButtonProps) {
  const colors = useColors();
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const [speaking, setSpeaking] = useState(false);

  const handlePress = useCallback(
    (event: GestureResponderEvent) => {
      event.stopPropagation?.();
      if (Platform.OS !== "web" || typeof window === "undefined") return;

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
      utterance.voice =
        voices.find((voice) => voice.lang.toLowerCase() === "en-us") ??
        voices.find((voice) => voice.lang.toLowerCase().startsWith("en")) ??
        null;

      utterance.onstart = () => setSpeaking(true);
      utterance.onend = () => {
        if (utteranceRef.current === utterance) setSpeaking(false);
      };
      utterance.onerror = () => {
        if (utteranceRef.current === utterance) setSpeaking(false);
      };
      utteranceRef.current = utterance;
      synth.speak(utterance);
    },
    [text],
  );

  if (Platform.OS !== "web") return null;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${text} 발음 듣기`}
      hitSlop={4}
      onPress={handlePress}
      style={({ pressed }) => [
        styles.button,
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
        size={20}
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
  pressed: {
    opacity: 0.72,
    transform: [{ scale: 0.96 }],
  },
});
