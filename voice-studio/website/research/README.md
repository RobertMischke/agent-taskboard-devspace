# Voice research data

These maintained source records power `/voice/research/`. They are a product
research collection, separate from technical usage guides and dated test evidence.

| File | Content |
| --- | --- |
| `practice.json` | Firsthand observations, opinion pieces and prompt directories |
| `studies.json` | Original studies with methods, findings and limitations |
| `strategies.json` | Evidence concerning interventions and writer control |
| `libraries.json` | Officially documented capabilities, licenses and maintenance |
| `review-economics.json` | Retained offline measurements and a dated official model/price snapshot |

The four source collections use `apiUse.availableNow` for existing exports,
`apiUse.currentUse` for their concrete use, and `apiUse.missingCapability` for the
gap. `apiUse.releaseFunctionIds` refers to the proposed function collection in
`docs/plans/writing-review-next-release.json`; those names are not shipped APIs.

Records have a stable `id`, `kind`, original HTTPS `url` and `relatedRuleIds`
matching `packages/writing-rules/src/catalogue.json`. Text is an original English
summary. A null publication date means it was not established; access dates stay
in `readingDepth` or `maintenance.checkedAt`. A study's linked revision can differ
from its initial publication date; `readingDepth` identifies what was read.

Separate observation or measured findings from limitations and Voice's own
assessment. Identify preprints and methods, preserve conflicting findings, and
do not infer a provider failure rate from anecdotes or corpus shifts. Never
silently turn a proposed integration into an installed capability. Link exact
official licensing and release evidence; dependencies and rule packs may have
their own licenses.

The website renders this same data, publishes the four source collections and economics record through the JSON
viewer, and hashes every input into its build record. `test:research` checks
references, public access, responsive rendering and source-record dialogs.
Adding sources does not automatically change shipped rules or Studio checks.

The economics record also retains three full-text prompt-organization research
assessments from `docs/research/prompt-organization-sources-2026-09-12.json`.
Their API applications are our assessment; they do not establish Voice model
quality. Keep rule bundling, sample packing and provider Batch APIs distinct.
