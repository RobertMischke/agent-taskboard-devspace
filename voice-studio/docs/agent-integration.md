# Agent integration and an AGT pipeline plan

Status: **integration guide plus proposed pipeline design, 12 September 2026**.
The library and file-review operations described as available below exist in the
local code. The `post-voice-review` step, portable pipeline envelope and automatic
AGT handoff are proposals. This document implements none of them.

An agent can already embed Voice's review controls in a development website,
connect its rendered text to source files and use Studio's guarded review
workflow. A later AGT step should run a bounded assessment and return evidence
for a human or policy owner to consider. Displaying marks, producing an analysis
and authorizing a source change remain separate responsibilities.

## What an agent can use now

| Component | Available responsibility | Boundary |
| --- | --- | --- |
| `@voice/review` | Draw supplied findings and feedback, map native selections, report mapping diagnostics, update and dispose the overlay. | It is not an analyzer, SEO crawler, visual evaluator or source writer. |
| Studio source adapters | Read supported HTML, Markdown and explicitly configured TypeScript prose; associate routes and component context with source. | Dynamic or ambiguous rendering needs adapter support; a route URL is not a source location. |
| Studio review backend | Local advisory rules, durable feedback and keep decisions, versioned proposals, explicitly started semantic reviews and source tasks. | The current full-file semantic review is not a whole-project evaluator. |
| Voice Lint core | Proposed portable analysis layer and CLI/CI direction. | The broader core/CLI/CI implementation is not shipped by this repository. Do not invent a `voice-lint` command for a pipeline. |
| Holistic review records | [Proposed schema, context and decision design](holistic-review.md). | Design artifacts, not a current context importer or project evaluator. |

Build the workspace library with `npm run build:library`. Use its workspace ESM
export or copy the built `packages/review/dist/voice-review.js` to development
assets. The local source does not establish that a public npm release exists.
The [library guide](../packages/review/README.md),
[bridge protocol](../packages/review/LIVE-BRIDGE.md),
[file workflow](workflow.md) and [Runner guide](runner-integration.md) are the
existing detailed contracts.

## Copyable instruction for a coding agent

Replace the bracketed project values before assigning this bounded task:

```text
Add opt-in Voice review to [application and development route].

Goal: review the rendered text against its actual source without changing
the application's copy, navigation or normal interaction as part of setup.

1. Read the project's AGENTS instructions and the Voice library/bridge guides.
   Inspect the actual framework, source files and development-server settings.
2. Consume the built @voice/review package or its standalone browser bundle.
   Enable the integration only in development and only when the operator
   explicitly selects review mode. Use [exact Studio origin], no wildcard.
3. Map [route] to [source file]. For shared renderers or translations, record
   the relevant template/component/style files as explicit source context.
   Do not substitute rendered HTML for the original editable source.
4. Prefer explicit data-voice-unit identifiers whose eligible DOM text equals
   each adapter TextUnit.text exactly. Exclude code, hidden and editable regions.
   Report ambiguous, unsupported or missing mappings rather than guessing.
5. Choose either the opt-in connectVoiceStudio bridge for a real development
   app, or mountVoiceReview for a host that supplies its own units/findings/UI.
   Supply an accessible findings list. Keep native links, buttons and selection.
6. Keep backend credentials in the host session. Never put credentials in the
   bridge, page URL, source code, screenshots or exported results.
7. Preserve UTF-16, zero-based, half-open offsets and exact quotes. Convert
   declared code-point spans explicitly. Reject stale text and mixed-unit edits.
8. On document or route changes, refresh the correct review and clear obsolete
   anchors. Dispose controllers/connections on component teardown, iframe
   replacement or HMR cleanup; verify repeated setup does not duplicate marks.
9. Verify mapping diagnostics, native interactions, keyboard report navigation,
   a narrow and a wide viewport, reload and disposal. Test text across inline
   markup and an emoji before the selected text. Report unsupported cases.
10. Return changed file paths, source/build identity, commands and observed
    results, screenshots and a precise coverage/limitation statement. Do not
    start a model, apply a review proposal, commit, push or publish unless that
    action is included in the task's existing authorization.
```

The host must enforce the development/opt-in guard: calling
`connectVoiceStudio` itself is not a substitute for the application's build
policy. The bridge needs the site's explicit integration and permitted framing
headers. Studio currently accepts the registered local development origin.
Arbitrary production pages cannot be inspected by adding their URL to Studio.

Use `connectVoiceStudio({ studioOrigin })` once inside the real website; Studio
owns its parent review UI and the bridge owns the in-page controller. Use
`mountVoiceReview({ root, units, findings, feedback, ...callbacks })` when
building a separate review host. Do not mount a second competing controller over
the bridge's root. A mount controller exposes `update`, `selectFinding`,
`getDiagnostics` and `dispose`; a live connection exposes `refresh` and `dispose`.

