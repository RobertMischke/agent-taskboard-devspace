# Model and prompt comparison

The pilot prepares a paired experiment for choosing a model and a prompt shape
by the **cost of an accepted complete review**. It uses the current Library to
compose each prompt. It does not invoke a model or establish a winning model.

```sh
npm run build:writing-rules
node benchmarks/writing-review/prepare-model-comparison.mjs
node benchmarks/writing-review/verify-model-comparison.mjs
```

The output is the ignored `test-results/writing-review/model-experiment.json`.
Source, Library, research snapshot and preparer hashes identify its inputs. The
maintained runner, contract verifier and authored cases live in this directory.
No credentials, runtime configuration or model output enter the prepared file.

## Compare identical coverage

| Coverage cohort | Prompt organization | Requests per source | Maximum findings per complete review |
| --- | --- | ---: | ---: |
| Six public-docs rules | One rule per request | 6 | 6 |
| Six public-docs rules | One bundle | 1 | 6 |
| Six public-docs rules | Two coherent groups | 2 | 6 |
| All twenty rules | One rule per request | 20 | 20 |
| All twenty rules | One bundle | 1 | 20 |

The first group combines `reader-goal`, `current-state` and `task-relevance`:
does the current information help the reader act? The second combines
`process-history`, `meta-framing` and `calibrated-uncertainty`: does framing or
unnecessary qualification delay that information? Membership comes from the
actual public-docs profile; a changed profile stops preparation until these
groups are reviewed. Group coherence is an experiment hypothesis, not a measured
quality improvement.

Each condition receives the same source, context, audience and goal. The source
has a neutral ID; fixture names such as `keep` are not sent. EN/DE versions are
paired for stratified comparison, not presumed linguistically interchangeable.
Rules and the response contract precede source material, making useful prefix
reuse possible without adding filler. Cache eligibility and savings still need
provider measurements.

The original byte benchmark requests three findings per call. This new pilot
instead asks for at most **one finding per rule**. The canonical prompt uses
`maxFindings` equal to the selected rule count. An additional answer contract
requires exactly one `keep`, `change` or `needs-evidence` result for each rule.
Only `change` can contain a finding, with one to three alternatives. The local
`validateModelResponse` function checks that contract, source version and quoted
UTF-16 span. A structurally valid answer is not a correct editorial judgment.

This matches selected rules and finding cardinality. Provider output-token caps,
explanation length, reasoning, quality and latency remain separate experimental
controls. The one-finding cap cannot measure every occurrence of the same rule.
Do not combine the six-rule and twenty-rule recall denominators: omitted rules
are outside scope. Deduplicate one underlying issue attributed to several rules
when counting useful findings, while preserving rule-specific judgments.

## Model assignments

The dated research snapshot supplies four unresolved candidate references:
`gpt-5.6-luna`, `claude-haiku-4-5-20251001`, `gemini-3.5-flash-lite` and
`gpt-6-astra`. The first three are efficiency candidates; the fourth is a
reference condition, not ground truth. The prepared record copies their research
IDs and starting hypotheses. It is not a second routing catalogue or allowlist.

Thirty sources yield 900 prepared requests across five conditions. Four
candidates yield 3,600 candidate/request assignments and 600 complete-review
conditions for one repetition. These are unexecuted assignments, not calls made,
a required launch batch or a spend estimate. A smaller selected pilot remains
paired when every compared model and strategy receives the same selected cases.

Before execution, resolve supported models and parameters through the installed
Token Economy and host. Record requested and returned IDs, reasoning settings,
output-token caps, concurrency, retry policy and cache mode. Randomize or
counterbalance run order; repeat conditions to observe variance. Unresolved
route, ordering, usage, cost and response fields are `null`. A change in model
settings creates a separate condition rather than silently changing the baseline.

## Decide on cost effectiveness

