import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const groups = ["V101", "V201", "V301", "V401", "V501", "V502", "V601", "APPENDIX"];
const expectedHash = "7d749f6e2c39e6970e4997839dcf6e42fd281f3c2fae0171d2192bae8cfa4b51";

const readJson = (relativePath) => JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
const vocab = readJson("assets/vocab-v1.4.json");
const meta = readJson("assets/vocab-definitions-oewn-2025.json");
const vocabIds = new Set(vocab.map((item) => item.id));
const seenIds = new Set();
const statusRows = new Map();

function fail(message) {
  throw new Error(message);
}

if (meta.version !== "oewn-2025") fail(`Unexpected definition version: ${meta.version}`);
if (meta.source?.archiveSha256 !== expectedHash) fail("OEWN archive hash is not pinned to the approved source");
if (meta.source?.license !== "CC BY 4.0") fail("OEWN license metadata is missing");

for (const group of groups) {
  const payload = readJson(`public/data/vocab-definitions/oewn-2025/${group.toLowerCase()}.json`);
  if (payload.group !== group || payload.version !== meta.version) {
    fail(`Definition group header mismatch: ${group}`);
  }
  if (payload.source?.archiveSha256 !== expectedHash) fail(`Definition source mismatch: ${group}`);

  for (const [itemId, key] of Object.entries(payload.items ?? {})) {
    if (!vocabIds.has(itemId)) fail(`Unknown vocabulary item in definition layer: ${itemId}`);
    if (seenIds.has(itemId)) fail(`Duplicate vocabulary item in definition layer: ${itemId}`);
    const sourceItem = vocab.find((item) => item.id === itemId);
    if (sourceItem?.group !== group) fail(`Definition item in wrong group: ${itemId}`);
    const record = payload.headwords?.[key];
    if (!record) fail(`Definition headword pointer is broken: ${itemId} -> ${key}`);
    const senses = Array.isArray(record.senses) ? record.senses : [];
    if (record.status === "single_sense" && senses.length !== 1) {
      fail(`single_sense must contain exactly one sense: ${itemId}`);
    }
    if (record.status === "dictionary_primary_unreviewed" && senses.length < 2) {
      fail(`ambiguous definition must contain at least two senses: ${itemId}`);
    }
    if (record.status === "dictionary_alias_unreviewed" && senses.length < 1) {
      fail(`alias definition must contain at least one sense: ${itemId}`);
    }
    if (record.status === "source_not_found" && senses.length !== 0) {
      fail(`source_not_found must not contain senses: ${itemId}`);
    }
    if (!["single_sense", "dictionary_primary_unreviewed", "dictionary_alias_unreviewed", "source_not_found"].includes(record.status)) {
      fail(`Unknown definition status: ${record.status}`);
    }
    if (record.status === "dictionary_alias_unreviewed") {
      const matches = Array.isArray(record.matches) ? record.matches : [];
      if (matches.length < 1 || matches.some((match) => !match.headword || match.matchType === "exact")) {
        fail(`Alias definition provenance is missing: ${itemId}`);
      }
    }
    if (senses.some((sense) => !sense.senseId || !sense.partOfSpeech || !sense.definition)) {
      fail(`Incomplete OEWN sense: ${itemId}`);
    }
    if (senses.length > 0 && record.representativeSenseId !== senses[0].senseId) {
      fail(`Representative sense is not deterministic dictionary order: ${itemId}`);
    }
    statusRows.set(record.status, (statusRows.get(record.status) ?? 0) + 1);
    seenIds.add(itemId);
  }
}

if (seenIds.size !== vocab.length) {
  const missing = [...vocabIds].filter((itemId) => !seenIds.has(itemId)).slice(0, 5);
  fail(`Definition layer does not cover every row: ${seenIds.size}/${vocab.length}; missing ${missing.join(", ")}`);
}

const coverage = meta.coverage;
if (coverage.totalRows !== vocab.length) fail("Definition metadata totalRows mismatch");
if ((statusRows.get("single_sense") ?? 0) !== coverage.singleSenseRows) fail("singleSenseRows mismatch");
if ((statusRows.get("dictionary_primary_unreviewed") ?? 0) !== coverage.ambiguousRows) fail("ambiguousRows mismatch");
if ((statusRows.get("dictionary_alias_unreviewed") ?? 0) !== coverage.aliasMatchedRows) fail("aliasMatchedRows mismatch");
if ((statusRows.get("source_not_found") ?? 0) !== coverage.sourceNotFoundRows) fail("sourceNotFoundRows mismatch");
if (coverage.matchedRows + coverage.sourceNotFoundRows !== coverage.totalRows) fail("Definition coverage arithmetic mismatch");

console.log(JSON.stringify({
  status: "PASS",
  version: meta.version,
  totalRows: seenIds.size,
  matchedRows: coverage.matchedRows,
  matchedRowPercent: coverage.matchedRowPercent,
  safeSingleSenseRows: coverage.singleSenseRows,
  ambiguousReviewRows: coverage.ambiguousRows,
  aliasReviewRows: coverage.aliasMatchedRows,
  sourceNotFoundRows: coverage.sourceNotFoundRows,
}, null, 2));
