import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';

vi.mock('react-native', () => ({ View: ({ children }: { children: React.ReactNode }) => <div>{children}</div>, StyleSheet: { create: (value: unknown) => value } }));
vi.mock('react-native-reanimated', () => ({
  default: { View: ({ children }: { children: React.ReactNode }) => <div>{children}</div> },
  useSharedValue: (value: number) => ({ value }), useAnimatedStyle: (fn: () => unknown) => fn(),
  withTiming: (value: number) => value, interpolate: () => 0, Extrapolation: { CLAMP: 'clamp' },
}));
import { FlipCard } from '../components/flip-card';

describe('existing flip card keeps the answer private until reveal and grows with content', () => {
  it('does not mount the answer on the question face', () => {
    const html = renderToStaticMarkup(<FlipCard flipped={false} front={<span>뜻 확인</span>} back={<span>숨겨야 할 정답</span>} />);
    expect(html).toContain('뜻 확인'); expect(html).not.toContain('숨겨야 할 정답');
  });
  it('mounts the complete long answer only after reveal', () => {
    const answer = '긴 교재 뜻과 주석 '.repeat(100);
    const html = renderToStaticMarkup(<FlipCard flipped front={<span>뜻 확인</span>} back={<span>{answer}</span>} />);
    expect(html).toContain(answer); expect(html).not.toContain('뜻 확인');
  });
  it('uses natural layout rather than absolute faces over the following controls', () => {
    const source = fs.readFileSync('components/flip-card.tsx', 'utf8');
    expect(source).not.toContain('StyleSheet.absoluteFill');
    expect(source).toContain('flipped ? back : front');
  });
});
