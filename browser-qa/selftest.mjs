// Self-test for the browser QA checks: runs each check against its defect
// fixture and requires every expected finding, and nothing that must stay silent.
// Usage: node browser-qa/selftest.mjs   (run after every change to this folder)
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';

const here = dirname(fileURLToPath(import.meta.url));
const CASES = [
  {
    check: 'dossier.mjs',
    fixture: 'fixtures/dossier-defects/index.html',
    expect: [
      /fig 1 text-overlap: "first label here" x "second label here"/,
      /fig 1 spills-out-of-box: "a label far too long for its badge"/,
      /fig 1 stroke-through-text: "crossed by a line"/,
      /fig 1 outside-viewbox: "outside the viewBox"/,
      /390\/light: horizontal overflow \d+px from code "backend\/Features/,
      /1280\/light: body has no background/,
    ],
    forbid: [/covered line, no finding/, /wide table in a scroll box/],
  },
  {
    check: 'studio.mjs',
    fixture: 'fixtures/studio-defects/index.html',
    args: ['--scope', '#panel', '--viewport', '800x600'],
    expect: [
      /overlap "(20260928T1211Z-release-id|Reconnect)" .* x "(Reconnect|20260928T1211Z-release-id)"/,
      /spills-out-of-box \+\d+px "a nowrap label far too long for its column"/,
      /double-scroll div\.outer scrolls \d+px because absolute element caption escapes its clipping parent/,
    ],
    forbid: [/ellipsis label stays silent/, /nested control, no finding/],
  },
];

let failed = 0;
for (const c of CASES) {
  const run = spawnSync(process.execPath, [join(here, c.check), join(here, c.fixture), join(tmpdir(), `browser-qa-selftest-${c.check}`), ...(c.args ?? [])], { encoding: 'utf8' });
  const out = run.stdout + run.stderr;
  const missing = c.expect.filter(re => !re.test(out));
  const leaked = c.forbid.filter(re => re.test(out));
  if (run.status !== 1) { failed++; console.log(`FAIL ${c.check}: expected exit 1, got ${run.status}`); }
  for (const re of missing) { failed++; console.log(`FAIL ${c.check}: missing finding ${re}`); }
  for (const re of leaked) { failed++; console.log(`FAIL ${c.check}: false positive ${re}`); }
  if (!missing.length && !leaked.length && run.status === 1) console.log(`ok   ${c.check}: ${c.expect.length} defect classes found, ${c.forbid.length} false positive(s) absent`);
  else console.log(out);
}
process.exit(failed ? 1 : 0);
