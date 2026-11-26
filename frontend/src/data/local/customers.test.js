import { beforeEach, describe, expect, it } from 'vitest';
import { createFixtures } from '@/data/fixtures';
import { createLocalApi } from './localApi';
import { createMemoryStorage } from './storage';

const admin = { role: 'admin', name: 'Asha' };
const engineer = { role: 'engineer', name: 'Ravi' };
const uploader = { role: 'admin', name: 'Ravi' };
const pdf = (name = 'file.pdf', text = name) => new File([text], name, { type: 'application/pdf' });

let api;
let storage;
let clock;
const make = (store) => createLocalApi({ storage: store, fixtures: createFixtures({ allowPrivate: false }), now: () => (clock += 1000) });

beforeEach(() => {
  clock = Date.UTC(2026, 10, 17, 12);
  storage = createMemoryStorage();
  api = make(storage);
});

const project = (patch = {}) =>
  api.createProject({
    customer: { name: 'Alpha Industries', gstin: '27AAAAA0000A1Z5' },
    entryPath: 'post_audit',
    actor: admin,
    ...patch,
  });

describe('customers', () => {
  it('refuses a second customer with the same GSTIN, naming the one that has it', async () => {
    await project();
    await expect(
      api.createProject({ customer: { name: 'Other', gstin: '27aaaaa0000a1z5' }, entryPath: 'post_audit', actor: admin }),
    ).rejects.toThrow('already belongs to Alpha Industries (CUS-0001)');
  });

  it('edits details with an audit entry of the values before and after', async () => {
    const p = await project();
    await api.updateCustomer(p.customerId, { name: '  Alpha Industries Ltd ', contact: 'A. Person' }, { actor: admin });
    const { customer, activity } = await api.getCustomer(p.customerId);
    expect(customer.name).toBe('Alpha Industries Ltd');
    expect(activity[0]).toMatchObject({
      action: 'customer_updated',
      before: { name: 'Alpha Industries', contact: '' },
      after: { name: 'Alpha Industries Ltd', contact: 'A. Person' },
    });
  });

  it('refuses a blank name, a malformed GSTIN and a GSTIN that belongs to someone else', async () => {
    const a = await project();
    const b = await api.createProject({ customer: { name: 'Beta Works' }, entryPath: 'post_audit', actor: admin });
    await expect(api.updateCustomer(a.customerId, { name: ' ' }, { actor: admin })).rejects.toThrow('cannot be blank');
    await expect(api.updateCustomer(a.customerId, { gstin: '12345' }, { actor: admin })).rejects.toThrow('valid format');
    await expect(api.updateCustomer(b.customerId, { gstin: '27AAAAA0000A1Z5' }, { actor: admin })).rejects.toThrow('already belongs');
  });

  it('refuses a malformed contact email on create and on edit', async () => {
    await expect(
      api.createProject({ customer: { name: 'Mail Co', email: 'person@company' }, entryPath: 'post_audit', actor: admin }),
    ).rejects.toThrow('email address is not in a valid format');
    expect(await api.listCustomers()).toEqual([]);
    const p = await project();
    await expect(api.updateCustomer(p.customerId, { email: 'nope' }, { actor: admin })).rejects.toThrow('email address');
    await api.updateCustomer(p.customerId, { email: 'it@alpha.example' }, { actor: admin });
    expect((await api.getCustomer(p.customerId)).customer.email).toBe('it@alpha.example');
  });

  it('records nothing when nothing changed', async () => {
    const p = await project();
    await api.updateCustomer(p.customerId, { name: 'Alpha Industries' }, { actor: admin });
    expect((await api.getCustomer(p.customerId)).activity).toEqual([]);
  });
});

