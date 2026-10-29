const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { Buffer } = require("node:buffer");
const hash = bytes => crypto.createHash("sha256").update(bytes).digest("hex");

function verifyPersonalSnapshot(root, data, bytes) {
  if (data.schema !== 1 || data.requiresAccess !== true || !/^[a-f0-9]{64}$/.test(data.sourceSha256)
    || !Array.isArray(data.entries) || (data.retiredEntries !== undefined && !Array.isArray(data.retiredEntries))) {
    throw new Error("Invalid personal vocabulary manifest.");
  }
  const ids = new Set(), nums = new Set();
  for (const entry of [...data.entries, ...(data.retiredEntries ?? [])]) {
    if (typeof entry.id !== "string" || !Number.isSafeInteger(entry.num) || ids.has(entry.id) || nums.has(entry.num)) {
      throw new Error("Conflicting personal active/retired lookup identities.");
    }
    ids.add(entry.id); nums.add(entry.num);
  }
  const baselineHash = hash(fs.readFileSync(path.join(root, "assets/vocab-v1.4.json")));
  if (data.baselineSha256 !== baselineHash) throw new Error("Canonical vocabulary changed; reconcile the personal import first.");
  if (data.importVersion === undefined) {
    // V1 did not have a manifest, but its preserved app snapshot can still
    // detect a modified current before any legacy identity migration.
    const legacy = path.join(root, "analysis/personal-vocab", data.sourceSha256, "app-data.json");
    if (fs.existsSync(legacy) && !fs.readFileSync(legacy).equals(Buffer.from(bytes))) {
      throw new Error("Legacy personal snapshot/current mismatch; migration blocked.");
    }
    return;
  }
  if (data.importVersion !== 2) throw new Error("Unsupported personal vocabulary import version.");
  const snapshot = path.join(root, "analysis/personal-vocab", data.sourceSha256);
  const appSha256 = hash(bytes);
  const revision = path.join(snapshot, "imports", appSha256);
  const manifest = JSON.parse(fs.readFileSync(path.join(revision, "manifest.json"), "utf8"));
  if (manifest.schema !== 1 || manifest.importVersion !== 2
    || manifest.sourceSha256 !== data.sourceSha256 || manifest.baselineSha256 !== baselineHash
    || manifest.appSha256 !== appSha256 || manifest.entries !== data.entries.length
    || (manifest.retiredEntries ?? 0) !== (data.retiredEntries?.length ?? 0)
    || hash(fs.readFileSync(path.join(snapshot, "source.json"))) !== data.sourceSha256
    || hash(fs.readFileSync(path.join(revision, "app-data.json"))) !== appSha256
    || hash(fs.readFileSync(path.join(revision, "report.json"))) !== manifest.reportSha256) {
    throw new Error("Personal vocabulary snapshot/manifest hash mismatch; current preserved.");
  }
}

function readVerifiedPersonalVocabulary(root) {
  const file = path.join(root, "analysis/personal-vocab/current.json");
  const bytes = fs.readFileSync(file);
  const data = JSON.parse(bytes.toString("utf8"));
  verifyPersonalSnapshot(root, data, bytes);
  return { data, bytes, file };
}

// The public/default bundle always uses the empty, tracked placeholder.
function personalVocabPath(root, env = process.env) {
  if (env.FINETUNE_PERSONAL_VOCAB !== "1") return path.join(root, "assets/personal-vocab.json");
  if (env.FINETUNE_DEPLOY_TARGET !== "private") {
    throw new Error("Personal vocabulary requires FINETUNE_DEPLOY_TARGET=private; public bundling blocked.");
  }
  const file = path.join(root, "analysis/personal-vocab/current.json");
  if (!fs.existsSync(file)) throw new Error("Import the personal vocabulary before enabling it.");
  readVerifiedPersonalVocabulary(root);
  return file;
}

module.exports = { personalVocabPath, readVerifiedPersonalVocabulary, verifyPersonalSnapshot };
