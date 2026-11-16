# Stage 4: Customers, projects and the stage tracker

Status: rules and plan agreed with the owner on 17 Nov 2026. Not built yet. Building starts only when the owner says so.

Goal: a project exists, belongs to a customer, covers one or more of that customer's sites, and shows exactly where it stands. A returning customer is easy to find, with every order and project in one place.

## 1. Owner answers

| Question                       | Answer                                                                                                                                                                   |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| How a project relates to sites | A project can cover several sites                                                                                                                                        |
| Project status                 | In progress, on hold, cancelled, closed, set by a person                                                                                                                 |
| Projects list                  | Full set of columns and filters                                                                                                                                          |
| PrismSuite badge               | A customer audited through PrismSuite gets a small PrismSuite logo badge once a PrismSuite report is added for that company, to set it apart from customers who were not |

Answers already given earlier and still in force: a project is created by hand first and documents are added after; project numbers are `PRJ-<financial year>-<counter>` and customer numbers `CUS-<counter>`; a returning customer is matched by GSTIN first, then by name, and a person always confirms the match.

## 2. Rules

### Customers

1. A customer has a number, name, GSTIN (optional), address, contact person and contact email. No financial field of any kind.
2. A customer is never merged or replaced silently. A suggested match (same GSTIN, or a similar name) is only a suggestion that a person accepts or ignores.
3. A GSTIN, when given, must be in a valid format and must not belong to another customer. Two customers with the same GSTIN are refused, with the number of the customer that already has it.
4. Anyone allowed to create projects may edit customer details. Every change is recorded in the audit log with the values before and after. The name cannot be blank.
5. The issuer entities (ITCraft and its sister company) are never customers. Their names on an order are issuer fields, not customer records.

### Sites

6. A site belongs to one customer and has a name (required), an address and an optional contact.
7. Site names are unique within a customer, ignoring case and extra spaces, so "Tarapur" and " tarapur " count as one site.
8. A project covers one or more sites of its own customer. It cannot use another customer's site.
9. A project may be created before its sites are known. It then shows "No site chosen" with a prompt. Choosing sites never blocks a stage (that would be a new business rule, and none was given).
10. Sites can be added while creating a project or later from the customer page or the project overview. Every site added or changed is audited.
11. A site that a project uses cannot be deleted, only renamed or corrected. There is no delete for sites in this stage.
12. Planning (Stage 7) and the completion report (Stage 10) will have to split work by site. This stage stores which sites a project covers and does not decide how work is split.
13. Existing projects with a free-text location are moved across once: the text becomes a site of that customer (reusing a site with the same name), and the project covers it. Nothing is lost.

### Project status

14. A project's **stage** is always worked out from what people recorded. Its **status** says whether work is moving. The two are shown separately.
15. Statuses: In progress (the default), On hold, Cancelled, Closed.
16. Allowed changes:
    - In progress to On hold, Cancelled or Closed
    - On hold to In progress or Cancelled
    - Cancelled to In progress (reopening)
    - Closed is final
17. Only an Admin changes the status. Every change except closing needs a reason, recorded in the audit log with the name and time.
18. A project closes only when every stage is done. Until the later stages are built, that cannot happen, so no project can close in this stage.
19. While a project is on hold, cancelled or closed, nothing more can be recorded on it: no uploads, line edits, classifications, confirmations or delivery dates. The action explains why and gives the status reason. Whatever was already done stays done.
20. On the stage tracker, the stage the project stopped at shows as blocked, with the status and its reason. Earlier stages stay done and later stages stay locked.
21. A new permission action, `set_project_status`, is added for Admin only. The backend adds the same row with a new migration at B2.

### Projects list

22. Columns: project number, customer (with the PrismSuite badge), sites, entry path, current stage (with blocked or done marks), status, last activity.
23. Filters: search by project number, customer name or site name; entry path; current stage; status; customer.
24. Sort: last activity (the default, newest first) or date created.
25. Last activity is the time of the project's latest audit entry, or its creation time if nothing has happened since.
26. On phones (below 860 px) the list shows as stacked cards with no sideways scrolling, using the same fields.

### Customer page

27. A Customers list in the menu: number, name, GSTIN, number of sites, open projects (in progress or on hold) and total projects, PrismSuite badge, last activity. It is searchable by name, number or GSTIN.
28. A customer page with:
    - the details (editable)
    - sites (add and edit)
    - every project, with stage and status
    - every order document and PrismSuite report across all projects: type, number, date, project, and whether it is the active version or kept as history
    - the customer's activity
29. Customer and site changes appear in the customer activity. Project changes stay with the project.

### PrismSuite badge

