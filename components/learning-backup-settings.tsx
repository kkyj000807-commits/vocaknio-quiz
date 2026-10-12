import React, { useState } from "react";
import { Platform, Pressable, Text, View } from "react-native";
import { useColors } from "@/hooks/use-colors";
import { exportLearningBackup, inspectLearningBackup, restoreLearningBackup } from "@/lib/store";
import { BACKUP_MAX_BYTES, type LearningBackupPreview } from "@/lib/learning-backup";

export function LearningBackupSettings() {
  const c = useColors();
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [preview, setPreview] = useState<LearningBackupPreview | null>(null);
  if (Platform.OS !== "web") return null;
  const save = async () => {
    setBusy(true); setMessage("");
    try {
      const backup = await exportLearningBackup();
      const url = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" }));
      const link = document.createElement("a");
      link.href = url; link.download = `FINETUNE-learning-${backup.createdAt.replace(/[:.]/g, "-")}.json`;
      document.body.appendChild(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
      setMessage(backup.unreadableKeys.length
        ? "읽지 못한 항목이 있어 불완전한 구조 백업입니다. 원본은 그대로 두었습니다. 다운로드 파일을 확인해 주세요."
        : "다운로드를 요청했습니다. 파일 저장을 확인해 주세요. 미저장·복구 기록은 별도 보존되며 자동 병합하지 않습니다.");
    } catch { setMessage("백업 파일을 만들지 못했습니다. 원본 기록은 변경하지 않았습니다."); }
    finally { setBusy(false); }
  };
  const select = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    setPreview(null); setMessage("");
    if (!file) return;
    if (file.size > BACKUP_MAX_BYTES) { setMessage("30MB 이하의 FINETUNE 학습 백업만 확인할 수 있습니다."); return; }
    setBusy(true);
    try { setPreview(await inspectLearningBackup(await file.text())); }
    catch { setMessage("지원하지 않는 판본·손상·불완전한 백업이거나 현재 저장소를 읽지 못했습니다. 원본은 변경하지 않았습니다."); }
    finally { setBusy(false); }
  };
  const apply = async () => {
    if (!preview || preview.conflicts.length) return;
    setBusy(true); setMessage("");
    try { await restoreLearningBackup(preview); setPreview(null); setMessage("복원이 저장되었습니다. 학습 화면을 다시 열어 기록을 확인해 주세요."); }
    catch { setPreview(null); setMessage("기록 변경·충돌·저장 실패로 복원 완료를 확인하지 못했습니다. 백업을 보존하고 저장 상태를 확인해 주세요."); }
    finally { setBusy(false); }
  };
  const button = (label: string, action: () => void, disabled = false) => <Pressable accessibilityRole="button" accessibilityState={{ disabled: busy || disabled }} disabled={busy || disabled} onPress={action}
    style={{ minHeight: 44, justifyContent: "center", opacity: busy || disabled ? 0.5 : 1 }}><Text style={{ color: c.primary }}>{label}</Text></Pressable>;
  return <View style={{ gap: 8, marginBottom: 24 }}>
    <Pressable accessibilityRole="button" accessibilityState={{ expanded }} onPress={() => setExpanded(!expanded)} style={{ minHeight: 44, justifyContent: "center" }}>
      <Text style={{ color: c.foreground, fontWeight: "700", fontSize: 16 }}>학습 기록 백업·복원 {expanded ? "−" : "+"}</Text>
    </Pressable>
    {expanded && <View style={{ gap: 8, padding: 14, backgroundColor: c.card, borderRadius: 12 }}>
      <Text style={{ color: c.muted, lineHeight: 21 }}>이 기기의 통계·오답·북마크·MASTER·의미별 기록·중단 세션을 파일로 보관합니다. 로그인 정보는 포함하지 않습니다. 개인 학습 기록이므로 공개 업로드하지 마세요.</Text>
      {button("백업 파일 다운로드", () => { void save(); })}
      <Text style={{ color: c.foreground }}>백업 파일 검사 (아직 저장하지 않음)</Text>
      <input type="file" accept="application/json,.json" aria-label="학습 백업 파일 선택" disabled={busy} onChange={event => { void select(event); }} style={{ maxWidth: "100%", color: c.foreground }} />
      {preview && <View style={{ gap: 8 }}>
        <Text style={{ color: c.foreground, lineHeight: 21 }}>백업 시각: {preview.backup.createdAt}{"\n"}추가할 기록 묶음 {preview.entries.length} · 동일 {preview.unchanged} · 충돌 {preview.conflicts.length}</Text>
        {preview.conflicts.length > 0 ? <Text style={{ color: c.muted, lineHeight: 21 }}>기존 기록 또는 미저장 기록과 충돌합니다. 현재 기록을 유지하며 자동 병합·덮어쓰기는 하지 않습니다. 이 파일과 현재 기기의 백업을 함께 보관해 주세요.</Text>
          : button("확인한 백업을 빈 학습 저장소에 복원", () => { void apply(); }, !preview.entries.length)}
        {button("취소 · 현재 기록 유지", () => setPreview(null))}
      </View>}
      {!!message && <Text accessibilityLiveRegion="polite" style={{ color: c.foreground, lineHeight: 21 }}>{message}</Text>}
    </View>}
  </View>;
}
