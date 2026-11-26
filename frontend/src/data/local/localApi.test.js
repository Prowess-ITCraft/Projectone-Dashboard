import { beforeEach, describe, expect, it } from 'vitest';
import { createFixtures, SAMPLE_HASHES } from '@/data/fixtures';
import { sha256Hex } from '@/lib/sha256';
import { createLocalApi } from './localApi';
import { createMemoryStorage } from './storage';

const lead = { role: 'admin', name: 'Asha' };
// the person doing intake work: an Admin now, since an engineer no longer uploads or edits lines (20 Nov 2026)
const intake = { role: 'admin', name: 'Ravi' };
const engineer = { role: 'engineer', name: 'Ravi' };
const because = 'Checked both versions';
const hashOf = (type) => Object.keys(SAMPLE_HASHES).find((h) => SAMPLE_HASHES[h] === type);

/* A file whose bytes hash to one of the known sample fingerprints, so the fixture lookup treats it as that sample */
function sampleFile(type, name = `${type}.pdf`) {
  const file = new File(['sample'], name, { type: 'application/pdf' });
  file.arrayBuffer = async () => new TextEncoder().encode('sample').buffer;
  return file;
}
const plainFile = (text, name = 'other.pdf') => new File([text], name, { type: 'application/pdf' });

let api;
let clock;
beforeEach(() => {
  gstinSeq = 0;
  clock = Date.UTC(2026, 10, 16, 12);
  const fixtures = createFixtures({ allowPrivate: false });
  const sampleHash = new Map();
  // the fake sample file hashes to a fixed value; point the fixture lookup at it per test
  api = createLocalApi({
    storage: createMemoryStorage(),
    fixtures: {
      ...fixtures,
      lookupByHash: (hash) => sampleHash.get(hash) ?? fixtures.lookupByHash(hash),
    },
    now: () => (clock += 1000),
  });
  api.__register = async (type) => sampleHash.set(await sha256Hex(new TextEncoder().encode('sample').buffer), type);
});

// Each new customer gets its own GSTIN (the first is 27AAAAA0000A1Z5), because two customers may not share one
let gstinSeq = 0;
const nextGstin = () => `27AAAAA${String(gstinSeq++).padStart(4, '0')}A1Z5`;

async function newProject(entryPath = 'post_audit', customer = { name: 'Test Customer', gstin: nextGstin() }) {
  return api.createProject({ customer, entryPath, actor: lead });
}

describe('customers and projects', () => {
  it('numbers projects by financial year and customers in sequence', async () => {
    const a = await newProject();
    const b = await newProject('new_infra', { name: 'Second Customer' });
    expect(a.number).toBe('PRJ-2627-0001');
    expect(b.number).toBe('PRJ-2627-0002');
    const customers = await api.listCustomers();
    expect(customers.map((c) => c.number).sort()).toEqual(['CUS-0001', 'CUS-0002']);
  });

  it('suggests an existing customer by GSTIN and lets the user reuse it', async () => {
    const a = await newProject();
    const matches = await api.findCustomerMatches({ gstin: '27aaaaa0000a1z5', name: 'Different spelling' });
    expect(matches).toHaveLength(1);
    expect(matches[0].reason).toBe('gstin');
    const again = await api.createProject({ customer: { id: matches[0].customer.id }, entryPath: 'restructuring', actor: lead });
    expect(again.customerId).toBe(a.customerId);
    expect(await api.listCustomers()).toHaveLength(1);
  });

  it('requires a customer name and a valid entry path', async () => {
    await expect(api.createProject({ customer: { name: ' ' }, actor: lead })).rejects.toThrow('Enter the customer name.');
    await expect(api.createProject({ customer: { name: 'X' }, entryPath: 'nonsense', actor: lead })).rejects.toThrow('entry path');
  });

  it('leaves the entry path open when none is given, and the tracker blocks on it', async () => {
    const p = await api.createProject({ customer: { name: 'No Path' }, actor: lead });
    expect(p.entryPath).toBeNull();
    const { tracker } = await api.getProject(p.id);
    expect(tracker[0]).toMatchObject({ state: 'blocked' });
    await api.updateProject(p.id, { entryPath: 'new_infra' }, { actor: lead });
    expect((await api.getProject(p.id)).tracker[0].state).toBe('todo');
  });
});

