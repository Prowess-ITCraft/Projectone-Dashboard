# 0014. Real sign-in, roles in the screens and the HTTP data layer

Date: 2026-11-17
Status: Accepted. Supersedes 0011 (demo sign-in) and the storage part of 0007.

## Context

Accounts, sessions, assignments and alerts now live in the API (backend ADR 0005). Projects move from IndexedDB to PostgreSQL. The screens must keep their look and keep reading through `ProjectOneApi`.

## Decision

- **Data layer.** `createHttpApi` (`src/data/http`) runs the existing data layer on a remote storage instead of IndexedDB. Each write runs in `storage.transaction`: its writes are held in an overlay the action itself reads, then sent as one `/store/batch`, so a failed action saves nothing. Counters come from the server. Reads are cached for 1.5 s and cleared on any write. Accounts, assignments, alerts and checklist steps are direct calls on the same object.
- **Same address.** The app calls the API at `/api`; the Vite dev server and preview forward it (`API_PROXY_TARGET`, default `http://localhost:9666`), and a host needs the same rewrite. This keeps the session cookie first-party and out of reach of scripts.
- **Session.** `SessionProvider` asks `/me` on start. A 401 or `password_change_required` from any call returns the person to the sign-in page (with the reason) or to the new-password page. `useActor()` is now the signed-in user; the "acting as" picker is removed.
- **Sign-in page.** Same design. The demo box is a build-time switch: shown only in development and only when `VITE_DEMO_EMAIL` and `VITE_DEMO_PASSWORD` are set in a local env file; a production build contains neither the box nor the settings.
- **Roles in the screens.** Navigation areas carry `need` or `hideWith` permissions. An Admin starts on the dashboard, an engineer on My work and sees only My work and their projects; Admin pages redirect them home. The server enforces the same rules; the screens only decide what to offer.
- **New screens.** My work, Users (Admin), an Engineers row with an "Assign engineer" multi-select on the project list and page, the alerts bell (polled every 45 s as background requests), and a read-only Checklist tab per project with the Installation and Configuration groups, the checklist columns, 0 of 0 and the empty-state text until steps are defined.
- **Tests.** Component tests use the local adapter plus an in-memory stand-in for the server calls (`src/test/fakeServer.js`). `src/data/http/e2e.test.js` drives the real data layer against a running API and is skipped unless `E2E_API` is set.
- **Build.** Libraries are split into a `vendor` file so the app file stays under the size warning.

## Consequences

- IndexedDB storage (`createBrowserStorage`) stays for tests and is no longer used by the app; data people kept in their browser is not moved to the server.
- The intake rules still run in the browser until the backend ports them (backend ADR 0005).
