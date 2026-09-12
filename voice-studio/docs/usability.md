# Decisions and source versions

## Keep a passage or review a change

Select a mapped passage or open a finding. **Keep as written** saves the exact
quote and source version; add a reason when it helps future reviewers. The source
and rule remain unchanged. An edit to the source makes the old decision stale.

**Generate alternatives** requests one to three replacements with reasons from
the configured Runner. An optional direction can guide the request. If no model
route is available, configure one using the [Runner guide](runner-integration.md).
Choose **Review this change** to prepare a diff, then inspect and apply it as a
separate action. Use your own feedback or wording when needed.

Runs remain visible and cancellable after changing the selection. If a start is
unconfirmed, retry the existing request rather than starting another generation.
Review saved candidates against the current selection and source version.

## Check which source you are reviewing

**File and Git** shows the file, content version and optional repository details.
File and repository change states are separate. Refresh after external edits;
the displayed branch does not identify the revision deployed online.

A saved task result includes its file, task/run IDs, time, original source version
and recorded edits. That is the saved proposal's diff, even if today's source has
changed. The [storage reference](workflow.md#files-beside-the-source) shows where
these records live and how their references connect.

## If marks are missing

Check that marks are enabled, then read the browser panel's mapping count. A file
assignment alone does not establish a text match. Open a finding to locate its
text; it may be outside the viewport. Text inside an image cannot be underlined
as mapped DOM text. For a mismatch, check the source adapter's unit ID and exact
text using the [bridge guide](../packages/review/LIVE-BRIDGE.md).

If the same page shows marks in a normal browser but not in an embedded browser,
use the normal browser for that review. The VS Code-specific rendering issue has
not been reproduced or fixed.

## Language and layout

English is the default. Choose EN/DE for the interface and rule explanations;
source quotes, feedback and model prose keep their original language. Compact
reduces navigation height; Website focus opens navigation and review as overlays.
The floating controls reopen them and Escape closes an overlay. Language and
display preferences are saved when browser storage is available.
