/** Types for the classic browser script. This reference loads no JavaScript.
 * Load voice-review.js with a normal <script> before using the global. */
declare global {
  var VoiceReview: typeof import('./index.js');
}
export {};
