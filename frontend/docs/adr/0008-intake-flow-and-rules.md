# 0008. Intake flow, classification rules and roles

Date: 2026-11-16
Status: Accepted. The money, validation and role rules are superseded by 0009.

## Context

An order document has to become a reviewed, classified set of lines and one module per product, with a person confirming each step. The rules come from the context pack (workflow, intake and parsing) and the owner's answers; some had to be adjusted to reproduce the sample documents.

## Decision

- **Flow.** Create a project (customer, entry path, purpose), add documents, review lines, confirm intake (project lead), classify, confirm classification (creates modules). Stages are strict: each unlocks only when the one before it is recorded done. Stages after classification are shown locked and marked as coming later.
- **Entry path is required.** Until it is chosen, the first stage is blocked with that reason.
- **Documents.** PDF only, up to 25 MB, original kept and viewable beside the lines. Known samples are recognised by hash and load their extraction; anything else opens manual entry (header, bill-to, lines, totals). A PrismSuite report needs only a customer, date and recommendations typed one per line.
- **Duplicates.** The same document number (or the same file) is held for a decision and shown side by side. Replacing keeps the earlier document as history and resets confirmations; a number used in another project can only be cancelled.
- **Validation** (totals, GST at 18 percent within a rupee, quantity times rate, expired proforma, GSTIN format) only ever warns; nothing blocks. Findings that quote money are shown only to roles that may see money.
- **Classification rules are data**, seeded into storage so an Admin screen can edit them later. Order: service words, then hardware models, then subscription words. This differs from the written list in one way: hardware comes before subscription, and a few patterns were added (for example "N users / N years"), so a firewall sold with a multi-year protection plan stays a product and a per-user multi-year licence is a subscription. A service pairs to the nearest earlier product of the same module type, or by brand; a service that names no product is left unpaired with a suggestion, and a person decides. A line no rule recognises is unknown and blocks classification.
- **Modules.** One per product or subscription, typed by keyword (including an access switch type). A module with no documented procedure is created and marked procedure pending. Modules start as awaiting delivery, with a delivered date the project lead records. Setup bullets are kept as the module's scope. Support lines become entitlements that start at sign-off; they are stored but have no screen yet.
- **Coverage check** compares a report's recommendations with the order: recommended and not ordered, ordered and not recommended, covered, and other actions. Information only.
- **Temporary roles.** An "acting as" picker (intake coordinator or project lead) stands in for sign-in. All checks go through one `can()` helper. Only the project lead sees money, confirms intake and reopens a confirmed review; every confirmation and manual classification records the role, name and reason.

## Consequences

- The rules reproduce the sample documents (tests compare them with the sample extractions), with one deliberate exception: a service line that names no product stays for a person to place.
- Reopening a confirmed review removes the modules created from it, so delivery dates recorded on them are lost; the reopen dialog says so and asks for a reason.
- When roles are decided, `can()` and the role list are the only places that change.
