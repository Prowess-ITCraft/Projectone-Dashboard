# Open questions

Decisions the owner has not made. Each is built as data or behind an interface so the answer can be filled in later. Nothing here may be guessed in code.

## Roles and access

- Role matrix: Admin and Engineer permissions in `src/domain/permissions.js` keep the earlier behaviour (Engineer: create projects, upload, edit and classify lines, confirm classification; Admin: also confirm intake, reopen, record delivery, decide duplicates, reset data). Confirm or change.
- Who may open the original order files. They contain prices and bank details even though Project One stores none.
- Additional roles beyond Admin and Engineer, who approves what, and any limits.
- Sign-in method and two-factor rules. The acting-as picker is development only.

## Customers and projects

- Customer and site edits use the same permission as creating projects (Engineer and Admin). Confirm, or limit them to Admin.
- How work is split across a project's sites in planning and in the completion report.
- The PrismSuite logo file for the badge.

## Intake

- How AMC and service-only invoices enter Project One, and what module an AMC creates.
- Whether matching a returning customer by GSTIN stays (an identifier, not an amount).
- Where a document's confirmation type (call, mail, customer PO number) is stored and whether it is needed.
- Text recognition for scanned orders. A scan opens manual entry.
- The meaning of "AS" on the whiteboard (treated as access switch).

## Later stages

- Lookup tables: the NAS sheet records a data structure and a backup policy, while the prompt lists capacity, RAID, shares, antivirus and snapshot.
- Whether a serial number is required evidence for a task (a per-task flag read from procedure data).
- How customer sign-off is recorded without a customer login.
- Whether a completion certificate exists. The completion report layout waits for the owner's templates.
- The LLM provider for photo checks, and the rules for sending photos to it.
- Email or any other notification channel.
- The real kick-off questions and the list of senior approval points.
- Procedures for components other than server, domain controller, firewall, NAS and EPS.
- Backend hosting beyond local Docker Compose and Render for testing.
