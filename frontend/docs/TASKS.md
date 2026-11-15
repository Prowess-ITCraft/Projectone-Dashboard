# Tasks

## Done

- [x] Stage 0: orientation, dashboard inventory, gap report
- [x] Stage 1: move into `frontend/`, Node 22 pin, dev port 9555, Docker Compose, ESLint, Prettier, Vitest, GitHub Actions, README and PRODUCT rewrite, decision records 0001 to 0004
- [x] Stage 3, intake slice (built, awaiting review): `ProjectOneApi` on IndexedDB (`idb`), customers and projects with the stage tracker, upload of order documents and PrismSuite reports (known samples read, other files typed in), side by side duplicate handling, line review and classification with reasons, coverage check, module creation with delivery, temporary acting-as roles, decision records 0007 and 0008
- [x] Stage 2: design tokens, shared components, `src/app` shell with navigation config, phone bottom bar and drawer backdrop, 360 px fixes, `*Icon` names, unused logo removed, last TypeScript files converted, decision records 0005 and 0006

## Waiting on the owner

- [ ] Push `feature/stage-1-foundation` (Stages 1 and 2; all stages share this branch) and open the pull request; change the Vercel root directory to `frontend/` when it merges
- [ ] Review and commit the Stage 3 intake slice (changes are in the working tree)

## Next

- [ ] Later stages from the restructure prompt: kick-off and lookup tables, planning and calendar, execution with evidence, approvals and exceptions, live status and completion report, guides and admin, hardening
- [ ] Real PDF reading for order documents and reports behind the same interface (needs the backend parser); until then only known samples are read and other files are typed in

## Known follow-ups

- [ ] The owner supplied sample lookup tables (firewall, domain, NAS), a sample work schedule and a sample completion report; they are kept in the private samples folder for Stages 6, 7 and 10

- [ ] ESLint 10 once `eslint-plugin-react` and `eslint-plugin-jsx-a11y` support it
- [ ] `npm audit`: react-router 6 open redirect advisory (fix needs React Router 7, a major upgrade) and the esbuild dev-server advisory through Vite 5 (fix needs a newer Vite). Both need owner approval
- [ ] React Router future flag warnings (`v7_startTransition`, `v7_relativeSplatPath`) appear in tests; decide with the router upgrade
- [ ] On phones the checklist tables scroll sideways inside their cards; a stacked row layout belongs with the real checklist stage
- [ ] The overview topology diagram is small at 360 px; revisit with the dashboard work
- [ ] The spacing scale has a step for nearly every value in use; reducing it would change the look and needs an owner decision
- [ ] Bundle size: the build warns about a chunk over 500 kB; split the project pages with lazy routes
- [ ] Support entitlements are stored at module creation but have no screen; they belong with the closure stage
- [ ] The antivirus conflict list from a PrismSuite report (feeds the EPS and sanitization tasks) is not built; only the coverage check is
- [ ] Open question for lookup tables: the NAS sheet records a data structure and backup policy, while the restructure prompt lists capacity, RAID, shares, antivirus and snapshot
- [ ] Roles: the acting-as picker and `can()` are temporary until the role model and approval limits are decided
- [ ] On phones the order lines table scrolls sideways inside its card; a stacked row layout belongs with the real checklist stage
