# Task Detail Pipeline UI Handoff

Date: 2026-07-07
Audience: Agent Studio implementation task
Status: Ready for production integration

## Short Version

Implement the Task Detail Overview pipeline refinements that were designed in
the standalone workbench. The design is now directionally settled: keep the
existing compact Task Detail tabs and three-panel workbench layout, preserve the
current concise pipeline density, but integrate the missing production behavior
around all configured pipeline steps, grouped collapse, multiple runs, token
usage, duration, step details, concerns, and real data binding.

This is not a request to rebuild the Task Detail view from scratch. Start by
auditing the current Angular implementation and then reconcile it with the
workbench decisions below.

## Source Artifacts

Primary reference files from the design session:

- `C:\Projects\agent-taskboard-devspace\artifacts\task-detail-full-view-workbench.html`
- `C:\Projects\agent-taskboard-devspace\artifacts\improvement-plans\task-detail-pipeline-ui-implementation-plan.md`

Reference screenshots:

- `C:\Projects\agent-taskboard-devspace\artifacts\task-detail-full-view-workbench.png`
- `C:\Projects\agent-taskboard-devspace\artifacts\task-detail-full-view-workbench-done.png`
- `C:\Projects\agent-taskboard-devspace\artifacts\task-detail-full-view-workbench-empty.png`
- `C:\Projects\agent-taskboard-devspace\artifacts\task-detail-full-view-workbench-running.png`
- `C:\Projects\agent-taskboard-devspace\artifacts\task-detail-full-view-workbench-collapsed.png`
- `C:\Projects\agent-taskboard-devspace\artifacts\task-detail-full-view-workbench-mobile.png`
- `C:\Projects\agent-taskboard-devspace\artifacts\task-detail-full-view-workbench-step-modal.png`
- `C:\Projects\agent-taskboard-devspace\artifacts\task-detail-full-view-workbench-step-modal-blocked.png`
- `C:\Projects\agent-taskboard-devspace\artifacts\task-detail-full-view-workbench-step-modal-running.png`

Important: the workbench is a design reference. The production source of truth
is the Angular app and backend API.

## Current Production Anchors

Likely frontend entry points:

- `frontend/src/app/features/task-detail/components/prompt-pane/overview-pane/overview-pane.component.ts`
- `frontend/src/app/features/task-detail/components/prompt-pane/overview-pane/overview-pane.component.html`
- `frontend/src/app/features/task-detail/components/prompt-pane/overview-pane/overview-pane.component.scss`
- `frontend/src/app/features/task-detail/components/prompt-pane/pipeline-step-result/`
- `frontend/src/app/features/task-detail/components/prompt-pane/pipeline-token-usage/`
- `frontend/src/app/features/task-detail/components/prompt-pane/task-prompt-popover/`
- `frontend/src/app/features/task-detail/components/prompt-pane/agent-work-detail/`
- `frontend/src/app/services/task.service.ts`
- `frontend/src/app/features/task-pipeline/`

Relevant existing E2E coverage to inspect and extend:

- `frontend/e2e/task-detail/pipeline-core-token-usage.spec.ts`
- `frontend/e2e/task-detail/pipeline-agent-run-count.spec.ts`
- `frontend/e2e/task-detail/pipeline-restart-indicator.spec.ts`
- `frontend/e2e/task-detail/pipeline-step-explanations.spec.ts`
- `frontend/e2e/task-detail/pipeline-step-usage.spec.ts`
- `frontend/e2e/task-detail/pipeline-live-step-status.spec.ts`
- `frontend/e2e/task-detail/pipeline-final-verdict-and-parallel.spec.ts`
- `frontend/e2e/task-detail/pipeline-orchestrator-review-distinct.spec.ts`
- `frontend/e2e/task-detail/overview-prompt-popover.spec.ts`
- `frontend/e2e/task-detail/activity-runs-modal.spec.ts`

Read first:

- `AGENTS.md`
- `frontend/AGENTS.md`
- `docs/domains/frontend.md`
- `docs/domains/pipeline.md`
- `docs/domains/tasks.md`

## Product Intent

The Task Detail Overview should be a real workbench surface. It should let an
operator understand the current task without switching tabs:

1. What is the current status?
2. Who owns it?
3. Which agent/CLI/model is responsible?
4. How many tokens did the task and each completed step use?
5. How long did each executed step take?
6. How many pipeline runs happened?
7. Which steps are configured but disabled or not reached yet?
8. Which step has the relevant prompt, docs, result, concerns, and timing?
9. What is done, what is blocked, and what still needs a decision?

The operator liked the existing tab style and compact pipeline density. Preserve
that feeling. The workbench only demonstrates missing refinements.

## Decisions From The Design Session

### Keep