describe('sites', () => {
  it('saves nothing when a new site name is repeated, so no customer is left without a project', async () => {
    await expect(
      api.createProject({
        customer: { name: 'Gamma Ltd' },
        entryPath: 'post_audit',
        newSites: [{ name: 'Plant' }, { name: ' plant ' }],
        actor: admin,
      }),
    ).rejects.toThrow('given more than once');
    expect(await api.listCustomers()).toEqual([]);
    const ok = await api.createProject({ customer: { name: 'Gamma Ltd' }, entryPath: 'post_audit', actor: admin });
    expect((await api.getProject(ok.id)).customer.number).toBe('CUS-0001');
  });

  it('saves nothing when a chosen site belongs to another customer', async () => {
    const a = await project({ newSites: [{ name: 'Alpha site' }] });
    const [site] = await api.listSites(a.customerId);
    await expect(
      api.createProject({ customer: { name: 'Delta Ltd' }, entryPath: 'post_audit', siteIds: [site.id], actor: admin }),
    ).rejects.toThrow('does not belong');
    expect((await api.listCustomers()).map((c) => c.name)).toEqual(['Alpha Industries']);
  });

  it('adds sites while creating a project and covers several of them', async () => {
    const p = await project({ newSites: [{ name: 'Mumbai office' }, { name: 'Tarapur plant', address: 'MIDC' }, { name: ' ' }] });
    const snap = await api.getProject(p.id);
    expect(snap.sites.map((s) => s.name)).toEqual(['Mumbai office', 'Tarapur plant']);
  });

  it('keeps site names unique within a customer, ignoring case and spaces', async () => {
    const p = await project({ newSites: [{ name: 'Tarapur' }] });
    await expect(api.addSite(p.customerId, { name: '  tarapur ' }, { actor: admin })).rejects.toThrow('already has a site called');
    const other = await api.createProject({ customer: { name: 'Beta Works' }, entryPath: 'post_audit', actor: admin });
    await expect(api.addSite(other.customerId, { name: 'Tarapur' }, { actor: admin })).resolves.toMatchObject({ name: 'Tarapur' });
  });

  it('lets a project use only sites of its own customer', async () => {
    const a = await project({ newSites: [{ name: 'Alpha site' }] });
    const b = await api.createProject({
      customer: { name: 'Beta Works' },
      entryPath: 'post_audit',
      newSites: [{ name: 'Beta site' }],
      actor: admin,
    });
    const betaSite = (await api.listSites(b.customerId))[0];
    await expect(api.updateProject(a.id, { siteIds: [betaSite.id] }, { actor: admin })).rejects.toThrow('does not belong to this customer');
  });

  it('renames a site and records the change on the customer', async () => {
    const p = await project({ newSites: [{ name: 'Old name' }] });
    const [site] = await api.listSites(p.customerId);
    await api.updateSite(site.id, { name: 'New name', contact: 'Guard desk' }, { actor: admin });
    const { sites, activity } = await api.getCustomer(p.customerId);
    expect(sites[0]).toMatchObject({ name: 'New name', contact: 'Guard desk' });
    expect(activity.map((a) => a.action)).toEqual(['site_updated', 'site_added']);
  });

  it('moves a free-text location from before sites existed into a site, once', async () => {
    const old = createMemoryStorage();
    await old.put('customers', 'c1', { id: 'c1', number: 'CUS-0001', name: 'Old Customer', gstin: '', createdAt: 1 });
    await old.put('projects', 'p1', {
      id: 'p1',
      number: 'PRJ-2627-0001',
      customerId: 'c1',
      entryPath: 'post_audit',
      location: ' Khalapur ',
      createdAt: 1,
    });
    await old.put('projects', 'p2', {
      id: 'p2',
      number: 'PRJ-2627-0002',
      customerId: 'c1',
      entryPath: 'post_audit',
      location: 'khalapur',
      createdAt: 2,
    });
    const upgraded = make(old);
    await upgraded.ready();
    const sites = await upgraded.listSites('c1');
    expect(sites.map((s) => s.name)).toEqual(['Khalapur']);
    const p1 = await upgraded.getProject('p1');
    const p2 = await upgraded.getProject('p2');
    expect(p1.project.siteIds).toEqual([sites[0].id]);
    expect(p2.project.siteIds).toEqual([sites[0].id]);
    expect(p1.project.location).toBeUndefined();
    expect(p1.project.status).toBe('in_progress');
  });
});

