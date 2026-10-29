import { Text, View } from 'react-native';
import { bookNeedsEditorialReview, bookStudyDetails, type BookEntry } from '@/lib/book-edition';
import { useColors } from '@/hooks/use-colors';

/** Content inside the existing card/answer; no independent viewer or navigation. */
export function BookLearningDetails({ entry }: { entry?: BookEntry }) {
  const colors = useColors();
  if (!entry) return null;
  const text = { color: colors.muted, fontSize: 13, lineHeight: 21 };
  return <View style={{ gap: 6, marginTop: 6 }}>
    {!!(entry.concept || entry.chunk) && <Text style={[text, { color: colors.primary }]}>{entry.concept}{entry.chunk && entry.chunk !== entry.concept ? ` → ${entry.chunk}` : ''}</Text>}
    {bookNeedsEditorialReview(entry) && <Text style={text}>교정 주석 필수 · 원문 보존 · 자동 채점 보류</Text>}
    {bookStudyDetails(entry).map((note, index) => <Text key={index} style={text}>{note.label}: {note.text}{note.source ? ` · 출처: ${note.source}` : ''}</Text>)}
    {!!entry.display?.patterns.length && <Text style={text}>문형: {entry.display.patterns.join(' · ')}</Text>}
    {!!entry.display?.synonym_hints?.length && <Text style={text}>관련 표현 참고: {entry.display.synonym_hints.join(' · ')} · 문맥별 뜻 확인</Text>}
    {!!entry.display?.approved_aliases?.length && <Text style={text}>승인 표기: {entry.display.approved_aliases.join(' · ')}</Text>}
  </View>;
}
