# Semantic review and source tasks through CodingAgentRunner

Voice Studio uses the `CodingAgentRunner` .NET library for full-file semantic
reviews and saved improvement tasks. It launches the configured coding agent
CLI using that CLI's existing authentication. Configure a server-side route
before starting either kind of run.

## Dependency

Pin the portable NuGet package in `VoiceStudio.Api.csproj`:

```xml
<PackageReference Include="CodingAgentRunner" Version="0.7.0" />
```

Restore and build with `dotnet restore` and `dotnet build`. The pinned package
provides the streaming, permission and clean-context APIs used by the adapter;
an external source checkout is not required.

## Server configuration

Configure all three values before starting the server:

```sh
export VOICE_REVIEW_CLI=codex
export VOICE_REVIEW_MODEL=gpt-5.6-sol
export VOICE_REVIEW_THINKING=medium
```

The example route is provisional; choose a model and effort supported by the
installed CLI and pinned Runner. The other supported CLI selection is `claude`.
Routing uses this server configuration, without Token Economy admission or
automatic model fallback. `VOICE_REVIEW_CLI_PATH` optionally
names the trusted local CLI executable. `VOICE_REVIEW_TIMEOUT_SECONDS` controls
the bounded run duration (15-1800 seconds, default 300). Request bodies cannot
provide a CLI path, model endpoint, credential, permission bypass or model route.

The configured CLI must already be installed and signed in. The status call
uses Runner's version and credential-presence probes only. Credential presence
does not validate an expired session, and static capability recognition is not
a live availability or Voice-quality benchmark. Status requests wait at most ten
seconds; a timed-out probe remains shared, so polling cannot create concurrent
background version probes. A status timeout never launches inference.

## Backend contract

`RunnerReviewService` exposes:

- `GetStatusAsync(ct)`: configured/available route, read-only and clean-context
  posture, provisional qualification, reason and duration limit. No inference.
- `StartAsync(projectId, documentId, SemanticReviewInput, ct)`: checks source
  version, stages a full-file review and returns its persisted running record.
  Only an explicit operator action should call this method.
- `GetRun(projectId, documentId, runId)`: returns the durable current outcome.
- `ListRuns(projectId, documentId)`: newest 100 persisted runs for that file,
  revalidating completed evidence against current source and related context.
- `Cancel(projectId, documentId, runId)`: cancels a running process through Runner.

The start input contains `expectedVersion`, an idempotent `requestId` and an
optional `instruction`. The host exposes authenticated endpoints and the explicit
Studio button; automatic document loading never starts a model call.

`ImprovementTaskService` exposes a separate durable workflow below
`/api/projects/{projectId}/documents/{documentId}/tasks`: list/create, get,
`/{id}/prompt`, and explicit `/{id}/start`, `/{id}/cancel`, `/{id}/apply` and `/{id}/resolve`
actions. A task stores the instruction, selected feedback IDs, source version,
feedback revision, component-context fingerprint and revision. Creation and start
each require an idempotent request ID. Changed input under the same ID is rejected.

Saving or copying the prepared prompt does not start inference. Starting calls
the same Runner adapter in task mode. Capability checks are followed by another
source/feedback/context check before the durable launch claim, so a slow probe
cannot silently launch an already stale task. Requests cannot choose an arbitrary
model, executable or write permission.

A run retains configured CLI/model/effort, the actual model reported by the
CLI when available, source version, context manifest, timestamps, status,
advisory findings with evidence, notes, usage summaries and errors. The actual
model remains unknown when the CLI does not report it. No cost is invented from
missing usage or from a subscription quota percentage.

## Context and source integrity

The primary document is supplied in full with every supported text unit and
its exact UTF-16 coordinate space. For Markdown this is the selected file; a
folder report remains a separate aggregation, not an implicit all-folder model
call. Angular component context comes from the project's explicit
`sourceContexts` mapping, supplied by `ProjectStore.GetReviewRunContext`.
Related templates, component code and styles explain the text's rendered role;
they are not additional source targets for model-generated findings.

Related-file truncation is declared by the source adapter and retained in the
context manifest. If the serialized full request exceeds the configured context
bound (default 200000 characters), the run is rejected before inference rather
than silently reduced to the viewport. This character bound is not a token
estimate. The primary file is never silently truncated.

The host stages `review-context.json` in its own per-run workspace and
initializes that scratch directory with `git init` for CLI compatibility. It
does not use the original source checkout as the agent working directory.
Runner runs with explicit `CliPermissionModes.ReadOnly` and clean context;
delegation and automatic quota waiting/retries are disabled. Clean context
isolates CLI state; it is not a general filesystem or network sandbox. Claude's
read-only mapping is plan mode, Codex's is its native read-only sandbox.

Time and output-size bounds, cancellation and the Runner watchdog stop runaway
runs. They are not a guaranteed token or monetary cap. The UI must describe this
before an explicit run and retain the configured route and uncertainty.

## Output validation and persistence

