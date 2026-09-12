# Review writing with reusable rules

`@voice/writing-rules` provides 20 contextual review rules, four task profiles and
English/German examples. Use it to prepare review instructions or locate a small
set of visible wording cues. Each rule includes an acceptable counterexample and
the conditions under which its suggested revision preserves the meaning.

## Recognize the negative pattern

Each rule starts with an `antiPattern`: a concrete name, the observable symptom
and its cost to the reader, in EN and DE. Names include **Development diary**,
**Not X, but Y**, **Hedge stacking**, **Summary loops**, **Unearned praise**,
**False balance**, **Unprioritized laundry list** and **Forced triads and canned Q&A**.
The positive `title` and `prompt` describe how to review or remedy it.

A pattern is a contextual criticism, not proof that AI wrote the passage. A real
comparison, useful history, justified uncertainty or deliberate style choice can
remain. `relatedRuleIds` identifies overlap: a laundry list concerns relevance
and priority; formatting overload concerns presentation; a forced template can
repeat form even when its facts differ.

## Choose the reader's task

| Profile | Review focus |
| --- | --- |
| `public-docs` | Help readers use the available product without development history or distracting side topics. |
| `technical-reference` | Explain exact objects, operations and terminology while preserving necessary conditions. |
| `product-copy` | Connect the explanation and claims to a reader goal and supporting evidence. |
| `agent-report` | Explain the observed outcome clearly, with useful evidence and coverage limits. |

Each profile selects six rules. The four added patterns are available through
individual rule IDs and do not enlarge those defaults. A host can select
individual rule IDs instead.
For example, `concrete-subject` asks what an abstract phrase actually refers to;
`calibrated-uncertainty` protects real uncertainty while questioning redundant
qualifiers. Neither rule declares the word “preferred” inherently wrong.

The package builds from this workspace:

```sh
npm --prefix packages/writing-rules run build
npm --prefix packages/writing-rules test
```

The package is local and has not been published to npm. TypeScript declarations
and JSDoc ship with its ESM build. JavaScript consumers can use `// @ts-check`.

## Find candidate spans

```ts
import { findWritingSignals } from '@voice/writing-rules';

const text = '😀 A powerful example.';
const result = findWritingSignals(text, { language: 'en' });
const first = result.signals[0];
// quote: "powerful", start: 5, end: 13, encoding: "utf16"
// kind: "surface-cue", reviewRequired: true

console.log(result.coverage.scannedRuleIds);
console.log(result.coverage.unscannedRuleIds);
```

The scanner uses 16 published regular expressions covering eight rules across
EN/DE. The other twelve rules require contextual review. They find candidates such as stock adjectives, paired hedges or familiar
contrast openings. They do not determine whether a qualifier is unnecessary,
whether a claim is true or whether a document has a useful structure.

Offsets are zero-based, half-open UTF-16 positions in the supplied string.
Quoted examples and code are included. Before converting a candidate into a
Studio finding, the host must validate its unit, exact quote, source mapping and
source version. The scanner does not write `Finding` objects, save feedback or
edit source files.

`maxSignals` defaults to 50 and accepts 1–500. The returned `truncated` flag
identifies omitted matches. Input is limited to 250,000 UTF-16 units. A selected
rule without a lexical pattern appears in `unscannedRuleIds`; empty results do
not establish that the text is good. These are writing signals, not evidence of
authorship. See [AI text signals and their limits](ai-text-signals.md).

## Compose review instructions

```ts
import { composeWritingReviewPrompt } from '@voice/writing-rules';

const review = composeWritingReviewPrompt({
  profile: 'public-docs',
  audience: 'Developers using Studio for the first time',
  goal: 'Open a source folder and complete one review',
  language: 'en',
  maxFindings: 5
});

console.log(review.catalogueVersion, review.ruleIds);
console.log(review.prompt);
```

Composition happens locally. The result contains instructions, selected rule IDs
and the catalogue version. No model, provider or Runner starts. Audience and goal
are trusted host configuration; supply source material separately as review data.

The prompt requests exact quotes, source locators, impact on the reader's task and
reasons. Where a change is warranted, it asks for one to three distinct
alternatives; otherwise it permits a justified keep decision. Examples never
authorize invented facts or automatic replacement. Necessary qualifications,
technical terms and accepted decisions remain protected.

The host chooses execution, validates any model response and presents the decision.
This package does not validate generated findings or guarantee a model's output
count. `maxFindings` is an instruction, not a cost or token limit.

## Read the catalogue directly

```ts
import {
  writingCatalogue, getWritingRule, selectWritingRules
} from '@voice/writing-rules';

const rule = getWritingRule('concrete-subject');
const rules = selectWritingRules({
  profile: 'public-docs',
  ruleIds: ['current-state', 'calibrated-uncertainty']
});
```

Selection keeps catalogue order and removes duplicate IDs. Unknown IDs and
profiles throw. If both a profile and IDs are supplied, each ID must belong to
that profile. An empty selection is allowed for inspection, but prompt composition
requires at least one rule. Objects returned by the API are deeply frozen.
The separate JSON exports are ordinary data objects; modifying them does not
configure the API.

The package also exports `@voice/writing-rules/catalogue.json` and
`@voice/writing-rules/surface-patterns.json`. Browser hosts can serve the built
`index.js` directly or bundle its ESM entry. That module embeds private data and
works independently of the optional JSON downloads. There are no runtime
dependencies or network calls.

## Sources and model-specific guidance

Every rule links to source records with a URL, access date, relevant section,
supported point and limitation. The `relation` separates provider prompt advice,
editorial guidance, Voice's editorial derivation and contextual research.
The bilingual examples are Voice-authored applications, except for the identified
user-provided Voice documentation passage under Development diary. None is
presented as an unlabelled captured model output or a measured model defect.

[OpenAI's style guidance](https://developers.openai.com/api/docs/guides/latest-model#personality-and-writing-style)
and [Anthropic's prompting guidance](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices)
inform prompt composition. They do not establish that every Claude or
OpenAI/Codex output shares the same weaknesses. The host retains its actual model
identity and evaluates the selected profile on its own task examples.

[Microsoft's documentation guidance](https://learn.microsoft.com/en-us/contribute/content/style-quick-start)
and [Google's tense guidance](https://developers.google.com/style/tense) inform the
documentation profiles. [The cited linguistic study](https://aclanthology.org/2025.emnlp-main.1163/)
provides research context; its aggregate observations are not a quality test for
an individual passage.

OpenAI's [April 2025 sycophancy report](https://openai.com/index/sycophancy-in-gpt-4o/)
documents a particular rolled-back GPT-4o update. It supports examining unearned
agreement, not assigning that behavior to every current model. The
[dated Model Spec](https://model-spec.openai.com/2025-12-18.html#assume-an-objective-point-of-view)
informs evidence-weighted comparisons; it describes intended behavior.

## Maintain and verify

The canonical data lives in `packages/writing-rules/src/catalogue.json` and
`surface-patterns.json`. Change the catalogue version when rules, examples,
profiles or matching behavior change. Preserve stable IDs and revisit sources
when provider guidance changes.

Tests cover catalogue integrity, references, keep cases, selection, prompt
composition, distributed TypeScript declarations and exact lexical spans,
including Unicode and truncation. These checks verify software behavior. They
do not measure editorial benefit, detector accuracy or a provider's response
quality. The existing four Studio local rules remain a separate implementation.
