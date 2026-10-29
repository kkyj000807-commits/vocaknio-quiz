import React, { useEffect, useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import { useColors } from '@/hooks/use-colors';
import { BOOK_EDITION, type BookEdition } from '@/lib/book-edition';
import { inspectLocalBook, loadLocalBook, saveLocalBook, LOCAL_BOOK_MAX_BYTES } from '@/lib/local-book-file';
import { activateLocalBook, getActiveBookEdition } from '@/lib/integrated-wordbook';

export function LocalBookImport({ onLoaded, collapsible = false }: { onLoaded: (data: BookEdition) => void; collapsible?: boolean }) {
  const colors = useColors();
  const [busy, setBusy] = useState(true);
  const [message, setMessage] = useState('이 기기에 보관한 교재를 확인하고 있습니다.');
  const [candidate, setCandidate] = useState<{ raw: string; data: BookEdition } | null>(null);
  const [saveFailed, setSaveFailed] = useState(false);
  const [expanded, setExpanded] = useState(!collapsible);
  useEffect(() => {
    if (Platform.OS !== 'web' || BOOK_EDITION.privateContent) { setBusy(false); return; }
    let active = true;
    void (getActiveBookEdition() ? Promise.resolve(getActiveBookEdition()) : loadLocalBook()).then(data => {
      if (!active) return;
      if (data) { activateLocalBook(data); onLoaded(data); setMessage(`이 기기에 보관한 전체 ${data.entries.length.toLocaleString()}항목을 열었습니다.`); }
      else setMessage('v1.5 개인 학습자료 JSON을 선택하면 원뜻·주석·예문·발음 전체가 열립니다.');
    }).catch(() => { if (active) setMessage('기기 자료를 읽거나 검증하지 못했습니다. 기존 자료·학습 기록은 그대로 두었습니다. 자료 파일을 다시 선택할 수 있습니다.'); })
      .finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [onLoaded]);
  if (Platform.OS !== 'web' || BOOK_EDITION.privateContent) return null;
  const select = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; event.target.value = '';
    setCandidate(null); setSaveFailed(false);
    if (!file) return;
    if (file.size > LOCAL_BOOK_MAX_BYTES) { setMessage('96MiB 이하의 전용 교재 JSON만 선택해 주세요. PDF나 학습 기록 백업이 아닙니다.'); return; }
    setBusy(true); setMessage('파일 판본·해시·전체 항목을 기기 안에서 검사하고 있습니다.');
    try {
      const raw = await file.text(); const data = await inspectLocalBook(raw);
      setCandidate({ raw, data }); setMessage('자료 검증 완료 · 아직 기기에 저장하거나 현재 자료를 바꾸지 않았습니다.');
    } catch { setMessage('이 앱의 v1.5 자료와 일치하지 않거나 불완전한 파일입니다. 현재 교재와 학습 기록은 바꾸지 않았습니다.'); }
    finally { setBusy(false); }
  };
  const save = async () => {
    if (!candidate) return;
    setBusy(true); setSaveFailed(false);
    try {
      const data = await saveLocalBook(candidate.raw); activateLocalBook(data); onLoaded(data); setCandidate(null);
      setMessage(`전체 ${data.entries.length.toLocaleString()}항목을 이 기기에 저장했습니다. 다음에 같은 브라우저로 열면 자동으로 불러옵니다.`);
    } catch { setSaveFailed(true); setMessage('기기 저장을 완료하지 못했습니다. 이전 저장 자료·학습 기록은 유지됩니다. 저장 없이 이번 화면에서만 열 수도 있습니다.'); }
    finally { setBusy(false); }
  };
  const button = (label: string, action: () => void) => <Pressable accessibilityRole="button" disabled={busy}
    accessibilityState={{ disabled: busy }} onPress={action} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={{ color: colors.primary }}>{label}</Text></Pressable>;
  return <View style={{ padding: 12, marginVertical: 12, borderWidth: 1, borderColor: colors.border, borderRadius: 12, gap: 8 }}>
    {collapsible ? <Pressable accessibilityRole="button" accessibilityState={{ expanded }} onPress={() => setExpanded(!expanded)} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={{ color: colors.primary }}>교재 자료 설정 {expanded ? '−' : '+'}</Text></Pressable>
      : <Text style={{ color: colors.foreground, fontWeight: '700' }}>내 기기의 전체 학습자료</Text>}
    {expanded && <>
    <Text style={{ color: colors.muted, lineHeight: 21 }}>자료 본문은 서버로 전송하지 않습니다. 이 브라우저의 교재 보관함에만 저장하며 기존 북마크·MASTER·풀이 기록과 분리합니다. 다른 기기에서는 파일을 다시 선택하세요. 브라우저 데이터 삭제·비공개 모드·저장공간 정리로 자료가 사라질 수 있으니 원본 파일을 보관하세요.</Text>
    <input type="file" accept="application/json,.json" aria-label="v1.5 개인 학습자료 파일 선택" disabled={busy}
      onChange={event => { void select(event); }} style={{ maxWidth: '100%', color: colors.foreground }} />
    <Text accessibilityLiveRegion="polite" style={{ color: colors.foreground, lineHeight: 21 }}>{message}</Text>
    {candidate && <View>
      <Text style={{ color: colors.foreground }}>v{candidate.data.edition} · 전체 {candidate.data.entries.length.toLocaleString()}항목 · {candidate.data.sections.length}개 목차</Text>
      {button('이 기기에 저장하고 전체 내용 열기', () => { void save(); })}
      {saveFailed && <Text style={{ color: colors.muted }}>다음 실행에서도 기록 ID를 복원할 수 있도록 저장 성공 후 통합합니다. 원본 파일을 유지하고 다시 시도하세요.</Text>}
      {button('취소 · 현재 교재 유지', () => { setCandidate(null); setSaveFailed(false); setMessage('파일 선택을 취소했습니다. 현재 교재와 기록은 그대로입니다.'); })}
    </View>}
    </>}
  </View>;
}
