# @voice/review

A framework-independent JavaScript library for reviewing text on a local web
page. Angular, plain HTML and same-origin iframe hosts use the same controller.
It draws supplied analysis findings as solid underlines and human feedback as
dotted underlines, while native text selection supplies new feedback anchors.
The host supplies the analysis; source editing is outside the library API.

## Build and consume

From the Voice Studio workspace:

```sh
npm run build -w @voice/review
npm test -w @voice/review
```

The package exports ESM and TypeScript declarations through `@voice/review`.
`dist/voice-review.js` is a standalone browser bundle exposing `window.VoiceReview`;
it includes no Angular dependency or runtime package dependency. A host can copy
that file into its local development assets. The Studio serves it at
`/library/voice-review.js`; see `examples/library-embed/index.html` in the repo.

## TypeScript and JavaScript IntelliSense

The public ESM API carries declaration files and JSDoc for completion, callback
inference and hover help. Import types such as `TextUnit`, `Finding`,
`SourceSpan` and `VoiceReviewController` directly from `@voice/review`.
Plain JavaScript can use `// @ts-check` and JSDoc `import('@voice/review')`
types. Checked examples ship in [examples/](./examples/):
[TypeScript](./examples/typescript.ts), [JavaScript](./examples/javascript.js),
and [classic-script global](./examples/standalone.js).

For a normal browser script, use
`/// <reference types="@voice/review/standalone" />` to add editor types;
load `voice-review.js` separately with a classic `<script>` tag. The reference
does not load runtime code. Use the main entry for ESM imports.

Run `npm run test:types -w @voice/review` to verify the declarations and editor
metadata. [Typed Library integration](../../docs/library-types.md) contains
complete setup examples and describes the consumer checks.

## Mount on existing HTML

Assign explicit text-unit identifiers in development markup. Units should be
non-overlapping blocks or spans. Their concatenated DOM text must match the
corresponding `TextUnit.text` exactly, including whitespace. The adapter skips
script, style, template, hidden, `aria-hidden="true"` and `data-voice-exclude` regions.
Use `data-voice-exclude` for visible inline code that the text adapter excludes.

```html
<main id="preview">
  <p data-voice-unit="intro">Eine <strong>präzise</strong> Aussage.</p>
</main>
```

```js
import { getUnitText, mountVoiceReview } from '@voice/review';

const root = document.querySelector('#preview');
const text = getUnitText(root.querySelector('[data-voice-unit="intro"]'));
const controller = mountVoiceReview({
  root,
  units: [{
    id: 'intro', text, kind: 'paragraph', language: 'de',
    // For this isolated browser-only example these are text coordinates.
    // A source adapter must supply the actual file range before source edits.
    sourceSpan: { start: 0, end: text.length, encoding: 'utf16' }
  }],
  findings: [{
    id: 'finding-1', ruleId: 'example.precision', category: 'wording',
    severity: 'info', message: 'Was bedeutet präzise hier?',
    explanation: 'Beispielbefund für die Einbindung, keine automatische Analyse.',
    quote: 'präzise', unitId: 'intro', start: 5, end: 12,
    suggestion: null, engine: 'example'
  }],
  feedback: [],
  onSelect: selection => showFeedbackForm(selection),
  onFindingSelect: finding => showFinding(finding),
  onFeedbackSelect: feedback => showFeedback(feedback)
});

// After new analysis or a saved note:
controller.update({ findings: latestFindings, feedback: savedFeedback });
controller.selectFinding('finding-1');
console.log(controller.getDiagnostics());

// On route changes, component destruction or iframe replacement:
controller.dispose();
```

`showFeedbackForm`, `showFinding`, `showFeedback`, `latestFindings` and
`savedFeedback` above are integration callbacks/data supplied by the host.
An already-mounted root is disposed automatically before a second mount, so
repeated initialization does not duplicate handlers or underline layers.

For the standalone bundle, load `<script src="/library/voice-review.js"></script>`
and call `VoiceReview.mountVoiceReview(...)` with the same options. No build
framework is required on the consuming page.

## Durable feedback through the local backend

