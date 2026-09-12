# Model roles and Token Economy integration

Status: Preview 0.2, updated 2026-09-06. Deterministic analysis and manual/rule
proposals remain available without an LLM. Semantic review now has an explicitly
configured CodingAgentRunner 0.7.0 adapter with read-only staged context, durable
run history and structured result validation. It was tested using fake streams,
without model calls. The adapter is unconfigured by default. Qualification storage,
model benchmark execution and Token Economy admission remain planned. No model has
passed a Voice-specific benchmark. See [Runner integration](runner-integration.md).

Voice should know which model is best supported by evidence for this editorial
task. Token Economy should determine which permitted route can execute this
attempt under the host's policy and current capacity. Editorial preference,
qualification and operational selection are different decisions.

## Ownership

| Owner | Responsibility |
|---|---|
| Voice | Editorial role, locale and text class; rubric and labelled corpus; meaning/fact preservation; comparisons and task-specific qualification |
| Token Economy | Canonical model/provider/CLI identities, price/usage knowledge, general capability/trust evidence, correctness floors and deterministic routing |
| Host backend | Trusted provider configuration, credentials, context assembly, fresh capacity, admission, spend limits, launch and durable run records |
| Operator | Profile decisions, factual evidence, accepted edits and explicit experiment/override choices |

Reuse Token Economy's existing catalogue and routing machinery. Voice adds
prose-domain evidence, not a second general model or price catalogue. A route's
catalogue entry proves resolvability, not suitable German product copy.

## Existing APIs versus the planned Voice boundary

The existing contracts require these distinctions:

- `TaskClassRecommendationCatalog.Recommend` produces a task-class candidate
  set; its separate `Select` step considers capacity and retained outcome
  evidence. This intake prior does not replace concrete attempt admission.
- `ModelRouter.Route` is pure. It does not probe credentials, launch a model,
  persist decisions or enforce a spend ceiling on a running provider.
- `RequiredBenchmarkCapability` selects a matching evidence cohort. It does
  not universally require every selected baseline or operator pin to have
  passed that capability. The current request has no arbitrary Voice-owned
  candidate allow-list.
- `AgentStudioTaskAdmission.PrepareAttempt` is the existing host adapter for
  Agent Studio tasks. Its attempt launch route remains separate from the
  configured card route and operator pin.

The planned Voice adapter must therefore check the exact selected route
against applicable Voice qualification **before launch**. Passing an evidence
report alone is insufficient. To automatically select among Voice-qualified
equivalents, register the task capability and equivalence evidence through
Token Economy's supported catalogue/policy extension path. If the present
schema cannot express that restriction, extend and test it there. Voice must
not substitute a route after routing, invent a correctness trigger or inflate
a complexity score to force a preferred model.

Retain operator pins and Token Economy's existing pin semantics. Separately
record the pin's Voice qualification. An explicitly authorized provisional
experiment may use an unqualified route; it remains labelled as an experiment,
not a qualified default. A pin does not create editorial evidence.

## Roles and scope

| Voice role | Context and output | Planned initial policy |
|---|---|---|
| Deterministic lint | Mapped units/file; concrete findings and rule fixes | No LLM |
| Semantic review | Passage, neighbouring section, profile/examples and relevant facts; structured findings | Strong provisional evaluation baseline; advisory findings |
| Rewrite proposal | Selected section, human feedback, retained facts and affected locales; bounded alternatives | Separate editorial qualification; no source-write authority |
| Project planning | Reports, shared strings/components, affected pages and dependencies; bounded plan | Host planning policy and correctness floors |
| Source implementation | Approved plan and registered project; source diff and checks | Existing Agent Studio/Token Economy admission; separate from prose qualification |
| Verification | Source/DOM integrity, deterministic checks, factual evidence and human meaning review | No self-approval; independent semantic review is additional evidence |

These are Voice domain roles, not new existing `RoutingWorkflowRole` values.
Version an explicit mapping to Token Economy's task/workflow classes and
capability cohorts. Unknown or ambiguous mappings cannot qualify Voice
automation. Parseable finding JSON alone does not establish deterministic
semantic verification or justify the bounded supporting-model exception.

