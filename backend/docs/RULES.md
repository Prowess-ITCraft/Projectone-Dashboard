# Backend Rules

Rules for developing the Project One API. They apply to every contributor. Decisions behind them are in `adr/`. The working agreement (stages, questions first, the owner does every Git write, no em dashes, Conventional Commits, no attribution lines) is the same as in `frontend/docs/RULES.md`.

## 1. Data

- Project One holds no financial data. No table, column, field, parameter or log line may hold rates, amounts, taxes, totals, payment terms, bank details, cost or margin. Tests fail the build if a financial name appears in the API document or a table (ADR 0003).
- Word and Excel uploads are stored as originals and never parsed for order content. PDF readers drop financial fields before anything is written.
- Dates are stored in UTC (`timestamptz`). Identifiers are UUIDs plus readable numbers (`PRJ-<fy>-<n>`, `CUS-<n>`) from the atomic counter.
- Never put real customer data in code, tests, fixtures, logs or error messages. The repository is public.

## 2. Layers

- Routers validate input, call a service and return a response model. No business rules in routers.
- Services hold the rules and the database access. They never import FastAPI.
- `app/domain` is pure: no database, no network, no clock unless passed in.
- One transaction per request (`Database.session`). A change and its audit row commit together.

## 3. Access and audit

- Every permission check goes through `services.permissions.can` or `require`, which read the `role_actions` rows. No role names in routers or services.
- The acting user comes from the server session, never from a request body. Until sign-in exists, the `X-Dev-User` header works in development only and is refused everywhere else.
- Every state change writes an audit row through `services.audit.record`, in the same transaction. The audit table refuses update, delete and truncate at the database level.
- Development tools are registered only when `ENVIRONMENT=development`.

## 4. Errors and logs

- Errors use `{ code, message, reason?, request_id }`. Codes are stable; messages are plain and short. Validation errors name fields and never echo values.
- Log lines carry the request id, method, path, status and time. Never bodies, query strings, headers, file contents, GSTINs or passwords. Run uvicorn with `--no-access-log`.

## 5. Schema changes

- Every schema change is an Alembic migration with a working downgrade. A test applies, undoes and reapplies all migrations, and another checks the migrations match the models exactly.
- Data a migration seeds is frozen inside the migration; a later change is a new migration.

## 6. Done means

- `ruff check`, `ruff format --check`, `mypy app tests` (strict) and `pytest` pass. Every rule added has a test. Say plainly what was not verified.
