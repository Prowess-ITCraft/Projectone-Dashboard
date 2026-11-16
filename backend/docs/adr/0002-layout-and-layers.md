# 0002. Layout and layering

Date: 2026-11-16
Status: Accepted

## Context

The rules that matter most (strict order, separation of duties, audit with every change) must live in one place where they can be tested without HTTP, and the HTTP layer must stay thin so the contract is easy to read.

## Decision

- `app/api`: routers and request dependencies only. They validate, call a service, return a response model.
- `app/services`: rules with database access. They never import FastAPI.
- `app/domain`: pure functions and data (role matrix, financial year). No I/O.
- `app/models` and `app/schemas`: storage models and response models, kept separate so a table change does not silently change the contract.
- One transaction per request: the session dependency commits when the request succeeds and rolls back when it fails. Services flush but never commit.
- The application is built by a factory (`create_app(settings, database)`), so tests build apps per environment on their own database.

## Consequences

- A change and its audit row always commit together.
- Services are tested directly; routers are tested through the HTTP client.
