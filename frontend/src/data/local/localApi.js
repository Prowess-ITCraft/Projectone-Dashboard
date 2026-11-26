import { applyAddRow, applyDeleteRow, applyPatchRow, applyTask, emptyChecklistState } from '@/domain/checklist';
import { classifyLines, DEFAULT_RULES, upgradeStoredRules } from '@/domain/classification';
import { DOCUMENT_TYPES, extractionToDocument } from '@/domain/documents';
import { ACCEPTED_TEXT, FILE_KINDS, LOOKUP_ACCEPTED_TEXT, LOOKUP_KINDS, MAX_FILE_BYTES, fileKind, lookupKind } from '@/domain/files';
import { ENTRY_PATHS, lockedByStatus, siteKey, statusChangeProblem, statusOf } from '@/domain/projects';
import { financialYear, customerNumber, newId, projectNumber } from '@/domain/ids';
import { actorLabel, can } from '@/domain/permissions';
import { splitScope } from '@/domain/scope';
import { computeTracker, ORDER_DOCUMENT_TYPES } from '@/domain/stages';
import { isValidGstin, normaliseGstin } from '@/domain/gstin';
import { isAudited, isValidEmail, matchCustomers } from '@/domain/customers';
import { sha256Hex } from '@/lib/sha256';

const fail = (message) => {
  throw new Error(message);
};