describe('uploading documents', () => {
  it('reads a recognised sample proforma invoice into classified lines', async () => {
    await api.__register('pi');
    const p = await newProject();
    const { document, recognised, duplicateOf } = await api.addDocument({
      projectId: p.id,
      type: 'pi',
      file: sampleFile('pi'),
      actor: intake,
    });
    expect(recognised).toBe(true);
    expect(duplicateOf).toBeNull();
    expect(document).toMatchObject({ type: 'pi', status: 'parsed', number: 'ITCRAFT/NN/2627/002', poType: 'call_confirmation' });
    const { lines, tracker } = await api.getProject(p.id);
    expect(lines).toHaveLength(10);
    expect(lines.filter((l) => l.kind === 'unknown')).toHaveLength(0);
    expect(tracker.find((s) => s.id === 'trigger').state).toBe('done');
    expect(tracker.find((s) => s.id === 'intake').state).toBe('todo');
  });

  it('sends a file it does not recognise to manual entry', async () => {
    const p = await newProject();
    const { document, recognised } = await api.addDocument({ projectId: p.id, type: 'po', file: plainFile('x'), actor: intake });
    expect(recognised).toBe(false);
    expect(document.status).toBe('needs_manual');
    expect((await api.getProject(p.id)).tracker.find((s) => s.id === 'intake').state).toBe('blocked');
  });

  it('attaches a PrismSuite report without lines', async () => {
    const p = await newProject();
    const { document } = await api.addDocument({ projectId: p.id, type: 'prismsuite', file: plainFile('r', 'report.pdf'), actor: intake });
    expect(document.status).toBe('attached');
    expect((await api.getProject(p.id)).lines).toEqual([]);
  });

  it('refuses unsupported file types, files that are too large, and unknown document types', async () => {
    const p = await newProject();
    await expect(api.addDocument({ projectId: p.id, type: 'pi', file: new File(['x'], 'a.png'), actor: intake })).rejects.toThrow(
      'Only PDF or Word (.docx)',
    );
    const huge = new File(['x'], 'big.pdf', { type: 'application/pdf' });
    Object.defineProperty(huge, 'size', { value: 26 * 1024 * 1024 });
    await expect(api.addDocument({ projectId: p.id, type: 'pi', file: huge, actor: intake })).rejects.toThrow('25 MB');
    await expect(api.addDocument({ projectId: p.id, type: 'bill', file: plainFile('x'), actor: intake })).rejects.toThrow(
      'kind of document',
    );
  });

  it('saves typed details with classified lines', async () => {
    const p = await newProject();
    const { document } = await api.addDocument({ projectId: p.id, type: 'pi', file: plainFile('a'), actor: intake });
    const header = {
      number: 'PI/1',
      date: '2026-11-01',
      billTo: { name: 'Test Customer', gstin: '', address: '', contact: '', email: '' },
    };
    const { duplicateOf } = await api.saveDocumentDetails(document.id, {
      header,
      lines: [
        { no: 1, title: 'QNAP TS-464 NAS', qty: 1, scopeItems: [] },
        { no: 2, title: 'QNAP Setup and installation', qty: 1, scopeItems: ['Share folders'] },
      ],
      actor: intake,
    });
    expect(duplicateOf).toBeNull();
    const { lines, documents } = await api.getProject(p.id);
    expect(documents[0].status).toBe('entered');
    expect(lines.map((l) => l.kind)).toEqual(['product', 'service']);
    expect(lines[1].pairedToLineId).toBe(lines[0].id);
  });

  it('rejects incomplete details', async () => {
    const p = await newProject();
    const { document } = await api.addDocument({ projectId: p.id, type: 'pi', file: plainFile('a'), actor: intake });
    const base = { header: { number: 'PI/2', date: '2026-11-01', billTo: {} }, actor: intake };
    await expect(
      api.saveDocumentDetails(document.id, { ...base, header: { ...base.header, number: '' }, lines: [{ title: 'x', qty: 1 }] }),
    ).rejects.toThrow('document number');
    await expect(api.saveDocumentDetails(document.id, { ...base, lines: [] })).rejects.toThrow('at least one');
    await expect(api.saveDocumentDetails(document.id, { ...base, lines: [{ title: 'x', qty: 0 }] })).rejects.toThrow('quantity');
  });
});

