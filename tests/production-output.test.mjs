import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createPagesFallback, requireEmptyOutput } from "../scripts/lib/production-output.mjs";

const roots = [];
afterEach(() => {
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true });
});
describe("Production 빌드 출력 보호", () => {
  it("Pages 404도 최신 내보내기 HTML을 사용한다", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "voca-output-test-")); roots.push(root);
    fs.writeFileSync(path.join(root, "+not-found.html"), "new-bundle");
    fs.writeFileSync(path.join(root, "404.html"), "old-bundle");
    createPagesFallback(root);
    expect(fs.readFileSync(path.join(root, "404.html"), "utf8")).toBe("new-bundle");
  });
  it("없는 폴더나 빈 폴더만 허용하고 기존 파일은 그대로 둔다", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "voca-output-test-"));
    roots.push(root);
    expect(requireEmptyOutput(root)).toBe(root);
    expect(requireEmptyOutput(path.join(root, "next"))).toBe(
      path.join(root, "next"),
    );
    const file = path.join(root, "previous-release.json");
    fs.writeFileSync(file, "preserve");
    expect(() => requireEmptyOutput(root)).toThrow(/빈 폴더/);
    expect(() => requireEmptyOutput(file)).toThrow(/빈 폴더/);
    expect(fs.readFileSync(file, "utf8")).toBe("preserve");
    expect(() => requireEmptyOutput("")).toThrow(/지정/);
  });
});
