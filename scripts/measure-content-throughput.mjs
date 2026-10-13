import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { performance } from "node:perf_hooks";
import { createRequire } from "node:module";
import { canonicalMissingFields } from "./lib/canonical-content-contract.mjs";

const normalize = value => String(value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
const present = value => typeof value === "string" && Boolean(value.trim());
const digest = value => crypto.createHash("sha256").update(value).digest("hex");
const strata = ["single-sense-candidate", "polysemous-candidate", "idiom-or-phrase"];

export function contentStratum(headword, dictionaryRecords) {
  // The app's word/idiom/phrase split starts with whitespace. This is a sample
  // stratum, not a claim that every multiword term is an idiom.
  if (/\s/.test(headword.trim())) return "idiom-or-phrase";
  const ids = new Set(dictionaryRecords.flatMap(record => record?.senses?.map(sense => sense.senseId) ?? []));
  if (dictionaryRecords.length && dictionaryRecords.every(record => record?.status === "single_sense") && ids.size === 1) return "single-sense-candidate";
  if (ids.size > 1 || dictionaryRecords.some(record => record?.status === "dictionary_primary_unreviewed")) return "polysemous-candidate";
  return "unresolved-mapping";
}

export function selectContentBatch(headwords, batchIndex = 0) {
  if (!Number.isInteger(batchIndex) || batchIndex < 0) throw new Error("batch-index must be a non-negative integer");
  const quotas = [34, 33, 33];
  return strata.flatMap((stratum, index) => headwords.filter(entry => entry.stratum === stratum)
    .sort((left, right) => digest(left.headword).localeCompare(digest(right.headword)))
    .slice(batchIndex * quotas[index], (batchIndex + 1) * quotas[index]));
}

export function privateMeasurementOutput(root, requested) {
  if (!requested) throw new Error("--output analysis/qa/<name>.json is required");
  const boundary = path.resolve(root, "analysis", "qa");
  const output = path.resolve(root, requested);
  const relative = path.relative(boundary, output);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative) || path.extname(output).toLowerCase() !== ".json") {
    throw new Error("Measurement output must be a JSON file inside this worktree's analysis/qa directory");
  }
  for (let current = output; current !== root; current = path.dirname(current)) {
    if (fs.existsSync(current) && fs.lstatSync(current).isSymbolicLink()) throw new Error("Measurement output cannot use symbolic links");
    if (path.dirname(current) === current) throw new Error("Measurement output escaped the worktree");
  }
  return output;
}

export function checkpointUnchanged(previous, inputHash, batchIndex) {
  return previous?.schema === 1 && previous.status === "MEASURED"
    && previous.inputHash === inputHash && previous.batchIndex === batchIndex;
}

function indexByRows(entries, ids = entry => entry.itemIds ?? []) {
  const map = new Map();
  for (const entry of entries) for (const id of ids(entry)) {
    const group = map.get(id) ?? [];
    group.push(entry);
    map.set(id, group);
  }
  return map;
}

// Mirror the lightweight JSON gate in lib/vocab-learning.ts. This does not
// replace its runtime tests or certify the inherited semantic-review claim.
function learningEntryAccepted(entry) {
  return Boolean(entry.id && entry.senseId && entry.headword && entry.definitionEn
    && entry.definitionStatus === "production" && entry.definitionKo && entry.contextExplanationKo
    && present(entry.example?.en) && present(entry.example?.ko)
    && (entry.example.cueKo === undefined || present(entry.example.cueKo))
    && entry.verification?.status === "cross-agreed" && Array.isArray(entry.itemIds) && Array.isArray(entry.sources));
}

