# Research note: reusable writing patterns

Internal evidence note, observed 12 September 2026. The deliverable is
`packages/writing-rules`, not an authorship detector or a comparative benchmark.
No Voice Runner execution or separate provider/model call was used. Sources were
read through web tools; rules and examples were authored for this product.

## Question and method

The user asked for reusable checks for noisy documentation and problematic
LLM-assisted writing: misplaced development history, generic mechanisms,
unhelpful reasoning, rhetorical opposition and unnecessary qualifications.
We checked official provider guidance, primary technical-writing policies and
research abstracts. No frequency estimate was derived from anecdotes or a list
of supposedly characteristic model words.

## Evidence ledger

| Source, accessed 2026-09-12 | Supported use | Limit |
| --- | --- | --- |
| [OpenAI model guidance](https://developers.openai.com/api/docs/guides/latest-model#personality-and-writing-style), style section | Explicitly steer terminology, paragraph structure and rhetorical habits. | A rolling provider page describes particular models; it is not a cross-provider prevalence study. |
| [Claude prompting best practices](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices), formatting and examples | State the desired writing behavior and provide positive examples. | The page itself describes differing defaults; a universal “Claude is verbose” label is unsupported. |
| [Prompting Claude Fable 5](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-fable-5), readability and progress evidence | Use an outcome understandable outside the working session and support status statements with observations. | Model-specific advice. Broader editorial rules below are our application of it. |
| [Microsoft Learn quick start](https://learn.microsoft.com/en-us/contribute/content/style-quick-start) | Task-oriented documentation and relevant qualifications. | Normative writing guidance; no LLM diagnosis. |
| [Microsoft concise wording](https://learn.microsoft.com/en-us/style-guide/word-choice/use-simple-words-concise-sentences), [jargon](https://learn.microsoft.com/en-us/style-guide/word-choice/avoid-jargon) | Precise operations and terminology appropriate to the reader. | Specialist terms and necessary modifiers are not defects. |
| [Google present tense](https://developers.google.com/style/tense), [future features](https://developers.google.com/style/future) | Separate available behavior from unannounced future capability. | We do not import Google's internal approval workflow into Voice. Roadmaps remain a distinct valid document type. |
| [Zanotto and Aroyehun, EMNLP 2025](https://aclanthology.org/2025.emnlp-main.1163/), abstract | Aggregate differences in syntactic and semantic features across eight domains and eleven LLMs motivate contextual inspection. | No sentence-level quality verdict, current-model ranking or actionable threshold follows from the abstract. |

The [2024 preprint](https://arxiv.org/abs/2412.03025) was also inspected. Its
four-domain description is not substituted for the later eight-domain study.
[Muñoz-Ortiz et al.](https://arxiv.org/abs/2308.09067) study English news with six
models; those aggregate distributions were not turned into German documentation
rules or model-specific detectors. Only abstracts and publication metadata were
reviewed for these research items, not a replication of the experiments.

## Editorial decisions

The catalogue contains 20 rules but each task profile selects six. This prevents
the review prompt from becoming an unprioritized checklist. A rule describes a
condition to examine, not a banned phrase. Its sources distinguish direct
guidance, prompt strategy, editorial derivation and background research.

“Git is the preferred source of record” illustrates a context question: what is
stored, where, and who performs the operation? A concrete replacement is valid
only when that behavior is established. “Preferred” remains useful when genuine
supported alternatives are being compared. Removing it blindly could erase a
meaningful choice.

Necessary uncertainty is protected globally and by a dedicated rule. Reviewers
must retain scientific uncertainty, unknown implementation facts, conditions and
configuration dependencies. Likewise, process history belongs in an incident
report or decision record even when it distracts from a quickstart. Contrast and
repetition can be useful for semantics and comparison.

## Implementation and qualification boundary

The local scanner covers eight rules through sixteen language-specific regexes.
It returns exact UTF-16 candidate spans with `reviewRequired: true`. Surface
patterns are illustrative; semantic rules are not silently claimed as scanned.
The functions perform no model execution, automatic rewrite or attribution.

Prompt composition includes positive revisions, conditional validity and keep
examples. A host must validate returned findings and preserve source versions
before offering edits. The software tests establish data/API behavior only.
Qualification would require task-specific examples, human decisions, retained
counterexamples and observed model outputs; that evaluation was not performed.

## Negative-pattern extension

Every rule now exposes the failure shape separately from its remedy: a bilingual
name, symptom and reader cost. Four optional rules add unearned praise, false
balance, an unprioritized laundry list and forced rhetorical templates. The six-rule
task profiles and eight-rule lexical coverage stay fixed. These are editorial
anti-patterns, not an authorship classifier.

The [OpenAI postmortem of 29 April 2025](https://openai.com/index/sycophancy-in-gpt-4o/)
records an excessively agreeable GPT-4o update and its rollback. This is evidence
of a specific incident, not a current cross-model rate. The
[Model Spec of 18 December 2025](https://model-spec.openai.com/2025-12-18.html#assume-an-objective-point-of-view)
states that the treatment of views should reflect their evidential support.
Our false-balance rule applies that norm to technical choices; no measured failure
frequency is claimed. Both pages were opened and read on 12 September 2026.

Laundry lists derive from the existing task-oriented documentation guidance.
Forced templates derive from the style guidance, with linguistic profiling used
only as background. Overlap is explicit in relatedRuleIds: excessive options are
not the same as excessive formatting, and repeated form need not repeat facts.

The Development diary before-example is the exact Voice documentation passage
provided by the user in this task. Its after-example states current file locations.
It is a product-documentation case, not a recorded output from a named model.