Whole-file reports initially aggregate deterministic findings and coverage.
Semantic file review must declare included/excluded units, chunk boundaries,
context overlap and unreviewed regions; a viewport review is not file coverage.
Project review retains file identities, shared-content dependencies and locale
relationships. Its implementation model need not be its rewrite model.

## Starting candidates, not a measured ranking

Resolve exact model IDs, effort and provider/CLI routes from the installed
Token Economy catalogue at evaluation time. The policy read on 2026-09-06
contains `gpt-5.6-sol / medium` for demanding work and
`gpt-5.6-sol / xhigh` for correctness-critical work. These are host-policy
baselines, not Voice benchmark winners. Semantic review can evaluate the
strong baseline provisionally; source work uses its actual task policy.

The concept's proposed challengers, GPT-6 Astra and Claude Sonnet 5, are
experiment labels until Token Economy resolves an admitted exact route.
This document does not assert their availability in a particular runtime,
API/CLI interchangeability, or superiority on DE/EN prose.

A cheaper/smaller route may become preferred when comparable Voice evidence
qualifies it. Size alone neither qualifies nor disqualifies it. Cost pressure
cannot create missing quality evidence or silently expand the permitted cohort.

## What "best known" means

A proposed, versioned Voice qualification record contains:

- Role, locale, text class, factual sensitivity and profile/rubric version.
- Prompt/context-builder versions and relevant inference/tool settings.
- Canonical provider/model/effort, resolved snapshot where available and
  runtime/CLI identity.
- Dataset/split version, provenance, independent-example and run counts,
  outcome measures, uncertainty, evidence links and usage/cost coverage.
- Status, restrictions, review date, requalification triggers and the human
  promotion decision.

The proposed Voice evidence states are `unverified`, `provisional`,
`qualified`, `restricted` and `retired`; these are not claimed as current
Token Economy enum values. Preserve their meaning in an explicit evidence
mapping. An identifier such as `voice.semantic-review.de.marketing.v1` is
a proposed capability name, not one already registered there.

**Qualified** means passing a predeclared gate for that cohort. **Preferred**
ranks qualified candidates under a stated objective, such as rewrite quality
subject to factual preservation and acceptable cost. **Selected** describes
the operational attempt route. An unavailable preferred model does not become
a worse writer; an available model does not become the best writer.

Insufficient evidence or no measurable difference produces uncertainty or a
tie. English rewrite evidence does not qualify German factual claims. A
snapshot/alias, prompt, profile, context-policy or material runtime change
requires review before transferring qualification. Unknown effective model
identity must not be silently pooled with an exact benchmark cohort.

## Qualification and promotion workflow

1. Assemble a consented DE/EN corpus from accepted and rejected website and
   Markdown passages. Include clean negatives, real issues, ambiguous findings,
   missing facts and meaning-sensitive rewrites. Record provenance and redact
   material that cannot be sent to the selected destination.
2. Separate development and held-out examples by page/topic/source, including
   near-duplicates. Freeze rubric, split and context package before comparison.
3. Predeclare role-specific gates: minimum independent examples/runs, required
   label agreement, finding precision/recall targets, factual/meaning error
   limits, comparison margin and acceptable cost/latency. Unset gates mean
   "not qualified", not a pass.
4. Compare admitted routes on identical inputs/context. Blind and randomize
   human comparisons, repeat nondeterministic runs, and retain refusals,
   schema errors and incomplete outputs as outcomes.
5. Measure semantic review using span/rule precision and recall against
   adjudicated labels. Measure rewriting using human preference, retained
   meaning/facts, unsupported additions and instruction adherence. Retain
   markup/source validity and unresolved factual questions for both roles.
6. Use Token Economy's dated usage/pricing evidence for cost per accepted
   outcome, including rejected attempts and retries. Missing usage/price
   remains unknown. CLI/subscription quota is not automatically marginal API
   spend.
7. Publish cohort evidence and a human promotion/restriction decision. A
   factual or source-integrity hard-gate failure cannot be offset by average
   style scores. Zero observed failures describes the sample, not zero risk.