An accepted complete review covers every requested rule, preserves facts and
intent, makes justified keep/change decisions and passes source/response
validation. A correct keep result counts as useful completion. Independent
editorial judgment supplies acceptance; a more expensive model does not supply
the answer key.

For each model, prompt strategy and coverage cohort, divide the cost of **all
attempts** by accepted complete reviews. Include errors, retries, invalid outputs
and any escalation once. Report the acceptance count and unresolved costs next
to the ratio. A cheaper per-token rate can lose if it misses contextual problems
or causes more retries. Do not substitute findings per dollar: verbose or
duplicated findings can make that figure look better without helping the reader.

Report rule-specific precision and recall with denominators, semantic misses,
false changes on legitimate keep cases, fact/intent preservation and reviewer
disagreement. Record actual input, cache write/read and billed output/reasoning
tokens. Apply shared Token Economy pricing to the resolved route; unresolved
billing dimensions and unknown usage stay unknown. Record complete-review and
per-request latency, p50/p95, errors, queue time and sequential/parallel scheduling.
Separate cold and warm cache conditions.

Cheap-first escalation needs a separate condition: define its triggers, measure
both stages, and independently sample cases it did not escalate. Otherwise a
low cost may merely reflect missed problems. Provider asynchronous Batch and
bundling rules inside one prompt are different conditions with different latency.

## Pilot limitations

These 30 authored examples are for debugging prompts, execution and scoring.
Their supplied context sometimes makes the intended judgment explicit. They are
not held out, representative product writing, independent ground truth or a
production qualification set. `reviewerOnly` stores labels and scope-specific
denominators outside every request payload. The verifier mutates those labels
and checks that every prompt hash remains unchanged.

Add provenance-recorded long pages, real supported and unsupported claims,
accepted decisions, multiple occurrences, and independently reviewed EN/DE
documents before selecting a production configuration. Keep held-out evaluation
separate from prompt tuning. The preparation contains no measured model quality,
provider token use, invoice cost, latency or AI-authorship score.

## Reviewer record

The generated file includes a separate acceptance-record template. Fill it after
independent review; a null value means unassessed. This is reviewer data, not
instructions sent to a model:

```json
{
  "reviewId": null,
  "candidateId": null,
  "attemptIds": [],
  "reviewerIds": [],
  "ruleJudgments": [],
  "sourceAndResponseValid": null,
  "factsPreserved": null,
  "intentPreserved": null,
  "harmfulChange": null,
  "unresolvedDisagreement": null,
  "acceptedCompleteReview": null,
  "rationale": null
}
```

Each rule judgment records the selected rule, warranted findings, false changes,
missed problems and whether keeping the passage was correct. Acceptance requires
resolved judgments for the full selected scope, valid source and response,
preserved facts and intent and no harmful change. Attempt IDs associate failures,
retries and escalation with the review so all costs can be counted once. Zero
findings can be an accepted complete review when keeping the text is justified.

## Run in stages

The full 3,600-assignment matrix is a prepared request corpus, not the initial
launch. Its inert phase metadata supports this smaller sequence:

1. Establish the pipeline and six-rule quality baseline with one bundled prompt
   for all 30 sources on the three efficiency candidates: **90 assignments**.
2. Compare single-rule, two-group and bundled prompts on three explicit EN/DE
   pairs (meta framing, a quoted keep case and process history): **162 diagnostic
   assignments** across the three efficiency candidates. Those six sources are
   a deliberately selected debugging subset, not a model ranking corpus.
3. Select conditions after reviewing those results, then confirm them on all 30
   paired sources and a held-out corpus. Keep the source set fixed across every
   compared condition; record repetitions, cache and order separately.
4. Evaluate all twenty rules as a separate coverage cohort. Add the stronger
   reference condition after the pipeline works and retain independent judgment.

The diagnostic bundles overlap baseline requests. Reusing a response is not a
new independent measurement; rerunning it must identify the new repetition and
cache condition. Later phase assignment counts remain unknown until conditions
are selected. This metadata neither resolves a route nor launches any work.
