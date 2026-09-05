import { useEffect, useState } from "react";
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from "react-native";

import { useColors } from "@/hooks/use-colors";
import {
  hasLearningEntry,
  loadLearningEntries,
  type LearningEntry,
} from "@/lib/vocab-learning";

type LearningDetailsProps = { itemId: string };

/** Mount only after an answer is revealed/graded by the parent screen. */
export function LearningDetails({ itemId }: LearningDetailsProps) {
  if (!hasLearningEntry(itemId)) return null;
  // Keyed state prevents an expanded previous sense from flashing on a new card.
  return <LearningDetailsPanel key={itemId} itemId={itemId} />;
}

function LearningDetailsPanel({ itemId }: LearningDetailsProps) {
  const colors = useColors();
  const s = styles(colors);
  const [expanded, setExpanded] = useState(false);
  const [entries, setEntries] = useState<LearningEntry[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!expanded || entries !== null) return;
    let cancelled = false;
    setLoading(true);
    setError(false);
    loadLearningEntries(itemId)
      .then((loaded: LearningEntry[]) => {
        if (!cancelled) setEntries(loaded);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [attempt, entries, expanded, itemId]);

  if (entries?.length === 0) return null;

  return (
    <View style={s.panel}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`뜻·뉘앙스·예문 ${expanded ? "접기" : "펼치기"}`}
        accessibilityState={{ expanded }}
        onPress={() => setExpanded((value) => !value)}
        style={({ pressed }) => [s.toggle, pressed && s.pressed]}
      >
        <Text style={s.toggleText}>뜻·뉘앙스·예문</Text>
        <Text style={s.toggleIcon}>{expanded ? "−" : "+"}</Text>
      </Pressable>
      {expanded && (
        <View style={s.body}>
          {loading && (
            <View style={s.loadingRow} accessibilityLiveRegion="polite">
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={s.note}>학습 해설을 불러오는 중입니다</Text>
            </View>
          )}
          {error && (
            <View>
              <Text style={s.note}>해설을 불러오지 못했습니다. 문제 풀이는 계속할 수 있어요.</Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => setAttempt((value) => value + 1)}
                style={({ pressed }) => [s.retry, pressed && s.pressed]}
              >
                <Text style={s.linkText}>다시 불러오기</Text>
              </Pressable>
            </View>
          )}
          {entries?.map((entry, index) => (
            <SenseDetails key={entry.id} entry={entry} index={index} count={entries.length} />
          ))}
        </View>
      )}
    </View>
  );
}

