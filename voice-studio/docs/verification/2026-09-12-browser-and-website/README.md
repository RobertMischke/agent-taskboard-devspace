# Browser access, typed Library and HTML website verification

This is a separate follow-up record from 12 September 2026. It does not overwrite
the earlier [readiness evidence](../2026-09-12/README.md). These are local checks,
not publication, hosted-login, cross-browser or model-quality qualification.

## Expanded website run

The actual Chrome run captured at **2026-09-12T10:46:51.627Z** passed **84** combinations:
21 routes × English/German controls × 1440/390 px. It checked **168** local links,
assets and fragments, complete HTML guides, equal-width UI/code panels, image
loading, code copy (Windows newline normalization), the real Library's selection
and marks, saved language and English content/navigation without JavaScript.
There were no browser exceptions or model calls. Obsolete output was absent.

[website.json](website.json) retains the actual run report, Git observation and
build-input hashes. The build time is distinct from browser capture time. The
build had uncommitted local changes; a Git commit alone cannot reproduce that
working copy. The input hashes identify the content used for the run.

The current product screenshot is a maintained resource at
website/assets/studio-review.png, with capture metadata beside it. It shows
the real Studio reviewing the restored Agent Studio headline. The website report
hashes the exact image used. Local desktop/mobile captures remain regenerable
test output; the product image is not duplicated into this evidence directory.

## Other executed checks in this session

- 23 Library tests passed, including isolated TS/checkJs/standalone consumers,
  NodeNext and Bundler resolution, actual Language Service completions and JSDoc
  hover information, source mapping, bridge handling and controller lifecycle.
- 34 backend session assertions, 16 UI-state checks and 18 real Chrome browser
  checks passed. The Chrome scenario used an isolated profile and a real full
  close/reopen, reload, new tab, logout, origin rejection and temporary mode.
  The backend suite covers absolute seven-day expiry and restart persistence.
- The retained earlier evidence hashes passed; two holistic schema examples
  passed and 11 malformed variants were rejected.
- After the later website override, the existing website TypeScript check passed
  for the restored three hero fields; the live page reflected them through HMR.

Those suite results were observed during this work session. Their exact execution
timestamps and full console logs are not retained here, so the website capture
timestamp must not be read as their execution time. None called a model.

Use the maintained [command catalogue](../../../scripts/README.md) to rerun a
scope deliberately; new output belongs in ignored test-results/. This record
does not establish that the broader Voice Lint analyzer/CLI/CI, holistic evaluator
or proposed AGT pipeline executor is implemented.
