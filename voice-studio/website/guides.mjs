// Explicit publication catalogue: never discover documents from private runtime folders.
export const guides = [
  {slug:'workflow',source:'docs/workflow.md',title:'The Studio workflow',description:'From a registered folder and running page to an explicit, version-checked source change.',group:'Start',status:'Implemented'},
  {slug:'session',source:'docs/browser-session.md',title:'Pair once. Resume for seven days.',description:'Local pairing, browser trust, expiry and logout, with the exact HTTP contract.',group:'Start',status:'Implemented'},
  {slug:'usability',source:'docs/usability.md',title:'Language, layout and review choices',description:'English and German, compact navigation, keep decisions and source provenance.',group:'Start',status:'Implemented'},
  {slug:'library',source:'packages/review/README.md',title:'Mount the review library',description:'Connect source units, findings and native text selection to your own application.',group:'Build',status:'Implemented'},
  {slug:'library-types',source:'docs/library-types.md',title:'Types, IntelliSense and examples',description:'TypeScript, checked JavaScript and the classic browser global, verified as package consumers.',group:'Build',status:'Implemented'},
  {slug:'live-bridge',source:'packages/review/LIVE-BRIDGE.md',title:'The live-page bridge protocol',description:'Development opt-in, exact origins, source mapping and version 1 postMessage envelopes.',group:'Build',status:'Implemented'},
  {slug:'runner-integration',source:'docs/runner-integration.md',title:'Runner requests and source proposals',description:'Explicit model execution, staged context, validated output and guarded file writes.',group:'Build',status:'Implemented'},
  {slug:'checks',source:'backend/CHECKS.md',title:'Local build and test checks',description:'Host-owned commands, source fingerprints, process results and stale evidence.',group:'Build',status:'Implemented'},
  {slug:'agent-integration',source:'docs/agent-integration.md',title:'AI integration and the AGT pipeline',description:'A coding-agent usage pattern today, followed by a concrete plan for an AGT analysis step.',group:'Extend',status:'Workflow + plan'},
  {slug:'holistic-review',source:'docs/holistic-review.md',title:'Page and project review contracts',description:'Git context, SEO, consistency and visual evidence: portable requests, results and decisions.',group:'Extend',status:'Design · planned'},
  {slug:'model-strategy',source:'docs/model-strategy.md',title:'Model routes and qualification',description:'Separate source integrity from editorial quality, model choice and admission evidence.',group:'Extend',status:'Current + planned'},
  {slug:'language-tooling',source:'docs/language-tooling.md',title:'Language engine boundaries',description:'Where spelling and style tools could fit, and what the current implementation actually runs.',group:'Extend',status:'Design · planned'},
  {slug:'maintaining',source:'docs/maintaining.md',title:'Product files, tools and evidence',description:'Which files belong to the product, which commands are reusable and which outputs are historical.',group:'Maintain',status:'Maintained'},
  {slug:'commands',source:'scripts/README.md',title:'Operator command catalogue',description:'Supported commands with prerequisites, side effects and output locations.',group:'Maintain',status:'Maintained'},
  {slug:'verification',source:'docs/verification/2026-09-12/README.md',title:'Dated verification evidence',description:'The 12 September local Preview 0.3 record, its scope, limitations and content hashes.',group:'Maintain',status:'Historical record'},
  {slug:'notices',source:'THIRD_PARTY_NOTICES.md',title:'Third-party notices',description:'Dependency, engine and data licensing information from the maintained source tree.',group:'Maintain',status:'Maintained'},
];

export const downloads = [
  'docs/licenses/npm-inventory.json',
  'packages/review/examples/typescript.ts',
  'packages/review/examples/javascript.js',
  'packages/review/examples/standalone.js',
  'scripts/verify-holistic-examples.mjs',
];
