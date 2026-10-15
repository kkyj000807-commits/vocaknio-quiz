import { createLearningStorageAdapter, INDEXED_LEARNING_KEYS } from "../../lib/learning-storage";
import { LEARNING_WRITE_JOURNAL_KEY as JOURNAL, recoverLearningJournal, writeLearningJournal } from "../../lib/learning-write-journal";

// No public site, production database name, or unprefixed localStorage access.
if (!["127.0.0.1", "localhost", "[::1]"].includes(location.hostname)) throw new Error("QA requires localhost");
const STATS = "vocaknio_stats", BOOKMARKS = "vocaknio_bookmarks", WRONG = "vocaknio_wrong_words";
const MASTER = "vocaknio_mastered", VERSION = "vocaknio_vocab_storage_version";
const STATE = "finetune-qa-reload-state";
const runId = new URL(location.href).searchParams.get("qa") ?? crypto.randomUUID();
if (!/^[a-zA-Z0-9-]{1,80}$/.test(runId)) throw new Error("Invalid isolated QA identifier");
const prefix = `finetune-qa-${runId}`;
type Fault = { mode: "none" | "quota" | "abort"; puts: number };
type Row = { name: string; status: "PASS" | "FAIL"; detail?: string };
const rows: Row[] = [];
const output = document.querySelector<HTMLPreElement>("#result")!;
function render(extra: Record<string, unknown> = {}) {
  output.textContent = JSON.stringify({ isolation: prefix, engine: navigator.userAgent, actualDevice: "NOT_VERIFIED", rows,
    passed: rows.filter(row => row.status === "PASS").length, failed: rows.filter(row => row.status === "FAIL").length, ...extra }, null, 2);
}
function assert(condition: unknown, detail: string): asserts condition { if (!condition) throw new Error(detail); }
function equal(actual: unknown, expected: unknown, detail: string) { assert(JSON.stringify(actual) === JSON.stringify(expected), detail); }
async function rejected(operation: Promise<unknown>, name?: string) {
  const result = await operation.then(() => null, error => error);
  assert(result instanceof Error, "Expected operation rejection");
  if (name) assert(result.name === name, `Expected ${name}, got ${result.name}`);
}
function bindGet(target: object, key: PropertyKey) {
  const value = Reflect.get(target, key, target);
  return typeof value === "function" ? value.bind(target) : value;
}

