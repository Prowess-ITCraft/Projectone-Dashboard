import { describe, expect, it } from 'vitest';
import pi from '@/data/fixtures/pi_sample.json';
import po from '@/data/fixtures/po_sample.json';
import prismsuite from '@/data/fixtures/prismsuite_sample.json';
import { classifyLines, classifyTitle, DEFAULT_RULES, upgradeStoredRules } from './classification';
import { coverageCheck } from './coverage';
import { matchCustomers, normaliseName } from './customers';
import { extractionToDocument } from './documents';
import { isValidGstin } from './gstin';
import { financialYear, projectNumber } from './ids';
import { can, PERMISSIONS } from './permissions';
import { isSupportLine, isSupportOnly, splitScope, supportYears } from './scope';
import { computeTracker, currentStage } from './stages';
import { validateDocument } from './validation';

const withIds = (lines) => lines.map((l) => ({ ...l, id: `L${l.no}` }));

describe('numbers and identifiers', () => {
  it('uses the Indian financial year, April to March', () => {
    expect(financialYear(new Date('2026-11-16T10:00:00Z'))).toBe('2627');
    expect(financialYear(new Date('2027-03-31T10:00:00Z'))).toBe('2627');
    expect(financialYear(new Date('2027-04-01T10:00:00Z'))).toBe('2728');
    expect(financialYear(new Date('2027-03-31T20:00:00Z'))).toBe('2728');
  });

  it('pads project numbers', () => {
    expect(projectNumber('2627', 7)).toBe('PRJ-2627-0007');
  });

  it('checks the GSTIN format only', () => {
    expect(isValidGstin('27AAAAA0000A1Z5')).toBe(true);
    expect(isValidGstin(' 27aaaaa0000a1z5 ')).toBe(true);
    expect(isValidGstin('27AAAAA0000A1')).toBe(false);
  });
});

describe('customer matching', () => {
  const customers = [
    { id: '1', name: 'M/S Sample Industries Pvt. Ltd.', gstin: '27AAAAA0000A1Z5' },
    { id: '2', name: 'Other Works Limited', gstin: '' },
  ];

  it('treats company suffixes as noise', () => {
    expect(normaliseName('M/S Sample Industries Pvt. Ltd.')).toBe('sample industries');
  });

  it('finds by GSTIN first, then by name, and never matches a different customer', () => {
    expect(matchCustomers(customers, { gstin: '27aaaaa0000a1z5', name: 'Something else' })).toEqual([
      { customer: customers[0], reason: 'gstin' },
    ]);
    expect(matchCustomers(customers, { gstin: '', name: 'sample industries' })).toEqual([{ customer: customers[0], reason: 'name' }]);
    expect(matchCustomers(customers, { gstin: '', name: 'Unrelated Co' })).toEqual([]);
    expect(matchCustomers(customers, { gstin: '', name: 'ab' })).toEqual([]);
  });
});

describe('classification rules against the sample extractions', () => {
  const ruleResult = (json) => classifyLines(withIds(extractionToDocument(json).lines));

  it('reproduces the kind and module of every proforma invoice line', () => {
    const result = ruleResult(pi);
    result.forEach((line, i) => {
      expect(line.kind, `line ${line.no} kind`).toBe(pi.lines[i].kind);
      expect(line.moduleType, `line ${line.no} module`).toBe(pi.lines[i].module);
    });
  });

  it('pairs every proforma invoice service to its product', () => {
    const result = ruleResult(pi);
    pi.lines.forEach((golden, i) => {
      if (golden.paired_to) expect(result[i].pairedToLineId, `line ${golden.no}`).toBe(`L${golden.paired_to}`);
      else expect(result[i].pairedToLineId).toBeNull();
    });
  });

  it('reproduces the purchase order kinds and modules, and leaves the unnamed service for a person', () => {
    const result = ruleResult(po);
    result.slice(0, 4).forEach((line, i) => {
      expect(line.kind, `line ${line.no} kind`).toBe(po.lines[i].kind);
      expect(line.moduleType, `line ${line.no} module`).toBe(po.lines[i].module);
    });
    expect(result[2].pairedToLineId).toBe('L2');
    const last = result[4];
    expect(last.kind).toBe('service');
    expect(last.moduleType).toBeNull();
    expect(last.pairedToLineId).toBeNull();
    expect(last.suggestion).toEqual({ moduleType: 'network_router', pairedToLineId: 'L4' });
  });

  it('marks a line no rule recognises as unknown, which a person must resolve', () => {
    expect(classifyTitle('Annual maintenance retainer')).toMatchObject({ kind: 'unknown', moduleType: null });
  });

  it('classifies an Acronis XDR line as endpoint protection, not backup software', () => {
    const title = 'Acronis Extended Detection and Response (XDR), per annum. Workloads: servers, VMs, workstations, hosting servers';
    expect(classifyTitle(title).moduleType).toBe('eps');
    expect(classifyTitle('Acronis Cyber Protect XDR licence').moduleType).toBe('eps');
  });

  it('keeps plain Acronis backup lines as backup software', () => {
    expect(classifyTitle('Acronis Cyber Protect backup').moduleType).toBe('backup_software');
    expect(classifyTitle('Veeam Backup & Replication').moduleType).toBe('backup_software');
  });

  it('adds the XDR rule to a stored copy of the old rules, above backup, and keeps Admin edits', () => {
    const old = {
      ...DEFAULT_RULES,
      module: DEFAULT_RULES.module
        .filter((r) => !r.patterns.includes('\\bxdr\\b'))
        .map((r) => (r.moduleType === 'firewall' ? { ...r, patterns: ['edited'] } : r)),
    };
    expect(classifyTitle('Acronis XDR per annum', old).moduleType).toBe('backup_software');
    const upgraded = upgradeStoredRules(old);
    expect(classifyTitle('Acronis XDR per annum', upgraded).moduleType).toBe('eps');
    expect(classifyTitle('Acronis Cyber Protect backup', upgraded).moduleType).toBe('backup_software');
    expect(upgraded.module.find((r) => r.moduleType === 'firewall').patterns).toEqual(['edited']);
    expect(upgradeStoredRules(upgraded)).toBe(upgraded);
  });

  it('keeps a hardware line with a multi-year protection plan a product', () => {
    expect(classifyTitle('Sophos XGS-88 With 3 years Xtreme Protection').kind).toBe('product');
  });
});