export function measureContent(inputs, batchIndex = 0) {
  const { vocab, definitionGroups, definitionQuiz, canonical, activeRecall, learningEntries, learningIndexItems, senseQuestions = [] } = inputs;
  const dictionaryByRow = new Map();
  for (const group of definitionGroups) for (const [id, key] of Object.entries(group.items)) dictionaryByRow.set(id, group.headwords[key]);
  const canonicalByRow = indexByRows(canonical);
  const activeByRow = indexByRows(activeRecall.filter(entry => entry.status === "production" && entry.quality !== "C"));
  const senseByRow = indexByRows(senseQuestions.filter(entry => entry.status === "production" && entry.quality !== "C"));
  const acceptedLearning = learningEntries.filter(learningEntryAccepted);
  const exportedLearningByRow = indexByRows(acceptedLearning);
  const learningByRow = new Map();
  let brokenLearningPointers = 0;
  for (const [id, pointer] of Object.entries(learningIndexItems)) {
    const matching = (exportedLearningByRow.get(id) ?? [])
      .filter(entry => entry.exportGroup === pointer.group && pointer.entryIds.includes(entry.id));
    if (matching.length !== pointer.entryIds.length) brokenLearningPointers += 1;
    if (matching.length) learningByRow.set(id, matching);
  }
  const groups = new Map();
  for (const row of vocab) {
    const key = normalize(row.w);
    const rows = groups.get(key) ?? [];
    rows.push(row);
    groups.set(key, rows);
  }
  const headwords = [...groups].map(([headword, rows]) => {
    const dictionary = rows.map(row => dictionaryByRow.get(row.id));
    const senses = [...new Map(rows.flatMap(row => canonicalByRow.get(row.id) ?? []).map(entry => [entry.senseId, entry])).values()];
    const active = rows.flatMap(row => activeByRow.get(row.id) ?? []);
    const learning = rows.flatMap(row => learningByRow.get(row.id) ?? []);
    const questions = rows.flatMap(row => senseByRow.get(row.id) ?? []);
    const oewnQuiz = rows.map(row => definitionQuiz.entries[definitionQuiz.items[row.id]]).filter(Boolean);
    const examples = [...active.flatMap(entry => entry.exampleSentences ?? []), ...learning.map(entry => entry.example).filter(Boolean),
      ...questions.map(entry => ({ en: entry.contextEn, ko: entry.contextKo, cueKo: entry.evidence }))];
    const hasEnglishExample = examples.some(example => present(example.en)) || oewnQuiz.some(entry => entry.examples?.some(present));
    const hasBilingualCueTuple = examples.some(example => present(example.en) && present(example.ko) && present(example.cueKo))
      || learning.some(entry => present(entry.example?.en) && present(entry.example?.ko) && present(entry.example?.cueKo ?? entry.examTrapKo));
    const deliveryPaths = [...new Set([...rows.map(row => activeByRow.has(row.id) ? "active-recall-detail"
      : learningByRow.has(row.id) ? "vocab-learning-detail"
        : dictionaryByRow.get(row.id)?.senses?.length ? "dictionary-definition-fallback" : "original-korean-meaning-only"),
    ...(questions.length ? ["sense-question-answer"] : []), ...(oewnQuiz.length ? ["oewn-definition-answer"] : [])])];
    const missingFields = [];
    if (!rows.every(row => present(row.k))) missingFields.push("originalKoreanMeaning");
    if (!hasEnglishExample) missingFields.push("englishExample");
    if (!hasBilingualCueTuple) missingFields.push("same-source-English-Korean-cue-tuple");
    if (!senses.length) missingFields.push("canonicalSenseMapping");
    const canonicalMissing = senses.map(entry => ({ senseId: entry.senseId, fields: canonicalMissingFields(entry) }));
    return {
      headword,
      stratum: contentStratum(headword, dictionary),
      occurrenceIds: rows.map(row => row.id),
      sections: [...new Set(rows.map(row => row.group))].sort(),
      originalMeaningVariants: new Set(rows.map(row => normalize(row.k))).size,
      hasEnglishExample,
      hasBilingualCueTuple,
      missingFields,
      canonicalMissing,
      inheritedCanonicalStatuses: senses.map(entry => ({ senseId: entry.senseId, status: entry.definitionStatus })),
      deliveryPaths,
      runtimeDelivery: "NOT_VERIFIED",
      // All active canonical senses must be structurally complete; field
      // completeness never certifies the unreviewed dictionary senses.
      structuralPass: missingFields.length === 0 && canonicalMissing.every(entry => entry.fields.length === 0),
      newSemanticReviews: 0,
    };
  });
  const batch = selectContentBatch(headwords, batchIndex);
  // Full occurrence audit, not just the 100-item stratified sample. Reuse exact
  // existing dictionary pointers; no word-level sense inference or content writes.
  const sections = new Map();
  const referenceRows = [];
  const wordbookBefore = new Set();
  const wordbookAfter = new Set();
  const relationClusters = new Map();
  for (const row of vocab) {
    const section = sections.get(row.group) ?? { sourceRows: 0, headwords: new Set(), definitionRows: 0,
      legacySynonymRows: 0, reviewedRelationRows: 0, englishExampleRows: 0, bilingualExampleRows: 0,
      reusableDictionaryExampleRows: 0, reusableDictionaryRelationRows: 0, relationRowsWithShortKoreanGloss: 0 };
    section.sourceRows++;
    section.headwords.add(normalize(row.w));
    const dictionary = dictionaryByRow.get(row.id);
    if (dictionary?.senses?.length) section.definitionRows++;
    if (row.s?.length) section.legacySynonymRows++;
    const active = activeByRow.get(row.id) ?? [];
    const learning = learningByRow.get(row.id) ?? [];
    const questions = senseByRow.get(row.id) ?? [];
    if (active.some(entry => entry.exactSynonyms?.length || entry.nearSynonyms?.length) || questions.some(entry => entry.relation)) section.reviewedRelationRows++;
    const examples = [...active.flatMap(entry => entry.exampleSentences ?? []), ...learning.map(entry => entry.example),
      ...questions.map(entry => ({ en: entry.contextEn, ko: entry.contextKo }))].filter(Boolean);
    const reference = definitionQuiz.entries[definitionQuiz.items[row.id]];
    const matched = reference && dictionary?.senses?.some(sense => sense.senseId === reference.senseId);
    const hasReferenceExample = Boolean(matched && reference.examples?.some(present));
    const hasReferenceRelation = Boolean(matched && (reference.synsetMembers?.some(word => normalize(word) !== normalize(row.w)) || reference.antonyms?.length));
    const relationGlosses = matched && inputs.relationLookup ? inputs.relationLookup(row) : undefined;
    if (relationGlosses && !relationClusters.has(reference.senseId)) relationClusters.set(reference.senseId, {
      headword: reference.headword, senseId: reference.senseId, partOfSpeech: reference.partOfSpeech, relations: relationGlosses,
    });
    if (relationGlosses?.some(relation => relation.shortGloss)) section.relationRowsWithShortKoreanGloss++;
    const oldExamples = active.length ? active.flatMap(entry => entry.exampleSentences ?? []) : learning.map(entry => entry.example);
    if (oldExamples.some(example => present(example?.en))) wordbookBefore.add(row.id);
    if (examples.some(example => present(example?.en)) || hasReferenceExample) wordbookAfter.add(row.id);
    if (examples.some(example => present(example.en)) || hasReferenceExample) section.englishExampleRows++;
    if (examples.some(example => present(example.en) && present(example.ko))) section.bilingualExampleRows++;
    if (hasReferenceExample) section.reusableDictionaryExampleRows++;
    if (hasReferenceRelation) section.reusableDictionaryRelationRows++;
    if (hasReferenceExample || hasReferenceRelation) referenceRows.push({ itemId: row.id, headword: row.w, group: row.group,
      senseId: reference.senseId, partOfSpeech: reference.partOfSpeech,
      examples: hasReferenceExample, relations: hasReferenceRelation,
      source: "assets/vocab-definition-quiz-oewn-2025.json", license: "CC BY 4.0",
      disposition: "dictionary-reference-only", semanticPromotion: false,
      ...(relationGlosses ? { relationClusterKey: reference.senseId } : {}) });
    sections.set(row.group, section);
  }
  return {
    coverage: {
      normalizedHeadwords: headwords.length,
      sourceOccurrences: vocab.length,
      duplicateOccurrenceIds: vocab.length - new Set(vocab.map(row => row.id)).size,
      brokenLearningPointers,
      rejectedLearningExportEntries: learningEntries.length - acceptedLearning.length,
      byStratum: Object.fromEntries([...strata, "unresolved-mapping"].map(stratum => [stratum, headwords.filter(entry => entry.stratum === stratum).length])),
      headwordsWithAnyEnglishExample: headwords.filter(entry => entry.hasEnglishExample).length,
      headwordsWithAnyBilingualCueTuple: headwords.filter(entry => entry.hasBilingualCueTuple).length,
      headwordsWithAnyCanonicalSense: headwords.filter(entry => entry.canonicalMissing.length > 0).length,
      headwordsMissingAnyOriginalKoreanMeaning: headwords.filter(entry => entry.missingFields.includes("originalKoreanMeaning")).length,
      unknownMappingHeadwordsRemainInDenominator: true,
      scope: "any-existing-example-is-not-every-sense-complete-or-semantically-reviewed",
      dictionarySenseIds: new Set([...dictionaryByRow.values()].flatMap(entry => entry.senses?.map(sense => sense.senseId) ?? [])).size,
      canonicalSenseIds: new Set(canonical.map(entry => entry.senseId)).size,
      bySection: Object.fromEntries([...sections].map(([group, value]) => [group, { ...value, headwords: value.headwords.size }])),
    },
    dictionaryReuse: { rows: referenceRows.length, uniqueHeadwords: new Set(referenceRows.map(row => normalize(row.headword))).size,
      exampleRows: referenceRows.filter(row => row.examples).length,
      exampleHeadwords: new Set(referenceRows.filter(row => row.examples).map(row => normalize(row.headword))).size,
      relationRows: referenceRows.filter(row => row.relations).length,
      shortGlossRows: referenceRows.filter(row => relationClusters.get(row.senseId)?.relations.some(relation => relation.shortGloss)).length,
      shortGlossRelations: [...relationClusters.values()].reduce((count, cluster) => count + cluster.relations.filter(relation => relation.shortGloss).length, 0),
      glossAudit: inputs.relationLookup ? "runtime-data-linkage-audited-not-new-semantic-review" : "NOT_VERIFIED",
      clusters: [...relationClusters.values()],
      pendingGlossQueue: [...relationClusters.values()].flatMap(cluster => cluster.relations.filter(relation => !relation.shortGloss)
        .map(relation => ({ headword: cluster.headword, senseId: cluster.senseId, partOfSpeech: cluster.partOfSpeech,
          relation: relation.word, reason: relation.source === "shared-sense-core" ? "individual-gloss-missing-or-conflicting" : "sense-or-Korean-gloss-needs-review",
          resumeKey: digest(`${cluster.senseId}\0${relation.word}`), disposition: "needs-review" }))),
      manifest: referenceRows, runtimeDelivery: "NOT_VERIFIED", newSemanticReviewPass: 0 },
    wordbookDelivery: { beforeExampleRows: wordbookBefore.size, afterReachableExampleRows: wordbookAfter.size,
      beforeExampleHeadwords: new Set(vocab.filter(row => wordbookBefore.has(row.id)).map(row => normalize(row.w))).size,
      afterReachableExampleHeadwords: new Set(vocab.filter(row => wordbookAfter.has(row.id)).map(row => normalize(row.w))).size,
      note: "Code-path reachability only; not browser/device verification or new semantic review. Original content unchanged." },
    fullHeldQueue: headwords.filter(entry => entry.missingFields.length || entry.canonicalMissing.some(sense => sense.fields.length))
      .map(entry => ({ headword: entry.headword, occurrenceIds: entry.occurrenceIds, stratum: entry.stratum,
        reasons: entry.missingFields, canonicalMissing: entry.canonicalMissing, disposition: "needs-review", resumeKey: digest(entry.headword) })),
    batch: {
      requestedHeadwords: 100,
      selectedHeadwords: batch.length,
      byStratum: Object.fromEntries(strata.map(stratum => [stratum, batch.filter(entry => entry.stratum === stratum).length])),
      structuralPass: batch.filter(entry => entry.structuralPass).length,
      structuralHeld: batch.filter(entry => !entry.structuralPass).length,
      newSemanticReviewPass: 0,
      candidates: batch,
      heldQueue: batch.map(entry => ({ headword: entry.headword, occurrenceIds: entry.occurrenceIds,
        reasons: [...entry.missingFields, ...entry.canonicalMissing.filter(value => value.fields.length).map(value => `${value.senseId}: ${value.fields.join(", ")}`),
          "No new semantic review performed by this measurement", "Runtime delivery not tested by this measurement"] })),
    },
  };
}

