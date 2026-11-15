# Memory

Short facts a new contributor needs before changing anything. Decisions with reasons are in `adr/`.

## Working agreement

- Work goes in stages. Each stage starts with questions to the owner, then a plan, then the build, then a stage report. The next stage starts only after the owner approves.
- The owner does every Git write: commits, pushes and pull requests. Changes are left in the working tree with suggested commit groups.
- Branches: `feature/stage-<number>-<topic>`. Commit messages: Conventional Commits.
- No em dashes in UI copy, docs, comments or commit messages.
- Never invent procedure steps, field lists, role permissions or approval limits. Undecided items go to the open questions list and are built as data or interfaces.

## Stack

- React 18 and Vite 5 in JavaScript (ADR 0002). Hash routing with React Router 6.
- Tailwind v4 utilities without preflight. Design tokens (both themes, type, spacing, radii) are in `src/styles/tokens.css`; Tailwind reads them through `@theme` (ADR 0005). shadcn config is present, no primitives installed.
- Phosphor icons (use the `*Icon` names), Framer Motion, Urbanist from Google Fonts.
- Use the shared parts in `src/components/` (Card, DataTable, StatusBadge, FormField, Dialog, empty, loading and error states) before writing new markup. Use tokens, never raw values, in new CSS.
- Navigation lives in `src/app/navigation.js`: an area shows only when `built: true`. Phones below 860 px get a bottom bar plus drawer (ADR 0006).

## Ports and environment

- Frontend dev server: 9555. API (future): 9666 through `VITE_API_URL`.

## Private material

- The context pack (`/docs`) and sample documents (`/samples`) are not in Git (ADR 0003).

## Current state (after Stage 2)

- Screens: Overview, Components, component checklist, two questionnaires, on the shared components and tokens. All data is hard-coded demo content in `src/data.js` and stored in `localStorage` under `projectone.v4`.
- Field devices to target: Android phones with Chrome, 360 px wide.
- Priority order for the flow: intake, then modules, then checklist.