describe('document extraction', () => {
  it('maps the proforma invoice header, bill-to and a call confirmation', () => {
    const { document, lines } = extractionToDocument(pi);
    expect(document).toMatchObject({
      type: 'pi',
      number: 'ITCRAFT/NN/2627/002',
      poType: 'call_confirmation',
      quoteRef: 'ITCraft/NN/2627/004',
    });
    expect(document.billTo.gstin).toBe('27AAAAA0000A1Z5');
    expect(lines).toHaveLength(10);
    expect(lines[1].scopeItems).toHaveLength(5);
  });

  it('takes the customer from the purchase order issuer and keeps the referenced PI', () => {
    const { document } = extractionToDocument(po);
    expect(document.billTo.name).toBe('Sample Engineers (Mumbai) Private Limited');
    expect(document.referencePi).toBe('ITCRAFT/NN/2627/001');
  });

  it('keeps only the recommendations of a PrismSuite report', () => {
    const { document, lines } = extractionToDocument(prismsuite);
    expect(document.type).toBe('prismsuite');
    expect(document.recommendations).toHaveLength(7);
    expect(lines).toEqual([]);
  });
});

describe('validation', () => {
  const clean = (json) => {
    const { document, lines } = extractionToDocument(json);
    return validateDocument(document, withIds(lines), new Date('2026-05-21T00:00:00Z'));
  };

  it('finds nothing wrong with the consistent sample documents', () => {
    expect(clean(pi)).toEqual([]);
    expect(clean(po)).toEqual([]);
  });

  it('never carries a financial field, even from an extraction that has them', () => {
    const priced = {
      ...pi,
      totals: { subtotal: 100, grand_total: 118 },
      terms: ['Payment in 30 days'],
      lines: pi.lines.map((l) => ({ ...l, rate: 10, amount: 10 })),
    };
    const { document, lines } = extractionToDocument(priced);
    expect(JSON.stringify({ document, lines })).not.toMatch(/rate|amount|total|paise|terms|bank/i);
  });

  it('flags an expired proforma invoice', () => {
    const { document, lines } = extractionToDocument(pi);
    const issue = validateDocument(document, withIds(lines), new Date('2026-06-30T00:00:00Z')).find((i) => i.id === 'expired');
    expect(issue.message).toMatch(/5 days/);
  });
});

describe('scope and support entitlements', () => {
  const lines = withIds(extractionToDocument(pi).lines);
  const classified = classifyLines(lines);

  it('reads the length of support from the line text', () => {
    expect(supportYears('Setup and one year support charges')).toBe(1);
    expect(supportYears('Support for 3 Years')).toBe(3);
    expect(supportYears('Installation only')).toBeNull();
  });

  it('separates setup scope from support scope on the firewall lines', () => {
    const firewall = classified.filter((l) => l.kind === 'service' && l.moduleType === 'firewall');
    const { scopeItems, entitlements } = splitScope(firewall);
    expect(scopeItems).toContain('SSL VPN Configuration for remote users');
    expect(scopeItems).not.toContain('Firmware patching for the Firewall');
    expect(entitlements).toHaveLength(1);
    expect(entitlements[0].scopeItems).toContain('Firmware patching for the Firewall');
  });

  it('records an entitlement for a combined setup and support line, with no support scope of its own', () => {
    const nas = classified.find((l) => l.no === 2);
    expect(isSupportLine(nas)).toBe(true);
    expect(isSupportOnly(nas)).toBe(false);
    const { scopeItems, entitlements } = splitScope([nas]);
    expect(scopeItems).toHaveLength(5);
    expect(entitlements).toEqual([{ lineId: 'L2', years: 1, scopeItems: [] }]);
  });
});

