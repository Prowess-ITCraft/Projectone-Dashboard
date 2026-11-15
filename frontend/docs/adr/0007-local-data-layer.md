# 0007. A single data interface with a local adapter

Date: 2026-11-16
Status: Accepted

## Context

There is no backend yet, but intake needs customers, projects, documents, lines and modules that survive a reload, and uploaded files that can be viewed again. The screens must not need rewriting when the backend arrives.

## Decision

- **One seam.** Screens read and write only through the `ProjectOneApi` object (`src/data/api.jsx`: `useApi`, `useApiQuery`). They never touch storage, fixtures or the adapter directly. `useApiQuery` re-runs its loader after any write, so lists stay current without refresh callbacks.
- **Local adapter.** `src/data/local/localApi.js` implements the interface on a storage backend. It holds the intake rules for now (confirmations, reopening with a reason, duplicate documents, module creation) and is the part a backend replaces. Writes run one at a time.
- **Storage.** `idb` over IndexedDB in the browser (approved dependency), with a memory backend for tests and for browsers that block IndexedDB. The memory fallback is reported to the user: the projects page says data is kept for this visit only.
- **Money** is whole paise (integers), shown in Indian grouping. **Dates** are plain `YYYY-MM-DD` strings for document dates and UTC milliseconds for timestamps, shown in IST. **Identifiers** are random UUIDs for the system, plus readable numbers for people: `PRJ-<financial year>-<counter>` (financial year April to March) and `CUS-<counter>`.
- **Audit.** Every confirmation, reopening, classification change and document action is written to an append-only audit store with the acting role and name and the reason where one is required. The overview shows the latest entries.
- **Files.** Uploaded PDFs are stored as blobs with their SHA-256. The hash is how the known sample documents are recognised.
- **Sample data.** The repository is public, so only anonymised sample extractions are tracked (`src/data/fixtures`). When the private extractions exist in the repository's samples folder, the dev server reads those instead (matched by document type, never by file name). That read is behind `import.meta.env.DEV`, so no build contains private data.

## Consequences

- Data lives in one browser: not shared between people or devices, and lost if browser data is cleared. This is acceptable until the backend exists and is stated on the projects page when storage is unavailable.
- The adapter's rules are temporary and tested; moving them to the backend means porting the tests with them.
- Real PDF reading is not part of this change. A recognised sample loads its extraction; any other file opens the manual entry form. A parser sits behind the same interface later.
- A local `vite build` made with the private samples present is checked to contain none of them.
