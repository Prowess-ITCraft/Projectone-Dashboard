# Tasks

## Done

- [x] Stage 0: orientation, dashboard inventory, gap report
- [x] Stage 1: move into `frontend/`, Node 22 pin, dev port 9555, Docker Compose, ESLint, Prettier, Vitest, GitHub Actions, README and PRODUCT rewrite, decision records 0001 to 0004

## Waiting on the owner

- [ ] Review and commit the Stage 1 changes, open the pull request
- [ ] Change the Vercel project's root directory to `frontend/` when Stage 1 merges
- [ ] Approve Stage 1 so Stage 2 can start

## Next

- [ ] Stage 2: design system and shell (tokens, shared components, responsive shell at 360 px, navigation for the new areas)
- [ ] Stage 3: data layer (domain shapes, `ProjectOneApi`, local IndexedDB adapter, seed data)

## Known follow-ups

- [ ] ESLint 10 once `eslint-plugin-react` and `eslint-plugin-jsx-a11y` support it
- [ ] `npm audit`: react-router 6 open redirect advisory (fix needs React Router 7, a major upgrade) and the esbuild dev-server advisory through Vite 5 (fix needs a newer Vite). Both need owner approval
- [ ] React Router future flag warnings (`v7_startTransition`, `v7_relativeSplatPath`) appear in tests; decide with the router upgrade
- [ ] `src/assets/projectone-logo.jpeg` is unused; remove in Stage 2
- [ ] Phosphor icon imports use names the library has marked deprecated in favour of the `*Icon` suffix; switch during Stage 2
