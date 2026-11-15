# 0003. Keep the context pack and sample documents out of Git

Date: 2026-11-15
Status: Accepted

## Context

The product context pack (`docs/` at the root) and the sample order documents (`samples/`) drive the work. The samples are real customer documents: they carry customer GSTINs and addresses, and the proforma invoice shows ITCraft's bank details.

## Decision

- Root `docs/` and `samples/` stay ignored by Git and live only on team machines.
- Engineering documentation that reviewers need (decision records, `MEMORY.md`, `TASKS.md`, inventories, later the API contract) lives in the tracked `frontend/docs/`.
- When tests need sample data (Stage 5 intake), the fixtures committed to the repository are reduced copies: no bank details, and customer identifiers replaced where they are not needed for the test.

## Consequences

- A fresh clone does not contain the context pack. New team members get it from the owner.
- Tracked documents may name a context pack file (for example `docs/03_DATA_MODEL.md`) as the source of a rule; the reader needs the pack to follow the reference.
