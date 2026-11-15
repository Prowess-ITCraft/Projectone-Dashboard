import { describe, expect, it } from 'vitest';
import pi from '@/data/fixtures/pi_sample.json';
import po from '@/data/fixtures/po_sample.json';
import prismsuite from '@/data/fixtures/prismsuite_sample.json';
import { classifyLines, classifyTitle } from './classification';
import { coverageCheck } from './coverage';
import { matchCustomers, normaliseName } from './customers';
import { extractionToDocument } from './documents';
import { isValidGstin } from './gstin';
import { financialYear, projectNumber } from './ids';
import { formatINR, gstOf, lineAmount, paiseToInput, toPaise } from './money';
import { can } from './permissions';
import { isSupportLine, isSupportOnly, splitScope, supportYears } from './scope';
import { computeTracker, currentStage } from './stages';
import { validateDocument } from './validation';

const withIds = (lines) => lines.map((l) => ({ ...l, id: `L${l.no}` }));

describe('money', () => {
  it('reads Indian-formatted amounts into whole paise', () => {
    expect(toPaise('1,75,893.00')).toBe(17589300);
    expect(toPaise('₹ 500')).toBe(50000);
    expect(toPaise('63125.28')).toBe(6312528);
    expect(toPaise('-0.28')).toBe(-28);
    expect(toPaise('12.345')).toBeNull();
    expect(toPaise('abc')).toBeNull();
    expect(toPaise('')).toBeNull();
  });

  it('formats with lakh grouping and round-trips through the input text', () => {
    expect(formatINR(17589300)).toBe('₹1,75,893.00');
    expect(paiseToInput(6312528)).toBe('63125.28');
    expect(paiseToInput(-28)).toBe('-0.28');
  });

  it('calculates line amounts and GST without floating point drift', () => {
    expect(lineAmount(11, 349800)).toBe(3847800);
    expect(gstOf(35069600)).toBe(6312528);
  });
});

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

  it('keeps a hardware line with a multi-year protection plan a product', () => {
    expect(classifyTitle('Sophos XGS-88 With 3 years Xtreme Protection').kind).toBe('product');
  });
});

describe('document extraction', () => {
  it('maps the proforma invoice header, bill-to, totals and a call confirmation', () => {
    const { document, lines } = extractionToDocument(pi);
    expect(document).toMatchObject({
      type: 'pi',
      number: 'ITCRAFT/NN/2627/002',
      poType: 'call_confirmation',
      quoteRef: 'ITCraft/NN/2627/004',
    });
    expect(document.billTo.gstin).toBe('27AAAAA0000A1Z5');
    expect(document.totals).toEqual({ subtotalPaise: 35069600, gstPaise: 6312528, roundOffPaise: -28, grandPaise: 41382100 });
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

  it('flags totals that do not add up, as warnings that quote money', () => {
    const { document, lines } = extractionToDocument(pi);
    const bad = { ...document, totals: { ...document.totals, subtotalPaise: 100 } };
    const ids = validateDocument(bad, withIds(lines), new Date('2026-05-21T00:00:00Z')).map((i) => i.id);
    expect(ids).toEqual(expect.arrayContaining(['subtotal', 'gst', 'grand']));
    validateDocument(bad, withIds(lines)).forEach((i) => expect(i.severity).toBe('warning'));
  });

  it('flags a quantity times rate mismatch on one line', () => {
    const { document, lines } = extractionToDocument(po);
    const edited = withIds(lines);
    edited[1] = { ...edited[1], qty: 10 };
    const issue = validateDocument(document, edited, new Date('2026-05-06T00:00:00Z')).find((i) => i.id === 'line-2');
    expect(issue).toMatchObject({ financial: true });
  });

  it('flags an expired proforma invoice without making it financial', () => {
    const { document, lines } = extractionToDocument(pi);
    const issue = validateDocument(document, withIds(lines), new Date('2026-06-30T00:00:00Z')).find((i) => i.id === 'expired');
    expect(issue.financial).toBe(false);
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
  it('lets only the project lead see money, confirm intake and reopen', () => {
    const lead = { role: 'project_lead' };
    const intake = { role: 'intake_coordinator' };
    ['view_financials', 'confirm_intake', 'reopen'].forEach((a) => {
      expect(can(lead, a)).toBe(true);
      expect(can(intake, a)).toBe(false);
    });
    expect(can(intake, 'upload')).toBe(true);
    expect(can(null, 'upload')).toBe(false);
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
