import Constants from "expo-constants";

import releaseConfig from "@/release.config.json";

const APP_VERSION = releaseConfig.version;

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

export const RELEASE_LABEL = `버전 ${RELEASE_INFO.version} · 최근 수정 ${RELEASE_INFO.modifiedAtKst} · Production 기준`;
