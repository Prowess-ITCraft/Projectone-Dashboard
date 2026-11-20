import { describe, expect, it } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { ADMIN, ENGINEER, makeApi, renderApp } from '@/test/providers.jsx';
import ProjectPage from '@/features/projects/ProjectPage.jsx';
import ProjectsPage from '@/features/projects/ProjectsPage.jsx';
import NewProjectPage from '@/features/projects/NewProjectPage.jsx';
import CustomerPage from './CustomerPage.jsx';
import CustomersPage from './CustomersPage.jsx';

const Pages = () => (
  <Routes>
    <Route path="/customers" element={<CustomersPage />} />
    <Route path="/customers/:id" element={<CustomerPage />} />
    <Route path="/projects" element={<ProjectsPage />} />
    <Route path="/projects/new" element={<NewProjectPage />} />
    <Route path="/projects/:id/*" element={<ProjectPage />} />
  </Routes>
);

const pdf = (name) => new File([name], name, { type: 'application/pdf' });

async function seed() {
  const api = makeApi();
  const a = await api.createProject({
    customer: { name: 'Alpha Industries', gstin: '27AAAAA0000A1Z5' },
    entryPath: 'post_audit',
    newSites: [{ name: 'Mumbai office' }, { name: 'Tarapur plant' }],
    actor: ADMIN,
  });
  const b = await api.createProject({ customer: { name: 'Beta Works' }, entryPath: 'new_infra', actor: ADMIN });
  return { api, a, b };
}