describe('coverage check', () => {
  it('lists what was recommended but not ordered, ordered but not recommended, and other actions', () => {
    const ordered = ['nas', 'backup_software', 'cloud_backup', 'firewall', 'hosted_dr'];
    const result = coverageCheck(prismsuite.recommendations, ordered);
    expect(result.covered.map((c) => c.moduleType).sort()).toEqual(['firewall', 'nas']);
    expect(result.recommendedNotOrdered.map((c) => c.moduleType).sort()).toEqual(['eps', 'network_switch']);
    expect(result.orderedNotRecommended.sort()).toEqual(['backup_software', 'cloud_backup', 'hosted_dr']);
    expect(result.other).toEqual(['Remove Kaspersky and McAfee', 'Add 512 GB SSD on 1 endpoint', 'Office 2016 to M365 on 1 endpoint']);
  });
});

describe('roles', () => {
  it('lets only the Admin confirm intake, reopen, decide duplicates and reset', () => {
    const admin = { role: 'admin' };
    const engineer = { role: 'engineer' };
    ['confirm_intake', 'reopen', 'resolve_duplicate', 'reset_data', 'set_delivery'].forEach((a) => {
      expect(can(admin, a)).toBe(true);
      expect(can(engineer, a)).toBe(false);
    });
    expect(can(engineer, 'upload')).toBe(false);
    expect(['complete_step', 'upload_evidence', 'comment_step'].every((a) => can(engineer, a))).toBe(true);
    expect(can(null, 'upload')).toBe(false);
  });

  it('reads permissions from data, so an unknown role can do nothing and a new row grants access', () => {
    expect(can({ role: 'visitor' }, 'upload')).toBe(false);
    expect(Object.keys(PERMISSIONS)).toEqual(['admin', 'engineer']);
  });

  it('has no financial permission at all', () => {
    Object.values(PERMISSIONS).forEach((actions) => expect(actions.join()).not.toMatch(/financ|money|price/));
  });
});

describe('stage tracker', () => {
  const project = { entryPath: 'post_audit' };
  const order = { id: 'd1', type: 'pi', active: true, status: 'parsed', fileName: 'pi.pdf' };
  const state = (s, id) => s.find((x) => x.id === id);

  it('is blocked at the start until an entry path is chosen', () => {
    const tracker = computeTracker({ project: {}, documents: [], lines: [] });
    expect(state(tracker, 'trigger')).toMatchObject({ state: 'blocked', reason: 'Choose an entry path for this project.' });
    expect(state(tracker, 'intake').state).toBe('locked');
  });

  it('asks for an order document, then for review, in strict order', () => {
    expect(state(computeTracker({ project, documents: [], lines: [] }), 'trigger').state).toBe('todo');
    const t = computeTracker({ project, documents: [order], lines: [{ kind: 'product' }] });
    expect(state(t, 'trigger').state).toBe('done');
    expect(state(t, 'intake').state).toBe('todo');
    expect(state(t, 'classify').state).toBe('locked');
    expect(currentStage(t).id).toBe('intake');
  });

  it('blocks intake while a document still needs its details entered', () => {
    const t = computeTracker({ project, documents: [{ ...order, status: 'needs_manual' }], lines: [] });
    expect(state(t, 'intake')).toMatchObject({ state: 'blocked' });
  });

  it('blocks classification while a line is unknown, and locks the later stages with the reason', () => {
    const confirmed = { ...project, intake: { at: 1 } };
    const t = computeTracker({ project: confirmed, documents: [order], lines: [{ kind: 'unknown' }, { kind: 'service' }] });
    expect(state(t, 'classify')).toMatchObject({ state: 'blocked', reason: '1 line is still unknown.' });
    expect(state(t, 'kickoff')).toMatchObject({ state: 'locked', reason: 'Locked until stage 2 is done.' });
  });

  it('shows later stages as not available yet once classification is done', () => {
    const done = { ...project, intake: { at: 1 }, classify: { at: 2 } };
    const t = computeTracker({ project: done, documents: [order], lines: [{ kind: 'product' }] });
    expect(state(t, 'classify').state).toBe('done');
    expect(state(t, 'kickoff')).toMatchObject({ state: 'locked', reason: 'Not available yet.' });
    expect(state(t, 'lookup').reason).toBe('Locked until stage 3 is done.');
  });

  it('ignores a document waiting on a duplicate decision', () => {
    const t = computeTracker({ project, documents: [{ ...order, pendingDuplicate: true }], lines: [] });
    expect(state(t, 'trigger').state).toBe('todo');
  });
});