- Keep the current Task Detail tabs. They are more coherent than the mockup.
- Keep the compact pipeline density. The current compactness is a major
  advantage.
- Keep the three-panel Task Detail workbench layout: Overview, Protocol/Activity,
  and Git/Commits/Files.
- Keep the existing panel toggle concept. Do not introduce a special left rail
  collapse for the Overview panel.
- Keep the current product style. No marketing layout, no hero treatment, no
  oversized cards.

### Remove Or Avoid

- Remove the compact option from the pipeline toolbar.
- Remove pipeline filter buttons such as All, Risk, Run, Metrics from the
  Overview pipeline. The pipeline should be directly readable.
- Remove "Prompt / Runs / Jump" style clutter from the top area if it does not
  serve a clear task-detail workflow.
- Do not render a pipeline configuration editor in the Overview. Configuration
  belongs in project settings. Overview is the read-only operational view plus
  safe inline optional-step enable/disable where applicable.
- Avoid tag soup in summary blocks. Use tabular key/value presentation.
- Avoid button-looking status pills such as "Released to main" inside summary
  cards when they are not actions.
- Avoid colored text-heavy row content. Use tone through border, icon, group
  header, and collapsed group background rather than tinting all row content.
- Remove heavy left status lines from pipeline rows.
- Avoid fake placeholder values such as `0` tokens or "No timing yet" on rows
  that have not run.

### Must Preserve

- The pipeline is configurable, therefore the Overview must always represent the
  complete configured pipeline shape.
- Disabled steps must remain visible.
- Optional pending steps must expose enable/disable affordances.
- Completed, running, blocked, failed, or otherwise already-resulted steps must
  not be switchable off retroactively.
- Empty or inactive sections may start collapsed, but the section itself must
  remain visible.

## Pipeline Layout Requirements

### Grouping

Group all configured steps into the same conceptual groups used by the
workbench:

- Pre steps
- Core agent work
- Decision
- Tool
- Aspect
- Tool
- Decision
- Tool
- Decision
- Drift

Use the production catalogue/order where it differs. The important behavior is
that all configured groups remain represented.

### Group Collapse

- Sections are collapsible.
- Collapse is triggered by clicking the section row/header.
- Do not use a separate heavy expand/collapse icon button.
- Use plus/minus or a similarly clear affordance if a marker is needed.
- Sections with no active, risky, or relevant completed detail may default to
  collapsed.
- Collapsed sections must still show enough aggregate state to understand what
  happened.

### Group Aggregate Tone

Collapsed and expanded groups must preserve aggregate state:

- Green/ok when all executable contained steps are complete/passed.
- Red/danger when any contained step is failed, blocked, or requires human
  decision.
- Amber/warn when the group contains active/running work.
- Muted when the group is disabled or skipped.
- Neutral when nothing has run yet.

Use the tone on the group header or group summary. Do not tint every row's
content.

### Step Row Density

- Step rows should remain compact.
- The second lane text column such as PRE / AGENT / DECISION can be reduced to
  a small icon or compact kind marker with a tooltip.
- Use a lighter pipeline type weight than the main page content.
- Give the main group headings a little breathing room. The last iteration felt
  close, but slightly too dense in the top-level headings.
- Long step names must truncate gracefully and keep details accessible through
  tooltip or dialog.

### Status And Controls

Every row should communicate:

- status icon
- step kind
- step name
- optional prompt/detail access
- concern indicator when relevant
- result access only when there is a real result
- duration when the step has run
- token use when the step has run

Optional pending/disabled steps:

- Show a subtle enable/disable control.
- The control should be icon-like and quieter than a text toggle.
- Do not use heavy on/off text labels.

Required or immutable steps:

- Show a subtle static marker.
- The previous required icon felt odd/heavy. Use a calmer outline or info-like
  marker.
- Completed/resulted steps are immutable in the Overview.

## Token Requirements

Tokens are important and should be visible everywhere they are meaningful.

Requirements:

- Show total task token use in the Overview summary.
- Show token use for every executed/done/running pipeline step.
- Use the same board-style token control as the task cards where possible: the
  small bar-chart icon plus compact formatted number.
- Format compactly: `999`, `21k`, `123k`, `1.4m`.
- Do not render `0` for not-yet-run rows.
- Do not render empty token controls for pending/locked/disabled rows.
- If a done step has no token data because historical data is missing, render a
  deliberate missing-data state, not a fake zero.
- Section totals are useful if they can be computed honestly. Do not invent
  totals if the backend cannot distinguish step-owned usage.

Data binding work:

- Define the authoritative source for per-step tokens.
- Define whether core-agent tokens come from run footer, activity telemetry,
  pipeline execution JSON, or a merged projection.
- Ensure multiple runs are handled without losing old run token usage.
- Centralize formatting in the existing formatting utility instead of duplicating
  formatter code.

