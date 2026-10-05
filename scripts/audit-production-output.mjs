import fs from "node:fs";
import path from "node:path";
import { productionSecurityIssues } from "./lib/production-security.mjs";

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
  const text = fs.readFileSync(file, "utf8");
  rootExpoReferences += (text.match(/["'=]\/_expo\//g) ?? []).length;
  rootAssetReferences += (text.match(/["'=]\/assets\//g) ?? []).length;
  if (!file.endsWith(".html")) continue;
  for (const match of text.matchAll(/(?:src|href)="([^"]+)"/g)) {
    const url = match[1];
    if (!url.startsWith(prefix)) continue;
    const relativePath = decodeURIComponent(url.slice(prefix.length).split(/[?#]/)[0]);
    if (relativePath && !fs.existsSync(path.join(outputRoot, relativePath))) missing.add(relativePath);
  }
}

const release = JSON.parse(fs.readFileSync(path.join(outputRoot, "release.json"), "utf8"));
const releaseMetadataValid = /^[a-f0-9]{40}$/.test(release.sourceCommit ?? "") &&
  typeof release.sourceDirty === "boolean" && typeof release.dataVersion === "string" &&
  Number.isFinite(Date.parse(release.builtAt)) && release.learningDataVersion === release.version &&
  release.channel === "production" && release.target === `${release.version}|${release.modifiedAtKst}`;
const learningDirectory = path.join(outputRoot, "data", "vocab-learning", release.version);
const learningFiles = fs.existsSync(learningDirectory)
  ? fs.readdirSync(learningDirectory).filter((name) => name.endsWith(".json"))
  : [];
const definitionDirectory = path.join(outputRoot, "data", "vocab-definitions", "oewn-2025");
const definitionFiles = fs.existsSync(definitionDirectory)
  ? fs.readdirSync(definitionDirectory).filter((name) => name.endsWith(".json"))
  : [];
const indexHtml = fs.readFileSync(path.join(outputRoot, "index.html"), "utf8");
const bundleUrl = indexHtml.match(/src="\/vocaknio-quiz\/([^\"]*entry-[a-f0-9]+\.js)"/)?.[1];
const bundle = bundleUrl ? path.join(outputRoot, ...bundleUrl.split("/")) : undefined;
const bundleText = bundle ? fs.readFileSync(bundle, "utf8") : "";
const securityIssues = productionSecurityIssues(outputRoot);
const authDiagnosticsInCurrentBundle = /\[API\] Full URL:|\[API\] Response headers:|\[Auth\] Setting session token|\[OAuth\] Params received:/.test(bundleText);
const result = {
  status:
    missing.size === 0 &&
    securityIssues.length === 0 && !authDiagnosticsInCurrentBundle &&
    releaseMetadataValid &&
    rootExpoReferences === 0 &&
    rootAssetReferences === 0 &&
    learningFiles.length === 8 &&
    definitionFiles.length === 8 &&
    bundleText.includes("vocab-learning") &&
    bundleText.includes("vocab-definitions") &&
    bundleText.includes("Wikimedia Commons") &&
    bundleText.includes("speechSynthesis")
      ? "pass"
      : "fail",
  release,
  releaseMetadataValid,
  securityIssues,
  authDiagnosticsInCurrentBundle,
  htmlFiles: htmlFiles.length,
  missingReferences: [...missing],
  rootExpoReferences,
  rootAssetReferences,
  learningFiles: learningFiles.length,
  definitionFiles: definitionFiles.length,
  learningUiInBundle: bundleText.includes("vocab-learning"),
  definitionUiInBundle: bundleText.includes("vocab-definitions"),
  americanPronunciationInBundle:
    bundleText.includes("Wikimedia Commons") && bundleText.includes("speechSynthesis"),
  bundle: bundle ? path.basename(bundle) : null,
};
console.log(JSON.stringify(result, null, 2));
if (result.status !== "pass") process.exit(1);
