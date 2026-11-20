import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import App from '@/app/App.jsx';
import { demoAccount } from '@/app/session.jsx';
import { makeApi, renderApp } from '@/test/providers.jsx';
import { ProjectSteps, STEPS } from './ProjectSteps.jsx';

const ADMIN_USER = { id: 'u-admin', name: 'Head Admin', email: 'admin@test.com', role: 'admin' };
const ENGINEER_USER = { id: 'u-eng', name: 'Engineer 01', email: 'engineer01@test.com', role: 'engineer' };
const PASSWORDS = { 'admin@test.com': 'admin password', 'engineer01@test.com': 'engineer password' };

const signedOut = (path = '/dashboard', server = {}) => {
  const api = makeApi({ users: [ADMIN_USER, ENGINEER_USER], passwords: PASSWORDS, ...server });
  return renderApp(<App />, { path, api, session: null, actor: null });
};

const signIn = (email, password) => {
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: email } });
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: password } });
  fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
};

describe('demo access box', () => {
  it('appears only in development, and only when its account is set in the local env file', () => {
    expect(demoAccount({ DEV: true, VITE_DEMO_EMAIL: 'a@test.com', VITE_DEMO_PASSWORD: 'pw' })).toEqual({
      email: 'a@test.com',
      password: 'pw',
    });
    expect(demoAccount({ DEV: false, VITE_DEMO_EMAIL: 'a@test.com', VITE_DEMO_PASSWORD: 'pw' })).toBeNull();
    expect(demoAccount({ DEV: true })).toBeNull();
  });

  it('is not on the sign-in page without that setting', async () => {
    signedOut();
    await screen.findByRole('heading', { level: 1, name: 'Welcome back' });
    expect(screen.queryByText('Demo access')).not.toBeInTheDocument();
  });
});

