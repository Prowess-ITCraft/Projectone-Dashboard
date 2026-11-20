import { describe, expect, it } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import App from '@/app/App.jsx';
import { ADMIN, ENGINEER, makeApi, renderApp } from '@/test/providers.jsx';

const SESSION = { id: ENGINEER.id, email: 'eng@test.com', name: ENGINEER.name, role: 'engineer', mustChangePassword: false };
const ACCOUNT = { id: ENGINEER.id, name: ENGINEER.name, email: 'eng@test.com', role: 'engineer' };

async function setup(
  steps = [{ title: 'Rack the server' }, { title: 'Cable the server' }, { title: 'Install the OS', phase: 'configuration' }],
) {
  const api = makeApi({ users: [ACCOUNT] });
  api.server.me = ACCOUNT;
  const project = await api.createProject({ customer: { name: 'Site Co' }, entryPath: 'new_infra', actor: ADMIN });
  api.assign(project.id, ENGINEER.id);
  steps.forEach((s) => api.addStep(project.id, s));
  api.server.lines[project.id] = [
    { id: 'l1', number: 1, description: 'Firewall appliance', quantity: 2, kind: 'product', module: 'network_firewall', pairing: null },
    { id: 'l2', number: 2, description: 'Setup service', quantity: 1, kind: 'service', module: null, pairing: 'Line 1' },
  ];
  return { api, project };
}

const open = async (path, ctx) => {
  renderApp(<App />, { path, api: ctx.api, actor: ENGINEER, session: SESSION });
  await screen.findByRole('heading', { level: 1, name: 'Site Co' });
};
const rowOf = async (title) => (await screen.findByText(title)).closest('tr');
const png = (name = 'rack.png') => new File([new Uint8Array([137, 80, 78, 71])], name, { type: 'image/png' });

describe('the engineer project page', () => {
  it('shows the header and only the Order lines and Checklist tabs, opening on the Checklist', async () => {
    const ctx = await setup();
    await open(`/projects/${ctx.project.id}`, ctx);
    expect(screen.getByText(ctx.project.number)).toBeInTheDocument();
    const tabs = within(screen.getByRole('navigation', { name: 'Project sections' })).getAllByRole('link');
    expect(tabs.map((t) => t.textContent.replace(/\d+$/, ''))).toEqual(['Order lines', 'Checklist']);
    expect(await screen.findByRole('heading', { name: 'Installation steps' })).toBeInTheDocument();
    for (const name of ['Overview', 'Documents', 'Coverage', 'Modules']) {
      expect(screen.queryByRole('link', { name })).not.toBeInTheDocument();
    }
    expect(screen.queryByText(/Recent activity|Stages|Sites/)).not.toBeInTheDocument();
    expect(screen.queryByText('Engineers')).not.toBeInTheDocument();
  });

  it('sends the removed tabs back to the Checklist', async () => {
    const ctx = await setup();
    for (const tab of ['documents', 'coverage', 'modules']) {
      const view = renderApp(<App />, { path: `/projects/${ctx.project.id}/${tab}`, api: ctx.api, actor: ENGINEER, session: SESSION });
      expect(await screen.findByRole('heading', { name: 'Installation steps' })).toBeInTheDocument();
      view.unmount();
    }
  });

  it('shows the order lines as a read only table with no controls and no money', async () => {
    const ctx = await setup();
    await open(`/projects/${ctx.project.id}/lines`, ctx);
    const table = await screen.findByRole('table', { name: 'Order lines' });
    expect(
      within(table)
        .getAllByRole('columnheader')
        .map((c) => c.textContent),
    ).toEqual(['Line', 'Description', 'Quantity', 'Kind', 'Module', 'Pairing']);
    expect(within(table).getByText('Firewall appliance')).toBeInTheDocument();
    expect(within(table).getByText('Line 1')).toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Add a line|Run the rules again|Confirm|Remove/ })).not.toBeInTheDocument();
    expect(screen.queryByText('Next step')).not.toBeInTheDocument();
    expect(screen.queryByText(/rate|price|total/i)).not.toBeInTheDocument();
  });
});

