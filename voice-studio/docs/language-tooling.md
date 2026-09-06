# Local language tooling and licenses

Research checked on 2026-09-06 against the primary sources linked below.
These are evaluated integration candidates, **not installed analyzers in this
Voice Studio preview**. The implemented local engine still has four advisory
rules defined in knowledge/rules.json.

## Different checks need different mechanisms

A spelling dictionary is not a list of forbidden marketing terms. Spelling
requires a vocabulary and language-specific word forms. Grammar requires rules
about sentence structure. Editorial checks also need a page purpose, audience,
terminology and voice profile.

The proposed integration order is local LanguageTool for German/English grammar
and spelling, then Vale for the editorial profile. CSpell is an alternative or
complement for spelling in the JavaScript/TypeScript workflow. textlint is useful
when individual JavaScript text rules are needed; it does not include rules by
default. Hunspell is a lower-level spelling/morphology option. This ordering is
a Voice design judgment, not a measured quality ranking.

| Candidate | Role and language boundary | Core license | Primary sources |
|---|---|---|---|
| LanguageTool local core | Grammar and spelling, including German and English; coverage varies by language. The documented local basic server does not provide the cloud AI rules. | LGPL-2.1-or-later | [README](https://github.com/languagetool-org/languagetool/blob/master/README.md), [local server](https://dev.languagetool.org/http-server), [license and third-party warning](https://github.com/languagetool-org/languagetool/blob/master/languagetool-standalone/COPYING.txt) |
| Vale | Markup-aware editorial lint and terminology. Language-specific style rules must be selected or written. | MIT | [project](https://github.com/vale-cli/vale), [license](https://github.com/vale-cli/vale/blob/master/LICENSE) |
| CSpell / cspell-lib | Local spelling in code/documentation and a JavaScript API; language support comes from chosen dictionaries. | MIT | [packages and library](https://github.com/streetsidesoftware/cspell), [license](https://github.com/streetsidesoftware/cspell/blob/main/LICENSE) |
| Hunspell | Spelling and morphology using language-specific dictionaries and affix data. | license.hunspell offers MPL 1.1, alternatively GPL version 2 or later, or LGPL version 2.1 or later; inspect other included components separately. | [project](https://github.com/hunspell/hunspell), [license choices](https://github.com/hunspell/hunspell/blob/master/license.hunspell) |
| textlint | Pluggable JavaScript prose lint. Markdown/plain text are built in; other formats and every actual rule come from plugins/packages. | MIT | [project, defaults and license](https://github.com/textlint/textlint) |

The local LanguageTool documentation also describes optional language detection
with fastText. That is a separate model-bearing component, not a requirement for
an explicitly selected DE/EN language. A strict non-ML profile must inventory and
disable optional models rather than equate “local” with “no statistical model.”
The proposed Voice adapter uses explicit language selection.

## The dictionary license is a separate decision

Concrete examples demonstrate why a core license is insufficient:

| Resource examined | Exact upstream declaration | Consequence for the manifest |
|---|---|---|
| dictionary-de 3.0.0 / igerman98 | Package declares (GPL-2.0 OR GPL-3.0); its license text permits GPL version 2 or 3. | Record these choices precisely, not MIT, LGPL or an unrestricted “GPL later” claim. |
| dictionary-en 4.0.0 | Package declares (MIT AND BSD). The shipped license file contains SCOWL, Ispell, WordNet and other source/copyright notices. | Preserve the full resource notices. Do not invent one precise BSD SPDX variant from the package's abbreviated label. |

Sources: [DE package](https://github.com/wooorm/dictionaries/blob/main/dictionaries/de/package.json),
[DE license](https://github.com/wooorm/dictionaries/blob/main/dictionaries/de/license),
[EN package](https://github.com/wooorm/dictionaries/blob/main/dictionaries/en/package.json),
[EN license](https://github.com/wooorm/dictionaries/blob/main/dictionaries/en/license).
These resources have **not** been added to this project. They are examples of
separate data-license review, not a declaration about every German/English
dictionary or CSpell dictionary package.

LanguageTool explicitly notes that dependencies and resources can have different
licenses from its core. Vale styles and textlint rules likewise require their own
artifact review. A service subscription's terms are also separate from an
open-source engine license.

## Adapter contract before activation

For each enabled artifact, record:

- Tool and exact executable/library version, source URL and immutable artifact hash.
- Language/variant, selected dictionary/rule packages, their versions and hashes.
- Declared license expression, checked license-file URL, copyright notices,
  any chosen alternative, modifications and unresolved file/resource exceptions.
- Execution mode, whether any model is used and whether any network request occurs.
- Source coordinate convention and tested conversion into Voice's UTF-16 spans.
- Supported markup, excluded regions, DE/EN fixtures and observed false positives.

An adapter returns a finding with the engine and rule identity, explanation,
exact quote/span, optional suggestion and coverage. It must retain the source
mapping across HTML, Markdown and configured Angular content. Never send a lossy
flattened copy to every analyzer and then guess the original offsets.

A spelling warning and an editorial judgment remain different outputs. A word
can be spelled correctly and still be vague; a wordlist match can also be entirely
appropriate in context. No single count or readability metric certifies voice.

## Current implementation and evidence

The four local rules and the wiki use one knowledge/rules.json catalogue.
It includes exact regular expressions, contextual questions, counterexamples and
limitations. Semantic reviews and source tasks use CodingAgentRunner 0.7.0 with
explicit starts and staged read-only context; that is separate from these
non-LLM adapter candidates.

The resolved npm dependency metadata is recorded in
[the dependency inventory](licenses/npm-inventory.json); regenerate it with
the license-inventory.mjs script. It includes optional resolved packages and
explicitly records whether installed package metadata was available. This is not
a complete license audit of all distributed files.

See [third-party notices](../THIRD_PARTY_NOTICES.md) for actual project
dependencies. No license is assigned to first-party Voice code by this research.