describe('duplicate documents', () => {
  it('holds a repeated document number for a decision and keeps the old one as history on replace', async () => {
    await api.__register('pi');
    const p = await newProject();
    const first = await api.addDocument({ projectId: p.id, type: 'pi', file: sampleFile('pi'), actor: intake });
    const second = await api.addDocument({ projectId: p.id, type: 'pi', file: sampleFile('pi', 'copy.pdf'), actor: intake });
    expect(second.duplicateOf.id).toBe(first.document.id);
    expect(second.document).toMatchObject({ active: false, pendingDuplicate: true });
    expect((await api.getProject(p.id)).lines).toHaveLength(10);

    await api.resolveDuplicate(second.document.id, 'replace', { actor: lead, reason: because });
    const { documents, lines } = await api.getProject(p.id);
    const old = documents.find((d) => d.id === first.document.id);
    expect(old).toMatchObject({ active: false, supersededBy: second.document.id });
    expect(documents.find((d) => d.id === second.document.id)).toMatchObject({ active: true, supersedes: first.document.id });
    expect(lines).toHaveLength(10);
    expect(lines.every((l) => l.documentId === second.document.id)).toBe(true);
  });

  it('drops the new upload and its file on cancel', async () => {
    await api.__register('pi');
    const p = await newProject();
    await api.addDocument({ projectId: p.id, type: 'pi', file: sampleFile('pi'), actor: intake });
    const dup = await api.addDocument({ projectId: p.id, type: 'pi', file: sampleFile('pi'), actor: intake });
    await api.resolveDuplicate(dup.document.id, 'cancel', { actor: lead, reason: because });
    const { documents, lines } = await api.getProject(p.id);
    expect(documents).toHaveLength(1);
    expect(lines).toHaveLength(10);
    expect(await api.getFile(dup.document.fileId)).toBeNull();
  });

  it('refuses to replace a document that belongs to another project', async () => {
    await api.__register('pi');
    const a = await newProject();
    const b = await newProject('new_infra', { name: 'Other' });
    await api.addDocument({ projectId: a.id, type: 'pi', file: sampleFile('pi'), actor: intake });
    const dup = await api.addDocument({ projectId: b.id, type: 'pi', file: sampleFile('pi'), actor: intake });
    await expect(api.resolveDuplicate(dup.document.id, 'replace', { actor: lead, reason: because })).rejects.toThrow('another project');
  });

  it('resets the confirmations when a confirmed order is replaced', async () => {
    await api.__register('pi');
    const p = await newProject();
    const first = await api.addDocument({ projectId: p.id, type: 'pi', file: sampleFile('pi'), actor: intake });
    await api.confirmIntake(p.id, { actor: lead });
    await expect(api.addDocument({ projectId: p.id, type: 'pi', file: sampleFile('pi'), actor: intake })).rejects.toThrow('Reopen');
    expect(first.document.status).toBe('parsed');
  });
});

