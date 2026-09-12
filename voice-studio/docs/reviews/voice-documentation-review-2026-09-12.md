# Case study: reviewing Voice documentation against reader goals

## Goal and authority

The audience is a developer or reviewer who wants to **use Studio**, **integrate
the Library**, or **understand files and Git**. The user's feedback in this task
sets the objective: reduce documentation noise while retaining useful technical
detail. Language and layout controls should not dominate the introduction.

This assessment was made by the interactive coding agent during the task. It is
not a qualified automated Voice result. No Voice Runner execution or separate
model/provider API call was started for this assessment.

## Observed source

Captured **2026-09-12T11:56:46Z**, checkout HEAD
`3a3391bd1ff507844f3822597ee5f3f5c66c7209`. Paths below are relative to
`voice-studio/`. These are SHA-256 hashes of the observed working-copy bytes;
`docs/workflow.md` was modified relative to HEAD. They identify the review inputs,
not a public deployment or the subsequent corrected version.

```text
docs/workflow.md
77d4d983354b123a5c29aed72229843cd16f2170c397f9b26621aa3e1f66bc68
docs/usability.md
19f7f9070513d1621212e1684b1529e9bd74783def5b7f462e26b0cc36f884c4
website/guides.mjs
f3fa7f0de9e924c29d466a2f84d14f1030d6eb206e843ae0ce1cc76004a66682
website/render-guide.mjs
c6b96be8e525f6f3d96ca801923675627d7b6ec43b33d325627e9b6df66b4aa1
website/site.mjs
bdca5469889d70bc9ac38fc1328f755bcc520472fe0620f3eff6dae2582ca8df
```

Coverage: source content, documentation entry points and generated navigation
logic. This audit adds no browser capture, user study, SEO assessment or measured
task-completion result. Hashes alone do not preserve an immutable source snapshot.

## Findings and proposed changes

| Priority | Evidence | Reader impact and change |
| --- | --- | --- |
| High | `website/site.mjs`, Docs heading “Build against a clear contract”, followed by Library/backend cards and five contract sections. | Studio users enter through API concepts. Offer three goal-based paths first; retain contracts as reference. |
| Moderate | `website/guides.mjs`, `Start` group; `docs/usability.md`, “Language and available space”. | Session and display settings compete with the core task. Place optional controls in a secondary reference group. |
| High | `docs/workflow.md`, opening links and “Open and resume Studio”. | The guide assumes a running app and pairing code before explaining the first successful review. Lead with start, register/open, select, decide and verify; follow with setup variants. |
| Moderate | `website/render-guide.mjs`, open `guide-menu` and `next=guides[index+1]`. | All guides compete, and the next destination follows catalogue order. Collapse reference, planning and maintenance; select explicit next steps by task. |
| Moderate | `docs/usability.md`, “Current working copy versus historical results”; Docs “Project data…” links to planned project reviews. | Current storage is hard to distinguish from future contracts. Add a current file tree and a small JSON example; explain source versions, `.voice-lint` and history before linking the planned portable model. |

## Decision and recheck

Use these findings as an implementation checklist, preserving deep API material.
After changes, verify that each entry leads to its promised task, advanced groups
remain discoverable, and EN/DE navigation works at narrow and wide widths. Record
the changed inputs and actual results separately from this baseline assessment.

The reusable review pattern is **goal + source snapshot → coverage and findings
→ decision → change and recheck**. A future [Voice project evaluator](../holistic-review.md)
should retain those records and rendered evidence. Today that evaluator is
planned; existing sentence checks cannot establish documentation hierarchy.
No numeric Voice score is assigned.

## Current feedback audit

Reviewed the seven reference guides below for the user's reported documentation
noise: implementation history, defensive explanations and repeated material that
interrupts a reader's task. Technical prerequisites and behavior limits were
retained. This is an interactive source review, not a Voice Runner result.

### Findings and changes

