// Browser QA for an Agent Studio view (the running app, default Stable on 4011).
// Usage:
//   node browser-qa/studio.mjs <#route | page.html> [outDir] [options]
//   node browser-qa/studio.mjs /workspace/settings/execution-hosts --scope app-remote-hosts-panel \
//     --wait-for app-remote-hosts-panel --scroll-to .rh__summary --viewport 1606x1100
// Options: --base URL (default http://localhost:4011), --viewport WxH[:dark] (repeatable,
// default 1440x900 and 1920x1080), --scope SELECTOR (layout checks only below it),
// --wait-for SELECTOR, --click SELECTOR (repeatable), --scroll-to SELECTOR, --settle MS.
// Checks per view: visible text or controls overlapping each other, content spilling
// out of its box, nested scroll containers (a second scrollbar, with the element
// that escapes its clipping parent and causes it), failed /api/ requests and page
// errors. Writes screenshots and report.json to artifacts/studio-qa/<route>/.
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { launchBrowser, artifactDir, createReport } from './lib.mjs';

function parseArgs(argv) {
  const o = { base: 'http://localhost:4011', views: [], clicks: [], scope: 'body', settle: 4000, positional: [] };
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i];
    if (!key.startsWith('--')) { o.positional.push(key); continue; }
    const value = argv[++i];
    if (value === undefined) throw new Error(`missing value for ${key}`);
    if (key === '--base') o.base = value.replace(/\/$/, '');
    else if (key === '--viewport') o.views.push(value);
    else if (key === '--scope') o.scope = value;
    else if (key === '--wait-for') o.waitFor = value;
    else if (key === '--click') o.clicks.push(value);
    else if (key === '--scroll-to') o.scrollTo = value;
    else if (key === '--settle') o.settle = Number(value);
    else throw new Error(`unknown option ${key}`);
  }
  if (!o.views.length) o.views.push('1440x900', '1920x1080');
  return o;
}

// Git Bash turns "/workspace/..." into "C:/Program Files/Git/workspace/..." unless
// MSYS_NO_PATHCONV=1 is set; undo that so routes work from any shell.
const undoMsysPath = value => value.replace(/^#/, '').replace(/^[A-Za-z]:[\\/].*?[\\/]Git(?=[\\/])/, '').replaceAll('\\', '/');

const o = parseArgs(process.argv.slice(2));
const target = o.positional[0];
if (!target) { console.error('usage: node browser-qa/studio.mjs <#route | page.html> [outDir] [options]'); process.exit(2); }
const isFile = /\.html?$/i.test(target);
const route = isFile ? null : `/${undoMsysPath(target).replace(/^\//, '')}`;
const name = isFile ? 'file' : route.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'root';
const outDir = await artifactDir('studio-qa', name, o.positional[1]);
const report = createReport(isFile ? resolve(target) : `${o.base}/#${route}`);

// Runs in the page. Self-contained: Playwright serialises the function.
function auditLayout(scopeSelector) {
  const scope = document.querySelector(scopeSelector);
  if (!scope) return { scopeMissing: true };
  const vw = innerWidth, vh = innerHeight;
  const describe = el => {
    let path = el.tagName.toLowerCase();
    const cls = [...el.classList].filter(c => !c.startsWith('ng-')).slice(0, 2).join('.');
    if (cls) path += `.${cls}`;
    const testId = el.getAttribute('data-testid');
    if (testId) path += `[data-testid=${testId}]`;
    // nearest component host, so a finding points at the component to fix
    for (let node = el.parentElement; node; node = node.parentElement)
      if (node.tagName.includes('-')) return `${node.tagName.toLowerCase()} ${path}`;
    return path;
  };
  const text = el => (el.innerText ?? el.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 48);
  const visible = el => {
    const s = getComputedStyle(el);
    if (s.visibility === 'hidden' || s.display === 'none' || Number(s.opacity) === 0) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  const clips = s => /(hidden|auto|scroll|clip)/.test(s.overflowX + s.overflowY);
  const scrolls = el => /(auto|scroll)/.test(getComputedStyle(el).overflowY) && el.scrollHeight > el.clientHeight + 2;
  const all = [...scope.querySelectorAll('*')].filter(visible);

  // Content wider than its own unclipped box.
  const spills = all.filter(el => !clips(getComputedStyle(el)) && !el.closest('svg') && el.clientWidth > 0
    && el.scrollWidth - el.clientWidth > 4 && text(el))
    .map(el => ({ el: describe(el), text: text(el), px: el.scrollWidth - el.clientWidth }));

  // Text and controls a viewer can see that overlap without being nested.
  const CONTROLS = 'button, input, select, textarea, img, canvas, svg';
  const items = all.filter(el => el.matches(CONTROLS + ', a, code')
    || [...el.childNodes].some(n => n.nodeType === Node.TEXT_NODE && n.textContent.trim()))
    .filter(el => !el.parentElement.closest('svg'))
    .map(el => {
      // measure the text itself, not the possibly wider block box
      const range = document.createRange();
      range.selectNodeContents(el);
      return { el, r: el.matches(CONTROLS) ? el.getBoundingClientRect() : range.getBoundingClientRect() };
    })
    .filter(({ el, r }) => r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < vh && r.right > 0 && r.left < vw
      && (text(el) || el.matches(CONTROLS))
      // not scrolled away or clipped: the element is hit-testable at its centre
      && document.elementsFromPoint(Math.min(vw - 1, Math.max(0, (r.left + r.right) / 2)),
        Math.min(vh - 1, Math.max(0, (r.top + r.bottom) / 2))).includes(el));
  const overlaps = [];
  for (let i = 0; i < items.length; i++)
    for (let j = i + 1; j < items.length; j++) {
      const a = items[i], b = items[j];
      if (a.el.contains(b.el) || b.el.contains(a.el)) continue;
      const w = Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left);
      const h = Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top);
      if (w > 3 && h > 3) overlaps.push({ a: describe(a.el), aText: text(a.el), b: describe(b.el), bText: text(b.el), px2: Math.round(w * h) });
    }
  overlaps.sort((x, y) => y.px2 - x.px2);

  // Scroll containers on the path to the scope. A container that scrolls while
  // holding a near-full-height scroller is a second scrollbar; when its children
  // fit, a descendant escapes its clipping parent (CSS: an overflow clip on A clips
  // an absolute element only when A is or contains its containing block).
  const scrollers = [];
  for (let el = scope; el; el = el.parentElement) {
    if (!visible(el) || !scrolls(el)) continue;
    const r = el.getBoundingClientRect();
    const childrenBottom = Math.max(0, ...[...el.children].map(c => c.getBoundingClientRect().bottom - r.top + el.scrollTop));
    let escapee = null;
    if (el.scrollHeight - childrenBottom > 2)
      for (const inner of el.querySelectorAll('*')) {
        const position = getComputedStyle(inner).position;
        if (position === 'fixed') continue;
        let block = null, clipped = false;
        for (let node = inner.parentElement; node && node !== el && !clipped; node = node.parentElement) {
          const s = getComputedStyle(node);
          if (position === 'absolute' && !block && s.position !== 'static') block = node;
          if (clips(s) && (position !== 'absolute' || block)) clipped = true;
        }
        const bottom = inner.getBoundingClientRect().bottom - r.top + el.scrollTop;
        if (!clipped && bottom > childrenBottom + 2 && (!escapee || bottom > escapee.bottom))
          escapee = { el: describe(inner), position, bottom: Math.round(bottom) };
      }
    const nested = [...el.querySelectorAll('*')].some(inner => visible(inner) && scrolls(inner)
      && inner.getBoundingClientRect().height >= r.height * 0.8);
    scrollers.push({ el: describe(el), clientHeight: el.clientHeight, scrollHeight: el.scrollHeight,
      scrollTop: Math.round(el.scrollTop), unusedBelow: Math.round(vh - r.bottom), nested, escapee });
  }
  return { spills, overlaps, scrollers, scopeBox: scope.getBoundingClientRect().toJSON() };
}

