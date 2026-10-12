import fs from 'node:fs';
import path from 'node:path';

// Existing output is retained byte-for-byte when only audit-run time changed.
// Source/verification dates, IDs, answers, order and provenance are never ignored.
export function writeJsonCheckpoint(file, value, { indent = 0, ignoreGeneratedAt = false } = {}) {
  const json = JSON.stringify(value, null, indent);
  if (json === undefined) throw new Error('JSON value required');
  const serialized = json + '\n';
  if (fs.existsSync(file)) {
    const previous = JSON.parse(fs.readFileSync(file, 'utf8')); // corrupt output is not silently overwritten
    const before = previous && !Array.isArray(previous) && typeof previous === 'object' ? { ...previous } : previous;
    const after = value && !Array.isArray(value) && typeof value === 'object' ? { ...value } : value;
    if (ignoreGeneratedAt) {
      if (!before || !after || typeof before !== 'object' || typeof after !== 'object' || Array.isArray(before) || Array.isArray(after)) throw new Error('Timestamp projection requires JSON objects');
      delete before.generatedAtKst; delete after.generatedAtKst;
    }
    if (JSON.stringify(before) === JSON.stringify(after)) return false;
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.tmp-${process.pid}-${Date.now()}`;
  try {
    fs.writeFileSync(temporary, serialized, { encoding: 'utf8', flag: 'wx' });
    fs.renameSync(temporary, file);
  } finally { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); }
  return true;
}
