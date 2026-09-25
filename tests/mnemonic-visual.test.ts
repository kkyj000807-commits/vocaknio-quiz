import { describe, expect, it } from "vitest";

import { getItemLearningTargets } from "@/lib/canonical-learning";
import {
  getMnemonicVisual,
  getMnemonicVisualCoverage,
} from "@/lib/mnemonic-visual";
import { getVocabItem } from "@/lib/vocab";

describe("sense mnemonic pilot", () => {
  it("exposes only reviewed production assets", () => {
    expect(getMnemonicVisualCoverage()).toEqual({
      productionSenses: 2,
      assets: 2,
    });
  });

  it("maps every duplicate jury foreman occurrence to one sense image", () => {
    const first = getVocabItem(18434)!;
    const duplicate = getVocabItem(22498)!;
    const firstSense = getItemLearningTargets(first)[0].senseId;
    const duplicateSense = getItemLearningTargets(duplicate)[0].senseId;

    expect(firstSense).toBe("jury-foreman:leader-of-jury");
    expect(duplicateSense).toBe(firstSense);
    expect(getMnemonicVisual(firstSense)?.imageId).toBe(
      "mnemonic-jury-foreman-leader-v1",
    );
  });

  it("does not leak one sense image into a different sense", () => {
    expect(
      getMnemonicVisual("take-for-granted:assume-without-checking"),
    ).toBeNull();
    expect(
      getMnemonicVisual("put-the-cart-before-the-horse:reverse-dependent-order")
        ?.imageId,
    ).toBe("mnemonic-cart-before-horse-order-v1");
  });
});