describe('project status', () => {
  it('only an Admin changes it, and every change needs a reason that is recorded', async () => {
    const p = await project();
    await expect(api.setProjectStatus(p.id, 'on_hold', { actor: engineer, reason: 'x' })).rejects.toThrow('Only an Admin');
    await expect(api.setProjectStatus(p.id, 'on_hold', { actor: admin, reason: ' ' })).rejects.toThrow('reason');
    await api.setProjectStatus(p.id, 'on_hold', { actor: admin, reason: 'Customer asked to wait' });
    const snap = await api.getProject(p.id);
    expect(snap.project).toMatchObject({ status: 'on_hold', statusReason: 'Customer asked to wait' });
    const audit = await api.listAudit(p.id);
    expect(audit[0]).toMatchObject({
      action: 'status_changed',
      before: { status: 'in_progress' },
      after: { status: 'on_hold' },
      reason: 'Customer asked to wait',
    });
  });

  it('refuses to close before every stage is done', async () => {
    const p = await project();
    await expect(api.setProjectStatus(p.id, 'closed', { actor: admin })).rejects.toThrow('every stage is done');
  });

  it('locks work while on hold or cancelled, and unlocks it on resume', async () => {
    const p = await project();
    await api.setProjectStatus(p.id, 'on_hold', { actor: admin, reason: 'Site closed for a week' });
    await expect(api.addDocument({ projectId: p.id, type: 'pi', file: pdf(), actor: uploader })).rejects.toThrow('on hold');
    await expect(api.updateProject(p.id, { purpose: 'x' }, { actor: admin })).rejects.toThrow('Site closed for a week');
    await api.setProjectStatus(p.id, 'cancelled', { actor: admin, reason: 'Order withdrawn' });
    await expect(api.addDocument({ projectId: p.id, type: 'pi', file: pdf(), actor: uploader })).rejects.toThrow('cancelled');
    await api.setProjectStatus(p.id, 'in_progress', { actor: admin, reason: 'Order back on' });
    await expect(api.addDocument({ projectId: p.id, type: 'pi', file: pdf(), actor: uploader })).resolves.toBeTruthy();
    expect((await api.getProject(p.id)).project.statusReason).toBe('');
  });

  it('shows the pause on the tracker', async () => {
    const p = await project();
    await api.setProjectStatus(p.id, 'on_hold', { actor: admin, reason: 'Waiting' });
    const { tracker } = await api.getProject(p.id);
    expect(tracker.find((s) => s.state === 'blocked').reason).toMatch(/on hold.*Waiting/);
  });
});

describe('customer page and badge', () => {
  it('collects projects, documents and the PrismSuite badge across projects', async () => {
    const a = await project({ newSites: [{ name: 'Mumbai' }] });
    const b = await api.createProject({ customer: { id: a.customerId }, entryPath: 'new_infra', actor: admin });
    await api.addDocument({ projectId: a.id, type: 'pi', file: pdf('order.pdf'), actor: uploader });
    let view = await api.getCustomer(a.customerId);
    expect(view.projects.map((x) => x.project.number).sort()).toEqual(['PRJ-2627-0001', 'PRJ-2627-0002']);
    expect(view.documents.map((d) => d.projectNumber)).toEqual(['PRJ-2627-0001']);
    expect(view.audited).toBe(false);

    const { document } = await api.addDocument({ projectId: b.id, type: 'prismsuite', file: pdf('report.pdf'), actor: uploader });
    view = await api.getCustomer(a.customerId);
    expect(view.audited).toBe(true);
    expect((await api.getProject(a.id)).audited).toBe(true);

    await api.removeDocument(document.id, { actor: uploader });
    expect((await api.getCustomer(a.customerId)).audited).toBe(false);
  });

  it('summarises each customer for the list', async () => {
    const a = await project({ newSites: [{ name: 'One' }, { name: 'Two' }] });
    await api.createProject({ customer: { id: a.customerId }, entryPath: 'post_audit', actor: admin });
    const b = await api.createProject({ customer: { id: a.customerId }, entryPath: 'post_audit', actor: admin });
    await api.setProjectStatus(b.id, 'cancelled', { actor: admin, reason: 'Duplicate request' });
    const [summary] = await api.listCustomerSummaries();
    expect(summary).toMatchObject({ projectCount: 3, openProjectCount: 2, audited: false });
    expect(summary.sites).toHaveLength(2);
  });

  it('dates last activity from the latest audit entry of the project', async () => {
    const p = await project();
    const created = (await api.getProject(p.id)).lastActivityAt;
    await api.updateProject(p.id, { purpose: 'New network' }, { actor: admin });
    expect((await api.getProject(p.id)).lastActivityAt).toBeGreaterThan(created);
  });
});