## Timing Requirements

Duration matters on each step.

Pipeline row:

- Show compact duration for every executed/running step.
- Running rows should show live duration if production data supports it.
- Do not show "No timing yet" or placeholder text on not-yet-run rows.

Step detail dialog:

- Show duration.
- Show start timestamp.
- Show end timestamp when known.
- Show run context.
- Show last activity as a useful context row.

Data binding work:

- Bind to real activity/timeline/pipeline timestamps.
- Remove or avoid workbench-style inferred timestamps in production unless the
  UI explicitly labels them as estimates.

## Multiple Pipeline Runs

The operator explicitly needs to see repeated pipeline starts and core-agent
re-runs.

Requirements:

- Show a compact pipeline run band/switcher near the Pipeline heading.
- Show how many runs exist.
- Show current run and prior runs.
- Show restart count when there are multiple attempts.
- Core Agent Work must show an aggregated run count when it has more than one
  agent run.
- Existing run history must not disappear when the current run is active.
- Step details for Core Agent Work must expose run history with status,
  duration, tokens, start/end, and summary where available.

Existing frontend note:

- `frontend/AGENTS.md` already has a Run-Switcher UI contract. Keep it backed
  by archived pipeline execution records, not only the current in-memory record.

## Summary Block Requirements

The top summary should be calm, compact, and tabular.

Include:

- Current decision/status headline in the summary header.
- Activity row that combines last activity and total duration.
- Owner.
- Agent/CLI.
- Lane.
- Total tokens.
- Signals such as commits, test pass, warnings, open items.

Avoid:

- Tag soup.
- Button-looking status pills.
- Heavy nested boxes.
- Repeating the same status in both header and table unless it improves clarity.

Tone:

- A colored header/accent is acceptable.
- The body should remain neutral and readable.
- Use red/green/warn border/header tone for the summary block.

## Step Detail Dialog Requirements

The step details need to become a serious, reusable detail level for every step.

Open behavior:

- Every prompt-backed step needs a detail affordance.
- Prefer one main details action per step instead of separate Prompt Details and
  Show Result buttons when both open the same modal.
- A separate action is useful only if it opens a genuinely different target,
  such as a real result artifact viewer.

Dialog content:

- Step name and kind.
- Status.
- Owner.
- Agent/CLI/model where known.
- Lane/run context.
- Duration.
- Start timestamp.
- End timestamp.
- Token use.
- Prompt.
- Docs/reference links.
- Result, only when an actual result exists.
- Concerns.
- Activity excerpt or last activity.
- Run history where relevant.

Dialog UX:

- Make prompt content easy to read.
- Use the product's standard modal/dialog component.
- Close button, Escape, backdrop behavior, focus handling, and screen-reader
  labeling must follow the existing dialog conventions.
- Return focus to the invoking row/action after close.
- Keep the dialog useful in blocked, running, done, empty, and sparse data
  scenarios.

## Result And Concerns

Result:

- Show result access only when a result exists.
- Do not show empty result actions for pending, locked, disabled, or not-reached
  steps.
- A final summary can show final result content, but it should not look like an
  action unless it is clickable.

Concerns:

- Concerns need a concrete example in the UI and tests.
- Show count/severity in the pipeline row when present.
- In the dialog, separate concern summary from evidence and next step.
- Examples to cover:
  - blocked integration test evidence
  - missing artifacts in sparse data
  - final orchestrator review blocked because evidence is insufficient

## Icons

The icon system needs one final pass.

- Use a classic round info icon for details.
- The detail icon should be lighter than the previous heavy "D" marker.
- The log icon should be visible but not too heavy. Prefer an outline variant.
- The lock/static marker must be recognizable. The previous lock icon was too
  faint, then too heavy. Use a stable product icon if available.
- The required/static marker should not look like a broken or dominant control.
- Use product icon components where available instead of ad hoc glyphs.
- Provide accessible labels/tooltips for icon-only controls.

## Scenarios To Preserve

The workbench intentionally covers several states. Production tests should cover
the equivalent states with existing fixtures or new targeted fixtures:

- Blocked: repeated run, failed core agent work, final decision needs human
  decision, concerns visible.
- Running: current active core work, tokens rising, live duration.
- Done: multiple runs, final result exists, all completed groups show ok tone.
- Empty: configured pipeline exists, no run yet, collapsed neutral groups, no
  fake tokens or timing.
- Sparse: partial data and missing artifacts still render honestly.

## Accessibility And Interaction

Must cover:

- Keyboard collapse/expand for section headers.
- Focus-visible treatment for icon-only actions.
- Modal focus trap and return focus.
- Screen-reader labels for detail, concerns, token, enable/disable, and run
  controls.
- Tooltips on icon-only controls.
- No reliance on color alone for status.

## Data Model Work

Before implementation, define or confirm:

