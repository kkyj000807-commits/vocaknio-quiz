import React, { useEffect, useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import { useColors } from '@/hooks/use-colors';
import { BOOK_EDITION, type BookEdition } from '@/lib/book-edition';
import { inspectLocalBook, loadLocalBook, saveLocalBook, LOCAL_BOOK_MAX_BYTES, localBookFailureMessage } from '@/lib/local-book-file';
import { activateLocalBook, getActiveBookEdition } from '@/lib/integrated-wordbook';

export function LocalBookImport({ onLoaded, collapsible = false }: { onLoaded: (data: BookEdition) => void; collapsible?: boolean }) {
  const colors = useColors();
  const [busy, setBusy] = useState(true);
  const [message, setMessage] = useState('저장된 교재 확인 중…');
  const [candidate, setCandidate] = useState<{ raw: string; data: BookEdition } | null>(null);
  const [saveFailed, setSaveFailed] = useState(false);
  const [expanded, setExpanded] = useState(!collapsible);
  const [readFailed, setReadFailed] = useState(false);
  const [readAttempt, setReadAttempt] = useState(0);
  useEffect(() => {
    if (Platform.OS !== 'web' || BOOK_EDITION.privateContent) { setBusy(false); return; }
    let active = true;
    setBusy(true); setReadFailed(false);
    void (!readAttempt && getActiveBookEdition() ? Promise.resolve(getActiveBookEdition()) : loadLocalBook()).then(data => {
      if (!active) return;
      if (data) { activateLocalBook(data); onLoaded(data); setMessage(`단어·숙어 ${data.entries.length.toLocaleString()}개 불러옴`); }
      else setMessage('저장된 교재가 없습니다. 사용하던 브라우저를 확인하거나 교재 파일을 불러오세요.');
    }).catch(error => { if (active) { setReadFailed(true); setMessage(localBookFailureMessage(error)); } })
      .finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [onLoaded, readAttempt]);
  if (Platform.OS !== 'web' || BOOK_EDITION.privateContent) return null;
  const select = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; event.target.value = '';
    setCandidate(null); setSaveFailed(false);
    if (!file) return;
    if (file.size > LOCAL_BOOK_MAX_BYTES) { setMessage('96MiB 이하의 전용 교재 JSON만 선택해 주세요. PDF나 학습 기록 백업이 아닙니다.'); return; }
    setBusy(true); setMessage('교재 파일 확인 중…');
    try {
      const raw = await file.text(); const data = await inspectLocalBook(raw);
      setCandidate({ raw, data }); setMessage('파일 확인 완료 · 아직 저장하지 않았습니다.');
    } catch { setMessage('이 앱의 v1.5 자료와 일치하지 않거나 불완전한 파일입니다. 현재 교재와 학습 기록은 바꾸지 않았습니다.'); }
    finally { setBusy(false); }
  };
  const save = async () => {
    if (!candidate) return;
    setBusy(true); setSaveFailed(false);
    try {
      const data = await saveLocalBook(candidate.raw); activateLocalBook(data); onLoaded(data); setCandidate(null);
      setMessage(`단어·숙어 ${data.entries.length.toLocaleString()}개 저장 완료 · 다음에도 같은 브라우저로 열어 주세요.`);
    } catch (error) { setSaveFailed(true); setMessage(localBookFailureMessage(error)); }
    finally { setBusy(false); }
  };
  const button = (label: string, action: () => void) => <Pressable accessibilityRole="button" disabled={busy}
    accessibilityState={{ disabled: busy }} onPress={action} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={{ color: colors.primary }}>{label}</Text></Pressable>;
  return <View style={{ padding: 12, marginVertical: 12, borderWidth: 1, borderColor: colors.border, borderRadius: 12, gap: 8 }}>
    {collapsible ? <Pressable accessibilityRole="button" accessibilityState={{ expanded }} onPress={() => setExpanded(!expanded)} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={{ color: colors.primary }}>내 교재 {expanded ? '−' : '+'}</Text></Pressable>
      : <Text style={{ color: colors.foreground, fontWeight: '700' }}>내 교재</Text>}
    <Text accessibilityLiveRegion="polite" style={{ color: colors.foreground, lineHeight: 21 }}>{message}</Text>
    {readFailed && button('다시 불러오기', () => setReadAttempt(value => value + 1))}
    {expanded && <>
    <Text style={{ color: colors.muted, lineHeight: 21 }}>교재는 서버에 보내지 않고 이 브라우저에만 보관합니다. 학습 기록과는 따로 저장됩니다. 다른 기기·브라우저에서는 파일을 다시 불러오세요. 데이터 삭제·비공개 모드·저장공간 정리로 사라질 수 있으니 원본 파일과 학습 기록 백업을 보관하세요.</Text>
    <input type="file" accept="application/json,.json" aria-label="v1.5 개인 학습자료 파일 선택" disabled={busy}
      onChange={event => { void select(event); }} style={{ maxWidth: '100%', color: colors.foreground }} />
    {candidate && <View>
      <Text style={{ color: colors.foreground }}>v{candidate.data.edition} · {candidate.data.entries.length.toLocaleString()}개 · {candidate.data.sections.length}개 목차</Text>
      {button('저장하고 열기', () => { void save(); })}
      {saveFailed && <Text style={{ color: colors.muted }}>아직 새 교재를 열지 않았습니다. 다음에도 이어서 학습할 수 있도록 저장에 성공한 뒤 엽니다. 원본 파일을 보관하고 다시 시도하세요.</Text>}
      {button('취소', () => { setCandidate(null); setSaveFailed(false); setMessage('취소했습니다. 현재 교재와 기록은 그대로입니다.'); })}
    </View>}
    </>}
  </View>;
}