describe('review, classification and modules', () => {
  async function confirmedSample(type = 'pi', entryPath = 'post_audit') {
    await api.__register(type);
    const p = await newProject(entryPath);
    await api.addDocument({ projectId: p.id, type, file: sampleFile(type), actor: intake });
    return p;
  }

  it('lets only the Admin confirm intake, and only when it is ready', async () => {
    const p = await newProject();
    await expect(api.confirmIntake(p.id, { actor: lead })).rejects.toThrow('Upload an order document');
    const q = await confirmedSample();
    await expect(api.confirmIntake(q.id, { actor: engineer })).rejects.toThrow('Admin');
    await api.confirmIntake(q.id, { actor: lead });
    const { project, tracker } = await api.getProject(q.id);
    expect(project.intake).toMatchObject({ by: 'Asha, Admin' });
    expect(tracker.find((s) => s.id === 'intake').state).toBe('done');
  });

  it('refuses to confirm intake without an entry path', async () => {
    await api.__register('pi');
    const p = await api.createProject({ customer: { name: 'No path' }, actor: lead });
    await api.addDocument({ projectId: p.id, type: 'pi', file: sampleFile('pi'), actor: intake });
    await expect(api.confirmIntake(p.id, { actor: lead })).rejects.toThrow('entry path');
  });

  it('locks line edits after intake is confirmed and unlocks them on reopen with a reason', async () => {
    const p = await confirmedSample();
    const { lines } = await api.getProject(p.id);
    await api.updateLine(lines[0].id, { title: 'Corrected title' }, { actor: intake });
    await api.confirmIntake(p.id, { actor: lead });
    await expect(api.updateLine(lines[0].id, { qty: 2 }, { actor: intake })).rejects.toThrow('Reopen');
    await expect(api.deleteLine(lines[0].id, { actor: intake })).rejects.toThrow('Reopen');
    await expect(api.reopenIntake(p.id, { actor: engineer, reason: 'x' })).rejects.toThrow('Admin');
    await expect(api.reopenIntake(p.id, { actor: lead, reason: ' ' })).rejects.toThrow('reason');
    await api.reopenIntake(p.id, { actor: lead, reason: 'Quantity was wrong' });
    expect((await api.getProject(p.id)).project.intake).toBeNull();
    expect((await api.listAudit(p.id)).find((a) => a.action === 'intake_reopened').reason).toBe('Quantity was wrong');
  });

  it('records who changed a classification and why, and requires a reason', async () => {
    const p = await confirmedSample('po', null);
    await api.updateProject(p.id, { entryPath: 'new_infra' }, { actor: lead });
    const { lines } = await api.getProject(p.id);
    const unnamed = lines.find((l) => l.suggestion);
    expect(unnamed.suggestion.moduleType).toBe('network_router');
    await expect(api.updateLine(unnamed.id, { pairedToLineId: unnamed.suggestion.pairedToLineId }, { actor: intake })).rejects.toThrow(
      'reason',
    );
    await api.updateLine(
      unnamed.id,
      { pairedToLineId: unnamed.suggestion.pairedToLineId },
      { actor: intake, reason: 'Same visit as the router install' },
    );
    const after = (await api.getProject(p.id)).lines.find((l) => l.id === unnamed.id);
    expect(after).toMatchObject({ moduleType: 'network_router', classificationSource: 'manual', suggestion: null });
    expect(after.reviewedBy.by).toBe('Ravi, Admin');
    const entry = (await api.listAudit(p.id)).find((a) => a.action === 'line_classified');
    expect(entry).toMatchObject({
      reason: 'Same visit as the router install',
      before: { moduleType: null },
      after: { moduleType: 'network_router' },
    });
  });

  it('blocks classification while a line is unknown and then creates a module per product', async () => {
    const p = await confirmedSample();
    await api.confirmIntake(p.id, { actor: lead });
    const { lines } = await api.getProject(p.id);
    await api.updateLine(lines[2].id, { kind: 'unknown' }, { actor: intake, reason: 'Testing' });
    await expect(api.confirmClassification(p.id, { actor: lead })).rejects.toThrow('unknown');
    await api.updateLine(lines[2].id, { kind: 'subscription' }, { actor: intake, reason: 'It is a licence' });
    await api.confirmClassification(p.id, { actor: lead });

    const { modules, entitlements, tracker } = await api.getProject(p.id);
    expect(modules.map((m) => m.moduleType)).toEqual(['nas', 'backup_software', 'cloud_backup', 'firewall', 'hosted_dr']);
    expect(modules.every((m) => m.status === 'awaiting_delivery' && m.deliveredOn === null)).toBe(true);
    expect(modules[3].serviceLineIds).toHaveLength(2);
    expect(modules[3].scopeItems).toContain('Defining Content Filtering Policies');
    expect(entitlements).toHaveLength(4);
    expect(entitlements.every((e) => e.status === 'pending_signoff' && e.startsAt === null)).toBe(true);
    expect(tracker.find((s) => s.id === 'classify').state).toBe('done');
  });

  it('attaches the sanitization service to the endpoint protection module and leaves an unassigned service for the lead', async () => {
    const p = await confirmedSample('po', 'new_infra');
    await api.confirmIntake(p.id, { actor: lead });
    await api.confirmClassification(p.id, { actor: lead });
    const { modules, lines } = await api.getProject(p.id);
    const eps = modules.find((m) => m.moduleType === 'eps');
    expect(eps.serviceLineIds).toHaveLength(2);
    const router = modules.find((m) => m.moduleType === 'network_router');
    expect(router.serviceLineIds).toHaveLength(0);

    const loose = lines.find((l) => l.kind === 'service' && !l.pairedToLineId && !modules.some((m) => m.serviceLineIds.includes(l.id)));
    await api.assignService(loose.id, router.id, { actor: lead });
    const after = (await api.getProject(p.id)).modules.find((m) => m.id === router.id);
    expect(after.serviceLineIds).toEqual([loose.id]);
  });

  it('reopens classification with a reason and removes the modules', async () => {
    const p = await confirmedSample();
    await api.confirmIntake(p.id, { actor: lead });
    await api.confirmClassification(p.id, { actor: lead });
    await expect(api.reopenClassification(p.id, { actor: lead, reason: '' })).rejects.toThrow('reason');
    await api.reopenClassification(p.id, { actor: lead, reason: 'Wrong module' });
    const { modules, entitlements, project } = await api.getProject(p.id);
    expect([modules.length, entitlements.length, project.classify]).toEqual([0, 0, null]);
  });

  it('records delivery only for the Admin and needs a status', async () => {
    const p = await confirmedSample();
    await api.confirmIntake(p.id, { actor: lead });
    await api.confirmClassification(p.id, { actor: lead });
    const [m] = (await api.getProject(p.id)).modules;
    await expect(api.setModuleDelivery(m.id, { status: 'delivered', deliveredOn: '2026-11-20' }, { actor: engineer })).rejects.toThrow(
      'Admin',
    );
    await expect(api.setModuleDelivery(m.id, { status: 'lost' }, { actor: lead })).rejects.toThrow('delivery status');
    await api.setModuleDelivery(m.id, { status: 'delivered', deliveredOn: '2026-11-20' }, { actor: lead });
    expect((await api.getProject(p.id)).modules[0]).toMatchObject({ status: 'delivered', deliveredOn: '2026-11-20' });
    await api.setModuleDelivery(m.id, { status: 'awaiting_delivery' }, { actor: lead });
    expect((await api.getProject(p.id)).modules[0].deliveredOn).toBeNull();
  });

  it('runs the rules again without touching lines a person changed', async () => {
    const p = await confirmedSample();
    const { lines } = await api.getProject(p.id);
    await api.updateLine(lines[0].id, { kind: 'service' }, { actor: intake, reason: 'Test' });
    await api.rerunRules(p.id, { actor: intake });
    const after = (await api.getProject(p.id)).lines;
    expect(after[0].kind).toBe('service');
    expect(after[0].classificationSource).toBe('manual');
  });

  it('adds the XDR rule to rules stored before it existed', async () => {
    const storage = createMemoryStorage();
    const legacy = createLocalApi({ storage, fixtures: createFixtures({ allowPrivate: false }), now: () => 1 });
    const stored = await legacy.getRules();
    await storage.put('rules', 'current', {
      ...stored,
      module: stored.module.filter((r) => !r.patterns.includes('\\bxdr\\b')),
    });
    const rules = await legacy.getRules();
    expect(rules.module.findIndex((r) => r.moduleType === 'eps')).toBeLessThan(
      rules.module.findIndex((r) => r.moduleType === 'backup_software'),
    );
    // Reading never writes: the stored copy stays as it was, one rule short
    expect((await storage.get('rules', 'current')).module).toHaveLength(rules.module.length - 1);
  });

  it('adds and deletes lines, clearing pairings that pointed at a deleted product', async () => {
    const p = await confirmedSample();
    const { lines, documents } = await api.getProject(p.id);
    await api.addLine(documents[0].id, { title: 'Sophos XGS-118 firewall', qty: 1 }, { actor: intake });
    expect((await api.getProject(p.id)).lines).toHaveLength(11);
    await api.deleteLine(lines[0].id, { actor: intake });
    const after = (await api.getProject(p.id)).lines;
    expect(after).toHaveLength(10);
    expect(after.find((l) => l.no === 2).pairedToLineId).toBeNull();
  });
});

