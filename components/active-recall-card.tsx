import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useColors } from "@/hooks/use-colors";
import type { ActiveRecallSense } from "@/lib/active-recall";
import { SemanticRelationCluster } from "@/components/semantic-relation-cluster";
import { getSynonymDetails, type VocabItem } from "@/lib/vocab";
import type { QuizChoice } from "@/lib/quiz-engine";
import {
  getDefinitionAnswerRelations,
  getDefinitionRelationMeanings,
  type DefinitionQuizEntry,
} from "@/lib/definition-quiz";

type MeaningChoice = { word: string; meaning: string };

function ExampleRelationCue({
  synonyms,
  antonyms,
  meanings,
}: {
  synonyms: readonly string[];
  antonyms: readonly string[];
  meanings?: Readonly<Record<string, string>>;
}) {
  const colors = useColors();
  const same = [...new Set(synonyms)].slice(0, 5);
  const opposite = [...new Set(antonyms)].slice(0, 4);
  const format = (word: string) => meanings?.[word] ? `${word} (${meanings[word]})` : word;
  if (same.length === 0 && opposite.length === 0) return null;
  return (
    <View style={[styles.exampleRelations, { borderColor: colors.border, backgroundColor: colors.surface }]}>
      {same.length > 0 ? (
        <Text style={[styles.exampleRelationText, { color: colors.success }]}>≒ {same.map(format).join(" · ")}</Text>
      ) : null}
      {opposite.length > 0 ? (
        <Text style={[styles.exampleRelationText, { color: colors.error }]}>←→ {opposite.map(format).join(" · ")}</Text>
      ) : null}
    </View>
  );
}

