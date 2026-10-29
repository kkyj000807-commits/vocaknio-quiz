import { useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { BOOK_EDITION, bookMeanings, bookNotes, bookNeedsEditorialReview, bookPronunciation, selectBookEntries } from '@/lib/book-edition';
import { useColors } from '@/hooks/use-colors';
import { SCROLL_END_PADDING } from '@/lib/layout';
import { LocalBookImport } from '@/components/local-book-import';

export function BookEditionBrowser({ onLegacy }: { onLegacy: (word?: string) => void }) {
  const colors = useColors();
  const [edition, setEdition] = useState(BOOK_EDITION);
  const [section, setSection] = useState('');
  const [concept, setConcept] = useState('');
  const [search, setSearch] = useState('');
  const [hidden, setHidden] = useState(false);
  const [reference, setReference] = useState(false);
  const entries = useMemo(() => selectBookEntries(section, concept, search, edition), [section, concept, search, edition]);
  const concepts = useMemo(() => [...new Set(edition.entries.filter(e => e.section === section).map(e => e.concept).filter(Boolean))], [section, edition]);
  const text = { color: colors.foreground };
  const button = { padding: 12, margin: 3, borderRadius: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border };
  return <FlatList data={entries} keyExtractor={entry => entry.id}
    initialNumToRender={15} maxToRenderPerBatch={15} windowSize={5}
    contentContainerStyle={{ padding: 16, paddingBottom: SCROLL_END_PADDING }}
    ListHeaderComponent={<View>
      <Text style={[text, { fontSize: 25, fontWeight: '800' }]}>단권화 · v1.5</Text>
      <Text style={[text, { marginVertical: 8 }]}>개념 → 뜻 청크 → 단어·표현 → 문형·문맥</Text>
      <Text style={{ color: colors.muted }}>{edition.privateContent ? 'v1.5 전체 학습 내용 · 내 기기에서 읽는 원뜻·주석·문형·발음 · 기존 문제 채점과 분리' : 'v1.5 배열·분류 연결판 · 아래에서 개인 학습자료를 불러오세요'}</Text>
      <LocalBookImport onLoaded={setEdition} />
      <Pressable accessibilityRole="button" onPress={() => onLegacy()} style={button}><Text style={text}>기존 북마크·MASTER·문제 학습 기록 보기 →</Text></Pressable>
      <Pressable accessibilityRole="button" onPress={() => setReference(!reference)} style={button}><Text style={text}>학습 방향·발음 참고 {reference ? '−' : '+'}</Text></Pressable>
      {reference && <Text style={[text, { lineHeight: 23, margin: 8 }]}>301은 기본 개념 지도, 502는 확장·독립 개념입니다. A/B는 개념 제목의 앞뒤 표식이며 좋음·나쁨이나 항상 반의어라는 뜻이 아닙니다.{ '\n' }숙어는 중심 뜻을 먼저 회상하고 전치사·목적어·부정 유무를 구별하세요. IPA 미확인을 임의로 채우지 않으며 ≈ 한글 발음은 근사 보조입니다. 개인 참고 자료는 공개판에서 제외됩니다.</Text>}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 10 }}>
        {['', ...edition.sections].map(value => <Pressable key={value} accessibilityRole="button" accessibilityState={{ selected: section === value }} onPress={() => { setSection(value); setConcept(''); }} style={[button, section === value && { backgroundColor: '#7555B2' }]}><Text style={{ color: section === value ? '#fff' : colors.foreground }}>{value || '전체 목차'}</Text></Pressable>)}
      </ScrollView>
      {section && <Text style={{ color: colors.muted }}>v1.5 원본 {edition.sourceCounts[section]?.toLocaleString()}항목 · 현재 연결 {edition.entries.filter(e => e.section === section).length.toLocaleString()}항목</Text>}
      {!!concepts.length && <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 8 }}>
        {['', ...concepts].map(value => <Pressable key={value} accessibilityRole="button" onPress={() => setConcept(value)} style={[button, { borderColor: concept === value ? '#7555B2' : colors.border }]}><Text style={text}>{value || '개념 전체'}</Text></Pressable>)}
      </ScrollView>}
      <TextInput accessibilityLabel="v1.5 단어·뜻·개념 검색" placeholder="단어·뜻·개념·청크 검색" placeholderTextColor={colors.muted} value={search} onChangeText={setSearch} style={[text, button]} />
      <Pressable accessibilityRole="button" onPress={() => setHidden(!hidden)} style={button}><Text style={text}>{hidden ? '뜻·개념 보이기' : '뜻·개념 가리기'}</Text></Pressable>
      <Text style={[text, { marginVertical: 12 }]}>{entries.length.toLocaleString()}항목 · 제본 순서 · 기존 기록 자동 합산 없음</Text>
    </View>}
    ListEmptyComponent={<Text style={text}>검색 결과가 없습니다. 단어·뜻·개념 또는 다른 목차로 다시 찾아보세요. 기존 학습 기록은 그대로 유지됩니다.</Text>}
    renderItem={({ item }) => <View style={[button, { marginVertical: 6, padding: 16 }]}>
      {!hidden && !!(item.concept || item.chunk) && <View style={{ backgroundColor: '#F3F1F6', padding: 8, borderRadius: 6 }}><Text style={{ color: '#6A5591' }}>{item.concept}{item.chunk && item.chunk !== item.concept ? ` → ${item.chunk}` : ''}</Text></View>}
      <Text style={[text, { fontSize: 20, fontWeight: '700', marginTop: 8 }]}>{item.word}</Text>
      {!hidden && bookNeedsEditorialReview(item) && <Text style={{ color: colors.primary, marginTop: 8 }}>교정 주석 필수 · 원문 뜻만 정답으로 자동 채점하지 않습니다.</Text>}
      {!hidden && <Text style={[text, { lineHeight: 24, marginVertical: 8 }]}>{bookNeedsEditorialReview(item) ? '원문 보존 뜻(아래 교정 설명과 함께 읽기): ' : ''}{bookMeanings(item, edition)}</Text>}
      {!hidden && !edition.privateContent && <Text style={{ color: colors.muted }}>기존 앱 뜻 참고 · 책 분류와 각 뜻의 대응은 자동 확정하지 않습니다.</Text>}
      {!hidden && bookNotes(item, edition).map((note, index) => <Text key={index} style={[text, { lineHeight: 23, marginVertical: 4 }]}>{note}</Text>)}
      {!hidden && !!item.display?.synonym_hints?.length && <Text style={[text, { marginVertical: 4 }]}>관련 표현 참고: {item.display.synonym_hints.join(' · ')} (모든 문맥의 동의어는 아님)</Text>}
      {!hidden && !!item.display?.approved_aliases?.length && <Text style={[text, { marginVertical: 4 }]}>승인 표기: {item.display.approved_aliases.join(' · ')}</Text>}
      {!hidden && !!item.display?.patterns?.length && <Text style={text}>문형: {item.display.patterns.join(' · ')}</Text>}
      {!hidden && item.pronunciation && <Text style={{ color: colors.muted }}>{bookPronunciation(item)}</Text>}
      <Text style={{ color: colors.muted }}>책 #{item.order} · {item.section} · {item.appIds.length ? `기존 기록 ${item.appIds.length}개 별도 보존` : '새 교재 항목 · 기존 기록 자동 생성 없음'}</Text>
      {!!item.appIds.length && <Pressable accessibilityRole="button" onPress={() => onLegacy(item.word)} style={{ paddingVertical: 14 }}><Text style={{ color: colors.primary }}>기존 뜻·북마크·MASTER 연결 보기 →</Text></Pressable>}
    </View>} />;
}
