// Shared base for the browser QA checks in this folder.
// Playwright comes from the quality-studio frontend install; the browser is the
// locally installed Edge (fallback Chrome), always headless.
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const PLAYWRIGHT_HOST = 'C:/Projects/quality-studio/frontend/package.json';
const BROWSERS = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
];
export const ARTIFACT_ROOT = 'C:/Projects/agent-taskboard-devspace/artifacts';

/** Desktop light and dark plus a phone width; the default view set of every check. */
export const VIEWS = [[1280, 'light'], [1280, 'dark'], [390, 'light']];

export async function launchBrowser() {
  const { chromium } = createRequire(PLAYWRIGHT_HOST)('playwright-core');
  const executablePath = BROWSERS.find(existsSync);
  if (!executablePath) throw new Error(`No browser found in ${BROWSERS.join(', ')}`);
  return chromium.launch({ executablePath, headless: true });
}

/** Creates artifacts/<check>/<name> and returns its absolute path. */
export async function artifactDir(check, name, override) {
  const dir = resolve(override ?? `${ARTIFACT_ROOT}/${check}/${name}`);
  await mkdir(dir, { recursive: true });
  return dir;
}

/** Collects findings, prints each as a FAIL line, writes report.json and exits non-zero on findings. */
export function createReport(subject) {
  const findings = [];
  return {
    data: { subject, views: [] },
    fail(message) { findings.push(message); console.log(`FAIL ${message}`); },
    async finish(dir) {
      await writeFile(`${dir}/report.json`, JSON.stringify({ ...this.data, findings }, null, 2));
      console.log(`${findings.length ? 'FAILED' : 'PASSED'}: ${findings.length} issue(s). Screenshots and report.json in ${dir}`);
      process.exit(findings.length ? 1 : 0);
    },
  };
}

/** Horizontal overflow of the page and the elements causing it (scroll containers excluded). */
export async function pageOverflow(page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  const culprits = overflow > 1 ? await page.evaluate(() => {
    // Content inside a scroll or clip container cannot widen the page, whatever the container's class.
    const clipped = e => {
      for (let p = e.parentElement; p && p !== document.body; p = p.parentElement)
        if (['auto', 'scroll', 'hidden', 'clip'].includes(getComputedStyle(p).overflowX)) return true;
      return false;
    };
    return [...document.body.querySelectorAll('*')]
      .filter(e => e.getBoundingClientRect().right > innerWidth + 1 && !e.parentElement.closest('pre, svg') && !clipped(e))
      .filter((e, _, all) => !all.some(o => o !== e && o.contains(e)) || e.children.length === 0)
      .slice(0, 6).map(e => `${e.tagName.toLowerCase()} "${(e.textContent || '').trim().slice(0, 40)}"`);
  }) : [];
  return { overflow, culprits };
}
