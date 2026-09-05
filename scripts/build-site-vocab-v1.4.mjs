import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { applyIdiomCorrections, loadIdiomCorrections, isMissingMeaning } from "./lib/idiom-corrections.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUTPUT_ROOT = path.join(ROOT, "output");
const LEGACY_VOCAB_PATH = path.join(ROOT, "assets", "vocab.json");
const VOCAB_OUTPUT_PATH = path.join(ROOT, "assets", "vocab-v1.4.json");
const META_OUTPUT_PATH = path.join(ROOT, "assets", "vocab-meta-v1.4.json");
const EXPECTED_ENTRY_COUNT = 38_163;
const SEMANTIC_GROUPS = new Set(["V301", "V502"]);
const GROUP_ORDER = [
  "V101",
  "V201",
  "V301",
  "V401",
  "V501",
  "V502",
  "V601",
  "APPENDIX",
];

const GROUP_LABELS = {
  V101: "V101 핵심 어휘",
  V201: "V201 심화 어휘",
  V301: "V301 의미·대조",
  V401: "V401 고급 어휘",
  V501: "V501 데일리 어휘",
  V502: "V502 동의어 핵심",
  V601: "V601 최상위 어휘",
  APPENDIX: "파이널 보카니오 부록",
};

// These rules only remove links that are unsafe for the Korean meaning shown on
// the same row. They intentionally operate after the two-source pair check so a
// useful sense of a polysemous word can remain available on its own rows.
const SYNONYM_SENSE_RULES = [
  {
    id: "appropriate-adjective-sense",
    word: "appropriate",
    triggerSynonyms: ["apposite"],
    requiredMeaningFragments: ["적절", "적합", "타당", "알맞"],
  },
  {
    id: "benign-beneficial-sense",
    word: "benign",
    triggerSynonyms: ["profitable"],
    requiredMeaningFragments: ["유익", "이익", "이로운", "유리", "도움", "좋은"],
  },
  {
    id: "smolder-restriction-sense",
    word: "smolder",
    triggerSynonyms: ["restrict"],
    requiredMeaningFragments: ["제한", "억제", "보류", "제약"],
  },
  {
    id: "explicit-ending-sense",
    word: "explicit",
    triggerSynonyms: ["coda"],
    requiredMeaningFragments: ["종결", "끝", "完", "대미", "결말", "마지막"],
  },
  {
    id: "envoy-ending-sense",
    word: "envoy",
    triggerSynonyms: ["coda"],
    requiredMeaningFragments: ["종결", "끝", "完", "대미", "결말", "마지막"],
  },
  {
    id: "effeminate-part-of-speech",
    word: "effeminate",
    triggerSynonyms: ["weaken"],
  },
  {
    id: "refrain-verb-sense",
    word: "refrain",
    triggerSynonyms: ["abstain"],
    requiredMeaningFragments: ["삼가", "자제", "절제", "그만두", "하지 않고", "참다"],
  },
  {
    id: "carnage-noun-only",
    word: "carnage",
    allowedSynonyms: ["holocaust", "massacre"],
  },
];

function walkForFiles(root, predicate) {
  const queue = [root];
  const matches = [];
  const skippedDirs = new Set([
    "300dpi_대표페이지",
    "IPA_QA",
    "qa",
    "rendered",
    "archive",
    "source_pages_flattened",
  ]);

  while (queue.length > 0) {
    const current = queue.shift();
    let entries;
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (!skippedDirs.has(entry.name)) queue.push(fullPath);
      } else if (predicate(fullPath, entry.name)) {
        matches.push(fullPath);
      }
    }
  }

  return matches;
}

function findReleaseFiles() {
  const manifests = walkForFiles(
    OUTPUT_ROOT,
    (fullPath, name) =>
      name.includes("v1.4") &&
      name.endsWith("manifest.jsonl") &&
      fs.statSync(fullPath).size > 5_000_000,
  );

  for (const manifestPath of manifests) {
    const firstLine = fs.readFileSync(manifestPath, "utf8").split(/\r?\n/, 1)[0];
    if (!firstLine.includes('"source_index"') || !firstLine.includes('"meaning_exact"')) {
      continue;
    }

    const releaseRoot = path.dirname(path.dirname(manifestPath));
    const releaseManifestPath = path.join(releaseRoot, "00_RELEASE_MANIFEST_v1.4.json");
    if (fs.existsSync(releaseManifestPath)) {
      return { manifestPath, releaseManifestPath };
    }
  }

  throw new Error("v1.4 final layout manifest was not found under output/");
}