| Source | Before | After / decision |
| --- | --- | --- |
| `docs/library-types.md` | The introduction inventories editor features twice and discusses a planned CLI; local setup says the documentation "does not claim" a registry release. | Lead with host-supplied findings and the available type entry points. Tell the reader to build the local package before consuming it. Preserve coordinate conversion, client preconditions and verification limits. |
| `docs/runner-integration.md` | A duplicated adapter introduction, implementation-machine NuGet cache history and old assertion counts interrupt configuration. Check-service details repeat their own reference; a future routing paragraph appears among current operations. | Explain configuration and the pinned dependency directly. Keep current route limitations in configuration, link to the check reference, and replace obsolete counts with the live-route verification action. Preserve source/context checks, process permissions, output validation and task states. |
| `docs/browser-session.md` | Inspected pairing, origin/profile scope, expiry, HTTP inputs, resume/retry behavior and verification scope. | No change. These details explain how to recover access and use the session API; removing them would obscure conditions under which pairing is required. |
| `packages/review/README.md` | "second linter" and "concept specimen" refer to internal context. The type-test explanation repeats the dedicated guide; source-write limits recur after the iframe contract. | State host analysis ownership and category colors directly. Link to complete type-test details and retain the source-edit boundary once, alongside persistence and mapping requirements. |
| `packages/review/LIVE-BRIDGE.md` | The introduction repeats that Studio leaves the application's HTML at its own origin, and the protocol repeats the credential exclusion. | Remove those two repetitions. Retain exact-origin checks, development opt-in, credential exclusion, mapping rules, protocol messages and iframe constraints. |
| `backend/CHECKS.md` | The setup explains a named pilot and includes its historical file/byte count; the introduction lists every operation that does not start checks. | Use a portable Angular configuration example and state that checks start only on request. Keep command permissions, input limits, staleness, idempotency and process-test scope. |
| `scripts/README.md` | The opening repeats non-automatic behavior already recorded per command; a paragraph narrates the retirement of two scripts. | Keep the command catalogue, side effects and scenario prerequisites; remove migration history. Link directly to retention categories. |

### SourceRef after changes

Captured **2026-09-12T12:18:22.645Z**, checkout HEAD `3a3391bd1ff507844f3822597ee5f3f5c66c7209`.
Paths are relative to `voice-studio/`; SHA-256 identifies the reviewed
working-copy bytes after these edits, including the unchanged session guide.
These references do not identify a deployed website. The earlier observed-source
snapshot and its findings above remain unchanged.

| Path | Change | SHA-256 |
| --- | --- | --- |
| `docs/library-types.md` | Edited | `ff1dc61665c68bf465a857510787ceee31a65331150eaae09b816ae94795f3c3` |
| `docs/runner-integration.md` | Edited | `2b65991dd3138596ae43e070235979bc7b2749eda0adba2366ae1d6f120a8242` |
| `docs/browser-session.md` | Unchanged | `bf964dc338b2f4b1e9ed9037c8e2b8d603f9167be0dba7ceb2081035f0546f40` |
| `packages/review/README.md` | Edited | `e2349c978d0a22f1ed21bfedeabdf4d49baeb08c6fb97e4a1d80250376bc03ef` |
| `packages/review/LIVE-BRIDGE.md` | Edited | `e183a733a6aac8b125be519a8df62c313b23074ce2ef6a529bb0d012280f3504` |
| `backend/CHECKS.md` | Edited | `91ca859ff81eaf241077c113c54ca1aba84d516e890cfe3425ac7970ef84af3d` |
| `scripts/README.md` | Edited | `90f0a2899c77f94f7adc623f6bbaed28e56ad7ae080d1c31283cf7c94f6d616a` |

### Recheck scope

Reviewed the complete resulting text of these seven files and checked their
relative Markdown link targets. No build, browser scenario, model run or runtime
test was performed for this wording-only audit. The references above bind this
review to the edited source, not to a new product qualification result.

### Follow-up: preserve feedback retry identity

The Library README's save example previously generated a request ID inside the
send function. Calling that function after an uncertain network failure would
create a new request, contrary to the retry instructions below it.

The example now prepares and freezes the feedback payload once, then passes it
to a separate send function. Retrying uses the same request ID, source version,
review revision and feedback fields. A changed note or reviewed conflict creates
a new payload. The extracted JavaScript example passed strict TypeScript
`checkJs` checking against the exported Library types, with declarations for the
host-supplied controller, IDs, token getter and conflict handler. No backend or
browser request was made.

Follow-up SourceRef, captured **2026-09-12T12:24:32.580Z**, checkout HEAD
`3a3391bd1ff507844f3822597ee5f3f5c66c7209`:

| Path | SHA-256 |
| --- | --- |
| `packages/review/README.md` | `a7fc37e9397b6b54e87bd349c24fe77f31496a6a20fe787b5baf6323b2662920` |

This is a later README revision. The previous audit's timestamps and hashes above
remain the observations recorded at that time; they have not been replaced with
the follow-up hash.
