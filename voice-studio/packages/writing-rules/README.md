# @voice/writing-rules

Contextual writing rules, a small lexical signal scanner and local review-prompt
composition. Each rule names a negative writing pattern, its symptom and reader
cost before presenting the remedy. The catalogue contains 20 rules, four task profiles, English/German
examples, deliberate keep cases and source provenance. It is an internal workspace
package and is not published to npm.

```sh
npm --prefix packages/writing-rules run build
npm --prefix packages/writing-rules test
```

```ts
import { findWritingSignals, composeWritingReviewPrompt } from '@voice/writing-rules';

const result = findWritingSignals('A powerful example.', { language: 'en' });
// Candidate quote with UTF-16 offsets; context may justify keeping it.
const instructions = composeWritingReviewPrompt({
  profile: 'public-docs', audience: 'Developers',
  goal: 'Open a source folder and complete one review'
});
// Host supplies the document separately and decides whether to start a reviewer.
```

The runtime ESM entry is self-contained. The build embeds private data copies;
separate JSON exports remain available for inspection. Changing those exports
does not configure the API. The package has no runtime dependencies, browser
globals, network calls or source writes. The build supplies TypeScript declarations
and JSDoc.

`findWritingSignals` checks eight rules using sixteen language-specific patterns.
It does not evaluate document structure, truth, unnecessary caution or authorship.
The returned coverage lists selected rules without lexical patterns. Quoted text,
code and technical uses are not excluded. Every match requires review; no matches
does not establish quality. Offsets address the input string, not a source file
or DOM node. A host must validate its own mapping before creating review findings.

`composeWritingReviewPrompt` returns text and selected rule IDs, not a model
response. It defaults to six public-docs rules and asks for at most five findings.
The count is a requested format, not a guaranteed inference budget. Audience and
goal are trusted host configuration; source documents belong in separate input.

Selection is deterministic. Explicit IDs outside a selected profile throw rather
than silently change the requested coverage. Public data and results are frozen.
Provider advice, editorial choices and research context remain separately tagged.

The complete usage contract is in [the maintained guide](../../docs/writing-rules.md).