function loadJsonLines(filePath) {
  return fs
    .readFileSync(filePath, "utf8")
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function sourceHash(rows) {
  const digest = crypto.createHash("sha256");
  for (const row of rows) {
    const payload = [
      row.source_index ?? null,
      row.row_id ?? null,
      row.kind ?? null,
      row.group ?? null,
      row.number ?? null,
      row.word ?? null,
      row.ipa ?? null,
      row.meaning_exact ?? null,
      row.source_reference ?? null,
    ];
    digest.update(`${JSON.stringify(payload)}\n`, "utf8");
  }
  return digest.digest("hex");
}

function pairKey(a, b) {
  return a < b ? `${a}\u0000${b}` : `${b}\u0000${a}`;
}

function normalizeWord(value) {
  return String(value ?? "").trim().toLowerCase();
}

function normalizeMeaning(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/[^a-z가-힣]+/g, " ")
    .trim();
}

function meaningTokens(value) {
  return new Set(
    normalizeMeaning(value)
      .split(/\s+/)
      .filter((token) => token.length > 1),
  );
}

function applySynonymSenseRules(siteItems) {
  const ruleStats = new Map(
    SYNONYM_SENSE_RULES.map((rule) => [rule.id, { affectedRows: 0, removedLinks: 0 }]),
  );
  let blockedEntryCount = 0;

  const guardedItems = siteItems.map((item) => {
    const normalizedWord = normalizeWord(item.w);
    let synonyms = [...item.s];

    for (const rule of SYNONYM_SENSE_RULES) {
      if (normalizedWord !== rule.word) continue;
      if (
        rule.triggerSynonyms &&
        !rule.triggerSynonyms.some((synonym) => synonyms.includes(synonym))
      ) {
        continue;
      }
      if (
        rule.requiredMeaningFragments?.some((fragment) => item.k.includes(fragment))
      ) {
        continue;
      }

      const before = synonyms.length;
      if (rule.allowedSynonyms) {
        const allowed = new Set(rule.allowedSynonyms);
        synonyms = synonyms.filter((synonym) => allowed.has(synonym));
      } else {
        synonyms = [];
      }
      if (before === synonyms.length) continue;

      const stat = ruleStats.get(rule.id);
      stat.affectedRows += 1;
      stat.removedLinks += before - synonyms.length;
    }

    if (item.s.length > 0 && synonyms.length === 0) blockedEntryCount += 1;
    return { ...item, s: synonyms };
  });

  const rawLinkedSynonymCount = siteItems.reduce((sum, item) => sum + item.s.length, 0);
  const linkedSynonymCount = guardedItems.reduce((sum, item) => sum + item.s.length, 0);
  return {
    items: guardedItems,
    report: {
      version: "v1",
      ruleCount: SYNONYM_SENSE_RULES.length,
      rawSynonymEntryCount: siteItems.filter((item) => item.s.length > 0).length,
      rawLinkedSynonymCount,
      blockedEntryCount,
      removedLinkCount: rawLinkedSynonymCount - linkedSynonymCount,
      linkedSynonymCount,
      rules: SYNONYM_SENSE_RULES.map((rule) => ({
        id: rule.id,
        ...ruleStats.get(rule.id),
      })),
    },
  };
}

function auditSamePromptConflicts(siteItems) {
  const grouped = new Map();
  for (const item of siteItems) {
    if (item.s.length === 0) continue;
    const key = `${normalizeWord(item.w)}\u0000${normalizeMeaning(item.k)}`;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(item);
  }

  let groupCount = 0;
  let affectedRowCount = 0;
  let disjointGroupCount = 0;
  for (const items of grouped.values()) {
    const signatures = [
      ...new Map(
        items.map((item) => {
          const words = [...item.s].map(normalizeWord).sort();
          return [words.join("\u0000"), new Set(words)];
        }),
      ).values(),
    ];
    if (signatures.length <= 1) continue;

    groupCount += 1;
    affectedRowCount += items.length;
    let hasDisjointPair = false;
    for (let left = 0; left < signatures.length && !hasDisjointPair; left += 1) {
      for (let right = left + 1; right < signatures.length; right += 1) {
        if (![...signatures[left]].some((word) => signatures[right].has(word))) {
          hasDisjointPair = true;
          break;
        }
      }
    }
    if (hasDisjointPair) disjointGroupCount += 1;
  }

  return { groupCount, affectedRowCount, disjointGroupCount };
}

