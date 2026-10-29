import { afterEach, beforeEach, expect, it, vi } from "vitest";
import sharedLinks from "@/assets/shared-sense-links.json";
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

it('attaches only the reviewed occurrence and exact approved sense, not a changed meaning', async () => {
  const link = { itemId: 'fixture-row', headword: 'test', senseId: 'fixture-sense', bookEntryId: 'fixture-book', bookOriginalGloss: 'fixture-original',
    definitionKo: '뜻', definitionEn: 'Definition', partOfSpeech: 'noun', exampleEn: 'An example.', exampleKo: '예문.' };
  const fixtureLinks = { schema: 2, contentVersion: 'test', sourceSha256: 'a'.repeat(64), review: 'isolated reviewed fixture', links: [link] };
  vi.doMock('@/assets/shared-sense-links.json', () => ({ default: fixtureLinks }));
  const version = fixtureLinks.contentVersion;
  vi.doMock('@/assets/vocab-learning-index-v1.4.json', () => ({default:{version,items:{[link.itemId]:{group:'V101',entryIds:['sense']}},coverage:{}}}));
  const source = {...entry(), itemIds:[link.itemId], headword:link.headword, senseId:link.senseId,
    definitionKo:link.definitionKo, definitionEn:link.definitionEn, partOfSpeech:link.partOfSpeech,
    example:{en:link.exampleEn,ko:link.exampleKo,kind:'editorial'}};
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,json:async()=>({version,entries:[source]})}));
  const loader = await import('@/lib/vocab-learning');
  expect((await loader.loadLearningEntries(link.itemId))[0].sharedBookReferences).toEqual([{entryId:link.bookEntryId,sourceSha256:fixtureLinks.sourceSha256}]);
  vi.resetModules();
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,json:async()=>({version,entries:[{...source,definitionKo:'다른 뜻'}]})}));
  const changed = await import('@/lib/vocab-learning');
  expect((await changed.loadLearningEntries(link.itemId))[0].sharedBookReferences).toBeUndefined();
  expect(changed.sharedBookReferences(source as never, link.itemId, { ...sharedLinks, schema: 999 })).toEqual([]);
  expect(changed.sharedBookReferences(source as never, link.itemId, { ...sharedLinks, contentVersion: 'wrong' })).toEqual([]);
});
