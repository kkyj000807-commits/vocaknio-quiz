import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Image, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useColors } from '@/hooks/use-colors';
import { ScreenContainer } from '@/components/screen-container';
import { emptyExamProgress, examSetId, type ExamKind, type ScannedExamSet,
  EXAM_FILE_MAX_BYTES, importExamPack, loadExamPack, readExamProgress,
  writeExamPick, writeExamRevisit } from '@/lib/official-exam-images';

const schools = ['중앙대','가천대','동국대','한양대','건국대'];
const row = { flexDirection:'row', flexWrap:'wrap', gap:8 } as const;

function ExamButton({ label, action, selected = false, disabled = false, children }:
  { label: string; action: () => void; selected?: boolean; disabled?: boolean; children?: ReactNode }) {
  const c = useColors();
  return <Pressable accessibilityRole="button" accessibilityLabel={label}
    accessibilityState={{ selected, disabled }} disabled={disabled} onPress={action}
    style={({ pressed })=>({ minWidth:44, minHeight:44, paddingHorizontal:12, justifyContent:'center',
      alignItems:'center', opacity:disabled ? 0.5 : pressed ? 0.8 : 1, borderWidth:1, borderColor:c.border,
      borderRadius:10, backgroundColor:selected?c.primary:c.surface })}>
    <Text style={{color:selected?'white':c.foreground}}>{children ?? label}</Text>
  </Pressable>;
}

export function OfficialLogicPractice() {
  const c = useColors(), router = useRouter();
  const [school, setSchool] = useState(schools[0]);
  const [year, setYear] = useState(2026);
  const [kind, setKind] = useState<ExamKind>('vocabulary');
  const [sets, setSets] = useState<ScannedExamSet[]>([]);
  const [busy, setBusy] = useState(Platform.OS === 'web');
  const [notice, setNotice] = useState('');
  const mounted = useRef(false);
  const fileInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    mounted.current = true;
    if (Platform.OS === 'web') void loadExamPack()
      .then(pack=>{ if (mounted.current && pack) setSets(pack.sets); })
      .catch(()=>{ if (mounted.current) setNotice('이 기기에 저장된 기출을 열지 못했습니다. 아래에서 다시 불러올 수 있습니다.'); })
      .finally(()=>{ if (mounted.current) setBusy(false); });
    return () => { mounted.current = false; };
  }, []);
  const chooseFile = async (file: File) => {
    setBusy(true); setNotice('');
    try {
      if (file.size > EXAM_FILE_MAX_BYTES) throw new Error('Invalid file');
      const { pack, persisted } = await importExamPack(await file.text());
      if (mounted.current) {
        setSets(pack.sets);
        if (!persisted) setNotice('기출 파일을 이 기기에 저장하지 못했습니다. 지금은 풀 수 있지만, 화면을 닫으면 파일을 다시 불러와야 합니다.');
      }
    } catch {
      if (mounted.current) setNotice('이 파일은 열 수 없습니다. PDF나 학습 기록 백업이 아닌 FINETUNE 기출 자료(.json)를 선택해 주세요.');
    } finally { if (mounted.current) setBusy(false); }
  };
  const years = [...new Set(sets.filter(s=>s.school===school).map(s=>s.year))].sort((a,b)=>b-a);
  const selectedYear = years.includes(year) ? year : years[0];
  const selected = sets.find(s=>s.school===school && s.year===selectedYear && s.kind===kind);
  return <ScreenContainer containerClassName="bg-background">
    <ScrollView contentContainerStyle={{ width:'100%', maxWidth:780, alignSelf:'center', padding:16, paddingBottom:88, gap:12 }}>
      <Text accessibilityRole="header" style={{fontSize:24,fontWeight:'700',color:c.foreground}}>대학 기출</Text>
      {!sets.length && !!notice && <Text accessibilityLiveRegion="polite" style={{color:c.foreground}}>{notice}</Text>}
      {busy ? <Text accessibilityLiveRegion="polite" style={{color:c.muted}}>기출을 불러오는 중입니다.</Text> : !sets.length ? <>
        <Text style={{color:c.foreground}}>{Platform.OS === 'web'
          ? '이 브라우저에는 기출이 없습니다. FINETUNE 기출 자료(.json)를 불러오면 학교별 어휘·논리 문제를 풀 수 있습니다.'
          : '기출 원본은 FINETUNE 웹에서 열 수 있습니다.'}</Text>
        {Platform.OS === 'web' && <>
          <input ref={fileInput} type="file" accept=".json,application/json" aria-label="개인 기출 원본 파일" hidden onChange={e=>{
              const file = e.currentTarget.files?.[0]; e.currentTarget.value = '';
              if (file) void chooseFile(file);
            }} />
          <ExamButton label="기출 불러오기" action={()=>fileInput.current?.click()} />
        </>}
      </> : <>
        <View style={row}>{schools.map(name=><ExamButton key={name} label={name} selected={name===school} action={()=>{setSchool(name);setYear(2026);}} />)}</View>
        <View style={row}>{years.map(y=><ExamButton key={y} label={`${y}학년도`} selected={y===selectedYear} action={()=>setYear(y)} />)}</View>
        <View style={row}>
          <ExamButton label="어휘" selected={kind==='vocabulary'} action={()=>setKind('vocabulary')} />
          <ExamButton label="논리" selected={kind==='logic'} action={()=>setKind('logic')} />
        </View>
        {selected ? <ExamQuestions key={examSetId(selected)} set={selected} /> : <Text style={{color:c.muted}}>이 회차에 등록된 문제가 없습니다.</Text>}
      </>}
      {sets.length > 0 && !!notice && <Text accessibilityLiveRegion="polite" style={{color:c.foreground}}>{notice}</Text>}
      {!sets.length && <ExamButton label="파일 없이 예문 동의어 풀기" action={()=>router.replace({
        pathname:'/quiz', params:{ mode:'syn-context', rangeId:'all', count:10 },
      })} />}
      <ExamButton label="문풀로 돌아가기" action={()=>router.replace('/')} />
    </ScrollView>
  </ScreenContainer>;
}

