import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import App from '@/app/App.jsx';
import { checkDemoCredentials } from '@/app/session.jsx';
import { renderApp } from '@/test/providers.jsx';
import { ProjectSteps, STEPS } from './ProjectSteps.jsx';

const signedOut = (path = '/dashboard') => renderApp(<App />, { path, session: null });

describe('demo credentials', () => {
  it('accepts the demo account, ignoring case and spaces in the email', () => {
    expect(checkDemoCredentials(' ADI@test.com ', 'test1234')).toMatchObject({ name: 'Adi', role: 'admin' });
  });

  it('refuses a wrong password or another email', () => {
    expect(checkDemoCredentials('adi@test.com', 'Test1234')).toBeNull();
    expect(checkDemoCredentials('someone@test.com', 'test1234')).toBeNull();
    expect(checkDemoCredentials('', '')).toBeNull();
  });
});

describe('sign-in gate', () => {
  it('sends a signed-out visit to the sign-in page', async () => {
    signedOut();
    expect(await screen.findByRole('heading', { level: 1, name: 'Welcome back' })).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Main' })).not.toBeInTheDocument();
  });

  it('checks the fields before trying to sign in', async () => {
    signedOut();
    fireEvent.click(await screen.findByRole('button', { name: 'Sign in' }));
    expect(screen.getByText('Enter your email.')).toBeInTheDocument();
    expect(screen.getByText('Enter your password.')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'not-an-email' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(screen.getByText('Enter a valid email address.')).toBeInTheDocument();
  });

  it('says plainly when the email and password do not match', async () => {
    signedOut();
    fireEvent.change(await screen.findByLabelText('Email'), { target: { value: 'adi@test.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'wrong' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(screen.getByText('That email and password do not match.')).toBeInTheDocument();
  });

  it('fills the demo account, signs in as Admin and opens the page it was headed for', async () => {
    signedOut('/projects');
    fireEvent.click(await screen.findByRole('button', { name: 'Fill in' }));
    expect(screen.getByLabelText('Email')).toHaveValue('adi@test.com');
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Projects' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Acting as Adi, Admin/ })).toBeInTheDocument();
  });

  it('shows and hides the password', async () => {
    signedOut();
    const field = await screen.findByLabelText('Password');
    expect(field).toHaveAttribute('type', 'password');
    fireEvent.click(screen.getByRole('button', { name: 'Show password' }));
    expect(field).toHaveAttribute('type', 'text');
    expect(screen.getByRole('button', { name: 'Hide password' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('signs out from the sidebar and returns to the sign-in page', async () => {
    renderApp(<App />, { path: '/dashboard' });
    fireEvent.click(await screen.findByRole('button', { name: 'Sign out Adi' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Welcome back' })).toBeInTheDocument();
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