function meaningScore(meaning, sense) {
  const normalized = normalizeMeaning(meaning);
  const variants = [...sense.ownMeanings, sense.cluster.label].map(normalizeMeaning);
  if (variants.includes(normalized)) return 1_000;

  const sourceTokens = meaningTokens(normalized);
  let best = 0;
  for (const variant of variants) {
    if (!variant) continue;
    if (normalized.includes(variant) || variant.includes(normalized)) best = Math.max(best, 100);

    const targetTokens = meaningTokens(variant);
    let overlap = 0;
    for (const token of sourceTokens) {
      if (targetTokens.has(token)) overlap += 1;
    }
    const denominator = Math.max(1, Math.min(sourceTokens.size, targetTokens.size));
    best = Math.max(best, (overlap * 10) / denominator);
  }
  return best;
}

function buildSemanticModel(rows) {
  const clusters = [];
  const clustersById = new Map();
  const directConceptByRowId = new Map();
  let currentGroup = "";
  let major = null;
  let minor = null;

  for (const row of rows) {
    if (row.group !== currentGroup) {
      currentGroup = row.group;
      major = null;
      minor = null;
    }
    if (!SEMANTIC_GROUPS.has(row.group)) continue;

    if (row.kind === "section") {
      major = null;
      minor = null;
      continue;
    }

    if (row.kind === "note") {
      if (/^\d+\./.test(row.word)) {
        major = { id: row.row_id, label: row.word };
        minor = null;
      } else {
        minor = { id: row.row_id, label: row.word };
      }
      continue;
    }

    if (row.kind !== "entry" || !major) continue;

    const concept = minor ?? major;
    let cluster = clustersById.get(concept.id);
    if (!cluster) {
      cluster = {
        id: concept.id,
        label: concept.label,
        majorId: major.id,
        majorLabel: major.label,
        group: row.group,
        items: [],
        words: new Set(),
      };
      clustersById.set(cluster.id, cluster);
      clusters.push(cluster);
    }
    cluster.items.push(row);
    cluster.words.add(normalizeWord(row.word));
    directConceptByRowId.set(row.row_id, cluster.id);
  }

  const pairSupport = new Map();
  for (const cluster of clusters) {
    const words = [...cluster.words];
    for (let left = 0; left < words.length; left += 1) {
      for (let right = left + 1; right < words.length; right += 1) {
        const key = pairKey(words[left], words[right]);
        if (!pairSupport.has(key)) pairSupport.set(key, new Set());
        pairSupport.get(key).add(cluster.group);
      }
    }
  }

  const isConfirmedPair = (left, right) => {
    const support = pairSupport.get(pairKey(left, right));
    return Boolean(support?.has("V301") && support?.has("V502"));
  };

  const sensesByWord = new Map();
  for (const cluster of clusters) {
    for (const word of cluster.words) {
      const synonyms = [...cluster.words]
        .filter((candidate) => candidate !== word && isConfirmedPair(word, candidate))
        .sort();
      if (synonyms.length === 0) continue;

      const ownMeanings = [
        ...new Set(
          cluster.items
            .filter((item) => normalizeWord(item.word) === word)
            .map((item) => item.meaning_exact),
        ),
      ];
      const sense = { cluster, synonyms, ownMeanings };
      if (!sensesByWord.has(word)) sensesByWord.set(word, []);
      sensesByWord.get(word).push(sense);
    }
  }

  function pickSense(row) {
    const word = normalizeWord(row.word);
    const senses = sensesByWord.get(word) ?? [];
    if (senses.length === 0) return null;

    const directConceptId = directConceptByRowId.get(row.row_id);
    if (directConceptId) {
      const directSense = senses.find((sense) => sense.cluster.id === directConceptId);
      if (directSense) return directSense;
    }

    const bestBySignature = new Map();
    for (const sense of senses) {
      const signature = sense.synonyms.join("\u0000");
      const score = meaningScore(row.meaning_exact, sense);
      const previous = bestBySignature.get(signature);
      if (!previous || score > previous.score) bestBySignature.set(signature, { sense, score });
    }

    const ranked = [...bestBySignature.values()].sort((left, right) => right.score - left.score);
    if (ranked.length === 1) return ranked[0].sense;
    if (ranked[0].score > 0 && ranked[0].score > ranked[1].score) return ranked[0].sense;
    return null;
  }

  return { clusters, pickSense, pairSupport };
}

