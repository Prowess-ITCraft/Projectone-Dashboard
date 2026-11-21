import { describe, expect, it } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { makeApi, renderApp } from '@/test/providers.jsx';
import ImplementationServices from './ImplementationServices.jsx';
import Dashboard from './Dashboard.jsx';
import Detail from './Detail.jsx';
import Questionnaire from './Questionnaire.jsx';

const Routing = () => (
  <Routes>
    <Route path="/dashboard" element={<Dashboard />} />
    <Route path="/services" element={<ImplementationServices />} />
    <Route path="/services/:id/:mode?" element={<Detail />} />
    <Route path="/q/:kind" element={<Questionnaire kind="firewall" />} />
  </Routes>
);

describe('component pages on the data layer', () => {
  it('shows the overview from stored progress', async () => {
    const api = makeApi();
    renderApp(<Routing />, { path: '/dashboard', api });
    expect(await screen.findByRole('heading', { level: 1, name: 'Overview' })).toBeInTheDocument();
    expect(screen.getByText(/No task has been ticked yet/)).toBeInTheDocument();
  });

  it('lists the implementation services and filters them', async () => {
    renderApp(<Routing />, { path: '/services' });
    expect(await screen.findByRole('heading', { level: 1, name: 'Implementation services' })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Search implementation services'), { target: { value: 'zzzz' } });
    expect(await screen.findByText(/No services match/)).toBeInTheDocument();
  });

  it('opens AD/DC with its name and description and nothing else yet', async () => {
    renderApp(<Routing />, { path: '/services/ad-dc' });
    expect(await screen.findByRole('heading', { level: 1, name: 'AD/DC' })).toBeInTheDocument();
    expect(screen.queryByText('Work type')).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Export CSV/ })).not.toBeInTheDocument();
  });
});
