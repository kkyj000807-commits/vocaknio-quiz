import { Image, StyleSheet, Text, View } from "react-native";
import { useColors } from "@/hooks/use-colors";
import { getMnemonicAsset, type MnemonicVisual } from "@/lib/mnemonic-visual";

export function MnemonicCue({ visual }: { visual: MnemonicVisual }) {
  const colors = useColors();
  return (
    <View style={[styles.box, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Image
        accessibilityLabel={visual.visualConcept}
        resizeMode="contain"
        source={getMnemonicAsset(visual)}
        style={styles.image}
      />
      <Text style={[styles.caption, { color: colors.muted }]}>
        {visual.visualConcept}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderWidth: 1, borderRadius: 12, padding: 10, alignItems: "center", gap: 6, marginBottom: 12 },
  image: { width: "100%", maxWidth: 260, height: 112 },
  caption: { fontSize: 12, lineHeight: 18, textAlign: "center" },
});
