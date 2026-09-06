import { chromium } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const output = new URL("./.qa/", import.meta.url);
const baseUrl = process.env.VOICE_STUDIO_URL || "http://127.0.0.1:5188";
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: "chrome" });
const page = await browser.newPage({
  viewport: { width: 1440, height: 1080 },
  deviceScaleFactor: 1,
});
const errors = [];
const layouts = [];
page.on("pageerror", (error) => errors.push(error.message));

async function capture(name, width, height = 1080, scrollTo) {
  await page.setViewportSize({ width, height });
  if (scrollTo)
    await page
      .locator(scrollTo)
      .evaluate((element) => element.scrollIntoView({ block: "start" }));
  else await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: fileURLToPath(new URL(name + ".jpg", output)),
    type: "jpeg",
    quality: 65,
    fullPage: false,
  });
  const audit = await page.evaluate(() => {
    const parse = (value) => {
      const values = value.match(/[\d.]+/g)?.map(Number) ?? [0, 0, 0];
      return [values[0], values[1], values[2], values[3] ?? 1];
    };
    const blend = (front, back) =>
      front
        .slice(0, 3)
        .map((channel, i) => channel * front[3] + back[i] * (1 - front[3]));
    const luminance = (rgb) =>
      rgb
        .map((channel) => channel / 255)
        .map((value) =>
          value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4,
        )
        .reduce(
          (sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index],
          0,
        );
    const background = (element) => {
      const stack = [];
      for (let cursor = element; cursor; cursor = cursor.parentElement)
        stack.push(parse(getComputedStyle(cursor).backgroundColor));
      return stack
        .reverse()
        .reduce((back, front) => blend(front, back), [255, 255, 255]);
    };
    const tree = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const violations = [];
    const samples = [];
    const known = new Set();
    for (let node = tree.nextNode(); node; node = tree.nextNode()) {
      const text = node.textContent?.trim() ?? "";
      const element = node.parentElement;
      if (
        !element ||
        !/[\p{L}\p{N}]/u.test(text) ||
        element.closest(
          "[aria-hidden=true], :disabled, .visually-hidden, script, style",
        )
      )
        continue;
      const style = getComputedStyle(element);
      if (
        style.visibility === "hidden" ||
        style.display === "none" ||
        Number(style.opacity) === 0
      )
        continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      const rectangle = range.getBoundingClientRect();
      if (
        rectangle.width < 1 ||
        rectangle.height < 1 ||
        rectangle.bottom < 0 ||
        rectangle.top > innerHeight ||
        rectangle.right < 0 ||
        rectangle.left > innerWidth
      )
        continue;
      const fontSize = parseFloat(style.fontSize);
      if (fontSize === 0) continue;
      const bg = background(element);
      const fg = blend(parse(style.color), bg);
      const foregroundLuminance = luminance(fg);
      const backgroundLuminance = luminance(bg);
      const ratio =
        (Math.max(foregroundLuminance, backgroundLuminance) + 0.05) /
        (Math.min(foregroundLuminance, backgroundLuminance) + 0.05);
      const large =
        fontSize >= 24 ||
        (fontSize >= 18.66 && Number(style.fontWeight) >= 700);
      const minimumRatio = large ? 3 : 4.5;
      const key =
        element.className +
        "|" +
        style.color +
        "|" +
        style.fontSize +
        "|" +
        bg.join(",");
      const sample = {
        text: text.slice(0, 70),
        element: element.tagName.toLowerCase(),
        className: String(element.className),
        fontSize,
        color: style.color,
        background: bg.map(Math.round),
        ratio: Math.round(ratio * 100) / 100,
      };
      if (!known.has(key)) {
        known.add(key);
        samples.push(sample);
        if (fontSize < 13 || ratio + 0.01 < minimumRatio)
          violations.push(sample);
      }
    }
    return {
      viewport: innerWidth,
      document: document.documentElement.scrollWidth,
      body: document.body.scrollWidth,
      minimumFontSize: Math.min(...samples.map((item) => item.fontSize)),
      samples,
      violations,
    };
  });
  const result = {
    name,
    width,
    height,
    ...audit,
    overflow: Math.max(audit.document, audit.body) > width,
  };
  layouts.push(result);
}

