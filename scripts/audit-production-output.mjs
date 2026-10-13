import fs from "node:fs";
import path from "node:path";
import { productionSecurityIssues } from "./lib/production-security.mjs";
import { isReleaseMetadataValid } from "./lib/release-metadata.mjs";
import { scanPublicTextFile } from "./lib/public-text-scan.mjs";

const outputRoot = process.argv[2];
if (!outputRoot || !fs.existsSync(outputRoot)) {
  throw new Error("사용법: node scripts/audit-production-output.mjs <Production 출력 폴더>");
}

const prefix = "/vocaknio-quiz/";
const files = [];
const collect = (directory) => {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) collect(fullPath);
    else files.push(fullPath);
  }
};
collect(outputRoot);

const htmlFiles = files.filter((file) => file.endsWith(".html"));
const textFiles = files.filter((file) => /\.(?:html|js|css|json)$/.test(file));
const missing = new Set();
let rootExpoReferences = 0;
let rootAssetReferences = 0;

for (const file of textFiles) {
  const scan = scanPublicTextFile(file);
  rootExpoReferences += scan.rootExpoReferences;
  rootAssetReferences += scan.rootAssetReferences;
  if (!file.endsWith(".html")) continue;
  const text = fs.readFileSync(file, "utf8");
  for (const match of text.matchAll(/(?:src|href)="([^"]+)"/g)) {
    const url = match[1];
    if (!url.startsWith(prefix)) continue;
    const relativePath = decodeURIComponent(url.slice(prefix.length).split(/[?#]/)[0]);
    if (relativePath && !fs.existsSync(path.join(outputRoot, relativePath))) missing.add(relativePath);
  }
}

const release = JSON.parse(fs.readFileSync(path.join(outputRoot, "release.json"), "utf8"));
const releaseMetadataValid = isReleaseMetadataValid(release);
const learningDirectory = releaseMetadataValid
  ? path.join(outputRoot, "data", "vocab-learning", release.learningDataVersion)
  : null;
const learningFiles = learningDirectory && fs.existsSync(learningDirectory)
  ? fs.readdirSync(learningDirectory).filter((name) => name.endsWith(".json"))
  : [];
let learningPayloadsMatch = learningFiles.length === 8;
const recordingEntries = [];
for (const name of learningFiles) {
  try {
    const payload = JSON.parse(fs.readFileSync(path.join(learningDirectory, name), "utf8"));
    learningPayloadsMatch &&= payload?.version === release.learningDataVersion && Array.isArray(payload.entries);
    if (Array.isArray(payload.entries)) for (const entry of payload.entries) if (entry.audio) recordingEntries.push({ audio: entry.audio });
  } catch { learningPayloadsMatch = false; }
}
const recordingMetadataValid = recordingEntries.every(({ audio }) => {
  try {
    return audio.region === "US" && audio.source === "Wikimedia Commons" &&
      new URL(audio.url).protocol === "https:" && new URL(audio.url).hostname === "upload.wikimedia.org" &&
      new URL(audio.sourcePage).protocol === "https:" && new URL(audio.sourcePage).hostname === "commons.wikimedia.org" &&
      typeof audio.license === "string" && /^(?:CC0|CC BY(?:-SA)? [1-4]\.0|Public domain)$/i.test(audio.license) &&
      typeof audio.attribution === "string" && !!audio.attribution.trim();
  } catch { return false; }
});
const definitionDirectory = path.join(outputRoot, "data", "vocab-definitions", "oewn-2025");
const definitionFiles = fs.existsSync(definitionDirectory)
  ? fs.readdirSync(definitionDirectory).filter((name) => name.endsWith(".json"))
  : [];
const indexHtml = fs.readFileSync(path.join(outputRoot, "index.html"), "utf8");
const bundleUrl = indexHtml.match(/src="\/vocaknio-quiz\/([^\"]*entry-[a-f0-9]+\.js)"/)?.[1];
const bundle = bundleUrl ? path.join(outputRoot, ...bundleUrl.split("/")) : undefined;
const bundleScan = bundle ? scanPublicTextFile(bundle, { needles: ["vocab-learning", "vocab-definitions", "speechSynthesis", "voiceURI", "preferRecording"] }) : { found: {}, authDiagnostics: false };
const securityIssues = productionSecurityIssues(outputRoot);
const pagesStaticServing = fs.existsSync(path.join(outputRoot, ".nojekyll")) &&
  fs.statSync(path.join(outputRoot, ".nojekyll")).isFile();
const authDiagnosticsInCurrentBundle = bundleScan.authDiagnostics;
const result = {
  status:
    pagesStaticServing && missing.size === 0 &&
    securityIssues.length === 0 && !authDiagnosticsInCurrentBundle &&
    releaseMetadataValid &&
    rootExpoReferences === 0 &&
    rootAssetReferences === 0 &&
    learningPayloadsMatch &&
    definitionFiles.length === 8 &&
    bundleScan.found["vocab-learning"] &&
    bundleScan.found["vocab-definitions"] &&
    recordingMetadataValid &&
    bundleScan.found.speechSynthesis && bundleScan.found.voiceURI && bundleScan.found.preferRecording
      ? "pass"
      : "fail",
  release,
  releaseMetadataValid,
  pagesStaticServing,
  securityIssues,
  authDiagnosticsInCurrentBundle,
  htmlFiles: htmlFiles.length,
  missingReferences: [...missing],
  rootExpoReferences,
  rootAssetReferences,
  learningFiles: learningFiles.length,
  learningPayloadsMatch,
  recordingMetadataValid,
  licensedAmericanRecordingUrls: new Set(recordingEntries.map(entry => entry.audio.url)).size,
  definitionFiles: definitionFiles.length,
  learningUiInBundle: !!bundleScan.found["vocab-learning"],
  definitionUiInBundle: !!bundleScan.found["vocab-definitions"],
  americanPronunciationInBundle:
    !!(bundleScan.found.speechSynthesis && bundleScan.found.voiceURI && bundleScan.found.preferRecording),
  bundle: bundle ? path.basename(bundle) : null,
};
console.log(JSON.stringify(result, null, 2));
if (result.status !== "pass") process.exit(1);
