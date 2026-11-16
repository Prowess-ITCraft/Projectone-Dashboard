# Memory

Short facts a new contributor needs before changing anything. Rules for development and for agents are in `RULES.md`; decisions with reasons are in `adr/`.

## Working agreement

- Work goes in stages. Each stage starts with questions to the owner, then a plan, then the build, then a stage report. The next stage starts only after the owner approves.
- The owner does every Git write: commits, pushes and pull requests. Changes are left in the working tree with suggested commit groups.
- Branch: every stage goes on `feature/stage-1-foundation`; no new branch per stage. Commit messages: Conventional Commits.
- No em dashes in UI copy, docs, comments or commit messages.
- Never invent procedure steps, field lists, role permissions or approval limits. Undecided items go to the open questions list and are built as data or interfaces.

## Stack

- React 18 and Vite 5 in JavaScript (ADR 0002). Hash routing with React Router 6.
- Tailwind v4 utilities without preflight. Design tokens (both themes, type, spacing, radii) are in `src/styles/tokens.css`; Tailwind reads them through `@theme` (ADR 0005). shadcn config is present, no primitives installed.
- Phosphor icons (use the `*Icon` names), Framer Motion, Urbanist from Google Fonts.
- Use the shared parts in `src/components/` (Card, DataTable, StatusBadge, FormField, Dialog, empty, loading and error states) before writing new markup. Use tokens, never raw values, in new CSS.
- Data goes through one interface (`src/data/api.jsx`); the local adapter in `src/data/local` stores everything in IndexedDB until the backend exists (ADR 0007).
- Pure rules live in `src/domain` (ids, classification, validation, stage tracker, coverage, roles as data) with tests; screens for the project flow are in `src/features/projects` (ADR 0008).
- The repository is public: tracked samples are anonymised, and the dev server alone reads private samples. Never add real customer data or bank details.
- Navigation lives in `src/app/navigation.js`: an area shows only when `built: true`. Phones below 860 px get a bottom bar plus drawer (ADR 0006).

## Ports and environment

- Frontend dev server: 9555. API (future): 9666 through `VITE_API_URL`.

## Private material

- The context pack (`/docs`) and sample documents (`/samples`) are not in Git (ADR 0003).

## Current state (after Stages 2R and 3)

- Projects: list, new project, and a project page with overview (stage tracker, activity), documents (upload), order lines (review and classify), coverage and modules. The temporary "acting as" role is chosen in the top bar.
- Screens: Overview, Components, component checklist, two questionnaires, on the shared components and tokens. They read through `ProjectOneApi` (ADR 0010): the catalogue is in `src/data/fixtures/catalog.js`, progress and responses are in IndexedDB.
- The app sits behind a demo sign-in at `/login` (ADR 0011): one demo account, checked in the browser, signs in as Admin until Sign out. Real sign-in comes with the backend.
- No financial data anywhere, and two roles, Admin and Engineer (ADR 0009). An Admin decides duplicate documents, with a reason.
- Field devices to target: Android phones with Chrome, 360 px wide.
- Priority order for the flow: intake, then modules, then checklist.
