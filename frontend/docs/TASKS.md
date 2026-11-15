# Tasks

## Done

- [x] Stage 0: orientation, dashboard inventory, gap report
- [x] Stage 1: move into `frontend/`, Node 22 pin, dev port 9555, Docker Compose, ESLint, Prettier, Vitest, GitHub Actions, README and PRODUCT rewrite, decision records 0001 to 0004
- [x] Stage 2: design tokens, shared components, `src/app` shell with navigation config, phone bottom bar and drawer backdrop, 360 px fixes, `*Icon` names, unused logo removed, last TypeScript files converted, decision records 0005 and 0006

## Waiting on the owner

- [ ] Push `feature/stage-1-foundation` (Stages 1 and 2; all stages share this branch) and open the pull request; change the Vercel root directory to `frontend/` when it merges
- [ ] Approve the Stage 3 (intake slice) plan

## Next

- [ ] Stage 3, intake slice (planned, waiting for approval): `ProjectOneApi` on IndexedDB (`idb`), customers and projects with the stage tracker, upload of PI, PO and PrismSuite report (samples from extracted JSON, other files by manual entry), line review, classification and pairing, coverage check, module creation (modules start as awaiting delivery)

## Known follow-ups

- [ ] The owner supplied sample lookup tables (firewall, domain, NAS), a sample work schedule and a sample completion report; they are kept in the private samples folder for Stages 6, 7 and 10

- [ ] ESLint 10 once `eslint-plugin-react` and `eslint-plugin-jsx-a11y` support it
- [ ] `npm audit`: react-router 6 open redirect advisory (fix needs React Router 7, a major upgrade) and the esbuild dev-server advisory through Vite 5 (fix needs a newer Vite). Both need owner approval
- [ ] React Router future flag warnings (`v7_startTransition`, `v7_relativeSplatPath`) appear in tests; decide with the router upgrade
- [ ] On phones the checklist tables scroll sideways inside their cards; a stacked row layout belongs with the real checklist stage
- [ ] The overview topology diagram is small at 360 px; revisit with the dashboard work
- [ ] The spacing scale has a step for nearly every value in use; reducing it would change the look and needs an owner decision
