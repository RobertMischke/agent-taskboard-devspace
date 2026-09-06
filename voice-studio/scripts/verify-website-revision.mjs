import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

// Deliberately requires --run: preparing this script must not launch the browser.
// node scripts/verify-website-revision.mjs --run [--base http://127.0.0.1:4184]
// Artifacts contain local website screenshots and source hashes, never Studio session data.
const workspace = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
if (!args.includes('--run')) {
  console.log('Prepared, not executed. Run after source application/HMR: node scripts/verify-website-revision.mjs --run [--base URL] [--website PATH] [--out WORKSPACE_PATH] [--scope mobile-journey]');
  process.exit(0);
}
function option(name, fallback) {
  const i = args.indexOf(name);
  if (i < 0) return fallback;
  assert(args[i + 1] && !args[i + 1].startsWith('--'), `${name} needs a value`);
  return args[i + 1];
}
const website = path.resolve(option('--website', path.join(workspace, '../agent-studio-for-software-website/04-angular-static-final')));
const scope = option('--scope', 'all');
assert(['all', 'mobile-journey'].includes(scope), 'Scope must be all or mobile-journey');
const expectedRoutes = scope === 'all' ? 54 : 0, expectedJourneys = scope === 'all' ? 2 : 1, expectedEmbedded = scope === 'all' ? 1 : 0;
const config = JSON.parse(await fs.readFile(path.join(website, 'voice.config.json'), 'utf8'));
const base = new URL(option('--base', config.liveUrl));
assert(['127.0.0.1', 'localhost', '[::1]'].includes(base.hostname), 'Website QA is restricted to the configured local site');
assert(['http:', 'https:'].includes(base.protocol), 'HTTP(S) required');
assert(!base.username && !base.password, 'Credentials are not accepted in the website URL');
base.pathname = '/'; base.search = ''; base.hash = '';
const routes = Object.keys(config.routes ?? {});
assert.equal(routes.length, 27, 'Expected all 27 registered Agent Studio routes');
assert(routes.every(route => route.startsWith('/') && new URL(route, base).origin === base.origin), 'Invalid route mapping');
const stamp = new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-');
const output = path.resolve(workspace, option('--out', `test-results/website-revision-${stamp}`));
const outputRelative = path.relative(workspace, output);
assert(outputRelative && !outputRelative.startsWith('..') && !path.isAbsolute(outputRelative), 'Artifacts must stay inside the Voice Studio workspace');
await fs.mkdir(output, { recursive: true });
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