function buildLegacyMap(legacyItems, siteItems) {
  const newItemsByWord = new Map();
  for (const item of siteItems) {
    const key = normalizeWord(item.w);
    if (!newItemsByWord.has(key)) newItemsByWord.set(key, []);
    newItemsByWord.get(key).push(item);
  }

  const mapping = {};
  const unresolved = [];
  for (const legacy of legacyItems) {
    const candidates = newItemsByWord.get(normalizeWord(legacy.w)) ?? [];
    if (candidates.length === 0) {
      unresolved.push(legacy.num);
      continue;
    }

    const normalizedLegacyMeaning = normalizeMeaning(legacy.k);
    const exact = candidates.filter(
      (candidate) => normalizeMeaning(candidate.k) === normalizedLegacyMeaning,
    );
    if (exact.length > 0) {
      mapping[legacy.num] = exact[0].num;
      continue;
    }

    const legacyTokens = meaningTokens(legacy.k);
    const ranked = candidates
      .map((candidate) => {
        const candidateTokens = meaningTokens(candidate.k);
        let overlap = 0;
        for (const token of legacyTokens) {
          if (candidateTokens.has(token)) overlap += 1;
        }
        return { candidate, overlap };
      })
      .sort((left, right) => right.overlap - left.overlap);

    if (ranked[0]?.overlap > 0 && (ranked.length === 1 || ranked[0].overlap > ranked[1].overlap)) {
      mapping[legacy.num] = ranked[0].candidate.num;
    } else if (candidates.length === 1) {
      mapping[legacy.num] = candidates[0].num;
    } else {
      unresolved.push(legacy.num);
    }
  }

  return { mapping, unresolved };
}

function validate(siteItems, meta) {
  if (siteItems.length !== EXPECTED_ENTRY_COUNT) {
    throw new Error(`Expected ${EXPECTED_ENTRY_COUNT} entries, got ${siteItems.length}`);
  }
  if (new Set(siteItems.map((item) => item.id)).size !== siteItems.length) {
    throw new Error("Duplicate row_id detected in generated vocabulary");
  }
  if (new Set(siteItems.map((item) => item.num)).size !== siteItems.length) {
    throw new Error("Duplicate num detected in generated vocabulary");
  }

  for (const item of siteItems) {
    if (!item.w || isMissingMeaning(item.k) || !item.group) {
      throw new Error(`Missing required data for ${item.id}`);
    }
    if (item.s.includes(normalizeWord(item.w))) {
      throw new Error(`Self-synonym detected for ${item.id}`);
    }
    if (new Set(item.s).size !== item.s.length) {
      throw new Error(`Duplicate synonyms detected for ${item.id}`);
    }
  }

  const sectionTotal = meta.sections.reduce((total, section) => total + section.count, 0);
  if (sectionTotal !== EXPECTED_ENTRY_COUNT) {
    throw new Error(`Section count mismatch: ${sectionTotal}`);
  }
}

