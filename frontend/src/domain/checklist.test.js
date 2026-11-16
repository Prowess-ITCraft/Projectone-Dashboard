import { describe, expect, it } from 'vitest';
import { catalog } from '@/data/fixtures/catalog';
import {
  applyAddRow,
  applyDeleteRow,
  applyPatchRow,
  applyTask,
  catStats,
  emptyChecklistState,
  itemStats,
  tasksFor,
  totals,
} from './checklist';

const items = catalog.items;
const firewall = items.find((i) => i.id === 'firewall');
const at = Date.UTC(2026, 10, 16, 12);

describe('itemStats', () => {
  it('reports zero progress when nothing has been recorded', () => {
    const s = itemStats(emptyChecklistState(), firewall);
    expect(s).toMatchObject({ done: 0, prog: 0, pct: 0 });
    expect(s.pending).toBe(s.total);
  });

  it('counts done and in progress tasks for one work type', () => {
    const [first, second] = tasksFor(firewall, 'new');
    const state = { ...emptyChecklistState(), tasks: { [first.key]: { s: 2 }, [second.key]: { s: 1 } } };
    const s = itemStats(state, firewall, 'new');
    expect(s).toMatchObject({ done: 1, prog: 1, total: tasksFor(firewall, 'new').length });
    expect(s.pct).toBe(Math.round((1 / s.total) * 100));
  });
});

describe('totals and pillars', () => {
  it('sums every task of every component across both work types', () => {
    const expected = items.reduce((n, it) => n + tasksFor(it, 'new').length + tasksFor(it, 'existing').length, 0);
    expect(totals(emptyChecklistState(), items)).toMatchObject({ total: expected, pct: 0 });
  });

  it('gives each pillar a percentage', () => {
    expect(catStats(emptyChecklistState(), items).every((c) => c.pct === 0)).toBe(true);
  });
});

describe('applyTask', () => {
  const key = tasksFor(firewall, 'new')[0].key;

  it('starts the task on first touch and ends it when done, logging the completion once', () => {
    const started = applyTask(emptyChecklistState(), key, { s: 1 }, 'Firewall: step', at);
    expect(started.tasks[key]).toMatchObject({ s: 1, start: '2026-11-16', end: '' });
    const done = applyTask(started, key, { s: 2 }, 'Firewall: step', at);
    expect(done.tasks[key]).toMatchObject({ s: 2, end: '2026-11-16' });
    expect(done.log).toHaveLength(1);
    expect(applyTask(done, key, { c: 'note' }, 'Firewall: step', at).log).toHaveLength(1);
  });

  it('clears the dates when a task goes back to pending', () => {
    const done = applyTask(emptyChecklistState(), key, { s: 2 }, 'x', at);
    expect(applyTask(done, key, { s: 0 }, 'x', at).tasks[key]).toMatchObject({ s: 0, start: '', end: '' });
  });
});

describe('questionnaire rows', () => {
  it('adds, patches and deletes a row and logs the addition', () => {
    const added = applyAddRow(emptyChecklistState(), 'firewall', { user: 'Asha' }, 'r1', 'Firewall Policy Questionnaire', at);
    expect(added.q.firewall).toEqual([{ user: 'Asha', id: 'r1' }]);
    expect(added.log[0].text).toContain('Asha');
    expect(applyPatchRow(added, 'firewall', 'r1', { vpn: 1 }).q.firewall[0].vpn).toBe(1);
    expect(applyDeleteRow(added, 'firewall', 'r1').q.firewall).toEqual([]);
  });
});
