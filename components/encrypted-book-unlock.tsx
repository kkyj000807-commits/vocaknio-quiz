import { useState } from 'react';
import { Platform, Pressable, Text, TextInput, View } from 'react-native';
import { useColors } from '@/hooks/use-colors';
import { decryptBook } from '@/lib/encrypted-book';
import { persistRevisedBook, REVISED_BOOK_VERSION } from '@/lib/encrypted-book-package';
import { getActiveBookEdition } from '@/lib/integrated-wordbook';

const BOOK_URL = '/vocaknio-quiz/data/book-v174.encrypted.bin';
export function EncryptedBookUnlock({ onLoaded }: { onLoaded: () => void }) {
  const colors = useColors();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (Platform.OS !== 'web' || getActiveBookEdition()?.edition === REVISED_BOOK_VERSION) return null;
  const unlock = async () => {
    if (!password || busy) return;
    setBusy(true); setError('');
    try {
      const response = await fetch(BOOK_URL, { cache: 'default' });
      if (!response.ok) throw new Error('Unavailable');
      const length = Number(response.headers.get('content-length') ?? 0);
      if (length > 96 * 1024 * 1024) throw new Error('Too large');
      const plaintext = await decryptBook(new Uint8Array(await response.arrayBuffer()), password);
      try { await persistRevisedBook(plaintext); } finally { plaintext.fill(0); }
      setPassword(''); setOpen(false); onLoaded();
    } catch {
      setError('암호 또는 교재 저장 상태를 확인해 주세요. 기존 기록은 그대로입니다.');
    } finally { setBusy(false); }
  };
  return <View style={{ paddingHorizontal: 16, paddingBottom: 8, gap: 8 }}>
    {!open ? <Pressable accessibilityRole="button" onPress={() => setOpen(true)} style={{ minHeight: 44, justifyContent: 'center' }}>
      <Text style={{ color: colors.primary }}>암호로 교재 열기</Text>
    </Pressable> : <>
      <Text style={{ color: colors.foreground }}>교재 암호</Text>
      <TextInput accessibilityLabel="교재 암호" secureTextEntry autoCapitalize="none" autoCorrect={false}
        value={password} onChangeText={setPassword} editable={!busy}
        style={{ minHeight: 44, borderWidth: 1, borderColor: colors.border, color: colors.foreground, borderRadius: 8, paddingHorizontal: 12 }} />
      {!!error && <Text accessibilityLiveRegion="polite" style={{ color: colors.foreground }}>{error}</Text>}
      <Pressable accessibilityRole="button" disabled={busy || !password} onPress={() => { void unlock(); }}
        style={{ minHeight: 44, justifyContent: 'center' }}>
        <Text style={{ color: colors.primary }}>{busy ? '교재 확인 중…' : '열기'}</Text>
      </Pressable>
      <Pressable accessibilityRole="button" onPress={() => { setPassword(''); setError(''); setOpen(false); }}
        disabled={busy} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={{ color: colors.muted }}>취소</Text></Pressable>
    </>}
  </View>;
}
