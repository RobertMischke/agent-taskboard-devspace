# Voice Studio: two workspaces, one review workflow

Preview 0.3 distinguishes a running application from a folder of documents.
Both retain the original source, durable feedback, explicit source tasks and
version-checked proposals. The rule wiki explains the shared local checks.

The [language, navigation and review-choice guide](usability.md) covers English/
German UI, compact and overlay navigation, keep decisions, alternatives and current
file/Git provenance. The [holistic review design](holistic-review.md) describes
planned page/project tasks and portable Git context; those evaluators are not part
of the implemented file workflow below.

## Open and resume Studio

Pair once with the current code and leave **Remember this browser for 7 days**
selected to return after reloading or reopening the browser. **Log out** revokes
this browser’s access. The lifetime is fixed; use the same local app address.
See [browser sessions and the HTTP contract](browser-session.md).

## Angular applications: browse the running app

Start the application's own development server. Register its project directory
and open its local URL in Voice Studio. The iframe loads the original server
response, including Angular routing, scripts, assets and browser state. There
is no re-created page, injected reverse proxy or prerendered copy used as source.

An explicitly enabled `@voice/review` bridge connects that local page to Studio.
The parent verifies the exact window, local origin and session; review messages
also carry a page URL and review ID. No Studio bearer token crosses that bridge.
The parent only sends source units and review data to the local development
origin configured for the registered project. Remote destinations are rejected.

`voice.config.json` describes the source relationship:

```json
{
  "version": 1,
  "liveUrl": "http://127.0.0.1:4184/?voice-studio=1",
  "sourceFiles": ["src/app/content/*.ts"],
  "routes": {"/": "src/app/content/home.ts"},
  "sourceContexts": {
    "src/app/content/home.ts": [
      "src/app/page.component.ts",
      "src/app/page.component.html",
      "src/app/site-content.ts"
    ]
  }
}
```

The real Agent Studio website is onboarded this way: 27 routes reference their
original content modules and shared Angular renderer. Select text on the real
page; the review points to the content file, source line and related components.
An accepted text proposal changes that original TypeScript string literal. The
application's own rebuild and rendering show the result.

The TypeScript adapter uses the TypeScript AST without evaluating site code. It
extracts supported prose literals from explicitly included source files; imports,
code, technical values and interpolated templates are excluded. Replacements
preserve quote escaping, Unicode and the surrounding TypeScript structure.
Syntactic validity is checked; the application's typecheck/build remains a
separate verification step. Dynamic text or ambiguous DOM matches are not silently
assigned to a different source. A configured route names a file, not a complete
dependency graph; `sourceContexts` records the relevant known components explicitly.

The site's browser policy still applies. A local app that forbids iframe embedding
must allow its development Studio parent, or be opened in its own tab. The latter
is ordinary browsing and does not imply a connected review panel. Production
builds should not enable the developer bridge automatically.

## Markdown: browse the project folder

Register a folder, navigate through its subfolders, and open a Markdown file.
The source remains the file in that folder. Its rendered view supports mapped
prose, links, basic emphasis and visible excluded code. File reports cover all
supported units in the file; project reports aggregate the registered inventory.

The example handbook has `guides/` and `checklists/` folders so folder navigation
and relative Markdown links can be exercised. Markdown rendering is a supported
subset, not a full CommonMark implementation. This generated document view is
sandboxed without scripts; the opt-in live application above runs on its own
explicitly configured development origin. Cross-markup replacements are
rejected when the source adapter cannot preserve the structure safely.

## Review and source changes

1. Browse the application or folder in its normal context.
2. Open local findings or select an unmarked mapped passage.
3. Read the rule’s explanation. Keep the wording or compare a suggestion; feedback is optional.
4. Optionally start a semantic review of the whole selected file.
5. Explicitly generate alternatives, write an optional replacement, or save a task with an instruction and selected feedback.
6. Start the saved task explicitly through the Coding-Agent-Runner.
7. Read its outcome and inspect any complete source diff.
8. Apply the proposal explicitly.
9. Explicitly start the configured local project check, inspect its result, and verify the running application.

Feedback, source tasks, proposals and semantic run history remain associated with the project.
A stale source version cannot be overwritten. A source change can make an older
note or semantic result stale; the UI labels that state instead of presenting it
as a current finding. The original source backup/recovery journal remains in use.

## Local project checks after apply

