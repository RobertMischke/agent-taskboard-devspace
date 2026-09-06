# Voice Studio

Preview 0.2: browse a **real local website** or a **Markdown folder**, mark text,
save feedback, run a semantic review through the Coding-Agent-Runner, and inspect
a source diff before changing the original file. Angular frontend, .NET 10 backend
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
3. Write a replacement, use a rule suggestion, or start a semantic Runner review.
4. Inspect the complete source diff and explicitly apply it.
5. Verify the actual changed file and rendered page. Older source versions are rejected.

File reports cover all supported units in the file and list parser exclusions;
project reports aggregate the source inventory and deterministic findings. Proposals, feedback and semantic run history
persist in project `.voice-lint` metadata. Reopening a run checks source and component
context again. Cancelled, failed, interrupted and stale runs are distinct from success.
Malformed or incomplete model replies fail validation.

## Semantic review through the Coding-Agent-Runner

The implemented adapter uses the pinned `CodingAgentRunner` 0.7.0 NuGet package and
the operator's local CLI account. It stages the current file, mapped units,
feedback and bounded component context with **read-only permission and clean
context**. The model returns advisory structured findings; applying a fix remains
an explicit action through the backend proposal workflow.

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
npm run test:ui-state
# Start Studio and the onboarded Agent Studio dev server, then:
npm run test:api
npm run test:e2e
node scripts/verify-running.mjs
```

Runner tests use fake streams and make no model calls. Browser tests use installed
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
