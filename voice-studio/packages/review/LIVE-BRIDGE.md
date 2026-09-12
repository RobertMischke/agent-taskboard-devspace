# Review a running website in Voice Studio

The live bridge runs inside a website that explicitly integrates it. Studio
embeds that site's actual development-server URL. The site's scripts, CSS,
native links, framework rendering and router continue to run on its own origin.

## Add the bridge to the site's development entry point

```ts
import { connectVoiceStudio } from '@voice/review';

const connection = connectVoiceStudio({
  studioOrigin: 'http://127.0.0.1:4188'
});

// Dispose when the development integration is unloaded (e.g. HMR cleanup).
// connection.dispose();
```

For plain HTML, serve the built `dist/voice-review.js` from the target site's
own development assets and load it normally:

```html
<script src="/dev/voice-review.js"></script>
<script>
  const voiceConnection = VoiceReview.connectVoiceStudio({
    studioOrigin: 'http://127.0.0.1:4188'
  });
</script>
```

Keep this opt-in integration in development mode. Use the Studio's exact origin:
`localhost` and `127.0.0.1` are different origins, as are different ports. No
wildcard is accepted. The bridge receives only review data and sends selections,
annotation IDs, mapping diagnostics and the current page location. It never
receives the local backend pairing token or provider credentials.

## Connect the live DOM to the source

Explicit `data-voice-unit` attributes are preferred. The identifier must match
the source adapter's `TextUnit.id`, and its eligible DOM text must match that
unit's text exactly. A framework/i18n application needs a source adapter that
identifies its actual template or translation string. A rendered route is not
itself a source filename, and translated runtime text is not interchangeable
with a different-language fallback in an HTML file.

Without an explicit identifier, the bridge can temporarily mark one **unique,
exact visible element-text occurrence**. It chooses the deepest element when
an element and its only text-bearing descendant represent the same occurrence.
Repeated text, duplicate unassigned source units, mismatched explicit IDs and
ambiguous matches remain unmapped. It does not trim/collapse text, guess from
similar wording or wrap native text nodes. Inline source fragments that do not
correspond to a complete element need explicit adapter support.

Only temporary `data-voice-unit` attributes are added; they are restored when
the review is replaced or disconnected. Native nodes, links and event handlers
are preserved. Code, hidden regions, editable controls and `data-voice-exclude`
regions are excluded. Normal DOM updates trigger remapping; `refresh()` is
available for host-specific rendering lifecycles.

## Protocol version 1

The exported `VoiceStudioParentMessage` and `VoiceStudioChildMessage` types are
the transport contract. The parent uses `postMessage` with the target site's
exact origin and checks message origin **and** `event.source` itself. The bridge
accepts only its explicitly configured Studio origin and its actual parent or
opener window; after connection it retains that peer.

1. Parent sends `voice-studio:connect` with a fresh random `sessionId` (16-128
   ASCII letters, digits, `_` or `-`; `crypto.randomUUID()` is suitable).
2. Child replies `voice-studio:ready` with `sessionId`, `protocolVersion: 1`,
   current `url` and `title`.
3. Parent resolves the correct source document, then sends `voice-studio:review`
   with `sessionId`, a fresh `reviewId`, exact `pageUrl`, `units`, `findings` and
   `feedback`. `pageUrl` includes query and fragment. All spans remain UTF-16.
4. Child returns `voice-studio:mapping` with `reviewId` and diagnostics. Selection
   replies carry `selection`; annotation clicks return `findingId` or
   `feedbackId`, under `voice-studio:selection`, `voice-studio:finding` and
   `voice-studio:feedback`. Parent ignores stale session/review IDs.
5. SPA history changes, hash/popstate events and location changes send
   `voice-studio:location`. URL changes immediately clear old review anchors.
   Parent resolves and sends a new review for the new exact page URL.
6. Parent can send `voice-studio:select-finding` with `sessionId`, `reviewId` and
   `findingId` (or `null`) to focus a report finding, or `voice-studio:navigate`
   with `sessionId` and `action: 'back' | 'forward' | 'reload'` for native history.
7. `voice-studio:disconnect` clears the review and session. A full page reload
   creates a new bridge instance and requires a fresh connection handshake.

Malformed reviews or a review for an outdated page URL produce a scoped
`voice-studio:error`; messages from other origins, windows or sessions are
ignored.

The Studio host currently uses an iframe. The target site's CSP/frame headers
must allow the Studio origin to embed it and its development CSP must allow the
bridge asset and annotation styles. An external page opened with `noopener`
has no connected Studio opener; opening it separately is ordinary browsing,
not a connected review fallback. Remote pages without this opt-in bridge,
closed shadow roots, unsupported source adapters and iframe-blocking headers
remain explicit limitations. Live review never grants a page authority to
write source files: persistence and reviewed diffs remain in the Studio backend.
