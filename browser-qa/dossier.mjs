// Browser QA for a Dossier page (docs/**/index.html with hand-drawn SVG figures).
// Usage: node browser-qa/dossier.mjs <path/to/index.html> [outDir]
// Checks light/dark at desktop and phone width: horizontal overflow (with the
// elements causing it), an explicit body background, and per SVG figure: text
// that leaves the viewBox, overlaps other text, spills out of the box or badge it
// sits in, or has a line or path running through it.
// Writes full-page and per-figure screenshots plus report.json to
// artifacts/dossier-qa/<dossier folder>/.
import { resolve, basename, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { VIEWS, launchBrowser, artifactDir, createReport, pageOverflow } from './lib.mjs';

const input = process.argv[2];
if (!input) { console.error('usage: node browser-qa/dossier.mjs <index.html> [outDir]'); process.exit(2); }
const pagePath = resolve(input);
const outDir = await artifactDir('dossier-qa', basename(dirname(pagePath)), process.argv[3]);
const report = createReport(pagePath);

// Runs in the page. Returns geometry findings per figure.
function auditFigures() {
  const area = (a, b) => Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left))
    * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
  const label = el => (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 48);
  return [...document.querySelectorAll('figure svg')].map((svg, index) => {
    const box = svg.getBoundingClientRect();
    const texts = [...svg.querySelectorAll('text')].filter(t => !t.closest('defs') && (t.textContent || '').trim());
    const rects = [...svg.querySelectorAll('rect')].filter(r => !r.closest('defs'));
    const issues = [];
    const tb = texts.map(t => t.getBoundingClientRect());
    texts.forEach((t, i) => {
      const r = tb[i];
      if (r.left < box.left - 1 || r.right > box.right + 1 || r.top < box.top - 1 || r.bottom > box.bottom + 1)
        issues.push({ kind: 'outside-viewbox', text: label(t) });
      // the smallest rect that contains the text's anchor point is its container;
      // the centre is wrong for long start-anchored text that leaves its badge
      const anchor = getComputedStyle(t).textAnchor;
      const cx = anchor === 'middle' ? (r.left + r.right) / 2 : anchor === 'end' ? r.right - 2 : r.left + 2;
      const cy = (r.top + r.bottom) / 2;
      const host = rects.map(x => ({ x, b: x.getBoundingClientRect() }))
        .filter(({ b }) => cx >= b.left && cx <= b.right && cy >= b.top && cy <= b.bottom && b.width < box.width * 0.95)
        .sort((a, b) => a.b.width * a.b.height - b.b.width * b.b.height)[0];
      if (host && (r.left < host.b.left - 1 || r.right > host.b.right + 1))
        issues.push({ kind: 'spills-out-of-box', text: label(t), boxClass: host.x.getAttribute('class') });
    });
    // lines and paths must not run through text: sample each stroke in screen space
    const strokes = [...svg.querySelectorAll('path, line')].filter(s => !s.closest('defs, marker'));
    for (const s of strokes) {
      const ctm = s.getScreenCTM();
      if (!ctm || typeof s.getTotalLength !== 'function') continue;
      const length = s.getTotalLength();
      const hit = new Set();
      // filled rects painted after the stroke hide it (e.g. grid lines behind a box)
      const covers = rects.filter(r => s.compareDocumentPosition(r) & Node.DOCUMENT_POSITION_FOLLOWING
        && getComputedStyle(r).fill !== 'none').map(r => r.getBoundingClientRect());
      for (let d = 0; d <= length; d += 2) {
        const p = s.getPointAtLength(d), x = ctm.a * p.x + ctm.c * p.y + ctm.e, y = ctm.b * p.x + ctm.d * p.y + ctm.f;
        if (covers.some(c => x > c.left && x < c.right && y > c.top && y < c.bottom)) continue;
        tb.forEach((r, i) => { if (x > r.left + 1 && x < r.right - 1 && y > r.top + 2 && y < r.bottom - 2) hit.add(i); });
      }
      for (const i of hit) issues.push({ kind: 'stroke-through-text', text: label(texts[i]), stroke: `${s.tagName}.${s.getAttribute('class') ?? ''}` });
    }
    for (let i = 0; i < texts.length; i++)
      for (let j = i + 1; j < texts.length; j++) {
        if (texts[i].contains(texts[j]) || texts[j].contains(texts[i])) continue;
        const overlap = area(tb[i], tb[j]);
        if (overlap > 4) issues.push({ kind: 'text-overlap', text: label(texts[i]), other: label(texts[j]), px2: Math.round(overlap) });
      }
    return { figure: index + 1, title: svg.querySelector('title')?.textContent ?? '', texts: texts.length, issues };
  });
}

const browser = await launchBrowser();
try {
  const page = await browser.newPage();
  for (const [width, theme] of VIEWS) {
    await page.setViewportSize({ width, height: 1000 });
    await page.emulateMedia({ colorScheme: theme });
    await page.goto(pathToFileURL(pagePath).href);
    const { overflow, culprits } = await pageOverflow(page);
    const background = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    const figures = await page.evaluate(auditFigures);
    report.data.views.push({ width, theme, overflow, background, figures });
    if (overflow > 1) report.fail(`${width}/${theme}: horizontal overflow ${overflow}px from ${culprits.join(', ')}`);
    if (/rgba\(0, 0, 0, 0\)|transparent/.test(background)) report.fail(`${width}/${theme}: body has no background`);
    // SVG geometry scales with width; report it once, at desktop light.
    if (width === 1280 && theme === 'light')
      for (const f of figures) for (const issue of f.issues)
        report.fail(`fig ${f.figure} ${issue.kind}: "${issue.text}"${issue.other ? ` x "${issue.other}"` : ''}`
          + `${issue.boxClass ? ` in .${issue.boxClass}` : ''}${issue.stroke ? ` by ${issue.stroke}` : ''}`);
    await page.screenshot({ path: `${outDir}/page-${width}-${theme}.png`, fullPage: true });
    if (width === 1280) {
      const figs = page.locator('figure');
      for (let i = 0; i < await figs.count(); i++)
        await figs.nth(i).screenshot({ path: `${outDir}/fig${i + 1}-${theme}.png` });
    }
  }
} finally { await browser.close(); }
await report.finish(outDir);
