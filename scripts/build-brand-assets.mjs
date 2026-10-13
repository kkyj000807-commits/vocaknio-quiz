// Deterministic resizing only; the supplied design is never regenerated here.
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const require = createRequire(import.meta.url);
const { generateImageAsync } = require('@expo/image-utils');
const src = process.argv[2];
if (!src) throw new Error('Provide the approved square FT PNG path');
for (const [file, size] of [
  ['assets/images/finetune-ft-v2.png', 1024],
  ['assets/images/finetune-home-v2.png', 180],
  ['assets/images/finetune-favicon-v2.png', 64],
  ['public/brand/finetune-touch-v2.png', 180],
  ['public/brand/finetune-share-v2.png', 512],
]) {
  const output = resolve(file);
  await mkdir(resolve(output, '..'), { recursive: true });
  const { source } = await generateImageAsync({ projectRoot: process.cwd() }, {
    src: resolve(src), width: size, height: size, resizeMode: 'contain',
  });
  await writeFile(output, source);
  console.log(`${file}: ${size}x${size}, ${source.length} bytes`);
}
