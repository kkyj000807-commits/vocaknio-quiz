import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('FINETUNE supplied brand delivery', () => {
  it('ships the square mark at exact browser and home-screen sizes', () => {
    for (const [path, size] of [
      ['assets/images/finetune-ft-v2.png', 1024],
      ['assets/images/finetune-home-v2.png', 180],
      ['assets/images/finetune-favicon-v2.png', 64],
      ['public/brand/finetune-touch-v2.png', 180],
      ['public/brand/finetune-share-v2.png', 512],
    ] as const) {
      const png = readFileSync(path);
      expect(png.subarray(1, 4).toString()).toBe('PNG');
      expect(png.readUInt32BE(16)).toBe(size);
      expect(png.readUInt32BE(20)).toBe(size);
    }
  });
  it('links static social and Apple assets without changing app identity', () => {
    const html = readFileSync('app/+html.tsx', 'utf8');
    expect(html).toContain('property="og:image"');
    expect(html).toContain('/vocaknio-quiz/brand/finetune-share-v2.png');
    expect(html).toContain('rel="apple-touch-icon"');
    const config = readFileSync('app.config.ts', 'utf8');
    expect(config).toContain('space.manus.vocaknio.quiz.t20260325131801');
    expect(config).toContain('appSlug: "vocaknio-quiz"');
    expect(config).toContain('scheme: env.scheme');
    expect(config).toContain('./assets/images/finetune-ft-v2.png');
  });
});
