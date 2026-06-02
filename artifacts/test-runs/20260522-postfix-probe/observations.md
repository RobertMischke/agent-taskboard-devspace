# Post-fix probe — 2026-05-22

| | |
|---|---|
| **Run** | 2026-05-22 17:48 local |
| **Probe** | [todo-app-full-test.spec.ts](../../../agent-taskboard-dev/frontend/e2e/exploratory/todo-app-full-test.spec.ts) |
| **Project** | **Playwright Test** (fresh sandbox at `test-repos/playwright-test/`) |
| **Fixes live** | F1-F11 + A1-A6 + C1 + B4 |
| **Outcome** | ✅ Agent ran in 15 s (vs. 45 s before F8). Auto-review returned 4 × **pass** with real summaries (vs. 4 × concerns with "no parseable verdict" before F1). |

## TL;DR vs. baseline (probe from 2026-05-21)

| Metric                                | Baseline (21.05) | Post-fix (22.05) | Δ |
|---------------------------------------|------------------|------------------|---|
| Agent wall-clock                      | 44.7 s           | **15.0 s**       | −66 % |
| First-try directory create            | `New-Item` → exit 127, then `mkdir -p` (1 wasted call) | direct `Write` tool, no shell call | F8 ✅ |
| Aspect verdicts                       | 4 × concerns ("no parseable verdict") | **4 × pass** with real summaries | F1 ✅ |
| Concern tags on task                  | requirement:concerns, quality:concerns, docs:concerns | none | F1 ✅ |
| Project picker counts (Runbook)       | 119 (incl. 91 fixtures) | **28** (working set only) | A2 + B4 ✅ |
| Lane visibility with rail open        | cards clip to ~80 px | auto-compact engages, lanes fit | F4 ✅ |
| Welcome "+ New task" CTA              | small inline text | accent-fill primary button | F11 ✅ |
| Test sandbox project visible          | n/a (used Runbook) | **Playwright Test** in picker even with 0 jobs | A2 D5-fix ✅ |
| Picker testid hit                     | n/a | `studio-project-picker-Playwright Test` resolves on first try | F9 + A2-fix ✅ |
| Create-dialog submit selector         | `getByRole({name:'Create'})` (i18n-fragile) | `getByTestId('create-submit')` | F10 ✅ |

## Per-screenshot log

| seq | what changed |
|---|---|
| shot-01 | Welcome-card now shows **3 projects** (Agent Software Studio 159 / Playwright Test 0 / Runbook 28). Promoted "+ New task" CTA is the accent button. |
| shot-02 | Project switch to Playwright Test → board renders empty lanes (Backlog/Active/Done & Decide) for the fresh sandbox. MANUAL badge in title-bar pill. |
| shot-03 | Create-dialog opens with the picked project pre-selected. Tags row already loaded from registry. |
| shot-04 | Dialog filled; the Create button has `data-testid="create-submit"` (no role-lookup fallback needed). |
| shot-05 | Dialog closes; new card appears in Ready lane. (F2 pulse is brief — visible in motion only.) |
| shot-06 | Auto-toggle clicked → titlebar pill flips manual ⇄ auto + toast "Playwright Test · auto-pickup enabled" (F6 ✅). |
| shot-09 | Steered via orchestrator (Session 1 / Phase 1 inline divider in chat). Status bar shows `2/3 auto` (auto-pickup armed). Toast top-left: "Runner active state cleared: job moved out of 3-progress (now in 4-auto-review) in Playwright Test". |
| shot-09 | F4 sichtbar: with the orchestrator rail at 640 px, BACKLOG/ACTIVE/DONE&DECIDE lanes auto-compact — no card clipping. |
| shot-10–37 | Steady-state polls. Probe's polling window expected the card in `lane-group-3-active` but the actual transition was 3-progress → 4-auto-review → 5-human-review, all within ~30 s (faster than the 20 s poll). The Complete button never got clicked because the polling logic didn't see the card before it cleared 3-active. |

## Specifically verified fixes

- **F1 (tolerant aspect-runner parser + worked-example prompt)** — all four aspect files now have `status: pass` with model-authored summaries:
  - requirement-fit: "All requirements met exactly as specified in the prompt."
  - code-quality: "Clean implementation with proper structure, correct functionality, and good UX/accessibility practices."
  - documentation-impact: "Internal test artifact with no public contract changes requires no doc updates."
  - tests-and-evidence: "Task was artifact creation, not feature change"
- **F8 (shell-environment hint in core.md)** — `logs/cli-output.log` shows ZERO PowerShell verb attempts. First action is direct `Write` to the target file. ~30 s saved per Windows job.
- **A2 + D5-fix (picker count + include zero-job projects)** — Playwright Test shows in the picker with `0` count; selecting it works on first try.
- **F4 (rail-open auto-compact)** — board readable with rail at 640 px (vs. shot-09 from baseline where cards clipped).
- **F6 (auto-toggle toast)** — "Playwright Test · auto-pickup enabled" toast on the flip.
- **F10 (create-submit testid)** — probe spec uses `getByTestId('create-submit')` cleanly.

## Findings from THIS probe (new)

1. **G1 — probe's polling window misses fast lifecycles.** The agent finished in 15 s; transitions 3-progress → 4-auto-review → 5-human-review happened inside one 20-s poll window. The probe's loop watched only `lane-group-3-active` for the title; it never saw the card before it cleared. ✅ **For tests against the new sandbox we need to either poll the API directly (state changes < poll interval) or scan ALL lane-groups for the title.** Light fix.
2. **G2 — duplicate task title from yesterday's Runbook run still surfaces.** API search for "Playwright probe" returns TWO matches (Runbook 5-human-review + Playwright Test 5-human-review). The Runbook one is the stale Tier 1 test that left `requirement:concerns, quality:concerns, docs:concerns` tags on it. The Playwright Test one has clean tags. **Add a step to the test-workspace docs: archive stale entries from old sandboxes via `move-to-top` patterns.**
3. **G3 — probe spec name is now misleading** — title says "(runbook project)" but it targets Playwright Test. Rename in next sweep.
4. **G4 — F9 lane-group testid attribute change** affected the probe selector. The probe was updated to query `[data-states*="5-human-review"]` — works. Document this in `frontend-testids.md`'s "recipes" so future probe writers don't have to rediscover.

## Visual evidence

- [shot-09.png](shot-09.png) — F4 + F6 + F7 all visible
- [run.log](run.log) — full timeline
- [playwright.log](playwright.log) — probe stdout
- [shot-01.png](shot-01.png) — initial welcome (3 projects, promoted CTA)
- [shot-05.png](shot-05.png) — create dialog with sandbox preselected

## Aspect outputs

- `agent-taskboard-workspace/projects/playwright-test/5-human-review/playwright-probe-tiny-todo-sandbox/aspect-*.md` — 4 × pass with real summaries (the F1 verdict layer is now trustworthy).
- `test-repos/playwright-test/App/scratch/playwright-probe-todo/index.html` — agent deliverable (62 lines, self-contained).
