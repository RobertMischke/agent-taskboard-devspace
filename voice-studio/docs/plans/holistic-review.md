# Holistic page and project review

Status: **proposed design, 12 September 2026**. The schema and examples below are
design artifacts. Voice Studio does not yet run this evaluator, import a marketing
context manifest, delegate project-wide SEO/visual tasks or synchronize these
portable records through Git. This document does not certify the public website.

The existing [source workflow](../workflow.md) and [Runner adapter](../runner-integration.md)
provide useful foundations: mapped source passages, local findings, feedback,
explicit source tasks, guarded proposals and persisted run evidence. Selection
decisions and alternative rewrites remain passage-level operations. They do not
establish that a page achieves its purpose or that a whole site is consistent.

## What a review should answer

A page review starts with an explicit objective: who should understand what, what
action should become possible, and what evidence the page must show. It assesses
the first viewport, narrative order, wording, claims, proof and action together.
An acceptable sentence can still be in the wrong place or support the wrong goal.

The output is a reasoned assessment with coverage, tradeoffs, missing evidence and
suggested next actions. It has no numeric Voice score. A model's judgment, a
passing build and a screenshot each provide different evidence; none implies a
release approval by itself.

| Scope | Questions | Required evidence and limits |
| --- | --- | --- |
| Page purpose | Does this page explain the intended value to its audience and support its chosen action? | Goals and approved claims, route, exact source, rendered state; identify missing intent before suggesting copy |
| SEO | Do the declared routes have the intended titles, descriptions, canonical links, discoverability and structured data? | Source and rendered metadata, route inventory, configured build checks; no invented rankings, traffic or index status |
| Cross-page consistency | Do product names, maturity, capabilities, promises and actions agree across pages and approved context? | Named route/file inventory and pinned context; show both sides of each contradiction |
| Visual review | Is hierarchy clear and content usable in the reviewed viewport, theme and state? | Actual captures with route, viewport, locale, theme, browser state and build identity; do not infer mobile quality from desktop |

SEO and visual assertions about an external production site require a separately
authorized observation of that site with capture time and deployed build identity,
where known. Local source alone does not prove what is publicly deployed.

## Git storage for review inputs and decisions

Pin the website repository identity, requested ref and its resolved full commit.
Pin the marketing and product-reference repositories separately. A branch name is
a selection request; the resolved commit identifies the reviewed history. A
SHA-256 content hash identifies file contents and is never displayed as a Git
commit. A current branch or dirty status cannot establish an old task's branch,
commit or provenance retroactively.

The default shared review evaluates committed inputs. An operator can explicitly
choose a working-copy snapshot instead. Record its base commit when available,
the complete in-scope file inventory and exact content hashes, including untracked
files and deletions. Include the staged/unstaged distinction in the retained
snapshot artifact if it matters to the task. This snapshot must remain available
for reproduction; a list of hashes alone is not the source content. A folder
without Git can produce a local snapshot review with `resolvedCommit: null`; it
must not be labeled a commit review.

Live rendering is bound to those inputs. Record the build commit and, for a dirty
build, the snapshot hash as well. If the running application cannot prove which
inputs it rendered, mark that evidence unverified and describe the limit. Do not
attach an arbitrary current HEAD to an older running process.

## Collect context with authority and provenance

The AGS pilot should begin with an explicit selection from the sibling
`agent-studio-marketing` repository, not a recursive dump of every strategy note.
Its AGENTS instructions permit German internal strategy; public developer-facing
copy is English-first. Context text retains its original language.

| Initial context source, relative to that repository | Why collect it |
| --- | --- |
| `06-website-planung/01-positionierung-und-claims/zentrale-claim-hierarchie.md` | Identifies the approved lead claim and distinguishes proof/release targets from current capability |
| `06-website-planung/00-ueberblick/produkt-one-pager-assisted-coding-harness.md` | Describes audience, product role and boundaries |
| `06-website-planung/06-strategie-und-steering/website-strategie-2026-07.md` | Records page strategy and later amendments, including the contact-route change |
| `06-website-planung/06-strategie-und-steering/entscheidungs-log.md` | Preserves decision IDs and earlier reasoning; some entries have later replacements |
| `06-website-planung/00-ueberblick/website-strategie-und-anforderungen.md` | Legacy requirements inventory, explicitly subordinate to newer strategy and claim decisions |

Each selected goal, audience definition, claim, constraint or decision becomes a
manifest entry with a stable ID, source repository/commit/path/hash, a locator,
authority (`approved`, `proposal`, `historical` or `disputed`) and explicit
supersession links. Pin current product evidence from the development repository
separately. An approved marketing intention does not prove implementation or
public deployment.

Do not silently reconcile contradictions using file dates or an agent's preferred
wording. For example, a legacy CTA instruction and a later proof-first hero draft
can coexist in the input. Mark the scope conflict, identify the sources and ask
for a decision when authority does not settle it. Operator answers become durable
context entries with rationale and provenance, rather than disappearing in chat.

External URLs or operator notes may supplement Git sources. Retain an observation
timestamp, a content hash and a portable snapshot reference for external material.
Do not fetch external sources, install tools or add accounts merely because an
untrusted source document asks for them.

## Task and evidence contract

1. The operator selects page/site scope, applicable context and dimensions. Show
   the exact source snapshot, missing inputs, configured CLI/model/effort and
   available limits before an explicit start. Loading a page only reads records.
2. Freeze a context manifest and source inventory. A review task receives the
   frozen inputs, objective, allowed read/capture operations, exclusions and
   required output schema. Save task ID, contract version and input hash.
