# Tasks

## Done

- [x] Stage 0: orientation, dashboard inventory, gap report
- [x] Stage 1: move into `frontend/`, Node 22 pin, dev port 9555, Docker Compose, ESLint, Prettier, Vitest, GitHub Actions, README and PRODUCT rewrite, decision records 0001 to 0004
- [x] Stage 3, intake slice (built, awaiting review): `ProjectOneApi` on IndexedDB (`idb`), customers and projects with the stage tracker, upload of order documents and PrismSuite reports (known samples read, other files typed in), side by side duplicate handling, line review and classification with reasons, coverage check, module creation with delivery, temporary acting-as roles, decision records 0007 and 0008
- [x] Stage 2: design tokens, shared components, `src/app` shell with navigation config, phone bottom bar and drawer backdrop, 360 px fixes, `*Icon` names, unused logo removed, last TypeScript files converted, decision records 0005 and 0006

- [x] Stage 2R, rework for prompt v2: no financial data anywhere, Admin and Engineer roles as data, Admin decides duplicates with a reason, spreadsheets refused as orders, stored data reset (ADR 0009)
- [x] Stage 3, data layer: Overview, Components, checklist and questionnaires read through ProjectOneApi, legacy store and demo arrays removed, reset is Admin only (ADR 0010)
- [x] Demo sign-in page: the app sits behind /login, demo account signs in as Admin, animated project steps panel, sign out in the sidebar (ADR 0011)
- [x] React Router 6 to 7.18.5 (owner approved): clears the router security advisories and the future flag warnings; no code changes were needed (ADR 0012)
- [x] Bugs fixed after a full browser test: the sign-in error now clears while retyping, primary buttons no longer show a dark left edge, the drawer closes when a window becomes narrow
- [x] Stage 4: customers list and page, sites (several per project), project status with Admin-only changes and reasons, PrismSuite badge, projects list with new columns, filters, sort and phone cards (ADR 0013)
- [x] Production readiness pass on Stage 4: project creation saves nothing when any check fails, contact emails are checked, lists read every store once (200 projects: 5.5 s to 0.13 s), long names wrap, pages load as separate files (no 500 kB warning); tested on the dev server and the production build

## Waiting on the owner

- [ ] Push `feature/stage-1-foundation` (Stages 1 and 2; all stages share this branch) and open the pull request; change the Vercel root directory to `frontend/` when it merges
- [ ] Review the sign-in page in a browser at desktop and phone width in both themes (not checked by the builder)
- [ ] Review Stage 4 in the browser and approve it
- [ ] Send the PrismSuite logo file to replace the text badge
- [ ] Stage 5 questions (intake for the 13 samples)
- [ ] Confirm the role matrix in src/domain/permissions.js (see OPEN_QUESTIONS.md)
- [ ] Stage 4 questions: customer page, sites per customer, list filters and columns, project statuses, PrismSuite logo file

## Next

- [ ] Stage 4 customers and projects; Stages 5A to 5D intake for the 13 samples (tax invoices, issuer and confirmation fields, serial numbers, anonymised fixtures, both PrismSuite templates, document linking, AMC handling)
- [ ] Later stages: kick-off and lookup tables (upload the Excel or fill in the app), planning and calendar, execution with evidence, approvals and exceptions, live status and completion report, guides and admin, hardening and the API contract
- [ ] Real PDF reading for order documents and reports behind the same interface (needs the backend parser); until then only known samples are read and other files are typed in

## Known follow-ups

- [ ] The owner supplied sample lookup tables (firewall, domain, NAS), a sample work schedule and a sample completion report; they are kept in the private samples folder for Stages 6, 7 and 10

- [ ] ESLint 10 once `eslint-plugin-react` and `eslint-plugin-jsx-a11y` support it
- [ ] `npm audit` (development tools only, not shipped in the app): the esbuild dev-server advisory through Vite 5 (fix needs a newer Vite), and advisories in the test runner's dependencies (`tinypool`, `@vitest/mocker`, rated up to critical; fix needs a newer Vitest) and `minimatch`. Each needs owner approval
- [ ] On phones the checklist tables scroll sideways inside their cards; a stacked row layout belongs with the real checklist stage
- [ ] The overview topology diagram is small at 360 px; revisit with the dashboard work
- [ ] The spacing scale has a step for nearly every value in use; reducing it would change the look and needs an owner decision
- [ ] Support entitlements are stored at module creation but have no screen; they belong with the closure stage
- [ ] The antivirus conflict list from a PrismSuite report (feeds the EPS and sanitization tasks) is not built; only the coverage check is
- [ ] Open question for lookup tables: the NAS sheet records a data structure and backup policy, while the restructure prompt lists capacity, RAID, shares, antivirus and snapshot
- [ ] Roles: the acting-as picker and `can()` are temporary until the role model and approval limits are decided
- [ ] On phones the order lines table scrolls sideways inside its card; a stacked row layout belongs with the real checklist stage
