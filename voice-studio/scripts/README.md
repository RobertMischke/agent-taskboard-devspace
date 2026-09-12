# Voice Studio command catalogue

Run these commands from the Voice Studio workspace. Node.js, Bash and .NET
requirements are in the [main README](../README.md). No command below runs merely
because Studio opens a page. No helper commits or deploys automatically.

| Command | Purpose and prerequisites | Writes / output |
| --- | --- | --- |
| `npm start` | Build and start the local Studio and example website | Generated builds and private local session state |
| `npm run pairing-code` | Recover the running installation's local pairing code | Prints the pairing code, never the bearer token |
| `npm run build` | Build library, Angular frontend and .NET backend | `dist/`, `bin/`, `obj/` |
| `npm run build:frontend:staged` | Build frontend without replacing currently served assets | `frontend/dist/voice-studio-next/` |
| `npm run frontend:publish-local` | Copy an already completed staged frontend, entry point last | Replaces the local served frontend; no backend restart or remote publication |
| `npm run website:build` | Build bilingual product pages, the library demo and styled HTML technical guides | `website/dist/voice/`; no deployment |
| `npm run website:preview` | Build and serve the public-site preview on loopback 5187 | Same static output and a local process |
| `npm run test:source-provenance -- --help` | Configurable source/hash/Git and optional task-provenance verification for a running local Studio | Compact report under ignored `test-results/`; no source-write/model request |
| `npm run docs:dossier:check -- --repository PATH` | Compare the maintained VL-W1 section with its standalone Voice Lint checkout | No writes; nonzero exit when synchronization is needed |
| `npm run docs:dossier:sync -- --repository PATH` | Synchronize maintained dossier content/presentation while preserving lifecycle fields | Explicit writes to that documentation checkout; no Git operation |
| `npm run test:dossier` | Verify the served dossier and desktop/mobile layout | `test-results/dossier-integration/`; no API mutation |
| `npm run test:evidence` | Check all curated evidence manifests, path containment and file hashes | Read-only; does not rerun historical tests |
| `npm run test:holistic-schema` | Validate the proposed JSON examples, references and hashes; reject malformed variants | Offline only; no repository/site review and no model |
| `npm run test:website` | Browser-check website routes, EN/DE, mobile layout and actual library demo | Ignored screenshots/report; requires the local website preview |
| `npm run test:library-types` | Compile isolated TS/JS consumers and check real IntelliSense completions/hover documentation | Offline package fixtures; no VS Code UI automation |
| `npm run test:session` | Backend browser trust, expiry, restart and revocation contracts | Isolated temporary session state; no live backend |
| `npm run test:session-ui` | Resume/401/race regressions in the actual UI methods | Fake HTTP only |
| `npm run test:browser-session` | Chrome close/reopen, reload, new tabs, logout and temporary sessions | Isolated browser profile and session trust; no project/source/model writes |
| `npm run test:selection-ui` | Deferred HTTP/state regressions for keep, alternatives, retries and cancellation | Fake HTTP only |
| `npm run test:selection-workflow` | Real browser source/keep/proposal workflow against its own temporary fixture | Registers and edits only its fixture, then unregisters/removes it; no model |
| `npm run test:navigation` | Language, compact/focus navigation and overlay browser scenarios | Browser-local preferences and ignored evidence; requires Studio and the configured pilot website |
| `npm run test:wiki-i18n` | Wiki translation coverage and source-quote preservation | Offline only |

Backend suites (`test:backend`, `test:runner`, `test:tasks`, `test:checks`,
`test:selection`, `test:session`) and library/UI suites verify their respective
contracts. Runner tests use fakes. Use an isolated .NET artifacts path when a
running API could otherwise lock its build files.

`session.mjs` is an internal helper that reads private session state; it is not
an evidence exporter. `publish-built-frontend.mjs` is a local deployment helper,
not the public ecosystem website deployer.

## Scoped scenarios and historical pilot tools

Existing `pilot-*.mjs`, `import-website-review.mjs` and
`reconcile-website-review.mjs` are scenario-specific workflows with their own
source/version assumptions. Some explicitly create tasks, invoke the configured
model or apply source proposals. They are not generic smoke checks; inspect the
script and the associated [review record](../docs/reviews/) before an authorized
run. Older `verify-*.mjs` files may target a recorded German pilot interface.
The current supported entry points are listed above and in `package.json`.

The former `verify-final-handoff.mjs` and `verify-dossier.mjs` embedded historical
counts, source commits and rollout assumptions. Their observations remain in the
curated verification record and local maintenance archive. Continuing dossier
verification uses the current maintained fragment and identity instead.

See [file ownership and retention](../docs/maintaining.md) for what belongs in Git,
what is generated, and how useful maintenance work becomes supported tooling.
