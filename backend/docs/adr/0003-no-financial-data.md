# 0003. No financial data in the schema or the API

Date: 2026-11-16
Status: Accepted

## Context

The owner decided Project One holds no financial data (frontend ADR 0009). Order documents still contain prices, tax, totals and bank details, and Excel working files can hold buying prices and margin.

## Decision

- No table, column, request field, response field, parameter or path segment has a financial meaning. There is nothing to mask because nothing is stored.
- Two tests guard it: one scans the OpenAPI document in every environment, the other scans every table and column. Both split names into words (snake case, kebab case and camel case) and fail on a deny list (rate, amount, price, tax, GST, total, payment, bank, cost, margin and their plurals, subtotal, grand). Counts are therefore named `count`, never `total`.
- No permission action is financial; a test checks that too.
- Later stages: PDF readers drop financial fields before anything is written, and Word and Excel files are stored as originals and never parsed.

## Consequences

- A financial field fails CI before any screen could show it.
- A word on the deny list cannot be used for a non-financial meaning either; that is an accepted cost.
