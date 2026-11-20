# 0006. The engineer sees order lines and the checklist, and changes checklist progress only

Date: 2026-11-20
Status: Accepted. Narrows the engineer permissions of 0005.

## Decision

- **Permissions.** An engineer has three actions: `complete_step`, `upload_evidence`, `comment_step`. They no longer have `upload`, `edit_lines` or `classify`. Admin gains `manage_checklist` (every route that changes a checklist's structure or content). Migration 0005 rewrites the matrix.
- **The record store is Admin only.** `/store` reads and writes answer 403 to anyone without `view_all_projects`, because it carries documents, files, sites, modules and activity. An engineer's data comes from `GET /my/projects` and `GET /projects/{id}/work`, built field by field: project number, customer name, order lines (number, description, quantity, kind, module, pairing) and the checklist. Unassigned projects are 404 on every route.
- **Step states.** `pending` -> `awaiting_evidence` -> `complete`. Marking a step done moves it to awaiting evidence; a second `complete` call (the screen's Finish step button) completes it, and needs at least one evidence file. Unticking an awaiting step returns it to pending and deletes its evidence.
- **Order.** Steps run installation by position, then configuration by position. A step is locked until the one before it is complete; completing, adding evidence or commenting on a locked step is 409 `step_locked` with the reason.
- **Evidence.** JPG, PNG, HEIC and PDF, judged by the file's first bytes and its extension together (a PDF called `.jpg` is refused). 10 MB and 5 files per step, set by `EVIDENCE_MAX_MB` and `EVIDENCE_MAX_FILES`. Bytes are kept in `stored_files` (the existing file storage); `checklist_evidence` links them to the step with who uploaded and when. Evidence is removable only by its uploader while the step awaits evidence; on a complete step it is locked (403).
- **Comments** are added on any unlocked step, also a complete one, and are never edited or deleted. They never change a state.
- **Admin routes** (403 for an engineer): add, edit, reorder, delete, reset and force-complete a step, and CSV export (cells that start with a formula character are escaped). There is no screen for them yet.
- **Sample steps** exist only through `POST /dev/checklist-steps`, which is not mounted outside development. Tests create their own steps.

## Consequences

- The Admin screens keep using `/store`; an engineer using the old local-data paths gets 403 by design.
- Finish step is an extra tap compared with completing on upload; it is what lets an engineer replace a file before the step locks.
- Audit rows for checklist actions carry no `projectId` in their details, so they do not yet appear in the project activity feed.