Generated Markdown/HTML previews remain sandboxed without scripts. The explicitly
integrated live website runs its own scripts on its own development origin.
These are two different preview modes with different trust and mapping contracts.

## Use the current review workflow

The browser library's `createReviewClient` currently exposes `getDocument` and
`saveFeedback`. It does not expose a complete task/suggestion SDK. A Studio host
uses the authenticated backend operations below for the other actions.
`{document}` means `/api/projects/{projectId}/documents/{documentId}`.

| Intent | Existing operation | Result and protection |
| --- | --- | --- |
| Read source and coverage | `GET {document}` | `DocumentDetail`: source version, text units, findings, feedback, review revision and coverage. |
| See the current local file/Git context | `GET {document}/source-context?includeGit=true` | Optional current working-copy provenance. It cannot establish the commit of an old task or an unverified running build. |
| Keep a passage | `POST {document}/decisions` | `SelectionDecisionInput` with selection, exact quote, source version, review revision and request ID; returns the saved decision and document. It changes neither prose nor lint suppression. |
| Save feedback | `POST {document}/feedback` | `FeedbackInput`; the backend persists source-linked metadata with version/revision checks. |
| Request 1-3 alternatives | `POST {document}/suggestions` | `SelectionSuggestionInput`; explicit model start, durable run and guarded selection. List/get/cancel operations exist on the same collection. |
| Prepare and apply a change | `POST {document}/proposals`, then the separate `POST {document}/proposals/{id}/apply` | A `ProposalInput` prepares a source diff. Preparing or choosing a suggestion does not apply it. Apply rechecks the expected source version. |
| Review the selected full file | `POST {document}/semantic-reviews` | Explicit semantic run with source-version and request-ID checks. Model availability is read separately from `/api/semantic-review/status`. |
| Delegate a source task | `{document}/tasks` plus its documented prompt/start/cancel/apply/resolve operations | Durable `ImprovementTask` with source/review/task revisions and explicit lifecycle actions. |

Current request and result types live in
[`packages/contracts/src/index.ts`](../packages/contracts/src/index.ts). Source
offsets use UTF-16 code units. `TextUnit.sourceSpan` names the original source
range; a finding/selection's `start` and `end` are offsets within its unit. A
DOM-only sample with a synthetic source range is suitable for a demo, not a file
write. HTML entities, Markdown syntax and TypeScript escapes need the actual
adapter's mapping rather than simple string-index addition.

Reuse a request ID only for the identical operation and payload. After a lost
model-start response, recover/retry that request instead of generating a new ID
and possibly a second paid run. On a version conflict, keep the user's draft,
reload and require a new review of the anchor before submitting changed input.
Cancellation, interruption, missing evidence and stale results stay visible.

Repository goals, existing decisions and preserved claims are analysis inputs,
not authority to run commands or change task permissions. The configured Runner
route and permission policy remain host-owned. No model call follows a page
load, metadata read, script installation or record invalidation implicitly.

## Git-backed inputs and meaningful result locations

Use Git as the preferred shared source of record. Resolve requested branches to
full commits before review and pin marketing/product context repositories
separately. Keep a repository ID, relative file path, content hash and relevant
locator for each input. Approved context, proposals, historical decisions and
disputed claims carry distinct authority and explicit supersession links.
For AGS, the marketing-source selection in [holistic-review.md](holistic-review.md)
is the starting point, not an indiscriminate scan of every strategy document.

An explicitly selected working-copy review also needs an immutable, retrievable
snapshot of its in-scope contents, including untracked files and deletions, plus
its base commit where available. Hashes alone do not preserve the source bytes.
A folder without Git can be reviewed from such a snapshot; its commit stays
unknown and the result is labeled a snapshot review. Rendered evidence records
its build identity independently; current HEAD does not prove what an already
running preview contains.

The following layout is proposed for portable review records. It complements
the existing [maintenance and evidence conventions](maintaining.md):

```text
<reviewed repository>/
  .voice-review/
    pipeline-policy.json                 # proposed owner-reviewed opt-in policy
    contexts/<context-id>.json            # pinned goals, claims and decisions
    reviews/<review-id>/review.json       # immutable structured result
    reviews/<review-id>/report.md         # readable interpretation
    reviews/<review-id>/decisions.json    # append-only decisions / revalidation
    reviews/<review-id>/evidence/         # approved, hashed portable captures

<AGT-owned task folder>/
  results/voice-review/<attempt-id>/
    request.json
    result.json
    report.md
    evidence-manifest.json
    evidence/<capture-or-log>
  results/review-evidence.jsonl           # appended through AGT's writer
  pipeline-execution.json                # recorded through AGT's pipeline log

<local runtime>/
  sessions, credentials, raw logs, temporary snapshots and browser output
```

