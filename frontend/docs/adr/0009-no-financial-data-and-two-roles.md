# 0009. No financial data, two roles, Admin decides duplicates

Date: 2026-11-16
Status: Accepted. Supersedes the money and role parts of 0007 and 0008.

## Context

The owner's second frontend prompt changed three rules. Project One holds no financial data. There are two roles for now, Admin and Engineer, and only an Admin creates users. When two versions of a document exist, the Admin compares them and decides.

## Decision

- **No financial data.** Rates, amounts, taxes, totals, payment terms, bank details, cost and margin are never read, stored or shown. The money module, the rate and amount fields, the totals form, the money validation and the financial permission were deleted. The document mapping ignores those fields even when a private extraction contains them. Tracked sample fixtures carry quantities and descriptions only. Uploads accept PDF, Word (.docx) and Excel (.xlsx) (owner instruction, 16 Nov 2026). Only PDFs can match a known sample; Word and Excel files are stored as the original and opened in manual entry, and their contents are never read, so a working file holding buying prices adds no financial data to Project One.
- **GSTIN stays.** It identifies a customer for matching and is not an amount. Bank details are never stored.
- **Two roles.** `ROLES` and `PERMISSIONS` in `src/domain/permissions.js` are data (role to actions); `can()` reads them. What the intake coordinator did is now Engineer, what the project lead did is now Admin. The matrix is a placeholder until the owner confirms it (see open questions). The acting-as picker is a development-only stand-in for sign-in.
- **Duplicates.** Only an Admin may decide, and every decision needs a reason that is stored in the audit log. An Engineer sees the comparison and a message that an Admin must decide.
- **Stored data.** The IndexedDB version went from 1 to 2 and an older database is emptied, because it held development and demo data with financial fields and the old roles. The old `localStorage` demo progress (`projectone.v4`) is discarded as well.

## Consequences

- Nothing in the tracked repository or the built app holds a price or a bank detail.
- Adding a role later is a new row in `PERMISSIONS`; no component changes.
- Anyone testing in a browser that held earlier data starts empty once.