export function DefinitionRecallPrompt({ definition }: { definition: string }) {
  const colors = useColors();
  return (
    <View style={[styles.prompt, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[styles.eyebrow, { color: colors.primary }]}>EN · 영영 정의 → 단어</Text>
      <Text style={[styles.promptText, { color: colors.foreground }]}>{definition}</Text>
      <Text style={[styles.note, { color: colors.muted }]}>이 정의에 정확히 맞는 영어 표현을 고르세요. 한국어 뜻은 정답 확인 뒤에 표시됩니다.</Text>
    </View>
  );
}

export function DefinitionRecallAnswer({
  recall,
  koreanMeaning,
  choices,
  item,
}: {
  recall: DefinitionQuizEntry;
  koreanMeaning: string;
  choices?: MeaningChoice[];
  item?: VocabItem;
}) {
  const colors = useColors();
  const relations = getDefinitionAnswerRelations(recall);
  const definitionMeanings = getDefinitionRelationMeanings(recall, koreanMeaning)
    .map(({ word, meaning }) => ({ word, meaning }));
  const storedMeanings = item ? getSynonymDetails(item).map(({ word, meaning }) => ({ word, meaning })) : [];
  return (
    <View style={[styles.answer, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[styles.answerWord, { color: colors.foreground }]}>{recall.headword}</Text>
      <Text style={[styles.label, { color: colors.primary }]}>EN · 영영사전 원문</Text>
      <Text style={[styles.definition, { color: colors.foreground }]}>{recall.definition}</Text>
      <SemanticRelationCluster
        headword={recall.headword}
        coreMeaningKo={koreanMeaning}
        exactSynonyms={relations.synonyms.slice(0, 8)}
        antonyms={relations.antonyms.slice(0, 8)}
        choiceMeanings={[...definitionMeanings, ...storedMeanings, ...(choices ?? [])]}
      />
      {recall.examples.length > 0 ? (
        <>
          <Text style={[styles.label, { color: colors.primary }]}>예문 · 영영사전 원문</Text>
          {recall.examples.slice(0, 2).map((example, index) => (
            <View key={`${example}:${index}`} style={styles.example}>
              <Text style={[styles.detailText, { color: colors.foreground }]}>{example}</Text>
              <ExampleRelationCue synonyms={relations.synonyms} antonyms={relations.antonyms} meanings={Object.fromEntries(definitionMeanings.map(m => [m.word, m.meaning]))} />
            </View>
          ))}
        </>
      ) : null}
      <Text style={[styles.note, { color: colors.muted }]}>Open English WordNet 2025 · exact single-sense 항목</Text>
    </View>
  );
}

export function SynonymRecallAnswer({
  recall,
  koreanMeaning,
  choices,
  item,
}: {
  recall: DefinitionQuizEntry;
  koreanMeaning: string;
  choices: QuizChoice[];
  item?: VocabItem;
}) {
  const colors = useColors();
  const relations = getDefinitionAnswerRelations(recall);
  const relationMeanings = getDefinitionRelationMeanings(recall, koreanMeaning)
    .map(({ word, meaning }) => ({ word, meaning }));
  const storedMeanings = item ? getSynonymDetails(item).map(({ word, meaning }) => ({ word, meaning })) : [];
  const correct = choices.find((choice) => choice.isCorrect);

  return (
    <View style={[styles.answer, { borderColor: colors.border, backgroundColor: colors.card }]}>
      <Text style={[styles.eyebrow, { color: colors.primary }]}>영어 동의어</Text>
      <Text style={[styles.answerWord, { color: colors.foreground }]}>
        {recall.headword} ≒ {correct?.word ?? relations.synonyms[0]}
      </Text>
      <Text style={[styles.definition, { color: colors.foreground }]}>{recall.definition}</Text>
      <SemanticRelationCluster
        headword={recall.headword}
        coreMeaningKo={koreanMeaning}
        exactSynonyms={relations.synonyms}
        antonyms={relations.antonyms}
        choiceMeanings={[...choices, ...relationMeanings, ...storedMeanings]}
      />
      {recall.examples.length > 0 ? (
        <View style={styles.details}>
          <Text style={[styles.label, { color: colors.primary }]}>예문</Text>
          {recall.examples.slice(0, 2).map((example) => (
            <View key={example} style={styles.example}>
              <Text style={[styles.detailText, { color: colors.foreground }]}>{example}</Text>
              <ExampleRelationCue synonyms={relations.synonyms} antonyms={relations.antonyms} meanings={Object.fromEntries(relationMeanings.map(m => [m.word, m.meaning]))} />
            </View>
          ))}
        </View>
      ) : null}
      <Text style={[styles.note, { color: colors.muted }]}>관계 근거: Open English WordNet 2025</Text>
    </View>
  );
}

export function ActiveRecallPrompt({ recall, promptId }: { recall: ActiveRecallSense; promptId?: string }) {
  const colors = useColors();
  const prompt = recall.prompts.find(candidate => candidate.id === promptId) ?? recall.prompts[0];
  return (
    <View style={[styles.prompt, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[styles.eyebrow, { color: colors.primary }]}>
        {prompt.kind === "definition-recall" ? "EN · 정의에서 단어 인출" : "EN · 문맥에서 단어 인출"}
      </Text>
      <Text style={[styles.promptText, { color: colors.foreground }]}>{prompt.text}</Text>
      <Text style={[styles.note, { color: colors.muted }]}>한국어 뜻은 정답 확인 뒤에 표시됩니다.</Text>
    </View>
  );
}

export function ActiveRecallAnswer({ recall, choices, item }: { recall: ActiveRecallSense; choices?: MeaningChoice[]; item?: VocabItem }) {
  const colors = useColors();
  const [expanded, setExpanded] = useState(false);
  const storedMeanings = item ? getSynonymDetails(item).map(({ word, meaning }) => ({ word, meaning })) : [];
  const reviewedRelationMeanings = Object.entries(recall.relationMeaningsKo ?? {})
    .map(([word, meaning]) => ({ word, meaning }));
  return (
    <View style={[styles.answer, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[styles.answerWord, { color: colors.foreground }]}>{recall.headword}</Text>
      <Text style={[styles.label, { color: colors.primary }]}>EN</Text>
      <Text style={[styles.definition, { color: colors.foreground }]}>{recall.conciseEnglishDefinition}</Text>
      <SemanticRelationCluster
        headword={recall.headword}
        coreMeaningKo={recall.koreanMeaning}
        bridgeKo={recall.contextExplanationKo}
        exactSynonyms={recall.exactSynonyms.slice(0, 5)}
        nearSynonyms={recall.nearSynonyms.slice(0, 5)}
        antonyms={recall.antonyms.slice(0, 5)}
        variants={recall.variants.slice(0, 3)}
        relatedWords={recall.relatedWords.slice(0, 3)}
        choiceMeanings={[...storedMeanings, ...(choices ?? []), ...reviewedRelationMeanings]}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        onPress={() => setExpanded(value => !value)}
        style={styles.more}
      >
        <Text style={[styles.moreText, { color: colors.primary }]}>{expanded ? "상세 접기 −" : "예문·전체 정의 보기 +"}</Text>
      </Pressable>
      {expanded ? (
        <View style={styles.details}>
          <Text style={[styles.label, { color: colors.primary }]}>Full EN · 원문 유지</Text>
          <Text style={[styles.detailText, { color: colors.foreground }]}>{recall.englishDefinition}</Text>
          <Text style={[styles.label, { color: colors.primary }]}>Example</Text>
          {recall.exampleSentences.map((example, index) => (
            <View key={`${example.en}-${index}`} style={styles.example}>
              <Text style={[styles.detailText, { color: colors.foreground }]}>{example.en}</Text>
              {example.ko ? <Text style={[styles.detailText, { color: colors.foreground }]}>{example.ko}</Text> : null}
              {example.cueKo ? <Text style={[styles.note, { color: colors.muted }]}>문맥 단서: {example.cueKo}</Text> : null}
              <ExampleRelationCue
                synonyms={[...recall.exactSynonyms, ...recall.nearSynonyms]}
                antonyms={recall.antonyms}
                meanings={recall.relationMeaningsKo}
              />
            </View>
          ))}
          <Text style={[styles.note, { color: colors.muted }]}>사전 2곳 의미 대조 · 정의와 예문은 학습용 자체 편집</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  prompt: { gap: 8, marginVertical: 12, padding: 14, borderWidth: 1, borderRadius: 12 },
  eyebrow: { fontSize: 11, lineHeight: 17, fontWeight: "800", letterSpacing: 0.5 },
  promptText: { fontSize: 17, lineHeight: 27, fontWeight: "600" },
  note: { fontSize: 11, lineHeight: 18 },
  answer: { gap: 7, marginTop: 14, padding: 16, borderWidth: 1, borderRadius: 14 },
  answerWord: { fontSize: 24, lineHeight: 31, fontWeight: "800" },
  label: { marginTop: 3, fontSize: 10, lineHeight: 16, fontWeight: "800", letterSpacing: 1.2 },
  definition: { fontSize: 15, lineHeight: 23 },
  more: { minHeight: 44, justifyContent: "center", alignSelf: "flex-start" },
  moreText: { fontSize: 12, fontWeight: "700" },
  details: { gap: 6, paddingTop: 4 },
  example: { gap: 4 },
  exampleRelations: { gap: 3, marginTop: 3, paddingHorizontal: 9, paddingVertical: 6, borderWidth: 1, borderRadius: 9 },
  exampleRelationText: { fontSize: 11, lineHeight: 17, fontWeight: "800" },
  detailText: { fontSize: 13, lineHeight: 21 },
});
