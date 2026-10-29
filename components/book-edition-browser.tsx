import { useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { BOOK_EDITION, bookMeanings, bookNotes, selectBookEntries } from '@/lib/book-edition';
import { useColors } from '@/hooks/use-colors';
import { SCROLL_END_PADDING } from '@/lib/layout';

export function BookEditionBrowser({ onLegacy }: { onLegacy: (word?: string) => void }) {
  const colors = useColors();
  const [section, setSection] = useState('');
  const [concept, setConcept] = useState('');
  const [search, setSearch] = useState('');
  const [hidden, setHidden] = useState(false);
  const [reference, setReference] = useState(false);
  const entries = useMemo(() => selectBookEntries(section, concept, search), [section, concept, search]);
  const concepts = useMemo(() => [...new Set(BOOK_EDITION.entries.filter(e => e.section === section).map(e => e.concept).filter(Boolean))], [section]);
  const text = { color: colors.foreground };
  const button = { padding: 12, margin: 3, borderRadius: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border };
  return <FlatList data={entries} keyExtractor={entry => entry.id}
    initialNumToRender={15} maxToRenderPerBatch={15} windowSize={5}
    contentContainerStyle={{ padding: 16, paddingBottom: SCROLL_END_PADDING }}
    ListHeaderComponent={<View>
      <Text style={[text, { fontSize: 25, fontWeight: '800' }]}>단권화 · v1.5</Text>
      <Text style={[text, { marginVertical: 8 }]}>개념 → 뜻 청크 → 단어·표현 → 문형·문맥</Text>
      <Text style={{ color: colors.muted }}>{BOOK_EDITION.privateContent ? '개인 학습 자료 · 자동 채점 미연결' : '공개 가능 부분 · 개인 뜻풀이·발음·교정 자료 제외'}</Text>
      <Pressable accessibilityRole="button" onPress={() => onLegacy()} style={button}><Text style={text}>기존 북마크·MASTER·문제 학습 기록 보기 →</Text></Pressable>
      <Pressable accessibilityRole="button" onPress={() => setReference(!reference)} style={button}><Text style={text}>학습 방향·발음 참고 {reference ? '−' : '+'}</Text></Pressable>
      {reference && <Text style={[text, { lineHeight: 23, margin: 8 }]}>301은 기본 개념 지도, 502는 확장·독립 개념입니다. A/B는 개념 제목의 앞뒤 표식이며 좋음·나쁨이나 항상 반의어라는 뜻이 아닙니다.{ '\n' }숙어는 중심 뜻을 먼저 회상하고 전치사·목적어·부정 유무를 구별하세요. IPA 미확인을 임의로 채우지 않으며 ≈ 한글 발음은 근사 보조입니다. 개인 참고 자료는 공개판에서 제외됩니다.</Text>}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 10 }}>
        {['', ...BOOK_EDITION.sections].map(value => <Pressable key={value} accessibilityRole="button" accessibilityState={{ selected: section === value }} onPress={() => { setSection(value); setConcept(''); }} style={[button, section === value && { backgroundColor: '#7555B2' }]}><Text style={{ color: section === value ? '#fff' : colors.foreground }}>{value || '전체 목차'}</Text></Pressable>)}
      </ScrollView>
      {section && <Text style={{ color: colors.muted }}>v1.5 원본 {BOOK_EDITION.sourceCounts[section]?.toLocaleString()}항목 · 현재 연결 {BOOK_EDITION.entries.filter(e => e.section === section).length.toLocaleString()}항목</Text>}
      {!!concepts.length && <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 8 }}>
        {['', ...concepts].map(value => <Pressable key={value} accessibilityRole="button" onPress={() => setConcept(value)} style={[button, { borderColor: concept === value ? '#7555B2' : colors.border }]}><Text style={text}>{value || '개념 전체'}</Text></Pressable>)}
      </ScrollView>}
      <TextInput accessibilityLabel="v1.5 단어·뜻·개념 검색" placeholder="단어·뜻·개념·청크 검색" placeholderTextColor={colors.muted} value={search} onChangeText={setSearch} style={[text, button]} />
      <Pressable accessibilityRole="button" onPress={() => setHidden(!hidden)} style={button}><Text style={text}>{hidden ? '뜻·개념 보이기' : '뜻·개념 가리기'}</Text></Pressable>
      <Text style={[text, { marginVertical: 12 }]}>{entries.length.toLocaleString()}항목 · 제본 순서 · 기존 기록 자동 합산 없음</Text>
    </View>}
    ListEmptyComponent={<Text style={text}>이 범위에 공개 연결된 항목이 없습니다. 개인 자료는 제외되며 기존 기록은 아래 기존 학습 화면에서 유지됩니다.</Text>}
    renderItem={({ item }) => <View style={[button, { marginVertical: 6, padding: 16 }]}>
      {!hidden && !!(item.concept || item.chunk) && <View style={{ backgroundColor: '#F3F1F6', padding: 8, borderRadius: 6 }}><Text style={{ color: '#6A5591' }}>{item.concept}{item.chunk && item.chunk !== item.concept ? ` → ${item.chunk}` : ''}</Text></View>}
      <Text style={[text, { fontSize: 20, fontWeight: '700', marginTop: 8 }]}>{item.word}</Text>
      {!hidden && <Text style={[text, { lineHeight: 24, marginVertical: 8 }]}>{bookMeanings(item)}</Text>}
      {!hidden && !BOOK_EDITION.privateContent && <Text style={{ color: colors.muted }}>기존 앱 뜻 참고 · 책 분류와 각 뜻의 대응은 자동 확정하지 않습니다.</Text>}
      {!hidden && bookNotes(item).map((note, index) => <Text key={index} style={[text, { lineHeight: 23, marginVertical: 4 }]}>{note}</Text>)}
      {!hidden && !!item.display?.patterns?.length && <Text style={text}>문형: {item.display.patterns.join(' · ')}</Text>}
      {!hidden && item.pronunciation && <Text style={{ color: colors.muted }}>{item.pronunciation.ipa || 'IPA 미확인'}{item.pronunciation.korean_pronunciation ? ` · ≈ ${item.pronunciation.korean_pronunciation}` : ''}</Text>}
      <Text style={{ color: colors.muted }}>책 #{item.order} · {item.section} · 기존 기록 {item.appIds.length}개 별도 보존</Text>
      <Pressable accessibilityRole="button" onPress={() => onLegacy(item.word)} style={{ paddingVertical: 14 }}><Text style={{ color: colors.primary }}>기존 뜻·북마크·MASTER 연결 보기 →</Text></Pressable>
    </View>} />;
}
