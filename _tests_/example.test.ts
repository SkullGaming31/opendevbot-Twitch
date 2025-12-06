import { describe, it, expect } from 'vitest';

describe('Vitest + TypeScript sanity', () => {
  it('basic arithmetic works', () => {
    expect(1 + 2).toBe(3);
  });

  it('string contains substring', () => {
    expect('hello world').toContain('world');
  });
});