/** Real browser transactions; injection throws after a real put was queued. */
function isolatedFactory(name: string, fault?: Fault): IDBFactory {
  assert(name.startsWith("finetune-qa-"), "Unsafe DB name");
  return new Proxy(indexedDB, { get(target, key) {
    if (key !== "open") return bindGet(target, key);
    return (_ignoredName: string, version?: number) => {
      const request = target.open(name, version);
      let wrappedDb: IDBDatabase | undefined;
      return new Proxy(request, {
        get(req, prop) {
          if (prop !== "result" || !fault) return bindGet(req, prop);
          const db = req.result;
          return wrappedDb ??= new Proxy(db, { get(database, field) {
            if (field !== "transaction") return bindGet(database, field);
            return (...args: Parameters<IDBDatabase["transaction"]>) => {
              const tx = database.transaction(...args);
              return new Proxy(tx, { get(transaction, txProp) {
                if (txProp !== "objectStore") return bindGet(transaction, txProp);
                return (storeName: string) => {
                  const store = transaction.objectStore(storeName);
                  return new Proxy(store, { get(objectStore, storeProp) {
                    if (storeProp !== "put") return bindGet(objectStore, storeProp);
                    return (...putArgs: Parameters<IDBObjectStore["put"]>) => {
                      if (fault.mode !== "none" && ++fault.puts === 2) {
                        if (fault.mode === "abort") transaction.abort();
                        throw new DOMException("Synthetic isolated QA fault", fault.mode === "quota" ? "QuotaExceededError" : "AbortError");
                      }
                      return objectStore.put(...putArgs);
                    };
                  } });
                };
              }, set: (targetTx, property, value) => Reflect.set(targetTx, property, value, targetTx) });
            };
          }, set: (targetDb, property, value) => Reflect.set(targetDb, property, value, targetDb) });
        }, set: (targetRequest, property, value) => Reflect.set(targetRequest, property, value, targetRequest),
      });
    };
  } });
}
function fixture(suffix: string, initial: Record<string, string> = {}, fault?: Fault) {
  const legacy = new Map(Object.entries(initial));
  const adapterLegacy = {
    getItem: async (key: string) => legacy.get(key) ?? null,
    setItem: async (key: string, value: string) => { legacy.set(key, value); },
    removeItem: async (key: string) => { legacy.delete(key); },
    multiSet: async (entries: [string, string][]) => { for (const [key, value] of entries) legacy.set(key, value); },
  };
  const environment = { indexedDB: isolatedFactory(`${prefix}-${suffix}`, fault), readLegacy: (key: string) => legacy.get(key) ?? null };
  return { legacy, adapter: createLearningStorageAdapter(adapterLegacy, () => environment),
    another: () => createLearningStorageAdapter(adapterLegacy, () => environment), adapterLegacy, environment };
}
const validate = (_key: string, raw: string) => { JSON.parse(raw); };
async function test(name: string, task: () => Promise<void>) {
  try { await task(); rows.push({ name, status: "PASS" }); }
  catch (error) { rows.push({ name, status: "FAIL", detail: error instanceof Error ? error.message : "Unknown QA failure" }); }
  render();
}
async function suite() {
  rows.length = 0;
  const id = crypto.randomUUID();
  await test("legacy import, immutable original, snapshot and CAS", async () => {
    const f = fixture(`${id}-copy`, { [BOOKMARKS]: "[1]", [STATS]: '{"totalAnswered":1}', [VERSION]: "v1.4" });
    const before = [...f.legacy];
    equal(await f.adapter.readSnapshot([BOOKMARKS, STATS]), { [BOOKMARKS]: "[1]", [STATS]: '{"totalAnswered":1}' }, "Imported exact bytes");
    await f.adapter.compareAndSet!([{ key: BOOKMARKS, before: "[1]", after: "[1,2]" }]);
    equal(await f.adapter.getItem(BOOKMARKS), "[1,2]", "CAS result");
    equal([...f.legacy], before, "Legacy source changed");
    equal((await f.adapter.exportMigrationOriginalBackup())?.[BOOKMARKS], "[1]", "Immutable original changed");
  });
  await test("two independent adapters: same baseline has exactly one winner", async () => {
    const f = fixture(`${id}-race`, { [BOOKMARKS]: "[1]" }); const other = f.another();
    await Promise.all([f.adapter.getItem(BOOKMARKS), other.getItem(BOOKMARKS)]);
    const results = await Promise.allSettled([
      f.adapter.compareAndSet!([{ key: BOOKMARKS, before: "[1]", after: "[1,2]" }]),
      other.compareAndSet!([{ key: BOOKMARKS, before: "[1]", after: "[1,3]" }]),
    ]);
    assert(results.filter(result => result.status === "fulfilled").length === 1, "CAS allowed lost update");
    assert(results.some(result => result.status === "rejected" && result.reason.name === "LearningStorageConflictError"), "Conflict was not explicit");
  });
  for (const mode of ["quota", "abort"] as const) await test(`real transaction ${mode} after first put rolls back all keys`, async () => {
    const fault: Fault = { mode: "none", puts: 0 };
    const f = fixture(`${id}-${mode}`, { [BOOKMARKS]: "[1]", [WRONG]: "[2]" }, fault);
    const before = await f.adapter.readSnapshot([BOOKMARKS, WRONG]);
    fault.mode = mode; fault.puts = 0;
    await rejected(f.adapter.compareAndSet!([{ key: BOOKMARKS, before: "[1]", after: "[1,3]" }, { key: WRONG, before: "[2]", after: "[2,4]" }]));
    fault.mode = "none";
    equal(await f.adapter.readSnapshot([BOOKMARKS, WRONG]), before, "Partial transaction survived abort");
    equal(await f.another().readSnapshot([BOOKMARKS, WRONG]), before, "New adapter sees partial values");
  });
  await test("partial legacy journal recovery is exact and repeated recovery does not score twice", async () => {
    const journal = JSON.stringify({ version: 1, changes: [{ key: STATS, before: "0", after: "1" }, { key: WRONG, before: "[]", after: "[7]" }] });
    const f = fixture(`${id}-journal`, { [STATS]: "1", [WRONG]: "[]", [JOURNAL]: journal });
    equal(await recoverLearningJournal(f.adapter, [STATS, WRONG], validate), "recovered", "Recovery failed");
    equal(await recoverLearningJournal(f.adapter, [STATS, WRONG], validate), "clear", "Recovery repeated");
    equal(await f.adapter.readSnapshot([STATS, WRONG, JOURNAL]), { [STATS]: "1", [WRONG]: "[7]", [JOURNAL]: null }, "Recovery snapshot wrong");
    await writeLearningJournal(f.adapter, [[STATS, "2"]], new Map([[STATS, "1"]]));
    await rejected(writeLearningJournal(f.adapter, [[STATS, "2"]], new Map([[STATS, "1"]])), "LearningStorageConflictError");
    equal(await f.adapter.getItem(STATS), "2", "Duplicate CAS changed count");
  });
  await test("old legacy tab edits cause conflict; both originals remain exportable", async () => {
    const f = fixture(`${id}-legacy`, { [BOOKMARKS]: "[1]" });
    await f.adapter.setItem(BOOKMARKS, "[1,2]"); f.legacy.set(BOOKMARKS, "[1,3]");
    await rejected(f.adapter.getItem(BOOKMARKS), "LearningStorageConflictError");
    equal((await f.adapter.exportMigrationOriginalBackup())?.[BOOKMARKS], "[1]", "Original lost");
    equal((await f.adapter.exportCurrentIndexedBackup())?.[BOOKMARKS], "[1,2]", "Current IDB lost");
    equal((await f.adapter.exportLegacyLearningBackup()).records[BOOKMARKS], "[1,3]", "Old tab edit lost");
  });
  await test("permission denied preserves source and never substitutes an empty record", async () => {
    const f = fixture(`${id}-permission`, { [BOOKMARKS]: "[9]" });
    const denied = createLearningStorageAdapter(f.adapterLegacy, () => ({ ...f.environment,
      readLegacy: () => { throw new DOMException("Synthetic QA denial", "SecurityError"); } }));
    await rejected(denied.getItem(BOOKMARKS)); equal([...f.legacy], [[BOOKMARKS, "[9]"]], "Denied import changed source");
    equal(await f.adapter.getItem(BOOKMARKS), "[9]", "Denied transaction left a partial DB");
  });
  render({ completed: true, scenario: "deterministic-real-IDB", realDeviceVerified: false });
}