export function runContentMeasurement(root, outputArgument, batchIndex = 0, { runtimeRelations = false } = {}) {
  if (!fs.statSync(path.join(root, ".git")).isFile()) throw new Error("Run only in an isolated Git worktree");
  const output = privateMeasurementOutput(root, outputArgument);
  if (!Number.isInteger(batchIndex) || batchIndex < 0) throw new Error("Invalid batch index");
  const started = performance.now();
  const read = relative => JSON.parse(fs.readFileSync(path.join(root, relative), "utf8"));
  const release = read("release.config.json");
  const index = read("assets/vocab-learning-index-v1.4.json");
  const metadata = read("assets/vocab-definitions-oewn-2025.json");
  const definitionPaths = Object.keys(metadata.groupRows).sort().map(group => `public/data/vocab-definitions/${metadata.version}/${group.toLowerCase()}.json`);
  const learningPaths = [...new Set(Object.values(index.items).map(pointer => pointer.group))].sort()
    .map(group => `public/data/vocab-learning/${index.version}/${group.toLowerCase()}.json`);
  const files = ["release.config.json", "assets/vocab-v1.4.json", "assets/vocab-learning-index-v1.4.json",
    "assets/vocab-definitions-oewn-2025.json", "assets/vocab-definition-quiz-oewn-2025.json", "assets/canonical-sense-content.json",
    "data/active-recall-senses.json", "data/sense-questions.json", "scripts/measure-content-throughput.mjs", "scripts/lib/canonical-content-contract.mjs",
    "components/learning-details.tsx", "components/active-recall-card.tsx", "components/relation-chips.tsx", "components/semantic-relation-cluster.tsx", "components/synonym-details.tsx",
    "app/(tabs)/wordbook.tsx", "lib/vocab.ts", "lib/semantic-cluster.ts", "lib/vocab-learning.ts", "lib/quiz-engine.ts",
    "lib/active-recall.ts", "lib/sense-questions.ts", "lib/vocab-definitions.ts", "lib/definition-quiz.ts",
    ...definitionPaths, ...learningPaths].sort();
  const inputHashes = Object.fromEntries(files.map(file => [file, digest(fs.readFileSync(path.join(root, file)))]));
  const inputHash = digest(JSON.stringify({ inputHashes, runtimeRelations }));
  const previous = fs.existsSync(output) ? JSON.parse(fs.readFileSync(output, "utf8")) : null;
  if (checkpointUnchanged(previous, inputHash, batchIndex)) return { status: "NO_CHANGE", inputHash, batchIndex, checkpoint: path.relative(root, output), newSemanticReviewPass: 0 };
  let relationLookup;
  if (runtimeRelations) {
    // Use the actual app linkage code, not an audit's reimplementation. Existing
    // tsx dependency only; no install, learner storage, answer changes or promotion.
    const require = createRequire(import.meta.url);
    require("tsx/cjs");
    const api = require(path.join(root, "lib/definition-quiz.ts"));
    const presentation = require(path.join(root, "lib/semantic-cluster.ts"));
    const cache = new Map();
    relationLookup = row => {
      const entry = api.getDefinitionQuizEntry(row.id);
      if (!entry) return [];
      if (!cache.has(entry.headword)) cache.set(entry.headword, api.getDefinitionRelationMeanings(entry, "").map(relation => ({
        word: relation.word, source: relation.source,
        shortGloss: relation.source === "same-sense-vocab" || relation.source === "linked-antonym-vocab"
          ? presentation.shortRelationGloss(relation.meaning) ?? null : null,
        status: "existing-source-link-not-new-editorial-review",
      })));
      return cache.get(entry.headword);
    };
  }
  const profile = measureContent({ relationLookup, vocab: read("assets/vocab-v1.4.json"), definitionGroups: definitionPaths.map(read),
    definitionQuiz: read("assets/vocab-definition-quiz-oewn-2025.json"), canonical: read("assets/canonical-sense-content.json").entries,
    activeRecall: read("data/active-recall-senses.json").entries, senseQuestions: read("data/sense-questions.json").entries,
    learningIndexItems: index.items,
    learningEntries: learningPaths.flatMap(file => {
      const payload = read(file);
      if (payload.version !== index.version) throw new Error("Learning export version mismatch");
      return payload.entries.map(entry => ({ ...entry, exportGroup: payload.group }));
    }) }, batchIndex);
  const elapsedMs = Math.max(1, performance.now() - started);
  const report = { schema: 1, status: "MEASURED", measuredAt: new Date().toISOString(), release: release.version,
    inputHash, inputHashes, batchIndex, ...profile, throughput: {
      elapsedMs: Math.round(elapsedMs), measuredHeadwordsPerHour: Math.round(profile.coverage.normalizedHeadwords * 3600000 / elapsedMs),
      structuralPassCandidatesPerHour: Math.round(profile.batch.structuralPass * 3600000 / elapsedMs),
      newlySemanticallyReviewedPerHour: 0,
      note: "Local structural measurement speed only; not content generation/review speed or a completion forecast.",
    }, restrictions: ["No content generation or source editing", "No learner data access", "No semantic promotion", "No runtime UI certification"] };
  fs.mkdirSync(path.dirname(output), { recursive: true });
  const temporary = `${output}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(report, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
  fs.renameSync(temporary, output);
  return { status: report.status, inputHash, batchIndex, checkpoint: path.relative(root, output), coverage: report.coverage,
    dictionaryReuse: { ...report.dictionaryReuse, manifest: undefined, clusters: undefined, pendingGlossQueue: undefined,
      pendingGlossRelations: report.dictionaryReuse.pendingGlossQueue.length }, wordbookDelivery: report.wordbookDelivery, heldHeadwords: report.fullHeldQueue.length,
    batch: { selectedHeadwords: report.batch.selectedHeadwords, structuralPass: report.batch.structuralPass,
      structuralHeld: report.batch.structuralHeld, newSemanticReviewPass: 0 }, throughput: report.throughput };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const outputIndex = args.indexOf("--output");
  const batchIndex = args.indexOf("--batch-index");
  try {
    const result = runContentMeasurement(process.cwd(), outputIndex < 0 ? undefined : args[outputIndex + 1], batchIndex < 0 ? 0 : Number(args[batchIndex + 1]), { runtimeRelations: args.includes("--runtime-relations") });
    console.log(JSON.stringify(result, null, 2));
  } catch {
    // Do not echo malformed file content, learner values or local exception text.
    console.error("Content measurement failed. Check isolated worktree, --output analysis/qa/<name>.json and input contracts.");
    process.exitCode = 1;
  }
}
