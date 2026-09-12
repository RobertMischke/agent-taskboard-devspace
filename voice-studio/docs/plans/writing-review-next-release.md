# Writing review: next release candidates

Status: proposed function collection. None of the new names below is a shipped
API. The current API is documented in [writing-rules.md](../writing-rules.md).

The [structured collection](writing-review-next-release.json) defines each
function's inputs, outputs, dependencies and acceptance criteria. Research
records in `website/research/*.json` link to these stable IDs through
`apiUse.releaseFunctionIds`; their `apiUse.availableNow` lists existing functions.
This makes the distinction between useful evidence and implemented capability
reviewable in Git.

| Priority | Proposed function | Result |
| --- | --- | --- |
| P0 | `buildReviewContext` | Reader goal, source authority and accepted decisions |
| P0 | `validateReviewFindings` | Exact source/evidence references and explicit coverage |
| P0 | `composeWritingReviewBatch` | Bounded jobs with shared context and compatible rules |
| P0 | `estimateReviewUsage` | Token accounting, cost bounds and actual usage |
| P0 | `evaluateReviewPrompts` | Reproducible quality, latency and cost comparisons |
| P1 | `checkClaimEvidence` | Supported claims, unresolved facts and evidence gaps |
| P1 | `compareReviewAlternatives` | Useful distinctions and preserved intent |
| P1 | `protectReviewDecisions` | Applicable keep decisions and stale constraints |
| P1 | `reviewProjectConsistency` | Findings across explicitly selected source files |
| P2 | `adaptEngineFindings` | Qualified external diagnostics with source mapping |

P0 establishes the context, validation and measurement needed to assess the P1
functions. P2 starts with one qualified engine; the research catalogue does not
commit the product to integrating every listed library. This collection is a
planning input, not a promise that every candidate will ship together.

## Compare useful review work per unit of cost

The objective is the lowest observed total cost per accepted complete review
that meets declared quality and latency criteria for its language and profile.
A spending ceiling bounds execution; model choice and prompt organization
determine whether the resulting reviews are economical.

A separate prompt for each rule repeats instructions and source context. Combining
rules reduces requests, but can change attention, coverage and output length.
Compare the same six rules individually and together before using that result
to choose between a six-rule profile and the complete twenty-rule catalogue.

Keep the source snapshot, selected rules, prompt bytes, model ID, parameters,
tokenizer and pricing date with each attempt. Provider-reported input, cache and
output/reasoning usage must remain separate. Report retries, failures, latency
and accepted complete reviews. Count every attempt once, including rejected
outputs and both stages of escalation. Useful findings are a secondary measure;
more edits are not automatically a better outcome.

The first local measurements live in `benchmarks/writing-review/`. They use the
real package with authored EN/DE fixtures. Lexical candidates and prompt volume
are measured separately from semantic correctness. Model comparisons require
explicit runtime access and a spending ceiling; repository policy cannot choose
credentials, providers or paid fallbacks.

Use the existing [AGT pipeline plan](agt-voice-pipeline.md) for host task/result
storage and the [authorship qualification plan](ai-authorship-assessment.md) for
origin research. Writing-quality findings remain independent of authorship.

## Reuse Token Economy

Apply the ownership and route checks in [model-strategy.md](../model-strategy.md).
Voice owns rubrics, fixtures, locale/profile cohorts and editorial acceptance.
Token Economy owns canonical model/provider/CLI identities, price knowledge and
routing evidence. The host owns admission, credentials, capacity, hard budgets
and execution. The official model-price snapshot is research, not a second
runtime catalogue or an allowlist.

Use `ModelPriceCatalog.ResolvePrice` / `ComputeCost`, `TokenUsage` and
`CostBreakdown` through an adapter. The current price model has input, output,
cache-read and cache-write rates with validity dates. Batch rates, context tiers,
cache retention/storage and unknown provider charges require explicit shared
modelling or an unsupported result. Missing cache rates currently fall back to
input rates; that fallback is not proof of accurate provider billing.

Map Voice evaluation to `BenchmarkDefinition`, `IBenchmarkInvoker`,
`BenchmarkRunner` and `RoutingEvidenceAggregator` / `RoutingEvidenceReport`.
`BenchmarkRunner` checks cost caps after invocation, so the host must add a
prelaunch reservation/check for a hard budget. Its usage contract cannot simply
represent unknown values as zero. `OutcomeEfficiency.ComputeObserved` measures
accepted deliveries; define a review-to-delivery mapping and allocate each
attempt cost once before deriving per-finding measures.

Every attempt needs current host admission, including retries.
`RequiredBenchmarkCapability` selects an evidence cohort; it does not guarantee
that every baseline or pinned route satisfies Voice qualification. Resolve
research candidates against the installed canonical catalogue and explicitly
admit provisional experiments. Unsupported identities require an update there
or no execution; never silently substitute a route or invent complexity scores.

The [prepared model comparison](../../benchmarks/writing-review/model-comparison.md)
contains paired EN/DE sources, actual single/grouped/bundled prompts, a matched
one-finding-per-rule contract and a separate reviewer record. Use
`npm run benchmark:writing-review:prepare-models` and
`npm run test:writing-review-models`. These commands prepare and validate local
inputs; the proposed runtime adapter and measured model results remain open.
