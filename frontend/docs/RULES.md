# Frontend Rules

Rules for developing the Project One frontend. They apply to every contributor, people and agents alike. Section 6 adds the rules agents follow when they work on the frontend. Decisions behind these rules are in `adr/`.

## 1. Stack and structure

- React 18 and Vite 5 in JavaScript (`.jsx`, `.js`); no TypeScript application code (ADR 0002). JSDoc where a data shape matters.
- Hash routing with React Router 6. Tailwind v4 utilities without preflight; the app's own stylesheets stay in charge.
- Folders: `src/app` (shell, navigation, routes), `src/components` (shared parts), `src/styles` (tokens and stylesheets), `src/pages` (screens), `src/lib` (helpers). Feature folders and the data layer arrive with the stages that need them.
- One component per file, named for what it is. Split a file that grows past about 250 lines.
- Import shared parts from `@/components`, helpers from `@/lib/...`.

## 2. Look and styling

- The approved look is preserved: both themes, floating glass sidebar, command search, Phosphor icons, logo, Urbanist, lime accent. No visual change without approval.
- Every colour, font size, weight, spacing step, radius, shadow and duration comes from `src/styles/tokens.css` (ADR 0005). New CSS uses tokens, never raw values; Tailwind classes use the token utilities (`text-ui`, `rounded-nav`, and so on).
- Use the shared components before writing new markup: Card, DataTable, StatusBadge, FormField, Dialog, EmptyState, LoadingState, ErrorState, PageHead, SegmentedControl.
- Phosphor icons use the `*Icon` export names.
- Phones first for field screens: everything works at 360 px wide with no sideways page scroll. Below 860 px the bottom bar and drawer take over (ADR 0006).
- Navigation is defined only in `src/app/navigation.js`. An area appears only when `built: true`; nothing in the menu may lead to an empty page.

## 3. Code

- No placeholder code, `TODO` or `FIXME` comments, commented-out code, `console.log` or lorem ipsum. Unfinished work lives behind a named interface and is listed in the stage report.
- Comments explain why, never what.
- Screens never read storage or fixtures directly; once the data layer exists, they go through the `ProjectOneApi` interface only.
- Money is integer paise, never a floating point number. Dates are stored in UTC and shown in IST.
- Field engineer screens never receive prices or bank details. Permission checks go through one helper, not scattered role checks.
- Accessibility is part of done: keyboard operation, visible focus, labels on every control, enough contrast, reduced motion respected. Dialogs trap focus and return it on close.
- Every change that adds logic adds tests (Vitest and Testing Library). Components that hold logic get component tests.

## 4. Copy and docs

- No em dashes anywhere: UI text, docs, comments, commit messages.
- UI copy is short and plain. No emoji or marketing language.
- Keep `README.md`, `MEMORY.md` and `TASKS.md` current at the end of each stage; record significant decisions as decision records in `adr/`.
- Customer material is described in general terms only: no customer names, GSTINs, IP addresses or bank details in tracked files.

## 5. Git

- One branch for all stages: `feature/stage-1-foundation`. Never commit to `main`; never force-push.
- Conventional Commits with a scope, imperative subject under 72 characters, grouped by folder.
- Commits carry only the owner's authorship: no co-author or tool attribution lines, and no tool references in messages, comments or docs.

## 6. Rules for agents working on the frontend

1. Work one stage at a time: questions, plan, build, verify, stage report. Do not start a stage or a major change without the owner's answer; "not yet" means stop.
2. Ask questions as multiple-choice options, at most four at a time, recommended option first with a one-line reason. Each question must stand on its own.
3. Ask before: adding, removing or upgrading a dependency; moving, renaming or deleting files; changing a route, URL or stored data format; any visual change to an approved screen; anything touching money, security, access or customer data; anything the specs mark as proposed or open.
4. Never invent procedure steps, field lists, role permissions or approval limits. Add them to the open questions and build an interface the answer can fill.
5. Do not stage, commit or push unless the owner asks. When asked, run `npm run check` first and commit folder by folder.
6. Verify before reporting: lint, format check, typecheck, tests and build pass; screens checked at 1440, 860 and 360 px in both themes against the previous stage, with every visible difference listed.
7. Report only what was run and seen to pass; name anything not verified and any regression found.
8. Read this file, `MEMORY.md` and `TASKS.md` at the start of every session, and update `MEMORY.md`, `TASKS.md` and `adr/` at the end of each stage.
