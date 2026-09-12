# Use AI findings in your application

Pass validated model findings to `@voice/review` to display them on the page and
let a person review the affected text. Your application runs the model and owns
the source adapter, review UI and persistence. The Library draws the findings and
returns native text selections.

## Prepare the model input

Capture the source version and its mapped text units before starting a review.
Supply the model with those units, the page's purpose, approved claims and the
specific questions to assess. Keep the original source version on the result.

Validate the returned JSON before displaying it. Each inline finding needs the
fields in `Finding`: its rule/category/severity, explanation, unit ID, exact quote
and range. Ranges use zero-based, half-open UTF-16 offsets within the unit.
Convert explicitly if your model adapter returns code-point offsets. A claim
without a usable text anchor belongs in the host's report rather than a guessed
underline. Record omissions and missing evidence in that report.

## Display a checked result

The following TypeScript function takes a result whose JSON shape your host has
already validated. It also checks the source version and quote before mounting.
`root` must contain the adapter's matching `data-voice-unit` elements; their
eligible DOM text must equal `TextUnit.text`.

```ts
import {
  mountVoiceReview,
  type Finding, type SelectionTarget, type TextUnit,
} from '@voice/review';

type Snapshot = { version: string; units: readonly TextUnit[] };
type CheckedResult = { sourceVersion: string; findings: readonly Finding[] };

export function showModelReview(
  root: HTMLElement,
  snapshot: Snapshot,
  result: CheckedResult,
  onSelect: (selection: SelectionTarget) => void,
) {
  if (result.sourceVersion !== snapshot.version) {
    throw new Error('Reload the source before reviewing this result.');
  }
  for (const finding of result.findings) {
    const unit = snapshot.units.find(item => item.id === finding.unitId);
    if (!unit || !Number.isInteger(finding.start) || !Number.isInteger(finding.end)
      || finding.start < 0 || finding.end <= finding.start
      || finding.end > unit.text.length
      || unit.text.slice(finding.start, finding.end) !== finding.quote) {
      throw new Error('A finding does not match the reviewed source.');
    }
  }
  return mountVoiceReview({
    root, units: snapshot.units, findings: result.findings, feedback: [], onSelect,
  });
}
```

Use the returned controller's `getDiagnostics()` to inspect unmapped units and
stale anchors. Call `update({ findings, feedback })` when the same view receives
new review data. Call `dispose()` on route teardown or iframe replacement.
Provide an accessible findings list alongside the marks. The
[typed integration guide](library-types.md) covers package setup and complete
TypeScript/JavaScript examples.

## Connect a running website to Studio

For a site reviewed inside Studio, install the built Library and call
`connectVoiceStudio({ studioOrigin: 'http://127.0.0.1:5188' })` behind your
application's development and review opt-in guard. Configure the route's source
file and related renderer files in `voice.config.json`. The
[bridge guide](../packages/review/LIVE-BRIDGE.md) defines origin checks, route
changes and disposal. The website needs an explicit integration and framing
permission for the local Studio origin.

Studio supplies the review controller through this bridge; do not mount another
one over the same page. Backend tokens belong in the Studio host session and are
not sent to the website.

## Save feedback or propose an edit

An authorized host can use `createReviewClient` for `getDocument` and
`saveFeedback`. Pass the current in-memory token through its token getter and
carry `expectedVersion`, `expectedReviewRevision` and `requestId` unchanged.
Use the same request ID for a retry of the same payload. On a conflict, preserve
the draft and review it against the refreshed source.

Studio's backend also provides keep decisions, generated alternatives, semantic
file reviews and source tasks. Their endpoints and version checks are described
in the [workflow](workflow.md) and [Runner guide](runner-integration.md).
Choosing an alternative prepares a diff; applying it is a separate action.
Model execution needs an explicitly configured Runner route and a start request.

## A task for the integration agent

```text
Add opt-in Voice review to [application/route].

Map the rendered text to [source file] with exact TextUnit IDs and UTF-16 ranges.
Use the built @voice/review package and [exact local Studio origin].
Keep model execution in the host; validate results against the captured source.
Provide an accessible findings list, native selection and review callbacks.
Save feedback through the backend with source/review preconditions.
Dispose the integration on teardown and clear stale anchors on navigation.

Verify inline markup, an emoji before the selected text, native links/buttons,
missing mappings, reload/disposal and a narrow and wide viewport.
Return the changed files, source/build identity, results and remaining gaps.
Use the task's existing authorization for model starts and source/Git changes.
```