const browser = await launchBrowser();
try {
  for (const view of o.views) {
    const [size, theme = 'light'] = view.split(':');
    const [width, height] = size.split('x').map(Number);
    const tag = `${size}/${theme}`;
    const context = await browser.newContext({ viewport: { width, height }, colorScheme: theme });
    const page = await context.newPage();
    const failures = new Map();
    page.on('pageerror', error => failures.set(`page error: ${error.message.slice(0, 160)}`, 1));
    page.on('response', response => {
      if (!response.url().includes('/api/') || response.status() < 400) return;
      const key = `HTTP ${response.status()} ${response.url().replace(o.base, '')}`;
      failures.set(key, (failures.get(key) ?? 0) + 1);
    });

    if (isFile) await page.goto(pathToFileURL(resolve(target)).href);
    else {
      // Studio uses hash routes; live sockets keep the network busy, so wait for
      // load plus --settle. Boot may restore the last tab over a deep link.
      await page.goto(`${o.base}/#${route}`, { waitUntil: 'load', timeout: 120_000 });
      await page.waitForTimeout(o.settle);
      if (await page.evaluate(() => location.hash) !== `#${route}`) {
        await page.evaluate(r => { location.hash = r; }, route);
        await page.waitForTimeout(1000);
      }
    }
    if (o.waitFor) await page.waitForSelector(o.waitFor, { timeout: 60_000 });
    for (const selector of o.clicks) await page.click(selector);
    if (o.scrollTo) await page.locator(o.scrollTo).first().evaluate(el => el.scrollIntoView({ block: 'start' }));
    await page.waitForTimeout(300);

    const layout = await page.evaluate(auditLayout, o.scope);
    report.data.views.push({ view: tag, ...layout, failures: Object.fromEntries(failures) });
    if (layout.scopeMissing) report.fail(`${tag}: scope ${o.scope} not found`);
    else {
      for (const x of layout.overlaps.slice(0, 20)) report.fail(`${tag}: overlap "${x.aText}" (${x.a}) x "${x.bText}" (${x.b}) ${x.px2}px2`);
      for (const x of layout.spills.slice(0, 20)) report.fail(`${tag}: spills-out-of-box +${x.px}px "${x.text}" (${x.el})`);
      for (const s of layout.scrollers.filter(s => s.nested))
        report.fail(`${tag}: double-scroll ${s.el} scrolls ${s.scrollHeight - s.clientHeight}px`
          + (s.escapee ? ` because ${s.escapee.position} element ${s.escapee.el} escapes its clipping parent` : ' around a nested scroller')
          + (s.scrollTop ? `; currently scrolled ${s.scrollTop}px, moving the view up and leaving empty space below` : ''));
    }
    for (const [message, count] of failures) report.fail(`${tag}: ${message}${count > 1 ? ` (x${count})` : ''}`);
    await page.screenshot({ path: `${outDir}/${size}-${theme}.png` });
    await context.close();
  }
} finally { await browser.close(); }
await report.finish(outDir);