describe('customers list', () => {
  it('lists customers with their sites and projects, and searches them', async () => {
    const { api } = await seed();
    renderApp(<Pages />, { path: '/customers', api });
    expect(await screen.findByRole('link', { name: 'Alpha Industries' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Beta Works' })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Search customers'), { target: { value: '27AAAAA' } });
    expect(screen.queryByRole('link', { name: 'Beta Works' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Alpha Industries' })).toBeInTheDocument();
  });

  it('shows stacked cards on a phone', async () => {
    window.__narrow = true;
    const { api } = await seed();
    renderApp(<Pages />, { path: '/customers', api });
    const list = await screen.findByRole('list', { name: 'Customers' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(2);
  });
});

describe('customer page', () => {
  it('shows details, sites and projects, and edits the details', async () => {
    const { api, a } = await seed();
    renderApp(<Pages />, { path: `/customers/${a.customerId}`, api });
    expect(await screen.findByRole('heading', { level: 1, name: 'Alpha Industries' })).toBeInTheDocument();
    expect(screen.getByText('Mumbai office')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'PRJ-2627-0001' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.change(screen.getByLabelText('GSTIN'), { target: { value: '123' } });
    expect(screen.getByText('This GSTIN is not in a valid format (15 characters).')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('GSTIN'), { target: { value: '27AAAAA0000A1Z5' } });
    fireEvent.change(screen.getByLabelText('Contact person'), { target: { value: 'A. Person' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save details' }));
    expect(await screen.findByText('A. Person')).toBeInTheDocument();
    expect(await screen.findByText('Details changed')).toBeInTheDocument();
  });

  it('adds a site and refuses a duplicate name', async () => {
    const { api, a } = await seed();
    renderApp(<Pages />, { path: `/customers/${a.customerId}`, api });
    fireEvent.click(await screen.findByRole('button', { name: 'Add a site' }));
    fireEvent.change(screen.getByLabelText('Site name'), { target: { value: 'tarapur PLANT' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add site' }));
    expect(await screen.findByText('This customer already has a site called tarapur PLANT.')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Site name'), { target: { value: 'Khalapur' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add site' }));
    expect(await screen.findByText('Khalapur')).toBeInTheDocument();
  });

  it('shows the PrismSuite badge only after a report is attached', async () => {
    const { api, a } = await seed();
    const view = renderApp(<Pages />, { path: `/customers/${a.customerId}`, api });
    await screen.findByRole('heading', { level: 1, name: 'Alpha Industries' });
    expect(screen.queryByTitle('Audited through PrismSuite')).not.toBeInTheDocument();
    view.unmount();
    await api.addDocument({ projectId: a.id, type: 'prismsuite', file: pdf('report.pdf'), actor: ADMIN });
    renderApp(<Pages />, { path: `/customers/${a.customerId}`, api });
    await screen.findByRole('heading', { level: 1, name: 'Alpha Industries' });
    expect(screen.getAllByTitle('Audited through PrismSuite').length).toBeGreaterThan(0);
  });
});

describe('projects list', () => {
  it('shows the new columns and filters by status and customer', async () => {
    const { api, b } = await seed();
    await api.setProjectStatus(b.id, 'on_hold', { actor: ADMIN, reason: 'Waiting' });
    renderApp(<Pages />, { path: '/projects', api });
    expect(await screen.findByText('Mumbai office, Tarapur plant')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Filter by status'), { target: { value: 'on_hold' } });
    expect(screen.queryByRole('link', { name: 'PRJ-2627-0001' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'PRJ-2627-0002' })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Filter by status'), { target: { value: 'all' } });
    fireEvent.change(screen.getByLabelText('Filter by customer'), { target: { value: (await api.getProject(b.id)).customer.id } });
    expect(screen.queryByRole('link', { name: 'PRJ-2627-0001' })).not.toBeInTheDocument();
  });

  it('searches site names', async () => {
    const { api } = await seed();
    renderApp(<Pages />, { path: '/projects', api });
    await screen.findByRole('link', { name: 'PRJ-2627-0001' });
    fireEvent.change(screen.getByLabelText('Search projects'), { target: { value: 'tarapur' } });
    expect(screen.queryByRole('link', { name: 'PRJ-2627-0002' })).not.toBeInTheDocument();
  });

  it('shows stacked cards on a phone', async () => {
    window.__narrow = true;
    const { api } = await seed();
    renderApp(<Pages />, { path: '/projects', api });
    const list = await screen.findByRole('list', { name: 'Projects' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(2);
  });
});

describe('new project with sites', () => {
  it('picks existing sites of a returning customer and adds a new one', async () => {
    const { api, a } = await seed();
    renderApp(<Pages />, { path: '/projects/new', api });
    fireEvent.change(await screen.findByLabelText('Customer name'), { target: { value: 'Alpha Industries' } });
    fireEvent.click(await screen.findByRole('button', { name: /Use CUS-0001/ }));
    fireEvent.click(await screen.findByRole('checkbox', { name: /Tarapur plant/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Add a new branch' }));
    fireEvent.change(screen.getByLabelText('New branch 1 name'), { target: { value: 'Khalapur' } });
    fireEvent.click(screen.getByRole('button', { name: 'Post-audit' }));
    fireEvent.click(screen.getByRole('button', { name: 'Create project' }));
    await waitFor(async () => expect((await api.listProjects()).length).toBe(3));
    const created = (await api.listProjects()).find((s) => s.project.id !== a.id && s.customer.id === a.customerId);
    expect(created.sites.map((s) => s.name).sort()).toEqual(['Khalapur', 'Tarapur plant']);
  });
});

describe('project status on the overview', () => {
  it('lets an Admin put a project on hold with a reason, and locks the project', async () => {
    const { api, a } = await seed();
    renderApp(<Pages />, { path: `/projects/${a.id}`, api, actor: ADMIN });
    fireEvent.click(await screen.findByRole('button', { name: 'Put on hold' }));
    const dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByRole('textbox'), { target: { value: 'Customer asked to wait' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Put on hold' }));
    expect(await screen.findAllByText(/This project is on hold/)).not.toHaveLength(0);
    expect(screen.getByRole('button', { name: 'Resume' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Change sites' })).not.toBeInTheDocument();
  });

  it('gives an Engineer none of the Admin project controls, only the order lines and the checklist', async () => {
    const { api, a } = await seed();
    api.server.me = { id: ENGINEER.id, role: 'engineer', name: ENGINEER.name };
    api.assign(a.id, ENGINEER.id);
    renderApp(<Pages />, { path: `/projects/${a.id}`, api, actor: ENGINEER });
    expect(await screen.findByRole('link', { name: 'Checklist' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Put on hold' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Change sites' })).not.toBeInTheDocument();
    expect(screen.queryByText('Only an Admin can change the status.')).not.toBeInTheDocument();
  });

  it('changes the sites a project covers', async () => {
    const { api, a } = await seed();
    renderApp(<Pages />, { path: `/projects/${a.id}`, api });
    fireEvent.click(await screen.findByRole('button', { name: 'Change sites' }));
    fireEvent.click(screen.getByRole('checkbox', { name: /Mumbai office/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Save sites' }));
    await waitFor(async () => expect((await api.getProject(a.id)).sites.map((s) => s.name)).toEqual(['Tarapur plant']));
  });
});
