import { describe, expect, it } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { makeApi, renderApp } from '@/test/providers.jsx';
import Components from './Components.jsx';
import Dashboard from './Dashboard.jsx';
import Detail from './Detail.jsx';
import Questionnaire from './Questionnaire.jsx';

const Routing = () => (
  <Routes>
    <Route path="/dashboard" element={<Dashboard />} />
    <Route path="/components" element={<Components />} />
    <Route path="/c/:id/:mode?" element={<Detail />} />
    <Route path="/q/:kind" element={<Questionnaire kind="firewall" />} />
  </Routes>
);

describe('component pages on the data layer', () => {
  it('shows the overview from stored progress', async () => {
    const api = makeApi();
    renderApp(<Routing />, { path: '/dashboard', api });
    expect(await screen.findByRole('heading', { level: 1, name: 'Overview' })).toBeInTheDocument();
    expect(screen.getByText(/No task has been ticked yet/)).toBeInTheDocument();
    await api.setTaskProgress('firewall|new|0', { s: 2 }, 'Firewall: step');
    expect(await screen.findByText(/1 of \d+ tasks completed/)).toBeInTheDocument();
  });

  it('lists the components and filters them', async () => {
    renderApp(<Routing />, { path: '/components' });
    expect(await screen.findByRole('heading', { level: 1, name: 'Components' })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Search components'), { target: { value: 'zzzz' } });
    expect(await screen.findByText(/No components match/)).toBeInTheDocument();
  });

  it('ticks a task, stores it, and keeps it after the page is drawn again', async () => {
    const api = makeApi();
    const view = renderApp(<Routing />, { path: '/c/nas/new', api });
    const first = await screen.findByRole('checkbox', { name: /Completed: QNAP Setup Installation/ });
    fireEvent.click(first);
    expect(first).toBeChecked();
    await waitFor(async () => expect((await api.getChecklistState()).tasks['nas|new|0']?.s).toBe(2));
    view.unmount();
    renderApp(<Routing />, { path: '/c/nas/new', api });
    expect(await screen.findByRole('checkbox', { name: /Completed: QNAP Setup Installation/ })).toBeChecked();
  });
});