try {
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page.locator("#pairing-code").waitFor();
  await capture("readable-pair-1440", 1440);
  await capture("readable-pair-736", 736, 980);
  await capture("readable-pair-360", 360, 900);
  const location = JSON.parse(
    await readFile(
      new URL("../.voice-studio/session-location.json", import.meta.url),
      "utf8",
    ),
  );
  const session = JSON.parse(await readFile(location.sessionFile, "utf8"));
  const projects = await fetch(baseUrl + "/api/projects", {
    headers: { Authorization: "Bearer " + session.token },
  }).then((response) => response.json());
  if (!projects.some((project) => /Agent Studio/.test(project.name)))
    throw new Error(
      "The real Agent Studio project must be registered before responsive verification.",
    );
  await page.locator("#pairing-code").fill(session.pairingCode);
  await page.getByRole("button", { name: "Lokales Studio öffnen" }).click();
  await page.locator(".workspace-actions").waitFor({ timeout: 120000 });
  await page.locator("iframe").waitFor({ timeout: 120000 });
  await page.setViewportSize({ width: 1440, height: 1080 });
  const showProjects = page.getByRole("button", {
    name: "Projekte und Dateien",
    exact: true,
  });
  if (await showProjects.isVisible()) await showProjects.click();
  await page
    .locator(".project-button")
    .filter({ hasText: /Agent Studio/ })
    .first()
    .click();
  await page.locator("iframe.live-frame").waitFor({ timeout: 30000 });
  await page
    .frameLocator("iframe.live-frame")
    .locator("h1")
    .waitFor({ timeout: 30000 });
  await page.waitForFunction(
    () =>
      document
        .querySelector(".browser-source")
        ?.textContent?.includes("home.ts"),
    { timeout: 30000 },
  );
  await capture("readable-live-1440", 1440);
  const desktopWebsiteTop = (
    await page.locator("iframe.live-frame").boundingBox()
  )?.y;
  if (desktopWebsiteTop === undefined || desktopWebsiteTop > 280)
    throw new Error(
      "Live website starts too far below the browser chrome: " +
        desktopWebsiteTop,
    );
  await capture("readable-live-736", 736, 980);
  await capture("readable-live-360", 360, 900);
  await page.setViewportSize({ width: 1440, height: 1080 });
  await page
    .getByRole("button", { name: "Review öffnen", exact: true })
    .click();
  await page.locator(".review-panel").waitFor();
  await capture("readable-review-1440", 1440);
  const frame = await page.locator("iframe.live-frame").boundingBox();
  const panel = await page.locator(".review-panel").boundingBox();
  if (!frame || frame.width < 850 || !panel || panel.width > 450)
    throw new Error(
      "The desktop review panel leaves too little width for the real website.",
    );
  await page
    .getByRole("button", { name: "Projekte und Dateien", exact: true })
    .click();
  for (const folder of ["src", "app", "content"]) {
    const button = page
      .locator(".folder-button")
      .filter({ hasText: new RegExp("\\b" + folder + "/") })
      .first();
    if (await button.count()) await button.click();
  }
  if (
    !(await page.locator(".folder-location").innerText()).includes(
      "src/app/content",
    )
  )
    throw new Error(
      "The real project folder navigation did not reach src/app/content.",
    );
  await capture("readable-folders-1440", 1440);
  await page
    .getByRole("button", { name: "Dateien ausblenden", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Review schließen", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Dateibericht", exact: false })
    .click();
  await page.locator(".file-report").waitFor();
  await capture("readable-file-report-1440", 1440);
  await capture("readable-file-report-360", 360, 900);
  await page
    .getByRole("button", { name: "Projektbericht", exact: true })
    .click();
  await page.locator(".project-report").waitFor();
  await capture("readable-project-report-1440", 1440);
  await capture("readable-project-report-736", 736, 980);
  await capture("readable-project-report-360", 360, 900);
  await capture("readable-project-rows-1440", 1440, 1080, ".file-table");
  await capture("readable-project-rows-736", 736, 980, ".file-table");
  await capture("readable-project-rows-360", 360, 900, ".file-table");
  const result = {
    baseUrl,
    browserErrors: errors,
    desktopWebsiteTop,
    desktopWebsiteWidth: frame.width,
    desktopReviewWidth: panel.width,
    layouts,
  };
  await writeFile(
    new URL("readability-results.json", output),
    JSON.stringify(result, null, 2),
  );
  console.log(
    JSON.stringify({
      browserErrors: errors,
      desktopWebsiteWidth: frame.width,
      desktopReviewWidth: panel.width,
      screens: layouts.map((item) => ({
        name: item.name,
        overflow: item.overflow,
        minimumFontSize: item.minimumFontSize,
        violations: item.violations,
      })),
    }),
  );
  if (
    errors.length ||
    layouts.some((item) => item.overflow || item.violations.length)
  )
    process.exitCode = 1;
} catch (error) {
  await page.screenshot({
    path: fileURLToPath(new URL("readability-failure.png", output)),
    fullPage: false,
  });
  await writeFile(
    new URL("readability-results.json", output),
    JSON.stringify({ partial: true, layouts, browserErrors: errors }, null, 2),
  );
  console.log((await page.locator("body").innerText()).slice(0, 3000));
  console.log(
    JSON.stringify({
      browserErrors: errors,
      completedScreens: layouts.map((item) => item.name),
    }),
  );
  throw error;
} finally {
  await browser.close();
}
