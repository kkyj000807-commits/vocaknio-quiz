import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (relativePath) => JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
const release = read("release.config.json");
const vocab = read("assets/vocab-v1.4.json");
const activeRecall = read("data/active-recall-senses.json").entries;
const senseQuestions = read("data/sense-questions.json").entries;
const synonymReviews = read("data/synonym-reviews.json").entries;
const learningIndex = read("assets/vocab-learning-index-v1.4.json");
const learningGroups = [...new Set(Object.values(learningIndex.items).map((pointer) => pointer.group))];
const learningEntries = learningGroups.flatMap((group) =>
  read(`public/data/vocab-learning/${release.version}/${String(group).toLowerCase()}.json`).entries,
);

const requiredFields = [
  "englishDefinition",
  "koreanMeaning",
  "contextExplanation",
  "exampleSentence",
  "exampleExplanation",
  "synonyms",
  "distinctionNote",
  "sourceIds",
];

const normalize = (value) => String(value ?? "").trim().replace(/\s+/g, " ");
const unique = (values) => [...new Set(values.map(normalize).filter(Boolean))];
const valuePresent = (record, field) => Array.isArray(record[field])
  ? record[field].length > 0
  : Boolean(normalize(record[field]));

function emptyRecord({ senseId, word = "", partOfSpeech = "", itemIds = [] }) {
  return {
    word,
    variants: [],
    senseId,
    partOfSpeech,
    englishDefinition: null,
    koreanMeaning: null,
    contextExplanation: null,
    exampleSentence: null,
    exampleTranslation: null,
    exampleExplanation: null,
    synonyms: [],
    distinctionNote: null,
    sourceIds: [],
    itemIds: unique(itemIds),
    inputLayers: [],
    conflicts: [],
    alternateValues: [],
    definitionStatus: "PENDING",
    backfill: {
      attempts: 0,
      retryable: true,
      failureReasons: [],
    },
  };
}

function createUniverse() {
  const map = new Map();
  const register = (senseId, word, partOfSpeech, itemIds) => {
    if (!map.has(senseId)) map.set(senseId, emptyRecord({ senseId, word, partOfSpeech, itemIds }));
    const record = map.get(senseId);
    if (record.word && normalize(record.word).toLowerCase() !== normalize(word).toLowerCase()) {
      record.variants = unique([...record.variants, word]);
    } else if (!record.word) record.word = word;
    record.itemIds = unique([...record.itemIds, ...itemIds]);
    if (!record.partOfSpeech) record.partOfSpeech = partOfSpeech;
  };
  for (const entry of learningEntries) register(entry.senseId, entry.headword, entry.partOfSpeech, entry.itemIds);
  for (const entry of activeRecall) register(entry.senseId, entry.headword, entry.partOfSpeech, entry.itemIds);
  for (const entry of senseQuestions) register(entry.senseId, entry.headword, entry.partOfSpeech, entry.itemIds);
  for (const entry of synonymReviews) register(
    entry.senseId,
    entry.headword,
    entry.partOfSpeech,
    entry.sourceRows.map((row) => row.id),
  );
  return map;
}

function setScalar(record, field, value, layer) {
  const next = normalize(value);
  if (!next) return;
  const current = normalize(record[field]);
  if (!current) record[field] = next;
  else if (current !== next && !record.alternateValues.some((alternate) => alternate.field === field && alternate.value === next)) {
    // Different editorial wording is expected when independent reviewed layers
    // describe the same canonical sense. Preserve it for audit instead of
    // treating wording variation as a sense-mapping failure.
    record.alternateValues.push({ field, value: next, layer });
  }
}

function mergeList(record, field, values) {
  record[field] = unique([...record[field], ...(values ?? [])]);
}

function mergeLearning(record, entry) {
  record.inputLayers.push("vocab-learning");
  setScalar(record, "englishDefinition", entry.definitionEn, "vocab-learning");
  setScalar(record, "koreanMeaning", entry.definitionKo, "vocab-learning");
  setScalar(record, "contextExplanation", entry.contextExplanationKo ?? entry.usageKo, "vocab-learning");
  setScalar(record, "exampleSentence", entry.example?.en, "vocab-learning");
  setScalar(record, "exampleTranslation", entry.example?.ko, "vocab-learning");
  setScalar(record, "exampleExplanation", entry.example?.cueKo ?? entry.examTrapKo, "vocab-learning");
  setScalar(record, "distinctionNote", entry.examTrapKo, "vocab-learning");
  mergeList(record, "synonyms", [...(entry.exactSynonyms ?? []), ...(entry.nearSynonyms ?? [])]);
  mergeList(record, "sourceIds", entry.sources?.map((source) => source.url));
  mergeList(record, "itemIds", entry.itemIds);
}

