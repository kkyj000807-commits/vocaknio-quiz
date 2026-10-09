import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { loadIdiomCorrections } from "../scripts/lib/idiom-corrections.mjs";

describe("sense-scoped idiom evidence", () => {
  afterEach(() => vi.restoreAllMocks());

  it.each([
    ["one origin", sources => sources.filter(source => source.independenceGroup === "Collins")],
    ["missing scope", sources => sources.map((source, index) => index === 0 ? { ...source, noteKo: "" } : source)],
  ])("rejects invalid sense-specific evidence: %s", (_label, patch) => {
    const root = process.cwd();
    const originalRead = fs.readFileSync.bind(fs);
    const raw = JSON.parse(originalRead(path.join(root, "data/idiom-corrections.json"), "utf8"));
    const sense = raw.entries.find(entry => entry.key === "all-but").senses.find(sense => sense.id === "almost");
    sense.sources = patch(sense.sources);
    vi.spyOn(fs, "readFileSync").mockImplementation((file, ...args) => String(file).endsWith("idiom-corrections.json") ? JSON.stringify(raw) : originalRead(file, ...args));
    expect(() => loadIdiomCorrections(root)).toThrow(/all-but:almost/);
  });
});
