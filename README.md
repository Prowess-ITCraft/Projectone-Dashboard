# ProjectOne

Internal ITCraft tool that turns a confirmed customer order into planned, checklist-driven and verified implementation work. See [PRODUCT.md](PRODUCT.md) for what it does.

## Repository layout

```text
frontend/          React + Vite app
  docs/            engineering notes: decisions (adr/), MEMORY.md, TASKS.md
  src/app/         shell: sidebar, phone bottom bar, search, navigation config, routes
  src/components/  shared parts: Card, DataTable, StatusBadge, FormField, Dialog, states, charts
  src/styles/      design tokens (tokens.css) and the stylesheets that use them
  src/pages/       screens
  src/features/    one folder per product area (projects: intake, review, classification, modules)
  src/domain/      pure rules and types (money, classification, validation, stages, roles)
  src/data/        the data interface, the local adapter and the anonymised sample fixtures
  src/lib/         small helpers (CSV export, time, class names, media queries)
backend/           reserved for the API (not started)
docker-compose.yml local development
```

## Requirements

- Node 22 (see `frontend/.nvmrc`) and npm 10, or
- Docker with Compose

## Run locally

With Node:

```sh
cd frontend
npm ci
npm run dev
```

With Docker:

```sh
docker compose up
```

The app is served on http://localhost:9555. The API address is read from `VITE_API_URL` (default `http://localhost:9666`); copy `frontend/.env.example` to `frontend/.env` to change it.

## Scripts (in `frontend/`)

| Script                            | What it does                                                         |
| --------------------------------- | -------------------------------------------------------------------- |
| `npm run dev`                     | Dev server on port 9555                                              |
| `npm run build`                   | Production build into `dist/`                                        |
| `npm run preview`                 | Serve the production build on port 9555                              |
| `npm run lint`                    | ESLint                                                               |
| `npm run format` / `format:check` | Prettier write / check                                               |
| `npm run typecheck`               | TypeScript compiler over `src` (editor hints; the app is JavaScript) |
| `npm test`                        | Vitest, single run                                                   |
| `npm run check`                   | All of the above in CI order                                         |

## Deployment

The frontend deploys on Vercel with the project root directory set to `frontend/`. Continuous integration runs lint, format check, typecheck, tests and build on every pull request (`.github/workflows/ci.yml`).
