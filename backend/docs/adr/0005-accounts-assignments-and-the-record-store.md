# 0005. Accounts, sign-in, assignments and the record store

Date: 2026-11-17
Status: Accepted. Replaces the development header of 0004 as the way to sign in (the header stays, in development only).

## Context

The owner asked for real accounts in PostgreSQL: one Admin assigns projects to engineers, each engineer signs in and sees only their assigned work, enforced on the server. Projects lived in each browser's IndexedDB, with the intake rules in the frontend's data layer.

## Decision

- **Accounts.** `users` is rebuilt (migration 0003): full name, unique lowercase email, Argon2id password hash (`argon2-cffi`, owner approved), role, active flag, `must_change_password`, last sign-in. Passwords are never stored, returned or logged in plain form. An account without a hash cannot sign in; only the development accounts are made that way.
- **Sign-in.** `POST /auth/login` gives one answer for an unknown email, a wrong password and a deactivated account, and checks a hash even for an unknown email. Attempts are recorded in `login_attempts`; 5 failures per email or 20 per address within 15 minutes refuse further attempts. The attempt row is committed even when sign-in fails, so the router returns the error instead of raising it.
- **Sessions.** An httpOnly, SameSite=Lax cookie (Secure outside development) holding a random token; the `sessions` table stores only its SHA-256. A session ends after 30 minutes without activity or 12 hours after sign-in. Requests with `X-Background: 1` (alert polling) do not count as activity. Changes made with the cookie must carry `X-Requested-With: ProjectOne`. Changing or resetting a password and deactivating an account end the other sessions.
- **Temporary passwords.** Seeded, added and reset accounts must choose a new password; until then every endpoint except `/me`, `/auth/*` answers `password_change_required`.
- **Seed script.** `scripts/seed_accounts.py` creates one Admin (email and password from the environment) and Engineer 01 to 10 with the shared `DEFAULT_ENGINEER_PASSWORD` (environment only, never committed; only its hash is stored). Each must choose a new password at first sign-in. No random passwords are generated and no credentials file is written; nothing secret is printed. It never changes an existing account, so running it twice creates nothing.
- **Permissions.** Migration 0003 replaces the matrix: an engineer may `upload`, `edit_lines` and `classify`; everything else, including creating projects, confirmations, status, delivery and the checklist, is Admin only. New actions: `assign_engineers`, `view_all_projects`, `set_project_status`.
- **Assignments.** `project_assignments` rows are never deleted: `removed_at` ends one, and a partial unique index allows one active row per project and engineer. The table means project membership only; assigning a checklist step later is a separate table that requires an active row here. Assigning or removing notifies that engineer only (`notifications`) and writes an audit row the project activity shows.
- **Who sees what.** A user with `view_all_projects` sees every project; anyone else sees only active assignments. Anything else is answered 404, so its existence is not revealed (`services.access`).
- **Record store.** Customers, sites and projects have tables with the columns the server filters on, plus the full record in `data`. Documents, lines, modules and entitlements are `project_records` keyed by (store, id) and tied to a project; uploaded files are `stored_files` (bytes in the database until an object store arrives). The frontend's data layer saves through `/store`: reads are filtered by visibility, each store needs a permission to write, writes to a project need it visible and in progress, and a batch is saved in one transaction or not at all. Activity entries take their actor from the session, and cannot be changed or deleted. Readable numbers come from the atomic counters.
- **Checklist steps.** `checklist_steps` per project, empty for now; `GET /projects/{id}/checklist-steps` reads them.

## Consequences

- The intake rules (confirmations lock lines, duplicates, module creation) still run in the frontend data layer. The server enforces who may touch which project and store, not those rules: an engineer with browser tools could write malformed lines into a project assigned to them. Moving the rules into services is the next backend stage.
- Development data from before 0003 is not migrated; the database starts empty.
- `/dev/reset` no longer deletes accounts, as assignments refer to them.