The prompt requests a versioned JSON object with the original source version,
all reviewed unit IDs, findings and notes. A final JSON object may follow a
short preface or be wrapped in a JSON code fence. The backend validates JSON
structure, exact source version, whole-file unit coverage, allowed categories,
non-split UTF-16 ranges, exact quotes and required evidence text fields. It does
not independently verify factual or semantic grounding. The coverage
list is the model's declaration about supplied units, not independent proof of
semantic correctness or coverage of parser exclusions.

An exit failure, cancellation, absent terminal event, malformed output or stale
source/context cannot become a completed accepted review. The source and each
supplied component-context snapshot are checked again before findings are
accepted. Findings are advisory and returned separately from deterministic
rules. Suggestions from an ordinary semantic review do not create or apply a source
proposal automatically. An explicitly started improvement task may prepare one
validated combined proposal; no Runner path applies it.

Each request has a durable claim and run record under
`.voice-lint/semantic-runs/<runId>/`, with `input.json`, `run.json` and
`output.txt`. Identical retries return the existing run; changed input under the
same request ID is rejected. A leftover running record after restart becomes
interrupted and is not automatically relaunched. Runner's raw logs and staged
workspace remain under the host's configured runtime directory. These artifacts
contain reviewed content; use the project's existing local retention policy.

## Task outcomes and combined proposals

Task mode adds two required output fields: `taskDisposition` and
`taskExplanation`. The explanation must state a concrete reason grounded in the
request and supplied context. The disposition is one of:

- `changes`: at least one supported replacement suggestion is present.
- `already_satisfied`: no replacement and no open finding remain; the task may
  close as `completed` with resolution `agent_no_changes`.
- `needs_information`: necessary facts are missing; the task becomes `needs_review`.
- `unsupported`: the request needs structural, multi-file or unsupported source
  operations; the task becomes `needs_review`.

A successful CLI exit with no replacements is not enough to close a task. Missing
or contradictory disposition fields fail validation. A model’s reason remains
reviewable and is not independently certified by the JSON validator. The
`needs_review` state retains the unresolved explanation without inventing a fix.

A `changes` task may prepare 1–50 non-overlapping edits across supported text units
**within the selected file**. `ProjectStore.CreateTaskProposal` rechecks source
version, feedback revision and configured component-context fingerprint; validates
quotes and safe mappings; preserves HTML/Markdown/TypeScript syntax through the
source adapter; and constructs one complete before/after proposal. Overlap, unsafe
source boundaries and invalid TypeScript are rejected as a set, not partially
applied. Related context files are never source targets.

The proposal makes the task `ready`. Only the separate task apply endpoint, with
current task revision, source version and feedback revision, can write it. It
rechecks component context and uses the existing backup and transaction journal.
The ordinary proposal endpoint cannot bypass the owning task’s checks. A crash
after the source transaction is recovered from the applied proposal instead of
repeating the write. Applied tasks remain historical outcomes.

Task records persist under `.voice-lint/tasks/<documentId>/<taskId>.json` and link
the Runner run and proposal. Repeated starts do not launch again, failed or
interrupted records do not restart on page load, and cancellation leaves source
unchanged. A manual resolution is a distinct explicit action with a required
reason and current source/feedback state.

## Local build/test verification

After applying a proposal, explicitly start the project's configured local check
in Studio. `ProjectCheckService` runs the host-configured build/test command and
retains its logs, exit code and source fingerprint. Results become `stale` when
the configured inputs or command profile change.

This process runs with the host user's permissions, outside the semantic Runner's
read-only mode. Missing prerequisites block start; source application does not
start a check. See [local project checks](../backend/CHECKS.md) to configure the
command and input scope or use the check API.

## Verification

```sh
dotnet run --project backend/VoiceStudio.RunnerTests/VoiceStudio.RunnerTests.csproj
dotnet run --project backend/VoiceStudio.TaskTests/VoiceStudio.TaskTests.csproj
npm run test:checks
```

The tests inject `IVoiceReviewRunner`: they verify exact output validation,
read-only/clean requests, staged context, persistence, idempotency, failed/missing
terminal events, stale-source rejection and cancellation without starting a
coding-agent model run. The task suite additionally checks saved-task lifecycle,
context drift, dispositions, combined proposals and the explicit apply boundary.
The separate project-check suite uses fake processes and tiny executable fixtures
to test status, persistence, source drift, logs and process-tree cancellation
without running a model or building the target website.
These tests do not verify live CLI authentication or editorial quality. Verify
the configured route with an explicit review and inspect its findings before
using its output for source changes.

The four non-LLM local rules and their wiki use `knowledge/rules.json`. Evaluated
LanguageTool/Vale/CSpell/Hunspell/textlint adapters are not part of Runner and are
not installed analyzers. See [language tooling](language-tooling.md),
[third-party notices](../THIRD_PARTY_NOTICES.md) and the resolved npm inventory for
the distinction between actual packages and candidate engines/data.