describe('the engineer checklist', () => {
  it('locks a step until the one before it is complete, with the reason, and counts complete steps only', async () => {
    const ctx = await setup();
    await open(`/projects/${ctx.project.id}/checklist`, ctx);
    const second = await rowOf('Cable the server');
    expect(second).toHaveClass('locked');
    expect(within(second).getByText('Complete step 1 first')).toBeInTheDocument();
    expect(within(second).queryByRole('checkbox')).not.toBeInTheDocument();
    expect(within(second).getByRole('img', { name: 'Locked: Cable the server' })).toBeInTheDocument();
    expect(screen.getAllByText('0 of 2 completed').length).toBeGreaterThan(0);
  });

  it('moves a ticked step to Awaiting evidence, and completes it only after a file is added and the step is finished', async () => {
    const ctx = await setup();
    await open(`/projects/${ctx.project.id}/checklist`, ctx);
    const first = await rowOf('Rack the server');
    expect(first).not.toHaveClass('step-complete');
    expect(within(first).getByText('Pending')).toHaveClass('tone-neutral');
    fireEvent.click(within(first).getByRole('checkbox', { name: 'Completed: Rack the server' }));
    await waitFor(async () => expect(await rowOf('Rack the server')).toHaveClass('step-awaiting-evidence'));
    expect(within(await rowOf('Rack the server')).getByText('Awaiting evidence')).toHaveClass('tone-warning');
    expect(screen.getByRole('button', { name: 'Finish step' })).toBeDisabled();
    expect(await rowOf('Cable the server')).toHaveClass('locked');

    fireEvent.change(screen.getByTestId('evidence-device'), { target: { files: [png()] } });
    expect(await screen.findByRole('button', { name: 'Open rack.png' })).toBeInTheDocument();
    expect(await rowOf('Cable the server')).toHaveClass('locked'); // still locked: the step is not complete yet
    fireEvent.click(screen.getByRole('button', { name: 'Finish step' }));

    await waitFor(async () => expect(await rowOf('Rack the server')).toHaveClass('step-complete'));
    const done = await rowOf('Rack the server');
    expect(within(done).getByText('Complete')).toHaveClass('tone-positive');
    expect(within(done).getByRole('img', { name: 'Completed: Rack the server' })).toBeInTheDocument();
    expect(await rowOf('Cable the server')).not.toHaveClass('locked');
    expect(screen.getAllByText('1 of 2 completed').length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: 'Finish step' })).not.toBeInTheDocument();
  });

  it('offers the camera and the device, rejects the wrong type or size, and allows removing a file while awaiting', async () => {
    const ctx = await setup();
    await open(`/projects/${ctx.project.id}/checklist`, ctx);
    fireEvent.click(within(await rowOf('Rack the server')).getByRole('checkbox'));
    expect(await screen.findByRole('button', { name: 'Take photo' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Upload from device' })).toBeInTheDocument();
    const camera = screen.getByTestId('evidence-camera');
    expect(camera).toHaveAttribute('capture', 'environment');
    expect(camera).toHaveAttribute('accept', 'image/*');
    const device = screen.getByTestId('evidence-device');
    expect(device.getAttribute('accept')).toMatch(/\.heic/);
    expect(device.getAttribute('accept')).toMatch(/\.pdf/);

    fireEvent.change(device, { target: { files: [new File(['x'], 'notes.txt', { type: 'text/plain' })] } });
    expect(await screen.findByText(/only JPG, PNG, HEIC or PDF files can be added/)).toBeInTheDocument();
    const big = new File(['x'], 'big.png', { type: 'image/png' });
    Object.defineProperty(big, 'size', { value: 11 * 1024 * 1024 });
    fireEvent.change(device, { target: { files: [big] } });
    expect(await screen.findByText(/larger than 10 MB/)).toBeInTheDocument();
    expect(ctx.api.server.calls.some((c) => c[0] === 'addEvidence')).toBe(false);

    fireEvent.change(camera, { target: { files: [png('photo.png')] } });
    fireEvent.click(await screen.findByRole('button', { name: 'Remove photo.png' }));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Open photo.png' })).not.toBeInTheDocument());
  });

  it('returns an unticked awaiting step to Pending', async () => {
    const ctx = await setup();
    await open(`/projects/${ctx.project.id}/checklist`, ctx);
    fireEvent.click(within(await rowOf('Rack the server')).getByRole('checkbox'));
    await waitFor(async () => expect(await rowOf('Rack the server')).toHaveClass('step-awaiting-evidence'));
    fireEvent.click(within(await rowOf('Rack the server')).getByRole('checkbox'));
    await waitFor(async () => expect(await rowOf('Rack the server')).not.toHaveClass('step-awaiting-evidence'));
    expect(within(await rowOf('Rack the server')).getByText('Pending')).toBeInTheDocument();
  });

  it('locks evidence on a complete step, allows comments on it, and offers nothing else to edit', async () => {
    const ctx = await setup([
      {
        title: 'Rack the server',
        state: 'complete',
        progress: 100,
        evidence: [
          { id: 'ev1', name: 'done.png', mediaType: 'image/png', size: 4, uploadedByName: 'Ravi', uploadedAt: 0, canRemove: false },
        ],
      },
      { title: 'Cable the server' },
    ]);
    await open(`/projects/${ctx.project.id}/checklist`, ctx);
    const done = await rowOf('Rack the server');
    fireEvent.click(within(done).getByRole('button', { name: /evidence and comments for Rack the server/ }));
    expect(await screen.findByRole('button', { name: 'Open done.png' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Remove done.png|Take photo|Upload from device|Finish step/ })).not.toBeInTheDocument();
    expect(screen.getByText('Evidence is locked once a step is complete.')).toBeInTheDocument();
    expect(within(done).queryByRole('checkbox')).not.toBeInTheDocument(); // cannot be un-completed

    fireEvent.change(screen.getByLabelText('Add a comment on Rack the server'), { target: { value: 'Checked after the visit' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add comment' }));
    expect(await screen.findByText('Checked after the visit')).toBeInTheDocument();
    expect(ctx.api.server.calls).toContainEqual(['addStepComment', ctx.project.id, expect.any(String), 'Checked after the visit']);
    expect(screen.queryByRole('button', { name: /Delete|Edit/ })).not.toBeInTheDocument();
    // task text, dates and progress are plain text: the only inputs are the completion boxes, upload and the comment box
    const inputs = [...document.querySelectorAll('.check input, .check textarea, .check select')].map((e) => e.type ?? e.tagName);
    expect(inputs.every((t) => ['checkbox', 'file', 'textarea'].includes(t))).toBe(true);
    for (const name of ['Export CSV', 'Add a step', 'Edit', 'Reset', 'Delete']) {
      expect(screen.queryByRole('button', { name: new RegExp(name) })).not.toBeInTheDocument();
    }
    expect(screen.queryByText(/New Installation|Existing Reconfiguration/)).not.toBeInTheDocument();
  });

  it('shows an Admin the evidence and comments read only', async () => {
    const ctx = await setup([
      {
        title: 'Rack the server',
        state: 'awaiting_evidence',
        evidence: [{ id: 'ev1', name: 'a.png', mediaType: 'image/png', size: 4, uploadedByName: 'Ravi', uploadedAt: 0, canRemove: false }],
        comments: [{ id: 'c1', body: 'Rack is full', authorName: 'Ravi', createdAt: 0 }],
      },
    ]);
    renderApp(<App />, { path: `/projects/${ctx.project.id}/checklist`, api: ctx.api });
    expect(await screen.findByText('Rack is full')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open a.png' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Take photo|Finish step|Add comment|Remove a.png/ })).not.toBeInTheDocument();
    expect(within(await rowOf('Rack the server')).getByRole('checkbox')).toBeDisabled();
  });
});