function ExamQuestions({set}: {set: ScannedExamSet}) {
  const c = useColors();
  const [progress,setProgress] = useState(emptyExamProgress);
  const [busy,setBusy] = useState(true);
  const [message,setMessage] = useState('');
  const [review,setReview] = useState(false);
  const [index,setIndex] = useState(0);
  const [retry,setRetry] = useState(false);
  const writable = useRef(false), writing = useRef(false);
  useEffect(()=>{
    let active = true;
    void readExamProgress(set).then(record=>{
      if (!active) return;
      writable.current = true;
      setProgress(record);
      const pending = set.questions.findIndex(q=>record.picks[q.number] === undefined);
      setIndex(pending < 0 ? 0 : pending);
    }).catch(()=>{if (active) setMessage('저장된 답안을 읽지 못했습니다. 기존 답안은 덮어쓰지 않습니다.');})
      .finally(()=>{if (active) setBusy(false);});
    return ()=>{active = false;};
  },[set]);
  const marked = set.questions.filter(q=>progress.revisit[q.number] ||
    (q.answer !== undefined && progress.picks[q.number] !== undefined && progress.picks[q.number] !== q.answer));
  const list = review ? marked : set.questions;
  const position = Math.min(index, Math.max(0,list.length-1));
  const q = list[position];
  const pick = q && !retry ? progress.picks[q.number] : undefined;
  const change = (next: number) => {setIndex(next);setRetry(false);};
  const choose = async (value: number) => {
    if (busy || writing.current || pick !== undefined) return;
    writing.current = true; setBusy(true);
    try {
      if (writable.current) await writeExamPick(set,q.number,value);
      setProgress(before=>({...before,picks:{...before.picks,[q.number]:value}}));
      setRetry(false);
    } catch { setMessage('답을 저장하지 못했습니다. 다시 눌러 주세요.'); }
    finally { writing.current=false;setBusy(false); }
  };
  const toggleMark = async () => {
    if (busy || writing.current) return;
    writing.current = true; setBusy(true);
    const markedNow = !progress.revisit[q.number];
    try {
      if (writable.current) await writeExamRevisit(set,q.number,markedNow);
      setProgress(before=>({...before,revisit:{...before.revisit,[q.number]:markedNow}}));
      setRetry(false);
    } catch { setMessage('표시를 저장하지 못했습니다. 다시 눌러 주세요.'); }
    finally { writing.current=false;setBusy(false); }
  };
  return <View style={{gap:10}}>
    <Text style={{color:c.foreground,fontWeight:'700'}}>{set.school} {set.year}학년도{set.form ? ` · ${set.form}` : ''} · {set.questions.length}문항</Text>
    <View style={row}>
      <ExamButton label={`전체 · ${Object.keys(progress.picks).length}/${set.questions.length} 풀이`} selected={!review} disabled={busy} action={()=>{setReview(false);change(0);}} />
      <ExamButton label={`다시 볼 문제 · ${marked.length}`} selected={review} disabled={busy} action={()=>{setReview(true);change(0);}} />
    </View>
    {!q ? <Text style={{color:c.muted}}>다시 볼 문제를 표시하면 여기에 모입니다.</Text> : <>
      <View style={row}>{list.map((item,i)=><ExamButton key={item.number} label={`${item.number}번`} selected={i===position}
        disabled={busy} action={()=>change(i)}>{item.number}{progress.picks[item.number] !== undefined ? ' ✓' : ''}</ExamButton>)}</View>
      <Text style={{color:c.foreground,fontWeight:'700'}}>{q.number}번</Text>
      <Image accessibilityLabel={`${q.number}번 기출 지문과 선지 원본`} source={{uri:`data:image/jpeg;base64,${q.jpeg}`}}
        resizeMode="contain" style={{width:'100%',maxWidth:670,alignSelf:'center',aspectRatio:q.w/q.h,backgroundColor:'white'}} />
      <View style={row}>{Array.from(set.choices).map((label,i)=>
        <ExamButton key={label} label={`${label} 선택`} selected={pick===i+1} disabled={busy || pick!==undefined} action={()=>{void choose(i+1);}}>{label}</ExamButton>)}</View>
      {pick!==undefined && <Text accessibilityLiveRegion="polite" style={{color:c.foreground}}>
        {q.answer===undefined ? `선택 ${set.choices[pick-1]} · 공식 정답 미확인` :
          `${q.answer===pick ? '정답' : '오답'} · 공식 정답 ${set.choices[q.answer-1]}`}
      </Text>}
      <View style={row}>
        <ExamButton label="이전" disabled={busy || position===0} action={()=>change(position-1)} />
        <ExamButton label="다음" disabled={busy || position>=list.length-1} action={()=>change(position+1)} />
        {pick!==undefined && <ExamButton label="다시 풀기" disabled={busy} action={()=>setRetry(true)} />}
        <ExamButton label={progress.revisit[q.number]?'표시 해제':'다시 볼 문제 표시'} disabled={busy} action={()=>{void toggleMark();}} />
      </View>
    </>}
    {!!message && <Text accessibilityLiveRegion="polite" style={{color:c.foreground}}>{message}</Text>}
  </View>;
}
