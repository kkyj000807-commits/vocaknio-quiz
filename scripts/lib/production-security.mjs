import fs from "node:fs";
import path from "node:path";

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
      const text = fs.readFileSync(absolute, "utf8");
      if (/-----BEGIN [A-Z ]*PRIVATE KEY-----|\bghp_[A-Za-z0-9]{20,}\b|\bgithub_pat_[A-Za-z0-9_]{20,}\b|\bAKIA[0-9A-Z]{16}\b|\bxox[baprs]-[A-Za-z0-9-]{20,}\b|\bsk-[A-Za-z0-9]{20,}\b|\bAIza[0-9A-Za-z_-]{30,}\b/.test(text)) findings.push({ file, kind: "secret pattern" });
      if (/JWT_SECRET|DATABASE_URL|BUILT_IN_FORGE_API_KEY|OPENAI_API_KEY/.test(text)) findings.push({ file, kind: "server configuration" });
    }
  };
  walk(directory);
  return findings;
}
