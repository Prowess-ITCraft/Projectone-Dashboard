import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ActorProvider } from '@/app/actor.jsx';
import { SessionProvider } from '@/app/session.jsx';
import { ApiProvider } from '@/data/api.jsx';
import { createFixtures } from '@/data/fixtures';
import { createLocalApi } from '@/data/local/localApi.js';
import { createMemoryStorage } from '@/data/local/storage.js';
import { withServer } from './fakeServer.js';

export const ADMIN = { id: 'u-admin', role: 'admin', name: 'Asha' };
export const ENGINEER = { id: 'u-eng', role: 'engineer', name: 'Ravi' };

/*
  A local api on memory storage with only the anonymised fixtures, so tests never depend on private files, plus an
  in-memory stand-in for the server's account, assignment, alert and checklist calls (`server` options).
*/
export const makeApi = (server = {}) =>
  withServer(createLocalApi({ storage: createMemoryStorage(), fixtures: createFixtures({ allowPrivate: false }) }), server);

/* Signed in as an Admin, so screens render without the sign-in page; pass `session: null` to start signed out */
export const SIGNED_IN = { id: 'u-admin', email: 'itcraft@test.com', name: 'ITCraft', role: 'admin', mustChangePassword: false };

/* Renders a tree inside the same providers the app uses, at a route, acting as a role */
export function renderApp(ui, { path = '/', api = makeApi(), ...options } = {}) {
  // passing an option as undefined means: as the app does it (the session is asked of the api, the actor follows it)
  const actor = 'actor' in options ? (options.actor ?? undefined) : ADMIN;
  const session = 'session' in options ? options.session : SIGNED_IN;
  const view = render(
    <MemoryRouter initialEntries={[path]}>
      <ApiProvider api={api}>
        <SessionProvider initial={session}>
          <ActorProvider initial={actor}>{ui}</ActorProvider>
        </SessionProvider>
      </ApiProvider>
    </MemoryRouter>,
  );
  return { api, ...view };
}
