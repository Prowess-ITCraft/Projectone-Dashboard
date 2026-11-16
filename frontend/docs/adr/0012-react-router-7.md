# 0012. React Router 7

Date: 2026-11-17
Status: Accepted (owner approved the upgrade)

## Context

React Router 6 printed two future flag warnings in every test run and in the browser console, and `npm audit` reported two advisories for it (an open redirect through a backslash in links and navigation, and an issue in server-side hydration). Both are fixed only in React Router 7.

## Decision

- Upgrade `react-router-dom` from 6.30 to 7.18.5 (released 27 Oct 2026). The `react-router-dom` package name and every API the app uses (`HashRouter`, `MemoryRouter`, `Routes`, `Route`, `Link`, `NavLink`, `Navigate`, `useNavigate`, `useParams`, `useLocation`) are unchanged in version 7, so no application code changed.
- The behaviours the warnings announced are now the default: state updates wrapped in transitions, and relative paths inside splat routes resolving from the full match. The project pages use absolute links in the tab bar and relative links only inside non-splat child routes, so their targets are the same as before.

## Consequences

- No router warnings in tests or in the browser; the router advisories are gone from `npm audit`.
- Verified with the full check (lint, format, typecheck, 142 tests, build) and a headless browser run of the sign-in flow, every page at 1440, 860 and 360 px, project tabs, uploads and the duplicate flow.
- The remaining `npm audit` items are in development tools (Vite's dev server, the test runner) and are listed in `TASKS.md` for a separate decision.
