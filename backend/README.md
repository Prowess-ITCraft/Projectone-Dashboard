# Project One API

The backend for Project One. It will replace the frontend's local data adapter without any screen changing. Stages B0 (foundations) and B1 (roles, permissions, audit, identifiers, development tools) are built; feature endpoints arrive with the frontend stages they serve.

## Stack

Python 3.12, FastAPI, Pydantic v2, PostgreSQL 16, SQLAlchemy 2 (async) with asyncpg, Alembic. Tests use pytest against a real PostgreSQL. Decisions are in `docs/adr/`.

## Run it

With Docker (from the repository root):

```sh
docker compose up api
```

The API listens on http://localhost:9666 and PostgreSQL is published on 9667 for local tools. Migrations run on start.

Without Docker:

```sh
cd backend
python -m venv .venv
.venv/Scripts/pip install -r requirements-dev.txt     # .venv/bin/pip on Linux and macOS
.venv/Scripts/python scripts/local_postgres.py        # prints a DATABASE_URL and keeps PostgreSQL running
# in a second terminal, with DATABASE_URL and ENVIRONMENT=development set:
.venv/Scripts/alembic upgrade head
.venv/Scripts/uvicorn app.main:build --factory --port 9666 --no-access-log
```

`--no-access-log` matters: the server's own access log prints full URLs, and query strings can hold customer data. The application writes its own request line (method, path, status, time, request id) without them.

Create the first accounts once the migrations have run (ADMIN_PASSWORD at least 10 characters; set both in the environment or a local `.env`, never in the repository):

```sh
ADMIN_EMAIL=you@example.com ADMIN_PASSWORD=... DEFAULT_ENGINEER_PASSWORD=... .venv/Scripts/python scripts/seed_accounts.py
```

It creates the Admin and Engineer 01 to 10 (engineer01@ and so on, at the Admin's domain unless `ENGINEER_EMAIL_DOMAIN` is set), gives every engineer the same starting password from `DEFAULT_ENGINEER_PASSWORD` (at least 10 characters; environment or local `.env` only, never committed, and only its hash is stored) and prints nothing secret. Running it again creates only what is missing and never changes an existing password, so a password an engineer has chosen is safe. Every account chooses a new password at first sign-in.

The API reads `DEFAULT_ENGINEER_PASSWORD` too (Docker Compose passes it through from your shell or an untracked `.env`). Without it, adding an engineer or resetting one to the default fails with `default_password_not_set`. On the Users page an Admin can copy an engineer's email and the default password (`GET /users/{id}/login-details`, only while they have not changed it) and reset an engineer to the default (`POST /users/{id}/reset-password`). A password an engineer chose is never readable.

In development you can also create two invented accounts without passwords with `POST /dev/seed` and act as one with the header `X-Dev-User: asha` (Admin) or `X-Dev-User: ravi` (Engineer). Interactive docs are at `/docs` in development only.

## Check it

```sh
.venv/Scripts/ruff check .
.venv/Scripts/ruff format --check .
.venv/Scripts/mypy app tests
.venv/Scripts/pytest
```

Tests need no Docker: without `TEST_DATABASE_URL` they start an embedded PostgreSQL. CI sets `TEST_DATABASE_URL` to a PostgreSQL service.

## Endpoints so far

| Method and path       | Who                    | What                                                                    |
| --------------------- | ---------------------- | ----------------------------------------------------------------------- |
| `GET /health`         | anyone                 | Process is up                                                           |
| `GET /health/ready`   | anyone                 | Database answers                                                        |
| `GET /version`        | anyone                 | Version and environment                                                 |
| `POST /auth/login`    | anyone                 | Sign in; sets the session cookie                                        |
| `POST /auth/logout`   | anyone                 | Ends the session                                                        |
| `POST /auth/change-password` | signed in       | Replaces a temporary or default password; the default is refused as the new one |
| `GET /me`             | signed in              | The user, role, permitted actions and whether a new password is due     |
| `GET, POST /users`, `POST /users/{id}/reset-password`, `/deactivate`, `/activate` | Admin | Accounts |
| `GET /assignments`, `GET, PUT /projects/{id}/assignments`, `DELETE /projects/{id}/assignments/{engineer}` | Admin; engineers read their own | Engineers on projects |
| `GET /notifications`, `POST /notifications/{id}/read`, `/read-all` | signed in | The user's alerts |
| `GET /projects/{id}/checklist-steps` | Admin or assigned engineer | Checklist steps (none yet) |
| `/store/...`          | signed in, by permission and assignment | The record store the frontend data layer saves through |
| `GET /roles`          | signed in              | Roles and their actions (permissions are data)                          |
| `POST /dev/seed`      | development only       | Creates the Admin and Engineer development accounts                     |
| `POST /dev/reset`     | development only, Admin | Clears counters, settings and users, reseeds; the audit log is kept    |
| `GET /openapi.json`   | anyone                 | The contract                                                            |

Errors always have the shape `{ code, message, reason?, request_id }`.

## Layout

```text
app/
  main.py        application factory, request id and log line, error shape
  config.py      settings from the environment
  db.py          engine and one transaction per request
  api/           thin routers (health, identity, dev tools) and request dependencies
  services/      rules with database access: audit writer, permissions, counters, settings, seed
  domain/        pure rules: role matrix, financial year and readable numbers
  models/        SQLAlchemy models
  schemas/       response models
migrations/      Alembic (0001 baseline, 0002 identity, audit and counters, 0003 accounts, projects and assignments)
scripts/         local PostgreSQL without Docker, and the account seed
tests/           pytest, one database copy per test
```

Rules for contributors are in `docs/RULES.md`; short facts in `docs/MEMORY.md`; what is next in `docs/TASKS.md`.
