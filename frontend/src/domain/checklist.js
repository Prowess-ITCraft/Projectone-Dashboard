/*
  Pure rules for the component checklists and questionnaire tables: how a task patch is applied, and how progress is
  counted. The local adapter applies them to stored state; screens apply the same functions to show a change at once
  while the write finishes.
*/
export const MODES = { new: 'New Installation', existing: 'Existing Reconfiguration' };
export const CATS = ['Network', 'Endpoint', 'Data', 'Identity & Access', 'Resilience'];

const LOG_LIMIT = 30;

export const emptyChecklistState = () => ({ tasks: {}, q: { firewall: [], server: [] }, log: [] });

export const tasksFor = (item, mode) =>
  item.tasks[mode].map(([phase, title, demo], i) => ({ phase, title, demo: !!demo, sn: i + 1, key: `${item.id}|${mode}|${i}` }));

const dayOf = (at) => new Date(at).toISOString().slice(0, 10);

/* Applies a patch to one task. Dates follow the status: started when first touched, ended when done. */
export function applyTask(state, key, patch, label, at) {
  const prev = state.tasks[key] || { s: 0, start: '', end: '', c: '' };
  const next = { ...prev, ...patch };
  if (patch.s !== undefined) {
    if (next.s > 0 && !next.start) next.start = dayOf(at);
    if (next.s === 2 && !next.end) next.end = dayOf(at);
    if (next.s < 2) next.end = '';
    if (next.s === 0) next.start = '';
  }
  const log =
    patch.s === 2 && prev.s !== 2 && label ? [{ t: at, text: `${label} completed` }, ...state.log].slice(0, LOG_LIMIT) : state.log;
  return { ...state, tasks: { ...state.tasks, [key]: next }, log };
}

export function applyAddRow(state, kind, row, id, title, at) {
  return {
    ...state,
    q: { ...state.q, [kind]: [...state.q[kind], { ...row, id }] },
    log: [{ t: at, text: `${title}: response added for ${row.user}` }, ...state.log].slice(0, LOG_LIMIT),
  };
}

export const applyPatchRow = (state, kind, id, patch) => ({
  ...state,
  q: { ...state.q, [kind]: state.q[kind].map((r) => (r.id === id ? { ...r, ...patch } : r)) },
});

export const applyDeleteRow = (state, kind, id) => ({ ...state, q: { ...state.q, [kind]: state.q[kind].filter((r) => r.id !== id) } });

/* Progress for one item across both work types, or for one mode */
export function itemStats(state, item, mode) {
  const modes = mode ? [mode] : ['new', 'existing'];
  let done = 0,
    prog = 0,
    total = 0;
  modes.forEach((m) =>
    tasksFor(item, m).forEach((t) => {
      total++;
      const s = state.tasks[t.key]?.s || 0;
      if (s === 2) done++;
      else if (s === 1) prog++;
    }),
  );
  return { done, prog, total, pending: total - done - prog, pct: total ? Math.round((done / total) * 100) : 0 };
}

export function totals(state, items) {
  const t = { done: 0, prog: 0, total: 0, pending: 0 };
  items.forEach((it) => {
    const s = itemStats(state, it);
    t.done += s.done;
    t.prog += s.prog;
    t.total += s.total;
    t.pending += s.pending;
  });
  t.pct = t.total ? Math.round((t.done / t.total) * 100) : 0;
  return t;
}

export function catStats(state, items) {
  return CATS.map((c) => {
    let done = 0,
      total = 0;
    items
      .filter((i) => i.cat === c)
      .forEach((it) => {
        const s = itemStats(state, it);
        done += s.done;
        total += s.total;
      });
    return { cat: c, pct: total ? Math.round((done / total) * 100) : 0 };
  });
}
