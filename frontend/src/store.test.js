import { describe, expect, it } from 'vitest';
import { ITEMS } from './data.js';
import { itemStats, tasksFor, totals } from './store.jsx';

const empty = { tasks: {}, q: { firewall: [], server: [] }, log: [] };
const firewall = ITEMS.find((i) => i.id === 'firewall');

describe('itemStats', () => {
  it('reports zero progress when nothing has been recorded', () => {
    const s = itemStats(empty, firewall);
    expect(s.done).toBe(0);
    expect(s.prog).toBe(0);
    expect(s.pct).toBe(0);
    expect(s.pending).toBe(s.total);
  });

  it('counts done and in progress tasks for one work type', () => {
    const [first, second] = tasksFor(firewall, 'new');
    const state = { ...empty, tasks: { [first.key]: { s: 2 }, [second.key]: { s: 1 } } };
    const s = itemStats(state, firewall, 'new');
    expect(s.done).toBe(1);
    expect(s.prog).toBe(1);
    expect(s.total).toBe(tasksFor(firewall, 'new').length);
    expect(s.pct).toBe(Math.round((1 / s.total) * 100));
  });
});

describe('totals', () => {
  it('sums every task of every component across both work types', () => {
    const expected = ITEMS.reduce((n, it) => n + tasksFor(it, 'new').length + tasksFor(it, 'existing').length, 0);
    const t = totals(empty);
    expect(t.total).toBe(expected);
    expect(t.pct).toBe(0);
  });
});
