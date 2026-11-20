import { describe, expect, it } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import App from '@/app/App.jsx';
import { ADMIN, ENGINEER, makeApi, renderApp } from '@/test/providers.jsx';

const ENGINEERS = [
  { id: 'e1', name: 'Engineer 01', email: 'engineer01@test.com', role: 'engineer' },
  { id: 'e2', name: 'Engineer 02', email: 'engineer02@test.com', role: 'engineer' },
  { id: 'e3', name: 'Engineer 03', email: 'engineer03@test.com', role: 'engineer', active: false },
];
const ADMIN_ACCOUNT = { id: ADMIN.id, name: ADMIN.name, email: 'admin@test.com', role: 'admin' };
const engineerSession = { id: ENGINEER.id, email: 'eng@test.com', name: ENGINEER.name, role: 'engineer', mustChangePassword: false };

async function withProjects(api, names) {
  const made = [];
  for (const name of names) made.push(await api.createProject({ customer: { name }, entryPath: 'new_infra', actor: ADMIN }));
  return made;
}

describe('assigning engineers', () => {
  it('opens a modal from the project row, searches, and saves assignments and removals in one action', async () => {
    const api = makeApi({ users: [ADMIN_ACCOUNT, ...ENGINEERS] });
    const [project] = await withProjects(api, ['Alpha Ltd']);
    api.assign(project.id, 'e1');
    renderApp(<App />, { path: '/projects', api });
    const row = (await screen.findByRole('link', { name: project.number })).closest('tr');
    const opener = within(row).getByRole('button', { name: `Assign engineer to ${project.number}` });
    expect(within(row).queryByRole('checkbox')).not.toBeInTheDocument();

    opener.focus(); // a real click focuses the button; the dialog gives focus back to it on close
    fireEvent.click(opener);
    const dialog = screen.getByRole('dialog', { name: `Assign engineers to ${project.number}, Alpha Ltd` });
    expect(row).not.toContainElement(dialog);
    expect(dialog).toContainElement(screen.getByLabelText('Search engineers'));
    const boxes = within(dialog).getAllByRole('checkbox');
    expect(boxes.map((b) => b.closest('label').textContent)).toEqual([
      expect.stringContaining('Engineer 01'),
      expect.stringContaining('Engineer 02'),
    ]);
    expect(within(dialog).getByRole('checkbox', { name: /Engineer 01/ })).toBeChecked();
    expect(within(dialog).getByRole('checkbox', { name: /Engineer 02/ })).not.toBeChecked();
    const save = within(dialog).getByRole('button', { name: 'Save' });
    expect(save).toBeDisabled();

    fireEvent.change(within(dialog).getByLabelText('Search engineers'), { target: { value: 'engineer02@' } });
    expect(within(dialog).getAllByRole('checkbox')).toHaveLength(1);
    fireEvent.change(within(dialog).getByLabelText('Search engineers'), { target: { value: 'nobody' } });
    expect(within(dialog).getByText('No engineer matches that search.')).toBeInTheDocument();
    fireEvent.change(within(dialog).getByLabelText('Search engineers'), { target: { value: '' } });

    // one save adds Engineer 02 and removes Engineer 01
    fireEvent.click(within(dialog).getByRole('checkbox', { name: /Engineer 02/ }));
    fireEvent.click(within(dialog).getByRole('checkbox', { name: /Engineer 01/ }));
    expect(save).toBeEnabled();
    fireEvent.click(save);

    await waitFor(() => expect(api.server.calls).toContainEqual(['setProjectEngineers', project.id, ['e2']]));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(opener).toHaveFocus();
    const chips = await within(row).findByRole('list', { name: `Engineers on ${project.number}` });
    expect(
      within(chips)
        .getAllByRole('listitem')
        .map((li) => li.textContent),
    ).toEqual(['Engineer 02']);
    expect(await screen.findByText(/Engineers updated on .* \(1 added, 1 removed\)/)).toBeInTheDocument();
  });

  it('closes the modal with Escape, the backdrop or Cancel without changing anything', async () => {
    const api = makeApi({ users: [ADMIN_ACCOUNT, ...ENGINEERS] });
    const [project] = await withProjects(api, ['Alpha Ltd']);
    renderApp(<App />, { path: `/projects/${project.id}`, api });
    const opener = await screen.findByRole('button', { name: `Assign engineer to ${project.number}` });
    for (const close of [
      () => fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' }),
      () => fireEvent.click(screen.getByRole('dialog').previousElementSibling),
      () => fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel' })),
    ]) {
      opener.focus();
      fireEvent.click(opener);
      fireEvent.click(within(screen.getByRole('dialog')).getByRole('checkbox', { name: /Engineer 01/ }));
      close();
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      expect(opener).toHaveFocus();
    }
    expect(api.server.calls.some((c) => c[0] === 'setProjectEngineers')).toBe(false);
  });

  it('removes one engineer from the project page', async () => {
    const api = makeApi({ users: [ADMIN_ACCOUNT, ...ENGINEERS] });
    const [project] = await withProjects(api, ['Alpha Ltd']);
    api.assign(project.id, 'e1');
    api.assign(project.id, 'e2');
    renderApp(<App />, { path: `/projects/${project.id}`, api });
    fireEvent.click(await screen.findByRole('button', { name: `Remove Engineer 01 from ${project.number}` }));
    await waitFor(() => expect(api.server.calls).toContainEqual(['removeProjectEngineer', project.id, 'e1']));
    const chips = await screen.findByRole('list', { name: `Engineers on ${project.number}` });
    await waitFor(() =>
      expect(
        within(chips)
          .getAllByRole('listitem')
          .map((li) => li.textContent),
      ).toEqual(['Engineer 02']),
    );
  });

  it('shows an engineer the names on a project but no assign or remove controls', async () => {
    const api = makeApi({ users: [ADMIN_ACCOUNT, ...ENGINEERS] });
    const [project] = await withProjects(api, ['Alpha Ltd']);
    api.assign(project.id, ENGINEER.id);
    renderApp(<App />, { path: `/projects/${project.id}`, api, actor: ENGINEER, session: engineerSession });
    await screen.findByRole('heading', { level: 1, name: 'Alpha Ltd' });
    expect(screen.queryByRole('button', { name: /Assign engineer/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Remove / })).not.toBeInTheDocument();
  });
});

