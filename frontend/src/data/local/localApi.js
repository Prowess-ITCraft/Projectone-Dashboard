import { applyAddRow, applyDeleteRow, applyPatchRow, applyTask, emptyChecklistState } from '@/domain/checklist';
import { classifyLines, DEFAULT_RULES } from '@/domain/classification';
import { DOCUMENT_TYPES, extractionToDocument } from '@/domain/documents';
import { ACCEPTED_TEXT, FILE_KINDS, fileKind } from '@/domain/files';
import { ENTRY_PATHS } from '@/domain/projects';
import { financialYear, customerNumber, newId, projectNumber } from '@/domain/ids';
import { actorLabel, can } from '@/domain/permissions';
import { splitScope } from '@/domain/scope';
import { computeTracker, ORDER_DOCUMENT_TYPES } from '@/domain/stages';
import { normaliseGstin } from '@/domain/gstin';
import { matchCustomers } from '@/domain/customers';
import { sha256Hex } from '@/lib/sha256';

const MAX_FILE_BYTES = 25 * 1024 * 1024;

const fail = (message) => {
  throw new Error(message);
};

/*
  The temporary ProjectOne data layer: every screen reads and writes through this object only. It keeps its data in a
  storage backend (IndexedDB in the browser) and holds the business rules of intake: confirmations, reopening with a
  reason, duplicate documents, module creation. When the backend exists, a second adapter with the same methods replaces it.
  Writes run one at a time so counters and confirmations cannot interleave.
*/
export function createLocalApi({ storage, fixtures, now = () => Date.now() }) {
  const listeners = new Set();
  let queue = Promise.resolve();

  const write = (fn) => {
    const run = queue.then(fn);
    queue = run.catch(() => {});
    return run.then((result) => {
      listeners.forEach((l) => l());
      return result;
    });
  };

  const all = (store) => storage.getAll(store);
  const byProject = async (store, projectId) => (await all(store)).filter((r) => r.projectId === projectId);

  async function counter(key) {
    const current = (await storage.get('meta', key)) ?? { value: 0 };
    const next = current.value + 1;
    await storage.put('meta', key, { value: next });
    return next;
  }

  async function record(actor, action, projectId, details = {}) {
    const id = newId();
    await storage.put('audit', id, { id, at: now(), actor: actor ?? null, action, projectId, ...details });
  }

  async function getRules() {
    const stored = await storage.get('rules', 'current');
    if (stored) return stored;
    await storage.put('rules', 'current', DEFAULT_RULES);
    return DEFAULT_RULES;
  }

  const requireProject = async (id) => (await storage.get('projects', id)) ?? fail('That project no longer exists.');
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

  async function snapshot(projectId) {
    const project = await requireProject(projectId);
    const customer = await storage.get('customers', project.customerId);
    const documents = (await byProject('documents', projectId)).sort((a, b) => a.createdAt - b.createdAt);
    const lines = await liveLines(projectId);
    const modules = (await byProject('modules', projectId)).sort((a, b) => a.createdAt - b.createdAt);
    const entitlements = await byProject('entitlements', projectId);
    return { project, customer, documents, lines, modules, entitlements, tracker: computeTracker({ project, documents, lines }) };
  }

  const api = {
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    isPersistent: () => storage.persistent !== false,
    getRules,

    listCustomers: async () => (await all('customers')).sort((a, b) => a.name.localeCompare(b.name)),
    findCustomerMatches: async ({ gstin, name }) => matchCustomers(await all('customers'), { gstin, name }),

    async listProjects() {
      const projects = (await all('projects')).sort((a, b) => b.createdAt - a.createdAt);
      return Promise.all(projects.map((p) => snapshot(p.id)));
    },
    getProject: (id) => snapshot(id),

    createProject: ({ customer, entryPath, purpose = '', location = '', actor }) =>
      write(async () => {
        need(actor, 'create_project', 'Your role cannot create projects.');
        if (entryPath && !ENTRY_PATHS[entryPath]) fail('Choose one of the listed entry paths.');
        let customerRecord;
        if (customer?.id) customerRecord = (await storage.get('customers', customer.id)) ?? fail('That customer no longer exists.');
        else {
          if (!customer?.name?.trim()) fail('Enter the customer name.');
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
        const fy = financialYear(new Date(now()));
        const project = {
          id: newId(),
          number: projectNumber(fy, await counter(`counter:project:${fy}`)),
          customerId: customerRecord.id,
          entryPath: entryPath || null,
          purpose: purpose.trim(),
          location: location.trim(),
          intake: null,
          classify: null,
          createdAt: now(),
        };
        await storage.put('projects', project.id, project);
        await record(actor, 'project_created', project.id, { reason: null });
        return project;
      }),

    updateProject: (id, patch, { actor }) =>
      write(async () => {
        need(actor, 'create_project', 'Your role cannot change projects.');
        const project = await requireProject(id);
        if (patch.entryPath !== undefined && patch.entryPath !== null && !ENTRY_PATHS[patch.entryPath])
          fail('Choose one of the listed entry paths.');
        const next = { ...project };
        ['entryPath', 'purpose', 'location'].forEach((k) => patch[k] !== undefined && (next[k] = patch[k]));
        await storage.put('projects', id, next);
        await record(actor, 'project_updated', id, { before: { entryPath: project.entryPath }, after: { entryPath: next.entryPath } });
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

    getDocumentLines: async (documentId) => (await all('lines')).filter((l) => l.documentId === documentId).sort((a, b) => a.no - b.no),

    getFile: async (fileId) => (fileId ? ((await storage.get('files', fileId)) ?? null) : null),

    updateLine: (lineId, patch, { actor, reason = '' }) =>
      write(async () => {
        const line = await requireLine(lineId);
        const project = await requireProject(line.projectId);
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
        if (!project.intake) fail('The intake review is not confirmed.');
        await resetConfirmations(projectId, 'intake');
        await record(actor, 'intake_reopened', projectId, { reason: reason.trim() });
      }),

    confirmClassification: (projectId, { actor }) =>
      write(async () => {
        need(actor, 'confirm_classification', 'Your role cannot confirm the classification.');
        const project = await requireProject(projectId);
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
        if (!project.classify) fail('The classification is not confirmed.');
        await resetConfirmations(projectId, 'classify');
        await record(actor, 'classification_reopened', projectId, { reason: reason.trim() });
      }),

    setModuleDelivery: (moduleId, { status, deliveredOn }, { actor }) =>
      write(async () => {
        need(actor, 'set_delivery', 'Only an Admin can record delivery.');
        const module = (await storage.get('modules', moduleId)) ?? fail('That module no longer exists.');
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
        need(actor, 'classify', 'Your role cannot assign services.');
        const line = await requireLine(lineId);
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
            location: '',
            intake: null,
            classify: null,
            createdAt: now(),
          };
          await storage.put('projects', project.id, project);
          const docs = [{ document, lines }];
          if (prismsuite) docs.push(extractionToDocument(prismsuite));
          for (const [i, d] of docs.entries()) {
            const doc = {
              id: newId(),
              projectId: project.id,
              fileId: null,
              fileName: `Sample ${DOCUMENT_TYPES[d.document.type].toLowerCase()} (no file)`,
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
