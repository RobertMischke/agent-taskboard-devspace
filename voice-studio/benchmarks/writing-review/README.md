# Writing review benchmark

For a prepared comparison of model cost effectiveness and matched prompt groups,
see [Model and prompt comparison](model-comparison.md). Its generator creates
canonical request payloads and unresolved candidate assignments without calling
a model; its verifier checks rule scope, source hashes and reviewer-label isolation.

This offline benchmark measures actual prompt construction and the local surface
scanner in `@voice/writing-rules`. It sends no requests to a provider, Runner or
model CLI. It does not measure LLM accuracy, output quality or paid token usage.

Run from the Voice Studio project root:

```sh
npm run build:writing-rules
node benchmarks/writing-review/run.mjs
```

The generated record is `test-results/writing-review/report.json`. This directory
is ignored by Git. The maintained fixtures and runner live beside this README.
The record includes fixture, runner and built-library hashes plus the catalogue
version. Timestamps change between runs; measured content and counts are
deterministic for the same inputs, runtime encoding and built library.

## Prompt comparison

Each fixture has the same audience, goal and source across four strategies:

| Strategy | Requests per fixture | Rule coverage |
| --- | ---: | --- |
| One request per rule | 20 | All 20 rules |
| One combined request | 1 | All 20 rules |
| One request per profile rule | 6 | Six public-docs rules |
| One profile request | 1 | Six public-docs rules |

The runner calls the real `composeWritingReviewPrompt` for every request. It
measures instructions, repeated source context and an explicit JSON envelope in
UTF-16 code units and UTF-8 bytes. The two comparisons within identical rule
coverage show how much repeated context batching removes. Comparing the six-rule
profile directly with twenty rules also changes the review scope.

The runner looks for locally installed `js-tiktoken` or `tiktoken`. If available,
it counts the benchmark envelope with `cl100k_base` and names that encoding. If
neither is available, token fields are `null`; characters are never presented as
tokens. Even an exact local encoding count excludes provider chat framing,
outputs and provider-specific cache accounting. No dependency is installed.

Each request asks for at most three findings. Separate requests therefore permit
more total findings. These measurements compare input construction, not equal
output budgets, latency, prices or the best review strategy. A measured reduction
in repeated input does not establish that a combined prompt produces better
reviews.

## Surface candidates

The 30 authored fixtures contain 15 English and 15 German examples: 16 lexical
problems, eight deliberate keep cases, four semantic problems and two clean
instructions. They are editorial examples, not outputs sampled from any LLM and
not a representative evaluation corpus.

Each label identifies a rule and exact quote worth reviewing in the supplied
context. The runner compares real `findWritingSignals` candidates with those
labels. It reports agreement, candidate precision, candidates on keep cases and
semantic cases with no candidate. This precision applies only to the fixture
labels; it is neither LLM accuracy nor a calibrated measure of writing quality.

Quoted examples, supported verification statements and enforced technical causes
are intentional keep cases. The scanner does not receive their context and may
flag them. Review remains necessary. Likewise, a document can contain semantic
problems and produce no lexical candidates. The record lists scanned and
unscanned rule IDs separately for each language.

## Evaluating model review

A model benchmark needs held-out documents, recorded provenance, multiple
reviewers and explicit handling of disagreement. Compare the same rules, source
context and accepted decisions across strategies. Measure useful findings,
missed problems, harmful rewrites and preserved facts before optimizing cost.

Authorized model runs must then record model versions, actual input/output/cache
tokens, latency, retries and output budgets. Those measurements are not included
in this offline benchmark.

## Retain a reviewed measurement

Run `npm run benchmark:writing-review` from the workspace. After inspecting the
report, run `npm run benchmark:writing-review:retain`, then `npm run website:build`.
Retention verifies the fixture, runner and Library hashes before replacing the
website summary. It excludes per-case raw records and keeps zero-model execution
explicit. Model rates come from the separately maintained dated official-source
snapshot in `docs/research/`; they are not measured invoices.
