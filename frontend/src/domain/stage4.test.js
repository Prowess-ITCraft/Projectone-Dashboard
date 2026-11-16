import { describe, expect, it } from 'vitest';
import { isAudited, isValidEmail } from './customers';
import { filterProjects, sortProjects } from './projectList';
import { lockedByStatus, nextStatuses, siteKey, statusChangeProblem, statusOf } from './projects';
import { computeTracker } from './stages';

describe('project status', () => {
  it('starts in progress', () => {
    expect(statusOf({})).toBe('in_progress');
  });

  it('allows only the agreed moves', () => {
    expect(nextStatuses('in_progress')).toEqual(['on_hold', 'cancelled', 'closed']);
    expect(nextStatuses('on_hold')).toEqual(['in_progress', 'cancelled']);
    expect(nextStatuses('cancelled')).toEqual(['in_progress']);
    expect(nextStatuses('closed')).toEqual([]);
  });

  it('needs a reason for every change except closing', () => {
    expect(statusChangeProblem('in_progress', 'on_hold', { reason: ' ' })).toMatch(/reason/);
    expect(statusChangeProblem('in_progress', 'on_hold', { reason: 'Customer asked to wait' })).toBeNull();
    expect(statusChangeProblem('in_progress', 'closed', { allStagesDone: true })).toBeNull();
  });

  it('closes only when every stage is done, and a closed project never changes', () => {
    expect(statusChangeProblem('in_progress', 'closed', { allStagesDone: false })).toMatch(/every stage is done/);
    expect(statusChangeProblem('closed', 'in_progress', { reason: 'x' })).toMatch(/closed project cannot change/);
  });

  it('refuses moves that are not allowed and the same status', () => {
    expect(statusChangeProblem('cancelled', 'on_hold', { reason: 'x' })).toMatch(/cannot become on hold/);
    expect(statusChangeProblem('on_hold', 'on_hold', { reason: 'x' })).toMatch(/already on hold/);
    expect(statusChangeProblem('in_progress', 'paused', { reason: 'x' })).toMatch(/listed statuses/);
  });

  it('explains why work is locked, with the reason', () => {
    expect(lockedByStatus({ status: 'in_progress' })).toBeNull();
    expect(lockedByStatus({ status: 'on_hold', statusReason: 'Site closed' })).toMatch(/on hold.*Reason: Site closed/);
    expect(lockedByStatus({ status: 'cancelled' })).toMatch(/cancelled/);
    expect(lockedByStatus({ status: 'closed' })).toMatch(/closed/);
  });
});

describe('the tracker while a project is paused', () => {
  const order = { id: 'd1', type: 'pi', active: true, status: 'parsed', fileName: 'pi.pdf' };
  const lines = [{ id: 'l1', kind: 'product' }];

  it('keeps done stages done and blocks the stage it stopped at with the status reason', () => {
    const project = { entryPath: 'post_audit', status: 'on_hold', statusReason: 'Waiting for the customer' };
    const tracker = computeTracker({ project, documents: [order], lines });
    expect(tracker[0].state).toBe('done');
    expect(tracker[1]).toMatchObject({ state: 'blocked' });
    expect(tracker[1].reason).toMatch(/on hold.*Waiting for the customer/);
    expect(tracker[2].state).toBe('locked');
  });

  it('is unchanged while in progress', () => {
    const tracker = computeTracker({ project: { entryPath: 'post_audit' }, documents: [order], lines });
    expect(tracker[1].state).toBe('todo');
  });
});

describe('sites', () => {
  it('compares names without case or extra spaces', () => {
    expect(siteKey('  Tarapur   Plant ')).toBe(siteKey('tarapur plant'));
    expect(siteKey('Khalapur')).not.toBe(siteKey('Tarapur'));
  });
});

describe('PrismSuite badge rule', () => {
  it('counts only an active, decided PrismSuite report', () => {
    expect(isAudited([{ type: 'prismsuite', active: true }])).toBe(true);
    expect(isAudited([{ type: 'prismsuite', active: false }])).toBe(false);
    expect(isAudited([{ type: 'prismsuite', active: true, pendingDuplicate: true }])).toBe(false);
    expect(isAudited([{ type: 'pi', active: true }])).toBe(false);
    expect(isAudited([])).toBe(false);
  });
});

describe('projects list filters and sort', () => {
  const tracker = (stageId) => [
    { id: 'trigger', state: stageId === 'trigger' ? 'todo' : 'done' },
    { id: 'intake', state: 'todo' },
  ];
  const make = (n, extra = {}) => ({
    project: {
      id: `p${n}`,
      number: `PRJ-2627-000${n}`,
      customerId: extra.customerId ?? 'c1',
      entryPath: 'post_audit',
      createdAt: n,
      ...extra.project,
    },
    customer: { id: extra.customerId ?? 'c1', name: extra.customerName ?? 'Alpha Industries' },
    sites: extra.sites ?? [],
    tracker: tracker(extra.stage ?? 'intake'),
    lastActivityAt: extra.activity ?? n,
  });
  const rows = [
    make(1, { activity: 50, sites: [{ name: 'Tarapur' }] }),
    make(2, { customerId: 'c2', customerName: 'Beta Works', project: { status: 'on_hold', entryPath: 'new_infra' }, stage: 'trigger' }),
    make(3, { activity: 10 }),
  ];

  it('searches the number, customer name and site names', () => {
    expect(filterProjects(rows, { query: 'tarapur' }).map((r) => r.project.id)).toEqual(['p1']);
    expect(filterProjects(rows, { query: 'beta' }).map((r) => r.project.id)).toEqual(['p2']);
    expect(filterProjects(rows, { query: '0003' }).map((r) => r.project.id)).toEqual(['p3']);
  });

  it('filters by entry path, status, customer and current stage', () => {
    expect(filterProjects(rows, { entryPath: 'new_infra' }).map((r) => r.project.id)).toEqual(['p2']);
    expect(filterProjects(rows, { status: 'in_progress' }).map((r) => r.project.id)).toEqual(['p1', 'p3']);
    expect(filterProjects(rows, { customerId: 'c2' }).map((r) => r.project.id)).toEqual(['p2']);
    expect(filterProjects(rows, { stage: 'trigger' }).map((r) => r.project.id)).toEqual(['p2']);
  });

  it('sorts by last activity by default, or by date created', () => {
    expect(sortProjects(rows).map((r) => r.project.id)).toEqual(['p1', 'p3', 'p2']);
    expect(sortProjects(rows, 'created').map((r) => r.project.id)).toEqual(['p3', 'p2', 'p1']);
  });
});

describe('contact email format', () => {
  it('accepts a plain address and refuses obvious typos', () => {
    expect(isValidEmail('person@company.com')).toBe(true);
    expect(isValidEmail(' person@company.co.in ')).toBe(true);
    ['person@company', 'person company@x.com', '@company.com', 'person@', ''].forEach((v) => expect(isValidEmail(v)).toBe(false));
  });
});
