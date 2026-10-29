import fs from "node:fs";
import path from "node:path";
import { scanPublicTextFile } from "./public-text-scan.mjs";

// Reports locations and categories only, never the matched secret or file text.
export function productionSecurityIssues(directory) {
  const findings = [];
  let privateRelease = false;
  const releasePath = path.join(directory, "release.json");
  if (fs.existsSync(releasePath)) {
    try {
      const release = JSON.parse(fs.readFileSync(releasePath, "utf8"));
      privateRelease = release.requiresAccess === true && release.distribution === "owner-only" &&
        release.personalVocabulary?.studyOnly === true && /^[a-f0-9]{64}$/.test(release.personalVocabulary?.sha256 ?? "");
    } catch { /* Invalid manifests are rejected by the release audit. */ }
  }
  const privateMarker = "FINETUNE_PERSONAL_CONTENT_PRIVATE_ONLY";
  const walk = (folder) => {
    for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
      const absolute = path.join(folder, entry.name);
      const file = path.relative(directory, absolute).replaceAll("\\", "/");
      if (entry.isDirectory()) { walk(absolute); continue; }
      // Expo keeps package names in emitted font/icon paths. Permit only its
      // fingerprinted binary assets, not dependencies or original source files.
      const vendorBinary = /^assets\/node_modules\/.+\.[a-f0-9]{32}(?:@\dx)?\.(?:png|jpe?g|gif|webp|ttf|otf|woff2?)$/i.test(file);
      const dependencySource = /(^|\/)node_modules\//i.test(file) && !vendorBinary;
      if (dependencySource || /(^|\/)(?:\.env(?:\.|$)|(?:server|drizzle|\.git|analysis|backups?|tests?|scripts|docs)\/|.*credentials.*)|\.(?:map|pem|key|p12|pfx|sqlite3?|db|dump|sql|bak|backup|zip|7z|tar|gz|tsx?|py|toml)$/i.test(file)) findings.push({ file, kind: "private artifact" });
      if (!/\.(?:html|js|css|json|txt|xml)$/.test(file)) continue;
      const scan = scanPublicTextFile(absolute, { needles: [privateMarker] });
      if (scan.found[privateMarker] && !privateRelease) findings.push({ file, kind: "personal content requires owner-only release" });
      if (scan.secretPattern) findings.push({ file, kind: "secret pattern" });
      if (scan.serverConfiguration) findings.push({ file, kind: "server configuration" });
      if (scan.sourceMapReference) findings.push({ file, kind: "source map reference" });
    }
  };
  walk(directory);
  return findings;
}
