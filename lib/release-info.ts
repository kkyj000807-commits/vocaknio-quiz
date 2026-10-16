import Constants from "expo-constants";

import releaseConfig from "@/release.config.json";

const APP_VERSION = releaseConfig.displayVersion ?? releaseConfig.version;

type ProductionRelease = {
  version?: string;
  modifiedAtKst?: string;
  channel?: string;
};

const productionRelease = (Constants.expoConfig?.extra?.productionRelease ?? {}) as ProductionRelease;

export const RELEASE_INFO = {
  version: productionRelease.version ?? APP_VERSION,
  modifiedAtKst: productionRelease.modifiedAtKst ?? "미배포 빌드",
  channel: productionRelease.channel ?? "development",
} as const;

export function formatReleaseDisplayTime(value: string): string {
  return value.replace(/^(\d{4}\.\d{2}\.\d{2}) (\d{2}):([0-5]\d)(:[0-5]\d)? KST$/, (original, date: string, hour: string, minute: string, second: string | undefined) => {
    const hours = Number(hour);
    if (hours > 23) return original;
    return `${date} ${hours < 12 ? "오전" : "오후"} ${hours % 12 || 12}:${minute}${second ?? ""} KST`;
  });
}

export const RELEASE_LABEL = `버전 ${RELEASE_INFO.version} · 최근 수정 ${formatReleaseDisplayTime(RELEASE_INFO.modifiedAtKst)} · Production 기준`;