describe('My work', () => {
  it('lists only the projects assigned to the engineer as whole-row links, newest first', async () => {
    const api = makeApi({ users: [ADMIN_ACCOUNT, { id: ENGINEER.id, name: ENGINEER.name, email: 'eng@test.com', role: 'engineer' }] });
    api.server.me = api.server.users[1];
    const [older, , newer] = await withProjects(api, ['Alpha Ltd', 'Beta Ltd', 'Gamma Ltd']);
    api.assign(older.id, ENGINEER.id, Date.UTC(2026, 10, 10));
    api.assign(newer.id, ENGINEER.id, Date.UTC(2026, 10, 15));
    api.addStep(newer.id, { state: 'complete' });
    api.addStep(newer.id, {});
    renderApp(<App />, { path: '/my-work', api, actor: ENGINEER, session: engineerSession });
    const list = await screen.findByRole('list', { name: 'My projects' });
    const rows = within(list).getAllByRole('link');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent('Gamma Ltd');
    expect(rows[0]).toHaveTextContent('1 of 2 steps complete');
    expect(rows[0]).toHaveTextContent(/15 Nov/);
    expect(rows[1]).toHaveTextContent('Alpha Ltd');
    expect(rows[1]).toHaveTextContent('No checklist steps yet');
    expect(screen.queryByText('Beta Ltd')).not.toBeInTheDocument();
    expect(within(list).queryByText(/Order received/)).not.toBeInTheDocument(); // no stage data
  });

  it('opens a project from anywhere on its row, which is one focusable link with nothing clickable inside', async () => {
    const api = makeApi({ users: [ADMIN_ACCOUNT, { id: ENGINEER.id, name: ENGINEER.name, email: 'eng@test.com', role: 'engineer' }] });
    api.server.me = api.server.users[1];
    const [project] = await withProjects(api, ['Alpha Ltd']);
    api.assign(project.id, ENGINEER.id);
    renderApp(<App />, { path: '/my-work', api, actor: ENGINEER, session: engineerSession });
    const list = await screen.findByRole('list', { name: 'My projects' });
    const row = within(list).getByRole('link');
    expect(row).toHaveAttribute('href', `/projects/${project.id}`);
    expect(row.tagName).toBe('A');
    expect(row.querySelector('a, button, input, select, textarea, [tabindex]')).toBeNull();
    row.focus(); // Tab reaches it; Enter on a focused link opens it, as the browser does for every link
    expect(row).toHaveFocus();
    fireEvent.click(within(row).getByText('Alpha Ltd')); // a click on any part of the row
    expect(await screen.findByRole('heading', { level: 1, name: 'Alpha Ltd' })).toBeInTheDocument();
    // it opens on the Checklist tab
    await waitFor(() => expect(screen.getByRole('link', { name: 'Checklist' })).toHaveAttribute('aria-current', 'page'));
  });

  it('shows unread alerts on top after signing in', async () => {
    const api = makeApi({
      notifications: [{ id: 'n1', type: 'project_assigned', message: 'New project assigned: PRJ-2627-0001, Alpha Ltd', projectId: 'p1' }],
    });
    renderApp(<App />, { path: '/my-work', api, actor: ENGINEER, session: engineerSession });
    expect(await screen.findByText('You have 1 new alert')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'New project assigned: PRJ-2627-0001, Alpha Ltd' })).toHaveAttribute('href', '/projects/p1');
    expect(screen.getByText(/No projects are assigned to you yet/)).toBeInTheDocument();
  });
});

