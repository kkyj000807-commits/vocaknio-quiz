// Display versions may stay fixed. Data partitions are compatibility IDs and
// must not be renamed when the visible product version changes.
const safeVersion = (value) => typeof value === "string" && /^\d+(?:\.\d+)+$/.test(value);

export function formatReleaseTimeKst(builtAt, includeSeconds = true) {
  const date = new Date(builtAt);
  if (!Number.isFinite(date.getTime())) throw new Error("Invalid release timestamp");
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", ...(includeSeconds ? { second: "2-digit" } : {}),
    hourCycle: "h23",
  }).formatToParts(date);
  const value = (type) => parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}.${value("month")}.${value("day")} ${value("hour")}:${value("minute")}${includeSeconds ? ":" + value("second") : ""} KST`;
}

export function createReleaseMetadata(config, source) {
  const version = config.displayVersion ?? config.version;
  if (!safeVersion(version) || !safeVersion(config.version)) throw new Error("Invalid release version");
  const modifiedAtKst = formatReleaseTimeKst(source.builtAt);
  return {
    version, sourceCommit: source.sourceCommit, sourceDirty: source.sourceDirty,
    dataVersion: source.dataVersion, learningDataVersion: config.version,
    builtAt: source.builtAt, modifiedAtKst, channel: "production",
    target: `${version}|${modifiedAtKst}`,
  };
}

export function isReleaseMetadataValid(release) {
  if (!release || typeof release !== "object" || !safeVersion(release.version) ||
    !safeVersion(release.learningDataVersion) || !safeVersion(release.dataVersion) ||
    !/^[a-f0-9]{40}$/.test(release.sourceCommit ?? "") ||
    typeof release.sourceDirty !== "boolean" || typeof release.builtAt !== "string" ||
    !Number.isFinite(Date.parse(release.builtAt)) || release.channel !== "production" ||
    release.target !== `${release.version}|${release.modifiedAtKst}`) return false;
  // Old public manifests used minute resolution; new builds include seconds.
  return [formatReleaseTimeKst(release.builtAt), formatReleaseTimeKst(release.builtAt, false)]
    .includes(release.modifiedAtKst);
}
