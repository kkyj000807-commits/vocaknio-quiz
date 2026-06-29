import { useCallback } from "react";
import { Pressable, Text, StyleSheet, Platform } from "react-native";
import * as Haptics from "expo-haptics";

import { speakWord } from "@/lib/speech";
import { useColors } from "@/hooks/use-colors";

interface SpeakerButtonProps {
  /** 발음할 영단어/구문 */
  text: string;
  /** 버튼 크기 (기본 36) */
  size?: number;
  /** 느리게 읽기 (학습용 0.92 기본) */
  rate?: number;
}

/**
 * 🔊 발음 듣기 버튼.
 * 누르면 expo-speech(웹은 Web Speech API)로 영단어를 읽어준다.
 */
export function SpeakerButton({ text, size = 36, rate }: SpeakerButtonProps) {
  const colors = useColors();

  const handlePress = useCallback(() => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    speakWord(text, { rate });
  }, [text, rate]);

  return (
    <Pressable
      onPress={handlePress}
      hitSlop={8}
      style={({ pressed }) => [
        styles.btn,
        {
          width: size,
          height: size,
          borderRadius: size / 3,
          backgroundColor: (colors.primary as string) + "1A",
          borderColor: (colors.primary as string) + "55",
        },
        pressed && { opacity: 0.6, transform: [{ scale: 0.92 }] },
      ]}
      accessibilityLabel={`${text} 발음 듣기`}
      accessibilityRole="button"
    >
      <Text style={{ fontSize: size * 0.5 }}>🔊</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