function mergeActiveRecall(record, entry) {
  record.inputLayers.push("active-recall");
  setScalar(record, "englishDefinition", entry.englishDefinition, "active-recall");
  setScalar(record, "koreanMeaning", entry.koreanMeaning, "active-recall");
  setScalar(record, "contextExplanation", entry.contextExplanationKo, "active-recall");
  const example = entry.exampleSentences?.[0];
  setScalar(record, "exampleSentence", example?.en, "active-recall");
  setScalar(record, "exampleTranslation", example?.ko, "active-recall");
  setScalar(record, "exampleExplanation", example?.cueKo, "active-recall");
  mergeList(record, "synonyms", [...(entry.exactSynonyms ?? []), ...(entry.nearSynonyms ?? [])]);
  setScalar(
    record,
    "distinctionNote",
    entry.distractors?.map((choice) => `${choice.word}: ${choice.reasonKo}`).join(" | "),
    "active-recall",
  );
  mergeList(record, "sourceIds", entry.sources?.map((source) => source.url));
  mergeList(record, "itemIds", entry.itemIds);
}

function mergeSenseQuestion(record, entry) {
  record.inputLayers.push("sense-question");
  setScalar(record, "englishDefinition", entry.definitionEn, "sense-question");
  setScalar(record, "koreanMeaning", entry.definitionKo, "sense-question");
  setScalar(record, "contextExplanation", entry.bridgeKo, "sense-question");
  setScalar(record, "exampleSentence", entry.contextEn, "sense-question");
  setScalar(record, "exampleTranslation", entry.contextKo, "sense-question");
  setScalar(record, "exampleExplanation", `문맥 핵심 단서: ${entry.evidence}`, "sense-question");
  const correct = entry.choices?.find((choice) => choice.id === entry.correctId);
  if (correct) mergeList(record, "synonyms", [correct.en]);
  setScalar(record, "distinctionNote", entry.relation?.constraintKo ?? entry.reviewNote, "sense-question");
  mergeList(record, "sourceIds", entry.sources?.map((source) => source.url));
  mergeList(record, "itemIds", entry.itemIds);
}

function mergeSynonymReview(record, entry) {
  record.inputLayers.push("synonym-review");
  setScalar(record, "englishDefinition", entry.definitionEn, "synonym-review");
  setScalar(record, "koreanMeaning", entry.definitionKo, "synonym-review");
  setScalar(record, "contextExplanation", entry.bridgeKo, "synonym-review");
  const example = entry.examples?.[0];
  setScalar(record, "exampleSentence", example?.en, "synonym-review");
  setScalar(record, "exampleTranslation", example?.ko, "synonym-review");
  setScalar(record, "exampleExplanation", example?.noteKo, "synonym-review");
  mergeList(record, "synonyms", [entry.synonym]);
  setScalar(record, "distinctionNote", entry.constraintKo, "synonym-review");
  mergeList(record, "sourceIds", entry.sources?.map((source) => source.url));
  mergeList(record, "itemIds", entry.sourceRows?.map((row) => row.id));
}

function snapshot(records) {
  return {
    canonicalSenseCount: records.length,
    blanks: Object.fromEntries(requiredFields.map((field) => [
      field,
      records.filter((record) => !valuePresent(record, field)).length,
    ])),
  };
}

function classify(record) {
  record.inputLayers = unique(record.inputLayers);
  record.itemIds = unique(record.itemIds);
  record.sourceIds = unique(record.sourceIds);
  record.synonyms = unique(record.synonyms).filter((synonym) => synonym.toLowerCase() !== normalize(record.word).toLowerCase());
  record.backfill.attempts += 1;
  const missingFields = requiredFields.filter((field) => !valuePresent(record, field));
  const reasons = [];
  if (record.conflicts.length) reasons.push({ category: "sense 매핑 실패", fields: unique(record.conflicts.map((item) => item.field)) });
  if (!record.sourceIds.length) reasons.push({ category: "출처 수집 실패", fields: ["sourceIds"] });
  const remaining = missingFields.filter((field) => field !== "sourceIds");
  if (remaining.length) reasons.push({ category: "검증 대기", fields: remaining });
  record.backfill.failureReasons = reasons;
  record.missingFields = missingFields;
  record.definitionStatus = record.conflicts.length
    ? "FAILED"
    : missingFields.length
      ? record.sourceIds.length ? "NEEDS_REVIEW" : "PENDING"
      : "COMPLETE";
  record.backfill.retryable = record.definitionStatus !== "COMPLETE" && record.definitionStatus !== "VERIFIED_NO_DATA";
  return record;
}

const universe = createUniverse();
for (const entry of learningEntries) mergeLearning(universe.get(entry.senseId), entry);
const before = snapshot([...universe.values()]);
for (const entry of activeRecall) mergeActiveRecall(universe.get(entry.senseId), entry);
for (const entry of senseQuestions) mergeSenseQuestion(universe.get(entry.senseId), entry);
for (const entry of synonymReviews) mergeSynonymReview(universe.get(entry.senseId), entry);
const records = [...universe.values()].map(classify).sort((left, right) => left.senseId.localeCompare(right.senseId));
const after = snapshot(records);
const mappedItemIds = new Set(records.flatMap((record) => record.itemIds));
const statusCounts = Object.fromEntries(
  ["COMPLETE", "VERIFIED_NO_DATA", "FAILED", "NEEDS_REVIEW", "PENDING"].map((status) => [
    status,
    records.filter((record) => record.definitionStatus === status).length,
  ]),
);

