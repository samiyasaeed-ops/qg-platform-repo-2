# Q&G Platform · Alfred Holdings

One platform for the Quality & Governance team across InsuranceMarket.ae, CreditMarket.ae and HolidayMarket.ae. It brings complaints and customer experience management, QA call and email evaluations, governance registers, rewards and recognition, the staff list, SOPs and the regulations library into one place, with venture-by-venture access and branding.

**Live platform:** https://claude.ai/artifact/3JpHmzmenm6BBrDTbEF4VS (version 3.2.1)

## Important: how it runs today

The platform is a single HTML page hosted as a claude.ai artifact. It depends on services the claude.ai runtime provides:

| Service | Used for |
|---|---|
| Shared database (`window.claude.db`) | Every case, record, setting, playbook and log |
| Sign-in (`user`) | Who is using it; roles and venture access |
| Gmail connector (`mcp`) | Stage emails, reminders and escalations |
| Google Drive connector (`mcp`) | Daily Excel backups |
| Asset storage (`assets`) | Case documents, journey test screenshots, uploaded sheets |
| Downloads (`downloads`) | Excel exports and templates |

`docs/capabilities.json` is the exact declaration the live page is published with.

**Opening `dist/qg-platform.html` from GitHub Pages or any other web server will not work.** The page loads, but with no data, saving, sign-in or email. Hosting it independently means replacing each service above with your own: a database, company single sign-on, an email-sending service and file storage, plus migrating the live data.

## Repository layout

```
src/                 Platform source, concatenated in the order set in tools/build.py
  shell.html         Page shell and styles
  core.js            State, Dubai-time and working-hours helpers, email, errors, audit
  cx.js, cx2.js      Customer experience journey, taxonomy, routing, automation, reports
  staff.js, staff2.js  Staff list, teams, bulk add and duplicate checks
  reg.js             Registers, journey routing and retest, files, playbooks, SOPs
  work.js            My cockpit, team workload, tasks, open questions
  lib.js, lists.js   Ventures, theming, regulations, guide, recycle bin, dropdown lists
  perf.js            Turnaround targets, time limit alerts, performance
  io.js, imp.js      Backups, uploads with column matching and raw-row retention
  rr.js              Rewards and recognition programmes
  main.js            Navigation, home, administration, boot
vendor/original/     The two original tools, embedded and patched at build time
  alfred-care-cem.html     Alfred Care: Customer Experience Management
  alfred-qa-portal.html    Alfred QA Multi-Venture Portal
tools/
  patch.py           Patches the original tools (platform bridge, timing capture, rules)
  build.py           Builds dist/qg-platform.html
dist/
  qg-platform.html   The built page, identical to the live version
docs/
  capabilities.json  Runtime capabilities the live page declares
test/                End-to-end tests with a simulated runtime and synthetic data
```

## Build

```
python3 tools/build.py
```

## Test

```
npm install
npx playwright install chromium
npm test
```

The tests run the built page against a simulated runtime (`test/mock.js`) with synthetic data (`test/seed*.js`). All addresses use example.com; no live data is in this repository.

## Publishing a new version

Publishing to claude.ai is done from a Claude session that has access to the artifact. It republishes `dist/qg-platform.html` to the artifact link above with the capabilities in `docs/capabilities.json`.

## Data rules built into the platform

- Customer details are never stored: a case uses only a mobile number or a deal reference as the customer key.
- Records are never merged across ventures; each venture is auditable on its own.
- Nothing is permanently deleted. Deleted items go to the Recycle bin with a reason, and only the administrator restores them.
- Uploaded data keeps each original row, without columns marked as customer details.
- All times are Dubai time (UTC+4). Turnaround counts working hours, 08:00 to 18:00, Monday to Friday.
