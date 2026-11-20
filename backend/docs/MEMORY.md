# Memory

Short facts a new contributor needs before changing the backend. Rules are in `RULES.md`; decisions with reasons in `adr/`.

- The frontend talks to data only through its `ProjectOneApi` interface (`frontend/src/data/api.jsx`), served today by a local IndexedDB adapter. The backend replaces that adapter stage by stage, one stage behind the frontend interface. Backend stages B0 to B10 map to frontend stages 0 to 12.
- Ports: API 9666, frontend 9555, PostgreSQL published on 9667 by Docker Compose.
- Environments: `development`, `staging`, `production`. Development alone has the dev tools, `/docs` and the `X-Dev-User` header.
- Roles are Admin and Engineer, stored as rows; the matrix mirrors the frontend. Owner decisions, 17 and 20 Nov 2026: an engineer sees only assigned projects and changes checklist progress and nothing else (complete a step, upload evidence, comment); order lines are read only to them. Only an Admin manages users, assignments, documents, lines and the checklist's structure (ADR 0006).
- Sign-in is an httpOnly session cookie (ADR 0005). Changes made with it need the `X-Requested-With: ProjectOne` header. The `X-Dev-User` header still works in development only (a bare name means name@dev.local).
- First accounts come from `scripts/seed_accounts.py` (ADMIN_EMAIL, ADMIN_PASSWORD); every engineer starts on one shared default password (`DEFAULT_ENGINEER_PASSWORD`, environment only; only the hash is stored, flagged `password_is_default` until they change it). The seed never resets an existing password. Admin copies login details only while that flag holds; the default is refused as a new password.
- The audit log is append-only by database trigger. The development reset keeps it and records itself in it.
- Tests run on a real PostgreSQL: `TEST_DATABASE_URL` in CI, an embedded server (pgserver) locally. Migrations run once into a template; each test gets its own copy.
- No object store yet: uploaded files are kept in `stored_files` in PostgreSQL until it arrives.

## Current state (after B0, B1 and accounts)

- Endpoints: health, version, sign-in, `/me`, `/roles`, users, assignments, notifications, the project checklist (`/projects/{id}/checklist`), the engineer's view (`/my/projects`, `/projects/{id}/work`), the record store (`/store`, Admin only), dev seed, reset and sample steps, the OpenAPI document.
- Tables: roles, role_actions, users, sessions, login_attempts, audit_log, settings, counters, customers, sites, projects, project_records, stored_files, app_records, project_assignments, notifications, checklist_steps, checklist_evidence, checklist_comments.
- The frontend's data layer saves through `/store`; its intake rules still run in the browser (ADR 0005 consequences).
- 70 tests, including sign-in, sessions, rate limiting, assignment visibility (404 for unassigned projects), notifications, deactivation and the seed script.