describe('sample projects and reset', () => {
  it('creates the two sample projects once, the second without an entry path', async () => {
    const created = await api.loadSampleProjects({ actor: lead });
    expect(created).toHaveLength(2);
    expect(await api.loadSampleProjects({ actor: lead })).toEqual([]);
    const projects = await api.listProjects();
    expect(projects.map((x) => x.project.entryPath).sort((a, b) => String(a).localeCompare(String(b)))).toEqual([null, 'post_audit']);
    const withReport = projects.find((x) => x.project.entryPath === 'post_audit');
    expect(withReport.documents.map((d) => d.type).sort()).toEqual(['pi', 'prismsuite']);
    expect(withReport.customer.name).toBe('M/S Sample Industries');
  });

  it('wipes everything on reset, for the Admin only', async () => {
    await api.loadSampleProjects({ actor: lead });
    await expect(api.resetAll({ actor: engineer })).rejects.toThrow('Admin');
    await api.resetAll({ actor: lead });
    expect(await api.listProjects()).toEqual([]);
    expect(await api.listCustomers()).toEqual([]);
  });

  it('notifies subscribers after a write', async () => {
    await api.ready();
    let calls = 0;
    const off = api.subscribe(() => calls++);
    await newProject();
    off();
    await newProject();
    expect(calls).toBe(1);
  });
});