async function sourceSnapshot() {
  const files = [];
  async function walk(relative, depth = 0) {
    assert(depth <= 20 && files.length <= 2000, 'Source inventory exceeds bounded QA scope');
    const absolute = path.join(website, relative), stat = await fs.lstat(absolute);
    assert(!stat.isSymbolicLink(), `Source inventory rejects links: ${relative}`);
    if (stat.isDirectory()) {
      for (const name of (await fs.readdir(absolute)).sort()) await walk(path.join(relative, name), depth + 1);
    } else if (stat.isFile()) files.push(relative.replaceAll('\\', '/'));
  }
  for (const directory of ['src', 'scripts', 'public']) await walk(directory);
  for (const name of ['voice.config.json', 'package.json', 'package-lock.json', 'angular.json', 'tsconfig.json', 'tsconfig.app.json', 'tsconfig.spec.json', 'eslint.config.js', 'stylelint.config.cjs', '.prettierrc', '.editorconfig']) {
    try { await walk(name); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  let bytes = 0;
  const records = [];
  for (const relative of [...new Set(files)].sort()) {
    const data = await fs.readFile(path.join(website, relative));
    bytes += data.length;
    assert(data.length <= 8 * 1024 * 1024 && bytes <= 64 * 1024 * 1024, 'Source inventory exceeds 8 MiB/file or 64 MiB total');
    records.push({ path: relative, sha256: sha(data), bytes: data.length });
  }
  assert(records.length <= 2000, 'Source inventory exceeds 2000 files');
  return { hash: sha(JSON.stringify(records)), count: records.length, bytes, files: records };
}

const report = {
  scope, startedAt: new Date().toISOString(), origin: base.origin, websiteRoot: website,
  mode: 'Actual local website in headless Google Chrome; no Studio API, source writes or model calls',
  routes: config.routes, viewports: [{ name: 'desktop', width: 1440, height: 1000 }, { name: 'mobile', width: 390, height: 844 }],
  sourceBefore: await sourceSnapshot(), pages: [], journeys: [], embeddedChecks: [], linkFailures: [], runtimeFailures: [], warnings: [], screenshots: [],
};
const inventories = new Map();
const representative = new Map([['/', 'home'], ['/getting-started', 'setup'], ['/screenshots', 'task-tour'], ['/product', 'product']]);
let browser;
let current;
function problem(kind, details) {
  const entry = { kind, ...details };
  if (current) current.failures.push(entry);
  else report.runtimeFailures.push(entry);
}
function attachErrors(page) {
  page.on('pageerror', error => problem('pageerror', { message: error.message }));
  page.on('console', message => { if (message.type() === 'error') problem('console-error', { message: message.text() }); });
  page.on('response', response => { if (response.status() >= 400) problem('http-error', { url: response.url(), status: response.status() }); });
  page.on('requestfailed', request => {
    const message = request.failure()?.errorText ?? 'request failed';
    if (message === 'net::ERR_ABORTED') report.warnings.push({ kind: 'navigation-abort', url: request.url(), route: current?.route });
    else problem('request-failed', { url: request.url(), message });
  });
}
async function settle(page) {
  await page.locator('main h1').first().waitFor({ state: 'visible', timeout: 20000 });
  await page.evaluate(async () => {
    await Promise.race([document.fonts.ready, new Promise(resolve => setTimeout(resolve, 5000))]);
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
}
async function visit(page, route) {
  const response = await page.goto(new URL(route, base).href, { waitUntil: 'domcontentloaded', timeout: 45000 });
  assert(response?.ok(), `Document request failed: ${route} (${response?.status()})`);
  await settle(page);
  assert.equal(new URL(page.url()).pathname.replace(/\/$/, '') || '/', route.replace(/\/$/, '') || '/', `Route redirected: ${route}`);
}
async function revealLazyContent(page) {
  // Normal scrolling activates native lazy images and Angular @defer blocks.
  let position = 0;
  for (let step = 0; step < 160; step++) {
    const dimensions = await page.evaluate(() => ({ height: document.documentElement.scrollHeight, viewport: innerHeight }));
    if (position >= dimensions.height) return;
    await page.evaluate(y => scrollTo({ top: y, behavior: 'instant' }), position);
    await new Promise(resolve => setTimeout(resolve, 75));
    position += Math.max(300, Math.floor(dimensions.viewport * 0.8));
  }
  throw new Error('Page exceeds bounded 160-step lazy-content scroll');
}
async function inspect(page) {
  await revealLazyContent(page);
  await page.waitForFunction(() => [...document.images].every(img => img.complete), undefined, { timeout: 12000 }).catch(() => {});
  await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
  await settle(page);
  return page.evaluate(() => {
    const visible = el => {
      const style = getComputedStyle(el), box = el.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && box.width > 0 && box.height > 0;
    };
    const rect = el => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
    };
    const describe = el => `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}${typeof el.className === 'string' && el.className ? '.' + el.className.trim().split(/\s+/).slice(0, 3).join('.') : ''}`;
    const headings = [...document.querySelectorAll('main h1')].filter(visible).map(el => ({ text: el.textContent.trim(), box: rect(el), clientWidth: el.clientWidth, scrollWidth: el.scrollWidth }));
    const pageWidth = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth);
    const overflowElements = pageWidth <= innerWidth + 1 ? [] : [...document.querySelectorAll('main *')].filter(el => visible(el) && el.getBoundingClientRect().right > innerWidth + 1).slice(0, 15).map(el => ({ element: describe(el), box: rect(el) }));
    const images = [...document.images].map(img => ({ src: img.currentSrc || img.src, alt: img.alt, complete: img.complete, width: img.naturalWidth, height: img.naturalHeight }));
    const hero = document.querySelector('.hero'), image = hero?.querySelector('.hero-shot');
    const overlaps = [];
    if (image && visible(image)) {
      const r = image.getBoundingClientRect();
      for (const el of hero.querySelectorAll('h1, .lead, .summary, .hero-operational, .page-actions')) {
        if (!visible(el)) continue;
        const b = el.getBoundingClientRect();
        const width = Math.min(r.right, b.right) - Math.max(r.left, b.left), height = Math.min(r.bottom, b.bottom) - Math.max(r.top, b.top);
        if (width > 1 && height > 1) overlaps.push({ element: describe(el), width, height, box: rect(el) });
      }
    }
    return {
      headings, viewportWidth: innerWidth, documentWidth: pageWidth, overflowElements,
      brokenImages: images.filter(img => !img.complete || img.width === 0), imageCount: images.length,
      ids: [...document.querySelectorAll('[id]')].map(el => el.id).concat([...document.querySelectorAll('a[name]')].map(el => el.getAttribute('name'))),
      links: [...document.querySelectorAll('a[href]')].map(el => ({ href: el.href, text: el.textContent.trim().slice(0, 140), download: el.hasAttribute('download') })),
      hero: { image: rect(image), headline: rect(hero?.querySelector('h1')), overlaps },
    };
  });
}
function validateInspection(data) {
  if (data.headings.length !== 1 || !data.headings[0]?.text) problem('h1', { message: `Expected one visible nonempty main H1; found ${data.headings.length}` });
  const heading = data.headings[0];
  if (heading && (heading.box.left < -1 || heading.box.right > data.viewportWidth + 1 || heading.box.top < -1 || heading.scrollWidth > heading.clientWidth + 1)) problem('headline-clipped', { heading });
  if (data.documentWidth > data.viewportWidth + 1) problem('document-overflow', { viewport: data.viewportWidth, document: data.documentWidth, elements: data.overflowElements });
  for (const image of data.brokenImages) problem('missing-image', image);
  for (const overlap of data.hero.overlaps) problem('hero-overlap', overlap);
}
async function screenshot(page, name, metadata = {}) {
  const file = `${name}.png`;
  await page.screenshot({ path: path.join(output, file), fullPage: false, animations: 'disabled' });
  report.screenshots.push({ file, ...metadata });
}
function normalizedRoute(url) { return url.pathname.replace(/\/$/, '') || '/'; }
async function validateLinks(context) {
  const checkedAssets = new Map();
  for (const result of report.pages) {
    for (const link of result.links ?? []) {
      const target = new URL(link.href);
      if (target.origin !== base.origin) continue;
      const targetRoute = normalizedRoute(target), targetInventory = inventories.get(`${result.viewport}:${targetRoute}`);
      if (!targetInventory) {
        if (Object.hasOwn(config.routes, targetRoute)) {
          report.linkFailures.push({ viewport: result.viewport, targetRoute, kind: 'route-target-not-inspected' });
          continue;
        }
        if (link.download || /\.[a-z0-9]{1,8}$/i.test(target.pathname)) {
          const resource = new URL(target); resource.hash = '';
          if (!checkedAssets.has(resource.href)) {
            try { const response = await context.request.get(resource.href); checkedAssets.set(resource.href, { ok: response.ok(), status: response.status() }); }
            catch (error) { checkedAssets.set(resource.href, { ok: false, message: error.message }); }
          }
          if (!checkedAssets.get(resource.href).ok) report.linkFailures.push({ viewport: result.viewport, from: result.route, ...link, kind: 'missing-linked-asset', ...checkedAssets.get(resource.href) });
        } else report.linkFailures.push({ viewport: result.viewport, from: result.route, ...link, kind: 'unmapped-internal-route' });
        continue;
      }
      if (target.hash && target.hash !== '#') {
        let fragment;
        try { fragment = decodeURIComponent(target.hash.slice(1)); }
        catch { fragment = target.hash.slice(1); }
        if (!targetInventory.ids.includes(fragment)) report.linkFailures.push({ viewport: result.viewport, from: result.route, targetRoute, fragment, text: link.text, kind: 'missing-fragment' });
      }
    }
  }
}
async function clickRoute(page, target, { selector = 'main a[href]', navigation = true } = {}) {
  const find = async scope => {
    const anchors = page.locator(scope);
    for (let index = 0; index < await anchors.count(); index++) {
      const anchor = anchors.nth(index);
      if (await anchor.evaluate((el, wanted) => new URL(el.href).pathname === wanted, target) && await anchor.isVisible()) return anchor;
    }
    return null;
  };
  let anchor = await find(selector);
  if (!anchor && navigation) {
    const menu = page.getByRole('button', { name: 'Open navigation', exact: true });
    if (await menu.isVisible()) await menu.click();
    const candidates = page.locator('#site-navigation a[href]');
    for (let index = 0; index < await candidates.count(); index++) {
      const candidate = candidates.nth(index);
      if (!await candidate.evaluate((el, wanted) => new URL(el.href).pathname === wanted, target)) continue;
      const group = candidate.locator('xpath=ancestor::details[1]');
      if (await group.count() && !await group.evaluate(el => el.open)) await group.locator('summary').click();
      if (await candidate.isVisible()) { anchor = candidate; break; }
    }
  }
  assert(anchor, `No user-visible link to ${target}`);
  await anchor.click();
  await page.waitForURL(url => normalizedRoute(url) === target, { timeout: 15000 });
  await settle(page);
  assert(!await page.locator('main').evaluate(el => el.inert), 'Navigation left the destination inert');
  current.steps.push({ target, title: (await page.locator('main h1').innerText()).trim() });
}
async function journey(page, viewport) {
  current = { viewport: viewport.name, route: 'user-journey', steps: [], failures: [] };
  report.journeys.push(current);
  try {
    await visit(page, '/');
    await clickRoute(page, '/getting-started', { selector: 'main .hero a[href]', navigation: false });
    await clickRoute(page, '/screenshots');
    await revealLazyContent(page);
    const thumb = page.locator('.visual-gallery .visual-thumb').first();
    await thumb.scrollIntoViewIfNeeded(); await thumb.click();
    const dialog = page.locator('.lightbox[role="dialog"]');
    await dialog.waitFor({ state: 'visible' });
    const originalTitle = await dialog.getAttribute('aria-label');
    await dialog.locator('.lightbox-nav.next').click();
    assert.notEqual(await dialog.getAttribute('aria-label'), originalTitle, 'Next image did not change the tour image');
    await page.waitForFunction(() => [...document.querySelectorAll('.lightbox img')].every(img => img.complete && img.naturalWidth > 0));
    await screenshot(page, `${viewport.name}-task-tour-image`, { viewport: viewport.name, route: '/screenshots', position: 'Opened second tour image using native controls' });
    await dialog.locator('.lightbox-close').click();
    await dialog.waitFor({ state: 'detached' });
    const tabs = page.getByRole('tab');
    assert(await tabs.count() >= 4, 'Expected four task review perspectives');
    await tabs.last().click();
    assert.equal(await tabs.last().getAttribute('aria-selected'), 'true', 'Task perspective selection did not update');
    await page.locator('.proof .stage').scrollIntoViewIfNeeded();
    await screenshot(page, `${viewport.name}-task-tour-perspective`, { viewport: viewport.name, route: '/screenshots', position: 'Last task review perspective' });
    current.steps.push({ target: '/screenshots', interaction: 'Opened tour image, advanced it, closed dialog and changed review perspective' });
    await clickRoute(page, '/imprint', { selector: 'footer a[href]', navigation: false });
    assert.match(await page.locator('main').innerText(), /Robert Mischke/, 'Imprint lost the existing maintainer identity');
    validateInspection(await inspect(page));
  } catch (error) { problem('journey-failed', { message: error.message }); }
  console.log(`${viewport.name} user journey: ${current.failures.length ? 'FAIL' : 'PASS'}`);
}

try {
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  for (const viewport of report.viewports.filter(item => scope === 'all' || item.name === 'mobile')) {
    const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height }, reducedMotion: 'reduce', colorScheme: 'light' });
    const page = await context.newPage();
    page.setDefaultTimeout(15000); attachErrors(page);
    for (const route of scope === 'all' ? routes : []) {
      current = { viewport: viewport.name, route, sourcePath: config.routes[route], failures: [] };
      report.pages.push(current);
      try {
        await visit(page, route);
        const data = await inspect(page);
        Object.assign(current, data);
        inventories.set(`${viewport.name}:${route}`, data);
        validateInspection(data);
        if (representative.has(route)) await screenshot(page, `${viewport.name}-${representative.get(route)}`, { viewport: viewport.name, route, position: 'Page start' });
      } catch (error) { problem('route-check-failed', { message: error.message }); }
      console.log(`${viewport.name} ${route}: ${current.failures.length ? 'FAIL' : 'PASS'}`);
    }
    await journey(page, viewport);
    current = null;
    await validateLinks(context);
    await context.close();
  }
  if (scope === 'all') {
  const host = await browser.newContext({ viewport: { width: 1600, height: 1050 }, reducedMotion: 'reduce', colorScheme: 'light' });
  const shell = await host.newPage(); shell.setDefaultTimeout(15000); attachErrors(shell);
  current = { viewport: 'iframe-1200-in-1600', route: '/', failures: [] };
  report.embeddedChecks.push(current);
  try {
    await shell.setContent('<!doctype html><html><body style="margin:0;background:#eee"><iframe title="Actual Agent Studio website" style="display:block;width:1200px;height:1000px;border:0" src="' + new URL('/', base).href + '"></iframe></body></html>');
    const frameElement = await shell.locator('iframe').elementHandle();
    const frame = await frameElement.contentFrame();
    assert(frame, 'Actual website iframe missing');
    await settle(frame);
    const data = await inspect(frame);
    Object.assign(current, data); validateInspection(data);
    assert.equal(data.viewportWidth, 1200, 'Embedded website must receive a 1200px viewport');
    await screenshot(shell, 'embedded-1200-home', { viewport: current.viewport, route: '/', position: 'Actual website iframe at 1200px inside 1600px parent' });
  } catch (error) { problem('embedded-check-failed', { message: error.message }); }
  console.log('iframe-1200 homepage: ' + (current.failures.length ? 'FAIL' : 'PASS'));
  current = null; await host.close();
  }
} catch (error) { report.runtimeFailures.push({ kind: 'runtime', message: error.message }); }
finally {
  current = null;
  await browser?.close();
  try {
    report.sourceAfter = await sourceSnapshot();
    if (report.sourceAfter.hash !== report.sourceBefore.hash) report.runtimeFailures.push({ kind: 'source-drift', message: 'Source/config/assets changed during browser QA; results are not a stable revision check' });
  } catch (error) { report.runtimeFailures.push({ kind: 'source-recheck', message: error.message }); }
  report.linkFailures = [...new Map(report.linkFailures.map(item => [JSON.stringify(item), item])).values()];
  const failures = report.pages.reduce((n, page) => n + page.failures.length, 0) + report.journeys.reduce((n, journey) => n + journey.failures.length, 0) + report.linkFailures.length + report.runtimeFailures.length + report.embeddedChecks.reduce((n, item) => n + item.failures.length, 0);
  report.completedAt = new Date().toISOString();
  report.summary = { scope, expectedRouteViewports: expectedRoutes, checkedRouteViewports: report.pages.length, expectedJourneys, checkedJourneys: report.journeys.length, embeddedChecks: report.embeddedChecks.length, failures, screenshots: report.screenshots.length, sourceUnchanged: report.sourceBefore.hash === report.sourceAfter?.hash, passed: failures === 0 && report.pages.length === expectedRoutes && report.journeys.length === expectedJourneys && report.embeddedChecks.length === expectedEmbedded };
  await fs.writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  const lines = ['# Agent Studio website browser verification', '', `- Result: ${report.summary.passed ? 'PASS' : 'FAIL'}`, `- Actual local site: ${base.origin}`, `- Route/viewports: ${report.pages.length}/${expectedRoutes} (scope: ${scope})`, `- Click journeys: ${report.journeys.length}/${expectedJourneys}`, `- Source unchanged during QA: ${report.summary.sourceUnchanged}`, `- Failures: ${failures}`, '', 'The check uses actual Chrome navigation and user controls. It does not call Voice Studio APIs, apply source edits, start models or test external website links.', '', '| Viewport | Route | H1 | Result |', '| --- | --- | --- | --- |'];
  for (const page of report.pages) lines.push(`| ${page.viewport} | ${page.route} | ${(page.headings?.[0]?.text ?? '').replaceAll('|', '\\|').replaceAll('\n', ' ')} | ${page.failures.length ? 'FAIL' : 'PASS'} |`);
  lines.push('', '## Failures', '', 'Full details, source hashes, link targets and screenshot names are in report.json.', '');
  for (const page of [...report.pages, ...report.journeys, ...report.embeddedChecks]) for (const failure of page.failures) lines.push(`- ${page.viewport} ${page.route}: ${failure.kind} — ${failure.message ?? JSON.stringify(failure)}`);
  for (const failure of [...report.linkFailures, ...report.runtimeFailures]) lines.push(`- ${failure.kind}: ${failure.message ?? JSON.stringify(failure)}`);
  lines.push('', '## Screenshots', '');
  for (const shot of report.screenshots) lines.push(`- [${shot.file}](${shot.file}) — ${shot.position}`);
  await fs.writeFile(path.join(output, 'report.md'), lines.join('\n') + '\n');
  console.log(JSON.stringify({ ...report.summary, output }, null, 2));
  process.exitCode = report.summary.passed ? 0 : 1;
}
