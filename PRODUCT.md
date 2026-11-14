# Product

## What Project One is

An internal ITCraft (Prowess IT Craft Pvt Ltd) tool. It takes a confirmed customer order, a purchase order or proforma invoice, optionally with a PrismSuite audit report, and turns it into verified implementation work:

1. **Intake.** The order document is uploaded and read into order lines.
2. **Classify.** Each line is a product, a subscription or a service. Services are paired to their product and one module is created per product.
3. **Kick-off.** The team records the entry path (post-audit, new infrastructure, restructuring), the purpose and a short questionnaire.
4. **Lookup tables.** Per-module tables are completed in meetings with the customer outside Project One and uploaded finished. Planning stays locked until the mandatory fields are present.
5. **Planning.** A schedule is built, shared, corrected and accepted, then drawn as an implementation calendar.
6. **Execution.** Field engineers work through checklists generated from versioned procedures, in strict order, with photo and file evidence.
7. **Closure.** Per-product validation, a completion report, verification by a senior engineer or project lead, then customer sign-off.

Project One never chooses products, quotes or prices. The order is frozen when it arrives. The PrismSuite report is context only.

## Users

Intake coordinator, project lead, senior engineer, field engineer (phone first), Director, business development (read only on orders) and admin. The final role list and permissions are not decided yet.

## Principles

- Honest state: nothing is shown as done, verified or secure unless a person recorded it. Placeholder content is labelled as placeholder.
- Strict order: a later stage or task stays locked until the earlier one is recorded, and a locked item says why.
- Field engineers never see prices or bank details.
- Procedures are versioned data in the repository. Steps are never invented.

## Current state

The frontend is a React and Vite app that still runs on hard-coded demo data from an earlier client schedule. It is being rebuilt stage by stage into the flow above. There is no backend yet; the API will run on port 9666.

## Platform and brand

Web, responsive, with the field screens designed for Android phones at 360 px first. Product name ProjectOne. Dark and light themes, Urbanist typeface, Phosphor icons, lime accent on charcoal or light grey.
