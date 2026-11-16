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

In development, create the invented accounts with `POST /dev/seed`, then act as one by sending the header `X-Dev-User: asha` (Admin) or `X-Dev-User: ravi` (Engineer). Interactive docs are at `/docs` in development only.

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
| `GET /me`             | signed in              | The user, role and permitted actions                                    |
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
migrations/      Alembic (0001 baseline, 0002 identity, audit and counters)
scripts/         local PostgreSQL without Docker
tests/           pytest, one database copy per test
```

Rules for contributors are in `docs/RULES.md`; short facts in `docs/MEMORY.md`; what is next in `docs/TASKS.md`.
