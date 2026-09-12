# Voice website

Six product pages with EN/DE navigation and sixteen English HTML guides form 22 content routes.
The homepage pairs a genuine Studio screenshot with a typed review-library example.
The native Research area renders maintained source records from `website/research/`,
with English analysis, methods, limits and reusable JSON. It is separate from the
technical guide system. The writing-patterns page uses the same versioned JSON catalogue as the Library.

| Route | Content |
| --- | --- |
| /voice/research/ | Practice articles, original studies, counter-strategies and library comparison |
| /voice/ | Studio, libraries and Git-backed source/review files |
| /voice/writing-patterns/ | Twenty AI writing anti-patterns, reader costs, counter-prompts, sources and actual local Library playground |
| /voice/studio/ | Local startup and three real Studio views |
| /voice/library/ | Review annotations, native selection and typed integration |
| /voice/docs/ | Studio, Library and agent workflow entry points |
| /voice/guides/{slug}/ | The explicit [guide catalogue](guides.mjs) |

Studio and Library form the tool group in the header. Research, AI anti-patterns
and Docs form the resource group. Existing `/voice/project-reviews/` bookmarks
redirect to the homepage; the redirect is absent from the sitemap.

## Build and serve

Run from the Voice Studio workspace:

```sh
npm run website:preview
# http://127.0.0.1:5187/voice/
```

The command builds both libraries and the website, then serves only loopback
port 5187. Studio runs separately on port 5188. The static website has no Studio
session or backend credentials. Playground text stays in browser memory;
surface checks and prompt composition call no model.

## Content and publication

`guides.mjs` lists public sources. Internal planning under `docs/plans/`
is excluded. The builder copies current storage JSON examples explicitly;
historical evidence is selected through its integrity manifest. Guide links
open HTML; source downloads remain in a collapsed reference section.
Verification links open formatted JSON dialogs with keyboard navigation,
loading/error states and a normal-link fallback when JavaScript is disabled.

Product content and controls support EN/DE with a saved language choice.
Guide prose and research references remain English. The rule catalogue provides
English and German examples, rule names and prompts; detailed source notes stay
in their original English.

The build stages a complete output tree and replaces `website/dist/voice/`.
Old files outside the allowlist cannot survive the swap. The build record contains
the source commit, scoped dirty state, routes and hashes for publication inputs.
It identifies a local build, not a public deployment.

## Screenshots

`assets/studio-review.png` shows an actual local Studio homepage review.
The Studio tour uses `studio-live-review.png`, `studio-source.png` and
`studio-focus.png` for passage review, original TypeScript and a narrow-screen
page view. Adjacent `.capture.json` files record capture scope. Captures preserve
the source and review state and expose no private absolute-path panel.

## Verify

```sh
# Website preview running:
npm run test:website
npm run test:writing-patterns
# Isolated or offline:
npm run test:json-viewer
npm run test:writing-rules
npm run test:evidence
```

Browser checks cover desktop/mobile EN/DE routes, assets and fragments, code copy,
no-JavaScript content, the actual annotation bundle and writing-rule package.
JSON viewer checks use an isolated fixture, including invalid records and safe
text rendering. Generated reports and screenshots are in ignored `test-results/`.
Retained evidence has its own timestamp and build-input hashes in
[verification records](../docs/verification.md).

## Ecosystem hosting

Target: https://agent-orchestrator.dev/voice/. Public deployment is not configured.
Publish only `website/dist/voice/` through the selected central hosting repository,
then verify its routes and build record. The source build performs no deployment.
[deployment-manifest.json](deployment-manifest.json) records route and host inputs.
The hosted static site does not include the local Studio backend.
