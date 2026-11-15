# 0005. Design tokens and shared components

Date: 2026-11-15
Status: Accepted

## Context

The look lived in one 1,518-line stylesheet. Colours were already CSS variables, but font sizes, spacing and radii were hard-coded, and the file was built in three layers (a base look, then "charcoal and lime", then "glass") that overrode each other, so the value that actually applied was hard to find. Pages repeated the same card, table, badge and form markup.

## Decision

- **Tokens** live in `src/styles/tokens.css` as plain CSS variables: the two colour themes, a named type scale (`--fs-*`), weights, line heights, a spacing scale named by pixel size (`--space-*`) with layout roles (`--gutter`, `--card-pad-*`), radii (`--rad-*`), shadows, sizes, motion and stacking. No new library.
- **Tailwind** reads the same values through `@theme inline` in `src/styles/tailwind.css` (`text-ui`, `text-caption`, `rounded-nav` and others). `cn()` in `src/lib/utils.js` registers these names with tailwind-merge so a size is never mistaken for a colour.
- **Stylesheets** are split by job (`base`, `shell`, `components`, `pages`), and each selector now has one rule holding its final value instead of three layers of overrides.
- **Shared components** in `src/components/`, on our own styles with no new dependency: `Card`, `DataTable`, `StatusBadge` (shape plus tone), `EmptyState`, `LoadingState`, `ErrorState`, `Dialog` (with the `useModal` hook for Escape, focus trap, scroll lock and focus return), `FormField`, `PageHead`, `SegmentedControl`, `Icon`, `CountUp`, `Ring` and the charts.
- Icons use Phosphor's `*Icon` export names.

## Consequences

- Each screen was checked against Stage 1: full-page screenshots and a computed-style dump of every element, for six routes, both themes and three widths (1440, 860, 360). Above 860 px the only differences are invisible: pill radii of 99px are now 999px, and sub-pixel widths.
- Small values inside controls (1, 3, 5, 7, 9 and 11 px insets) stay literal; turning them into tokens would add names without adding meaning. Collapsing the spacing scale into fewer steps would change the look and needs an owner decision.
- `LoadingState`, `ErrorState` and `Dialog` are not used yet; they are ready for the data layer. "Reset all data" keeps the browser confirm, as the owner decided.
- The command search now uses `useModal`, so Tab stays inside it and focus returns to where it was opened from.
