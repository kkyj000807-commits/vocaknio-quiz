import fs from "node:fs";
import path from "node:path";

export function requireEmptyOutput(directory) {
  if (!directory) throw new Error("Production 출력 폴더를 지정하세요.");
  const target = path.resolve(directory);
  if (
    fs.existsSync(target) &&
    (!fs.statSync(target).isDirectory() || fs.readdirSync(target).length)
  ) {
    throw new Error(
      `새 빌드는 빈 폴더에만 만듭니다. 기존 파일을 보존했습니다: ${target}`,
    );
  }
  return target;
}

export function createPagesFallback(directory) {
  fs.copyFileSync(path.join(directory, "+not-found.html"), path.join(directory, "404.html"));
}
