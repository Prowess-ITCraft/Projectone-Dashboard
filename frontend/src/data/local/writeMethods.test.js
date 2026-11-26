import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { WRITE_METHODS } from './localApi';

describe('local api write methods', () => {
  it('lists every method that writes, so each runs on its own transaction storage', () => {
    const source = readFileSync('src/data/local/localApi.js', 'utf8').replace(/\r\n/g, '\n');
    const written = [...source.matchAll(/^ {4}(\w+):[^\n]*=>\n\s+write\(/gm)].map((m) => m[1]);
    expect([...WRITE_METHODS].sort()).toEqual(written.sort());
  });
});
