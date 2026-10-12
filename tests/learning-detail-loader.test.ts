import { expect, it, vi } from "vitest";
import { loadLearningDetailParts } from "@/lib/learning-detail-loader";

it("a slow/failing dictionary cannot withhold an already loaded example", async () => {
  let rejectDictionary!: (reason: Error) => void;
  const dictionary = new Promise<never>((_, reject) => { rejectDictionary = reject; });
  const handlers = { onEntries: vi.fn(), onDictionary: vi.fn(), onError: vi.fn() };
  const example = [{ en: "An example.", ko: "예문." }];
  const pending = loadLearningDetailParts({ entries: async () => example, dictionary: () => dictionary }, handlers);
  await vi.waitFor(() => expect(handlers.onEntries).toHaveBeenCalledWith(example));
  expect(handlers.onDictionary).not.toHaveBeenCalled();
  rejectDictionary(new Error("unavailable"));
  await pending;
  expect(handlers.onError).toHaveBeenCalledWith("dictionary");
  expect(handlers.onEntries).toHaveBeenCalledTimes(1);
  await loadLearningDetailParts({ dictionary: async () => "recovered" }, handlers);
  expect(handlers.onEntries).toHaveBeenCalledTimes(1);
  expect(handlers.onDictionary).toHaveBeenCalledWith("recovered");
});

it("dictionary fallback survives a failed learning-example request", async () => {
  const handlers = { onEntries: vi.fn(), onDictionary: vi.fn(), onError: vi.fn() };
  await loadLearningDetailParts({ entries: async () => { throw new Error("offline"); }, dictionary: async () => "definition" }, handlers);
  expect(handlers.onDictionary).toHaveBeenCalledWith("definition");
  expect(handlers.onError).toHaveBeenCalledWith("entries");
});
