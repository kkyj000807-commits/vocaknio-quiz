/** Settle each source independently: a missing dictionary must never hide a
 * valid sense/example. Successful sources need not be requested on retry. */
export async function loadLearningDetailParts<T, U>(
  sources: { entries?: () => Promise<T>; dictionary?: () => Promise<U> },
  handlers: { onEntries: (value: T) => void; onDictionary: (value: U) => void; onError: (part: "entries" | "dictionary") => void },
) {
  await Promise.all([
    sources.entries && Promise.resolve().then(sources.entries).then(handlers.onEntries, () => handlers.onError("entries")),
    sources.dictionary && Promise.resolve().then(sources.dictionary).then(handlers.onDictionary, () => handlers.onError("dictionary")),
  ]);
}
