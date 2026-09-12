# AGT Voice review pipeline plan

Status: internal implementation proposal, 12 September 2026. This plan is not a
public integration guide or an implemented pipeline capability. The executable
Library/Studio workflow is documented in [agent-integration.md](../agent-integration.md).

## Git-backed inputs and meaningful result locations

Store shared review records in Git. Resolve requested branches to
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
the existing [maintenance and evidence conventions](../maintaining.md):

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

The [synthetic AGT planning example](../examples/agt-voice-review-plan.v1.json)
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