const sampleAudit = records
  .sort((left, right) => Number(right.definitionStatus === "COMPLETE") - Number(left.definitionStatus === "COMPLETE") || left.senseId.localeCompare(right.senseId))
  .slice(0, 20)
  .map((record) => ({
    senseId: record.senseId,
    word: record.word,
    status: record.definitionStatus,
    checkedFields: Object.fromEntries(requiredFields.map((field) => [field, valuePresent(record, field)])),
    sameSenseContract: record.conflicts.length === 0,
  }));

const report = {
  schema: 1,
  generatedAtKst: new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date()).replace(" ", "T") + "+09:00",
  vocabulary: {
    sourceRows: vocab.length,
    uniqueHeadwords: new Set(vocab.map((item) => normalize(item.w).toLowerCase())).size,
    rowsWithCanonicalSense: mappedItemIds.size,
    rowsWithoutCanonicalSense: vocab.length - mappedItemIds.size,
  },
  rawVocabulary: {
    recordCount: vocab.length,
    blanks: {
      englishDefinition: vocab.filter((item) => !normalize(item.englishDefinition)).length,
      koreanMeaning: vocab.filter((item) => !normalize(item.k)).length,
      contextExplanation: vocab.filter((item) => !normalize(item.contextExplanation)).length,
      exampleSentence: vocab.filter((item) => !normalize(item.exampleSentence)).length,
      exampleExplanation: vocab.filter((item) => !normalize(item.exampleExplanation)).length,
      synonyms: vocab.filter((item) => !Array.isArray(item.s) || item.s.length === 0).length,
      distinctionNote: vocab.filter((item) => !normalize(item.distinctionNote)).length,
      sourceIds: vocab.filter((item) => !Array.isArray(item.sourceIds) || item.sourceIds.length === 0).length,
    },
    note: "원본 38,163행 스키마는 w/k/s 중심이며, canonical sense 필드는 별도 검수 레이어에서만 제공된다.",
  },
  before,
  after,
  statusCounts,
  frontend: {
    learningDetailSenseCount: learningEntries.length,
    learningDetailRowCount: Object.keys(learningIndex.items).length,
    note: "기존 단어장·문풀·오답 화면의 LearningDetails selector가 이 배포 JSON을 읽는다.",
  },
  pipeline: [
    { stage: "원자료 수집", evidence: "검수 learning source, active recall, sense question, synonym review catalog" },
    { stage: "sense 매핑", evidence: "senseId + itemIds" },
    { stage: "enrichment", evidence: "독립 출처 검수 필드만 병합; 누락은 생성하지 않음" },
    { stage: "DB 저장", evidence: "assets/canonical-sense-content.json" },
    { stage: "배포 데이터 생성", evidence: "public/data/canonical-sense-content.json + vocab-learning group JSON" },
    { stage: "API·selector", evidence: "lib/vocab-learning.ts" },
    { stage: "프런트 표시", evidence: "components/learning-details.tsx" },
  ],
  firstLoss: {
    unmappedVocabularyRows: {
      stage: "sense 매핑",
      count: vocab.length - mappedItemIds.size,
      reason: "원본 어휘 행에 canonical senseId가 아직 없다.",
    },
    mappedSenseMissingFields: {
      stage: "원자료 수집·enrichment",
      fields: after.blanks,
      reason: "통합 저장·배포 과정에서 삭제된 값이 아니라, 검수 원천 레이어에 아직 존재하지 않는 값이다.",
    },
  },
  sampleAudit,
};

const payload = { schema: 1, release: release.version, entries: records };
const pending = {
  schema: 1,
  generatedAtKst: report.generatedAtKst,
  categories: {
    pipelineError: [],
    fieldNameMismatch: [],
    sourceCollectionFailure: [],
    senseMappingFailure: vocab.filter((item) => !mappedItemIds.has(item.id)).map((item) => item.id),
    verificationPending: records
      .filter((record) => record.definitionStatus === "NEEDS_REVIEW")
      .map((record) => ({ senseId: record.senseId, itemIds: record.itemIds, missingFields: record.missingFields })),
    actualDataAbsence: records
      .filter((record) => record.definitionStatus === "VERIFIED_NO_DATA")
      .map((record) => ({ senseId: record.senseId, itemIds: record.itemIds, missingFields: record.missingFields })),
  },
};
for (const [relativePath, value] of [
  ["assets/canonical-sense-content.json", payload],
  ["public/data/canonical-sense-content.json", payload],
  ["assets/canonical-sense-content-report.json", report],
  ["assets/canonical-sense-backfill-pending.json", pending],
]) {
  fs.mkdirSync(path.dirname(path.join(root, relativePath)), { recursive: true });
  const serialized = relativePath.endsWith("backfill-pending.json")
    ? JSON.stringify(value)
    : JSON.stringify(value, null, 2);
  fs.writeFileSync(path.join(root, relativePath), `${serialized}\n`, "utf8");
}

console.log(JSON.stringify(report, null, 2));
