# Tasks

## Done

- [x] B0 foundations: layout, settings, health and version, error shape, request id and log line, Alembic baseline, ruff, mypy strict, pytest on real PostgreSQL, Dockerfile, Compose services (api, postgres), CI job, the no-financial-name contract test (ADR 0001 to 0004)
- [x] B1 shared building blocks: roles and permissions as rows, `can()`, append-only audit log with database triggers, atomic counters and readable numbers, settings, development seed and reset (development only), `/me` and `/roles`

## Waiting on the owner

- [ ] Review B0 and B1 (committed and pushed on feature/stage-1-foundation)
- [ ] Confirm the Admin and Engineer matrix
- [ ] Decide audit retention, and whether the development header stays as the stand-in until sign-in (B10)
- [ ] Start Docker Desktop once to check `docker compose up api` (not verified: Docker was not running)

## Next

- [ ] B2 customers, sites, projects, project status and the stage tracker (frontend Stage 4 is built; mirror ADR 0013, including a migration adding `set_project_status` for Admin)
- [ ] B3 intake, with the object store added to Compose

## Known follow-ups

- [ ] Pagination and filter conventions are set at B2 with the first list endpoint
- [ ] Sign-in replaces the development header at B10
