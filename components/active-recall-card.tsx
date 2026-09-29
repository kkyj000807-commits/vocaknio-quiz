import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useColors } from "@/hooks/use-colors";
import type { ActiveRecallSense } from "@/lib/active-recall";
import { SemanticRelationCluster } from "@/components/semantic-relation-cluster";
import { getSynonymDetails, type VocabItem } from "@/lib/vocab";
import type { QuizChoice } from "@/lib/quiz-engine";
import {
  buildDefinitionMeaningBridgeKo,
  getDefinitionAnswerRelations,
  getDefinitionRelationMeanings,
  type DefinitionQuizEntry,
} from "@/lib/definition-quiz";

type MeaningChoice = { word: string; meaning: string };

function ExampleRelationCue({
  synonyms,
  antonyms,
}: {
  synonyms: readonly string[];
  antonyms: readonly string[];
}) {
  const colors = useColors();
  const same = [...new Set(synonyms)].slice(0, 5);
  const opposite = [...new Set(antonyms)].slice(0, 4);
  if (same.length === 0 && opposite.length === 0) return null;
  return (
    <View style={[styles.exampleRelations, { borderColor: colors.border, backgroundColor: colors.surface }]}>
      {same.length > 0 ? (
        <Text style={[styles.exampleRelationText, { color: colors.success }]}>≒ {same.join(" · ")}</Text>
      ) : null}
      {opposite.length > 0 ? (
        <Text style={[styles.exampleRelationText, { color: colors.error }]}>←→ {opposite.join(" · ")}</Text>
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
  const bridgeKo = buildDefinitionMeaningBridgeKo(koreanMeaning);
  const storedMeanings = item ? getSynonymDetails(item).map(({ word, meaning }) => ({ word, meaning })) : [];
  return (
    <View style={[styles.answer, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[styles.answerWord, { color: colors.foreground }]}>{recall.headword}</Text>
      <Text style={[styles.label, { color: colors.primary }]}>EN · 영영사전 원문</Text>
      <Text style={[styles.definition, { color: colors.foreground }]}>{recall.definition}</Text>
      <SemanticRelationCluster
        headword={recall.headword}
        coreMeaningKo={koreanMeaning}
        bridgeKo={bridgeKo}
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
              <Text style={[styles.note, { color: colors.muted }]}>문맥 이미지: ‘{koreanMeaning}’의 장면이 어떻게 드러나는지 확인합니다.</Text>
              <ExampleRelationCue synonyms={relations.synonyms} antonyms={relations.antonyms} />
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
      <Text style={[styles.eyebrow, { color: colors.primary }]}>EN ↔ EN · 같은 sense</Text>
      <Text style={[styles.answerWord, { color: colors.foreground }]}>
        {recall.headword} ≒ {correct?.word ?? relations.synonyms[0]}
      </Text>
      <Text style={[styles.definition, { color: colors.foreground }]}>{recall.definition}</Text>
      <Text style={[styles.note, { color: colors.muted }]}>문제에서는 영어만 보고 판단하고, 아래 한국어는 정답 확인 뒤 의미 경계를 복습하는 해설입니다.</Text>
      <SemanticRelationCluster
        headword={recall.headword}
        coreMeaningKo={koreanMeaning}
        bridgeKo={buildDefinitionMeaningBridgeKo(koreanMeaning)}
        exactSynonyms={relations.synonyms}
        antonyms={relations.antonyms}
        choiceMeanings={[...choices, ...relationMeanings, ...storedMeanings]}
      />
      {recall.examples.length > 0 ? (
        <View style={styles.details}>
          <Text style={[styles.label, { color: colors.primary }]}>영영사전 예문 · 같은 sense 확인</Text>
          {recall.examples.slice(0, 2).map((example) => (
            <View key={example} style={styles.example}>
              <Text style={[styles.detailText, { color: colors.foreground }]}>{example}</Text>
              <Text style={[styles.note, { color: colors.muted }]}>문맥 핵심: ‘{koreanMeaning}’의 상태·작용이 드러나는 대목을 찾습니다.</Text>
              <ExampleRelationCue synonyms={relations.synonyms} antonyms={relations.antonyms} />
            </View>
          ))}
        </View>
      ) : null}
      <Text style={[styles.note, { color: colors.muted }]}>관계 근거: Open English WordNet 2025 same-synset. 우선 검수는 The Free Dictionary, Oxford, Collins의 같은 품사·sense를 대조합니다.</Text>
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
        choiceMeanings={[...storedMeanings, ...(choices ?? [])]}
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
