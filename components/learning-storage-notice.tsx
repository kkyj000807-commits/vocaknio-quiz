import { useRef, useState, useSyncExternalStore } from "react";
import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useColors } from "@/hooks/use-colors";
import { getLearningStorageIssue, getLearningStorageRecovery, getUnreadableLearningRecordNames, retryLearningStorage, subscribeLearningStorage } from "@/lib/store";

const recoverySnapshot = () => JSON.stringify(getLearningStorageRecovery());

export function LearningStorageNotice() {
  const issue = useSyncExternalStore(subscribeLearningStorage, getLearningStorageIssue, () => null);
  const recovery = JSON.parse(useSyncExternalStore(subscribeLearningStorage, recoverySnapshot, () => '{"canRetry":false,"code":null,"pending":false}')) as ReturnType<typeof getLearningStorageRecovery>;
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [retryFailed, setRetryFailed] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
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
    <Text style={{ color: c.foreground, fontSize: 13, lineHeight: 21 }}>{recovery.code === 'STORAGE_FULL' ? '저장 공간이 부족해요. 기록부터 백업해 주세요.'
      : recovery.code === 'STORAGE_BLOCKED' ? '브라우저가 기록 저장을 막고 있어요.'
      : recovery.code === 'STORAGE_CONFLICT' ? '다른 기록과 충돌해 덮어쓰기를 막았어요. 먼저 백업해 주세요.'
      : recovery.code === 'RECORD_FORMAT' ? '기록을 읽지 못했어요. 원본은 지우지 않고 보관 중입니다.'
      : '학습 기록 저장을 확인하지 못했어요. 다시 확인해 주세요.'}</Text>
    {recovery.pending && <Text style={{ color: c.foreground, fontSize: 13 }}>미저장 기록이 있어요. 이 창을 닫거나 사이트 데이터를 지우지 마세요.</Text>}
    <Pressable accessibilityRole="button" accessibilityState={{ expanded: detailsOpen }} onPress={() => setDetailsOpen(value => !value)} style={{ minHeight: 44, justifyContent: 'center' }}>
      <Text style={{ color: c.primary }}>오류 상세 {detailsOpen ? '접기' : '보기'}</Text>
    </Pressable>
    {detailsOpen && <Text selectable style={{ color: c.foreground, fontSize: 12, lineHeight: 19 }}>{recovery.code}{' · '}{getUnreadableLearningRecordNames().join(', ')}{'\n'}{issue}</Text>}
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
