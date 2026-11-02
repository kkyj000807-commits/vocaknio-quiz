import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { useColors } from '@/hooks/use-colors';
import { COUNTS, DEFAULT_QUIZ_MODE, QUIZ_MODES, type QuizMode } from '@/lib/vocab';
import { buildWordbookPracticeHref, type WordbookPracticeScope } from '@/lib/wordbook-practice';
import { MIN_TOUCH_TARGET, STUDY_PAGE_GUTTER } from '@/lib/layout';

export function WordbookPractice({ scope, label, availableCount, hasLocalContent }: {
  scope: WordbookPracticeScope; label: string; availableCount: number; hasLocalContent: boolean;
}) {
  const colors = useColors();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [typesOpen, setTypesOpen] = useState(false);
  const [othersOpen, setOthersOpen] = useState(false);
  const [count, setCount] = useState(10);
  const [mode, setMode] = useState<QuizMode>(DEFAULT_QUIZ_MODE);
  const selected = QUIZ_MODES.find(option => option.id === mode)!;
  const actualCount = Math.min(count, availableCount);
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
          accessibilityRole="button" accessibilityLabel={`${option.title} 선택`} accessibilityState={{ selected: mode === option.id }}
          onPress={() => setMode(option.id)} style={chip(mode === option.id)}>
          <Text style={{ color: mode === option.id ? '#fff' : colors.foreground }}>{option.title}</Text>
        </Pressable>)}</View>
        <Pressable accessibilityRole="button" accessibilityLabel="그 외 문제 유형" accessibilityState={{ expanded: othersOpen }}
          onPress={() => setOthersOpen(value => !value)} style={styles.toggle}>
          <Text style={{ color: colors.primary }}>그 외 {othersOpen ? '▴' : '▾'}</Text>
        </Pressable>
      </>}
      {hasLocalContent && <Text style={[styles.note, { color: colors.muted }]}>교재의 새 단어는 ‘빠른 암기’로 학습할 수 있어요. 자동채점은 검수된 단어만 사용합니다.</Text>}
      <Text style={[styles.note, { color: colors.muted }]}>현재 필터를 적용합니다. 출제 가능한 문제가 적으면 그 수만큼 학습합니다.</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={`${selected.title} ${actualCount}문제 시작`}
        accessibilityState={{ disabled: actualCount === 0 }} disabled={actualCount === 0}
        onPress={() => { if (actualCount > 0) router.push(buildWordbookPracticeHref(scope, mode, actualCount) as Href); }}
        style={[styles.start, { backgroundColor: colors.primary, opacity: actualCount ? 1 : 0.45 }]}>
        <Text style={styles.startText}>{actualCount ? `학습 시작 · ${actualCount}문제` : '학습할 단어가 없어요'}</Text>
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
