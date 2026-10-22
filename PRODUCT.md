# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack
React 18 + Vite, Framer Motion, React Router (hash routing), Phosphor icons. Plain CSS, no Tailwind. State in browser localStorage. (Existing codebase; stated by the user: "use Next.js or React".)

## Users
Primary: auditors who review the installation and reconfiguration status of a company's network and security infrastructure. Secondary: field engineers who work through the checklists and tick tasks complete. Demoed to investors. (Inferred from the user's brief.)

## Product Purpose
ProjectOne is an infrastructure audit hub. It tracks, per component (firewall, server, switch, router, NAS, SAN, access point, and 17 security/management products), the installation and configuration steps for two kinds of work: new installation and existing reconfiguration. A dashboard shows progress in numbers and graphs. Success: an auditor can open any component and see exactly which steps are done, when, and with what comments.

## Positioning
Not a generic monitoring dashboard: it is the audit trail of a rollout, driven by the project's own task schedule and the per-user policy look-up tables (firewall and server domain), turned into checklists and questionnaires.

## Operating Context
Client project: "Mitsu Chem Plast Limited" (named in the supplied schedule). Hardware named in the plan: Cisco Catalyst C1300-24T-4G managed switch, QNAP backup storage, Dell R740 server (Windows, VMs, Active Directory), SentinelOne EPS with XDR, Acronis on-demand DR. Policy data is captured in two look-up tables: Firewall (per user: department, IP, internet, bandwidth H/M/L, mail, Skype, YouTube, social, finance, govt, sports, downloads, SSL VPN) and Server Domain (per user: department, office/other apps, USB block, folder access, edit/read-only, mapped drive and printer).

## Capabilities and Constraints
- Every checklist task starts unchecked; only an engineer's tick marks it done. Dashboard shows 0% until then.
- Each component page has a work-type dropdown: New Installation / Existing Reconfiguration.
- Steps for the switch, QNAP/NAS, firewall (partly), server/AD, EPS with XDR and Phoenix ODR come from the supplied schedule; all other components use placeholder steps marked "demo".
- The component folder with real installation/configuration files was empty; real files are still to be supplied.
- Questionnaires (Server, Firewall) sit in their own sidebar group above Components, not inside component pages.
- No backend; data lives in the browser.

## Brand Commitments
Product name: ProjectOne. User asked for a SaaS look in the spirit of shadcn / 21st.dev, Phosphor icons (not Lucide), and a distinctive, non-default typeface.

## Evidence on Hand
The pasted task schedule (30 tasks) and the two look-up table column lists. No real customer data, metrics, screenshots or logos are on hand: threat counts, uptime and event series must not be shown as fact.

## Product Principles
1. Honest state: nothing is shown as done, secure or measured unless someone recorded it.
2. The checklist is the source of truth; every number on the dashboard derives from it.
3. An auditor should reach any component's steps in one click.
4. Mark placeholder content as placeholder.

## Accessibility & Inclusion
Keyboard-operable checkboxes, selects and tabs with visible focus; sufficient contrast; reduced-motion respected.
