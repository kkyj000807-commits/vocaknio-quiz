import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useColors } from "@/hooks/use-colors";
import type { ActiveRecallSense } from "@/lib/active-recall";
import { SemanticRelationCluster } from "@/components/semantic-relation-cluster";
import { LearningEvidence } from "@/components/learning-evidence";
import { PronunciationButton } from "@/components/pronunciation-button";
import { WordPronunciation } from "@/components/word-pronunciation";
import { KoreanReveal } from "@/components/korean-reveal";
import { LazyReasoningPractice } from "@/components/reasoning-practice";
import { type VocabItem } from "@/lib/vocab";
import type { QuizChoice } from "@/lib/quiz-engine";
import {
  getDefinitionAnswerRelations,
  getDefinitionRelationMeanings,
  type DefinitionQuizEntry,
} from "@/lib/definition-quiz";
import { getDefinitionWalkthrough } from "@/lib/definition-walkthrough";

type MeaningChoice = { word: string; meaning: string };

function ExampleRelationCue({
  synonyms,
  antonyms,
}: {
  synonyms: readonly string[];
  antonyms: readonly string[];
  meanings?: Readonly<Record<string, string>>;
}) {
  const colors = useColors();
  const same = [...new Set(synonyms)].slice(0, 5);
  const opposite = [...new Set(antonyms)].slice(0, 4);
  const format = (word: string) => word;
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

function DefinitionMeaning({ recall, koreanMeaning }: { recall: DefinitionQuizEntry; koreanMeaning: string }) {
  const colors = useColors();
  const reviewed = getDefinitionWalkthrough(recall);
  const label = (title: string) => <Text style={[styles.label, { color: colors.primary }]}>{title}</Text>;
  const text = (value: string) => <Text style={[styles.definition, { color: colors.foreground }]}>{value}</Text>;
  return <View style={styles.details}>
    {label("영영 정의")}
    {text(recall.definition)}
    {reviewed ? <>
      {label("직역")}{text(reviewed.literalKo)}
      {label("의역")}{text(reviewed.naturalKo)}
      {label("왜 이 뜻인가?")}{text(reviewed.whyKo)}
    </> : <>{label("교재 뜻")}{text(koreanMeaning)}</>}
  </View>;
}

function DefinitionFurtherStudy({ recall, koreanMeaning, highlightedRelation }: {
  recall: DefinitionQuizEntry;
  koreanMeaning: string;
  highlightedRelation?: string;
}) {
  const colors = useColors();
  const reviewed = getDefinitionWalkthrough(recall);
  const relations = getDefinitionAnswerRelations(recall);
  const meanings = getDefinitionRelationMeanings(recall, koreanMeaning)
    .filter(value => value.source === "same-sense-vocab" || value.source === "linked-antonym-vocab")
    .map(({ word, meaning }) => ({ word, meaning }));
  const label = (title: string) => <Text style={[styles.label, { color: colors.primary }]}>{title}</Text>;
  const text = (value: string) => <Text style={[styles.detailText, { color: colors.foreground }]}>{value}</Text>;
  const extraRelations = reviewed?.relations.filter(note => note.word !== highlightedRelation) ?? [];
  if (!reviewed && !recall.examples.length && !relations.synonyms.length && !relations.antonyms.length) return null;
  return <KoreanReveal key={recall.senseId} label="예문·유사어">
    {reviewed && <>
      <View style={styles.example}>
        {label("예문")}
        {text(reviewed.example.en)}
        <PronunciationButton text={reviewed.example.en} compact />
        {text(`직역 · ${reviewed.example.literalKo}`)}
        {text(`의역 · ${reviewed.example.naturalKo}`)}
        {text(`문맥 단서 · ${reviewed.example.cueKo}`)}
      </View>
      {extraRelations.length > 0 && <View style={styles.details}>
        {label("유사어는 어디까지 같은가?")}
        {extraRelations.map(({ word, meaningKo, contrastKo }) => (
          <View key={word} style={styles.example}>
            <Text style={[styles.relationName, { color: colors.foreground }]}>{word} · {meaningKo}</Text>
            {text(contrastKo)}
          </View>
        ))}
      </View>}
    </>}
    {(relations.synonyms.length > 0 || relations.antonyms.length > 0) && <KoreanReveal label="사전 관계어">
      <SemanticRelationCluster headword={recall.headword} coreMeaningKo={koreanMeaning} showDefinitionBridge={false}
        exactSynonyms={relations.synonyms} antonyms={relations.antonyms} choiceMeanings={meanings} />
    </KoreanReveal>}
    {recall.examples.length > 0 && <View style={styles.details}>
      {label("사전 관련 용례")}
      {recall.examples.slice(0, 2).map((example, index) => (
        <View key={`${example}:${index}`} style={styles.example}>
          {text(example)}
          <PronunciationButton text={example} compact />
        </View>
      ))}
    </View>}
  </KoreanReveal>;
}

export function DefinitionRecallAnswer({
  recall,
  koreanMeaning,
  item,
}: {
  recall: DefinitionQuizEntry;
  koreanMeaning: string;
  choices?: MeaningChoice[];
  item?: VocabItem;
}) {
  const colors = useColors();
  return (
    <View style={[styles.answer, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[styles.answerWord, { color: colors.foreground }]}>{recall.headword}</Text>
      {item && <WordPronunciation item={item} context="answer" />}
      <DefinitionMeaning recall={recall} koreanMeaning={koreanMeaning} />
      <DefinitionFurtherStudy recall={recall} koreanMeaning={koreanMeaning} />
      <Text style={[styles.note, { color: colors.muted }]}>정의 출처 · Open English WordNet 2025</Text>
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
  const correct = choices.find((choice) => choice.isCorrect);
  const relation = getDefinitionWalkthrough(recall)?.relations.find(note => note.word === correct?.word.toLowerCase());

  return (
    <View style={[styles.answer, { borderColor: colors.border, backgroundColor: colors.card }]}>
      <Text style={[styles.eyebrow, { color: colors.primary }]}>영어 동의어</Text>
      <Text style={[styles.answerWord, { color: colors.foreground }]}>
        {recall.headword}{correct ? ` ≒ ${correct.word}` : ""}
      </Text>
      {item && <WordPronunciation item={item} context="answer" />}
      <DefinitionMeaning recall={recall} koreanMeaning={koreanMeaning} />
      {relation && <View style={styles.details}>
        <Text style={[styles.label, { color: colors.primary }]}>왜 정답과 뜻이 가까운가?</Text>
        <Text style={[styles.detailText, { color: colors.foreground }]}>{relation.word} · {relation.meaningKo}</Text>
        <Text style={[styles.detailText, { color: colors.foreground }]}>{relation.contrastKo}</Text>
      </View>}
      <View style={styles.details}>
        <Text style={[styles.label, { color: colors.primary }]}>선지 뜻 확인</Text>
        {choices.map(choice => (
          <Text key={choice.id} style={[styles.detailText, { color: colors.foreground }]}>
            {choice.word} · {choice.meaning?.trim() || "뜻 확인 필요"}{choice.isCorrect ? " · 정답" : ""}
          </Text>
        ))}
        <Text style={[styles.note, { color: colors.muted }]}>표시된 뜻은 현재 연결된 뜻이며, 다른 뜻이 더 있을 수 있습니다.</Text>
      </View>
      <DefinitionFurtherStudy recall={recall} koreanMeaning={koreanMeaning} highlightedRelation={relation?.word} />
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

export function ActiveRecallAnswer({ recall, choices, item, showRelationNotes = false }: { recall: ActiveRecallSense; choices?: MeaningChoice[]; item?: VocabItem; showRelationNotes?: boolean }) {
  const colors = useColors();
  const [expanded, setExpanded] = useState(false);
  const reviewedRelationMeanings = Object.entries(recall.relationMeaningsKo ?? {})
    .map(([word, meaning]) => ({ word, meaning }));
  return (
    <View style={[styles.answer, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[styles.answerWord, { color: colors.foreground }]}>{recall.headword}</Text>
      {item && <WordPronunciation item={item} context="answer" />}
      <Text style={[styles.detailText, { color: colors.foreground }]}>{recall.koreanMeaning}</Text>
      <SemanticRelationCluster
        headword={recall.headword}
        coreMeaningKo={recall.koreanMeaning}
        bridgeKo={recall.contextExplanationKo}
        showDefinitionBridge={false}
        showRelationNotes={showRelationNotes}
        exactSynonyms={recall.exactSynonyms}
        nearSynonyms={recall.nearSynonyms}
        antonyms={recall.antonyms}
        variants={recall.variants}
        relatedWords={recall.relatedWords}
        choiceMeanings={[...(choices ?? []), ...reviewedRelationMeanings]}
      />
      <Text style={[styles.label, { color: colors.primary }]}>영영 정의 · 한국어 해석</Text>
      <Text style={[styles.definition, { color: colors.foreground }]}>{recall.conciseEnglishDefinition}</Text>
      {recall.exampleSentences.slice(0, 1).map(example => <View key={example.en} style={styles.example}>
        <Text style={[styles.detailText, { color: colors.foreground }]}>{example.en}</Text>
        <PronunciationButton text={example.en} compact />
        <KoreanReveal defaultOpen={showRelationNotes}>
          {example.ko && <Text style={[styles.detailText, { color: colors.foreground }]}>{example.ko}</Text>}
          {example.cueKo && <Text style={[styles.note, { color: colors.muted }]}>문맥 단서: {example.cueKo}</Text>}
        </KoreanReveal>
      </View>)}
      {recall.contextExplanationKo && <KoreanReveal label="문맥 상세 설명" defaultOpen={showRelationNotes}><Text style={[styles.note, { color: colors.muted }]}>{recall.contextExplanationKo}</Text></KoreanReveal>}
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
          <Text style={[styles.label, { color: colors.primary }]}>영영 정의 · 자세한 풀이</Text>
          <Text style={[styles.detailText, { color: colors.foreground }]}>{recall.englishDefinition}</Text>
          <Text style={[styles.label, { color: colors.primary }]}>예문 · 한국어 해석과 문맥 단서</Text>
          {recall.exampleSentences.map((example, index) => (
            <View key={`${example.en}-${index}`} style={styles.example}>
              <Text style={[styles.detailText, { color: colors.foreground }]}>{example.en}</Text>
              <PronunciationButton text={example.en} compact />
              <KoreanReveal>
                {example.ko ? <Text style={[styles.detailText, { color: colors.foreground }]}>{example.ko}</Text> : null}
                {example.cueKo ? <Text style={[styles.note, { color: colors.muted }]}>문맥 단서: {example.cueKo}</Text> : null}
              </KoreanReveal>
              <ExampleRelationCue
                synonyms={[...recall.exactSynonyms, ...recall.nearSynonyms]}
                antonyms={recall.antonyms}
                meanings={recall.relationMeaningsKo}
              />
            </View>
          ))}
          <LazyReasoningPractice itemId={item?.id ?? recall.itemIds[0]} />
        </View>
      ) : null}
      <LearningEvidence entry={recall} />
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
  relationName: { fontSize: 13, lineHeight: 21, fontWeight: "700" },
  exampleRelations: { gap: 3, marginTop: 3, paddingHorizontal: 9, paddingVertical: 6, borderWidth: 1, borderRadius: 9 },
  exampleRelationText: { fontSize: 11, lineHeight: 17, fontWeight: "800" },
  detailText: { fontSize: 13, lineHeight: 21 },
});
