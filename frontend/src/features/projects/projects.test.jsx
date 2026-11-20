import { describe, expect, it } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { Route, Routes, useLocation } from 'react-router-dom';
import { createFixtures } from '@/data/fixtures';
import { createLocalApi } from '@/data/local/localApi';
import { createMemoryStorage } from '@/data/local/storage';
import { ENGINEER, ADMIN, renderApp } from '@/test/providers.jsx';
import NewProjectPage from './NewProjectPage.jsx';
import ProjectPage from './ProjectPage.jsx';
import ProjectsPage from './ProjectsPage.jsx';

/* An api where every uploaded file is recognised as the given sample type, so no real PDF is needed */
const apiRecognising = (type) => {
  const fixtures = createFixtures({ allowPrivate: false });
  return createLocalApi({ storage: createMemoryStorage(), fixtures: { ...fixtures, lookupByHash: () => type } });
};
const pdf = (name = 'order.pdf') => new File(['%PDF sample'], name, { type: 'application/pdf' });

const orderInput = () => screen.getByLabelText(/drop it here, Order document/);

function Where() {
  return <output data-testid="where">{useLocation().pathname}</output>;
}
const AppRoutes = () => (
  <>
    <Routes>
      <Route path="/projects" element={<ProjectsPage />} />
      <Route path="/projects/new" element={<NewProjectPage />} />
      <Route path="/projects/:id/*" element={<ProjectPage />} />
    </Routes>
    <Where />
  </>
);

async function projectWith(api, patch = {}) {
  return api.createProject({
    customer: { name: 'Test Customer', gstin: '27AAAAA0000A1Z5' },
    entryPath: 'post_audit',
    actor: ADMIN,
    ...patch,
  });
}

