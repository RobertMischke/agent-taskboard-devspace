# Semantic review through CodingAgentRunner

The backend contains a semantic-review adapter for the existing
`CodingAgentRunner` .NET library. It launches the operator's configured coding
agent CLI; it does not call a provider SDK or require another API-key workflow.
The adapter is disabled until a server-side route is explicitly configured.
Implementation tests use fake Runner streams and spend no model tokens. A
successful fake-stream test is not a live-model acceptance result.

## Dependency

Pin the portable NuGet package in `VoiceStudio.Api.csproj`:

```xml
<PackageReference Include="CodingAgentRunner" Version="0.7.0" />
```

Version 0.7.0 is available in the local NuGet cache used during implementation.
It exposes the streaming, permission and clean-context APIs used here. The
adjacent source checkout is `C:/Projects/coding-agent-runner`; its newer model
discovery API is not assumed to exist in the pinned package. Restore/build use
normal `dotnet restore` and `dotnet build`. No absolute project reference or
external checkout is required for consumers.

## Server configuration

Configure all three values before starting the server:

```sh
export VOICE_REVIEW_CLI=codex
export VOICE_REVIEW_MODEL=gpt-5.6-sol
export VOICE_REVIEW_THINKING=medium
```

These values are an explicit provisional operator route, not a measured Voice
ranking. The other supported CLI selection is `claude`; its model and effort
must be compatible with the pinned Runner. `VOICE_REVIEW_CLI_PATH` optionally
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
delegation and automatic quota waiting/retries are disabled. Omitting the
permission mode would select Runner's permissive default, so the adapter always
sets it. Clean context isolates CLI state; it is not a general filesystem or
network sandbox. Claude's read-only mapping is plan mode, Codex's is its native
read-only sandbox.

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
rules. Suggestions do not create or apply a source proposal automatically.

Each request has a durable claim and run record under
`.voice-lint/semantic-runs/<runId>/`, with `input.json`, `run.json` and
`output.txt`. Identical retries return the existing run; changed input under the
same request ID is rejected. A leftover running record after restart becomes
interrupted and is not automatically relaunched. Runner's raw logs and staged
workspace remain under the host's configured runtime directory. These artifacts
contain reviewed content; use the project's existing local retention policy.

## Token Economy boundary

This first adapter uses a visibly explicit server-configured provisional route.
It does not claim to call Token Economy's admission API or to enforce a
Voice-qualified candidate set. The future adapter should pass Token Economy's
admitted attempt route here, while preserving the Voice prelaunch qualification
check described in [model-strategy.md](model-strategy.md). No second price table,
general model router or automatic fallback is introduced.

## Verification

```sh
dotnet run --project backend/VoiceStudio.RunnerTests/VoiceStudio.RunnerTests.csproj
```

The tests inject `IVoiceReviewRunner`: they verify exact output validation,
read-only/clean requests, staged context, persistence, idempotency, failed/missing
terminal events, stale-source rejection and cancellation without starting a
coding-agent model run. Live CLI authentication and actual model quality remain
separate operator acceptance work.
