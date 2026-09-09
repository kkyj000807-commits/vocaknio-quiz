import { useSyncExternalStore } from "react";
import { Pressable, Text, View } from "react-native";
import { useColors } from "@/hooks/use-colors";
import { getLearningStorageIssue, retryLearningStorage, subscribeLearningStorage } from "@/lib/store";

export function LearningStorageNotice() {
  const issue = useSyncExternalStore(subscribeLearningStorage, getLearningStorageIssue, () => null);
  const c = useColors();
  if (!issue) return null;
  return <View accessibilityLiveRegion="polite" style={{ padding: 10, borderBottomWidth: 1, borderColor: c.border, backgroundColor: c.surface }}>
    <Text style={{ color: c.foreground, fontSize: 13, lineHeight: 21 }}>{issue}</Text>
    <Pressable accessibilityRole="button" onPress={() => { void retryLearningStorage().catch(() => {}); }} style={{ minHeight: 44, justifyContent: "center" }}>
      <Text style={{ color: c.primary, fontSize: 13, fontWeight: "700" }}>저장 상태 다시 확인</Text>
    </Pressable>
  </View>;
}