describe('projects list', () => {
  it('starts empty, offers a new project, and fills from the sample projects tool', async () => {
    renderApp(<AppRoutes />, { path: '/projects' });
    expect(await screen.findByText(/No projects yet/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /New project/ })).toHaveAttribute('href', '/projects/new');

    fireEvent.click(screen.getByRole('button', { name: 'Load sample projects' }));
    expect(await screen.findByText('PRJ-2627-0001', {}, { timeout: 3000 })).toBeInTheDocument();
    expect(screen.getByText('PRJ-2627-0002')).toBeInTheDocument();
    expect(screen.getByText('Needed')).toBeInTheDocument();
  });

  it('filters by search text and entry path', async () => {
    const api = apiRecognising('pi');
    await api.loadSampleProjects({ actor: ADMIN });
    renderApp(<AppRoutes />, { path: '/projects', api });
    await screen.findByText('PRJ-2627-0001');
    fireEvent.change(screen.getByLabelText('Search projects'), { target: { value: 'engineers' } });
    expect(screen.queryByText('PRJ-2627-0001')).not.toBeInTheDocument();
    expect(screen.getByText('PRJ-2627-0002')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Search projects'), { target: { value: '' } });
    fireEvent.change(screen.getByLabelText('Filter by entry path'), { target: { value: 'post_audit' } });
    expect(screen.getByText('PRJ-2627-0001')).toBeInTheDocument();
    expect(screen.queryByText('PRJ-2627-0002')).not.toBeInTheDocument();
  });

  it('asks for confirmation before resetting, and only the Admin can reset', async () => {
    const api = apiRecognising('pi');
    await projectWith(api);
    const view = renderApp(<AppRoutes />, { path: '/projects', api, actor: ENGINEER });
    await screen.findByText('PRJ-2627-0001');
    expect(screen.getByRole('button', { name: 'Reset project data' })).toBeDisabled();
    view.unmount();

    renderApp(<AppRoutes />, { path: '/projects', api, actor: ADMIN });
    await screen.findByText('PRJ-2627-0001');
    fireEvent.click(screen.getByRole('button', { name: 'Reset project data' }));
    expect(screen.getByRole('alertdialog', { name: 'Reset all project data?' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    expect(await screen.findByText(/No projects yet/)).toBeInTheDocument();
  });
});

describe('new project', () => {
  it('needs a customer name and an entry path before it creates anything', async () => {
    const api = apiRecognising('pi');
    renderApp(<AppRoutes />, { path: '/projects/new', api });
    fireEvent.click(await screen.findByRole('button', { name: 'Create project' }));
    expect(await screen.findByText('Enter the customer name.')).toBeInTheDocument();
    expect(screen.getByText('Choose how this work came about.')).toBeInTheDocument();
    expect(await api.listProjects()).toEqual([]);
  });

  it('flags a GSTIN that is not in a valid format', async () => {
    renderApp(<AppRoutes />, { path: '/projects/new' });
    fireEvent.change(await screen.findByLabelText('GSTIN'), { target: { value: '27AAAAA' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create project' }));
    expect(await screen.findByText(/not in a valid format/)).toBeInTheDocument();
  });

  it('suggests the existing customer for a known GSTIN and reuses it', async () => {
    const api = apiRecognising('pi');
    const first = await projectWith(api);
    renderApp(<AppRoutes />, { path: '/projects/new', api });
    fireEvent.change(await screen.findByLabelText('GSTIN'), { target: { value: '27aaaaa0000a1z5' } });
    fireEvent.click(await screen.findByRole('button', { name: 'Use CUS-0001' }));
    expect(screen.getByText(/added to the existing customer/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Restructuring' }));
    fireEvent.click(screen.getByRole('button', { name: 'Create project' }));
    await waitFor(() => expect(screen.getByTestId('where').textContent).toMatch(/^\/projects\/.+\/documents$/));
    const projects = await api.listProjects();
    expect(projects).toHaveLength(2);
    expect(projects.every((p) => p.project.customerId === first.customerId)).toBe(true);
  });

  it('no longer asks for a purpose', async () => {
    renderApp(<AppRoutes />, { path: '/projects/new' });
    await screen.findByLabelText('Customer name');
    expect(screen.queryByLabelText('Purpose')).not.toBeInTheDocument();
  });

  it('says PrismSuite is not integrated, and adds the chosen order document to the project it creates', async () => {
    const api = apiRecognising(null);
    renderApp(<AppRoutes />, { path: '/projects/new', api });
    fireEvent.change(await screen.findByLabelText('Customer name'), { target: { value: 'Test Customer' } });
    fireEvent.click(screen.getByRole('button', { name: 'New infrastructure' }));
    expect(screen.queryByText('Start from a document')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Upload PO/PI' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Import from PrismSuite' }));
    expect(screen.getByText('PrismSuite is not integrated yet.')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('PO or PI file'), { target: { files: [new File(['x'], 'order.png')] } });
    expect(screen.getByText(/order\.png: Only PDF or Word/)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('PO or PI file'), { target: { files: [pdf('order.pdf')] } });
    expect(screen.getByText('order.pdf')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Purchase order' }));
    fireEvent.click(screen.getByRole('button', { name: 'Create project' }));

    await waitFor(() => expect(screen.getByTestId('where').textContent).toMatch(/^\/projects\/.+\/documents$/));
    const [{ documents }] = await api.listProjects();
    expect(documents.map((d) => [d.type, d.fileName])).toEqual([['po', 'order.pdf']]);
  });

  it('takes an optional PrismSuite report (PDF or Word only), lets it be removed, and adds it to the new project', async () => {
    const api = apiRecognising(null);
    renderApp(<AppRoutes />, { path: '/projects/new', api });
    fireEvent.change(await screen.findByLabelText('Customer name'), { target: { value: 'Test Customer' } });
    fireEvent.click(screen.getByRole('button', { name: 'New infrastructure' }));
    expect(screen.getByRole('button', { name: 'Upload PrismSuite report' })).toBeInTheDocument();
    expect(screen.getByText('Optional, if a report exists')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Import from PrismSuite' })).toBeInTheDocument();

    // Excel and pictures are refused for the report and for the order document
    fireEvent.change(screen.getByLabelText('PrismSuite report file'), { target: { files: [new File(['x'], 'report.xlsx')] } });
    expect(screen.getByText(/report\.xlsx: Only PDF or Word/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('PO or PI file'), { target: { files: [new File(['x'], 'order.xlsx')] } });
    expect(screen.getByText(/order\.xlsx: Only PDF or Word/)).toBeInTheDocument();
    expect(screen.queryByText('PrismSuite report')).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('PrismSuite report file'), { target: { files: [pdf('first.pdf')] } });
    expect(screen.getByText('first.pdf')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Remove PrismSuite report' }));
    expect(screen.queryByText('first.pdf')).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('PrismSuite report file'), { target: { files: [pdf('report.pdf')] } });
    fireEvent.click(screen.getByRole('button', { name: 'Create project' }));
    await waitFor(() => expect(screen.getByTestId('where').textContent).toMatch(/^\/projects\/.+\/documents$/));
    const [{ documents }] = await api.listProjects();
    expect(documents.map((d) => [d.type, d.fileName])).toEqual([['prismsuite', 'report.pdf']]);
  });
});

describe('uploading and reviewing', () => {
  async function openDocuments(api, actor = ADMIN) {
    const project = await projectWith(api);
    renderApp(<AppRoutes />, { path: `/projects/${project.id}/documents`, api, actor });
    await screen.findByRole('heading', { name: 'Documents' });
    return project;
  }

  it('reads a recognised proforma invoice, shows its lines, and confirms intake and classification', async () => {
    const api = apiRecognising('pi');
    const project = await openDocuments(api);
    fireEvent.change(orderInput(), {
      target: { files: [pdf('order.pdf')] },
    });
    expect(await screen.findByText(/was recognised/)).toBeInTheDocument();
    expect(screen.getByText('ITCRAFT/NN/2627/002')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('link', { name: /Order lines/ }));
    expect(await screen.findByLabelText('Description of line 1')).toBeInTheDocument();
    expect(screen.queryByLabelText('Rate of line 1')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Kind of line 7')).toHaveValue('product');
    expect(screen.getByLabelText('Module of line 7')).toHaveValue('firewall');

    fireEvent.click(screen.getByRole('button', { name: 'Confirm intake lines' }));
    expect(await screen.findByRole('button', { name: 'Confirm classification and create modules' })).toBeEnabled();
    expect(screen.getByLabelText('Description of line 1')).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'Confirm classification and create modules' }));
    await screen.findByRole('button', { name: 'Reopen classification' });
    fireEvent.click(screen.getByRole('link', { name: /Modules/ }));
    expect(await screen.findByRole('heading', { name: 'Firewall' })).toBeInTheDocument();
    expect(screen.getAllByText('Procedure pending').length).toBeGreaterThan(0);
    expect((await api.getProject(project.id)).modules).toHaveLength(5);
  });

  it('shows no money fields on the order lines', async () => {
    const api = apiRecognising('pi');
    await openDocuments(api);
    fireEvent.change(orderInput(), { target: { files: [pdf()] } });
    await screen.findByText(/was recognised/);
    fireEvent.click(screen.getByRole('link', { name: /Order lines/ }));
    await screen.findByLabelText('Description of line 1');
    expect(screen.queryByLabelText('Rate of line 1')).not.toBeInTheDocument();
    expect(screen.queryByText(/Grand total/)).not.toBeInTheDocument();
  });

  it('asks for a reason before a classification changes and records it', async () => {
    const api = apiRecognising('pi');
    const project = await openDocuments(api);
    fireEvent.change(orderInput(), { target: { files: [pdf()] } });
    await screen.findByText(/was recognised/);
    fireEvent.click(screen.getByRole('link', { name: /Order lines/ }));
    await screen.findByLabelText('Description of line 1');

    fireEvent.change(screen.getByLabelText('Kind of line 3'), { target: { value: 'service' } });
    const dialog = await screen.findByRole('dialog', { name: 'Change the classification' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save change' }));
    expect(await within(dialog).findByText('A reason is required.')).toBeInTheDocument();
    fireEvent.change(within(dialog).getByLabelText('Reason'), { target: { value: 'Setup only, no licence' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save change' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(screen.getByLabelText('Kind of line 3')).toHaveValue('service'));
    expect((await api.listAudit(project.id)).find((a) => a.action === 'line_classified').reason).toBe('Setup only, no licence');
  });

  it('sends an unrecognised file to manual entry and saves typed lines', async () => {
    const api = apiRecognising(null);
    await openDocuments(api);
    fireEvent.change(orderInput(), {
      target: { files: [pdf('unknown.pdf')] },
    });
    const dialog = await screen.findByRole('dialog', { name: 'Proforma invoice details' });
    fireEvent.change(within(dialog).getByLabelText('Document number'), { target: { value: 'PI/9' } });
    fireEvent.change(within(dialog).getByLabelText('Document date'), { target: { value: '2026-11-10' } });
    fireEvent.change(within(dialog).getByLabelText('Description'), { target: { value: 'QNAP TS-464 NAS' } });
    expect(within(dialog).queryByLabelText('Rate')).not.toBeInTheDocument();
    expect(within(dialog).queryByLabelText('Amount')).not.toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save details' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(await screen.findByText('PI/9')).toBeInTheDocument();
    expect(screen.getByText('Entered by hand')).toBeInTheDocument();
  });

  it('keeps the dialog open and explains a missing document number', async () => {
    const api = apiRecognising(null);
    await openDocuments(api);
    fireEvent.change(orderInput(), {
      target: { files: [pdf('unknown.pdf')] },
    });
    const dialog = await screen.findByRole('dialog', { name: 'Proforma invoice details' });
    fireEvent.change(within(dialog).getByLabelText('Description'), { target: { value: 'Something' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save details' }));
    expect(await within(dialog).findByText('Enter the document number.')).toBeInTheDocument();
  });

  it('rejects a file type that is not supported with a clear message', async () => {
    const api = apiRecognising('pi');
    await openDocuments(api);
    fireEvent.change(orderInput(), {
      target: { files: [new File(['x'], 'order.png')] },
    });
    expect(await screen.findByText('Only PDF or Word (.docx) files can be uploaded.')).toBeInTheDocument();
  });

  it('holds a repeated document for a decision and replaces the earlier one', async () => {
    const api = apiRecognising('pi');
    const project = await openDocuments(api);
    fireEvent.change(orderInput(), { target: { files: [pdf('first.pdf')] } });
    await screen.findByText(/was recognised/);
    fireEvent.change(orderInput(), { target: { files: [pdf('second.pdf')] } });

    const dialog = await screen.findByRole('alertdialog');
    expect(within(dialog).getByRole('region', { name: 'Already stored' })).toBeInTheDocument();
    expect(within(dialog).getByRole('region', { name: 'New upload' })).toBeInTheDocument();
    fireEvent.change(within(dialog).getByLabelText('Reason for the decision'), { target: { value: 'Customer sent a corrected copy' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Replace the earlier one' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(await screen.findByText('Replaced, kept as history')).toBeInTheDocument();
    const { documents, lines } = await api.getProject(project.id);
    expect(documents).toHaveLength(2);
    expect(lines).toHaveLength(10);
  });

  it('attaches a PrismSuite report and shows the coverage check', async () => {
    const api = apiRecognising('prismsuite');
    const project = await openDocuments(api);
    fireEvent.change(screen.getByLabelText(/drop it here, PrismSuite report/), { target: { files: [pdf('report.pdf')] } });
    await screen.findByText(/7 recommendations were read/);
    fireEvent.click(screen.getByRole('link', { name: 'Coverage' }));
    expect(await screen.findByText(/never changes the order/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Recommended but not ordered' })).toBeInTheDocument();
    expect(screen.getByText('Deploy NAS if data is critical')).toBeInTheDocument();
    expect((await api.getProject(project.id)).lines).toHaveLength(0);
  });
});

describe('project page', () => {
  it('shows the stage tracker with the entry path blocking until it is chosen, and the reason for each locked stage', async () => {
    const api = apiRecognising('pi');
    const project = await projectWith(api, { entryPath: null });
    renderApp(<AppRoutes />, { path: `/projects/${project.id}`, api });
    const stages = await screen.findByRole('list', { name: 'Project stages' });
    expect(within(stages).getByText('Choose an entry path for this project.')).toBeInTheDocument();
    expect(within(stages).getByText('Locked until stage 3 is done.')).toBeInTheDocument();
    expect(within(stages).getAllByText('Coming later').length).toBe(7);
  });

  it('says so when the project no longer exists', async () => {
    renderApp(<AppRoutes />, { path: '/projects/missing' });
    expect(await screen.findByRole('alert')).toHaveTextContent('That project no longer exists.');
  });
});
