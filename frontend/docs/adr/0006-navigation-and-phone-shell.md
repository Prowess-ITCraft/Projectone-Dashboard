# 0006. Navigation config and the phone shell

Date: 2026-11-15
Status: Accepted

## Context

The product will have seven areas (Dashboard, Projects, My tasks, Approvals, Records, Guides, Admin), but only the Dashboard exists. Field engineers use Android phones with Chrome at 360 px. Below 860 px the sidebar became an overlay with no backdrop, so tapping outside it did nothing.

## Decision

- **One navigation config** in `src/app/navigation.js` lists all seven areas. Each has a `built` flag, and an area appears in the menu only once its screens exist, so nothing leads to an empty page. Today only Dashboard is built.
- **Questionnaire and Components** stay in the menu as the current screens until Stage 4 moves them inside a project.
- **Phones (860 px and below)** get a floating bottom bar with Dashboard, Projects, My tasks and More. Tabs show only for built areas, so today the bar is Dashboard and More. More opens the full menu in the drawer.
- The drawer has a backdrop; tapping it or pressing Escape closes it, and picking a page closes it. While closed, the sidebar is `inert`, so its links cannot be reached with Tab.
- The breakpoint is `NAV_BREAKPOINT` (860) in `navigation.js`, matched by the 860px media queries; the shell reads it through `useMediaQuery`.

## Consequences

- Making an area visible is a one-line change (`built: true`), covered by tests.
- Page content on phones has extra bottom padding (bar height plus the device's safe area) so the bar never covers the last row.
- Fixes made at 360 px, each approved as phone-only changes: the questionnaire form grid no longer clips its inputs (it needed 260 px inside a 256 px card); the checklist's work type picker takes its own row instead of overflowing; card headers wrap their hint and actions under the title.
