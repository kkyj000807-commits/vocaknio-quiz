import fs from 'node:fs';
import { StringDecoder } from 'node:string_decoder';
import { Buffer } from 'node:buffer';

export function* textChunks(file, chunkBytes = 64 * 1024) {
  if (!Number.isInteger(chunkBytes) || chunkBytes < 1) throw new Error('positive chunkBytes required');
  const fd = fs.openSync(file, 'r');
  const buffer = Buffer.alloc(chunkBytes);
  const decoder = new StringDecoder('utf8');
  try {
    let size;
    while ((size = fs.readSync(fd, buffer, 0, buffer.length, null)) > 0) yield decoder.write(buffer.subarray(0, size));
    const tail = decoder.end();
    if (tail) yield tail;
  } finally { fs.closeSync(fd); }
}

const tokenStart = /\b(ghp_|github_pat_|AKIA|xox[baprs]-|sk-|AIza)/g;
const isWord = char => /[A-Za-z0-9_]/.test(char ?? '');
function tokenState(prefix) {
  const allowed = prefix === 'github_pat_' ? /[A-Za-z0-9_]/ : prefix.startsWith('xox') ? /[A-Za-z0-9-]/ : prefix === 'AKIA' ? /[0-9A-Z]/ : prefix === 'AIza' ? /[0-9A-Za-z_-]/ : /[A-Za-z0-9]/;
  return { allowed, min: prefix === 'AKIA' ? 16 : prefix === 'AIza' ? 30 : 20, exact: prefix === 'AKIA', count: 0, lastWord: isWord(prefix.at(-1)) };
}
function advanceToken(state, text, start = 0, eof = false) {
  const sufficient = () => state.exact ? state.count === state.min : state.count >= state.min;
  for (let i = start; i < text.length; i++) {
    const char = text[i]; const word = isWord(char);
    if (state.lastWord !== word && sufficient()) return { found: true };
    if (!state.allowed.test(char)) return null;
    state.count = Math.min(state.count + 1, state.min + 1);
    state.lastWord = word;
  }
  return eof ? (state.lastWord && sufficient() ? { found: true } : null) : state;
}
function advancePrivateHeader(state, text, start = 0) {
  for (let i = start; i < text.length; i++) {
    const char = text[i];
    if (state.closing) {
      if (char !== '-') return null;
      if (++state.closing === 5) return { found: true };
    } else if (/[A-Z ]/.test(char)) state.tail = (state.tail + char).slice(-11);
    else if (char === '-' && state.tail.endsWith('PRIVATE KEY')) state.closing = 1;
    else return null;
  }
  return state;
}

// Finite-state continuations handle arbitrarily long tokens/header names without
// truncating evidence or buffering a whole line/minified JS bundle.
export function scanPublicTextFile(file, { chunkBytes = 64 * 1024, needles = [] } = {}) {
  const result = { secretPattern: false, serverConfiguration: false, rootExpoReferences: 0, rootAssetReferences: 0, authDiagnostics: false, found: Object.fromEntries(needles.map(n => [n, false])), bytesRead: fs.statSync(file).size };
  let tail = ''; let processedChars = 0;
  const tokens = new Map(); const headers = new Map();
  for (const chunk of textChunks(file, chunkBytes)) {
    if (!chunk) continue;
    const window = tail + chunk;
    if (!result.secretPattern) {
      for (const [offset, state] of tokens) {
        const next = advanceToken(state, chunk);
        if (next?.found) result.secretPattern = true;
        else if (!next) tokens.delete(offset);
      }
      for (const [offset, state] of headers) {
        const next = advancePrivateHeader(state, chunk);
        if (next?.found) result.secretPattern = true;
        else if (!next) headers.delete(offset);
      }
      tokenStart.lastIndex = 0;
      for (const match of window.matchAll(tokenStart)) {
        if (result.secretPattern) break;
        if (processedChars > tail.length && match.index === 0) continue;
        const offset = processedChars - tail.length + match.index;
        if (tokens.has(offset)) continue; // overlap must not reset an in-progress candidate
        const state = advanceToken(tokenState(match[1]), window, match.index + match[1].length);
        if (state?.found) result.secretPattern = true;
        else if (state) tokens.set(offset, state);
      }
      for (const match of window.matchAll(/-----BEGIN /g)) {
        if (result.secretPattern) break;
        const offset = processedChars - tail.length + match.index;
        if (headers.has(offset)) continue;
        const state = advancePrivateHeader({ tail: '', closing: 0 }, window, match.index + match[0].length);
        if (state?.found) result.secretPattern = true;
        else if (state) headers.set(offset, state);
      }
      if (result.secretPattern) { tokens.clear(); headers.clear(); }
    }
    result.serverConfiguration ||= /JWT_SECRET|DATABASE_URL|BUILT_IN_FORGE_API_KEY|OPENAI_API_KEY/.test(window);
    result.authDiagnostics ||= /\[API\] Full URL:|\[API\] Response headers:|\[Auth\] Setting session token|\[OAuth\] Params received:/.test(window);
    for (const [regex, field] of [[/["'=]\/_expo\//g, 'rootExpoReferences'], [/["'=]\/assets\//g, 'rootAssetReferences']]) {
      for (const match of window.matchAll(regex)) if (match.index + match[0].length > tail.length) result[field]++;
    }
    for (const needle of needles) result.found[needle] ||= window.includes(needle);
    tail = window.slice(-128); processedChars += chunk.length;
  }
  for (const state of tokens.values()) if (advanceToken(state, '', 0, true)?.found) result.secretPattern = true;
  return result;
}