function main() {
  const checkOnly = process.argv.includes("--check");
  const { manifestPath, releaseManifestPath } = findReleaseFiles();
  const rows = loadJsonLines(manifestPath);
  const release = JSON.parse(fs.readFileSync(releaseManifestPath, "utf8"));
  const computedHash = sourceHash(rows);

  if (computedHash !== release.corrected_source_sha256) {
    throw new Error(
      `Final source hash mismatch: expected ${release.corrected_source_sha256}, got ${computedHash}`,
    );
  }

  const entries = rows.filter((row) => row.kind === "entry");
  const semantic = buildSemanticModel(rows);
  const rawSiteItems = entries.map((row, index) => {
    const sense = semantic.pickSense(row);
    return {
      num: index + 1,
      id: row.row_id,
      sourceIndex: row.source_index,
      sourceNumber: row.number,
      w: row.word.trim(),
      k: row.meaning_exact.trim(),
      p: row.ipa?.trim() ?? "",
      group: row.group,
      conceptId: sense?.cluster.id ?? "",
      conceptLabel: sense?.cluster.label ?? "",
      majorConceptLabel: sense?.cluster.majorLabel ?? "",
      s: sense?.synonyms ?? [],
    };
  });
  const corrections = loadIdiomCorrections(ROOT);
  applyIdiomCorrections(rawSiteItems, corrections);
  const guarded = applySynonymSenseRules(rawSiteItems);
  const siteItems = guarded.items;
  const samePromptConflicts = auditSamePromptConflicts(siteItems);

  const sections = GROUP_ORDER.map((group) => {
    const items = siteItems.filter((item) => item.group === group);
    const start = items.length > 0 ? items[0].num - 1 : 0;
    const end = items.length > 0 ? items.at(-1).num - 1 : -1;
    return { id: group.toLowerCase(), group, label: GROUP_LABELS[group], start, end, count: items.length };
  }).filter((section) => section.count > 0);

  const concepts = semantic.clusters.map((cluster) => ({
    id: cluster.id,
    group: cluster.group,
    label: cluster.label,
    majorLabel: cluster.majorLabel,
    words: [...cluster.words].sort(),
  }));

  const legacyItems = JSON.parse(fs.readFileSync(LEGACY_VOCAB_PATH, "utf8"));
  const legacy = buildLegacyMap(legacyItems, siteItems);
  const mappedWithSynonyms = siteItems.filter((item) => item.s.length > 0);
  const groupCounts = Object.fromEntries(sections.map((section) => [section.group, section.count]));
  const meta = {
    version: "v1.4",
    sourceRows: rows.length,
    sourceEntries: entries.length,
    sourceSha256: computedHash,
    releaseSourceSha256: release.corrected_source_sha256,
    editorialCorrections: {
      checkedAtKst: corrections.checkedAtKst,
      rows: corrections.entries.reduce((sum, entry) => sum + entry.targets.length, 0),
      sha256: crypto.createHash("sha256").update(JSON.stringify(corrections)).digest("hex"),
    },
    groupCounts,
    sections,
    concepts,
    confirmedPairCount: [...semantic.pairSupport.values()].filter(
      (support) => support.has("V301") && support.has("V502"),
    ).length,
    synonymEntryCount: mappedWithSynonyms.length,
    semanticGuard: {
      ...guarded.report,
      samePromptConflicts,
    },
    legacyMigration: {
      sourceCount: legacyItems.length,
      mappedCount: Object.keys(legacy.mapping).length,
      unresolvedCount: legacy.unresolved.length,
      numMap: legacy.mapping,
      unresolvedNums: legacy.unresolved,
    },
  };

  validate(siteItems, meta);

  if (checkOnly) {
    const currentItems = JSON.parse(fs.readFileSync(VOCAB_OUTPUT_PATH, "utf8"));
    const currentMeta = JSON.parse(fs.readFileSync(META_OUTPUT_PATH, "utf8"));
    if (JSON.stringify(currentItems) !== JSON.stringify(siteItems)) {
      throw new Error("Generated vocabulary differs from assets/vocab-v1.4.json");
    }
    if (JSON.stringify(currentMeta) !== JSON.stringify(meta)) {
      throw new Error("Generated metadata differs from assets/vocab-meta-v1.4.json");
    }
  } else {
    fs.writeFileSync(VOCAB_OUTPUT_PATH, JSON.stringify(siteItems), "utf8");
    fs.writeFileSync(META_OUTPUT_PATH, `${JSON.stringify(meta, null, 2)}\n`, "utf8");
  }

  console.log(
    JSON.stringify(
      {
        mode: checkOnly ? "check" : "write",
        manifestPath,
        output: checkOnly ? [] : [VOCAB_OUTPUT_PATH, META_OUTPUT_PATH],
        sourceRows: rows.length,
        sourceEntries: entries.length,
        groupCounts,
        confirmedPairCount: meta.confirmedPairCount,
        synonymEntryCount: meta.synonymEntryCount,
        semanticGuard: meta.semanticGuard,
        legacyMapped: meta.legacyMigration.mappedCount,
        legacyUnresolved: meta.legacyMigration.unresolvedCount,
        sourceSha256: computedHash,
      },
      null,
      2,
    ),
  );
}

main();
