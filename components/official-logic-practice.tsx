import { useState } from 'react';
import { Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useColors } from '@/hooks/use-colors';
import { ScreenContainer } from '@/components/screen-container';
import sets from '@/data/official-logic-sets.json';

export function OfficialLogicPractice() {
  const c = useColors(), router = useRouter();
  const [school, setSchool] = useState('가천대');
  const available = sets.filter(s => s.school === school).sort((a,b) => b.year-a.year);
  const [year, setYear] = useState(2026), [index, setIndex] = useState(0);
  const [pick, setPick] = useState<number | null>(null);
  const [linkFailed, setLinkFailed] = useState(false);
  const s = available.find(x=>x.year===year) ?? available[0];
  const reset = () => {setIndex(0);setPick(null);setLinkFailed(false);};
  const open = (url: string) => {setLinkFailed(false); void Linking.openURL(url).catch(()=>setLinkFailed(true));};
  const button = (label: string, action: ()=>void, active=false, disabled=false) =>
    <Pressable key={label} accessibilityRole="button" accessibilityState={{selected:active,disabled}} disabled={disabled} onPress={action}
      style={{minHeight:44,padding:10,justifyContent:'center',backgroundColor:active?c.primary:c.surface,borderRadius:10,borderWidth:1,borderColor:c.border}}>
      <Text style={{color:active?'white':c.foreground}}>{label}</Text></Pressable>;
  const row = { flexDirection:'row', flexWrap:'wrap',gap:6 } as const;
  return <ScreenContainer containerClassName="bg-background"><ScrollView contentContainerStyle={{padding:18,gap:15,paddingBottom:90}}>
    <Text accessibilityRole="header" style={{fontSize:24,fontWeight:'700',color:c.foreground}}>대학 기출 논리완성</Text>
    <View style={row}>{['중앙대','가천대','동국대','한양대','건국대'].map(name=>button(name,()=>{setSchool(name);setYear(2026);reset();},school===name))}</View>
    <View style={row}>{available.map(x=>button(x.year+'학년도',()=>{setYear(x.year);reset();},x.year===s.year))}</View>
    <Text style={{color:c.foreground,fontSize:18,fontWeight:'700'}}>{s.school} {s.year}학년도 · {s.first}~{s.last}번</Text>
    <Text style={{color:c.muted}}>입학처 원본에서 해당 번호를 푸세요.{s.form ? ' 시험지: '+s.form+'.' : ''}</Text>
    {button('입학처 문제지 열기',()=>open(s.url))}
    {s.answers ? <>
      <Text style={{color:c.foreground,fontWeight:'700'}}>{s.first+index}번 · 고른 답</Text>
      <View style={row}>{['①','②','③','④'].map((label,i)=>button(label,()=>setPick(i+1),pick===i+1,pick!==null))}</View>
      {pick!==null && <Text accessibilityLiveRegion="polite" style={{color:c.foreground}}>{pick===s.answers[index]?'정답입니다.':'오답입니다.'} 공식 정답: {s.answers[index]}번</Text>}
      <View style={row}>{button('이전 문항',()=>{setIndex(index-1);setPick(null);},false,index===0)}
      {button('다음 문항',()=>{setIndex(index+1);setPick(null);},false,s.first+index>=s.last)}</View>
      {s.keyUrl && button('입학처 정답표 열기',()=>open(s.keyUrl))}
      <Text style={{color:c.muted}}>답 대조 연습 · 기존 학습 통계에 합산하지 않습니다.</Text>
    </> : <Text style={{color:c.muted}}>원문 풀이 전용 · 공식 정답 미확인</Text>}
    {linkFailed && <Text selectable style={{color:c.foreground}}>링크를 열지 못했습니다. 입학처 문제지: {s.url}</Text>}
    {button('학습 방식으로 돌아가기',()=>router.replace('/'))}
  </ScrollView></ScreenContainer>;
}
