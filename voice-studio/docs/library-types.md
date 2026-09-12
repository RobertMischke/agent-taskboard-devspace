# Typed Library integration

`@voice/review` is the framework-independent annotation and live-page bridge
library. Its ESM entry includes TypeScript declarations, callback inference,
completion information and API documentation. Plain JavaScript gets the same
information through `// @ts-check` and JSDoc imports. The classic browser bundle
also has an explicit type-only reference for its `VoiceReview` global.

This library renders findings supplied by a host. It does not analyze a page,
call an AI model, edit a source file, or implement the planned Voice Lint CLI.

## Build and editor setup

In this workspace:

```sh
npm run build -w @voice/review
npm run test:types -w @voice/review
```

Resolve imports by the package name `@voice/review`, not by a private `src/`
path. The package's `exports` and `types` entries point at built declarations.
Use the built local package in another project; this documentation does not
claim that a registry release is available. `NodeNext` and `Bundler` module
resolution are exercised by the consumer test.

For JavaScript projects, `// @ts-check` enables checking in the current file.
A project can instead set `allowJs`, `checkJs`, `strict`, and `noEmit` in its
TypeScript configuration. Include the DOM library when replacing the default
`lib` list. An editor using the TypeScript language service can show controller
methods, callback parameters, literal options such as `encoding: 'utf16'`,
method signatures, and the public JSDoc text.

## TypeScript: mount, update, dispose

This complete example uses an exact plain-text source string. The example host
creates its own markup; the annotation library leaves that markup intact.
For HTML, Markdown or framework content files, obtain units and source spans
from a source adapter instead of deriving file offsets from rendered HTML.

```ts
import {
  mountVoiceReview, codePointOffsetToUtf16,
  type Finding, type SourceSpan, type TextUnit,
} from '@voice/review';

export function showReview(root: HTMLElement): () => void {
  const source = '🧭 Clear copy.';
  const sourceSpan: SourceSpan = {
    start: 0, end: source.length, encoding: 'utf16',
  };
  const unit: TextUnit = {
    id: 'intro', text: source, sourceSpan,
    kind: 'paragraph', language: 'en',
  };
  const finding: Finding = {
    id: 'example-1', ruleId: 'host.example', category: 'wording', severity: 'info',
    message: 'Example finding', explanation: 'Supplied example data; no analysis is run.',
    quote: 'Clear', unitId: unit.id,
    start: codePointOffsetToUtf16(source, 2),
    end: codePointOffsetToUtf16(source, 7),
    suggestion: null, engine: 'host/example',
  };
  const paragraph = root.ownerDocument.createElement('p');
  paragraph.dataset.voiceUnit = unit.id;
  paragraph.textContent = source;
  root.replaceChildren(paragraph);

  const review = mountVoiceReview({
    root, units: [unit], findings: [finding], feedback: [],
    onSelect(selection) {
      // selection is inferred: unitId, quote, start and end.
      console.info(selection.quote);
    },
  });
  review.update({ findings: [finding] });
  console.info(review.getDiagnostics());
  return () => review.dispose();
}
```

Invoke the returned cleanup when the host changes route, removes the view or
replaces its iframe. Call `mountVoiceReview` after the target document has loaded.
A new root needs a new mount; `update()` changes data and callbacks on the existing
root. The checked example is [typescript.ts](../packages/review/examples/typescript.ts).

## JavaScript: the same API with JSDoc

```js
// @ts-check
import { mountVoiceReview } from '@voice/review';

/**
 * @param {HTMLElement} root
 * @param {readonly import('@voice/review').TextUnit[]} units
 * @param {readonly import('@voice/review').Finding[]} findings
 * @returns {() => void}
 */
export function showReview(root, units, findings) {
  const review = mountVoiceReview({
    root, units, findings, feedback: [],
    onSelect(selection) { console.info(selection.quote); },
  });
  return () => review.dispose();
}
```

The callback and returned controller are inferred without converting this file
to TypeScript. A complete source-span example is
[javascript.js](../packages/review/examples/javascript.js).

## A classic script without a bundler

Load the built runtime as a normal script, then load your host integration:

```html
<script src="/library/voice-review.js"></script>
<script src="/review-host.js"></script>
```

At the top of `review-host.js`, when `@voice/review` is available to the editor:

```js
/// <reference types="@voice/review/standalone" />
// @ts-check
const connection = VoiceReview.connectVoiceStudio({
  studioOrigin: 'http://127.0.0.1:5188',
});
window.addEventListener('pagehide', () => connection.dispose(), { once: true });
```

The triple-slash reference supplies declarations only. It does not download or
execute the library. Do not import the standalone runtime as an ESM module to
obtain a global: ESM consumers use named imports from `@voice/review`.
The checked global example is [standalone.js](../packages/review/examples/standalone.js).

## Coordinates and AI integration

`SourceSpan.start/end` refer to the original source file. A finding's or
selection's `start/end` refer to the text of its mapped unit. Both use zero-based,
half-open **UTF-16 code units**. An emoji can occupy two code units. In the plain
text example, `Clear` is at `[3, 8)` in UTF-16, although a code-point engine reports
`[2, 7)`. Convert both endpoints with `codePointOffsetToUtf16` before sending such
findings to this library. Matching coordinates alone do not establish a source
file mapping: markup, entities and excluded content require an adapter.

A host can pass validated AI findings into `mountVoiceReview` or `update` just as
it passes local-rule findings. The host must validate the engine's schema,
offset encoding, exact quote, unit identity and source version. It owns the goal,
marketing context, model route, job execution, result provenance and review
decisions. The bridge transports supplied review data to an explicitly integrated
live page; it does not transmit backend credentials or start model work.

Use `createReviewClient` only in the authorized host when feedback must persist
through the Studio backend. It exposes typed `getDocument` and `saveFeedback`
operations. Supply the current bearer through a host-owned in-memory getter;
never embed it in the reviewed website, URLs, source control or reports.
`FeedbackInput` carries `expectedVersion`, `expectedReviewRevision` and a
`requestId`. Preserve the same request ID and exact payload when retrying an
uncertain save. Source application remains a separate, guarded backend workflow.
The overlay alone has no durable feedback store and no source-write operation.

See [the Library README](../packages/review/README.md) for persistence examples and
[the bridge contract](../packages/review/LIVE-BRIDGE.md) for origin/session checks.

## What verification proves

`packages/review/test/types.test.mjs` creates an isolated consumer outside this
workspace using only the package's declared distributable files. It compiles real
TypeScript, `checkJs`, classic-global and deliberately invalid consumer fixtures
with both NodeNext and Bundler resolution. Expected errors ensure that encoding,
root, category and callback constraints have not silently degraded to `any`.

The test also calls the actual TypeScript language service for controller and
selection completions, classic-global completion, cleanup signatures and JSDoc
hover text. This validates the metadata used by compatible editors. It does not
drive the VS Code interface, prove the behavior of a particular editor extension,
or verify rendering in VS Code's embedded browser. Existing Library runtime tests
cover mounting, updates, teardown, anchoring and bridge behavior separately.
