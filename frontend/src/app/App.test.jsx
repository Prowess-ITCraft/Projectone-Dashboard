import { describe, expect, it } from 'vitest';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import App from './App.jsx';
import { ADMIN, ENGINEER, makeApi, renderApp } from '@/test/providers.jsx';
import { NO_STEPS } from '@/features/projects/ChecklistTab.jsx';

const renderAt = (path) => renderApp(<App />, { path });

describe('App shell', () => {
  it('renders the overview with the navigation', async () => {
    renderAt('/dashboard');
    expect(await screen.findByRole('heading', { level: 1, name: 'Overview' })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Main' })).toBeInTheDocument();
  });

  it('redirects unknown paths to the overview', async () => {
    renderAt('/nowhere');
    expect(await screen.findByRole('heading', { level: 1, name: 'Overview' })).toBeInTheDocument();
  });

  it('shows only built areas in the menu', async () => {
    renderAt('/dashboard');
    const menu = await screen.findByRole('navigation', { name: 'Main' });
    expect(within(menu).getByRole('button', { name: 'Dashboard' })).toBeInTheDocument();
    expect(within(menu).getByRole('button', { name: 'Projects' })).toBeInTheDocument();
    expect(within(menu).queryByRole('button', { name: 'Approvals' })).not.toBeInTheDocument();
  });
});

describe('App shell on a phone', () => {
  it('starts with the drawer closed and a bottom bar of Dashboard, Projects and More', async () => {
    window.__narrow = true;
    renderAt('/dashboard');
    const bar = await screen.findByRole('navigation', { name: 'Quick' });
    expect(
      within(bar)
        .getAllByRole('link')
        .map((a) => a.textContent),
    ).toEqual(['Dashboard', 'Projects']);
    expect(within(bar).getByRole('link', { name: 'Dashboard' })).toHaveAttribute('aria-current', 'page');
    expect(within(bar).getByRole('button', { name: 'More' })).toHaveAttribute('aria-expanded', 'false');
    expect(document.getElementById('app-sidebar')).toHaveAttribute('inert');
  });

  it('opens the drawer from More and closes it from the backdrop or Escape', async () => {
    window.__narrow = true;
    renderAt('/dashboard');
    const more = await screen.findByRole('button', { name: 'More' });
    fireEvent.click(more);
    expect(more).toHaveAttribute('aria-expanded', 'true');
    expect(document.getElementById('app-sidebar')).not.toHaveAttribute('inert');

    fireEvent.click(screen.getByRole('button', { name: 'Close navigation' }));
    expect(more).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(more);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(more).toHaveAttribute('aria-expanded', 'false');
  });

  it('closes the drawer after picking a page', async () => {
    window.__narrow = true;
    renderAt('/dashboard');
    fireEvent.click(await screen.findByRole('button', { name: 'More' }));
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Main' })).getByRole('button', { name: 'Implementation services' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Implementation services' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'More' })).toHaveAttribute('aria-expanded', 'false');
  });
});

describe('project tabs', () => {
  it('switches between the tabs of a project without losing the page', async () => {
    const api = makeApi();
    const project = await api.createProject({ customer: { name: 'Tab Customer' }, entryPath: 'post_audit', actor: ADMIN });
    renderApp(<App />, { path: `/projects/${project.id}/documents`, api });
    await screen.findByRole('heading', { level: 1, name: 'Tab Customer' });
    for (const gone of ['Coverage', 'Modules'])
      expect(screen.queryByRole('link', { name: new RegExp(`^${gone}`) })).not.toBeInTheDocument();
    for (const [tab, text] of [
      ['Order lines', /There are no order lines yet/],
      ['Overview', /Choose a file or drop it here/],
      ['Checklist', new RegExp(NO_STEPS.slice(0, 30))],
    ]) {
      fireEvent.click(screen.getByRole('link', { name: new RegExp(`^${tab}`) }));
      expect(await screen.findByText(text, {}, { timeout: 3000 })).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 1, name: 'Tab Customer' })).toBeInTheDocument();
    }
  });
});

