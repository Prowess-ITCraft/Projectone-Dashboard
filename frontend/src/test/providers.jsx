import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ActorProvider } from '@/app/actor.jsx';
import { ApiProvider } from '@/data/api.jsx';
import { createFixtures } from '@/data/fixtures';
import { createLocalApi } from '@/data/local/localApi.js';
import { createMemoryStorage } from '@/data/local/storage.js';

export const ADMIN = { role: 'admin', name: 'Asha' };
export const ENGINEER = { role: 'engineer', name: 'Ravi' };

/* A local api on memory storage with only the anonymised fixtures, so tests never depend on private files */
export const makeApi = () => createLocalApi({ storage: createMemoryStorage(), fixtures: createFixtures({ allowPrivate: false }) });

/* Renders a tree inside the same providers the app uses, at a route, acting as a role */
export function renderApp(ui, { path = '/', api = makeApi(), actor = ADMIN } = {}) {
  const view = render(
    <MemoryRouter initialEntries={[path]}>
      <ApiProvider api={api}>
        <ActorProvider initial={actor}>{ui}</ActorProvider>
      </ApiProvider>
    </MemoryRouter>,
  );
  return { api, ...view };
}
