/*
  The project stages from the workflow (context pack 02), in strict order. A stage unlocks only when the one before
  it is done. Nothing is shown done unless a person recorded it. `built` says whether the app has screens for it yet.
*/
export const STAGES = [
  { id: 'trigger', no: 0, name: 'Order received', owner: 'Intake coordinator', gate: 'Order document stored', built: true },
  {
    id: 'intake',
    no: 1,
    name: 'Intake',
    owner: 'Intake coordinator',
    gate: 'Parsed lines reviewed and confirmed by the project lead',
    built: true,
  },
  {
    id: 'classify',
    no: 2,
    name: 'Classify',
    owner: 'Intake coordinator, project lead',
    gate: 'Every line classified, no unknown lines left',
    built: true,
  },
  { id: 'kickoff', no: 3, name: 'Kick-off', owner: 'Project lead', gate: 'Kick-off record complete', built: false },
  {
    id: 'lookup',
    no: 4,
    name: 'Lookup tables',
    owner: 'Project lead, senior engineer',
    gate: 'Mandatory lookup fields complete',
    built: false,
  },
  { id: 'planning', no: 5, name: 'Planning', owner: 'Project lead', gate: 'Customer and team accept the schedule', built: false },
  { id: 'execution', no: 6, name: 'Execution', owner: 'Field engineers', gate: 'All mandatory tasks verified', built: false },
  { id: 'validation', no: 7, name: 'Validation', owner: 'Senior engineer', gate: 'All product validations pass', built: false },
  {
    id: 'completion',
    no: 8,
    name: 'Completion and sign-off',
    owner: 'Project lead, customer',
    gate: 'Both approvals recorded',
    built: false,
  },
  { id: 'post', no: 9, name: 'Post-closure', owner: 'Project lead, Director', gate: 'Entitlements created', built: false },
];

export const ORDER_DOCUMENT_TYPES = ['pi', 'po'];

/*
  Where a project stands. `state` is done, todo (not done yet, shown red), blocked (cannot be done until something is fixed,
  shown red with the reason) or locked (an earlier stage is open, shown grey with the reason).
*/
export function computeTracker({ project, documents, lines }) {
  const active = documents.filter((d) => d.active && d.pendingDuplicate !== true);
  const orders = active.filter((d) => ORDER_DOCUMENT_TYPES.includes(d.type));
  const needDetails = orders.filter((d) => d.status === 'needs_manual');
  const unknown = lines.filter((l) => l.kind === 'unknown');
  const states = {};

  const triggerDone = orders.length > 0 && Boolean(project.entryPath);
  states.trigger = triggerDone
    ? { state: 'done' }
    : !project.entryPath
      ? { state: 'blocked', reason: 'Choose an entry path for this project.' }
      : { state: 'todo', reason: 'Upload a proforma invoice or a purchase order.' };

  const intakeDone = Boolean(project.intake?.at);
  states.intake = intakeDone
    ? { state: 'done' }
    : !triggerDone
      ? { state: 'locked', reason: 'Needs an order document and an entry path first.' }
      : needDetails.length
        ? { state: 'blocked', reason: `Enter the details of ${needDetails.map((d) => d.fileName).join(', ')}.` }
        : lines.length === 0
          ? { state: 'blocked', reason: 'The order has no lines yet.' }
          : { state: 'todo', reason: 'Review the lines and confirm them.' };

  const classifyDone = Boolean(project.classify?.at);
  states.classify = classifyDone
    ? { state: 'done' }
    : !intakeDone
      ? { state: 'locked', reason: 'Confirm the intake lines first.' }
      : unknown.length
        ? { state: 'blocked', reason: `${unknown.length} ${unknown.length === 1 ? 'line is' : 'lines are'} still unknown.` }
        : { state: 'todo', reason: 'Confirm the classification to create the modules.' };

  let previousDone = classifyDone;
  const result = STAGES.map((stage) => {
    if (states[stage.id]) {
      const s = { ...stage, ...states[stage.id] };
      previousDone = s.state === 'done';
      return s;
    }
    const reason = previousDone ? 'Not available yet.' : `Locked until stage ${stage.no - 1} is done.`;
    previousDone = false;
    return { ...stage, state: 'locked', reason };
  });
  return result;
}

/* The first stage that is not done, for "where is this project" labels */
export const currentStage = (tracker) => tracker.find((s) => s.state !== 'done') ?? tracker[tracker.length - 1];