describe('App shell when the window changes width', () => {
  it('closes the sidebar when a wide window becomes narrow, so the drawer does not cover the page', async () => {
    const listeners = new Set();
    const original = window.matchMedia;
    let narrow = false;
    window.matchMedia = (query) => ({
      get matches() {
        return /max-width/.test(query) ? narrow : false;
      },
      media: query,
      addEventListener: (_e, l) => listeners.add(l),
      removeEventListener: (_e, l) => listeners.delete(l),
      addListener: (l) => listeners.add(l),
      removeListener: (l) => listeners.delete(l),
    });
    try {
      renderAt('/dashboard');
      await screen.findByRole('heading', { level: 1, name: 'Overview' });
      expect(document.getElementById('app-sidebar')).not.toHaveAttribute('inert');
      act(() => {
        narrow = true;
        listeners.forEach((l) => l({ matches: true }));
      });
      expect(document.getElementById('app-sidebar')).toHaveAttribute('inert');
      expect(screen.queryByRole('button', { name: 'Close navigation' })).not.toBeInTheDocument();
    } finally {
      window.matchMedia = original;
    }
  });
});

const ENGINEER_SESSION = { id: ENGINEER.id, email: 'eng@test.com', name: ENGINEER.name, role: 'engineer', mustChangePassword: false };
const asEngineer = (path, api = makeApi()) => renderApp(<App />, { path, api, actor: ENGINEER, session: ENGINEER_SESSION });

describe('an engineer', () => {
  it('sees only My work in the menu, and is sent there from the Admin pages', async () => {
    asEngineer('/dashboard');
    expect(await screen.findByRole('heading', { level: 1, name: 'My work' })).toBeInTheDocument();
    const menu = screen.getByRole('navigation', { name: 'Main' });
    expect(within(menu).getByRole('button', { name: 'My work' })).toBeInTheDocument();
    for (const name of ['Dashboard', 'Projects', 'Customers', 'Users', 'Implementation services']) {
      expect(within(menu).queryByRole('button', { name })).not.toBeInTheDocument();
    }
  });

  it('cannot open the Users page', async () => {
    asEngineer('/users');
    expect(await screen.findByRole('heading', { level: 1, name: 'My work' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Users' })).not.toBeInTheDocument();
  });

  it('sees an empty checklist with its phases, columns and 0 of 0 on an assigned project', async () => {
    const api = makeApi();
    const project = await api.createProject({ customer: { name: 'Site Co' }, entryPath: 'new_infra', actor: ADMIN });
    asEngineer(`/projects/${project.id}/checklist`, api);
    expect(await screen.findByText(NO_STEPS)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Installation steps' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Configuration steps' })).toBeInTheDocument();
    expect(screen.getAllByText('0 of 0 completed')).toHaveLength(2);
    expect(
      screen
        .getAllByRole('columnheader')
        .map((c) => c.textContent)
        .slice(0, 7),
    ).toEqual(['SN', 'Done', 'Task', 'Start date', 'End date', 'Progress', 'Comments']);
    expect(screen.queryByText(/Dell R740/)).not.toBeInTheDocument();
    expect(document.querySelector('.back')).toHaveAttribute('href', '/my-work');
  });

  it('is asked for a new password before anything else after a temporary one', async () => {
    renderApp(<App />, { path: '/my-work', actor: ENGINEER, session: { ...ENGINEER_SESSION, mustChangePassword: true } });
    expect(await screen.findByRole('heading', { level: 1, name: 'Choose a new password' })).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Main' })).not.toBeInTheDocument();
  });
});

describe('the alerts bell', () => {
  it('shows the unread count, lists alerts newest first, and opens the project of one it marks read', async () => {
    const api = makeApi();
    const project = await api.createProject({ customer: { name: 'Bell Co' }, entryPath: 'new_infra', actor: ADMIN });
    api.server.notifications.push(
      {
        id: 'n1',
        type: 'project_assigned',
        message: 'New project assigned: PRJ-2627-0001, Bell Co',
        projectId: project.id,
        read: false,
        createdAt: 2,
      },
      { id: 'n0', type: 'project_assigned', message: 'An older alert', projectId: null, read: true, createdAt: 1 },
    );
    asEngineer('/my-work', api);
    const bell = await screen.findByRole('button', { name: 'Alerts, 1 unread' });
    fireEvent.click(bell);
    const panel = screen.getByRole('region', { name: 'Alerts' });
    expect(
      within(panel)
        .getAllByRole('button')
        .slice(1)
        .map((b) => b.textContent),
    ).toEqual([expect.stringContaining('New project assigned: PRJ-2627-0001, Bell Co'), expect.stringContaining('An older alert')]);
    fireEvent.click(within(panel).getByRole('button', { name: /New project assigned/ }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Bell Co' })).toBeInTheDocument();
    await waitFor(() => expect(api.server.notifications[0].read).toBe(true));
    expect(await screen.findByRole('button', { name: 'Alerts' })).toBeInTheDocument();
  });
});