The host pairs with the local Studio once and supplies the resulting token.
The client sends source-version and review-revision preconditions unchanged.
Saved feedback is written by the backend to project metadata sidecars; it is
not stored by this package in `localStorage`.

```js
import { createReviewClient, ReviewApiError } from '@voice/review';

const api = createReviewClient({
  baseUrl: '/api',
  token: () => currentPairingToken
});
let detail = await api.getDocument(projectId, documentId);

/**
 * @param {import('@voice/review').SelectionTarget} selection
 * @param {string} comment
 * @param {string} category
 * @returns {Readonly<import('@voice/review').FeedbackInput>}
 */
function prepareFeedback(selection, comment, category) {
  return Object.freeze({
    ...selection, comment, category,
    expectedVersion: detail.version,
    expectedReviewRevision: detail.reviewRevision,
    requestId: crypto.randomUUID()
  });
}

/** @param {Readonly<import('@voice/review').FeedbackInput>} input */
async function persistFeedback(input) {
  try {
    detail = await api.saveFeedback(projectId, documentId, input);
    controller.update({ units: detail.units, findings: detail.findings, feedback: detail.feedback });
  } catch (error) {
    if (error instanceof ReviewApiError && error.status === 409) {
      // Keep the user's draft, reload the document and ask them to review the
      // anchor against the new source before submitting a new request.
      showConflict(error.details);
      return;
    }
    throw error;
  }
}
```

Call `prepareFeedback` once for a new or edited note, retain the returned payload,
then pass it to `persistFeedback`. After an uncertain network failure, retry
`persistFeedback` with that same payload, including its request ID and version
preconditions. After a 409 conflict, reload and review the anchor before preparing
a new payload. Pairing is performed by the host at `POST /api/session/pair`;
do not put tokens in page URLs, source code or reports.
The backend has no cross-origin API access. Host the preview on the Studio origin,
or configure the consuming app's local development proxy.

## Browser and source coordinates

All review offsets are **UTF-16 code units**, zero-based and half-open. This is
the coordinate system used by JavaScript string slices and browser text ranges.
`codePointOffsetToUtf16(text, offset)` explicitly converts offsets from a
Unicode-code-point analysis engine. Do not pass Voice Lint core spans directly
without converting their declared encoding.

`createTextRange(element, start, end, expectedText)` maps offsets across inline
markup without wrapping or replacing content. The optional `expectedText`
rejects stale text. `selectionToTarget(root, units, selection)` returns
`{ unitId, quote, start, end }` for a selection within one mapped unit; a selection
across multiple units or across excluded inline code is rejected rather than
silently shortened. Selections on either side of code use the correct offsets.
`createTextRanges(...)` returns per-text-node ranges for drawing across inline
markup without accidentally marking excluded content.

The library validates both unit text and exact quoted substrings before drawing
marks. `getDiagnostics()` reports missing/mismatched units and stale anchors.
Resolved notes and notes needing reattachment are not shown as current marks.
Overlapping findings and human notes receive separate underline lanes.

Category colors are structure blue, claims orange, wording purple and meta ochre.
The layer uses range geometry and pointer events pass through it. Clicking text selects its most precise annotation; native
links, buttons and editable controls retain their normal interaction. Supply an
accessible findings list in the host for keyboard navigation and annotations
inside links. `selectFinding(id)` highlights and scrolls to a selected finding.

For an iframe, mount after its `load` event using
`root: iframe.contentDocument.body`, and dispose on reload. Its document must
be same-origin. The Studio's imported preview uses a sandbox without scripts.
Arbitrary remote cross-origin pages and closed shadow roots cannot be inspected
by this adapter; they need an explicit integration/import route. A site's CSP
must permit the library asset and its inline annotation styles in development.

## Live development websites

Use the exported `connectVoiceStudio({studioOrigin})` bridge to review a running
application in Studio while preserving its real CSS, JavaScript and native
routing. The target website explicitly integrates the library and retains its
own origin. See [LIVE-BRIDGE.md](./LIVE-BRIDGE.md) for the exact origin/session
protocol, source mapping, iframe requirements and limitations.
