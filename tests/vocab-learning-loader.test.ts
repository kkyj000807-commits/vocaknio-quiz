import { afterEach, beforeEach, expect, it, vi } from "vitest";
vi.mock("@/assets/vocab-learning-index-v1.4.json", () => ({ default: { version: "test", items: { row: { group: "V101", entryIds: ["sense"] } }, coverage: {} } }));
beforeEach(() => { vi.resetModules(); vi.stubGlobal("window", { document: {}, location: { pathname: "/" } }); });
afterEach(() => { vi.unstubAllGlobals(); });
function entry() {
  return { id: "sense", senseId: "test:sense", headword: "test", itemIds: ["row"], definitionEn: "Definition", definitionStatus: "production", definitionKo: "뜻", contextExplanationKo: "문맥", example: { en: "An example.", ko: "예문.", kind: "editorial" }, verification: { status: "cross-agreed" }, sources: [] };
}
it.each(["en", "ko", "cueKo"])("filters a whitespace-only example %s at the load boundary", async field => {
  const source = entry();
  Object.assign(source.example, { [field]: "   " });
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ version: "test", entries: [source] }) }));
  const { loadLearningEntries } = await import("@/lib/vocab-learning");
  expect(await loadLearningEntries("row")).toEqual([]);
});
it("preserves valid legacy examples whose contextual explanation is provided outside cueKo", async () => {
  const source = entry();
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ version: "test", entries: [source] }) }));
  const { loadLearningEntries } = await import("@/lib/vocab-learning");
  expect(await loadLearningEntries("row")).toEqual([source]);
});
it("revalidates the preserved data URL while retaining the per-page request cache", async () => {
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ version: "test", entries: [entry()] }) });
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("window", { document: {}, location: { pathname: "/vocaknio-quiz/quiz" } });
  const { loadLearningEntries } = await import("@/lib/vocab-learning");
  await loadLearningEntries("row");
  await loadLearningEntries("row");
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(fetchMock).toHaveBeenCalledWith("/vocaknio-quiz/data/vocab-learning/test/v101.json", { cache: "no-cache" });
});
