# Tasks

## Done

- [x] B0 foundations: layout, settings, health and version, error shape, request id and log line, Alembic baseline, ruff, mypy strict, pytest on real PostgreSQL, Dockerfile, Compose services (api, postgres), CI job, the no-financial-name contract test (ADR 0001 to 0004)
- [x] B1 shared building blocks: roles and permissions as rows, `can()`, append-only audit log with database triggers, atomic counters and readable numbers, settings, development seed and reset (development only), `/me` and `/roles`
- [x] Accounts and assignments (owner prompt, 17 Nov 2026): sign-in with Argon2 and session cookies, rate limit, forced new password, seed script, users, project assignments with alerts, project-scoped access, record store for the frontend data layer, empty checklist steps (ADR 0005)

## Waiting on the owner

- [ ] Review B0 and B1 (committed and pushed on feature/stage-1-foundation)
- [ ] Decide audit retention
- [ ] Where the backend is hosted, so the frontend host can forward `/api` to it
- [ ] Start Docker Desktop once to check `docker compose up api` (not verified: Docker was not running)

## Next

- [ ] Move the intake rules from the frontend data layer into services (confirmations, duplicates, line edits, modules), so the server checks them too
- [ ] B3 intake, with the object store added to Compose

## Known follow-ups

- [ ] Pagination and filter conventions are set at B2 with the first list endpoint
- [ ] Who defines checklist steps per project, and an endpoint to write them
