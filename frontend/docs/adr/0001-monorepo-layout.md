# 0001. One repository with frontend and backend folders

Date: 2026-11-15
Status: Accepted

## Context

The dashboard repository held the Vite app at its root. A backend will follow, and the owner wants both in one repository.

## Decision

- The app lives in `frontend/`. `backend/` is reserved and holds only a README until the API work starts.
- `docker-compose.yml` sits at the root and runs the frontend dev server on port 9555. The API will use port 9666; the frontend reads its address from `VITE_API_URL`.
- Files were moved with plain moves so history follows the files once committed (Git detects the renames).
- The Vercel project's root directory changes to `frontend/` when this lands. The owner makes that change.

## Consequences

- Every path in the app changed in one move. Later diffs stay small.
- Tailwind's automatic source scan now covers `frontend/` only. Before, it also scanned tooling folders at the root, which inflated the CSS bundle (43.97 kB to 38.26 kB) without affecting the rendered screens.
- Until the Vercel setting changes, deploys from `main` fail.
