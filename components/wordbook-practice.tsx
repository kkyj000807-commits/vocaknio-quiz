import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { useColors } from '@/hooks/use-colors';
import { COUNTS, DEFAULT_QUIZ_MODE, QUIZ_MODES, type QuizMode, type VocabItem } from '@/lib/vocab';
import type { SenseLearningState } from '@/lib/learning-state';
import { useWordbookPractice } from '@/hooks/use-wordbook-practice';
import { buildWordbookPracticeHref, type WordbookPracticeScope } from '@/lib/wordbook-practice';
import { MIN_TOUCH_TARGET, STUDY_PAGE_GUTTER } from '@/lib/layout';

export function WordbookPractice({ scope, label, items, learningState, hasLocalContent }: {
  scope: WordbookPracticeScope; label: string; items: readonly VocabItem[]; learningState: SenseLearningState | null; hasLocalContent: boolean;
}) {
  const colors = useColors();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [typesOpen, setTypesOpen] = useState(false);
  const [othersOpen, setOthersOpen] = useState(false);
  const [count, setCount] = useState(10);
  const [mode, setMode] = useState<QuizMode>(DEFAULT_QUIZ_MODE);
  const selected = QUIZ_MODES.find(option => option.id === mode)!;
  const availability = useWordbookPractice(open, items, learningState, scope.includeMastered);
  const available = availability.counts[mode];
  // An explicit, labelled route into the existing self-assessment flow. Private
  // content is NOT promoted to automatically graded meaning questions.
  const recallCandidate = hasLocalContent && mode === DEFAULT_QUIZ_MODE && available === 0;
  const recallPending = recallCandidate && availability.counts.flashcard === undefined;
  const directRecall = recallCandidate && (availability.counts.flashcard ?? 0) > 0;
  const startMode = directRecall ? 'flashcard' : mode;
  const actualCount = Math.min(count, availability.counts[startMode] ?? 0);
  const chip = (active: boolean) => [styles.chip, { backgroundColor: active ? colors.primary : colors.surface, borderColor: active ? colors.primary : colors.border }];
  return <View style={styles.container}>
    <Pressable accessibilityRole="button" accessibilityLabel="이 범위 학습 설정" accessibilityState={{ expanded: open }}
      onPress={() => setOpen(value => !value)} style={chip(open)}>
      <Text style={{ color: open ? '#fff' : colors.primary, fontWeight: '700' }}>이 범위 학습 {open ? '▴' : '▾'}</Text>
    </Pressable>
    {open && <View style={[styles.panel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text style={[styles.title, { color: colors.foreground }]}>{label}{scope.concept ? ` · ${scope.concept}` : ''}</Text>
      <Text style={{ color: colors.muted }}>문제 수</Text>
      <View style={styles.row}>{COUNTS.map(value => <Pressable key={value} accessibilityRole="button"
        accessibilityLabel={`${value}문제 선택`} accessibilityState={{ selected: count === value }}
        onPress={() => setCount(value)} style={chip(count === value)}>
        <Text style={{ color: count === value ? '#fff' : colors.foreground }}>{value}개</Text>
      </Pressable>)}</View>
      <Pressable accessibilityRole="button" accessibilityLabel="문제 유형 선택" accessibilityState={{ expanded: typesOpen }}
        onPress={() => setTypesOpen(value => !value)} style={styles.toggle}>
        <Text style={{ color: colors.primary }}>유형 선택 · {selected.title} {typesOpen ? '▴' : '▾'}</Text>
      </Pressable>
      {typesOpen && <>
        <View style={styles.row}>{QUIZ_MODES.filter(option => option.primary || othersOpen).map(option => <Pressable key={option.id}
          accessibilityRole="button" accessibilityLabel={`${option.title} 선택`} accessibilityState={{ selected: mode === option.id, disabled: availability.counts[option.id] === 0 }}
          disabled={availability.counts[option.id] === 0}
          onPress={() => { if (availability.counts[option.id] !== 0) setMode(option.id); }} style={[chip(mode === option.id), { opacity: availability.counts[option.id] === 0 ? 0.45 : 1 }]}>
          <Text style={{ color: mode === option.id ? '#fff' : colors.foreground }}>{option.title}{availability.counts[option.id] === 0 ? ' · 없음' : ''}</Text>
        </Pressable>)}</View>
        <Pressable accessibilityRole="button" accessibilityLabel="그 외 문제 유형" accessibilityState={{ expanded: othersOpen }}
          onPress={() => setOthersOpen(value => !value)} style={styles.toggle}>
          <Text style={{ color: colors.primary }}>그 외 {othersOpen ? '▴' : '▾'}</Text>
        </Pressable>
      </>}
      {hasLocalContent && <Text style={[styles.note, { color: colors.muted }]}>교재의 새 단어는 ‘빠른 암기’로 학습할 수 있어요. 자동채점은 검수된 단어만 사용합니다.</Text>}
      <Text accessibilityLiveRegion="polite" style={[styles.note, { color: colors.muted }]}>{availability.failed ? '문제 수를 확인하지 못했어요. 학습 설정을 닫았다 다시 열어 주세요.'
        : directRecall ? '뜻을 확인한 뒤 알았어요·모르겠어요로 답합니다.' : recallPending ? '뜻 확인 학습 준비 중…'
        : available === undefined ? '출제 가능한 문제 확인 중…' : available === 0 ? '이 범위에는 해당 유형의 문제가 없어요. 다른 유형을 선택해 주세요.'
        : actualCount < count ? `이 범위에서는 ${actualCount}문제를 풀 수 있어요.` : `현재 범위에서 ${actualCount}문제를 풉니다.`}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={`${directRecall ? '뜻 확인' : selected.title} ${actualCount}문제 시작`}
        accessibilityState={{ disabled: actualCount === 0 }} disabled={actualCount === 0}
        onPress={() => { if (actualCount > 0) router.push(buildWordbookPracticeHref(scope, startMode, actualCount) as Href); }}
        style={[styles.start, { backgroundColor: colors.primary, opacity: actualCount ? 1 : 0.45 }]}>
        <Text style={styles.startText}>{directRecall ? `뜻 확인 학습 · ${actualCount}개` : actualCount ? `학습 시작 · ${actualCount}문제` : available === undefined || recallPending ? '확인 중…' : '이 유형의 문제가 없어요'}</Text>
      </Pressable>
    </View>}
  </View>;
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: STUDY_PAGE_GUTTER, paddingBottom: 12, gap: 8 },
  panel: { borderWidth: 1, borderRadius: 12, padding: 12, gap: 8 },
  title: { fontSize: 15, fontWeight: '700', flexShrink: 1 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { minHeight: MIN_TOUCH_TARGET, borderWidth: 1, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12, justifyContent: 'center', alignItems: 'center', flexShrink: 1 },
  toggle: { minHeight: MIN_TOUCH_TARGET, justifyContent: 'center' },
  note: { fontSize: 12, lineHeight: 18 },
  start: { minHeight: MIN_TOUCH_TARGET, borderRadius: 10, padding: 12, justifyContent: 'center' },
  startText: { color: '#fff', textAlign: 'center', fontWeight: '700' },
});
