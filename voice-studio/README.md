# Voice Studio

Preview 0.3: browse a **real local website** or a **Markdown folder**, mark text,
save feedback, and turn it into a durable source task. Run a semantic review or
explicitly start the task through the Coding-Agent-Runner, then inspect the full
source diff before changing the original file. An explanatory rule wiki shares
the local checker’s catalogue. Angular frontend, .NET 10 backend
and the separately reusable JavaScript library `@voice/review`.

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

Stop with Ctrl+C. If an older background instance remains, stop the exact PID
printed by that instance before restarting. A second instance cannot rotate the
active session's credentials. Credentials live in the current user's local
application-data directory; `.voice-studio/session-location.json` contains only
their path. The browser keeps its token in memory and requires pairing after reload.

For frontend development, start the backend and use `npm start -w @voice/studio`
on port 4188. `npm run build` builds everything explicitly.

## Browse an Angular application

Use **Projekte und Dateien** to register the actual source folder. Enter the
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
2. Save feedback. Dotted underlines distinguish human notes from supplied findings.
3. Inspect a local rule or explicitly start a semantic review for the whole file.
4. Write a replacement, or save a source task with its instruction and selected feedback.
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
[603-entry resolved npm metadata inventory](docs/licenses/npm-inventory.json).
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
npm run test:backend
npm run test:runner
dotnet run --project backend/VoiceStudio.TaskTests
npm run test:checks
npm run test:ui-state
# Start Studio and the onboarded Agent Studio dev server, then:
npm run test:api
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
`scripts/update-dossier.mjs` maintains its current section in `C:/Projects/voice-lint`.

| Folder | Role |
|---|---|
| `frontend/` | Angular Studio, real website browser, folder navigation, reports and review |
| `backend/` | Local projects, source adapters, persistence, guarded edits and Runner tasks |
| `packages/review/` | Framework-independent annotations, selection and local-site bridge |
| `packages/contracts/` | Shared transport contracts; explicitly UTF-16 source coordinates |
| `examples/` | Website, Markdown and standalone library projects |
| `knowledge/` | Shared local-rule definitions and explanatory wiki articles |
| `docs/reviews/` | Reviewable website findings, evidence and source coverage |
