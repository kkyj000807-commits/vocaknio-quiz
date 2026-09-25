import type { ImageSourcePropType } from "react-native";
import catalog from "../data/mnemonic-visuals.json";

export interface MnemonicVisual {
  imageId: string;
  senseId: string;
  visualConcept: string;
  imageType: "line-svg";
  assetPath: string;
  generationVersion: string;
  reviewStatus: "candidate" | "reviewed" | "production";
}

const ASSET_PATHS = new Set([
  "jury-foreman-leader.svg",
  "put-cart-before-horse.svg",
]);

const entries = (catalog.entries as MnemonicVisual[]).filter(
  entry => entry.reviewStatus === "production" && ASSET_PATHS.has(entry.assetPath),
);
const bySenseId = new Map(entries.map(entry => [entry.senseId, entry]));

export function getMnemonicVisual(senseId?: string | null): MnemonicVisual | null {
  return senseId ? bySenseId.get(senseId) ?? null : null;
}

export function getMnemonicAsset(visual: MnemonicVisual): ImageSourcePropType {
  switch (visual.assetPath) {
    case "jury-foreman-leader.svg":
      return require("../assets/mnemonics/jury-foreman-leader.svg");
    case "put-cart-before-horse.svg":
      return require("../assets/mnemonics/put-cart-before-horse.svg");
    default:
      throw new Error(`Unknown mnemonic asset: ${visual.assetPath}`);
  }
}

export function getMnemonicVisualCoverage() {
  return { productionSenses: bySenseId.size, assets: ASSET_PATHS.size };
}
