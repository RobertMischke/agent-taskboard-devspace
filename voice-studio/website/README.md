# Voice public website and technical guides

The site has five product pages and sixteen HTML guides: **21 static routes**.
The homepage gives the Studio UI and typed Library equal space, using an actual
local Studio screenshot alongside a complete TypeScript example. It explains
working with Git repositories and ordinary source folders.

- `/voice/`: Library + UI, source ownership and current availability.
- `/voice/studio/`: local start, seven-day browser access, logout and review.
- `/voice/library/`: supplied annotations, actual demo, typed API and host-owned AI/persistence.
- `/voice/docs/`: API, UTF-16 coordinates, source versions, callbacks and write preconditions.
- `/voice/project-reviews/`: planned page/project review and Git records.
- `/voice/guides/{slug}/`: the sixteen entries in [guides.mjs](guides.mjs),
  including typed integration, browser sessions, commands, evidence and the AGT plan.

Product content defaults to English and offers saved German. Technical guide
bodies remain English and say so explicitly; surrounding navigation controls,
copy buttons and source-reference controls support EN/DE. Switching interface
language does not translate code, evidence or technical guide prose.

## Build and preview

From the Voice Studio workspace:

```sh
npm run website:build
npm run website:preview
# In another terminal, with the preview running:
npm run test:website
npm run test:library-types
```

The preview binds only `127.0.0.1:5187`; open
[Voice](http://127.0.0.1:5187/voice/) or
[Technical docs](http://127.0.0.1:5187/voice/docs/).
Studio is a separate service on port 5188. The static public site contains no
Studio API, pairing data or backend credentials. Its Library demo uses supplied
findings and temporary browser state.

The maintained CLI entry is `scripts/build-website.mjs`; rendering and templates
live in this folder. `guides.mjs` explicitly lists document sources and example
downloads. The build does not recursively publish the workspace or ignored
maintenance archive. Curated evidence is included through its integrity manifest.

Guides render maintained Markdown as HTML with navigation, section links, typed
code highlighting, copy controls, tables and source references. Main navigation
opens HTML guides, not raw Markdown. A collapsed source section offers optional
Markdown downloads. References outside the publication catalogue remain repository
references rather than broken website links.

The build stages a complete new `website/dist/voice/` tree before replacing the
local output, removing obsolete files from the published subset. All 21 routes
have HTML files, relative assets, canonical URLs, a sitemap and a build record.
English content and navigation remain readable without JavaScript.
`build-info.json` records input hashes, routes and the checkout's commit/dirty
state; it does not establish a public deployment revision.

## Capture and verification scope

`assets/studio-review.png` is a real local Studio capture reviewing the
registered Agent Studio homepage in English with compact navigation. Its adjacent
`studio-review.capture.json` records time, viewport, source, selection and scope.
It is separate from the old screenshots in the historical verification catalogue.
The capture made no source, feedback, proposal, task or model writes.

The Library type test compiles isolated TS/checkJs and classic-global consumers
against distributed files. NodeNext/Bundler verify positive and intentionally
invalid fixtures. The actual TypeScript language service supplies tested
completions, signatures and JSDoc hover text. This does not automate VS Code's UI.

Run `npm run test:website` for routes, languages, viewports, links, copy controls,
guide navigation and the actual Library demo. Earlier twenty-view results belong
to the old five-page site. The expanded site passed 84 route/language/viewport combinations and 168 local
links/assets/fragments, exact code copy with native Windows newline normalization,
responsive guides, the actual Library demo and the no-JavaScript fallback. The
[separate follow-up evidence](../docs/verification/2026-09-12-browser-and-website/README.md)
retains the report and tested build-input hashes.

## Integrate into agent-orchestrator.dev

The target is **https://agent-orchestrator.dev/voice/**; it has not been published.
The ecosystem uses static product subtrees, so this output needs no runtime service.

1. Build and verify from an identified source revision.
2. Publish only `website/dist/voice/` to the explicitly selected deployment
   repository/branch mounted at `/voice/`.
3. Add the central Voice entry with Studio, Library and technical docs links where supported.
4. Retain host routing, legal information and caching policy; integrate the sitemap.
5. Verify public routes, assets and the deployed build record.

Central host configuration and the selected deployment repository remain external
inputs. The build issues no push or deployment. [deployment-manifest.json](deployment-manifest.json)
lists routes from the product-page and guide catalogues. Publishing a source
repository is a separate explicit decision.

The public Studio page starts an installed local copy. A hosted Studio service
would require a separate product, authentication and operating design.
