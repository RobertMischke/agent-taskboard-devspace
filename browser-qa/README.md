# Browser QA

Reusable headless browser checks for pages produced in this devspace (Dossiers, docs, website pages). They replace one-off `.<topic>-qa.mjs` scripts: a new check class goes into an existing script here or into a new script built on `lib.mjs`.

## Run

```sh
node browser-qa/dossier.mjs <path/to/docs/.../index.html>   # one Dossier page
node browser-qa/studio.mjs /workspace/settings/execution-hosts --scope app-remote-hosts-panel --wait-for app-remote-hosts-panel
                                                             # one Agent Studio view (Stable 4011)
node browser-qa/selftest.mjs                                 # after every change in this folder
```

Exit code 0 means no findings. Findings print as `FAIL ...` lines. Screenshots and `report.json` go to `artifacts/<check>/<name>/` (not committed).

## Checks

| Script | Checks |
|--------|--------|
| `dossier.mjs` | Desktop light and dark, phone width: horizontal overflow with the elements causing it (content inside any scroll or clip container is never blamed, whatever its class), explicit body background. Per SVG figure: text outside the viewBox, text overlapping text, text spilling out of its box or badge, a line or path running through text (strokes hidden behind a later filled rect are ignored). Screenshots per page and per figure. |
| `studio.mjs` | A running Agent Studio view by hash route (or a local HTML file), per `--viewport WxH[:dark]`, layout checks limited to `--scope`: visible text or controls overlapping, content spilling out of its box, a second scrollbar around a nested scroller with the element that escapes its clipping parent (e.g. an absolute sr-only caption), failed `/api/` calls (deduplicated) and page errors. `--wait-for`, `--click`, `--scroll-to` reach the state to check. Hash routes, boot-time tab restore and Git Bash path mangling are handled. |

## Base (`lib.mjs`)

- Playwright: `playwright-core` from `C:/Projects/quality-studio/frontend`.
- Browser: local Edge, fallback Chrome, always headless.
- `VIEWS`: 1280 light, 1280 dark, 390 light.
- `createReport`, `artifactDir`, `pageOverflow`: shared reporting and overflow detection.

## Rules for extending

1. Every new check class gets a defect in a fixture under `fixtures/` and an expected finding in `selftest.mjs`. A check that must stay silent in some case gets a `forbid` entry.
2. Run `selftest.mjs` and at least one real page before committing.
3. A finding that screenshot review catches but the scripts miss is a missing check class: add it here instead of fixing the page only.
4. Commit each extension on its own (one check class or one fix per commit).
