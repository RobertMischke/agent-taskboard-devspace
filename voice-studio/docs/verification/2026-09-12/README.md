# Historical verification — 12 September 2026

This is a curated review record for Voice Studio Preview 0.3 and the local Voice website. It keeps useful evidence in Git alongside the documentation. It is not runtime product data, an executable test suite, a release certificate, or the current state of a running service.

The checks and screenshots were produced during work on **12 September 2026**. Curation copies and reduces those existing records; **no checks, browser workflows, services, or models were run to create this catalogue**. The manifest records curation time separately from capture time. If the original report has no timestamp, capture time is left unknown: a file modification timestamp is supporting metadata, not a substituted execution timestamp.

## Retained records

| Record | What it establishes | Limit |
| --- | --- | --- |
| [Baseline checks](reports/baseline-checks.json) | Earlier recorded library, backend, runner, task, project-check and UI-state counts: 245 in total, plus builds. | Does not aggregate all later changes; the original report explicitly says browser E2E and website checks were not rerun at that stage. |
| [Managed startup](reports/app-startup.json) | Local Studio startup, successful pairing and 56 mapped text units at its capture time. | No proof of current availability, session duration, or VS Code embedded-browser behavior. |
| [Language and navigation](reports/navigation-language.json) | English default, DE/EN switching without changing website text, compact/focus layouts, overlays and saved UI preferences. | UI preferences are not browser authentication. |
| [Source provenance](reports/source-provenance.json) | Exact source hash, historical Git observation, and difference between saved task version and open source version. | The observed main/160f77a9 revision is historical; it is not a current Git promise or the public website revision. |
| [Voice website](reports/voice-website.json) | 20 local route/language/viewport observations, actual library demo and English no-JavaScript fallback. | Does not prove public deployment, comprehensive SEO, or a holistic evaluator implementation. |
| [Dossier handoff](reports/dossier-handoff.json) | Historical VL-W1 state and desktop/mobile widths used for the local handoff. | Lifecycle and publication values describe that capture, not the present state. |
| [Selection workflow visual](reports/selection-workflow-visual.json) | The saved keep-as-written UI stage in an isolated fixture. | Screenshot evidence only; no complete-run result log was retained for later workflow stages. |

The source-provenance report observed the selected file as clean while the surrounding repository had local changes. Those are different scopes. A saved task diff also has its own earlier source hash: it must not be presented as the current Git diff.

## Screenshots

Only three nonredundant screenshots are retained. They were visually checked for credentials and absolute host paths before copying. They show the old UI and can be reused in historical design discussions; they should not silently become current product screenshots.

- [Mobile navigation overlay](screenshots/focus-navigation-mobile.png) — website-focus controls and navigation panel at 390 px.
- [Mobile Library demo](screenshots/library-demo-mobile.png) — German documentation and the real bundled review library.
- [Persisted keep decision](screenshots/selection-keep-persisted.png) — English isolated selection fixture with optional inputs.

The Git status shown in the navigation screenshot belongs to its own capture. It can differ from a later source-provenance capture on the same day.

## Reproduce behavior with maintained tools

Run maintained scripts from the Voice Studio repository root. Do not replay the old one-off migration scripts or overwrite this curated historical folder. New runs belong in ignored local output directories; review and curate a new dated record when evidence needs to be shared.

| Behavior | Maintained command / entry point | Prerequisites and effects |
| --- | --- | --- |
| Unit-level selection contract | `npm run test:selection` and `npm run test:selection-ui` | Test backend uses fake runner behavior; these are not paid model qualification. |
| Library and existing baseline suites | `npm run test:library`, `test:backend`, `test:runner`, `test:tasks`, `test:checks`, `test:ui-state` | Counts may evolve. Run appropriate suites, rather than expecting the historical total. |
| Selection workflow | `node scripts/verify-selection-workflow.mjs` | Running local Studio, installed Chrome and Playwright. The script registers its own temporary fixture, writes only that fixture, blocks model/task starts and cleans up its own registration. |
| Language and navigation | `node scripts/verify-navigation-language.mjs` | Running Studio plus the configured local website fixture. This script was initially tied to the captured project fixture; inspect its current configuration before running elsewhere. It checks saved language/display preferences, not session lifetime. |
| Voice website | `npm run website:preview`, then `node scripts/verify-website.mjs` | Local preview at the script's configured loopback address, installed Chrome and Playwright. No public deployment or inference. |
| Current source provenance | [Source-provenance verifier](../../../scripts/verify-source-provenance.mjs) | Use the maintained configurable verifier and its documented options. Current data belongs in a new report, never this historical observation. |
| Embedded library geometry | `node scripts/verify-live-embedding.mjs` | Controlled browser embedding test; a passing simulated embedding is not proof about the actual VS Code embedded browser. |

Session credentials stay in the local runtime store. None are included here. Source-project data and decisions must continue to go through supported backend operations; these documents are not an alternate metadata store.

## What was deliberately omitted

- Pairing screenshots, pairing-code recovery output, session pointers, bearer tokens and private registry snapshots.
- Absolute computer paths, opaque project/task/run identifiers, complete source-context UI dumps and raw saved user instructions.
- Repeated desktop/mobile screenshots where one representative capture explains the behavior.
- Temporary patch, localization, restart, inspection and dossier-migration scripts. They are maintenance history, not supported product entry points.
- Unrelated earlier website revision captures. This catalogue does not import the September 6–7 review history or reinterpret it as new verification.

The original logical source paths in the manifest are provenance labels, not public links and not promises that temporary files remain in place. Operational scratch data stays outside this versioned record. One-off originals are retained locally under voice-studio/.local/maintenance-archive/2026-09-12/readiness-session/. That ignored archive is not a portable documentation dependency.

## Integrity and reuse

[manifest.json](manifest.json) allowlists the retained files, their byte sizes and SHA-256 hashes, original logical source names, original file modification timestamps, and available capture timestamps. Original-file hashes link reduced reports to their local source records without publishing those source records. PNG files are unchanged copies; JSON files are deliberate reductions.

The manifest covers this README, seven reports and three screenshots. It excludes itself to avoid a circular hash. Verify each listed path's byte count and SHA-256 before relying on a copied catalogue. Hash agreement establishes file identity, not test correctness or release readiness. When quoting a result, retain its date, scope and limitation.
