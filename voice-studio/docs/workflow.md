# Voice Studio: two workspaces, one review workflow

Preview 0.2 distinguishes a running application from a folder of documents.
Both retain the original source, durable feedback and version-checked proposals.

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
3. Save feedback with the source version in the project's metadata.
4. Optionally start a semantic review through the Coding-Agent-Runner.
5. Inspect its reasoning and bounded suggestion, or write your own replacement.
6. Create and inspect the complete source diff.
7. Explicitly apply it, then verify the changed file and rendered application.

Feedback, proposals and semantic run history remain associated with the project.
A stale source version cannot be overwritten. A source change can make an older
note or semantic result stale; the UI labels that state instead of presenting it
as a current finding. The original source backup/recovery journal remains in use.

## Semantic review is a Runner task

The implemented adapter uses `CodingAgentRunner` 0.7.0, not a direct model SDK.
Only the explicit review action starts a run. It stages the current file, mapped
units, feedback and bounded configured component context in a separate workspace.
The Runner is given read-only permission, clean context and no delegation.
Findings need valid source-version, unit, quote and UTF-16 span references plus
reasoning. Failed, cancelled, interrupted and stale runs are distinct from
completed results. Malformed or incomplete model replies fail validation.

Applying source changes remains an explicit backend proposal action. A semantic
suggestion enters the same
human-reviewed diff workflow as a manual suggestion. A syntactically valid JSON
reply is not a proof of truth or editorial quality. Qualification, comparative
Voice benchmarks and Token Economy admission remain separate integration work.
See [Runner integration](runner-integration.md) and [model strategy](model-strategy.md).

The original dossier introduction is a retained counterexample: the local rule
engine reports **zero findings** for “Voice Lint concept revision” and its
“Research and analysis behind a sober public voice…” paragraph. That result only
means no implemented fixed rule matched. A semantic review should address its
abstract internal terminology and weak explanation of the reader's benefit.
