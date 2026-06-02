# Exploratory probe — TODO sandbox in Runbook

| | |
|---|---|
| **Run start** | 2026-05-21 09:25 local |
| **Run end** | 2026-05-21 09:35 (probe loop) — task itself reached 5-human-review at 09:34:23 |
| **Probe** | [todo-app-full-test.spec.ts](../../../agent-taskboard-dev/frontend/e2e/exploratory/todo-app-full-test.spec.ts) + [todo-app-final-state.spec.ts](../../../agent-taskboard-dev/frontend/e2e/exploratory/todo-app-final-state.spec.ts) |
| **Artifact dir** | this folder (38 timeline shots + 3 final shots + raw run log + state JSONs per shot) |
| **Project under test** | Runbook (manual runner mode flipped to auto via UI, repo `C:\Projects\Runbook\App`) |
| **Task scope** | write a single self-contained `index.html` to-do app under `scratch/playwright-probe-todo/` |
| **Outcome** | ✅ Agent wrote file in 45 s. ❌ Auto-review left all 4 aspects at "concerns" (sentinel parse failure). |

## TL;DR

The agent loop **works end-to-end**: the Playwright probe created the task, the runner picked it up after I bumped it to position 1, Claude wrote a clean 58-line to-do app, and the system moved the task to `5-human-review` for sign-off. Manually opening the resulting `index.html` in a browser shows a working app (verified via [final-todo-app.png](final-todo-app.png)).

But the **review/UX layer has real issues** the probe surfaced:

1. The auto-review aspect runner systematically fell through to "concerns" because the model didn't emit the `[[ASPECT_VERDICT]]` sentinel — this is happening for **all four aspects identically**, which looks like a prompt or parser regression.
2. With ~200 cards in the active project, a brand-new task is invisible after creation: no highlight, no scroll-to, no "show recent" filter. The operator's working set is buried.
3. The runner picks tasks by stored order with no way to expedite a single task from the UI. I had to call `POST /api/jobs/{id}/move-to-top` directly.
4. Lane columns get clipped to ~80 px when the orchestrator rail opens; cards overflow.
5. Stale orchestrator chat history shows old npm-wrapper-bin spawn failures **even though the agent ran fine just now** — the chat lacks a way to tell "these errors are from sessions before the install was fixed".

Full breakdown below.

---

## Observation log

(Each entry: `seq | what I see | severity`.)

### shot-01 — welcome screen
- Welcome card visible centred. Two projects loaded: Agent Software Studio (447), Runbook (119).
- "+ New task" CTA is small, sits between the project chips and "All projects" — easy to miss visually.
- Statusbar bottom right shows `0 running · 0/2 auto` — no active runner. Useful at-a-glance gauge.
- **severity: low** — nothing wrong; minor info-density observation.

### shot-02 — picked Runbook
- Click on project picker dropdown lands cleanly. Tabs bar now shows "Runbook · Board".
- The picker dropdown auto-closed after selection — good.
- **severity: low**

### shot-03 / shot-04 — create dialog
- Dialog opens centred over board. Title input is focused. Project select defaults to currently active project (Runbook) — saved a click.
- Lane picker exposes 4 options inline (Backlog / Ready / In Progress / etc). The script picked "2-ready".
- The "Create" button has no `data-testid`; had to use `getByRole({ name: 'Create' })`. **finding: add testid to primary submit button** so E2E selectors don't depend on display text/i18n.
- **severity: medium** (testid gap).

### shot-05 — task created, dialog closed
- Dialog closes. The board now visibly populated with **~200 existing cards** ("s2x-dropcard-..." cluster, looks like seeded benchmark/load data). The newly-created "Playwright probe" task is **not auto-scrolled into view** and **not visually highlighted**.
- Lanes shown: BACKLOG / ACTIVE (Human Ready · In Progress · Auto Review) / DONE & DECIDE (Human Review).
- **finding: after create-task, the new card should either highlight briefly OR scroll into view.** Otherwise on a busy board the operator has no feedback that the task landed where they wanted.
- **severity: high UX**

