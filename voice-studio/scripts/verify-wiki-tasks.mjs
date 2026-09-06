// Real Angular + API integration, limited to an ignored Markdown fixture.
// Saves and resolves a durable task; no CLI or model is started and source stays unchanged.
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { chromium } from "@playwright/test";

const base = process.env.VOICE_STUDIO_URL || "http://127.0.0.1:5188";
const output = new URL("../frontend/.qa/", import.meta.url);
const fixture = new URL("wiki-task-fixture/", output);
const sourcePath = new URL("index.md", fixture);
const source =
  "# Aufgabenprüfung\n\nDiese Datei dient der lokalen Prüfung von gespeicherten Aufgaben. Der Text bleibt unverändert.\n";
await mkdir(fixture, { recursive: true });
try {
  await writeFile(sourcePath, source, { flag: "wx" });
} catch (error) {
  if (error.code !== "EEXIST") throw error;
}
assert.equal(
  await readFile(sourcePath, "utf8"),
  source,
  "an existing fixture must match its known unchanged source",
);
const pointer = JSON.parse(
  await readFile(
    new URL("../.voice-studio/session-location.json", import.meta.url),
    "utf8",
  ),
);
const session = JSON.parse(await readFile(pointer.sessionFile, "utf8"));
async function api(path, method = "GET", body) {
  const response = await fetch(base + path, {
    method,
    headers: {
      Authorization: "Bearer " + session.token,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const value = await response.json();
  if (!response.ok)
    throw new Error(
      "Fixture API request failed: " +
        response.status +
        " " +
        JSON.stringify(value),
    );
  return value;
}
const project = await api("/api/projects/register", "POST", {
  path: fileURLToPath(fixture),
  name: "Wiki task verification",
});
const documents = await api(
  "/api/projects/" + encodeURIComponent(project.id) + "/documents",
);
const document = documents.find((item) => item.path === "index.md");
assert.ok(document, "the isolated fixture document is registered");
const documentRoute =
  "/api/projects/" +
  encodeURIComponent(project.id) +
  "/documents/" +
  encodeURIComponent(document.id);
const initial = await api(documentRoute);
const instruction =
  "QA " +
  randomUUID() +
  ": Einstieg prüfen und für diesen Integrationstest unverändert beibehalten.";
const note =
  "Im Integrationstest geprüft und bewusst beibehalten. Die Quelldatei bleibt unverändert; kein Modell wurde gestartet.";
const catalog = JSON.parse(
  await readFile(new URL("../knowledge/rules.json", import.meta.url), "utf8"),
);
const browser = await chromium.launch({ headless: true, channel: "chrome" });
const page = await browser.newPage({
  viewport: { width: 1440, height: 1080 },
  deviceScaleFactor: 1,
});
const browserErrors = [],
  modelStarts = [],
  screens = [];
page.on("pageerror", (error) => browserErrors.push(error.message));
page.on("request", (request) => {
  if (
    request.method() === "POST" &&
    /\/(start|semantic-reviews)$/.test(new URL(request.url()).pathname)
  )
    modelStarts.push(new URL(request.url()).pathname);
});

// Fail safely if an unexpected UI regression tries to start inference.
await page.route(
  (url) => /\/(tasks\/[^/]+\/start|semantic-reviews)$/.test(url.pathname),
  async (route) => {
    if (route.request().method() === "POST")
      await route.abort("blockedbyclient");
    else await route.continue();
  },
);

async function openFixture() {
  await page.goto(base + "/?project=" + encodeURIComponent(project.id), {
    waitUntil: "networkidle",
  });
  await page.locator("#pairing-code").fill(session.pairingCode);
  await page
    .getByRole("button", { name: "Lokales Studio öffnen", exact: true })
    .click();
  await page.waitForFunction(
    (name) =>
      document.querySelector(".workspace-actions")?.textContent?.includes(name),
    project.name,
    { timeout: 60000 },
  );
  await page.locator("iframe").waitFor({ timeout: 60000 });
  const showReview = page.getByRole("button", {
    name: "Review öffnen",
    exact: true,
  });
  if (await showReview.isVisible()) await showReview.click();
  await page.locator("voice-source-tasks").waitFor({ timeout: 30000 });
  await page.waitForFunction(
    () =>
      !document
        .querySelector("voice-source-tasks")
        ?.textContent?.includes("Gespeicherte Aufgaben werden geladen"),
  );
}

async function capture(name, width, selector, height = 1080) {
  await page.setViewportSize({ width, height });
  await page
    .locator(selector)
    .evaluate((element) => element.scrollIntoView({ block: "start" }));
  const result = await page.locator(selector).evaluate((root) => {
    const parse = (value) => {
      const channels = value.match(/[\d.]+/g)?.map(Number) ?? [0, 0, 0];
      return [channels[0], channels[1], channels[2], channels[3] ?? 1];
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
          (sum, value, i) => sum + value * [0.2126, 0.7152, 0.0722][i],
          0,
        );
    const background = (element) => {
      const colors = [];
      for (let cursor = element; cursor; cursor = cursor.parentElement)
        colors.push(parse(getComputedStyle(cursor).backgroundColor));
      return colors
        .reverse()
        .reduce((back, front) => blend(front, back), [255, 255, 255]);
    };
    const tree = document.createTreeWalker(root, NodeFilter.SHOW_TEXT),
      samples = [],
      seen = new Set();
    for (let node = tree.nextNode(); node; node = tree.nextNode()) {
      const text = node.textContent?.trim() ?? "",
        element = node.parentElement;
      if (
        !element ||
        !/[\p{L}\p{N}]/u.test(text) ||
        element.closest(
          "[aria-hidden=true],:disabled,.visually-hidden,script,style",
        )
      )
        continue;
      const style = getComputedStyle(element);
      if (
        style.display === "none" ||
        style.visibility === "hidden" ||
        Number(style.opacity) === 0
      )
        continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      const rect = range.getBoundingClientRect();
      if (
        rect.width < 1 ||
        rect.height < 1 ||
        rect.bottom < 0 ||
        rect.top > innerHeight ||
        rect.right < 0 ||
        rect.left > innerWidth
      )
        continue;
      let clipped = false;
      for (
        let cursor = element.parentElement;
        cursor;
        cursor = cursor.parentElement
      ) {
        const cs = getComputedStyle(cursor),
          cr = cursor.getBoundingClientRect();
        if (
          /auto|scroll|hidden|clip/.test(cs.overflowY) &&
          (rect.bottom <= cr.top || rect.top >= cr.bottom)
        ) {
          clipped = true;
          break;
        }
        if (
          /auto|scroll|hidden|clip/.test(cs.overflowX) &&
          (rect.right <= cr.left || rect.left >= cr.right)
        ) {
          clipped = true;
          break;
        }
      }
      if (clipped) continue;
      const bg = background(element),
        fg = blend(parse(style.color), bg),
        a = luminance(fg),
        b = luminance(bg),
        ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05),
        fontSize = parseFloat(style.fontSize);
      const minimum =
        fontSize >= 24 || (fontSize >= 18.66 && Number(style.fontWeight) >= 700)
          ? 3
          : 4.5;
      const key = [element.className, style.color, fontSize, bg.join(",")].join(
        "|",
      );
      if (seen.has(key)) continue;
      seen.add(key);
      samples.push({
        text: text.slice(0, 90),
        className: String(element.className),
        fontSize,
        ratio,
        minimum,
      });
    }
    return {
      width: innerWidth,
      pageOverflow: document.documentElement.scrollWidth > innerWidth,
      surfaceOverflow: root.scrollWidth > root.clientWidth + 1,
      minimumFontSize: Math.min(...samples.map((item) => item.fontSize)),
      minimumContrast: Math.min(...samples.map((item) => item.ratio)),
      violations: samples.filter(
        (item) => item.fontSize < 13 || item.ratio + 0.01 < item.minimum,
      ),
    };
  });
  screens.push({ name, ...result });
  await page.screenshot({
    path: fileURLToPath(new URL(name + ".jpg", output)),
    type: "jpeg",
    quality: 65,
    fullPage: false,
  });
}

try {
  await openFixture();
  let tasks = page.locator("voice-source-tasks");
  if (!(await tasks.locator("#source-task-instruction").isVisible()))
    await tasks
      .getByRole("button", { name: "Neue Aufgabe", exact: true })
      .click();
  await tasks.locator("#source-task-instruction").fill(instruction);
  await tasks
    .getByRole("button", { name: "Aufgabe speichern", exact: true })
    .click();
  await tasks
    .locator(".task-detail")
    .filter({ hasText: instruction })
    .waitFor();
  const saved = (await api(documentRoute + "/tasks")).find(
    (item) => item.instruction === instruction,
  );
  assert.ok(
    saved &&
      saved.status === "queued" &&
      saved.sourceVersion === initial.version,
    "UI save persists the source-bound queued task",
  );
  for (const width of [1440, 398, 360])
    await capture(
      "tasks-queued-" + width,
      width,
      "voice-source-tasks",
      width < 500 ? 980 : 1080,
    );

  await openFixture();
  tasks = page.locator("voice-source-tasks");
  await tasks
    .locator(".task-detail")
    .filter({ hasText: instruction })
    .waitFor();
  assert.equal(
    (await api(documentRoute + "/tasks/" + saved.id)).status,
    "queued",
    "task remains queued after a fresh pairing/page load",
  );
  await tasks.locator(".task-resolution > summary").click();
  await tasks.locator("#task-resolution-note").fill(note);
  await tasks
    .getByRole("button", { name: "Als bearbeitet markieren", exact: true })
    .click();
  await tasks
    .getByRole("heading", { name: "Als bearbeitet markiert", exact: true })
    .waitFor();
  const resolved = await api(documentRoute + "/tasks/" + saved.id);
  assert.equal(resolved.status, "completed");
  assert.equal(resolved.resolution, "manual");
  assert.ok(resolved.notes.some((entry) => entry.includes(note)));

  await openFixture();
  tasks = page.locator("voice-source-tasks");
  await tasks
    .getByRole("heading", { name: "Als bearbeitet markiert", exact: true })
    .waitFor();
  assert.ok(
    (await tasks.innerText()).includes(note),
    "manual completion explanation survives a fresh pairing/page load",
  );
  await capture("tasks-resolved-1440", 1440, "voice-source-tasks");
  await capture("tasks-resolved-360", 360, "voice-source-tasks", 980);
  assert.equal(
    await readFile(sourcePath, "utf8"),
    source,
    "save/manual resolution must leave fixture source byte-for-byte unchanged",
  );

  await page.getByRole("button", { name: "Regel-Wiki", exact: true }).click();
  await page.locator(".wiki-dialog").waitFor();
  await page.locator("#wiki-search").fill("Deutsch und Englisch ohne LLM");
  await page
    .locator(".wiki-nav")
    .getByRole("button", {
      name: "Deutsch und Englisch ohne LLM prüfen",
      exact: true,
    })
    .click();
  assert.equal(
    new URL(page.url()).searchParams.get("wiki"),
    "language-tools",
    "Wiki article has a shareable deep link",
  );
  assert.ok(
    (await page.locator(".tool-table tbody tr").count()) >= 4,
    "language-tools article renders its actual tool/license table",
  );
  for (const width of [1440, 398, 360])
    await capture(
      "wiki-language-tools-" + width,
      width,
      ".wiki-dialog",
      width < 500 ? 980 : 1080,
    );
  await page.locator("#wiki-search").fill(catalog.rules[0].title);
  await page
    .locator(".wiki-nav")
    .getByRole("button", { name: catalog.rules[0].title, exact: true })
    .click();
  await page.locator(".algorithm > summary").click();
  assert.ok(
    (await page.locator(".algorithm").innerText()).includes(
      "regulären Ausdrucks",
    ),
    "rule entry exposes its implemented detection method",
  );
  await capture("wiki-rule-398", 398, ".wiki-dialog", 980);
  await page.keyboard.press("Escape");
  await page.locator(".wiki-dialog").waitFor({ state: "detached" });
  assert.equal(
    new URL(page.url()).searchParams.has("wiki"),
    false,
    "closing Wiki returns to the existing project URL",
  );
  assert.equal(
    modelStarts.length,
    0,
    "the test must never start a model or CLI",
  );
  assert.deepEqual(
    browserErrors,
    [],
    "the integrated UI has no browser runtime errors",
  );
  const result = {
    scope: "Real local Angular and API; ignored Markdown fixture; no inference",
    projectId: project.id,
    taskId: saved.id,
    persistedStatus: resolved.status,
    resolution: resolved.resolution,
    sourceUnchanged: true,
    modelStarts,
    browserErrors,
    screens,
  };
  await writeFile(
    new URL("wiki-task-results.json", output),
    JSON.stringify(result, null, 2),
  );
  console.log(JSON.stringify(result));
  if (
    screens.some(
      (screen) =>
        screen.pageOverflow ||
        screen.surfaceOverflow ||
        screen.violations.length,
    )
  )
    process.exitCode = 1;
} catch (error) {
  if (!(await page.locator("#pairing-code").isVisible()))
    await page.screenshot({
      path: fileURLToPath(new URL("wiki-task-failure.jpg", output)),
      type: "jpeg",
      quality: 65,
    });
  await writeFile(
    new URL("wiki-task-results.json", output),
    JSON.stringify(
      { partial: true, browserErrors, modelStarts, screens },
      null,
      2,
    ),
  );
  throw error;
} finally {
  await browser.close();
}