function SenseDetails({ entry, index, count }: { entry: LearningEntry; index: number; count: number }) {
  const colors = useColors();
  const s = styles(colors);
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [linkError, setLinkError] = useState(false);
  const nuance = entry.nuance;

  const openSource = async (url: string) => {
    setLinkError(false);
    try {
      await Linking.openURL(url);
    } catch {
      setLinkError(true);
    }
  };

  return (
    <View style={[s.sense, index > 0 && s.nextSense]}>
      <Text style={s.senseTitle}>
        {count > 1 ? `${index + 1}. ` : ""}{entry.headword} · {entry.partOfSpeech}
      </Text>

      <View style={s.memoryBox}>
        <Text style={s.label}>기억 고리</Text>
        <Text style={s.text}>{entry.memoryKo}</Text>
      </View>

      <View style={s.section}>
        <Text style={s.label}>{entry.definitionKind === "editorial" ? "영영 풀이 · 사전 대조" : "영영 정의"}</Text>
        <Text style={s.english}>{entry.definitionEn}</Text>
        <Text style={s.text}>{entry.definitionKo}</Text>
      </View>

      <View style={s.section}>
        <Text style={s.label}>쓰임과 뉘앙스</Text>
        {nuance?.register && <Text style={s.text}>격식·문체: {nuance.register}</Text>}
        {nuance?.connotation && <Text style={s.text}>어감: {nuance.connotation}</Text>}
        <Text style={s.text}>{entry.usageKo}</Text>
        {nuance?.intensity && (
          <View style={s.intensityBox}>
            <Text style={s.label}>이 뜻에서의 상대적 강도 · 약 → 강</Text>
            <Text style={s.scale}>{nuance.intensity.scale.join(" → ")}</Text>
            <Text style={s.note}>{nuance.intensity.noteKo}</Text>
          </View>
        )}
      </View>

      {entry.contrasts.length > 0 && (
        <View style={s.section}>
          <Text style={s.label}>비슷하지만 다른 단어</Text>
          {entry.contrasts.map((contrast: LearningEntry["contrasts"][number], contrastIndex: number) => (
            <Text key={`${contrast.word}-${contrastIndex}`} style={s.text}>
              <Text style={s.contrastWord}>{contrast.word}</Text> — {contrast.noteKo}
            </Text>
          ))}
        </View>
      )}

      <View style={s.section}>
        <Text style={s.label}>문제에서 주의할 점</Text>
        <Text style={s.text}>{entry.examTrapKo}</Text>
      </View>

      <View style={s.exampleBox}>
        <Text style={s.label}>예문 · {entry.example.kind === "editorial" ? "학습용 창작" : "출처 원문"}</Text>
        <Text style={s.english}>{entry.example.en}</Text>
        <Text style={s.text}>{entry.example.ko}</Text>
      </View>

      {entry.audio && (
        <Text style={s.note}>
          발음 · 미국식 실제 녹음 · {entry.audio.source} · {entry.audio.license}
        </Text>
      )}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`사전 출처와 검수 정보 ${sourcesOpen ? "접기" : "펼치기"}`}
        accessibilityState={{ expanded: sourcesOpen }}
        onPress={() => setSourcesOpen((value) => !value)}
        style={({ pressed }) => [s.sourceToggle, pressed && s.pressed]}
      >
        <Text style={s.linkText}>사전 출처·검수 정보 {sourcesOpen ? "−" : "+"}</Text>
      </Pressable>
      {sourcesOpen && (
        <View style={s.sourceBody}>
          <Text style={s.note}>뜻 대조 일치 · {entry.verification.checkedAtKst}</Text>
          <Text style={s.note}>검수: {entry.verification.reviewer}</Text>
          {entry.sources.map((source: LearningEntry["sources"][number], sourceIndex: number) => (
            <Pressable
              key={`${source.url}-${sourceIndex}`}
              accessibilityRole="link"
              accessibilityLabel={`${source.name} 출처 열기`}
              onPress={() => void openSource(source.url)}
              style={({ pressed }) => [s.sourceLink, pressed && s.pressed]}
            >
              <Text style={s.linkText}>{source.name} ↗</Text>
              <Text style={s.note}>{source.edition} · {source.license}</Text>
              {source.attribution && <Text style={s.note}>표시: {source.attribution}</Text>}
            </Pressable>
          ))}
          {linkError && <Text style={s.note}>출처 페이지를 열지 못했습니다. 잠시 후 다시 눌러 주세요.</Text>}
          <Text style={s.note}>
            한국어 해설·비교·학습용 예문은 AI 편집 검수 자료이며, 사전의 공식 번역이나 인증이 아닙니다.
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = (c: ReturnType<typeof useColors>) => StyleSheet.create({
  panel: { marginTop: 8, borderWidth: 1, borderColor: c.border, borderRadius: 10, backgroundColor: c.card },
  toggle: { minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, paddingHorizontal: 12, paddingVertical: 8 },
  toggleText: { flex: 1, color: c.primary, fontSize: 13, lineHeight: 19, fontWeight: "700" },
  toggleIcon: { color: c.primary, fontSize: 20, width: 22, textAlign: "center" },
  pressed: { opacity: 0.65 },
  body: { paddingHorizontal: 12, paddingBottom: 12 },
  loadingRow: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 44 },
  retry: { minHeight: 44, justifyContent: "center", alignSelf: "flex-start", paddingHorizontal: 8 },
  sense: { gap: 14 },
  nextSense: { marginTop: 20, paddingTop: 20, borderTopWidth: 1, borderTopColor: c.border },
  senseTitle: { fontSize: 14, lineHeight: 20, fontWeight: "700", color: c.foreground },
  section: { gap: 6 },
  label: { fontSize: 11, lineHeight: 17, fontWeight: "700", color: c.primary },
  text: { fontSize: 13, lineHeight: 21, color: c.foreground, flexShrink: 1 },
  english: { fontSize: 14, lineHeight: 22, color: c.foreground, flexShrink: 1 },
  note: { fontSize: 11, lineHeight: 18, color: c.muted, flexShrink: 1 },
  memoryBox: { gap: 4, padding: 10, borderRadius: 8, backgroundColor: c.surface },
  intensityBox: { gap: 5, marginTop: 3, padding: 10, borderWidth: 1, borderColor: c.border, borderRadius: 8 },
  scale: { fontSize: 13, lineHeight: 21, color: c.primary, fontWeight: "700" },
  contrastWord: { fontWeight: "700", color: c.primary },
  exampleBox: { gap: 6, paddingLeft: 10, borderLeftWidth: 2, borderLeftColor: c.border },
  sourceToggle: { minHeight: 44, justifyContent: "center" },
  sourceBody: { gap: 5 },
  sourceLink: { minHeight: 44, justifyContent: "center", paddingVertical: 6, gap: 2 },
  linkText: { fontSize: 12, lineHeight: 18, fontWeight: "600", color: c.primary, textDecorationLine: "underline" },
});
