/// <reference types="@voice/review/standalone" />
// @ts-check
// Use a classic script tag for dist/voice-review.js before this classic script.
// The reference above supplies editor types; it does not load or import runtime code.
const standaloneRoot = document.querySelector('#preview');
if (standaloneRoot instanceof HTMLElement) {
  const standaloneController = VoiceReview.mountVoiceReview({
    root: standaloneRoot, units: [], findings: [], feedback: [],
    onSelect(selection) { console.info(selection.quote); },
  });
  standaloneController.getDiagnostics();
  window.addEventListener('pagehide', () => standaloneController.dispose(), { once: true });
}
