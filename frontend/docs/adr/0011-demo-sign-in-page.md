# 0011. Demo sign-in page

Date: 2026-11-17
Status: Superseded by 0014 (real sign-in)

## Context

The owner wanted a sign-in page for Project One in its own theme, inspired by the two-column sign-in page of another company product: a form on the left and an animated, step-by-step panel on the right. Real accounts need the backend (stage B10), which does not exist yet.

## Decision

- The whole app sits behind `/login`. A signed-out visit is sent there and returns to the page it was headed for after signing in.
- One demo account (`itcraft@test.com`, `TestPassword`) is checked in the browser and signs in as an Admin named ITCraft. The session is kept in this browser until Sign out (in the sidebar). This is a gate for trying the app, not security: anything shipped to a browser can be read.
- The page shows a small demo access box with a button that fills both fields. There is no registration: only an Admin creates users, so the page says "No account? Ask your Admin."
- The right-hand panel walks through four Project One steps (order read, planned, built in order, signed off). One step lights up at a time, the list rests on all done, then starts again. With reduced motion turned on, every step shows as done and nothing moves.
- Built only from the existing design tokens, components, logo and typeface, in both themes. Below 860 px the steps move under the form.
- The acting-as role switch stays as a development tool.

## Consequences

- The demo account, the browser-side check and the demo box are removed when real sign-in arrives at B10.
- The page was not checked in a browser when it was built (the browser tool was not connected); the owner checks it on the dev server.