The AGT task folder is application-owned, not a folder for an agent to create or
rewrite by hand. The future host integration writes through platform services;
the interactive caller uses supported APIs. A portable review export goes through
the Voice backend, is explicitly selected and sanitized, and uses the normal
authorized Git workflow. There is no automatic migration of `.voice-lint`
sidecars and no automatic commit of captures. Large evidence may use an approved
durable store with hash, availability and access class in its manifest.

## AGT integration: verified seams and missing work

These paths and type names were inspected in the active `agent-taskboard-dev`
checkout on 12 September 2026. They are repository-relative source pointers,
not installed plugin APIs. A future implementation must check its checkout again.

| Existing AGT code | Reuse in the proposed integration |
| --- | --- |
| `backend/Shared/Models/PipelineModels.cs` and `backend/Features/Pipeline/PipelineCatalogue.cs` | Existing `StepKind.Analysis`, `StepRunMode.Sequential` and `PipelineStep` catalogue shape. Add a named opt-in Voice step with explicit ordering and availability. |
| `backend/Features/Pipeline/QualityAnalysis/QualityAnalysisStepRunner.cs` | Concrete example of a bounded analysis service, result with `EvidencePath`, canonical findings and an external analysis-package boundary. Its `IQualityAnalysisStepRunner` currently exposes `RunAngularRulesAsync`, not a generic Voice plugin method. |
| `backend/Features/Runner/ReviewDecisionOrchestrator.cs` | `RunQualityAngularRulesPostStepAsync` demonstrates actual local execution and `PipelineStepExecution` recording. Voice requires equivalent explicit wiring and its own advisory policy; a catalogue row alone does not run code. |
| `backend/Features/Pipeline/PipelineExecutionLog.cs` | `RecordStep` records status, verdict, reason, duration and `EvidenceRef` per attempt. This log is observability; failed telemetry writes are swallowed and cannot be the authoritative result store. |
| `backend/Features/Tasks/ReviewEvidenceLog.cs` | Existing writer for `results/review-evidence.jsonl`; project Voice findings with stable IDs, file references and artifact references through the host. |
| `backend/Features/Runner/RemoteReviewPlanBuilder.cs` | Freezes tool gates and semantic aspects into `ReviewPlanDto`. It currently loops over `StepKind.Aspect`; a new `Analysis` catalogue entry would not automatically reach remote execution. |
| `contracts/TaskServer.Contracts/ReviewContracts.cs`, `runner/RemoteReviewWorkspace.cs`, `backend/Features/Runner/RemotePipelineReviewEvidenceProjector.cs` | Existing remote command, artifact, exact-result-SHA and projection boundaries. Remote Voice support needs explicit plan generation, capability checks, result validation and projection here. |
| `backend/Features/Pipeline/TaskSpawnerPostStepRunner.cs` | Existing bounded follow-up creation through `TaskMutationService.CreateJob`, target configuration and deduplication. Reuse its platform ownership principle; do not silently enable the generic task spawner for Voice. |

Quality Studio owns its rule implementation and `.quality/agent-studio.json`
policy. That policy validates known QS step IDs and is not an existing place to
add arbitrary Voice keys. QS visual/consistency catalogue slots also do not prove
that a whole-site Voice review exists. The proposed Voice policy requires its own
validated schema and explicit authority; the filename above is not read today.

## First executable slice: advisory review step

Proposed step ID: `post-voice-review`. Start disabled, execute sequentially on the
frozen delivery subject after the relevant source/build prerequisite and before
the final review decision. Record whether a dimension used source alone, a
verified rendered build, or no usable evidence. Do not let a failed prerequisite
become an apparently clean visual result.

1. **Freeze and validate inputs.** Resolve repository commits or snapshot identity,
   route/file inventory, requested dimensions, context hash, exclusions, contract
   version and owner policy. Resolve the task's delivery subject, not the shared
   checkout opportunistically. Bound file count, bytes, output and duration.
2. **Choose a real available producer.** A first adapter may consume existing
   validated source findings. Executing Studio's local rules outside its current
   backend requires an explicit supported extraction/adapter boundary. Do not
   spawn an ad hoc Studio service or pretend the review-display package supplies
   analysis. A later semantic task uses the approved runner route and separately
   qualified prompts. Missing Voice Lint core remains an explicit dependency.
3. **Run read-only assessment.** Source review never writes the reviewed checkout.
   SEO needs a named route/metadata inventory; consistency needs both conflicting
   sources and context; visual assessment needs authorized browser captures with
   route, viewport, locale, theme, state and verified build identity. An unavailable
   capability produces partial coverage or `unavailable`, not zero findings/pass.
