import { useRef, useState, useSyncExternalStore } from "react";
import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useColors } from "@/hooks/use-colors";
import { getLearningStorageIssue, getLearningStorageRecovery, retryLearningStorage, subscribeLearningStorage } from "@/lib/store";

const recoverySnapshot = () => JSON.stringify(getLearningStorageRecovery());

export function LearningStorageNotice() {
  const issue = useSyncExternalStore(subscribeLearningStorage, getLearningStorageIssue, () => null);
  const recovery = JSON.parse(useSyncExternalStore(subscribeLearningStorage, recoverySnapshot, () => '{"canRetry":false,"code":null,"pending":false}')) as ReturnType<typeof getLearningStorageRecovery>;
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [retryFailed, setRetryFailed] = useState(false);
  const retrying = useRef(false);
  const c = useColors();
  if (!issue) return null;
  const retry = async () => {
    if (retrying.current || !getLearningStorageRecovery().canRetry) return;
    retrying.current = true; setBusy(true); setRetryFailed(false);
    try { await retryLearningStorage(); setRetryFailed(Boolean(getLearningStorageIssue())); }
    catch { setRetryFailed(true); }
    finally { retrying.current = false; setBusy(false); }
  };
  return <View accessibilityLiveRegion="polite" style={{ padding: 10, borderBottomWidth: 1, borderColor: c.border, backgroundColor: c.surface }}>
    <Text style={{ color: c.foreground, fontSize: 13, lineHeight: 21 }}>{issue}</Text>
    {retryFailed && <Text style={{ color: c.foreground, fontSize: 12 }}>아직 복구를 완료하지 못했습니다. 원본은 유지됩니다.</Text>}
    {recovery.canRetry && <Pressable accessibilityRole="button" accessibilityState={{ disabled: busy, busy }} disabled={busy}
      onPress={() => { void retry(); }} style={{ minHeight: 44, justifyContent: "center" }}>
      <Text style={{ color: c.primary, fontSize: 13, fontWeight: "700" }}>{busy ? "저장 상태 확인 중…" : "저장 상태 다시 확인"}</Text>
    </Pressable>}
    <Pressable accessibilityRole="button" onPress={() => router.push("/(tabs)/settings")} style={{ minHeight: 44, justifyContent: "center" }}>
      <Text style={{ color: c.primary, fontSize: 13, fontWeight: "700" }}>기록 백업·복구 안내</Text>
    </Pressable>
  </View>;
}
