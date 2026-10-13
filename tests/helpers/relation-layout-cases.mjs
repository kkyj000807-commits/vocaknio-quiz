import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as jsx from 'react/jsx-runtime';
import { z } from 'zod';

// Real small modules, isolated corpus/network/storage. Shared Vitest/native
// assertions; SSR and simulated viewport are not physical-device acceptance.
const cache = new Map();
const host = tag => function MockNative({ children, ...props }) {
  return React.createElement(tag, { role: props.accessibilityRole, 'aria-label': props.accessibilityLabel }, children);
};
const native = { View: host('div'), Text: host('span'), Pressable: host('button'), ActivityIndicator: host('span'),
  FlatList: host('div'), ScrollView: host('div'), TextInput: host('input'), TouchableOpacity: host('button'), Platform: { OS: 'web' },
  StyleSheet: { create: value => value }, Linking: { openURL: async () => {} } };
const colors = { foreground: '#222', muted: '#666', primary: '#456', success: '#187', error: '#c33', border: '#ccc', surface: '#fff', card: '#eee', background: '#fff' };
const fixtureReference = { senseId: 'fixture:one', headword: 'fixture', examples: ['A fixture example.'], synsetMembers: ['fixture', 'equivalent'], antonyms: [] };
function load(relative) {
  if (cache.has(relative)) return cache.get(relative);
  const exports = {};
  const source = fs.readFileSync(new URL(`../../${relative}`, import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText
    + (relative === 'app/(tabs)/wordbook.tsx' ? '\nexports.WordCardForTest = WordCard;\n' : '');
  const dependencies = {
    'react': React, 'react/jsx-runtime': jsx, 'react-native': native, 'zod': { z },
    '@/assets/vocab-definition-quiz-oewn-2025.json': { entries: {
      boast: { headword: 'boast', senseId: 'boast%lexical', partOfSpeech: 'verb', definition: 'talk with excessive pride', synsetMembers: ['boast', 'brag'], antonyms: [], lexicographerFile: 'verb.communication', examples: [] },
      brag: { headword: 'brag', senseId: 'brag%lexical', partOfSpeech: 'verb', definition: 'talk with excessive pride', synsetMembers: ['brag', 'boast'], antonyms: [], lexicographerFile: 'verb.communication', examples: [] },
    }, items: { boastRow: 'boast', bragRow: 'brag' } },
    '@/lib/vocab': { VOCAB_BY_ID: new Map([['boastRow', { k_short: '자랑하다' }], ['bragRow', { k_short: '자랑하다' }]]),
      getSynonymDetails: () => [], getSynonymSourceGroups: () => [], normalizeWord: word => word.trim().toLowerCase(),
      WORDBOOK_RANGES: [], VOCAB: [], VOCAB_HEADWORD_COUNT: 1, getRangeItems: () => [] },
    'react-native-reanimated': { __esModule: true, default: { View: host('div') }, FadeIn: { duration: () => ({}) },
      useSharedValue: value => ({ value }), useAnimatedStyle: fn => fn(), withTiming: value => value, interpolate: () => 1, Extrapolation: { CLAMP: 'clamp' } },
    'expo-router': { useRouter: () => ({ push: () => {} }) }, 'expo-haptics': {}, 'expo-audio': {},
    '@/components/word-section-label': { WordSectionLabel: () => null },
    '@/components/screen-container': { ScreenContainer: host('div') },
    '@/components/problem-sense-context': { ProblemSenseContext: () => null },
    '@/components/ui/icon-symbol': { IconSymbol: () => null },
    '@/lib/sense-questions': { hasSenseQuestionMapping: () => false, getProductionSenseQuestions: () => [] },
    '@/lib/store': {}, '@/lib/canonical-learning': {},
    '@/hooks/use-colors': { useColors: () => colors },
    '@/components/reasoning-practice': { ReasoningPractice: () => null, LazyReasoningPractice: () => null },
    '@/components/pronunciation-button': { PronunciationButton: ({ text }) => React.createElement('button', null, text) },
    '@/components/learning-evidence': { LearningEvidence: () => null },
    '@/lib/learning-detail-loader': { loadLearningDetailParts: async () => {} },
    '@/lib/active-recall': { getActiveRecallSenses: () => [] },
    '@/lib/vocab-learning': { loadLearningEntries: async () => [] },
    '@/lib/vocab-definitions': { loadVocabDefinition: async () => null, VOCAB_DEFINITION_SOURCE: { name: 'Open English WordNet', edition: '2025', license: 'CC BY 4.0', attribution: 'Princeton WordNet; Open English WordNet Team' } },
    '@/lib/definition-quiz': { getDefinitionQuizEntry: id => id === 'fixture-row' ? fixtureReference : undefined,
      getDefinitionRelationMeanings: () => [],
      getDefinitionAnswerRelations: reference => ({ synonyms: reference.synsetMembers.filter(word => word !== reference.headword), antonyms: reference.antonyms }) },
  };
  vm.runInNewContext(compiled, { exports, require: name => {
    if (dependencies[name]) return dependencies[name];
    if (name.startsWith('@/')) {
      const filename = name.slice(2);
      return load(`${filename}.${filename.startsWith('components/') ? 'tsx' : 'ts'}`);
    }
    throw new Error(`Unexpected dependency: ${name}`);
  } });
  cache.set(relative, exports);
  return exports;
}
const render = element => renderToStaticMarkup(element);
export const relationLayoutCases = [
  ['a valid dictionary relation enables the wordbook button and chips even with no original synonyms', () => {
    const { WordCardForTest } = load('app/(tabs)/wordbook.tsx');
    const { SynonymDetails } = load('components/synonym-details.tsx');
    const item = { id: 'fixture-row', num: 1, w: 'fixture', k_short: '기본 뜻', k: '기본 뜻', s: [], group: 'V101' };
    const html = render(React.createElement(WordCardForTest, { item, bookmarks: new Set(), colors, maskMode: false, learningStatus: 'NEW',
      onToggleBookmark: () => {}, onPlayHide: () => {}, onPlayReveal: () => {}, onLearningStatusPress: () => {} }));
    assert.match(html, /동의어 보기/);
    const chips = render(React.createElement(SynonymDetails, { item, compact: true }));
    assert.match(chips, /equivalent/); assert.match(chips, /같은 사전 sense 동의어/);
    assert.doesNotMatch(chips, /\(기본 뜻\)/);
  }],
  ['answer-side basic order is Korean core, synonyms, definition, English example, translation', () => {
    const { ActiveRecallAnswer } = load('components/active-recall-card.tsx');
    const recall = { headword: 'boast', koreanMeaning: '자랑하다', conciseEnglishDefinition: 'Talk proudly about oneself.', englishDefinition: 'Talk proudly about oneself in detail.',
      exactSynonyms: ['brag'], nearSynonyms: ['flaunt'], antonyms: [], variants: [], relatedWords: [],
      relationMeaningsKo: { brag: '자랑하다', flaunt: '과시하다' }, itemIds: ['fixture-row'],
      exampleSentences: [{ en: 'He boasted about winning the prize.', ko: '그는 상을 받은 일을 자랑했다.', cueKo: 'about 뒤에 자랑하는 내용을 둔다.' }] };
    const html = render(React.createElement(ActiveRecallAnswer, { recall }));
    const positions = ['자랑하다', 'brag', 'Talk proudly about oneself.', 'He boasted about winning the prize.', '그는 상을 받은 일을 자랑했다.'].map(text => html.indexOf(text));
    assert.ok(positions.every(position => position >= 0));
    assert.ok(positions.every((position, index) => index === 0 || position > positions[index - 1]));
    assert.match(html, /\(자랑하다\)/); assert.match(html, /\(과시하다\)/);
  }],
  ['OEWN different lexical IDs still connect an explicitly shared synset, not merely similar glosses', () => {
    const api = load('lib/definition-quiz.ts');
    const boast = api.getDefinitionQuizEntry('boastRow'); const brag = api.getDefinitionQuizEntry('bragRow');
    assert.notEqual(boast.senseId, brag.senseId);
    assert.equal(api.shareDefinitionSynset(boast, brag), true);
    assert.equal(api.shareDefinitionSynset(boast, { ...brag, definition: 'possess an advantage' }), false);
    assert.equal(api.shareDefinitionSynset(boast, { ...brag, partOfSpeech: 'noun' }), false);
    assert.equal(api.shareDefinitionSynset(boast, { ...brag, synsetMembers: ['brag', 'flaunt'] }), false);
    const relation = api.getDefinitionRelationMeanings(boast, '긴 표제어 뜻을 복제하지 않는다').find(value => value.word === 'brag');
    assert.equal(relation.source, 'same-sense-vocab'); assert.equal(relation.meaning, '자랑하다');
  }],
  ['missing individual gloss never receives the headword definition', () => {
    const { SemanticRelationCluster } = load('components/semantic-relation-cluster.tsx');
    const html = render(React.createElement(SemanticRelationCluster, { headword: 'capricious', coreMeaningKo: '필요나 이성보다 변덕에 따라 좌우되는', showDefinitionBridge: false, exactSynonyms: ['unpredictable'], nearSynonyms: ['mercurial'] }));
    assert.match(html, /unpredictable/); assert.match(html, /mercurial/);
    assert.doesNotMatch(html, /필요나 이성보다|이 문맥에서는|한국어 뜻 검수 중/);
  }],
  ['short gloss stays intact; long explanation is retained only in details', () => {
    const { RelationChips } = load('components/relation-chips.tsx');
    const terms = [{ word: 'brag', meaningKo: '자랑하다' }, { word: 'flaunt', meaningKo: '과시하다' }, { word: 'vaunt', meaningKo: '자랑하다' }, { word: 'near', meaningKo: '긴 문맥 설명이다. 교체 조건과 다른 의미의 차이를 보존한다.' }];
    const closed = render(React.createElement(RelationChips, { terms }));
    assert.match(closed, /brag/); assert.match(closed, /자랑하다/); assert.match(closed, /과시하다/);
    assert.doesNotMatch(closed, /긴 문맥 설명이다/); assert.match(closed, /관계어 뜻·차이/);
    const details = render(React.createElement(RelationChips, { terms, showNotes: true }));
    assert.match(details, /긴 문맥 설명이다. 교체 조건과 다른 의미의 차이를 보존한다./);
  }],
  ['extra synonyms remain available through more instead of being cut at source', () => {
    const { RelationChips } = load('components/relation-chips.tsx');
    const html = render(React.createElement(RelationChips, { terms: ['a', 'b', 'c', 'd', 'e', 'hidden-sixth'].map(word => ({ word })) }));
    assert.doesNotMatch(html, /hidden-sixth/); assert.match(html, /더보기 · 1개/);
  }],
  ['web tab adds real safe-area once; zero inset keeps existing design', () => {
    const { getTabMetrics, SCROLL_END_PADDING } = load('lib/layout.ts');
    assert.equal(getTabMetrics(true, 0).height, 52);
    assert.equal(getTabMetrics(true, 34).height, 86);
    assert.equal(getTabMetrics(true, 34).paddingBottom, 36);
    assert.equal(getTabMetrics(false, 34).height, 90);
    assert.equal(getTabMetrics(true, NaN).height, 52);
    assert.equal(SCROLL_END_PADDING, 48);
  }],
  ['viewport follows toolbar/keyboard/rotation, ignores pinch zoom and cleans listeners', () => {
    const { subscribeWebViewport } = load('lib/web-viewport.ts');
    const listeners = new Map(); const tokens = new Map();
    const viewport = { height: 760, scale: 1, addEventListener: (name, cb) => listeners.set(`v:${name}`, cb), removeEventListener: name => listeners.delete(`v:${name}`) };
    const target = { visualViewport: viewport, innerHeight: 800, document: { documentElement: { style: {
      getPropertyValue: key => tokens.get(key) ?? '', setProperty: (key, value) => tokens.set(key, value), removeProperty: key => tokens.delete(key),
    } } }, addEventListener: (name, cb) => listeners.set(name, cb), removeEventListener: name => listeners.delete(name) };
    const release = subscribeWebViewport(target);
    assert.equal(tokens.get('--finetune-viewport-height'), '760px');
    for (const height of [500, 360, 820]) { viewport.height = height; listeners.get('v:resize')(); assert.equal(tokens.get('--finetune-viewport-height'), `${height}px`); }
    viewport.scale = 2; viewport.height = 100; listeners.get('v:resize')(); assert.equal(tokens.get('--finetune-viewport-height'), '820px');
    release(); assert.equal(listeners.size, 0); assert.equal(tokens.size, 0);
  }],
  ['existing dictionary examples and relations render only for the same stable sense', () => {
    const { DictionaryDefinition } = load('components/learning-details.tsx');
    const entry = { headword: 'fixture', status: 'single_sense', representativeSenseId: 'fixture:one', senses: [{ senseId: 'fixture:one', partOfSpeech: 'noun', definition: 'A fixture definition.' }] };
    const html = render(React.createElement(DictionaryDefinition, { entry, itemId: 'fixture-row' }));
    assert.match(html, /A fixture example/); assert.match(html, /equivalent/); assert.match(html, /CC BY 4.0/); assert.match(html, /Princeton WordNet/);
    const mismatched = { ...entry, senses: [{ ...entry.senses[0], senseId: 'fixture:other' }] };
    assert.doesNotMatch(render(React.createElement(DictionaryDefinition, { entry: mismatched, itemId: 'fixture-row' })), /A fixture example/);
    assert.doesNotMatch(render(React.createElement(DictionaryDefinition, { entry, itemId: 'unknown-row' })), /A fixture example/);
  }],
];
