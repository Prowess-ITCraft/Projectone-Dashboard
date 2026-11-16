# 0001. Backend stack

Date: 2026-11-16
Status: Accepted

## Context

Project One needs an API that replaces the frontend's local data adapter. It must read PDF and Excel files later, render report PDFs, keep strict transactional rules and run on free, open-source tooling. The earlier context pack designed a larger Python system; most of it (pricing, recommendation and dataset engines) is out of scope now.

## Decision

- Python 3.12, FastAPI, Pydantic v2: typed request and response models and a generated OpenAPI document, which is the contract with the frontend.
- PostgreSQL 16 with SQLAlchemy 2 (async, asyncpg) and Alembic migrations.
- pytest against a real PostgreSQL; ruff for lint and format; mypy in strict mode.
- Docker Compose for local runs (API 9666, PostgreSQL published on 9667); a CI job beside the frontend's.
- Libraries for later stages (object store, PDF and Excel readers, report rendering, job queue) are added at the stage that first needs them, each with its own approval.

## Consequences

- Python matches the document tooling the later stages need.
- Nothing is installed before a stage uses it, so B0 and B1 carry no object store or queue.