type ReloadState = { run: string; suffix: string; count: number; target: number; staged: boolean };
const persistentValues = { [STATS]: '{"totalAnswered":30,"totalCorrect":15}', [BOOKMARKS]: "[3,9]", [WRONG]: "[7]", [MASTER]: "[8]" };
async function startReload(staged: boolean) {
  const state: ReloadState = { run: runId, suffix: crypto.randomUUID(), count: 0, target: staged ? 1 : 20, staged };
  const f = fixture(`reload-${state.suffix}`);
  await f.adapter.multiSet(Object.entries(persistentValues));
  if (staged) await f.adapter.multiSet([[WRONG, "[]"], [JOURNAL, JSON.stringify({ version: 1, changes: [{ key: STATS, before: null, after: persistentValues[STATS] }, { key: WRONG, before: "[]", after: "[7]" }] })]]);
  sessionStorage.setItem(STATE, JSON.stringify(state));
  const url = new URL(location.href); url.searchParams.set("qa", runId); history.replaceState(null, "", url);
  location.reload();
}
async function continueReload(state: ReloadState) {
  assert(state.run === runId && /^[a-zA-Z0-9-]+$/.test(state.suffix), "Wrong reload fixture");
  const f = fixture(`reload-${state.suffix}`);
  if (state.staged) {
    equal(await recoverLearningJournal(f.adapter, [STATS, WRONG], validate), "recovered", "Staged recovery failed");
    equal(await recoverLearningJournal(f.adapter, [STATS, WRONG], validate), "clear", "Duplicate staged recovery");
  }
  equal(await f.adapter.readSnapshot(Object.keys(persistentValues)), persistentValues, "Actual reload lost records");
  state.count++;
  sessionStorage.setItem(STATE, JSON.stringify(state));
  if (state.count < state.target) { render({ realDocumentReload: state.count, target: state.target }); setTimeout(() => location.reload(), 100); }
  else { sessionStorage.removeItem(STATE); rows.push({ name: state.staged ? "Interrupted journal survives actual document reload" : "20 actual document reloads preserve exact records", status: "PASS" }); render({ completed: true, reloads: state.count }); }
}