### shot-06 — auto pickup armed
- Auto-toggle in the titlebar flipped from "manual" to "auto" (the script's log line confirms). The board didn't visually animate the change — only the small dot/label inside the project chip flipped. Easy to miss.
- **finding: auto-toggle state change deserves a clearer affordance** (toast or larger pill highlight on flip).
- **severity: medium**

### shot-07 / shot-08 — initial polls (20s & 40s post-create)
- Board is unchanged. The newly-created task is somewhere in the BACKLOG/READY column but lost in the 201 existing cards. Lane counts: backlog: 201, active: 28, decide: 18.
- **finding: with 200+ cards per lane the board is unusable as a working surface** — no virtualisation, no "recent first" sort visible, no filter affordance front-and-centre on top of the lane.
- **severity: high UX + perf** (DOM size on huge boards likely lags too).

### shot-10 / shot-11 — runner picked up A FIXTURE, not us
- Status bar flipped to `1 running · 1/2 auto` — agent loop is alive.
- Toast banner top-left: "Runner active state cleared: job moved out of 3-progress externally (3-progress -> 4-auto-review)". Good — the system notifies on external state moves.
- API check confirms the running job is `e2e-drop-between-C` (a seeded fixture), **not** our `playwright-probe-tiny-todo-sandbox`. Our task has `order=6510`; the e2e fixtures have lower order keys and get picked first.
- **finding: the operator has no UI affordance to "pick this task next" / pin a single task to the front of the runner queue.** New tasks vanish into a long FIFO with no way to expedite. (Backend has the endpoint `POST /api/jobs/{id}/move-to-top` — it just isn't exposed.)
- Lane-group sliver: the board column gets squashed when the orchestrator rail is open at the user's default width (640 px), leaving only ~70-80 px per lane. Cards still render at full width and get clipped → user has to scroll horizontally inside each lane to see anything.
- **finding: lane width should respect the available width and reflow when the side-rail opens.** Either narrower-card mode auto-engages OR the lane scrolls cleanly.
- **severity: high UX**

### shot-09 — steered via orchestrator
- Orchestrator chat opened cleanly via the new inline-shell layout (from this session's earlier work). Inline phase dividers correctly anchor in the Runbook chat history.
- **Important finding from the chat history:** repeated red bubbles showing
  > "An error occurred trying to start process `C:\Users\rmisc\AppData\Roaming\npm\node_modules\@anthropic-ai\claude-code\bin\claude.exe` with working directory `C:\Projects\Runbook\App`. The system cannot find the file specified."
- These messages are **stale** — they are from earlier orchestrator sessions (yesterday 05:53 PM, this morning 08:20 AM) where the npm wrapper bin was missing. The actual task we created later spawned Claude successfully (cli-output.log shows the native installer ran for 45 s).
- **finding: the orchestrator chat should mark messages from "different runtime/install conditions" or at least give the operator a "clear stale errors" affordance.** Right now stale red bubbles look identical to live errors.
- **severity: medium** (operator confusion, not blocker).

### Runner pickup of OUR task — shots 18 through 36
- After I bumped the order via API (`POST /api/jobs/.../move-to-top`), our task moved to position 1. The runner picked it up at **07:33:07 UTC (09:33 local)**, ~8 min after creation.
- The agent (Claude Sonnet 4.6) ran for 44.7 s, created the directory, wrote the 58-line `index.html`, emitted `[[TASK_DONE]]`. Two non-fatal hiccups along the way:
  - First attempt used `New-Item -ItemType Directory -Force` → exit code 127 (PowerShell command not recognised by the shell wrapper Claude got). Then retried with `mkdir -p` → fine.
  - **finding: Claude's first-try shell command on Windows assumed `New-Item` (PowerShell-only); the bash wrapper rejected it with exit 127.** Add a CLI startup hint that the shell is bash-like, OR transparently forward through PowerShell when on Windows.
  - **severity: medium** (wastes one tool call per "create a directory" pattern, every Windows session).
- Auto-review then ran the four aspect-runner passes. All four came back **"concerns"** with the same boilerplate:
  > "Aspect runner produced no parseable verdict. No `[[ASPECT_VERDICT]]` sentinel was found in the model reply."
- Task moved to **5-human-review** for the operator to sign off.

### Script's polling window missed the state transition
- The probe loop watched `[data-testid="lane-group-3-active"]` for our card's appearance, then clicked it and pressed Complete. But the task skipped 3-active entirely and went 2-ready → 3-progress (briefly) → 4-auto-review → 5-human-review. The probe never saw it.
- **finding: the testids for lane groups don't match the underlying state IDs.** The DOM uses lane-group ids like `backlog`, `active`, `decide` (per `[data-testid^="lane-group-"]`) but the job state IDs use `2-ready`, `3-progress`, `4-auto-review`, `5-human-review`. Mapping happens inside the lane-group definitions — but it's not discoverable by automation.
- **severity: medium** (E2E ergonomics).

### Auto-review aspect verdicts all = "concerns"
- All four aspect files (`aspect-requirement-fit.md`, `aspect-code-quality.md`, `aspect-documentation-impact.md`, `aspect-tests-and-evidence.md`) have identical bodies:
  > status: concerns · summary: Aspect runner produced no parseable verdict. · No `[[ASPECT_VERDICT]]` sentinel was found in the model reply.
- Orchestrator log: "Auto-review accepted ... as done with concerns. Moved to 5-human-review for your approval. Aspects: requirement-fit=concerns, code-quality=concerns, documentation-impact=concerns, tests-and-evidence=concerns. Tags: requirement:concerns, quality:concerns, docs:concerns"
- **This is a real product defect**, not a corner case of our specific task: when the aspect-runner's prompt fails to elicit `[[ASPECT_VERDICT]]`, the system defaults to "concerns" silently. Without inspecting these files manually, the operator only sees "concerns" tags everywhere — looks like quality problems with the agent's output, but actually the **review pipeline itself isn't measuring anything**.
- **severity: HIGH** — undermines trust in the auto-review verdict layer entirely. Either the aspect-runner prompt has drifted (Claude Sonnet 4.6 isn't reliably emitting the sentinel), or the parser regex got stricter, or there is a model/version mismatch.

### final-board.png — board state at end
- Without the orchestrator rail open, lanes are usable again (full width). I can see the three lane-groups, each lane has 3-5 cards visible above the fold.
- A card in **In Progress** shows "READ ONLY" badge — informative.
- Our `Playwright probe` card is presumably in Human Review but is scrolled below the viewport; even on this clean board, the new card isn't promoted to the top of its lane visually.

### final-todo-app.png — produced deliverable
- The agent's `index.html` opens cleanly in the browser, accepts items via "Add" button and Enter key, and items can be removed via the red × button. Two items rendered fine in the screenshot.
- Manual verdict on the deliverable: **PASS**. The auto-review-aspect "concerns" tags do not reflect actual quality — they reflect a sentinel-parse failure.

---

## Aggregated findings (sorted by severity)

| # | Finding | Severity | Type |
|---|---|---|---|
| F1 | Auto-review aspect runner returns "concerns" for all aspects when no `[[ASPECT_VERDICT]]` sentinel is parsed — undermines the entire review layer | **HIGH** | Bug |
| F2 | Newly-created task is invisible: no scroll-to, no highlight, no "show recent first" toggle | **HIGH** | UX |
| F3 | Boards with 200+ cards have no per-lane virtualisation, no filter shortcut on top of the lane | **HIGH** | UX + perf |
| F4 | Orchestrator rail open → lane columns clip cards instead of compacting/reflowing | **HIGH** | UX |
| F5 | No UI to "pick this task next" / expedite a single task — backend endpoint exists, just not surfaced | **MEDIUM** | Feature gap |
| F6 | Auto-toggle (manual ⇄ auto) state change has no toast/animation; easy to miss | **MEDIUM** | UX |
| F7 | Stale orchestrator chat history shows old npm-wrapper-bin errors that no longer reflect live state — operator confusion | **MEDIUM** | UX |
| F8 | Claude on Windows first tries `New-Item` (PowerShell), gets exit 127, retries with `mkdir -p` — wasted tool call every time | **MEDIUM** | Bug |
| F9 | Lane-group testids don't match job-state IDs; E2E automation needs an inferred mapping | **MEDIUM** | DX |
| F10 | "Create" submit button lacks a `data-testid` | **LOW** | DX |
| F11 | Welcome screen "+ New task" CTA is visually small relative to project cards | **LOW** | UX |

## What worked well
- **The inline-phase / super-phase divider work from earlier this session.** The orchestrator chat history rendered cleanly with the new Session 1/2/3 dividers, and adding a new steer correctly opened Session 3 since the gap > 15 min.
- **Toast notification on external state moves** ("Runner active state cleared: ..."). Right channel for that information — non-blocking but visible.
- **Project picker UX**: scoped the board view in one click, dropdown closed cleanly, the filter chip "PROJECT: Runbook · ×" gave a clear way to unscope.
- **Backend job-API ergonomics**: `move-to-top` worked instantly via curl. The state machine is well-factored — the gap is only that the UI doesn't expose all of it.
- **Native installer of Claude works for runtime spawn.** The boot warning was a false positive (already fixed earlier this session); the actual `claude.exe` ran successfully in 45 s without npm dependency.