describe('fixtures', () => {
  it('knows the three sample fingerprints', () => {
    expect(['pi', 'po', 'prismsuite'].map((t) => createFixtures().lookupByHash(hashOf(t)))).toEqual(['pi', 'po', 'prismsuite']);
    expect(createFixtures().lookupByHash('deadbeef')).toBeNull();
  });
});

describe('duplicate decisions and file types', () => {
  it('lets only an Admin decide a duplicate, and only with a reason', async () => {
    await api.__register('pi');
    const p = await newProject();
    await api.addDocument({ projectId: p.id, type: 'pi', file: sampleFile('pi'), actor: intake });
    const dup = await api.addDocument({ projectId: p.id, type: 'pi', file: sampleFile('pi'), actor: intake });
    await expect(api.resolveDuplicate(dup.document.id, 'replace', { actor: engineer, reason: because })).rejects.toThrow('Admin');
    await expect(api.resolveDuplicate(dup.document.id, 'replace', { actor: lead, reason: ' ' })).rejects.toThrow('reason');
    await api.resolveDuplicate(dup.document.id, 'replace', { actor: lead, reason: because });
    const audit = await api.listAudit(p.id);
    expect(audit.find((a) => a.action === 'document_replaced').reason).toBe(because);
  });

  it('accepts PDF and Word files, keeps the original and never reads the contents of Word', async () => {
    const p = await newProject();
    for (const [name, kind] of [
      ['order.pdf', 'pdf'],
      ['order.docx', 'docx'],
    ]) {
      const { document, recognised } = await api.addDocument({
        projectId: p.id,
        type: 'pi',
        file: plainFile(`content of ${name}`, name),
        actor: intake,
      });
      expect(document).toMatchObject({ fileKind: kind, status: 'needs_manual' });
      expect(recognised).toBe(false);
      expect((await api.getFile(document.fileId)).name).toBe(name);
    }
    expect((await api.getProject(p.id)).lines).toEqual([]);
  });

  it('never matches a Word file to a known sample, even with the same bytes', async () => {
    await api.__register('pi');
    const p = await newProject();
    const asDocx = sampleFile('pi', 'copy.docx');
    const { document, recognised } = await api.addDocument({ projectId: p.id, type: 'pi', file: asDocx, actor: intake });
    expect(recognised).toBe(false);
    expect(document.status).toBe('needs_manual');
  });
});

describe('checklist progress and questionnaire responses', () => {
  it('stores task progress and responses, and clears them on reset', async () => {
    const { items } = await api.getCatalog();
    expect(items.length).toBeGreaterThan(0);
    await api.setTaskProgress('firewall|new|0', { s: 2 }, 'Firewall: step');
    await api.addResponse('firewall', { user: ' Asha ' });
    let state = await api.getChecklistState();
    expect(state.tasks['firewall|new|0'].s).toBe(2);
    expect(state.q.firewall[0].user).toBe('Asha');
    await api.patchResponse('firewall', state.q.firewall[0].id, { vpn: 1 });
    state = await api.getChecklistState();
    expect(state.q.firewall[0].vpn).toBe(1);
    await expect(api.addResponse('firewall', { user: ' ' })).rejects.toThrow('User name');
    await expect(api.addResponse('nonsense', { user: 'A' })).rejects.toThrow('does not exist');
    await api.deleteResponse('firewall', state.q.firewall[0].id);
    await expect(api.resetAll({ actor: engineer })).rejects.toThrow('Admin');
    await api.resetAll({ actor: lead });
    expect((await api.getChecklistState()).tasks).toEqual({});
  });
});