- How `TaskPipelineResponse` represents all configured steps.
- How disabled steps are represented.
- How step status is derived.
- How per-step prompt references are fetched.
- How docs references are attached to a step.
- How result artifacts attach to a step.
- How concerns attach to a step.
- How run history maps to steps.
- How per-step started/completed/duration fields are populated.
- How per-step and per-run token use is calculated.
- How Owner, Agent, Lane, Last Activity, and total duration are projected.

Do not bypass the API or read/write task folders directly for production
behavior.

## Integration Strategy

Recommended order:

1. Audit current Overview pipeline behavior against this handoff and the
   workbench.
2. Create or update view models first. Keep the template simple.
3. Add any missing backend/projection fields needed for honest data binding.
4. Implement group aggregate tone and collapse behavior.
5. Implement token and duration row rules.
6. Implement or extend the step detail dialog.
7. Wire result/concern visibility correctly.
8. Add tests.
9. Capture screenshots for Blocked, Running, Done, Empty, and a collapsed group
   state.

## Test Expectations

Unit/component tests:

- View model derivation for group tones.
- Token formatting and visibility.
- Duration visibility.
- Result visibility.
- Step immutability for completed/resulted rows.
- Optional pending enable/disable visibility.
- Modal content derivation.

E2E tests:

- Pipeline shows all configured sections.
- Disabled steps are visible.
- Optional open steps can be toggled when allowed.
- Completed/resulted steps cannot be toggled off.
- Executed visible steps show duration.
- Executed visible steps show token use.
- Empty/not-run rows show no fake `0` tokens.
- Result action/section appears only when result exists.
- Multiple pipeline runs remain visible.
- Core Agent Work exposes run history.
- Collapsed ok/problem groups preserve green/red/warn aggregate tone.
- Step detail dialog shows prompt, docs, duration, start, end, tokens, and run
  context.
- Concerns are visible from the row and explained in the dialog.

Visual verification:

- Run relevant Playwright specs.
- Capture screenshots for desktop and narrow/mobile-ish width.
- Verify no text overlap.
- Verify no horizontal scroll in the pipeline.
- Verify long titles and long step names are still usable.

## Acceptance Criteria

- The Overview pipeline remains compact and visually consistent with the current
  Task Detail tabs.
- The complete configured pipeline is represented, including disabled steps.
- Pipeline sections are collapsible, with inactive sections defaulting collapsed
  when appropriate.
- Collapsed sections still show aggregate status through subtle group tone.
- Pipeline rows use compact kind icons/markers, not wide lane text.
- Optional pending steps expose subtle enable/disable controls.
- Completed/resulted/running/blocked steps cannot be disabled from the Overview.
- Every executed visible step shows token use when token data exists.
- Every executed visible step shows duration.
- No not-run row shows fake `0` token usage.
- No not-run row shows "No timing yet".
- Multiple pipeline runs are visible and selectable/inspectable.
- Core Agent Work preserves prior run history.
- Step details show prompt, docs, duration, start/end, tokens, owner, agent, run
  context, concerns, activity, and result only when available.
- Summary data is tabular, not a chip soup.
- Header/summary tone is subtle and readable.
- Concern examples are present and tested.
- The implementation is covered by focused unit tests and relevant Playwright
  tests.

## Non-Goals

- Do not redesign the entire Task Detail shell.
- Do not change the current tab style unless a direct conflict is found.
- Do not add a pipeline configuration editor to Overview.
- Do not introduce a separate left-rail collapse.
- Do not remove Protocol, Activity, Code Review, Evidence, Git, or Files
  behavior.
- Do not invent token or timing values when data is missing.
- Do not broad-refactor unrelated task-detail panes.

## Workbench Audit Snapshot

The standalone workbench was checked with local Chrome automation after the
design iteration.

Observed good states:

- `Blocked`: run band shows `2 runs | 1 restart`; task tokens show `47.6k`;
  visible executed rows have tokens and duration; no fake zero tokens.
- `Running`: run band shows one active run; live token summary is visible; no
  fake zero tokens.
- `Done`: run band shows `3 runs | 2 restarts`; 19 visible executed rows had
  tokens and duration in the workbench.
- `Empty`: all groups collapsed; no visible fake row tokens or timings.
- `Sparse`: one run, partial data, no fake zero tokens.
- Step detail for blocked `Agent execution` showed status, duration, start, end,
  tokens, owner, agent, two-run history, prompt, docs, result, concerns, and
  activity.

Known workbench limitations:

- It uses mock/fallback data.
- Timing fallback is illustrative, not production truth.
- The production implementation should bind to real API data and tests.

## Final Operator Direction

The operator considered the UI close and visually successful. Remaining work is
not another broad design pass. It is production integration, data binding,
accessibility, and regression coverage.

