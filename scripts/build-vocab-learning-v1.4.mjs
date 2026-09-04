import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const sourceDirectory = path.join(root, "data", "vocab-learning");
const sourcePaths = ["reviewed-a-v1.4.json", "reviewed-b-v1.4.json"].map((name) =>
  path.join(sourceDirectory, name),
);
const vocabPath = path.join(root, "assets", "vocab-v1.4.json");
const indexPath = path.join(root, "assets", "vocab-learning-index-v1.4.json");
const outputRoot = path.join(root, "public", "data", "vocab-learning", "1.4");
const groups = ["V101", "V201", "V301", "V401", "V501", "V502", "V601", "APPENDIX"];
const audioLicensePattern = /^(CC0(?: \d\.\d)?|Public Domain|CC BY(?:-SA)?(?: \d\.\d)?)$/i;

const fail = (message) => {
  throw new Error(`깊이 학습 데이터 오류: ${message}`);
};

for (const sourcePath of sourcePaths) {
  if (!fs.existsSync(sourcePath)) fail(`원본 없음: ${sourcePath}`);
}
const entries = sourcePaths.flatMap((sourcePath) => {
  const value = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
  if (!Array.isArray(value)) fail(`${sourcePath}: 배열 형식이 아님`);
  return value;
});
const vocab = JSON.parse(fs.readFileSync(vocabPath, "utf8"));
if (!Array.isArray(entries) || entries.length === 0) fail("검수 완료 항목이 없습니다.");

const vocabById = new Map(vocab.map((item) => [item.id, item]));
const seenIds = new Set();
const itemPointers = {};
const byGroup = Object.fromEntries(groups.map((group) => [group, []]));

for (const entry of entries) {
  if (!entry || typeof entry !== "object") fail("항목 형식이 객체가 아닙니다.");
  for (const field of ["id", "headword", "partOfSpeech", "definitionEn", "definitionKo", "memoryKo", "usageKo", "examTrapKo"]) {
    if (typeof entry[field] !== "string" || !entry[field].trim()) fail(`${entry.id ?? "unknown"}: ${field} 누락`);
  }
  if (seenIds.has(entry.id)) fail(`${entry.id}: 중복 뜻 ID`);
  seenIds.add(entry.id);
  if (!groups.includes(entry.group)) fail(`${entry.id}: 잘못된 그룹 ${entry.group}`);
  if (!Array.isArray(entry.itemIds) || entry.itemIds.length === 0) fail(`${entry.id}: 연결 항목 없음`);
  if (!Array.isArray(entry.contrasts)) fail(`${entry.id}: contrasts 배열 누락`);
  if (!entry.example?.en || !entry.example?.ko || !["source", "editorial"].includes(entry.example.kind)) fail(`${entry.id}: 예문 누락`);
  if (entry.verification?.status !== "cross-agreed" || !entry.verification.checkedAtKst || !entry.verification.reviewer) fail(`${entry.id}: 교차 검수 미완료`);
  if (!Array.isArray(entry.sources) || entry.sources.length < 2) fail(`${entry.id}: 독립 출처 2개 미만`);

  const names = entry.sources.map((source) => String(source.name).toLowerCase());
  if (!names.some((name) => name.includes("open english wordnet"))) fail(`${entry.id}: Open English WordNet 출처 없음`);
  if (!names.some((name) => name.includes("wiktionary"))) fail(`${entry.id}: Wiktionary 대조 근거 없음`);
  if (names.some((name) => /oxford|cambridge|merriam|webster/.test(name))) fail(`${entry.id}: 재배포 허가가 확인되지 않은 사전 원문 포함`);
  for (const source of entry.sources) {
    if (!source.url || !source.edition || !source.license) fail(`${entry.id}: 불완전한 출처 정보`);
  }

  if (entry.audio) {
    if (entry.audio.region !== "US" || entry.audio.source !== "Wikimedia Commons") fail(`${entry.id}: 미국식 Commons 녹음이 아님`);
    if (!entry.audio.url || !entry.audio.sourcePage || !entry.audio.attribution) fail(`${entry.id}: 발음 출처·저작자 정보 누락`);
    if (!audioLicensePattern.test(entry.audio.license)) fail(`${entry.id}: 허용되지 않은 발음 라이선스 ${entry.audio.license}`);
  }

  for (const itemId of entry.itemIds) {
    const item = vocabById.get(itemId);
    if (!item) fail(`${entry.id}: 존재하지 않는 목록 ID ${itemId}`);
    if (String(item.w).trim().toLowerCase() !== entry.headword.trim().toLowerCase()) fail(`${entry.id}: ${itemId} 표제어 불일치`);
    const pointer = itemPointers[itemId] ?? { group: entry.group, entryIds: [] };
    if (pointer.group !== entry.group) fail(`${itemId}: 여러 그룹 파일을 가리킴`);
    pointer.entryIds.push(entry.id);
    itemPointers[itemId] = pointer;
  }
  byGroup[entry.group].push(entry);
}

for (const group of groups) {
  if (byGroup[group].length === 0) fail(`${group}: 공개 항목 0개`);
}

const checkedAtKst = [...entries]
  .map((entry) => entry.verification.checkedAtKst)
  .sort()
  .at(-1);
const index = {
  version: "1.4",
  coverage: { senses: entries.length, rows: Object.keys(itemPointers).length, checkedAtKst },
  items: Object.fromEntries(Object.entries(itemPointers).sort(([left], [right]) => left.localeCompare(right))),
};

fs.mkdirSync(outputRoot, { recursive: true });
for (const group of groups) {
  const normalizedEntries = byGroup[group].map((entry) => ({
    ...entry,
    sources: entry.sources.map((source) =>
      String(source.name).toLowerCase().includes("open english wordnet")
        ? {
            ...source,
            attribution: "Princeton WordNet; Open English WordNet Team",
          }
        : source,
    ),
  }));
  const payload = { version: "1.4", group, entries: normalizedEntries };
  fs.writeFileSync(path.join(outputRoot, `${group.toLowerCase()}.json`), `${JSON.stringify(payload)}\n`, "utf8");
}
fs.writeFileSync(indexPath, `${JSON.stringify(index, null, 2)}\n`, "utf8");
console.log(`깊이 학습 빌드 완료: ${entries.length}개 뜻 / ${Object.keys(itemPointers).length}개 목록 연결`);
console.log(`미국식 실제 녹음: ${entries.filter((entry) => entry.audio).length}개`);
