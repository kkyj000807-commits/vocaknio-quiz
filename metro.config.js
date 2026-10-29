const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const resource = require("./scripts/lib/resource-budget.cjs");
const { personalVocabPath } = require("./scripts/lib/personal-vocab.cjs");

const config = getDefaultConfig(__dirname);
// Covers direct Expo dev as well as the guarded Production entrypoint.
config.maxWorkers = resource.chooseResourceBudget(resource.readMemorySnapshotSync(), { kind: "build" }).workers;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === "@/assets/book-edition-v1.5.json" && process.env.FINETUNE_PERSONAL_VOCAB === "1") {
    if (process.env.FINETUNE_DEPLOY_TARGET !== "private") throw new Error("Private book edition cannot be public");
    return { type: "sourceFile", filePath: require('node:path').join(__dirname, 'analysis/book-edition-v1.5/current.json') };
  }
  if (moduleName === "@/assets/personal-vocab.json") {
    return { type: "sourceFile", filePath: personalVocabPath(__dirname) };
  }
  return context.resolveRequest(context, moduleName, platform);
};

// This unrelated Python scratch environment causes EPERM during every file crawl.
const existingBlockList = config.resolver.blockList ?? [];
config.resolver.blockList = [
  ...(Array.isArray(existingBlockList) ? existingBlockList : [existingBlockList]),
  /[/\\]tmp[/\\]pydeps2(?:[/\\]|$)/,
];

module.exports = withNativeWind(config, {
  input: "./global.css",
  // Force write CSS to file system instead of virtual modules
  // This fixes iOS styling issues in development mode
  forceWriteFileSystem: true,
});