/*
  The temporary ProjectOne data layer: every screen reads and writes through this object only. It keeps its data in a
  storage backend (IndexedDB in the browser) and holds the business rules of intake: confirmations, reopening with a
  reason, duplicate documents, module creation. When the backend exists, a second adapter with the same methods replaces it.
  Writes run one at a time so counters and confirmations cannot interleave. On a storage with transactions (the
  server), each write's changes are saved together or not at all; a storage with its own counters numbers customers
  and projects, so two people never get the same number.
*/
function buildApi({ storage, fixtures, now, listeners, write }) {
  const all = (store) => storage.getAll(store);
  const byProject = async (store, projectId) => (await all(store)).filter((r) => r.projectId === projectId);

  async function counter(key) {
    if (storage.nextCounter) return storage.nextCounter(key);
    const current = (await storage.get('meta', key)) ?? { value: 0 };
    const next = current.value + 1;
    await storage.put('meta', key, { value: next });
    return next;
  }

  async function record(actor, action, projectId, details = {}) {
    const id = newId();
    await storage.put('audit', id, { id, at: now(), actor: actor ?? null, action, projectId, ...details });
  }

  // The defaults until an Admin stores rules of their own; reading never writes, so anyone may read them.
  // A stored copy from before the XDR rule existed gets that rule added on the way out, without being saved.
  const getRules = async () => {
    const stored = await storage.get('rules', 'current');
    return stored ? upgradeStoredRules(stored) : DEFAULT_RULES;
  };

  // Projects stored before sites and status existed read as in progress with no sites
  const normal = (project) => ({ status: 'in_progress', statusReason: '', siteIds: [], ...project });
  const requireProject = async (id) => normal((await storage.get('projects', id)) ?? fail('That project no longer exists.'));
  const requireCustomer = async (id) => (await storage.get('customers', id)) ?? fail('That customer no longer exists.');
  /* A GSTIN must be valid and must not belong to another customer */
  async function checkGstin(gstin, customerId) {
    const value = normaliseGstin(gstin);
    if (!value) return '';
    if (!isValidGstin(value)) fail('This GSTIN is not in a valid format (15 characters).');
    const other = (await all('customers')).find((c) => c.id !== customerId && normaliseGstin(c.gstin) === value);
    if (other) fail(`This GSTIN already belongs to ${other.name} (${other.number}).`);
    return value;
  }

  const requireOpen = (project) => {
    const why = lockedByStatus(project);
    if (why) fail(why);
  };
  const requireDocument = async (id) => (await storage.get('documents', id)) ?? fail('That document no longer exists.');
  const requireLine = async (id) => (await storage.get('lines', id)) ?? fail('That line no longer exists.');
  const need = (actor, action, message) => can(actor, action) || fail(message);
  const stamp = (actor) => ({ at: now(), by: actorLabel(actor), role: actor.role });

  async function activeDocuments(projectId) {
    return (await byProject('documents', projectId)).filter((d) => d.active && !d.pendingDuplicate);
  }
  async function liveLines(projectId) {
    const docs = new Set((await activeDocuments(projectId)).map((d) => d.id));
    return (await byProject('lines', projectId))
      .filter((l) => !l.archived && docs.has(l.documentId))
      .sort((a, b) => a.documentOrder - b.documentOrder || a.no - b.no);
  }

  async function clearModules(projectId) {
    await Promise.all((await byProject('modules', projectId)).map((m) => storage.delete('modules', m.id)));
    await Promise.all((await byProject('entitlements', projectId)).map((e) => storage.delete('entitlements', e.id)));
  }

  async function resetConfirmations(projectId, from) {
    const project = await requireProject(projectId);
    if (from === 'intake') project.intake = null;
    project.classify = null;
    await storage.put('projects', projectId, project);
    await clearModules(projectId);
  }

  async function findDuplicate(doc, number) {
    const docs = (await all('documents')).filter((d) => d.id !== doc.id && d.active && !d.pendingDuplicate);
    const sameFile = docs.find((d) => d.fileHash && d.fileHash === doc.fileHash);
    if (sameFile) return sameFile;
    if (!number) return null;
    return docs.find((d) => d.type === doc.type && d.number && d.number.trim().toLowerCase() === number.trim().toLowerCase()) ?? null;
  }

  async function insertLines(doc, rawLines, rules, order) {
    const classified = classifyLines(
      rawLines.map((l, i) => ({ ...l, id: newId(), no: l.no ?? i + 1 })),
      rules,
    );
    await Promise.all(
      classified.map((l) =>
        storage.put('lines', l.id, {
          ...l,
          projectId: doc.projectId,
          documentId: doc.id,
          documentOrder: order,
          archived: false,
          reviewedBy: null,
        }),
      ),
    );
    return classified;
  }

  async function dropLines(documentId) {
    const lines = (await all('lines')).filter((l) => l.documentId === documentId);
    await Promise.all(lines.map((l) => storage.delete('lines', l.id)));
  }

  async function buildModules(projectId) {
    const lines = await liveLines(projectId);
    const products = lines.filter((l) => l.kind === 'product' || l.kind === 'subscription');
    const services = lines.filter((l) => l.kind === 'service');
    const createdAt = now();
    for (const product of products) {
      const attached = services.filter((s) => {
        if (s.pairedToLineId) return s.pairedToLineId === product.id;
        return s.moduleType && s.moduleType === product.moduleType && products.filter((p) => p.moduleType === s.moduleType).length === 1;
      });
      const { scopeItems, entitlements } = splitScope(attached);
      const module = {
        id: newId(),
        projectId,
        moduleType: product.moduleType,
        productLineId: product.id,
        serviceLineIds: attached.map((s) => s.id),
        status: 'awaiting_delivery',
        deliveredOn: null,
        scopeItems,
        createdAt,
      };
      await storage.put('modules', module.id, module);
      for (const e of entitlements) {
        const id = newId();
        await storage.put('entitlements', id, { id, projectId, moduleId: module.id, ...e, startsAt: null, status: 'pending_signoff' });
      }
    }
  }

  const groupBy = (rows, key) => {
    const map = new Map();
    rows.forEach((r) => {
      const k = r[key];
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(r);
    });
    return map;
  };

  /*
    Reads every store once and indexes it, so a list of many projects costs a fixed number of reads instead of
    several per project. Snapshots are then built from memory.
  */
  async function loadIndex() {
    const [projects, customers, sites, documents, lines, modules, entitlements, audit] = await Promise.all(
      ['projects', 'customers', 'sites', 'documents', 'lines', 'modules', 'entitlements', 'audit'].map((st) => all(st)),
    );
    const normalProjects = projects.map(normal);
    const docsByProject = groupBy(documents, 'projectId');
    const projectIdsByCustomer = groupBy(normalProjects, 'customerId');
    const docsByCustomer = new Map([...projectIdsByCustomer].map(([cid, ps]) => [cid, ps.flatMap((x) => docsByProject.get(x.id) ?? [])]));
    const lastAt = new Map();
    audit.forEach((a) => a.projectId && lastAt.set(a.projectId, Math.max(lastAt.get(a.projectId) ?? 0, a.at)));
    return {
      projects: normalProjects,
      customers: new Map(customers.map((c) => [c.id, c])),
      customerList: customers,
      sites: new Map(sites.map((x) => [x.id, x])),
      siteList: sites,
      docsByProject,
      docsByCustomer,
      linesByProject: groupBy(lines, 'projectId'),
      modulesByProject: groupBy(modules, 'projectId'),
      entitlementsByProject: groupBy(entitlements, 'projectId'),
      projectsByCustomer: projectIdsByCustomer,
      lastAt,
      audit,
    };
  }

  function buildSnapshot(project, ix) {
    const documents = [...(ix.docsByProject.get(project.id) ?? [])].sort((a, b) => a.createdAt - b.createdAt);
    const activeIds = new Set(documents.filter((d) => d.active && !d.pendingDuplicate).map((d) => d.id));
    const lines = (ix.linesByProject.get(project.id) ?? [])
      .filter((l) => !l.archived && activeIds.has(l.documentId))
      .sort((a, b) => a.documentOrder - b.documentOrder || a.no - b.no);
    const modules = [...(ix.modulesByProject.get(project.id) ?? [])].sort((a, b) => a.createdAt - b.createdAt);
    return {
      project,
      customer: ix.customers.get(project.customerId),
      sites: project.siteIds.map((id) => ix.sites.get(id)).filter(Boolean),
      documents,
      lines,
      modules,
      entitlements: ix.entitlementsByProject.get(project.id) ?? [],
      audited: isAudited(ix.docsByCustomer.get(project.customerId) ?? []),
      lastActivityAt: ix.lastAt.get(project.id) ?? project.createdAt,
      tracker: computeTracker({ project, documents, lines }),
    };
  }

  async function snapshot(projectId) {
    const project = await requireProject(projectId);
    return buildSnapshot(project, await loadIndex());
  }

  const cleanName = (name) =>
    String(name ?? '')
      .trim()
      .replace(/\s+/g, ' ');

  /* Adds a site to a customer. Names are unique within the customer, ignoring case and extra spaces. */
  async function addSiteRecord(customerId, site, actor) {
    const name = cleanName(site?.name);
    if (!name) fail('Give the site a name.');
    const existing = (await all('sites')).filter((x) => x.customerId === customerId);
    if (existing.some((x) => siteKey(x.name) === siteKey(name))) fail(`This customer already has a site called ${name}.`);
    const created = {
      id: newId(),
      customerId,
      name,
      address: site.address?.trim() ?? '',
      contact: site.contact?.trim() ?? '',
      createdAt: now(),
    };
    await storage.put('sites', created.id, created);
    await record(actor, 'site_added', null, { customerId, subject: name, reason: null });
    return created;
  }

  /* The chosen sites must all belong to the customer of the project */
  async function checkSites(customerId, siteIds) {
    const ids = [...new Set(siteIds ?? [])];
    for (const id of ids) {
      const site = await storage.get('sites', id);
      if (!site || site.customerId !== customerId) fail('A chosen site does not belong to this customer.');
    }
    return ids;
  }

  /* Once: free-text locations from before sites existed become sites of their customer. Nothing is lost. */
  async function moveLocationsToSites() {
    if (await storage.get('meta', 'schema:sites')) return;
    for (const project of await all('projects')) {
      if (project.siteIds || !project.location?.trim()) continue;
      const name = cleanName(project.location);
      const sites = (await all('sites')).filter((x) => x.customerId === project.customerId);
      let site = sites.find((x) => siteKey(x.name) === siteKey(name));
      if (!site) {
        site = { id: newId(), customerId: project.customerId, name, address: '', contact: '', createdAt: now() };
        await storage.put('sites', site.id, site);
      }
      const rest = { ...project };
      delete rest.location;
      await storage.put('projects', project.id, { ...rest, siteIds: [site.id] });
    }
    await storage.put('meta', 'schema:sites', { at: now() });
  }

  // Only browser data from before sites existed needs this; the server never held free-text locations
  const migrated = storage.remote ? Promise.resolve() : write(moveLocationsToSites);

  const api = {
    ready: () => migrated,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    /* Something changed outside this layer (an assignment on the server): every open screen reads again */
    changed: () => listeners.forEach((l) => l()),
    isPersistent: () => storage.persistent !== false,
    getRules,

    listCustomers: async () => (await all('customers')).sort((a, b) => a.name.localeCompare(b.name)),
    findCustomerMatches: async ({ gstin, name }) => matchCustomers(await all('customers'), { gstin, name }),

    listSites: async (customerId) =>
      (await all('sites')).filter((x) => x.customerId === customerId).sort((a, b) => a.name.localeCompare(b.name)),

    async listCustomerSummaries() {
      const ix = await loadIndex();
      return [...ix.customerList]
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((customer) => {
          const own = ix.projectsByCustomer.get(customer.id) ?? [];
          const times = own.map((p) => ix.lastAt.get(p.id) ?? p.createdAt);
          return {
            customer,
            sites: ix.siteList.filter((x) => x.customerId === customer.id),
            projectCount: own.length,
            openProjectCount: own.filter((p) => ['in_progress', 'on_hold'].includes(statusOf(p))).length,
            audited: isAudited(ix.docsByCustomer.get(customer.id) ?? []),
            lastActivityAt: times.length ? Math.max(...times) : customer.createdAt,
          };
        });
    },

    async getCustomer(id) {
      const customer = await requireCustomer(id);
      const ix = await loadIndex();
      const sites = ix.siteList.filter((x) => x.customerId === id).sort((a, b) => a.name.localeCompare(b.name));
      const projects = [...(ix.projectsByCustomer.get(id) ?? [])]
        .sort((a, b) => b.createdAt - a.createdAt)
        .map((p) => buildSnapshot(p, ix));
      const numberOf = Object.fromEntries(projects.map((x) => [x.project.id, x.project.number]));
      const documents = (ix.docsByCustomer.get(id) ?? [])
        .filter((d) => !d.pendingDuplicate)
        .map((d) => ({ ...d, projectNumber: numberOf[d.projectId] }))
        .sort((a, b) => b.createdAt - a.createdAt);
      const activity = ix.audit.filter((a) => a.customerId === id && !a.projectId).sort((a, b) => b.at - a.at);
      return { customer, sites, projects, documents, audited: isAudited(documents), activity };
    },

    updateCustomer: (id, patch, { actor }) =>
      write(async () => {
        need(actor, 'create_project', 'Your role cannot change customer details.');
        const customer = await requireCustomer(id);
        const next = { ...customer };
        if (patch.name !== undefined) {
          if (!cleanName(patch.name)) fail('The customer name cannot be blank.');
          next.name = cleanName(patch.name);
        }
        if (patch.gstin !== undefined) next.gstin = await checkGstin(patch.gstin, id);
        ['address', 'contact', 'email'].forEach((k) => patch[k] !== undefined && (next[k] = String(patch[k]).trim()));
        if (next.email && !isValidEmail(next.email)) fail('This email address is not in a valid format.');
        const fields = ['name', 'gstin', 'address', 'contact', 'email'].filter((k) => next[k] !== customer[k]);
        if (!fields.length) return customer;
        await storage.put('customers', id, next);
        await record(actor, 'customer_updated', null, {
          customerId: id,
          subject: next.name,
          before: Object.fromEntries(fields.map((k) => [k, customer[k]])),
          after: Object.fromEntries(fields.map((k) => [k, next[k]])),
          reason: null,
        });
        return next;
      }),

    addSite: (customerId, site, { actor }) =>
      write(async () => {
        need(actor, 'create_project', 'Your role cannot add sites.');
        await requireCustomer(customerId);
        return addSiteRecord(customerId, site, actor);
      }),

    updateSite: (siteId, patch, { actor }) =>
      write(async () => {
        need(actor, 'create_project', 'Your role cannot change sites.');
        const site = (await storage.get('sites', siteId)) ?? fail('That site no longer exists.');
        const next = { ...site };
        if (patch.name !== undefined) {
          const name = cleanName(patch.name);
          if (!name) fail('Give the site a name.');
          const others = (await all('sites')).filter((x) => x.customerId === site.customerId && x.id !== siteId);
          if (others.some((x) => siteKey(x.name) === siteKey(name))) fail(`This customer already has a site called ${name}.`);
          next.name = name;
        }
        ['address', 'contact'].forEach((k) => patch[k] !== undefined && (next[k] = String(patch[k]).trim()));
        await storage.put('sites', siteId, next);
        await record(actor, 'site_updated', null, {
          customerId: site.customerId,
          subject: next.name,
          before: { name: site.name, address: site.address, contact: site.contact },
          after: { name: next.name, address: next.address, contact: next.contact },
          reason: null,
        });
        return next;
      }),

    async listProjects() {
      const ix = await loadIndex();
      return [...ix.projects].sort((a, b) => b.createdAt - a.createdAt).map((p) => buildSnapshot(p, ix));
    },
    getProject: (id) => snapshot(id),

    createProject: ({ customer, entryPath, purpose = '', siteIds = [], newSites = [], actor }) =>
      write(async () => {
        need(actor, 'create_project', 'Your role cannot create projects.');
        if (entryPath && !ENTRY_PATHS[entryPath]) fail('Choose one of the listed entry paths.');
        // Every check runs before anything is saved, so a refused request never leaves a customer without a project
        const existing = customer?.id ? await requireCustomer(customer.id) : null;
        if (!existing) {
          if (!customer?.name?.trim()) fail('Enter the customer name.');
          await checkGstin(customer.gstin, null);
          if (siteIds.length) fail('A chosen site does not belong to this customer.');
          if (customer.email?.trim() && !isValidEmail(customer.email)) fail('This email address is not in a valid format.');
        }
        const chosenSites = existing ? await checkSites(existing.id, siteIds) : [];
        const drafts = newSites.map((x) => ({ ...x, name: cleanName(x?.name) })).filter((x) => x.name);
        const taken = new Set(existing ? (await all('sites')).filter((x) => x.customerId === existing.id).map((x) => siteKey(x.name)) : []);
        for (const d of drafts) {
          if (taken.has(siteKey(d.name))) fail(`A site called ${d.name} is already taken or given more than once.`);
          taken.add(siteKey(d.name));
        }

        let customerRecord = existing;
        if (!existing) {
          customerRecord = {
            id: newId(),
            number: customerNumber(await counter('counter:customer')),
            name: customer.name.trim(),
            gstin: normaliseGstin(customer.gstin),
            address: customer.address?.trim() ?? '',
            contact: customer.contact?.trim() ?? '',
            email: customer.email?.trim() ?? '',
            createdAt: now(),
          };
          await storage.put('customers', customerRecord.id, customerRecord);
        }
        const chosen = [...chosenSites];
        for (const site of drafts) chosen.push((await addSiteRecord(customerRecord.id, site, actor)).id);
        const fy = financialYear(new Date(now()));
        const project = {
          id: newId(),
          number: projectNumber(fy, await counter(`counter:project:${fy}`)),
          customerId: customerRecord.id,
          entryPath: entryPath || null,
          purpose: purpose.trim(),
          siteIds: chosen,
          status: 'in_progress',
          statusReason: '',
          intake: null,
          classify: null,
          createdAt: now(),
        };
        await storage.put('projects', project.id, project);
        await record(actor, 'project_created', project.id, { customerId: customerRecord.id, reason: null });
        return project;
      }),

    updateProject: (id, patch, { actor }) =>
      write(async () => {
        need(actor, 'create_project', 'Your role cannot change projects.');
        const project = await requireProject(id);
        requireOpen(project);
        if (patch.entryPath !== undefined && patch.entryPath !== null && !ENTRY_PATHS[patch.entryPath])
          fail('Choose one of the listed entry paths.');
        const next = { ...project };
        ['entryPath', 'purpose'].forEach((k) => patch[k] !== undefined && (next[k] = patch[k]));
        if (patch.siteIds !== undefined) next.siteIds = await checkSites(project.customerId, patch.siteIds);
        await storage.put('projects', id, next);
        await record(actor, 'project_updated', id, {
          before: { entryPath: project.entryPath, siteIds: project.siteIds },
          after: { entryPath: next.entryPath, siteIds: next.siteIds },
          reason: null,
        });
        return next;
      }),

    setProjectStatus: (projectId, status, { actor, reason = '' }) =>
      write(async () => {
        need(actor, 'set_project_status', 'Only an Admin can change the project status.');
        const project = await requireProject(projectId);
        const documents = await byProject('documents', projectId);
        const lines = await liveLines(projectId);
        const tracker = computeTracker({ project: { ...project, status: 'in_progress' }, documents, lines });
        const allStagesDone = tracker.every((stage) => stage.state === 'done');
        const problem = statusChangeProblem(statusOf(project), status, { allStagesDone, reason });
        if (problem) fail(problem);
        const next = { ...project, status, statusReason: status === 'in_progress' ? '' : reason.trim() };
        await storage.put('projects', projectId, next);
        await record(actor, 'status_changed', projectId, {
          before: { status: statusOf(project) },
          after: { status },
          reason: reason.trim() || null,
        });
        return next;
      }),

    addDocument: ({ projectId, type, file, actor }) =>
      write(async () => {
        need(actor, 'upload', 'Your role cannot upload documents.');
        if (!DOCUMENT_TYPES[type]) fail('Choose what kind of document this is.');
        const kind = fileKind(file);
        if (!kind) fail(`Only ${ACCEPTED_TEXT} files can be uploaded.`);
        if (file.size > MAX_FILE_BYTES) fail('This file is larger than 25 MB.');
        const project = await requireProject(projectId);
        requireOpen(project);
        if (ORDER_DOCUMENT_TYPES.includes(type) && project.intake)
          fail('The intake review is confirmed. Reopen it before adding an order document.');

        const bytes = await file.arrayBuffer();
        const fileHash = await sha256Hex(bytes);
        const sample = kind === 'pdf' ? fixtures.lookupByHash(fileHash) : null;
        const json = sample ? await fixtures.load(sample) : null;
        const parsed = json ? extractionToDocument(json) : null;
        const docType = parsed ? parsed.document.type : type;

        const fileId = newId();
        await storage.put('files', fileId, {
          id: fileId,
          projectId,
          name: file.name,
          type: FILE_KINDS[kind].mime,
          size: file.size,
          hash: fileHash,
          blob: new Blob([bytes], { type: FILE_KINDS[kind].mime }),
        });
        const doc = {
          id: newId(),
          projectId,
          type: docType,
          fileId,
          fileName: file.name,
          fileHash,
          fileKind: kind,
          status: parsed ? (docType === 'prismsuite' ? 'attached' : 'parsed') : docType === 'prismsuite' ? 'attached' : 'needs_manual',
          parser: parsed ? { name: 'sample extraction', version: '1' } : null,
          number: '',
          date: '',
          billTo: { name: '', address: '', gstin: '', contact: '', email: '' },
          recommendations: [],
          ...(parsed?.document ?? {}),
          active: true,
          pendingDuplicate: false,
          createdAt: now(),
        };
        const duplicate = await findDuplicate(doc, doc.number);
        if (duplicate) Object.assign(doc, { active: false, pendingDuplicate: true, duplicateOfId: duplicate.id });
        await storage.put('documents', doc.id, doc);
        if (parsed) await insertLines(doc, parsed.lines, await getRules(), doc.createdAt);
        await record(actor, 'document_added', projectId, {
          subject: `${DOCUMENT_TYPES[docType]} ${doc.number || file.name}`,
          reason: null,
        });
        return { document: doc, duplicateOf: duplicate, recognised: Boolean(parsed) };
      }),

    saveDocumentDetails: (documentId, { header, lines = [], actor }) =>
      write(async () => {
        need(actor, 'edit_lines', 'Your role cannot edit documents.');
        const doc = await requireDocument(documentId);
        const project = await requireProject(doc.projectId);
        requireOpen(project);
        if (!doc.active && !doc.pendingDuplicate) fail('This document is history and cannot be changed.');
        if (project.intake && ORDER_DOCUMENT_TYPES.includes(doc.type))
          fail('The intake review is confirmed. Reopen it to change this document.');
        const isOrder = ORDER_DOCUMENT_TYPES.includes(doc.type);
        if (isOrder) {
          if (!header.number?.trim()) fail('Enter the document number.');
          if (!header.date) fail('Enter the document date.');
          if (!lines.length) fail('Add at least one order line.');
          lines.forEach((l, i) => {
            if (!l.title?.trim()) fail(`Line ${i + 1} needs a description.`);
            if (!(Number(l.qty) > 0)) fail(`Line ${i + 1} needs a quantity above zero.`);
          });
        }
        const next = { ...doc, ...header, number: header.number?.trim() ?? '', status: isOrder ? 'entered' : 'attached' };
        const duplicate = doc.active || doc.pendingDuplicate ? await findDuplicate(next, next.number) : null;
        if (duplicate && !doc.pendingDuplicate) fail(`${DOCUMENT_TYPES[doc.type]} ${next.number} is already stored in another document.`);
        if (duplicate) Object.assign(next, { active: false, pendingDuplicate: true, duplicateOfId: duplicate.id });
        else Object.assign(next, { active: true, pendingDuplicate: false, duplicateOfId: null });
        await storage.put('documents', next.id, next);
        if (isOrder) {
          await dropLines(doc.id);
          await insertLines(next, lines, await getRules(), doc.createdAt);
        }
        await record(actor, 'document_details_saved', doc.projectId, {
          subject: `${DOCUMENT_TYPES[doc.type]} ${next.number}`,
          reason: null,
        });
        return { document: next, duplicateOf: duplicate };
      }),

    resolveDuplicate: (documentId, decision, { actor, reason }) =>
      write(async () => {
        need(actor, 'resolve_duplicate', 'Only an Admin can decide between two versions of a document.');
        if (decision !== 'cancel' && decision !== 'replace') fail('Choose to replace the earlier document or cancel the new one.');
        if (!reason?.trim()) fail('Give a reason for the decision.');
        const doc = await requireDocument(documentId);
        requireOpen(await requireProject(doc.projectId));
        if (!doc.pendingDuplicate) fail('This document is not waiting for a decision.');
        const existing = await requireDocument(doc.duplicateOfId);
        if (decision === 'cancel') {
          await dropLines(doc.id);
          await storage.delete('files', doc.fileId);
          await storage.delete('documents', doc.id);
          await record(actor, 'duplicate_cancelled', doc.projectId, {
            subject: `${DOCUMENT_TYPES[doc.type]} ${doc.number}`,
            reason: reason.trim(),
          });
          return null;
        }
        if (existing.projectId !== doc.projectId) fail('That number is used by a document in another project. Remove it there first.');
        const lines = (await all('lines')).filter((l) => l.documentId === existing.id);
        await Promise.all(lines.map((l) => storage.put('lines', l.id, { ...l, archived: true })));
        await storage.put('documents', existing.id, { ...existing, active: false, supersededBy: doc.id });
        const next = { ...doc, active: true, pendingDuplicate: false, duplicateOfId: null, supersedes: existing.id };
        await storage.put('documents', doc.id, next);
        const project = await requireProject(doc.projectId);
        if (project.intake || project.classify) await resetConfirmations(doc.projectId, 'intake');
        await record(actor, 'document_replaced', doc.projectId, {
          subject: `${DOCUMENT_TYPES[doc.type]} ${doc.number}`,
          reason: reason.trim(),
        });
        return next;
      }),

    removeDocument: (documentId, { actor }) =>
      write(async () => {
        need(actor, 'upload', 'Your role cannot remove documents.');
        const doc = await requireDocument(documentId);
        const project = await requireProject(doc.projectId);
        requireOpen(project);
        if (project.intake && doc.active && ORDER_DOCUMENT_TYPES.includes(doc.type))
          fail('The intake review is confirmed. Reopen it to remove this document.');
        await dropLines(doc.id);
        if (doc.fileId) await storage.delete('files', doc.fileId);
        await storage.delete('documents', doc.id);
        await record(actor, 'document_removed', doc.projectId, {
          subject: `${DOCUMENT_TYPES[doc.type]} ${doc.number || doc.fileName}`,
          reason: null,
        });
      }),

    /* The project's lookup table: one file, kept as supplied. A new upload replaces the earlier one. */
    setLookupTable: ({ projectId, file, actor }) =>
      write(async () => {
        need(actor, 'upload', 'Your role cannot upload the lookup table.');
        const kind = lookupKind(file);
        if (!kind) fail(`Only ${LOOKUP_ACCEPTED_TEXT} files can be uploaded.`);
        if (file.size > MAX_FILE_BYTES) fail('This file is larger than 25 MB.');
        const project = await requireProject(projectId);
        requireOpen(project);
        const bytes = await file.arrayBuffer();
        const fileId = newId();
        await storage.put('files', fileId, {
          id: fileId,
          projectId,
          name: file.name,
          type: LOOKUP_KINDS[kind].mime,
          size: file.size,
          hash: await sha256Hex(bytes),
          blob: new Blob([bytes], { type: LOOKUP_KINDS[kind].mime }),
        });
        if (project.lookupTable?.fileId) await storage.delete('files', project.lookupTable.fileId);
        const lookupTable = { fileId, name: file.name, kind, size: file.size, uploadedAt: now(), uploadedBy: actorLabel(actor) };
        const next = { ...project, lookupTable };
        await storage.put('projects', projectId, next);
        await record(actor, 'lookup_table_added', projectId, { subject: file.name, reason: null });
        return next;
      }),

    removeLookupTable: (projectId, { actor }) =>
      write(async () => {
        need(actor, 'upload', 'Your role cannot remove the lookup table.');
        const project = await requireProject(projectId);
        requireOpen(project);
        if (!project.lookupTable) return project;
        if (project.lookupTable.fileId) await storage.delete('files', project.lookupTable.fileId);
        const { lookupTable, ...rest } = project;
        await storage.put('projects', projectId, rest);
        await record(actor, 'lookup_table_removed', projectId, { subject: lookupTable.name, reason: null });
        return rest;
      }),

    getDocumentLines: async (documentId) => (await all('lines')).filter((l) => l.documentId === documentId).sort((a, b) => a.no - b.no),

    getFile: async (fileId) => (fileId ? ((await storage.get('files', fileId)) ?? null) : null),

    updateLine: (lineId, patch, { actor, reason = '' }) =>
      write(async () => {
        const line = await requireLine(lineId);
        const project = await requireProject(line.projectId);
        requireOpen(project);
        const classification = ['kind', 'moduleType', 'pairedToLineId'].some((k) => k in patch);
        const next = { ...line, ...patch };
        if (classification) {
          need(actor, 'classify', 'Your role cannot classify lines.');
          if (project.classify) fail('Classification is confirmed. Reopen it to change lines.');
          if (!reason.trim()) fail('Give a reason for changing the classification.');
          if (patch.pairedToLineId) {
            const product = await requireLine(patch.pairedToLineId);
            if (!('moduleType' in patch)) next.moduleType = product.moduleType;
          }
          if (next.kind !== 'service') next.pairedToLineId = null;
          Object.assign(next, { classificationSource: 'manual', suggestion: null, reviewedBy: stamp(actor) });
          await record(actor, 'line_classified', line.projectId, {
            subject: `Line ${line.no}: ${line.title}`,
            reason: reason.trim(),
            before: { kind: line.kind, moduleType: line.moduleType, pairedToLineId: line.pairedToLineId },
            after: { kind: next.kind, moduleType: next.moduleType, pairedToLineId: next.pairedToLineId },
          });
        } else {
          need(actor, 'edit_lines', 'Your role cannot edit lines.');
          if (project.intake) fail('The intake review is confirmed. Reopen it to edit lines.');
          if ('qty' in patch && !(Number(patch.qty) > 0)) fail('Quantity must be above zero.');
          await record(actor, 'line_edited', line.projectId, { subject: `Line ${line.no}: ${line.title}`, reason: null });
        }
        await storage.put('lines', lineId, next);
        return next;
      }),

    addLine: (documentId, line, { actor }) =>
      write(async () => {
        need(actor, 'edit_lines', 'Your role cannot edit lines.');
        const doc = await requireDocument(documentId);
        const project = await requireProject(doc.projectId);
        requireOpen(project);
        if (project.intake) fail('The intake review is confirmed. Reopen it to add lines.');
        const existing = (await all('lines')).filter((l) => l.documentId === documentId && !l.archived);
        const no = Math.max(0, ...existing.map((l) => l.no)) + 1;
        const [created] = await insertLines(
          doc,
          [
            {
              no,
              title: line.title,
              qty: line.qty ?? 1,
              scopeItems: line.scopeItems ?? [],
            },
          ],
          await getRules(),
          doc.createdAt,
        );
        await record(actor, 'line_added', doc.projectId, { subject: `Line ${no}: ${line.title}`, reason: null });
        return created;
      }),

    deleteLine: (lineId, { actor }) =>
      write(async () => {
        need(actor, 'edit_lines', 'Your role cannot edit lines.');
        const line = await requireLine(lineId);
        const project = await requireProject(line.projectId);
        requireOpen(project);
        if (project.intake) fail('The intake review is confirmed. Reopen it to delete lines.');
        const dependants = (await byProject('lines', line.projectId)).filter((l) => l.pairedToLineId === lineId);
        await Promise.all(dependants.map((l) => storage.put('lines', l.id, { ...l, pairedToLineId: null })));
        await storage.delete('lines', lineId);
        await record(actor, 'line_deleted', line.projectId, { subject: `Line ${line.no}: ${line.title}`, reason: null });
      }),

    rerunRules: (projectId, { actor }) =>
      write(async () => {
        need(actor, 'classify', 'Your role cannot classify lines.');
        const project = await requireProject(projectId);
        requireOpen(project);
        if (project.classify) fail('Classification is confirmed. Reopen it to run the rules again.');
        const rules = await getRules();
        for (const doc of await activeDocuments(projectId)) {
          const lines = (await all('lines')).filter((l) => l.documentId === doc.id && !l.archived).sort((a, b) => a.no - b.no);
          if (!lines.length) continue;
          const fresh = classifyLines(lines, rules);
          await Promise.all(
            fresh.map((f, i) =>
              lines[i].classificationSource === 'manual'
                ? null
                : storage.put('lines', f.id, {
                    ...lines[i],
                    kind: f.kind,
                    moduleType: f.moduleType,
                    matchedRule: f.matchedRule,
                    pairedToLineId: f.pairedToLineId,
                    suggestion: f.suggestion,
                  }),
            ),
          );
        }
        await record(actor, 'rules_rerun', projectId, { reason: null });
      }),

    confirmIntake: (projectId, { actor }) =>
      write(async () => {
        need(actor, 'confirm_intake', 'Only an Admin can confirm the intake lines.');
        const project = await requireProject(projectId);
        requireOpen(project);
        const docs = await byProject('documents', projectId);
        const orders = docs.filter((d) => d.active && ORDER_DOCUMENT_TYPES.includes(d.type));
        if (docs.some((d) => d.pendingDuplicate)) fail('A document is waiting for a duplicate decision.');
        if (!project.entryPath) fail('Choose an entry path first.');
        if (!orders.length) fail('Upload an order document first.');
        if (orders.some((d) => d.status === 'needs_manual')) fail('A document still needs its details entered.');
        if (!(await liveLines(projectId)).length) fail('The order has no lines.');
        const next = { ...project, intake: stamp(actor) };
        await storage.put('projects', projectId, next);
        await record(actor, 'intake_confirmed', projectId, { reason: null });
        return next;
      }),

    reopenIntake: (projectId, { actor, reason }) =>
      write(async () => {
        need(actor, 'reopen', 'Only an Admin can reopen the intake review.');
        if (!reason?.trim()) fail('Give a reason for reopening the intake review.');
        const project = await requireProject(projectId);
        requireOpen(project);
        if (!project.intake) fail('The intake review is not confirmed.');
        await resetConfirmations(projectId, 'intake');
        await record(actor, 'intake_reopened', projectId, { reason: reason.trim() });
      }),

    confirmClassification: (projectId, { actor }) =>
      write(async () => {
        need(actor, 'confirm_classification', 'Your role cannot confirm the classification.');
        const project = await requireProject(projectId);
        requireOpen(project);
        if (!project.intake) fail('Confirm the intake lines first.');
        const lines = await liveLines(projectId);
        if (lines.some((l) => l.kind === 'unknown')) fail('Classify every unknown line first.');
        const noModule = lines.find((l) => (l.kind === 'product' || l.kind === 'subscription') && !l.moduleType);
        if (noModule) fail(`Choose a module type for line ${noModule.no}.`);
        await clearModules(projectId);
        await buildModules(projectId);
        const next = { ...project, classify: stamp(actor) };
        await storage.put('projects', projectId, next);
        await record(actor, 'classification_confirmed', projectId, { reason: null });
        return next;
      }),

    reopenClassification: (projectId, { actor, reason }) =>
      write(async () => {
        need(actor, 'reopen', 'Only an Admin can reopen the classification.');
        if (!reason?.trim()) fail('Give a reason for reopening the classification.');
        const project = await requireProject(projectId);
        requireOpen(project);
        if (!project.classify) fail('The classification is not confirmed.');
        await resetConfirmations(projectId, 'classify');
        await record(actor, 'classification_reopened', projectId, { reason: reason.trim() });
      }),

    setModuleDelivery: (moduleId, { status, deliveredOn }, { actor }) =>
      write(async () => {
        need(actor, 'set_delivery', 'Only an Admin can record delivery.');
        const module = (await storage.get('modules', moduleId)) ?? fail('That module no longer exists.');
        requireOpen(await requireProject(module.projectId));
        if (status !== 'awaiting_delivery' && status !== 'delivered') fail('Choose a delivery status.');
        const today = new Date(now() + 5.5 * 36e5).toISOString().slice(0, 10); // the date in India
        const date = status === 'delivered' ? deliveredOn || today : null;
        await storage.put('modules', moduleId, { ...module, status, deliveredOn: date });
        await record(actor, 'delivery_recorded', module.projectId, {
          subject: module.moduleType,
          reason: null,
          after: { status, deliveredOn: date },
        });
      }),

    assignService: (lineId, moduleId, { actor }) =>
      write(async () => {
        need(actor, 'confirm_classification', 'Only an Admin can assign services to modules.');
        const line = await requireLine(lineId);
        requireOpen(await requireProject(line.projectId));
        const module = (await storage.get('modules', moduleId)) ?? fail('That module no longer exists.');
        await storage.put('lines', lineId, {
          ...line,
          pairedToLineId: module.productLineId,
          moduleType: module.moduleType,
          classificationSource: 'manual',
          suggestion: null,
          reviewedBy: stamp(actor),
        });
        const modules = await byProject('modules', line.projectId);
        const lines = await liveLines(line.projectId);
        for (const m of modules) {
          const services = lines.filter(
            (l) => l.kind === 'service' && (l.id === lineId ? m.id === moduleId : m.serviceLineIds.includes(l.id)),
          );
          const { scopeItems } = splitScope(services.map((l) => (l.id === lineId ? { ...l, ...line } : l)));
          await storage.put('modules', m.id, { ...m, serviceLineIds: services.map((l) => l.id), scopeItems });
        }
        const { entitlements } = splitScope([{ ...line, id: lineId }]);
        for (const e of entitlements) {
          const id = newId();
          await storage.put('entitlements', id, {
            id,
            projectId: line.projectId,
            moduleId,
            ...e,
            startsAt: null,
            status: 'pending_signoff',
          });
        }
        await record(actor, 'service_assigned', line.projectId, { subject: `Line ${line.no}: ${line.title}`, reason: null });
      }),

    getCatalog: async () => fixtures.catalog,

    /* Checklist progress and questionnaire responses of the component pages (temporary until execution is built) */
    getChecklistState: async () => (await storage.get('checklist', 'current')) ?? emptyChecklistState(),

    setTaskProgress: (key, patch, label) =>
      write(async () => {
        const state = (await storage.get('checklist', 'current')) ?? emptyChecklistState();
        await storage.put('checklist', 'current', applyTask(state, key, patch, label, now()));
      }),

    addResponse: (kind, row) =>
      write(async () => {
        const definition = fixtures.catalog.questionnaires[kind] ?? fail('That questionnaire does not exist.');
        if (!row.user?.trim()) fail('User name is required.');
        const state = (await storage.get('checklist', 'current')) ?? emptyChecklistState();
        await storage.put(
          'checklist',
          'current',
          applyAddRow(state, kind, { ...row, user: row.user.trim() }, newId(), definition.title, now()),
        );
      }),

    patchResponse: (kind, id, patch) =>
      write(async () => {
        const state = (await storage.get('checklist', 'current')) ?? emptyChecklistState();
        await storage.put('checklist', 'current', applyPatchRow(state, kind, id, patch));
      }),

    deleteResponse: (kind, id) =>
      write(async () => {
        const state = (await storage.get('checklist', 'current')) ?? emptyChecklistState();
        await storage.put('checklist', 'current', applyDeleteRow(state, kind, id));
      }),

    listAudit: async (projectId) => (await byProject('audit', projectId)).sort((a, b) => b.at - a.at),

    loadSampleProjects: ({ actor }) =>
      write(async () => {
        need(actor, 'create_project', 'Your role cannot create projects.');
        const samples = await fixtures.loadAll();
        const created = [];
        const exists = async (type, number) => (await all('documents')).some((d) => d.type === type && d.number === number);
        const make = async (json, entryPath, prismsuite) => {
          const { document, lines } = extractionToDocument(json);
          if (await exists(document.type, document.number)) return;
          const customer = document.billTo;
          const matches = matchCustomers(await all('customers'), { gstin: customer.gstin, name: customer.name });
          let customerRecord = matches[0]?.customer;
          if (!customerRecord) {
            customerRecord = {
              id: newId(),
              number: customerNumber(await counter('counter:customer')),
              name: customer.name,
              gstin: normaliseGstin(customer.gstin),
              address: customer.address,
              contact: customer.contact,
              email: customer.email,
              createdAt: now(),
            };
            await storage.put('customers', customerRecord.id, customerRecord);
          }
          const fy = financialYear(new Date(now()));
          const project = {
            id: newId(),
            number: projectNumber(fy, await counter(`counter:project:${fy}`)),
            customerId: customerRecord.id,
            entryPath,
            purpose: '',
            siteIds: [],
            status: 'in_progress',
            statusReason: '',
            intake: null,
            classify: null,
            createdAt: now(),
          };
          const hasSite = (await all('sites')).find((x) => x.customerId === customerRecord.id && siteKey(x.name) === 'main site');
          const site = hasSite ?? (await addSiteRecord(customerRecord.id, { name: 'Main site', address: customer.address }, actor));
          project.siteIds = [site.id];
          await storage.put('projects', project.id, project);
          const docs = [{ document, lines }];
          if (prismsuite) docs.push(extractionToDocument(prismsuite));
          for (const [i, d] of docs.entries()) {
            const doc = {
              id: newId(),
              projectId: project.id,
              fileId: null,
              fileName: `Sample ${DOCUMENT_TYPES[d.document.type].toLowerCase().replace('prismsuite', 'PrismSuite')} (no file)`,
              fileHash: null,
              status: d.document.type === 'prismsuite' ? 'attached' : 'parsed',
              parser: { name: 'sample extraction', version: '1' },
              ...d.document,
              active: true,
              pendingDuplicate: false,
              createdAt: now() + i,
            };
            await storage.put('documents', doc.id, doc);
            await insertLines(doc, d.lines, await getRules(), doc.createdAt);
          }
          await record(actor, 'sample_project_created', project.id, { reason: null });
          created.push(project.number);
        };
        await make(samples.pi, 'post_audit', samples.prismsuite);
        await make(samples.po, null, null);
        return created;
      }),

    resetAll: ({ actor }) =>
      write(async () => {
        need(actor, 'reset_data', 'Only an Admin can reset the data.');
        await storage.clear();
      }),
  };
  return api;
}

