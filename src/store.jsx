import { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import { ITEMS, QUESTIONNAIRES } from './data.js';

const KEY = 'projectone.v4';
export const MODES = { new: 'New Installation', existing: 'Existing Reconfiguration' };
export const CATS = ['Network', 'Endpoint', 'Data', 'Identity & Access', 'Resilience'];

export const tasksFor = (item, mode) =>
  item.tasks[mode].map(([phase, title, demo], i) => ({ phase, title, demo: !!demo, sn: i + 1, key: `${item.id}|${mode}|${i}` }));

let uid = 1;
const newId = () => `${Date.now().toString(36)}${uid++}`;

// Everything starts empty: nothing is checked or answered until an engineer does it.
const empty = () => ({ tasks: {}, q: { firewall: [], server: [] }, log: [] });
const day = (offset = 0) => new Date(Date.now() + offset * 864e5).toISOString().slice(0, 10);

function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    if (s && s.tasks) return s;
  } catch {}
  return empty();
}

const Ctx = createContext(null);
export const useStore = () => useContext(Ctx);

export function StoreProvider({ children }) {
  const [state, setState] = useState(load);

  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {}
  }, [state]);

  const setTask = useCallback((key, patch, label) => {
    setState((s) => {
      const prev = s.tasks[key] || { s: 0, start: '', end: '', c: '' };
      const next = { ...prev, ...patch };
      if (patch.s !== undefined) {
        if (next.s > 0 && !next.start) next.start = day();
        if (next.s === 2 && !next.end) next.end = day();
        if (next.s < 2) next.end = '';
        if (next.s === 0) next.start = '';
      }
      const log = patch.s === 2 && prev.s !== 2 && label
        ? [{ t: Date.now(), text: `${label} completed` }, ...s.log].slice(0, 30) : s.log;
      return { ...s, tasks: { ...s.tasks, [key]: next }, log };
    });
  }, []);

  const addRow = useCallback((kind, row) =>
    setState((s) => ({ ...s, q: { ...s.q, [kind]: [...s.q[kind], { ...row, id: newId() }] },
      log: [{ t: Date.now(), text: `${QUESTIONNAIRES[kind].title}: response added for ${row.user}` }, ...s.log].slice(0, 30) })), []);
  const patchRow = useCallback((kind, id, patch) =>
    setState((s) => ({ ...s, q: { ...s.q, [kind]: s.q[kind].map((r) => (r.id === id ? { ...r, ...patch } : r)) } })), []);
  const delRow = useCallback((kind, id) =>
    setState((s) => ({ ...s, q: { ...s.q, [kind]: s.q[kind].filter((r) => r.id !== id) } })), []);

  const reset = useCallback(() => setState(empty()), []);

  const value = useMemo(() => ({ state, setTask, addRow, patchRow, delRow, reset }), [state, setTask, addRow, patchRow, delRow, reset]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/* Progress for one item across both work types, or for one mode */
export function itemStats(state, item, mode) {
  const modes = mode ? [mode] : ['new', 'existing'];
  let done = 0, prog = 0, total = 0;
  modes.forEach((m) => tasksFor(item, m).forEach((t) => {
    total++;
    const s = state.tasks[t.key]?.s || 0;
    if (s === 2) done++; else if (s === 1) prog++;
  }));
  return { done, prog, total, pending: total - done - prog, pct: total ? Math.round((done / total) * 100) : 0 };
}

export function totals(state) {
  const t = { done: 0, prog: 0, total: 0, pending: 0 };
  ITEMS.forEach((it) => { const s = itemStats(state, it); t.done += s.done; t.prog += s.prog; t.total += s.total; t.pending += s.pending; });
  t.pct = t.total ? Math.round((t.done / t.total) * 100) : 0;
  return t;
}

export function catStats(state) {
  return CATS.map((c) => {
    let done = 0, total = 0;
    ITEMS.filter((i) => i.cat === c).forEach((it) => { const s = itemStats(state, it); done += s.done; total += s.total; });
    return { cat: c, pct: total ? Math.round((done / total) * 100) : 0 };
  });
}
