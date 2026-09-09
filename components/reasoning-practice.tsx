import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useColors } from "@/hooks/use-colors";
import { isPracticeAnswerCorrect, readPracticeAttempt, savePracticeAttempt, type ReasoningLesson, type ReasoningQuestion } from "@/lib/reasoning-practice";

export function ReasoningPractice({ lesson }: { lesson: ReasoningLesson }) {
  const s = styles(useColors());
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  return (
    <View style={s.box}>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={() => setOpen(!open)} style={s.button}>
        <Text style={s.heading}>문맥 적용 연습 · {lesson.questions.length}문항 {open ? "−" : "+"}</Text>
      </Pressable>
      {open && <View style={s.content}>
        <Text style={s.note}>학습용 창작 · 이 기기의 첫 선택을 저장합니다. 본 문풀 성적·숙달 판정에는 합산하지 않습니다.</Text>
        <PracticeQuestion key={lesson.questions[index].id} question={lesson.questions[index]} />
        <View style={s.navigation}>
          <Pressable accessibilityRole="button" accessibilityState={{ disabled: index === 0 }} disabled={index === 0} onPress={() => setIndex(index - 1)} style={[s.button, index === 0 && s.disabled]}><Text style={s.heading}>이전 문맥</Text></Pressable>
          <Text style={s.note}>{index + 1} / {lesson.questions.length}</Text>
          <Pressable accessibilityRole="button" accessibilityState={{ disabled: index === lesson.questions.length - 1 }} disabled={index === lesson.questions.length - 1} onPress={() => setIndex(index + 1)} style={[s.button, index === lesson.questions.length - 1 && s.disabled]}><Text style={s.heading}>다음 문맥</Text></Pressable>
        </View>
      </View>}
    </View>
  );
}

function PracticeQuestion({ question }: { question: ReasoningQuestion }) {
  const colors = useColors();
  const s = styles(colors);
  const [choiceId, setChoiceId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [storageError, setStorageError] = useState(false);
  const [saved, setSaved] = useState(false);
  const answered = useRef(false);
  const started = useRef(Date.now());
  useEffect(() => {
    let cancelled = false;
    readPracticeAttempt(question).then((attempt) => {
      if (cancelled) return;
      if (attempt) { answered.current = true; setChoiceId(attempt.choiceId); setSaved(true); }
    }).catch(() => { if (!cancelled) setStorageError(true); }).finally(() => {
      if (!cancelled) { started.current = Date.now(); setLoaded(true); }
    });
    return () => { cancelled = true; };
  }, [question]);

  const choose = (id: string) => {
    if (!loaded || answered.current) return;
    answered.current = true;
    setChoiceId(id);
    // Do not overwrite an unreadable earlier attempt; still allow practice without persistence.
    if (!storageError) void savePracticeAttempt(question, id, Date.now() - started.current)
      .then(() => setSaved(true)).catch(() => setStorageError(true));
  };
  return <View style={s.content}>
    <Text style={s.english}>{question.passageEn}</Text>
    <Text style={s.heading}>{question.promptKo}</Text>
    {!loaded && <Text style={s.note}>이전 연습 기록을 확인하고 있어요.</Text>}
    {question.choices.map((choice, i) => <Pressable key={choice.id} accessibilityRole="button"
      accessibilityState={{ disabled: !loaded || choiceId !== null, selected: choiceId === choice.id }}
      disabled={!loaded || choiceId !== null} onPress={() => choose(choice.id)}
      style={({ pressed }) => [s.choice, choiceId === choice.id && { borderColor: colors.primary, backgroundColor: colors.surface }, pressed && s.disabled]}>
      <Text style={s.english}>{i + 1}. {choice.text}</Text>
    </Pressable>)}
    {storageError && <Text style={s.note}>기기 기록을 읽거나 저장하지 못했습니다. 이번 연습은 가능하지만 새로고침 후 유지되지 않을 수 있어요.</Text>}
    {choiceId !== null && <View style={s.feedback} accessibilityLiveRegion="polite">
      <Text style={s.heading}>{isPracticeAnswerCorrect(question, choiceId) ? "정답 · 근거까지 확인하세요" : "다시 짚을 판단"}</Text>
      <Text style={s.text}>정답: {question.choices.findIndex((c) => c.id === question.correctChoiceId) + 1}번</Text>
      <Text style={s.heading}>지문 근거</Text>
      {question.evidence.map((e) => <Text key={e} style={s.english}>“{e}”</Text>)}
      <Text style={s.text}>{question.relationKo}</Text>
      <Text style={s.heading}>쉽게 풀어 읽기</Text><Text style={s.text}>{question.translationKo}</Text>
      <Text style={s.heading}>선택지별 판단</Text>
      {question.choices.map((c, i) => <Text key={c.id} style={s.text}>{i + 1}. {c.explanationKo}</Text>)}
      <Text style={s.note}>{saved ? "이 기기에 첫 응답 저장됨 · 다시 열면 그대로 이어집니다." : storageError ? "이번 응답 저장은 확인되지 않았습니다." : "기기 저장 확인 중"} 해설 직후 연습이므로 실전 숙달 증거와는 구분합니다.</Text>
    </View>}
  </View>;
}

const styles = (c: ReturnType<typeof useColors>) => StyleSheet.create({
  box: { borderWidth: 1, borderColor: c.border, borderRadius: 10 },
  content: { gap: 10, padding: 10 },
  button: { minHeight: 44, padding: 8, justifyContent: "center" },
  heading: { color: c.primary, fontSize: 13, lineHeight: 21, fontWeight: "700", flexShrink: 1 },
  english: { color: c.foreground, fontSize: 14, lineHeight: 23, flexShrink: 1 },
  text: { color: c.foreground, fontSize: 13, lineHeight: 22, flexShrink: 1 },
  note: { color: c.muted, fontSize: 11, lineHeight: 18, flexShrink: 1 },
  choice: { minHeight: 48, padding: 12, borderWidth: 1, borderColor: c.border, borderRadius: 8, backgroundColor: c.card },
  feedback: { gap: 8, padding: 10, backgroundColor: c.surface, borderRadius: 8 },
  navigation: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" },
  disabled: { opacity: 0.45 },
});