describe('sign-in gate', () => {
  it('sends a signed-out visit to the sign-in page', async () => {
    signedOut();
    expect(await screen.findByRole('heading', { level: 1, name: 'Welcome back' })).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Main' })).not.toBeInTheDocument();
  });

  it('checks the fields before trying to sign in', async () => {
    const { api } = signedOut();
    fireEvent.click(await screen.findByRole('button', { name: 'Sign in' }));
    expect(screen.getByText('Enter your email.')).toBeInTheDocument();
    expect(screen.getByText('Enter your password.')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'not-an-email' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(screen.getByText('Enter a valid email address.')).toBeInTheDocument();
    expect(api.server.calls).toEqual([]);
  });

  it('shows the one answer the server gives for a wrong email or password', async () => {
    signedOut();
    await screen.findByLabelText('Email');
    signIn('engineer01@test.com', 'wrong');
    expect(await screen.findByText('That email and password do not match.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Welcome back' })).toBeInTheDocument();
  });

  it('signs an Admin in to the dashboard', async () => {
    signedOut('/login');
    await screen.findByLabelText('Email');
    signIn('admin@test.com', 'admin password');
    expect(await screen.findByRole('heading', { level: 1, name: 'Overview' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Account menu, Head Admin' })).toBeInTheDocument();
  });

  it('signs an engineer in to My work, even when they were headed for an Admin page', async () => {
    signedOut('/projects');
    await screen.findByLabelText('Email');
    signIn('engineer01@test.com', 'engineer password');
    expect(await screen.findByRole('heading', { level: 1, name: 'My work' })).toBeInTheDocument();
  });

  it('asks for a new password after signing in with a temporary one, then opens the app', async () => {
    signedOut('/login', { users: [ADMIN_USER, { ...ENGINEER_USER, mustChangePassword: true }] });
    await screen.findByLabelText('Email');
    signIn('engineer01@test.com', 'engineer password');
    expect(await screen.findByRole('heading', { level: 1, name: 'Choose a new password' })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Current password'), { target: { value: 'engineer password' } });
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'short' } });
    fireEvent.change(screen.getByLabelText('New password again'), { target: { value: 'different' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save and continue' }));
    expect(screen.getByText('Use at least 10 characters.')).toBeInTheDocument();
    expect(screen.getByText('The two new passwords do not match.')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'my own password' } });
    fireEvent.change(screen.getByLabelText('New password again'), { target: { value: 'my own password' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save and continue' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'My work' })).toBeInTheDocument();
  });

  it('shows and hides the password', async () => {
    signedOut();
    const field = await screen.findByLabelText('Password');
    expect(field).toHaveAttribute('type', 'password');
    fireEvent.click(screen.getByRole('button', { name: 'Show password' }));
    expect(field).toHaveAttribute('type', 'text');
    expect(screen.getByRole('button', { name: 'Hide password' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('signs out from the profile menu and returns to the sign-in page, and the sidebar has no sign out button', async () => {
    renderApp(<App />, { path: '/dashboard' });
    const sidebar = (await screen.findByRole('navigation', { name: 'Main' })).closest('aside');
    expect(within(sidebar).queryByRole('button', { name: /Sign out/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Account menu, ITCraft' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Sign out' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Welcome back' })).toBeInTheDocument();
  });

  it('shows the signed-in person in a profile menu for an Admin and for an engineer, closing on Escape and outside click', async () => {
    const view = renderApp(<App />, { path: '/dashboard' });
    const badge = await screen.findByRole('button', { name: 'Account menu, ITCraft' });
    expect(badge).toHaveTextContent('IT');
    expect(badge).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(badge);
    const menu = screen.getByRole('menu', { name: 'Account' });
    expect(within(menu).getByText('ITCraft')).toBeInTheDocument();
    expect(within(menu).getByText('itcraft@test.com')).toBeInTheDocument();
    expect(within(menu).getByText('Admin')).toBeInTheDocument();
    expect(within(menu).getByRole('menuitem', { name: 'Change password' })).toBeInTheDocument();
    expect(within(menu).getByRole('menuitem', { name: 'Sign out' })).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(badge).toHaveFocus();
    fireEvent.click(badge);
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    view.unmount();

    const engineer = { id: 'u-eng', email: 'ravi@test.com', name: 'Ravi Kumar', role: 'engineer', mustChangePassword: false };
    renderApp(<App />, { path: '/my-work', session: engineer, actor: undefined });
    const engineerBadge = await screen.findByRole('button', { name: 'Account menu, Ravi Kumar' });
    expect(engineerBadge).toHaveTextContent('RK');
    fireEvent.click(engineerBadge);
    expect(within(screen.getByRole('menu')).getByText('Engineer')).toBeInTheDocument();
  });

  it('returns to the sign-in page and says why when the session ends', async () => {
    const api = makeApi({ users: [ADMIN_USER], me: ADMIN_USER });
    renderApp(<App />, { path: '/dashboard', api, session: undefined, actor: undefined });
    await screen.findByRole('heading', { level: 1, name: 'Overview' });
    act(() => api.endSession('session_expired'));
    expect(await screen.findByText('Your session ended after a period without activity. Sign in again.')).toBeInTheDocument();
  });

  it('sends a signed-in visit to the sign-in page on to the app', async () => {
    renderApp(<App />, { path: '/login' });
    expect(await screen.findByRole('heading', { level: 1, name: 'Overview' })).toBeInTheDocument();
  });
});

describe('project steps panel', () => {
  const stateOf = () => screen.getAllByRole('listitem').map((li) => li.dataset.state);

  it('lists the four steps of a project under its heading', () => {
    render(<ProjectSteps />);
    expect(screen.getByRole('heading', { name: 'What happens when you run a project' })).toBeInTheDocument();
    expect(screen.getAllByRole('listitem').map((li) => within(li).getByText(/./, { selector: 'b' }).textContent)).toEqual(
      STEPS.map((s) => s.title),
    );
  });

  it('lights the steps one after another, rests on all done, then starts again', () => {
    vi.useFakeTimers();
    try {
      render(<ProjectSteps intervalMs={1000} />);
      expect(stateOf()).toEqual(['current', 'pending', 'pending', 'pending']);
      act(() => vi.advanceTimersByTime(1000));
      expect(stateOf()).toEqual(['done', 'current', 'pending', 'pending']);
      act(() => vi.advanceTimersByTime(3000));
      expect(stateOf()).toEqual(['done', 'done', 'done', 'done']);
      act(() => vi.advanceTimersByTime(2000));
      expect(stateOf()).toEqual(['current', 'pending', 'pending', 'pending']);
    } finally {
      vi.useRealTimers();
    }
  });

  it('shows every step done and does not move when reduced motion is on', () => {
    const original = window.matchMedia;
    window.matchMedia = (query) => ({ ...original(query), matches: /reduce/.test(query) });
    vi.useFakeTimers();
    try {
      render(<ProjectSteps intervalMs={1000} />);
      expect(stateOf()).toEqual(['done', 'done', 'done', 'done']);
      act(() => vi.advanceTimersByTime(5000));
      expect(stateOf()).toEqual(['done', 'done', 'done', 'done']);
    } finally {
      vi.useRealTimers();
      window.matchMedia = original;
    }
  });
});