An LLM judge may triage cases but cannot alone certify its own model, factual
truth or source correctness. Preserve human disagreement and decisions.
Production acceptance feedback is observational evidence; it does not silently
replace held-out evaluation. Semantic failures prompt quality review;
host/provider failures remain operational evidence rather than proof of poor
prose quality.

## Planned admission sequence

1. Voice prepares a run specification: role/cohort, source/profile versions,
   output schema, context manifest, provisional/qualified mode and factual
   boundaries.
2. The trusted host resolves identities/evidence, maps the Voice role to the
   existing task/workflow contract and captures fresh availability.
3. The host calls the existing admission boundary with the actual intake
   estimate, evidence, `RequiredBenchmarkCapability`, capacity and any pin.
   Persist recommendation, selection, floor, reason, uncertainty and versions.
4. Voice checks the selected route against the exact cohort and execution
   mode. A selected but unqualified route yields a proposed host state
   `VoiceQualificationRequired`; it does not rewrite the Token Economy result.
   Missing, stale or ambiguous evidence cannot authorize a qualified run.
5. Launch only after admission, the Voice check and host credential/budget
   checks. `Wait` and `OverrideRequired` never launch. Record credential and
   budget limitations separately from editorial quality.
6. Validate output and actual route. Keep configured/requested, recommended,
   selected and effective identities distinct. An unexpected provider fallback
   is not silently treated as equivalent evidence.
7. Persist usage, accepted/rejected outcome and reason. Every reissue gets
   fresh admission/capacity evidence and stays within its configured budget
   and fallback scope.

The run specification, qualification store and `VoiceQualificationRequired`
state are proposed host contracts. No such Voice admission or qualification
runtime exists yet. Unknown
prices require a host budget decision: the existing router may retain
unknown-cost uncertainty rather than itself refusing the route. A catalogue
`RecommendationOnly` result also differs from router `Wait`.

Every future model-assisted run should show role, actual route, selection
reason, evidence status, destination and budget. Send only required context.
Page content, repository prose and model output cannot select endpoints,
credentials or source-write authority. Source changes retain the reviewed
proposal workflow; inference failure leaves local reports and feedback usable.

## First implementation slices

| Slice | Reviewable result and acceptance |
|---|---|
| Evidence contract | Versioned cohort/run records and Token Economy mapping; fixtures for unknown role, wrong locale/profile and missing snapshot |
| Offline qualification | Reproducible pilot, frozen gates and blinded report; retain costs, failures and unknowns |
| Routing adapter | Existing admission plus Voice prelaunch check; test qualified baseline, unqualified selected pin, qualified fallback, stale quota, unknown cost and no candidate |
| Studio workflow | Display persisted evidence and structured results; reject changed source/profile versions; preserve feedback and reviewed source diffs |
| Outcome loop | Idempotent run/usage/outcome ingestion and explicit requalification; no automatic promotion from one accepted rewrite |

The qualification, evidence-routing and outcome slices remain planned. Preview
0.2 implements a provisional Runner launch and persisted-result workflow, without
Token Economy admission or qualification gates. Implementation verification made
zero model calls; an explicitly configured operator action can launch one.

## Local sources and scope of claims

Read on 2026-09-06 in the `coding-agent-token-economy` repository:

- `docs/model-routing-api.md`
- `docs/system/domains/model-routing-policy.md`
- `docs/agent-studio-routing-integration.md`
- `src/TokenEconomy/ModelRouter.cs` (request, admission and cohort matching)

These establish existing routing/admission behavior. Voice-specific
capabilities, evidence export and the prelaunch adapter are the design here,
not claimed implementations in either project.

## Current offline measurement and next functions

The economic objective is total cost per accepted complete review, subject to
meaning preservation, missed-issue, false-change and latency criteria for the
exact locale/profile. Compare model choice and prompt organization together.
Useful findings are secondary; unnecessary edits do not improve efficiency.

The maintained `benchmarks/writing-review/` runner measures actual prompt volume
and lexical candidates on 30 authored EN/DE cases. It sends no model requests
and grants no qualification. See [the next-release function collection](plans/writing-review-next-release.md)
for context, validation, batching and Token Economy adapter work. The dated
official model/rate snapshot in `docs/research/` is research material, separate
from the canonical runtime catalogue and host admission.
