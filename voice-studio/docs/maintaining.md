# Product files, reusable tools and verification evidence

The original readiness folder mixed several different things. Only some belong
to the product. The maintained structure gives each kind an explicit owner and
retention policy.

| Location | Purpose | Git / distribution |
| --- | --- | --- |
| `frontend/`, `backend/`, `packages/` | Application, source operations, contracts and reusable review library | Product source; built through the normal package commands |
| `knowledge/`, `examples/` | Rule explanations, sample sources and library integrations | Maintained product resources; examples are clearly labeled |
| `website/` | Public product/documentation website and deployment manifest | Maintained source; only its explicit static build is published |
| `scripts/` | Supported build, operation and verification commands | Developer/operator tooling; not code shipped into the reviewed page |
| `scripts/integrations/`, `docs/integrations/` | Explicit connections to other repositories, including dossier VL-W1 | Documented integration tooling and maintained inputs; not a Studio runtime dependency |
| `docs/schemas/`, `docs/examples/` | Proposed portable review format and synthetic examples | Design contracts, clearly distinguished from implemented evaluators |
| `docs/verification/<date>/` | Curated reports and selected evidence supporting a dated claim | Git-ready historical records with scope and file hashes; not a current test pass |
| `test-results/` | Regenerable test output, screenshots and temporary test builds | Ignored; successful output is selected and reviewed before becoming evidence |
| `**/dist/`, `**/bin/`, `**/obj/` | Generated build output | Ignored; regenerate from source |
| `.local/maintenance-archive/` | One-off patch scripts, raw snapshots and investigation residue | Ignored local history; not a supported command or a public artifact |
| `.voice-studio/`, `.voice-runtime/`, private user application data | Local configuration pointers, runtime state and credentials | Private and ignored; never copied into public evidence or the website |

## Reuse a supported command

The [command catalogue](../scripts/README.md) explains prerequisites, side effects
and outputs. Examples include `npm run pairing-code`, `npm run website:build`,
`npm run test:source-provenance` and the dossier synchronization commands.

Use `npm run test:source-provenance -- --help` to verify a registered source's
current content hash and optional Git context without embedding one pilot's
project or task ID in code. Source/task mutation remains behind Studio's backend.
Checking a document can trigger the backend's normal read/recovery behavior;
the verifier does not request a source write or start a model.

## Retain evidence without turning it into application code

After a verification run, preserve a small record of what actually ran: capture
time, source revision or working-copy state, covered scenarios, exclusions and
observed results. Keep selected supporting screenshots or machine-readable
results beside that record. A manifest hashes retained files so future changes
are detectable. Copy time is not the original verification time.

The [12 September record](verification/2026-09-12/README.md) is the first curated
record from this session. It is historical evidence for local Preview 0.3, not a
claim that another checkout, browser or model is qualified. Reports omit private
session information, unnecessary local paths and raw operator instructions.

Fresh test output continues to go to `test-results/`. A future run must not
overwrite a historical verification claim and silently inherit its date. Add a
new observation or dated record, with the changed inputs and actual result.

## One-off maintenance history

The former devspace `artifacts/voice-readiness-2026-09-12/` directory is retained
locally under `.local/maintenance-archive/2026-09-12/readiness-session/`. Its
inventory records original relative locations, sizes and SHA-256 hashes. The
move preserves bytes; it does not turn those files into reusable programs.

Examples such as `localize-main.mjs`, `integrate-selection.mjs`, `fix-*.mjs` and
the dated `update*.mjs` patches depend on exact earlier source text. Replaying them
against current code could duplicate imports or undo later edits. Their intended
behavior is now in product source and the supported scripts. Raw project/registry
snapshots and old screenshots remain recovery context, not public documentation.

No runtime code, website build or supported command may import this archive.
If a maintenance capability is needed again, extract a parameterized tool with
clear inputs, side effects, failure handling and verification before reusing it.

## Review results are a different kind of artifact

The proposed `.voice-review/reviews/<id>/artifacts/` records in the
[holistic review design](holistic-review.md) are evidence produced by a product
review task. Their route, viewport, build, source and content hashes belong to
that task's data model. They are not the development-session scratch directory.
The name “artifact” is useful there because the files support a specific result;
their structure and lifecycle are part of the proposed product contract.
