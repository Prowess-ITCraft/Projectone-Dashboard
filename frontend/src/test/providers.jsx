import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ActorProvider } from '@/app/actor.jsx';
import { ApiProvider } from '@/data/api.jsx';
import { createFixtures } from '@/data/fixtures';
import { createLocalApi } from '@/data/local/localApi.js';
import { createMemoryStorage } from '@/data/local/storage.js';
import { StoreProvider } from '@/store.jsx';

export const LEAD = { role: 'project_lead', name: 'Asha' };
export const INTAKE = { role: 'intake_coordinator', name: 'Ravi' };

/* A local api on memory storage with only the anonymised fixtures, so tests never depend on private files */
export const makeApi = () => createLocalApi({ storage: createMemoryStorage(), fixtures: createFixtures({ allowPrivate: false }) });

/* Renders a tree inside the same providers the app uses, at a route, acting as a role */
export function renderApp(ui, { path = '/', api = makeApi(), actor = LEAD } = {}) {
  const view = render(
    <MemoryRouter initialEntries={[path]}>
      <ApiProvider api={api}>
        <ActorProvider initial={actor}>
          <StoreProvider>{ui}</StoreProvider>
        </ActorProvider>
      </ApiProvider>
    </MemoryRouter>,
  );
  return { api, ...view };
}
