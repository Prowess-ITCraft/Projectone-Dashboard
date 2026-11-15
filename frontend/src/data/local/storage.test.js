import { describe, expect, it } from 'vitest';
import { createBrowserStorage, createMemoryStorage } from './storage';

describe('memory storage', () => {
  it('stores, reads, lists, deletes and clears per store', async () => {
    const s = createMemoryStorage();
    await s.put('customers', 'a', { name: 'A' });
    await s.put('customers', 'b', { name: 'B' });
    await s.put('projects', 'p', { n: 1 });
    expect(await s.get('customers', 'a')).toEqual({ name: 'A' });
    expect((await s.getAll('customers')).map((c) => c.name)).toEqual(['A', 'B']);
    await s.delete('customers', 'a');
    expect(await s.get('customers', 'a')).toBeUndefined();
    await s.clear();
    expect(await s.getAll('projects')).toEqual([]);
  });

  it('hands out copies, so a caller cannot change what is stored', async () => {
    const s = createMemoryStorage();
    await s.put('meta', 'k', { list: [1] });
    const read = await s.get('meta', 'k');
    read.list.push(2);
    expect((await s.get('meta', 'k')).list).toEqual([1]);
  });
});

describe('browser storage', () => {
  it('answers immediately and falls back to memory when IndexedDB is missing, reporting it', async () => {
    const s = createBrowserStorage();
    expect(s.persistent).toBe(true);
    await s.put('meta', 'x', { v: 1 });
    expect(await s.get('meta', 'x')).toEqual({ v: 1 });
    expect(s.persistent).toBe(false);
  });
});
