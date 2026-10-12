import fs from "node:fs";
import path from "node:path";
import { scanPublicTextFile } from "./public-text-scan.mjs";

// Reports locations and categories only, never the matched secret or file text.
export function productionSecurityIssues(directory) {
  const findings = [];
  const walk = (folder) => {
    for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
      const absolute = path.join(folder, entry.name);
      const file = path.relative(directory, absolute).replaceAll("\\", "/");
      if (entry.isDirectory()) { walk(absolute); continue; }
      if (/(^|\/)(?:\.env(?:\.|$)|server\/|drizzle\/|\.git\/|.*credentials.*)|\.(?:map|pem|key|p12|pfx|sqlite3?|db|dump)$/i.test(file)) findings.push({ file, kind: "private artifact" });
      if (!/\.(?:html|js|css|json|txt|xml)$/.test(file)) continue;
      const scan = scanPublicTextFile(absolute);
      if (scan.secretPattern) findings.push({ file, kind: "secret pattern" });
      if (scan.serverConfiguration) findings.push({ file, kind: "server configuration" });
    }
  };
  walk(directory);
  return findings;
}
