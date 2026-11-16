/* How the work came about; it changes what the project contains, not the order of its stages (context pack 02) */
export const ENTRY_PATHS = { post_audit: 'Post-audit', new_infra: 'New infrastructure', restructuring: 'Restructuring' };

export const entryPathLabel = (path) => ENTRY_PATHS[path] ?? 'Not set';

/*
  Whether work on a project is moving. It is separate from the stage, which is always worked out from what people
  recorded. Only "in progress" lets work be recorded; the others keep what was done and lock everything else.
*/
export const PROJECT_STATUS = {
  in_progress: { label: 'In progress', tone: 'accent' },
  on_hold: { label: 'On hold', tone: 'warning' },
  cancelled: { label: 'Cancelled', tone: 'muted' },
  closed: { label: 'Closed', tone: 'positive' },
};

export const statusOf = (project) => project?.status ?? 'in_progress';

const MOVES = {
  in_progress: ['on_hold', 'cancelled', 'closed'],
  on_hold: ['in_progress', 'cancelled'],
  cancelled: ['in_progress'],
  closed: [],
};

/* The statuses a project may move to from where it is now */
export const nextStatuses = (from) => MOVES[from] ?? [];

const lower = (status) => PROJECT_STATUS[status].label.toLowerCase();

/* Why a status change is not allowed, or null when it is. Every change except closing needs a reason. */
export function statusChangeProblem(from, to, { allStagesDone = false, reason = '' } = {}) {
  if (!PROJECT_STATUS[to]) return 'Choose one of the listed statuses.';
  if (from === to) return `The project is already ${lower(to)}.`;
  if (from === 'closed') return 'A closed project cannot change.';
  if (!MOVES[from]?.includes(to)) return `A project that is ${lower(from)} cannot become ${lower(to)}.`;
  if (to === 'closed' && !allStagesDone) return 'A project closes only when every stage is done.';
  if (to !== 'closed' && !String(reason).trim()) return 'Give a reason for the change.';
  return null;
}

/* The message shown when work is attempted on a project that is not in progress, or null when work may go on */
export function lockedByStatus(project) {
  const status = statusOf(project);
  if (status === 'in_progress') return null;
  const why = project.statusReason ? ` Reason: ${project.statusReason}` : '';
  if (status === 'on_hold') return `This project is on hold. Resume it before recording more work.${why}`;
  if (status === 'cancelled') return `This project is cancelled. Reopen it before recording more work.${why}`;
  return 'This project is closed.';
}

/* Site names are compared without case or extra spaces, so "Tarapur" and " tarapur " are one site */
export const siteKey = (name) =>
  String(name ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
