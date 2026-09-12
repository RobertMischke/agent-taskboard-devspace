// Explicit publication catalogue: never discover documents from private runtime folders.
export const guides = [
  {slug:'writing-rules',source:'docs/writing-rules.md',title:'Writing rules and prompt composition',description:'Select a review profile, inspect rule examples and compose a task-specific prompt.',group:'Reference',status:'Implemented'},
  {slug:'ai-text-signals',source:'docs/ai-text-signals.md',title:'Inspect AI-like writing patterns',description:'Use local style cues and understand what they can establish about text authorship.',group:'Reference',status:'Implemented'},
  {slug:'workflow',source:'docs/workflow.md',title:'The Studio workflow',description:'From a registered folder and running page to an explicit, version-checked source change.',group:'Start here',status:'Implemented'},
  {slug:'session',source:'docs/browser-session.md',title:'Pair once. Resume for seven days.',description:'Local pairing, browser trust, expiry and logout, with the exact HTTP contract.',group:'Reference',status:'Implemented'},
  {slug:'usability',source:'docs/usability.md',title:'Decisions and source versions',description:'Keep a passage, inspect a proposed change and distinguish historical results from the current source.',group:'Reference',status:'Implemented'},
  {slug:'library',source:'packages/review/README.md',title:'Mount the review library',description:'Connect source units, findings and native text selection to your own application.',group:'Start here',status:'Implemented'},
  {slug:'library-types',source:'docs/library-types.md',title:'Types, IntelliSense and examples',description:'TypeScript, checked JavaScript and the classic browser global, verified as package consumers.',group:'Reference',status:'Implemented'},
  {slug:'live-bridge',source:'packages/review/LIVE-BRIDGE.md',title:'The live-page bridge protocol',description:'Development opt-in, exact origins, source mapping and version 1 postMessage envelopes.',group:'Reference',status:'Implemented'},
  {slug:'runner-integration',source:'docs/runner-integration.md',title:'Runner requests and source proposals',description:'Explicit model execution, staged context, validated output and guarded file writes.',group:'Reference',status:'Implemented'},
  {slug:'checks',source:'backend/CHECKS.md',title:'Local build and test checks',description:'Host-owned commands, source fingerprints, process results and stale evidence.',group:'Reference',status:'Implemented'},
  {slug:'agent-integration',source:'docs/agent-integration.md',title:'Use AI findings in your application',description:'Validate model output, attach source spans and pass findings to the review UI.',group:'Start here',status:'Implemented'},
  {slug:'holistic-review',source:'docs/holistic-review.md',title:'Review source in a Git repository',description:'Register a checkout, inspect current source and store reviewed work with the project.',group:'Reference',status:'Implemented'},
  {slug:'maintaining',source:'docs/maintaining.md',title:'Product files, tools and evidence',description:'Which files belong to the product, which commands are reusable and which outputs are historical.',group:'Maintenance',status:'Maintained'},
  {slug:'commands',source:'scripts/README.md',title:'Operator command catalogue',description:'Supported commands with prerequisites, side effects and output locations.',group:'Maintenance',status:'Maintained'},
  {slug:'verification',source:'docs/verification.md',title:'Dated verification evidence',description:'The 12 September local Preview 0.3 record, its scope, limitations and content hashes.',group:'Maintenance',status:'Historical record'},
  {slug:'notices',source:'THIRD_PARTY_NOTICES.md',title:'Third-party notices',description:'Dependency, engine and data licensing information from the maintained source tree.',group:'Maintenance',status:'Maintained'},
];

export const downloads = [
  'docs/licenses/npm-inventory.json',
  'packages/review/examples/typescript.ts',
  'packages/review/examples/javascript.js',
  'packages/review/examples/standalone.js',
  'scripts/verify-holistic-examples.mjs',
];
