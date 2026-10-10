# Deploy durations

Durations of every deployment from develop to Stable, so runs can be compared. Add one row after each deployment (newest first). All times are UTC.

## Measurement points

| Phase | Start | End | Source |
| --- | --- | --- | --- |
| Promotion | `promote-develop-to-main.sh --execute` started | `promotion-record.json` written | Evidence directory on agent-runner-01, `/home/agent/promotion-evidence/<tag>/` |
| of which gate | Gate start | Gate end | `gateDurationSeconds`, `hostLoadAtGateStart/End` in the record |
| Release package | `run-final-verified-release.sh <sha>` started | `releases/<sha>/release.sha256` written | `/home/agent/operator-verification/agt-memory-remote-20261004/` |
| Stable update | `update-stable.sh` started | Stable reports the new SHA, backend healthy | Wrapper log with a timestamp per line |
| of which wait | Quiescence check starts | "Stable runner is quiescent" | Wrapper log |
| of which downtime | `stop-stable.sh` | Backend `/healthz` returns 200 | Wrapper log and health probe |
| End to end | Promotion started | Stable healthy on the new SHA | |

Since 10 October the promotion and the release package run in parallel on the same SHA. End to end is therefore promotion start to Stable healthy, not the sum of the phases.

## Runs from 10 October 2026

| Date | Tag / SHA | Commits | Promotion | Gate | Load start→end | Release package | Stable update | Wait | Downtime | End to end | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 10.10. | release/20261010-210620Z / bc98c2717 | 660 | 46.5 min (21:07–21:53) | 47 min | 1.1 → 44.9 | 49 min (21:07–21:56) | 7.4 min (21:59:12–22:06:38) | 0 s | 6.9 min (21:59:44–22:06:36) | 60 min (21:07–22:06) | .NET suite done 21:46 (OrchestratorApi.Tests 8,961 tests, 37:50 min); gate window `unavailable` (no throttling); both gates in parallel on 12 cores. Update: artifact fetch 31 s; stop 2:19 min (backend ignored graceful stop, forced after 20 s); fast-forward 1:36 min; backend start 176 s; frontend 1 s |

## Earlier values (backfilled 10 October)

### Promotion develop → main

Total = tag timestamp to record written. Gate duration and load have been in the record only since 4 October.

| Date | SHA | Commits | Total | Gate | Load start→end |
| --- | --- | --- | --- | --- | --- |
| 05.10. 01:21 | b60de354d | 221 | 58 min | 58 min | 12 → 21 |
| 27.09. 15:12 | 6759fe303 | 8 | 32 min | | |
| 27.09. 12:46 | 9fc1cc36c | 81 | 30 min | | |
| 25.09. 22:57 | b3692985f | 53 | 18 min | | |
| 25.09. 08:43 | 09e189092 | 4 | 23 min | | |
| 25.09. 06:53 | 0238dfb0d | 85 | 25 min | | |
| 18.09. 02:46 | d98b06cb6 | 8 | 22 min | | |
| 17.09. 19:25 | dbdc2d466 | 7 | 16 min | | |
| 17.09. 15:26 | 551484dca | 25 | 16 min | | |
| 17.09. 06:18 | 35d798416 | 32 | 18 min | | |
| 16.09. 10:40 | 3c25d7f72 | 88 | 24 min | | |
| 14.09. 05:58 | 8ec569f8e | 13 | 12 min | | |
| 13.09. 19:21 | 879623565 | 15 | 15 min | | |
| 13.09. 02:37 | 62ac41f5c | 219 | 13 min | | |

Red gates (not promoted) are not listed. On 4 October four red gates ran for 6, 6, 56 and 26 min at loads up to 103.

### Stable update through the update service

From `GET http://127.0.0.1:5039/update/history`, successful updates with a SHA change only. The update to c076d2da on 4 October ran without the update service and has no measurements.

| Date | From → to | Total | Backend start |
| --- | --- | --- | --- |
| 28.09. 12:11 | 9fc1cc36c → 6759fe303 | 11.5 min | 230 s |
| 27.09. 13:21 | b3692985f → 9fc1cc36c | 12.8 min | 219 s |
| 25.09. 23:18 | 09e189092 → b3692985f | 20.1 min | 184 s |
| 25.09. 09:08 | 0238dfb0d → 09e189092 | 6.5 min | 157 s |
| 18.09. 03:16 | dbdc2d466 → d98b06cb6 | 5.5 min | 134 s |

## Observations

- The promotion grew from 12–15 min (mid September) to 58 min (5 October) and 47 min (10 October). Most of it is the .NET suite, mainly OrchestratorApi.Tests (10 October: 8,961 tests, 38 min).
- Backend start during a Stable update grew from 134 s to 230 s.