const channel = new BroadcastChannel(`${prefix}-race-channel`);
const peerId = crypto.randomUUID();
let race: { adapter: ReturnType<typeof createLearningStorageAdapter>; baseline: string | null; token: string; coordinator: boolean; results: Record<string, string> } | undefined;
async function commitRace() {
  assert(race, "No prepared cross-tab race");
  let result = "success";
  try { await race.adapter.compareAndSet!([{ key: STATS, before: race.baseline, after: JSON.stringify({ winner: peerId }) }]); }
  catch (error) { result = error instanceof Error ? error.name : "unknown"; }
  channel.postMessage({ type: "result", token: race.token, peerId, result });
  await receiveRaceResult(race.token, peerId, result);
}
async function receiveRaceResult(token: string, id: string, result: string) {
  if (!race || race.token !== token) return;
  race.results[id] = result;
  if (Object.keys(race.results).length < 2) return;
  const results = Object.values(race.results);
  const passed = results.filter(value => value === "success").length === 1 && results.filter(value => value === "LearningStorageConflictError").length === 1;
  rows.push({ name: "Two real tabs CAS same baseline", status: passed ? "PASS" : "FAIL", detail: JSON.stringify(results) });
  render({ completed: true, crossTabResults: results, stored: await race.adapter.getItem(STATS) });
}
channel.onmessage = event => { void (async () => {
  const message = event.data;
  if (message.type === "prepare") {
    const f = fixture(`peer-${message.token}`); const baseline = await f.adapter.getItem(STATS);
    race = { adapter: f.adapter, baseline, token: message.token, coordinator: false, results: {} };
    channel.postMessage({ type: "ready", token: message.token }); render({ crossTab: "Peer prepared same baseline" });
  } else if (message.type === "ready" && race?.coordinator && race.token === message.token) {
    channel.postMessage({ type: "commit", token: race.token }); await commitRace();
  } else if (message.type === "commit" && race && !race.coordinator && race.token === message.token) await commitRace();
  else if (message.type === "result") await receiveRaceResult(message.token, message.peerId, message.result);
})().catch(error => render({ error: error instanceof Error ? error.message : "Race failed" })); };
async function startRace() {
  const token = crypto.randomUUID(); const f = fixture(`peer-${token}`);
  await f.adapter.setItem(STATS, "0");
  race = { adapter: f.adapter, baseline: await f.adapter.getItem(STATS), token, coordinator: true, results: {} };
  channel.postMessage({ type: "prepare", token }); render({ crossTab: "Waiting for open peer tab; click Start again after peer loads if needed" });
}
const peer = new URL(location.href); peer.searchParams.set("qa", runId);
document.querySelector<HTMLAnchorElement>("#peer")!.href = peer.href;
for (const [id, action] of [["suite", suite], ["reload", () => startReload(false)], ["staged", () => startReload(true)], ["race", startRace], ["join", () => render({ crossTab: "Joined; click Start cross-tab race in the first tab" })]] as const)
  document.querySelector<HTMLButtonElement>(`#${id}`)!.onclick = () => { void Promise.resolve().then(action).catch(error => { rows.push({ name: id, status: "FAIL", detail: error instanceof Error ? error.message : "QA failure" }); render(); }); };
render({ supported: { indexedDB: !!window.indexedDB, broadcastChannel: !!window.BroadcastChannel }, learningKeys: INDEXED_LEARNING_KEYS.length });
const saved = sessionStorage.getItem(STATE);
if (saved) void continueReload(JSON.parse(saved) as ReloadState).catch(error => { sessionStorage.removeItem(STATE); rows.push({ name: "actual reload", status: "FAIL", detail: error instanceof Error ? error.message : "Reload failed" }); render(); });
