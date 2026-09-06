# Agent Studio website pilot — 7 September 2026

The real website is now reviewed through Voice Studio and substantially rewritten in its original Angular repository. The pilot establishes the source workflow; it does not qualify a best writing model.

## What was exercised

The original 27-route, 30-file editorial audit produced 36 exact-quote findings. These were imported as durable feedback and 21 source tasks. A repeated import created no duplicates.

One explicitly started Codex run (gpt-5.6-sol, medium, through CodingAgentRunner) returned six validated homepage edits in approximately 67 seconds. Each edit showed the original text, replacement and reason. The model result left the source unchanged. The separate Studio apply action wrote all six edits; the actual running Angular page reloaded with those changes and no browser errors.

The broader revision was then implemented in the repository: 26 content modules, the shared navigation and rendering, responsive hero/footer layout, mobile gallery controls and six PNG/WebP social-card pairs. Home now leads with a concrete task and review workflow. The setup guide names prerequisites and links the selected revision's README. The provider news corrects the paused announcement at its stated source date. The original German manifesto, real identity information, routes and dated repository measurements remain intact.

## Verification

- 54 route/viewport checks: all 27 routes at 1440px and 390px; internal routes/fragments, images and rendered headings checked.
- Actual Home → Setup → Tasktour → Imprint journeys, gallery navigation and a 1200px iframe; mobile gallery navigation was retested after its isolated CSS fix.
- No browser errors, missing images, document overflow or hero overlap in the successful checks. App source and assets still match those browser checks; the subsequently updated prerender validator was verified separately.
- The visible Studio project check ran npm run check and completed with exit 0 (493caeb049394ba4bfb751d98b2789d2). It covers TypeScript/template/SCSS linting, content validation, static Angular build, prerender acceptance and sitemap generation. The first failed run exposed obsolete headline/order expectations; that historical failure remains recorded.
- Regressions: 22 library tests, 91 backend assertions, 40 source-task checks, 31 fake-Runner checks, 44 project-check assertions, 17 asynchronous UI-state, 32 task-UI and 23 check-UI checks passed.

A separate actual UI/Node fixture verified three explicit check starts: success, intentional failure and active cancellation, plus logs, persistence and a stale pass after source changes. It made no model calls and had no browser errors.

The project check records source and host-configuration fingerprints, bounded output, exit status and history. It can be cancelled. A previous pass becomes stale after relevant changes. It runs trusted project code with host permissions; the fingerprints are optimistic guards, not an immutable process sandbox.

## Editorial outcomes and open work

The six-edit homepage task remains applied. Twenty other original tasks are manually completed with an explicit explanation of the source work. Three new queued tasks retain the unresolved public release/setup, host capability and pricing-adapter questions. No model was started for those follow-ups. Original feedback records remain historical; unsupported claims were removed or qualified rather than marked as proven.

The rule wiki explains why a hit such as “leistungsstark” is advisory, how the algorithm works and when a phrase may remain. Local language-tool candidates and separate engine, dictionary and rule-package licenses are documented in [language tooling](../language-tooling.md) and [third-party notices](../../THIRD_PARTY_NOTICES.md). None of those external checker engines was installed in this pilot.

## Images and records

- [Revised desktop homepage](assets/agent-studio-home-desktop.jpg)
- [Revised mobile homepage](assets/agent-studio-home-mobile.jpg)
- [Actual reviewed source edits](assets/studio-homepage-edits.jpg)
- [Visible website check](assets/studio-website-check.jpg)
- [Machine-readable evidence](agent-studio-pilot-2026-09-07.json)
- [Original editorial audit](agent-studio-website-2026-09-06.md)

Local entry points: Voice Studio at http://127.0.0.1:5188/?project=project-f80c52d87170 and the actual website at http://127.0.0.1:4184/ . Pairing credentials stay in the private local session.
