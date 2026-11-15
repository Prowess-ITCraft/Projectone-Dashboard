import { describe, expect, it } from 'vitest';
import { fireEvent, screen, within } from '@testing-library/react';
import App from './App.jsx';
import { INTAKE, makeApi, renderApp } from '@/test/providers.jsx';

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
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Main' })).getByRole('button', { name: 'Components' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Components' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'More' })).toHaveAttribute('aria-expanded', 'false');
  });
});

describe('project tabs', () => {
  it('switches between the tabs of a project without losing the page', async () => {
    const api = makeApi();
    const project = await api.createProject({ customer: { name: 'Tab Customer' }, entryPath: 'post_audit', actor: INTAKE });
    renderApp(<App />, { path: `/projects/${project.id}/documents`, api });
    await screen.findByRole('heading', { level: 1, name: 'Tab Customer' });
    for (const [tab, text] of [
      ['Modules', /Modules are created when the classification is confirmed/],
      ['Coverage', /No PrismSuite report is attached/],
      ['Order lines', /There are no order lines yet/],
      ['Overview', /Recent activity/],
    ]) {
      fireEvent.click(screen.getByRole('link', { name: new RegExp(`^${tab}`) }));
      expect(await screen.findByText(text, {}, { timeout: 3000 })).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 1, name: 'Tab Customer' })).toBeInTheDocument();
    }
  });
});
