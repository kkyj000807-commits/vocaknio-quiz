import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import themeConfig from "../theme.config";
import { WordSectionLabel } from "@/components/word-section-label";
import { SynonymDetails } from "@/components/synonym-details";
import { VOCAB, SECTION_RANGES, formatVocabSections, getSynonymDetails, getSynonymSourceGroups, normalizeWord } from "@/lib/vocab";

const theme = vi.hoisted(() => ({ mode: "light" as "light" | "paper" | "dark" }));
vi.mock("react-native", () => {
  const component = (tag: string) => function Mock({ children, style, testID }: { children?: React.ReactNode; style?: object | object[]; testID?: string }) {
    return React.createElement(tag, { style: Object.assign({}, ...(Array.isArray(style) ? style : [style])), "data-testid": testID }, children);
  };
  return { Text: component("span"), View: component("div"), StyleSheet: { create: <T,>(styles: T) => styles } };
});
vi.mock("@/hooks/use-colors", () => ({ useColors: () => Object.fromEntries(Object.entries(themeConfig.themeColors).map(([key, value]) => [key, value[theme.mode]])) }));

const render = (element: React.ReactElement) => renderToStaticMarkup(element);
function luminance(hex: string) {
  return rgbLuminance([1, 3, 5].map(start => parseInt(hex.slice(start, start + 2), 16)));
}
function rgbLuminance(values: number[]) {
  const rgb = values.map(value => value / 255)
    .map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
}

describe("existing wordbook section provenance", () => {
  it("reuses all eight real groups, keeps the V prefix and localizes only APPENDIX", () => {
    expect(SECTION_RANGES).toHaveLength(8);
    for (const range of SECTION_RANGES) {
      expect(formatVocabSections([range.group])).toBe(`단어장 · ${range.group === "APPENDIX" ? "부록" : range.group}`);
    }
    expect(formatVocabSections(["V601", "V101", "V101", "APPENDIX"])).toBe("단어장 · V101 · V601 · 부록");
  });

  it("does not guess missing groups from row numbers or spelling", () => {
    expect(formatVocabSections([])).toBe("섹션 연결 없음");
    expect(formatVocabSections([undefined, "101", "UNKNOWN"])).toBe("섹션 연결 없음");
    expect(getSynonymSourceGroups(VOCAB[0], "__unlinked_synonym__")).toEqual([]);
    expect(render(<WordSectionLabel groups={[]} />)).toContain("섹션 연결 없음");
  });

  it("keeps the original row group and identifies each synonym's own source groups", () => {
    const capricious = VOCAB.find(item => item.num === 1)!;
    expect(capricious.group).toBe("V101");
    expect(getSynonymSourceGroups(capricious, "erratic")).toEqual(["V502"]);
    expect(getSynonymSourceGroups(capricious, "fickle")).toEqual(["V101", "V502"]);
    const attract = VOCAB.find(item => item.num === 8045)!;
    expect(getSynonymSourceGroups(attract, "enthrall")).toEqual(["V101", "V301", "V601"]);
    expect(VOCAB.find(item => item.num === 37214)!.group).toBe("APPENDIX");
  });

  it("uses the same concept-first candidate rows as existing meanings, not every homograph", () => {
    const item = VOCAB.find(row => row.conceptId && row.s.some(synonym => {
      const all = VOCAB.filter(candidate => normalizeWord(candidate.w) === normalizeWord(synonym));
      return all.some(candidate => candidate.conceptId === row.conceptId) && all.some(candidate => candidate.conceptId !== row.conceptId);
    }))!;
    const synonym = item.s.find(word => VOCAB.some(candidate => normalizeWord(candidate.w) === normalizeWord(word) && candidate.conceptId === item.conceptId))!;
    const matches = VOCAB.filter(candidate => normalizeWord(candidate.w) === normalizeWord(synonym) && candidate.conceptId === item.conceptId);
    expect(getSynonymSourceGroups(item, synonym)).toEqual([...new Set(matches.map(candidate => candidate.group))]);
    expect(getSynonymDetails(item).find(detail => normalizeWord(detail.word) === normalizeWord(synonym))!.meaning)
      .toBe([...new Set(matches.map(candidate => candidate.k).filter(Boolean))].join(" / "));
  });

  it("renders the same metadata in compact synonym details without changing words or meanings", () => {
    const item = VOCAB[0];
    const details = getSynonymDetails(item);
    const html = render(<SynonymDetails item={item} compact limit={1} />);
    expect(html).toContain(details[0].word);
    expect(html).toContain(details[0].meaning);
    expect(html).toContain("단어장 · V502");
    expect(html.match(/data-testid="word-section-label"/g)).toHaveLength(1);
  });

  it("all 38,163 original rows and their existing synonym links retain known source groups", () => {
    expect(VOCAB).toHaveLength(38163);
    const known = new Set(SECTION_RANGES.map(range => range.group));
    for (const item of VOCAB) expect(known.has(item.group)).toBe(true);
    for (const item of VOCAB) for (const synonym of item.s) {
      const groups = getSynonymSourceGroups(item, synonym);
      expect(groups.length).toBeGreaterThan(0);
      expect(groups.every(group => known.has(group))).toBe(true);
    }
  });

  it.each(["light", "paper", "dark"] as const)("%s metadata is quiet, wrapping and readable on existing surfaces", mode => {
    theme.mode = mode;
    const html = render(<WordSectionLabel groups={["V301", "APPENDIX"]} />);
    expect(html).toContain("단어장 · V301 · 부록");
    expect(html).toContain("font-size:11px");
    expect(html).toContain("font-weight:400");
    expect(html).toContain("max-width:100%");
    expect(html).toContain("flex-shrink:1");
    const palette = themeConfig.themeColors;
    const surfaces = [palette.surface[mode], palette.card[mode]];
    const chipColors = [[108, 99, 255, 0.12], [...[1, 3, 5].map(start => parseInt(palette.primary[mode].slice(start, start + 2), 16)), 24 / 255]];
    for (const background of surfaces) {
      const foreground = luminance(palette.metadata[mode]);
      const surface = luminance(background);
      expect((Math.max(surface, foreground) + 0.05) / (Math.min(surface, foreground) + 0.05)).toBeGreaterThanOrEqual(4.5);
      for (const [red, green, blue, alpha] of chipColors) {
        const rgb = [1, 3, 5].map(start => parseInt(background.slice(start, start + 2), 16));
        const chip = rgbLuminance([red, green, blue].map((value, index) => value * alpha + rgb[index] * (1 - alpha)));
        expect((Math.max(chip, foreground) + 0.05) / (Math.min(chip, foreground) + 0.05)).toBeGreaterThanOrEqual(4.5);
      }
    }
  });
});
