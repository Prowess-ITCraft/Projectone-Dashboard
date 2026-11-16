# 0004. Development identity, append-only audit, counters and test databases

Date: 2026-11-16
Status: Accepted

## Context

Sign-in is an open owner decision, yet every write needs a known actor. The audit log must not be editable by any path. Readable numbers must never repeat. The rules under test are database behaviour, so tests need a real PostgreSQL even on a machine without Docker.

## Decision

- **Development identity.** Until sign-in exists, the `X-Dev-User` header names a seeded account. It works only when `ENVIRONMENT=development`; anywhere else it is refused with `dev_header_not_allowed`, and without sign-in nobody is signed in at all. The development accounts (an Admin and an Engineer, invented names) are created by `POST /dev/seed`.
- **Development tools** (`/dev/seed`, `/dev/reset`) and `/docs` are registered only in development. Reset is Admin only, clears counters, settings and users, reseeds, and keeps the audit log, writing its own entry.
- **Permissions as rows.** `roles` and `role_actions` are seeded by migration 0002 with a frozen copy of the matrix. A test checks the frozen copy still equals `app/domain/role_matrix.py`.
- **Append-only audit.** Database triggers refuse update, delete and truncate on `audit_log`. The actor is stored as an id and a label with no foreign key, so the record outlives the user. Only `services.audit.record` writes rows, inside the caller's transaction.
- **Counters.** One `INSERT ... ON CONFLICT DO UPDATE ... RETURNING` statement, so concurrent requests never share a number (tested with twenty at once). The financial year (April to March, by the date in India) is part of the key, so project numbers restart each year.
- **Test databases.** `TEST_DATABASE_URL` when set (CI), otherwise an embedded PostgreSQL from the `pgserver` package. Migrations run once into a template database; each test runs on its own copy.
- **Logs.** The application writes one JSON line per request (request id, method, path, status, time) and never bodies or query strings; uvicorn runs with `--no-access-log`.

## Consequences

- The header must be removed from the trust path at B10 when sign-in arrives; it is already inert outside development.
- A downgrade of migration 0002 drops the audit table; downgrades are development operations.
