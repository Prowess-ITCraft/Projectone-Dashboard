# Memory

Short facts a new contributor needs before changing the backend. Rules are in `RULES.md`; decisions with reasons in `adr/`.

- The frontend talks to data only through its `ProjectOneApi` interface (`frontend/src/data/api.jsx`), served today by a local IndexedDB adapter. The backend replaces that adapter stage by stage, one stage behind the frontend interface. Backend stages B0 to B10 map to frontend stages 0 to 12.
- Ports: API 9666, frontend 9555, PostgreSQL published on 9667 by Docker Compose.
- Environments: `development`, `staging`, `production`. Development alone has the dev tools, `/docs` and the `X-Dev-User` header.
- Roles are Admin and Engineer, stored as rows; the matrix mirrors the frontend and is unconfirmed by the owner (`frontend/docs/OPEN_QUESTIONS.md`). Only an Admin manages users.
- The audit log is append-only by database trigger. The development reset keeps it and records itself in it.
- Tests run on a real PostgreSQL: `TEST_DATABASE_URL` in CI, an embedded server (pgserver) locally. Migrations run once into a template; each test gets its own copy.
- No object store yet. It arrives at B3, when original documents are first stored.

## Current state (after B0 and B1)

- Endpoints: health, readiness, version, `/me`, `/roles`, dev seed and reset, the OpenAPI document.
- Tables: roles, role_actions, users, audit_log, settings, counters.
- 52 tests: errors and logs, permissions, audit atomicity and immutability, counters under concurrency, financial year, dev tools per environment, the no-financial-name contract, migrations up and down and their match with the models.
