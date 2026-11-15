# 0002. Stay on JavaScript with React and Vite

Date: 2026-11-15
Status: Accepted

## Context

The restructure plan proposed converting the app to TypeScript in strict mode. The owner decided to keep the current stack, React and Vite in JavaScript, with no framework or language change.

## Decision

- Application code stays in `.jsx` and `.js`. New files follow the same convention.
- The two files that are already TypeScript (`src/components/ui/dashboard-sidebar.tsx`, `src/lib/utils.ts`) stay as they are. `typescript` remains a dev dependency only to type check them (`npm run typecheck`), and typescript-eslint lints only those files.
- Correctness is carried by ESLint, tests and, where a shape matters (domain types, the data layer interface), JSDoc type annotations.

## Consequences

- The strict TypeScript rules in the original plan (no `any`, no non-null assertions) apply only to the two TypeScript files.
- Domain types from the data model will be documented with JSDoc `@typedef` instead of TypeScript types. If this proves too weak for the data layer in Stage 3, the decision can be revisited with the owner.
