import { Text, View } from 'react-native';
import { bookNeedsEditorialReview, bookStudyDetails, bookStudyPatterns, type BookEntry } from '@/lib/book-edition';
import { useColors } from '@/hooks/use-colors';
import { bookReadingContrast } from '@/lib/book-reading-contrast';

/** Content inside the existing card/answer; no independent viewer or navigation. */
export function BookLearningDetails({ entry, hideCategory = false }: { entry?: BookEntry; hideCategory?: boolean }) {
  const colors = useColors();
  if (!entry) return null;
  const text = { color: colors.muted, fontSize: 13, lineHeight: 21 };
  const patterns = bookStudyPatterns(entry);
  const contrast = bookReadingContrast(entry);
  return <View style={{ gap: 6, marginTop: 6 }}>
    {contrast && <View style={{ gap: 5 }}>
      <Text style={[text, { color: colors.primary, fontWeight: '600' }]}>{contrast.focus}</Text>
      <Text style={text}>{contrast.en}</Text>
      <Text style={text}>{contrast.ko}</Text>
      <Text style={text}>{contrast.distinction}</Text>
    </View>}
    {!hideCategory && !!(entry.concept || entry.chunk) && <Text style={[text, { color: colors.primary }]}>{entry.concept}{entry.chunk && entry.chunk !== entry.concept ? ` → ${entry.chunk}` : ''}</Text>}
    {bookNeedsEditorialReview(entry) && <Text style={text}>교정 주석 필수 · 원문 보존 · 자동 채점 보류</Text>}
    {bookStudyDetails(entry).map((note, index) => <Text key={index} style={text}>{note.label}: {note.text}{note.source ? ` · 출처: ${note.source}` : ''}</Text>)}
    {!!patterns.length && <Text style={text}>문형: {patterns.join(' · ')}</Text>}
    {!!entry.display?.synonym_hints?.length && <Text style={text}>관련 표현 참고: {entry.display.synonym_hints.join(' · ')} · 문맥별 뜻 확인</Text>}
    {!!entry.display?.approved_aliases?.length && <Text style={text}>승인 표기: {entry.display.approved_aliases.join(' · ')}</Text>}
  </View>;
}