/* The methods that write. On a storage with transactions each runs on an API built over its own transaction storage */
export const WRITE_METHODS = [
  'updateCustomer',
  'addSite',
  'updateSite',
  'createProject',
  'updateProject',
  'setProjectStatus',
  'addDocument',
  'saveDocumentDetails',
  'resolveDuplicate',
  'removeDocument',
  'setLookupTable',
  'removeLookupTable',
  'updateLine',
  'addLine',
  'deleteLine',
  'rerunRules',
  'confirmIntake',
  'reopenIntake',
  'confirmClassification',
  'reopenClassification',
  'setModuleDelivery',
  'assignService',
  'setTaskProgress',
  'addResponse',
  'patchResponse',
  'deleteResponse',
  'loadSampleProjects',
  'resetAll',
];

export function createLocalApi({ storage, fixtures, now = () => Date.now() }) {
  const listeners = new Set();
  let queue = Promise.resolve();

  /* Writes run one at a time so counters and confirmations cannot interleave */
  const serialise = (job) => {
    const run = queue.then(job);
    queue = run.catch(() => {});
    return run.then((result) => {
      listeners.forEach((l) => l());
      return result;
    });
  };
  const build = (over, write) => buildApi({ storage: over, fixtures, now, listeners, write });

  if (!storage.transaction) return build(storage, (fn) => serialise(fn));

  const unbound = () => {
    throw new Error('A write method is missing from WRITE_METHODS.');
  };
  const api = build(storage, unbound);
  for (const name of WRITE_METHODS) {
    api[name] = (...args) => serialise(() => storage.transaction((tx) => build(tx, (fn) => fn())[name](...args)));
  }
  return api;
}