30. The badge shows on a customer, and on each of its projects, once a PrismSuite report is attached to any project of that customer. Duplicates waiting for a decision and replaced versions do not count.
31. Nothing else sets it: not the entry path, and not a manual tick. Removing the only report removes the badge.
32. It is a text badge ("PrismSuite") until the owner supplies the logo file. The logo then replaces the text, keeping an accessible label "Audited through PrismSuite".

### Carried over from earlier stages

33. No financial data anywhere. Admin and Engineer roles, permissions as data, every check through `can()`.
34. Strict order on the tracker. A locked or blocked stage always says why.
35. No visual change to approved screens beyond what this stage adds. New screens use the shared components and the design tokens.
36. Real customer names, GSTINs and addresses never appear in tracked files. Tests and samples use invented values.

## 3. Plan

### Data (local adapter, stays behind `ProjectOneApi`)

- New store `sites`. The IndexedDB version goes from 2 to 3, and the upgrade adds the store **without wiping data**. The location-to-site move (rule 13) runs once in the adapter.
- Project fields: `siteIds` (list) replaces `location`; `status` and `statusReason` are added.
- New or changed methods:
  - `listCustomerSummaries()`
  - `getCustomer(id)`: customer, sites, projects, documents, audited flag, activity
  - `updateCustomer(id, patch, { actor })`
  - `addSite(customerId, site, { actor })`
  - `updateSite(siteId, patch, { actor })`
  - `createProject`: takes `siteIds` and `newSites` instead of `location`
  - `updateProject`: may change `siteIds`
  - `setProjectStatus(projectId, status, { actor, reason })`
  - Every project write method refuses while the project is not in progress (rule 19).
- The project snapshot gains `sites`, `status`, `lastActivityAt` and `audited`.
- Sample projects get one site, built from the anonymised bill-to address.

### Domain (pure rules, with tests)

- `projects.js`: statuses, allowed moves and the reason a move is refused, the "why is this locked" message, and site name comparison.
- `stages.js`: the tracker shows the status pause (rule 20).
- `customers.js`: the audited flag (rule 30).
- `permissions.js`: `set_project_status` for Admin.

### Screens

- **Menu and routes:** a new "Customers" area, plus routes `/customers` and `/customers/:id`, command search entries and page titles. Customers is not added to the phone bottom bar; it is reached through More.
- **New `features/customers` folder:** customers list, customer page, details card, sites card, PrismSuite badge.
- **Projects list:** the new columns, filters, sort, and phone cards.
- **New project:** a site picker (choose existing sites, or add new ones inline) replaces the location field.
- **Project overview:**
  - a status card (Admin actions with a reason dialog)
  - a sites card (choose or add)
  - the customer name links to the customer page
  - the badge
- **Project header:** status badge and PrismSuite badge.

### Tests

- **Domain:** status moves, closing only when every stage is done, the tracker pause, the audited flag, site name comparison.
- **Adapter:** GSTIN uniqueness on edit, site uniqueness, a project only using its own customer's sites, writes refused while on hold, status reasons in the audit log, the location-to-site move, last activity.
- **Screens:** customers list and page, editing details, adding a site, filters and sort on the projects list, phone cards, the status change flow as Admin and refused as Engineer, the badge appearing after a report is attached.

### Docs

- ADR 0011 (customers, sites and project status), plus updates to `OPEN_QUESTIONS.md`, `MEMORY.md` and `TASKS.md`.
- The backend plan notes the B2 migration for `set_project_status`, sites and project status.

### Risks and limits

- About 20 files change. The work goes in small steps by area: domain, data, customers screens, projects screens, app.
- Several sites per project makes planning and reports more complex later. This stage only stores the sites.
- The badge is text until the logo file arrives.

### Done when

- A customer can be found, opened and edited, with its sites, projects and documents on one page.
- A project can cover several sites and be filtered and sorted in the list.
- The status locks work with a reason, and only an Admin can change it.
- The badge appears only once a PrismSuite report is attached.
- Lint, format, typecheck, tests and build pass, and the screens are checked at 1440, 860 and 360 px in both themes.

## 4. Done before Stage 4

- The sign-in page was built first at the owner's request (ADR 0011).

## 5. Earlier note on the sign-in page

- **Sign-in page.** The owner shared two screenshots from another of the company's products: a two-column sign-in page and a stepped registration page. They want a similar sign-in page for Project One in Project One's own theme. It will be planned separately when the owner asks. Points to settle then:
  - Project One has no self-registration, because only an Admin creates users, so it likely needs a sign-in page only.
  - Real sign-in needs the backend (B10). Until then a sign-in page can only stand in for the development role picker.
