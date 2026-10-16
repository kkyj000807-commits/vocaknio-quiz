import { describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createReleaseMetadata, isReleaseMetadataValid } from "../scripts/lib/release-metadata.mjs";

const source = {
  sourceCommit: "a".repeat(40), sourceDirty: false, dataVersion: "v1.4",
  builtAt: "2026-10-12T15:20:01.000Z",
};
describe("고정 표시 버전과 배포 시각", () => {
  it("표시 버전 1.0이 기존 학습 데이터 경로를 변경하지 않는다", () => {
    const release = createReleaseMetadata({ version: "1.29", displayVersion: "1.0" }, source);
    expect(release.version).toBe("1.0");
    expect(release.learningDataVersion).toBe("1.29");
    expect(release.dataVersion).toBe(JSON.parse(fs.readFileSync("assets/vocab-meta-v1.4.json", "utf8")).version);
    expect(release.modifiedAtKst).toBe("2026.10.13 00:20:01 KST");
    expect(isReleaseMetadataValid(release)).toBe(true);
  });
  it("같은 1.0에서도 갱신 시각이 달라지면 새 배포로 구별한다", () => {
    const config = { version: "1.29", displayVersion: "1.0" };
    const first = createReleaseMetadata(config, source);
    const next = createReleaseMetadata(config, { ...source, builtAt: "2026-10-12T15:20:02.000Z" });
    expect(next.version).toBe(first.version);
    expect(next.target).not.toBe(first.target);
    expect(next.target).toBe(`1.0|${next.modifiedAtKst}`);
  });
  it("이전 설정과 분 단위 release.json도 검사할 수 있다", () => {
    const old = createReleaseMetadata({ version: "1.29" }, source);
    expect(old.version).toBe("1.29");
    expect(isReleaseMetadataValid({ ...old, modifiedAtKst: "2026.10.13 00:20 KST", target: "1.29|2026.10.13 00:20 KST" })).toBe(true);
  });
  it("경로 탈출·잘못된 시각·시각 불일치·target 불일치는 거절한다", () => {
    const good = createReleaseMetadata({ version: "1.29", displayVersion: "1.0" }, source);
    for (const change of [
      { learningDataVersion: "../1.29" }, { dataVersion: "../v1.4" }, { version: "" }, { builtAt: "invalid" },
      { modifiedAtKst: "2026.10.14 00:20:01 KST" }, { target: "1.0|stale" },
      { sourceCommit: "unknown" }, { sourceDirty: "false" },
    ]) expect(isReleaseMetadataValid({ ...good, ...change })).toBe(false);
  });
  it("실제 출력 감사가 표시1.0과 데이터1.29를 구분하고 잘못된 데이터 헤더를 거절한다", () => {
    // Synthetic output fixture, not a Production build or browser check.
    const output = fs.mkdtempSync(path.join(os.tmpdir(), "finetune-release-test-"));
    try {
      const write = (file, value) => {
        const destination = path.join(output, file);
        fs.mkdirSync(path.dirname(destination), { recursive: true });
        fs.writeFileSync(destination, value);
      };
      write("release.json", JSON.stringify(createReleaseMetadata({ version: "1.29", displayVersion: "1.0" }, source)));
      const html = '<meta name="robots" content="noindex, nofollow, nosnippet, noimageindex"><script src="/vocaknio-quiz/_expo/static/js/web/entry-abcdef.js"></script>';
      write("index.html", html);
      write("_expo/static/js/web/entry-abcdef.js", '["vocab-learning","vocab-definitions","speechSynthesis","voiceURI","preferRecording"]');
      for (const group of ["v101", "v201", "v301", "v401", "v501", "v502", "v601", "appendix"]) {
        write(`data/vocab-learning/1.29/${group}.json`, '{"version":"1.29","entries":[]}');
        write(`data/vocab-definitions/oewn-2025/${group}.json`, "{}");
      }
      const audit = () => spawnSync(process.execPath, ["scripts/audit-production-output.mjs", output], { encoding: "utf8" });
      const missingMarker = audit();
      expect(missingMarker.status).toBe(1);
      expect(JSON.parse(missingMarker.stdout).pagesStaticServing).toBe(false);
      write(".nojekyll", "");
      expect(audit().status).toBe(0);
      write("quiz.html", "<title>unrestricted route fixture</title>");
      const unrestricted = audit();
      expect(unrestricted.status).toBe(1);
      expect(JSON.parse(unrestricted.stdout).searchExposureRestricted).toBe(false);
      write("quiz.html", html);
      expect(audit().status).toBe(0);
      write("data/vocab-learning/1.29/v101.json", '{"version":"1.0","entries":[]}');
      expect(audit().status).toBe(1);
      write("data/vocab-learning/1.29/v101.json", '{"version":"1.29","entries":[{"audio":{"url":"https://example.invalid/unverified.mp3","region":"US"}}]}');
      expect(audit().status).toBe(1);
    } finally {
      // This exact directory was created by this test, outside all workspaces.
      fs.rmSync(output, { recursive: true, force: true });
    }
  });
});
