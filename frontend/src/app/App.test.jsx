import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from './App.jsx';
import { StoreProvider } from '@/store.jsx';

const renderAt = (path) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <StoreProvider>
        <App />
      </StoreProvider>
    </MemoryRouter>,
  );

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
    expect(within(menu).queryByRole('button', { name: 'Projects' })).not.toBeInTheDocument();
  });
});

describe('App shell on a phone', () => {
  it('starts with the drawer closed and a bottom bar of Dashboard and More', async () => {
    window.__narrow = true;
    renderAt('/dashboard');
    const bar = await screen.findByRole('navigation', { name: 'Quick' });
    expect(
      within(bar)
        .getAllByRole('link')
        .map((a) => a.textContent),
    ).toEqual(['Dashboard']);
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
