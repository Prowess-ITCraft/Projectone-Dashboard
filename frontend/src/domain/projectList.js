import { statusOf } from './projects';
import { currentStage } from './stages';

export const ALL = 'all';

export const SORTS = {
  activity: 'Last activity',
  created: 'Date created',
};

/*
  Which projects the list shows. Search matches the project number, the customer name and site names; the other
  filters match exactly. `snapshots` are the project snapshots from the data layer.
*/
export function filterProjects(snapshots, { query = '', entryPath = ALL, stage = ALL, status = ALL, customerId = ALL } = {}) {
  const q = query.trim().toLowerCase();
  return snapshots.filter((s) => {
    if (entryPath !== ALL && s.project.entryPath !== entryPath) return false;
    if (status !== ALL && statusOf(s.project) !== status) return false;
    if (customerId !== ALL && s.project.customerId !== customerId) return false;
    if (stage !== ALL && currentStage(s.tracker).id !== stage) return false;
    if (!q) return true;
    const text = [s.project.number, s.customer?.name, ...(s.sites ?? []).map((x) => x.name)].join(' ').toLowerCase();
    return text.includes(q);
  });
}

/* Newest first, by last activity (the default) or by the date created */
export function sortProjects(snapshots, by = 'activity') {
  const key = (s) => (by === 'created' ? s.project.createdAt : (s.lastActivityAt ?? s.project.createdAt));
  return [...snapshots].sort((a, b) => key(b) - key(a));
}