4. **Persist a versioned result first.** Store the validated immutable result and
   portable evidence with hashes before publishing its reference. Append findings
   and the pipeline row through AGT services. A failed result-store write fails the
   review execution visibly even if best-effort pipeline telemetry also fails.
5. **Return to the owner.** Phase one is advisory: no source apply, commit, push,
   task reissue or automatic follow-up. A findings-bearing review may complete
   successfully; execution completion is not an approval of the reviewed page.

The first slice includes the source-only producer boundary and fake-result
contract tests. It does not promise a finished holistic model evaluator. Build,
browser capture and model inference are separately declared capabilities.

## Proposed result envelope and lifecycle

The [synthetic AGT planning example](examples/agt-voice-review-plan.v1.json)
illustrates the following contract. It is not an actual AGT result, an executable
pipeline definition or a document claiming conformance to the holistic schema.
A concrete schema and fixture tests must be added before accepting this shape at
a disk or API boundary.

| Field group | Required meaning |
| --- | --- |
| Identity | Envelope/schema version, producer and version, review ID, project/task/run/attempt/step IDs and immutable request hash. Do not collapse multiple attempts into one task-level result. |
| Subject | Repository identity, requested ref, resolved commit or snapshot reference/hash, in-scope file hashes, route mapping and adapter version. |
| Context | Frozen manifest/hash, selected authority and decision IDs, referenced repositories and any missing or conflicting context. |
| Execution | Started/completed time, completed/partial/failed/cancelled/interrupted state, bounded execution policy; configured/actual model and usage only where reported. |
| Coverage | Requested and inspected pages/files/dimensions and viewport matrix, omissions with reasons, unsupported adapters and truncated context. No invented numeric Voice score. |
| Findings | Stable finding/fingerprint, dimension, severity, explanation, concrete source/route references, supporting evidence IDs, uncertainty and proposed actions. Existing inline findings additionally need exact unit/quote/UTF-16 anchors. |
| Evidence | Relative path or approved durable-store reference, media type, byte size, SHA-256, capture time, availability and access class. Captures include build identity and viewing state. |
| Policy | Advisory/gating mode, named policy owner, policy revision and any later decision reference. A model cannot grant itself gate or write authority. |

Use an idempotency key derived from the attempt, step, immutable inputs and
contract version. A transport retry must recover the existing run; an intentional
rerun creates a linked successor. Preserve cancelled/interrupted attempts. New
source, changed applicable context, altered mapping or missing evidence makes the
affected result stale. Preserve original results and append revalidation facts;
do not relabel an older finding with today's branch or automatically spend model
tokens to refresh it.

## Gates, follow-up coding tasks and delivery slices

Advisory findings are not build failures. The existing QS medium-severity steering
policy should not be inherited by Voice accidentally. A future gate requires an
owner-approved, versioned policy naming scope, supported checks, coverage
requirements and deterministic admission behavior. Unsupported or unavailable
checks remain visible. A subjective copy preference must not silently block a
delivery or start a rewrite loop.

After an owner accepts a specific action, a follow-up coding task can carry the
review/finding IDs, frozen source and context, bounded target files, intended
behavior, evidence and acceptance checks. Creation needs explicit owner policy or
an explicit operator action, stable deduplication and normal task references.
The task's coding agent produces a reviewable result under AGT's ordinary Git
ownership. A `keep`, `reject` or `defer` decision remains durable context; it is
not a universal lint suppression. The review step never edits a task folder to
bypass the Task API.

Implement in independently reviewable slices:

1. A read-only input collector, versioned request/result schema, hash validation,
   immutable store and source-only producer adapter with fake-result tests.
2. Local opt-in `Analysis` registration, actual executor wiring, advisory status
   projection and results visible through the existing evidence surfaces.
3. Remote plan/executor/projection support bound to the immutable Result SHA,
   with capability and lease/attempt checks. Do not call local success remote support.
4. Explicit page-purpose, SEO, consistency and visual producers with their own
   coverage and evidence. Qualify real model behavior separately from fake tests.
5. Owner decisions, invalidation and opt-in deduplicated follow-up coding tasks.
   Gate policy, if wanted, is a separately reviewed product decision.

Before claiming the integration works, verify catalogue ordering/defaults,
result-schema rejection, stale inputs, replay after lost response, cancellation,
missing artifacts, absent model/capture tools, partial coverage and evidence
projection. For embedding, verify source persistence, exact UTF-16 mapping,
native interaction, wide/narrow screenshots and complete lifecycle cleanup.
Tests must prove the intended source and build were reviewed. A passing overlay
test or local build alone does not qualify a model or a production deployment.
