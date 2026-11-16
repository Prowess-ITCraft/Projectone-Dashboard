# 0010. Component pages read through the data layer

Date: 2026-11-16
Status: Accepted

## Context

The Overview, Components, component checklist and questionnaire screens kept their progress in a `localStorage` context store and read hard-coded arrays from `src/data.js`. Screens were meant to get all data through `ProjectOneApi`.

## Decision

- The catalogue (components, checklist templates, questionnaire definitions) moved to `src/data/fixtures/catalog.js` and is served by `api.getCatalog()`. It is reference data, and steps that did not come from the project plan stay labelled as demo.
- Checklist progress, questionnaire responses and the activity feed are stored in IndexedDB (store `checklist`) and changed with `setTaskProgress`, `addResponse`, `patchResponse` and `deleteResponse`. The rules for applying a change are pure functions in `src/domain/checklist.js`.
- `useChecklist()` in `src/data/checklist.jsx` applies the same pure rule to the screen at once and replaces it with the stored copy when the write ends, so ticking and typing never wait for storage. Pages show loading and error states.
- `src/store.jsx`, `src/data.js` and the `StoreProvider` were deleted. "Reset all data" now calls `api.resetAll` and is offered to an Admin only.

## Consequences

- No screen reads storage or fixtures directly any more.
- The checklist stage replaces the catalogue with versioned procedure data; the adapter methods stay as the seam.
- Status cycling, free order and missing evidence are still the old behaviour and are replaced in the execution stage, not here.
