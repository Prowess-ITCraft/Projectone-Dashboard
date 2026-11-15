# 0004. Lint, format, test and CI tooling

Date: 2026-11-15
Status: Accepted

## Context

The app had no linting, formatting, tests or continuous integration.

## Decision

- **Runtime:** Node 22 LTS and npm, pinned through `.nvmrc` and `engines`.
- **Lint:** ESLint 9 flat config with `@eslint/js` recommended, `eslint-plugin-react`, `eslint-plugin-react-hooks` and `eslint-plugin-jsx-a11y`; `typescript-eslint` strict for the TypeScript files; `no-console` is an error. ESLint 10 is current, but `eslint-plugin-react` and `eslint-plugin-jsx-a11y` do not support it yet. Upgrade when they do.
- **Format:** Prettier (single quotes, 140 columns, trailing commas), with `eslint-config-prettier` so the two do not overlap. The whole codebase was formatted once in its own change.
- **Tests:** Vitest 3 with jsdom and Testing Library. Vitest 4 and later need Vite 6, and upgrading Vite was out of scope.
- **CI:** one GitHub Actions workflow runs lint, format check, typecheck, tests and build for every pull request and every push to `main`.

## Consequences

- The 18 lint findings in the existing code were fixed without visible change: empty `catch` blocks now explain why the error is ignored, unescaped quotes use entities, the sidebar no longer sets state inside effects, the search dialog backdrop and ESC hint are real buttons, and the search field is focused through a ref instead of `autoFocus`.
- The search dialog is now mounted only while open, so each opening starts with an empty query.
