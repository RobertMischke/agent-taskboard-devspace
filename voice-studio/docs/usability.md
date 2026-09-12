# Review choices, language and source provenance

Implemented local Preview 0.3 update, 12 September 2026. This guide describes
the Studio controls, not the planned holistic page/project evaluator.

## Language and available space

English is the default, independently of the browser language. Select **EN** or
**DE** in the header. The preference survives reopening when browser storage is
available. Interface labels, rule explanations and the rule wiki switch language;
source quotations, personal feedback, decisions and agent prose retain their
original language. The document language and title follow the interface choice.

**Full** keeps the normal navigation. **Compact** reduces its height. **Website
focus** gives the live page the viewport and opens navigation and review as
overlays. The floating controls reopen them. Escape closes an overlay; the
navigation dialog supports keyboard focus. The chosen display mode is saved.

## Keep or compare a change

Select a mapped passage or open a finding. **Keep as written** stores a durable
decision tied to the exact passage and source version. A reason is optional.
This does not edit the source or disable a local rule or future CI check. Changed
source makes the old decision stale rather than a current approval.

An existing rule suggestion is shown when one is available. **Generate
alternatives** explicitly asks the configured Runner route for one to three
distinct replacements with reasons. It does not invent three variants merely
to fill the interface. No route is configured by default. Failed or incomplete
output is reported; a useful replacement is not guaranteed. Model output stays
in its original language. An optional direction can guide generation.

**Review this change** prepares a proposal through the existing backend. It
does not apply it. Read the diff, then explicitly apply and verify the source and
rendered result. A removal is labeled as removal. **Your feedback (optional)**
and **Your wording (optional)** remain collapsed until needed.

Runs persist independently of the selected passage. Active runs in the current
document remain visible and cancellable after selection or source changes, while
candidate application requires the exact current selection and source version.
An unconfirmed start retains its request ID and exact payload for an idempotent
retry. Tab storage preserves this across reload when available; blocked storage
provides only an in-memory fallback. Opening pages never starts a paid review.

## Current working copy versus historical results

**Local working copy** identifies the file and content version. Optional Git
details show repository path, branch, resolved commit and separate file/repository
change state. A current branch name is not proof of the revision deployed online.
Refresh the source context after external changes.

A saved task result shows its file, task and run IDs, time and source version.
Its recorded edits belong to that task's saved proposal. They are neither a live
Git diff nor a claim about the currently published site. A historical task may
still be useful evidence even when the current file has changed.

Studio persistence under `.voice-lint` is not an automatic Git commit. Which
project metadata enters Git is an explicit repository decision. Credentials and
host configuration stay private. The [holistic review design](holistic-review.md)
specifies the proposed portable Git context, results and decision records.

## Missing underlines

The browser panel reports whether marks are enabled and how many source sections
and findings are actually mapped. A configured file alone is not a successful
mapping. Off-screen findings become visible only when their text enters the
viewport; text inside a screenshot is not DOM text and cannot be source-mapped.

Direct Chrome and a real nested local iframe wrapper were checked on 12 September.
Nesting alone did not reproduce the reported VS Code embedded-browser rendering
issue. No VS Code-specific rendering fix is claimed. If the embedded browser still
omits marks, the normal browser remains a verified route; the visible diagnostics
help distinguish disabled marks, unsupported source and an embedding problem.