describe('Users page', () => {
  const open = () => {
    const api = makeApi({ users: [ADMIN_ACCOUNT, ...ENGINEERS] });
    renderApp(<App />, { path: '/users', api });
    return api;
  };

  it('lists the accounts and adds an engineer who starts on the default password, without showing it', async () => {
    const api = open();
    const table = await screen.findByRole('table', { name: 'Accounts' });
    expect(within(table).getByRole('cell', { name: 'Engineer 03' }).closest('tr')).toHaveTextContent('Deactivated');

    fireEvent.click(screen.getByRole('button', { name: 'Add engineer' }));
    expect(screen.getByText("Enter the engineer's full name.")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Full name'), { target: { value: 'New Person' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'new@test.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add engineer' }));
    expect(await screen.findByText('Account created for New Person')).toBeInTheDocument();
    expect(screen.queryByText('Starter-Password-1')).not.toBeInTheDocument();
    expect(await within(table).findByText('new@test.com')).toBeInTheDocument();
    expect(api.server.users.at(-1)).toMatchObject({ role: 'engineer', mustChangePassword: true, passwordIsDefault: true });
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(screen.queryByText('Account created for New Person')).not.toBeInTheDocument();
  });

  it('copies login details only while an engineer still has the default password', async () => {
    const written = [];
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (t) => written.push(t) } });
    const api = makeApi({
      users: [
        ADMIN_ACCOUNT,
        { ...ENGINEERS[0], mustChangePassword: true, passwordIsDefault: true },
        { ...ENGINEERS[1], mustChangePassword: false, passwordIsDefault: false },
      ],
    });
    renderApp(<App />, { path: '/users', api });
    expect(await screen.findByRole('button', { name: 'Copy login details for Engineer 01' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Copy login details for Engineer 02' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Copy login details for (Asha|Head)/ })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Copy login details for Engineer 01' }));
    expect(await screen.findByText('Login details for Engineer 01 are copied. Send them privately.')).toBeInTheDocument();
    expect(written).toEqual(['ProjectOne login\nEmail: engineer01@test.com\nPassword: Starter-Password-1']);
    expect(screen.queryByText(/Starter-Password-1/)).not.toBeInTheDocument();

    // resetting Engineer 02 to the default makes their details copyable again
    fireEvent.click(screen.getByRole('button', { name: 'Reset Engineer 02 to the default password' }));
    expect(await screen.findByText('Reset to the default password for Engineer 02')).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Copy login details for Engineer 02' })).toBeInTheDocument();
  });

  it('resets to the default password and deactivates an account after confirming, but never the Admin themself', async () => {
    const api = open();
    fireEvent.click(await screen.findByRole('button', { name: 'Reset Engineer 01 to the default password' }));
    expect(await screen.findByText('Reset to the default password for Engineer 01')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Deactivate Engineer 01' }));
    const dialog = screen.getByRole('alertdialog', { name: 'Deactivate Engineer 01?' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Deactivate' }));
    await waitFor(() => expect(api.server.users.find((u) => u.id === 'e1').active).toBe(false));

    const self = screen.getByRole('cell', { name: ADMIN.name }).closest('tr');
    expect(within(self).queryByRole('button')).not.toBeInTheDocument();
  });
});
