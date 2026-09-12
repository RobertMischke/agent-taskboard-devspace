# Voice Studio

[Explore the AI writing research](http://127.0.0.1:5187/voice/research/):
practice articles, original studies, counter-strategies and existing libraries.
The native website area uses maintained [research records](website/research/README.md)
with methods, limits and links to the reusable pattern catalogue.

Voice Studio is the local review UI; `@voice/review` is its separately reusable,
framework-independent typed Library. Preview 0.3 opens a real local website or
supported source folder, preserves review decisions and prepares guarded source
changes. Register a Git checkout or an ordinary folder: basic file review does
not require Git.

The Library supplies annotations, native selection and an explicit live-page
bridge. It renders host-supplied findings; it does not run an analyzer or call a
model. `@voice/writing-rules` supplies editorial rules, local surface cues and prompt composition. Studio uses
Angular, a .NET 10 backend and shared UTF-16 transport contracts.

## Start

Requires Node.js 24, .NET SDK 10 and Bash (Git Bash on Windows). Semantic
Runner reviews also require Git to initialize their staged working directory.

```sh
cd C:/Projects/agent-taskboard-devspace/voice-studio
npm start
```

The launcher installs missing dependencies, builds the three parts and starts:

- **Studio:** http://127.0.0.1:5188 — enter the terminal's pairing code.
- **Real example website:** http://127.0.0.1:5189/index.html — also browsable independently.

If the startup code has scrolled out of the console, run `npm run pairing-code`
in another terminal in this workspace. It prints the current local pairing code,
never the bearer token.

Stop with Ctrl+C. If an older background instance remains, stop the exact PID
printed by that instance before restarting. A second instance cannot rotate the
active session's credentials. Credentials live in the current user's local
application-data directory; `.voice-studio/session-location.json` contains only
their path. The browser keeps its API token in memory. Pairing defaults to **Remember this browser for 7 days**: a private HttpOnly cookie resumes access after reload, reopening the browser or restarting the backend, on the same local origin. **Log out** revokes that browser’s access. See [browser sessions](docs/browser-session.md).

For frontend development, start the backend and use `npm start -w @voice/studio`
on port 4188. `npm run build` builds everything explicitly.

## Review choices and language

English is the default, with a saved German language option. Full, Compact and
Website focus navigation adapt the workspace to the available screen. Select a
passage to **Keep as written**, inspect an existing suggestion, or explicitly
generate one to three alternatives through a configured model route. Own feedback
and replacement text are optional. Choosing a suggestion prepares a source diff;
applying it remains separate. The source context shows file/version and optional
Git branch/commit; historical task edits are labeled as saved task evidence.

See [the control and provenance guide](docs/usability.md) for decisions, retries,
source changes and the embedded-browser diagnosis.

## Public website and technical documentation

Run `npm run website:preview` and open
[the local Voice website](http://127.0.0.1:5187/voice/).
The homepage gives Studio and the typed Library equal entry points, with an
actual local Studio screenshot and a complete typed mount/dispose example.
It explains both Git repositories and ordinary source folders.

Six product pages have English and German navigation and introductions; the
Research analysis is in English. Sixteen technical guides are
rendered as HTML from an explicit source catalogue, with code examples,
navigation, section links and optional source downloads. Guide bodies remain
English; the surrounding controls support EN/DE. Start with:

- [Technical docs](http://127.0.0.1:5187/voice/docs/)
- [Library types and IntelliSense](http://127.0.0.1:5187/voice/guides/library-types/)
- [Seven-day browser sessions](http://127.0.0.1:5187/voice/guides/session/)
- [Supported commands](http://127.0.0.1:5187/voice/guides/commands/)
- [AI findings and Library integration](http://127.0.0.1:5187/voice/guides/agent-integration/)

The [website and deployment guide](website/README.md) describes the allowlisted
static output for the ecosystem's `/voice/` path. It has not been published.
The local Studio application starts independently on port 5188.

The [Git workflow](docs/holistic-review.md) explains current source and review storage.
Internal [holistic-review](docs/plans/holistic-review.md) and
[AGT pipeline](docs/plans/agt-voice-pipeline.md) designs remain in the repository.

## Browse an Angular application

Use **Projects and files** to register the actual source folder. Enter the
application's existing local development URL in the Studio browser. It loads
the site's own styles, scripts and routes. The example site includes the review
bridge already; other applications enable it in developer mode.

The actual Agent Studio website is onboarded in the sibling repository:

```sh
cd ../agent-studio-for-software-website/04-angular-static-final
npm run start:voice
```

Register that folder in Voice Studio. Its `voice.config.json` supplies the local
URL, 27 route-to-content-file mappings and shared Angular component references.
The real app runs on http://127.0.0.1:4184/?voice-studio=1. A text proposal edits
the responsible TypeScript string literal, not a rendered copy. Its own Angular
rebuild renders the result. See the website's `VOICE-STUDIO.md` for opt-in setup.

Route/source integration is explicit. The AST adapter reads supported prose from
configured TypeScript files without evaluating application code. Dynamic strings,
imports, code and interpolated templates are excluded. Ambiguous DOM matches are
not silently mapped. Syntax checks do not replace the application's build/typecheck.

## Browse Markdown folders

Open **Voice Handbook · Markdown** or register another folder. Navigate through
subfolders and open a file. The example contains `guides/` and `checklists/`.
Rendered Markdown supports mapped prose, links, basic emphasis and visible excluded
code; this is a limited subset rather than full CommonMark.

## Review and fix

1. Browse the page or file, then select a mapped passage. The review panel opens.
2. Keep the passage as written or inspect an existing suggestion. Own feedback is optional.
3. Inspect a local rule or explicitly start a semantic review for the whole file.
4. Explicitly generate alternatives, write an optional replacement, or save a source task with its instruction and selected feedback.
5. Explicitly start the saved task. Its status and Runner history remain available.
6. Inspect the complete source diff and explicitly apply it.
7. Explicitly start the configured local project check and inspect its status, logs and exit code.
8. Verify the actual changed file and rendered page. Older source versions are rejected.

File reports cover all supported units in the file and list parser exclusions;
project reports aggregate the source inventory and deterministic findings. Tasks,
proposals, feedback and semantic run history persist in project `.voice-lint` metadata. Reopening a run checks source and component
context again. Cancelled, failed, interrupted and stale runs are distinct from success.
Malformed or incomplete model replies fail validation.

A task can prepare **1–50 non-overlapping supported text edits in one file** as
one reviewable proposal. The backend validates each original quote and preserves
the source format before showing the combined diff. Source version, feedback
revision and configured component-context hashes must still match at start,
proposal creation and apply. Multi-file or structural work needs a broader task.

A proposal becomes `ready`; it does not write source until you apply it. A
validated `already_satisfied` outcome without changes or open findings can close
the task with a reason. Missing facts or unsupported changes become `needs_review`,
with the unresolved reason retained. You can also make a separate, explained
manual decision to retain the source. A successful process alone is not a fix.

The project-check panel runs the host-configured command only on explicit start;
for the Angular pilot this is the existing `npm run check`. Results and bounded
logs persist with the checked source fingerprint; a later source change marks
the result `stale` while retaining its original outcome and exit code. Commands
come only from private host configuration outside the target repository. They
execute trusted project code with the host user's permissions, independently of
model runs. See [local project checks](backend/CHECKS.md) for setup and limits.

## AI writing anti-patterns and review prompts

The separate `@voice/writing-rules` package provides twenty contextual rules,
four task profiles, named anti-patterns with reader costs, English/German examples
and counter-prompts, and local pattern
matching for eight rules. `composeWritingReviewPrompt` prepares instructions;
`findWritingSignals` returns exact UTF-16 candidate spans and coverage.
Neither function calls a model, changes source or determines authorship.

`npm run build:writing-rules` builds the ESM package and declarations.
`npm run test:writing-rules` checks rules, composition, signals and consumers.
The [writing-patterns website](http://127.0.0.1:5187/voice/writing-patterns/)
uses the actual package for its local check and prompt composer. See the
[API guide](docs/writing-rules.md) and [AI-text research](docs/ai-text-signals.md).

Studio's existing backend continues to use its four local rules and configured
Runner prompts. It does not automatically load the new writing catalogue.
Hosts can integrate the package using the [AI findings workflow](docs/agent-integration.md).

## Rule wiki and language tooling

The four local advisory rules and their explanatory wiki use the shared
[`knowledge/rules.json`](knowledge/rules.json) catalogue. Each rule has its trigger,
context questions, counterexamples, next steps and limitations. A wordlist match
is not proof that a claim is false or a word should be deleted. Zero matches are
not an editorial pass.

LanguageTool, Vale, CSpell, Hunspell and textlint are **evaluated candidates**, not
installed Voice analyzers. Engine, dictionary, model and rule-package licenses
remain separate. See [language tooling](docs/language-tooling.md),
[third-party notices](THIRD_PARTY_NOTICES.md) and the
[604-entry resolved npm metadata inventory](docs/licenses/npm-inventory.json).
This inventory includes optional packages and is not a browser-shipping count or
a complete file-level license audit.

The real Agent Studio website has also received a complete editorial source
review: **27 routes, 30 content files, 36 exact-quote findings**. The
[report](docs/reviews/agent-studio-website-2026-09-06.md) and
[JSON findings](docs/reviews/agent-studio-website-2026-09-06.json) separate verified
contradictions, release-alignment questions, missing evidence and editorial
suggestions. Source hashes and literal anchors make them reviewable; the audit
itself did not change the website or start a model run.

## Verified real-website pilot

The [7 September pilot](docs/reviews/agent-studio-pilot-2026-09-07.md) records the actual six-edit homepage task, reviewed UI apply and live reload, the broader source revision, desktop/mobile browsing and the visible project check. The original audit above is retained as the pre-revision evidence. Screenshots and machine-readable results accompany the report; open release questions remain explicit follow-up tasks.

## Semantic review through the Coding-Agent-Runner

The implemented adapter uses the pinned `CodingAgentRunner` 0.7.0 NuGet package and
the operator's local CLI account. It stages the current file, mapped units,
feedback and bounded component context with **read-only permission and clean
context**. The model returns advisory structured findings. An explicitly started source
task can turn validated replacement suggestions into one combined proposal;
applying it remains a separate action through the backend proposal workflow.

No model is called when opening a page or saving ordinary feedback. The operator
starts a review explicitly in the review panel. Configure a compatible server
route before startup, for example the provisional host-policy baseline:

```sh
VOICE_REVIEW_CLI=codex VOICE_REVIEW_MODEL=gpt-5.6-sol \
VOICE_REVIEW_THINKING=medium npm start
```

This example is not a Voice benchmark winner. CLI/credential checks are bounded
and do not prove the provider will accept a model request. No route is configured
by default. Qualification, comparative benchmarks and Token Economy admission
remain planned. See [Runner integration](docs/runner-integration.md),
[model strategy](docs/model-strategy.md) and [the workflow](docs/workflow.md).

## Embed the JS library

`@voice/review` exports ESM, TypeScript declarations and a standalone browser bundle
at `packages/review/dist/voice-review.js`. It has no Angular runtime dependency and
has not been published to npm. Copy the bundle to development assets or consume
the package in a local workspace.

```js
import { mountVoiceReview, connectVoiceStudio } from '@voice/review';

// On a local site opened inside the Studio:
const bridge = connectVoiceStudio({studioOrigin: 'http://127.0.0.1:5188'});
// On app destruction:
bridge.dispose();
```

Hosts can use `mountVoiceReview` directly with their own units, findings and
persistence callbacks. See [the full library guide](packages/review/README.md),
[the bridge protocol](packages/review/LIVE-BRIDGE.md) and
[the plain HTML example](http://127.0.0.1:5188/examples/library-embed/index.html).

The package exports public types including `SourceSpan`, `TextUnit`,
`Finding` and `VoiceReviewController`, with JSDoc for editor help.
TypeScript and JavaScript with `// @ts-check` infer callback arguments and
controller methods. A type-only reference also describes the classic browser
global. See [typed integration](docs/library-types.md) and the shipped
[TS](packages/review/examples/typescript.ts),
[JS](packages/review/examples/javascript.js) and
[standalone](packages/review/examples/standalone.js) examples.

`npm run test:library-types` verifies isolated consumers using only
distributable files. NodeNext and Bundler compile positive and expected-error
fixtures; the actual TypeScript language service supplies checked completions,
signatures and JSDoc hover text. This does not automate the VS Code interface.

Live review is restricted to the explicitly configured loopback development
origin. Studio tokens never cross into the page. Browser frame restrictions still
apply: configure the local app to allow its development Studio parent, or browse
in a separate tab. No remote proxy, browser extension or copied page is substituted.

## Examples and checks

The Quality Studio example has eleven editable HTML pages: product, workflow,
team guidance, review guide, FAQ, contact, local-example imprint, privacy and
English content. Native scripts implement a saved checklist and a local-only
form. It contains no invented business identity or public service guarantee.

```sh
npm run test:library
npm run test:library-types
npm run test:session
npm run test:session-ui
npm run test:backend
npm run test:runner
dotnet run --project backend/VoiceStudio.TaskTests
npm run test:checks
npm run test:ui-state
# Start Studio and the onboarded Agent Studio dev server, then:
npm run test:api
npm run test:browser-session
npm run test:e2e
node scripts/verify-running.mjs
```

Runner tests use fake streams and make no model calls. Project-check tests use
fake processes and tiny isolated process fixtures; they do not build the target
website or invoke a model. Browser tests use installed
Chrome. The source-edit test creates its own local website/server and unregisters
it afterward; it does not alter the Agent Studio website's copy. Screenshots and
test runtime data are ignored. `node scripts/cleanup-verification.mjs` unregisters
the separate API fixture while retaining its evidence.

Current verification evidence is recorded in the [Voice Lint dossier](http://localhost:4011/#/projects/voice-lint/workbenches/voice-concept-revision).
The [dossier integration](docs/integrations/voice-lint/README.md) maintains its marked section through explicit, configurable synchronization commands.

## Maintained files and reusable tools

See [file ownership and evidence retention](docs/maintaining.md), the
[command catalogue](scripts/README.md), and the curated
[12 September verification record](docs/verification/2026-09-12/README.md).
Reusable code belongs to the product or supported scripts; dated reports are
evidence, and one-off maintenance patches remain in an ignored local archive.

| Folder | Role |
|---|---|
| `frontend/` | Angular Studio, real website browser, folder navigation, reports and review |
| `backend/` | Local projects, source adapters, persistence, guarded edits and Runner tasks |
| `packages/review/` | Framework-independent annotations, selection and local-site bridge |
| `packages/writing-rules/` | Versioned writing rules, task profiles, prompt composition and surface signals |
| `packages/contracts/` | Shared transport contracts; explicitly UTF-16 source coordinates |
| `examples/` | Website, Markdown and standalone library projects |
| `knowledge/` | Shared local-rule definitions and explanatory wiki articles |
| `docs/reviews/` | Reviewable website findings, evidence and source coverage |
