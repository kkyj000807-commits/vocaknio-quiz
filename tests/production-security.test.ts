import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, expect, it } from "vitest";
import { productionSecurityIssues } from "../scripts/lib/production-security.mjs";

const folders: string[] = [];
afterEach(() => { for (const folder of folders.splice(0)) fs.rmSync(folder, { recursive: true }); });
function fixture() { const folder = fs.mkdtempSync(path.join(os.tmpdir(), "finetune-security-")); folders.push(folder); return folder; }
it("blocks secrets, environment files, server code and source maps without printing values", () => {
  const folder = fixture();
  const sentinel = "ghp_" + "Q".repeat(36);
  fs.writeFileSync(path.join(folder, "entry.js"), sentinel);
  fs.writeFileSync(path.join(folder, ".env"), "private fixture");
  fs.mkdirSync(path.join(folder, "server"));
  fs.writeFileSync(path.join(folder, "server", "index.js"), "export {}");
  fs.writeFileSync(path.join(folder, "entry.js.map"), "{}");
  const findings = productionSecurityIssues(folder);
  expect(findings.map(row => row.kind)).toEqual(expect.arrayContaining(["secret pattern", "private artifact"]));
  expect(findings.some(row => row.file === "server/index.js")).toBe(true);
  expect(JSON.stringify(findings)).not.toContain(sentinel);
});
it("allows only normal public learning artifacts in the clean fixture", () => {
  const folder = fixture();
  fs.writeFileSync(path.join(folder, "index.html"), "<title>FINETUNE</title>");
  fs.writeFileSync(path.join(folder, "learning.json"), '{"definition":"public learning content"}');
  expect(productionSecurityIssues(folder)).toEqual([]);
});
it("rejects original source, backups and source-map references even without a local map", () => {
  const folder = fixture();
  for (const name of ["learning-backup.zip", "history.bak", "original.tsx", "source.py"]) fs.writeFileSync(path.join(folder, name), "fixture");
  fs.writeFileSync(path.join(folder, "entry.js"), "//# sourceMappingURL=https://example.invalid/source.map");
  fs.writeFileSync(path.join(folder, "style.css"), "/*# sourceMappingURL=data:application/json;base64,e30= */");
  const findings = productionSecurityIssues(folder);
  expect(findings.filter((row) => row.kind === "private artifact")).toHaveLength(4);
  expect(findings.filter((row) => row.kind === "source map reference")).toHaveLength(2);
});
it("permits Expo fingerprinted vendor icons/fonts but not package source or unversioned files", () => {
  const folder = fixture();
  const directory = path.join(folder, "assets", "node_modules", "vendor", "Fonts");
  fs.mkdirSync(directory, { recursive: true });
  for (const name of ["icon." + "a".repeat(32) + "@2x.png", "font." + "b".repeat(32) + ".ttf"]) fs.writeFileSync(path.join(directory, name), "fixture");
  expect(productionSecurityIssues(folder)).toEqual([]);
  for (const name of ["index.js", "original.png", "source." + "a".repeat(32) + ".ts"]) fs.writeFileSync(path.join(directory, name), "fixture");
  expect(productionSecurityIssues(folder).filter((row) => row.kind === "private artifact")).toHaveLength(3);
});