The project-check panel offers a separate explicit start for the configured
build/test command. The Angular pilot uses its existing `npm run check`.
It shows running/cancelling status, bounded logs, exit code and the final
completed, failed or cancelled result. Results persist with the configured
source fingerprint; changed source or check configuration makes them `stale`,
with the original outcome retained. Applying a proposal never starts a check
automatically or marks an earlier result current.

Only private host configuration outside the target repository chooses the fixed
command and inputs; HTTP requests and `voice.config.json` cannot provide programs
or arguments. Missing configured dependencies block start. This executes trusted
project code with the host user's permissions, without a model or a sandbox
guarantee. See [local project checks](../backend/CHECKS.md) for setup, source
scope and process limits. A passing build still needs a review of the rendered
page and its wording.

## Saved tasks and decisions

Saving a task records its instruction, selected feedback, source version, feedback
revision and the configured component-context fingerprint. Saving does not call a
model. The explicit start is idempotent; retries of the same request do not create
a second Runner launch. A new attempt uses a new task after the source and
feedback have been reviewed.

| Outcome | What it means | Next step |
| --- | --- | --- |
| `queued` | Saved, with no model execution | Inspect the instruction/context and start explicitly |
| `running` / `cancelling` | A Runner attempt is active or stopping | Observe or cancel; no source is written |
| `ready` | A validated, combined source proposal is available | Inspect the complete diff and apply explicitly |
| `completed`, `agent_no_changes` | The agent explicitly reported `already_satisfied`, with a reason and no open findings | Review the reason; no text was changed |
| `needs_review` | Required facts or supported source operations are missing | Read the reason, provide evidence or prepare a broader task |
| `failed` / `cancelled` / `interrupted` / `stale` | The attempt cannot provide a current successful proposal | Inspect the recorded outcome; no automatic restart |
| `applied` | The separately approved proposal was written | Verify the real source and rendered result |

A task proposal can combine 1–50 non-overlapping supported prose replacements in
**one original file**. Every replacement refers to that original source version;
the backend validates exact quotes, Unicode and source mapping, then applies the
set to one source snapshot. It rejects overlap, unsafe markup boundaries and
unsupported structural changes instead of applying a partial set. A related
Angular component remains context, not an additional write target.

Source, feedback revision and component-context hashes are rechecked around
launch and before proposal creation/apply. A changed context requires renewed
review. A separate manual resolution needs a written reason and current source
and feedback state; it is visibly distinguished from an applied fix. Even a
validated `already_satisfied` statement is the model’s judgment, not independent
proof that the editorial task was solved.

## Semantic review is a Runner task

The implemented adapter uses `CodingAgentRunner` 0.7.0, not a direct model SDK.
Only the explicit review action starts a run. It stages the current file, mapped
units, feedback and bounded configured component context in a separate workspace.
The Runner is given read-only permission, clean context and no delegation.
Findings need valid source-version, unit, quote and UTF-16 span references plus
reasoning. Failed, cancelled, interrupted and stale runs are distinct from
completed results. Malformed or incomplete model replies fail validation.

Applying source changes remains an explicit backend proposal action. Ordinary
semantic-review findings are advisory; they do not create proposals automatically.
An explicitly started improvement task may prepare a validated combined proposal,
which enters the same human-reviewed diff workflow as a manual suggestion. A syntactically valid JSON
reply is not a proof of truth or editorial quality. Qualification, comparative
Voice benchmarks and Token Economy admission remain separate integration work.
See [Runner integration](runner-integration.md) and [model strategy](model-strategy.md).

## Explain the checks and preserve review evidence

The local checker and wiki load one `knowledge/rules.json` catalogue with four
advisory rules, their triggers, questions, examples and limitations. The wiki also
explains source mapping, feedback, model choice and language-tool candidates.
LanguageTool, Vale, CSpell, Hunspell and textlint are not integrated analyzers in
this preview. See [language tooling](language-tooling.md) and
[third-party notices](../THIRD_PARTY_NOTICES.md) for engine/data separation and the
604-entry resolved npm metadata inventory.

The [Agent Studio website review](reviews/agent-studio-website-2026-09-06.md) covers
all 27 routes and 30 content files. Its 36 findings retain exact quotes, file
hashes, evidence and dispositions in a companion JSON file. Import only after
rechecking the current source; release-alignment questions are not automatically
false claims, and replacement text is not automatically applied.

The original dossier introduction is a retained counterexample: the local rule
engine reports **zero findings** for “Voice Lint concept revision” and its
“Research and analysis behind a sober public voice…” paragraph. That result only
means no implemented fixed rule matched. A semantic review should address its
abstract internal terminology and weak explanation of the reader's benefit.
