# 0013. Customers, sites and project status

Date: 2026-11-17
Status: Accepted (Stage 4, rules in `STAGE4_PLAN.md`)

## Context

A returning customer has to be easy to find with every order and project in one place. Customers can have several sites, and the owner decided a project can cover several of them. A project also needs a way to say that work is paused or stopped, separately from the stage it has reached.

## Decision

- **Customers** get a list (`/customers`) and a page (`/customers/:id`) with details, sites, projects, every order and report across those projects, and the customer's activity. Details are editable by anyone who may create projects (the existing `create_project` action), with the values before and after recorded. A GSTIN must be valid and may not belong to two customers.
- **Sites** are a new store. A site belongs to one customer and has a unique name within it, ignoring case and spaces. A project holds `siteIds` (zero or more of its own customer's sites). Sites can be added and corrected, never deleted. Choosing sites never blocks a stage.
- **Project status** (`in_progress`, `on_hold`, `cancelled`, `closed`) sits beside the stage. Only an Admin changes it, through a new `set_project_status` action, and every change except closing needs a reason. Closing needs every stage done, so it cannot happen until the later stages exist. While a project is not in progress, every write to it is refused with the reason, and the tracker shows the stage it stopped at as blocked.
- **PrismSuite badge**: shown on a customer and its projects once an active PrismSuite report is attached to any of its projects; a text badge until the logo file arrives.
- **Projects list**: columns for sites, status and last activity (the latest audit entry), filters for stage, status and customer, sorting by last activity or date created, and stacked cards with folded filters on phones. The filter and sort rules are pure functions in `src/domain/projectList.js`.
- **Storage**: IndexedDB version 3 adds the `sites` store without clearing anything. A one-time move turns any free-text project location into a site of its customer (reusing a site with the same name). Projects stored before this read as in progress with no sites.

## Hardening

- Creating a project runs every check (customer, GSTIN, email, chosen sites, new site names) before anything is saved, so a refused request never leaves a customer without a project.
- Lists and snapshots read each store once and build rows in memory. With 200 projects the projects list went from 5.5 s to 0.13 s.
- Routes load lazily, one file per page.

## Consequences

- The backend needs the same pieces at B2: a sites table, project status and reason columns, and a migration adding the `set_project_status` row for Admin.
- Planning (Stage 7) and the completion report (Stage 10) must decide how work is split across a project's sites.
- The PrismSuite logo replaces the text badge when supplied.
