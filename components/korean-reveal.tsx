import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useColors } from "@/hooks/use-colors";

/** Mount inside a keyed sense/example, and only after the answer is revealed. */
export function KoreanReveal({ children, label = "해석·단서", defaultOpen = false }: {
  children: React.ReactNode;
  label?: string;
  defaultOpen?: boolean;
}) {
  const colors = useColors();
  const [open, setOpen] = useState(defaultOpen);
  return <View style={{ gap: 4 }}>
    <Pressable accessibilityRole="button" accessibilityLabel={`${label} ${open ? "접기" : "보기"}`}
      accessibilityState={{ expanded: open }} onPress={() => setOpen(value => !value)}
      style={{ minHeight: 44, justifyContent: "center", alignSelf: "flex-start" }}>
      <Text style={{ color: colors.primary, fontSize: 12 }}>{label} {open ? "접기 −" : "보기 +"}</Text>
    </Pressable>
    {open ? <View style={{ gap: 5 }}>{children}</View> : null}
  </View>;
}