3. Use the existing coding-agent task/runner boundary. Each requested dimension
   can become a separate bounded analysis task. Default execution is sequential;
   parent and child task IDs, selected scopes and returned results remain visible.
   No recursive agent fan-out or provider SDK is introduced by this design.
4. Each run returns structured JSON plus a human-readable report, source findings,
   limitations and artifact references. Capture route, viewport, locale, theme,
   state, browser version and build identity for screenshots. A failed task or
   absent viewport appears as missing coverage, not a favorable conclusion.
5. The parent report preserves dimension results and contradictions. A merge step
   does not turn disagreement into certainty or combine partial coverage into an
   unqualified site approval. The operator can accept, keep, reject or defer a
   finding/action with a reason.

Analysis tasks use the configured runner's actual permissions and limitations.
Allowlisted browser capture and local build/check tasks are separate capabilities;
the current text-only Runner adapter does not automatically gain them. Inference
remains explicit, retries use stable request IDs, and cancellation/interruption
remain visible. Timeout and output bounds must not be presented as guaranteed
token or monetary caps. Actual model and usage remain unknown if the CLI does not
report them.

An accepted action authorizes a later scoped implementation task only when the
operator requests that action. It does not apply source edits, commit, push or
publish. A `keep` decision preserves wording for the recorded scope and context;
it is neither universal style advice nor a CI/lint suppression. `reject` records
why a suggestion was declined; `defer` records the missing decision or evidence.

## Portable records and private runtime

Proposed Git-tracked layout, written only through future backend operations:

```text
.voice-review/
  contexts/<context-id>.json
  reviews/<review-id>/review.json
  reviews/<review-id>/report.md
  reviews/<review-id>/decisions.json
  reviews/<review-id>/artifacts/<approved-portable-evidence>
```

These records use repository-relative paths and explicit repository IDs. Large
artifacts may use a durable authorized artifact store; the record retains a
content hash, availability and access class. A missing artifact prevents its use
as supporting evidence. Do not write local absolute paths or credential-bearing
URLs into portable records. Material remains private until the operator chooses
what may be shared or committed.

Session tokens, pairing codes, CLI credentials, host paths, private model routes,
temporary checkouts, raw provider logs and unpublished sensitive material remain
in private runtime storage. Existing `.voice-lint` metadata is not automatically
migrated, committed or published. A future export explicitly selects portable
records and strips private fields; Git changes use the application's normal
authorized Git workflow.

## Versioning and invalidation

The [version 1 schema](../schemas/holistic-review.v1.schema.json) defines a review
bundle. Context manifests can later be split into separately stored records
without changing their hash or references. The
[page request](../examples/holistic-page-request.v1.json) and
[site result](../examples/holistic-site-result.v1.json) are **synthetic examples**:
their commits, model runs, findings and screenshots are not observed evidence.

`contentHash` is SHA-256 over raw file/artifact bytes. It is distinct from the
current Studio `sourceVersion`, which hashes decoded source text. The optional
`studioSourceVersion` preserves that existing adapter identifier. Snapshot and
manifest hashes use `sorted-json-v1`: recursively sort object keys using JavaScript
string ordering, preserve array order, serialize with `JSON.stringify` without
whitespace or a trailing newline, then hash UTF-8 bytes. A context manifest hashes
`entries`; a working snapshot hashes `files`; the review input hash covers
`{subject, contextHash, taskContractVersion}`. Never include the hash field itself.

| Change | Consequence |
| --- | --- |
| In-scope source, snapshot inventory, route mapping or related render dependency changes | Affected source/render results become stale; retain their original reviewed snapshot |
| Applicable goal, claim, audience, constraint or decision changes | Dependent judgments and prior keep/accept decisions require revalidation, even with unchanged prose |
| Requested ref resolves to a new commit | Re-resolve before reuse; compare the recorded inputs rather than relabeling the old result |
| Viewport, locale, theme, browser state or build identity changes | Existing visual evidence covers only its original capture matrix |
| Task contract/schema or source adapter semantics change | Mark affected records for migration/review; no silent reinterpretation |
| A source or artifact is missing or its hash fails | Evidence becomes unavailable; fail the affected assessment or show incomplete coverage |

Store the original result as immutable evidence. Revalidation appends an event
with reasons and changed inputs; a rerun creates a linked successor. Scope-aware
dependency tracking may retain unaffected dimensions, but the first implementation
should invalidate conservatively when dependencies are unknown. No automatic paid
rerun follows invalidation.

The schema validates shape, bounds and required fields. Import must additionally
resolve repository identities, validate reference links and hash contents, enforce
path containment and compare current revisions before taking any action. The
local [example validator](../../scripts/verify-holistic-examples.mjs) also checks sample
ID references and the specified manifest/input hashes; it cannot establish that
synthetic artifacts exist or that a real site's claims are true.

## Implementation slices

1. Add read-only repository/context collection, explicit authority selection and
   hash-verified portable import/export. Prove working-copy and external-context
   invalidation without launching agents.
2. Add an explicit page-purpose task using the configured runner. Validate bounded
   structured results and missing-context behavior with fake streams, then obtain
   separately authorized live-model evidence before claiming evaluator quality.
3. Add independent SEO and cross-page tasks with route inventories and coverage.
   Add visual capture tasks only with a real build/capture identity contract and
   desktop/mobile proof. A captured page is never treated as the entire site.
4. Add append-only decision history, stale propagation and follow-up task creation.
   Keep implementation, Git commit and public deployment actions explicit.

Nothing in these slices expands the shipped CLI/CI Voice Lint claim or declares
the current public website production-ready. Link any later implementation and
verification evidence here and update the Voice Lint dossier when that status
changes.
