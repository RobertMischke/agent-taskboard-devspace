// Real local UI/process integration with one ignored fixture; never starts a model.
// --prepare creates the fixture and a host-profile fragment; configure that profile before running.
import assert from "node:assert/strict";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
const output = new URL("../frontend/.qa/", import.meta.url),
  fixture = new URL("project-check-fixture/", output);
const source =
  "# Lokale Prüffixture\n\nDiese Datei dient ausschließlich der isolierten Prüfung des Build- und Testablaufs im Voice Studio.\n";
const script = `import { readFile } from 'node:fs/promises';
const mode=JSON.parse(await readFile(new URL('src/check-mode.json',import.meta.url),'utf8'));
console.log('Voice Studio fixture check started. No model or network call.');
await readFile(new URL('src/index.md',import.meta.url),'utf8');
await new Promise(resolve=>setTimeout(resolve,Math.max(0,Math.min(10000,Number(mode.delayMs)||0))));
console.log('Fixture source was read successfully.');
if(mode.exitCode)console.error('Intentional fixture failure.');
process.exitCode=mode.exitCode?1:0;
`;
await mkdir(new URL("src/", fixture), { recursive: true });
async function ensure(name, value) {
  const path = new URL(name, fixture);
  try {
    await writeFile(path, value, { flag: "wx" });
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
  }
  assert.equal(
    await readFile(path, "utf8"),
    value,
    "existing fixture source must match its known content",
  );
}
await ensure("src/index.md", source);
await ensure("check.mjs", script);
async function mode(delayMs, exitCode) {
  await writeFile(
    new URL("src/check-mode.json", fixture),
    JSON.stringify({ delayMs, exitCode }),
  );
}
await mode(1800, 0);
const profile = {
  projectPath: fileURLToPath(fixture),
  label: "Isolierte UI-Prüfung",
  executable: process.execPath,
  arguments: [fileURLToPath(new URL("check.mjs", fixture))],
  inputDirectories: ["src"],
  inputFiles: ["check.mjs"],
  requiredFiles: ["check.mjs"],
  timeoutSeconds: 15,
};
await writeFile(
  new URL("project-check-host-profile.json", output),
  JSON.stringify(profile, null, 2),
);
if (process.argv.includes("--prepare")) {
  console.log(
    "Prepared frontend/.qa/project-check-host-profile.json; add this object to the private checks.json profiles and restart the API.",
  );
  process.exit(0);
}
const base = process.env.VOICE_STUDIO_URL || "http://127.0.0.1:5188";
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
  assert.ok(
    response.ok,
    "Fixture API failed " + response.status + " " + JSON.stringify(value),
  );
  return value;
}
const unknownApi = await fetch(base + "/api/voice-studio-unknown-fixture", {
  headers: { Authorization: "Bearer " + session.token },
});
assert.equal(unknownApi.status, 404, "unknown API routes return an actual 404");
assert.ok(
  unknownApi.headers.get("content-type")?.includes("json"),
  "unknown API routes never return the SPA HTML",
);
await unknownApi.json();
const project = await api("/api/projects/register", "POST", {
  path: fileURLToPath(fixture),
  name: "Project check verification",
});
const route = "/api/projects/" + encodeURIComponent(project.id) + "/checks";
const config = await api(route + "/configuration");
assert.ok(
  config.configured && config.startable,
  "Configure the prepared private host profile before this test: " +
    config.message,
);
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1080 } });
const errors = [],
  starts = [],
  modelStarts = [],
  screens = [];
page.on("pageerror", (error) => errors.push(error.message));
page.on("request", (request) => {
  const path = new URL(request.url()).pathname;
  if (request.method() === "POST" && path === route)
    starts.push(request.postDataJSON());
  if (
    request.method() === "POST" &&
    /\/(tasks\/[^/]+\/start|semantic-reviews)$/.test(path)
  )
    modelStarts.push(path);
});
await page.route(
  (url) => /\/(tasks\/[^/]+\/start|semantic-reviews)$/.test(url.pathname),
  async (request) => {
    if (request.request().method() === "POST")
      await request.abort("blockedbyclient");
    else await request.continue();
  },
);
async function open() {
  await page.goto(base + "/?project=" + encodeURIComponent(project.id), {
    waitUntil: "networkidle",
  });
  await page.locator("#pairing-code").fill(session.pairingCode);
  await page
    .getByRole("button", { name: "Lokales Studio öffnen", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Review öffnen", exact: true })
    .waitFor({ timeout: 60000 });
  await page.locator("iframe").waitFor({ timeout: 60000 });
  await page
    .getByRole("button", { name: "Review öffnen", exact: true })
    .click();
  await page.locator("voice-project-checks").waitFor({ timeout: 60000 });
  await page
    .locator("voice-project-checks")
    .getByRole("button", { name: "Lokale Prüfung starten", exact: true })
    .waitFor({ timeout: 60000 });
}
const panel = () => page.locator("voice-project-checks");
async function refresh() {
  await panel()
    .getByRole("button", { name: "Stand aktualisieren", exact: true })
    .click();
  await page.waitForFunction(
    () =>
      !document
        .querySelector("voice-project-checks")
        ?.textContent?.includes("Prüfstand wird geladen"),
  );
}
async function capture(name, width) {
  await page.setViewportSize({ width, height: 1080 });
  await panel().evaluate((element) =>
    element.scrollIntoView({ block: "start" }),
  );
  const measured = await panel().evaluate((root) => {
    const sizes = [...root.querySelectorAll("h3,h4,p,button,summary,pre,span")]
      .filter((element) => element.getBoundingClientRect().height > 0)
      .map((element) => parseFloat(getComputedStyle(element).fontSize));
    return {
      pageOverflow: document.documentElement.scrollWidth > innerWidth,
      panelOverflow: root.scrollWidth > root.clientWidth + 1,
      minimumFontSize: Math.min(...sizes),
    };
  });
  screens.push({ name, width, ...measured });
  await page.screenshot({
    path: fileURLToPath(new URL(name + ".jpg", output)),
    type: "jpeg",
    quality: 65,
  });
}
const startedIds = [];
async function startCheck() {
  const pending = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname === route,
  );
  await panel()
    .getByRole("button", { name: "Lokale Prüfung starten", exact: true })
    .click();
  const response = await pending;
  assert.ok(response.ok());
  const run = await response.json();
  startedIds.push(run.id);
  return run;
}
async function settled(id) {
  for (let attempt = 0; attempt < 300; attempt++) {
    const run = await api(route + "/" + encodeURIComponent(id));
    if (run.status !== "running" && run.status !== "cancelling") return run;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("The explicitly started fixture check did not finish");
}
async function uiSettled() {
  await page.waitForFunction(
    () => {
      const button = [
        ...document.querySelectorAll("voice-project-checks button"),
      ].find((item) => item.textContent.trim() === "Lokale Prüfung starten");
      return button && !button.disabled;
    },
    undefined,
    { timeout: 60000 },
  );
}
try {
  await open();
  assert.equal(starts.length, 0, "opening the panel never starts a process");
  const successStarted = await startCheck();
  const success = await settled(successStarted.id);
  await uiSettled();
  // Fast successful processes may finish before the first visible poll; the cancellation case below verifies active progress.
  await panel()
    .getByRole("heading", { name: "Prüfung bestanden", exact: true })
    .waitFor({ timeout: 60000 });
  let runs = await api(route);
  assert.equal(runs[0].id, success.id);
  assert.equal(success.status, "completed");
  assert.equal(success.exitCode, 0);
  await panel().locator(".check-logs > summary").click();
  assert.ok(
    (await panel().innerText()).includes(
      "Fixture source was read successfully.",
    ),
  );
  await capture("checks-success-1440", 1440);
  await open();
  await panel()
    .getByRole("heading", { name: "Prüfung bestanden", exact: true })
    .waitFor();
  assert.equal(
    (await api(route))[0].id,
    success.id,
    "completed check persists across reload and pairing",
  );
  await mode(250, 1);
  await refresh();
  await panel()
    .getByRole("heading", { name: "Prüfung veraltet", exact: true })
    .waitFor();
  assert.ok(
    (await panel().innerText()).includes("Früheres Ergebnis: bestanden."),
  );
  await capture("checks-stale-360", 360);
  const failedStarted = await startCheck();
  const failed = await settled(failedStarted.id);
  await uiSettled();
  await panel()
    .getByRole("heading", { name: "Prüfung fehlgeschlagen", exact: true })
    .waitFor({ timeout: 60000 });
  runs = await api(route);
  assert.equal(runs[0].id, failed.id);
  assert.equal(runs[0].exitCode, 1);
  assert.ok(
    (await panel().innerText()).includes("Intentional fixture failure."),
  );
  await capture("checks-failed-398", 398);
  await mode(9000, 0);
  await refresh();
  const cancelStarted = await startCheck();
  await panel()
    .getByRole("heading", { name: "Prüfung läuft", exact: true })
    .waitFor();
  await panel()
    .getByRole("button", { name: "Prüfung abbrechen", exact: true })
    .click();
  const cancelled = await settled(cancelStarted.id);
  await panel()
    .getByRole("heading", { name: "Prüfung abgebrochen", exact: true })
    .waitFor({ timeout: 60000 });
  runs = await api(route);
  assert.equal(runs[0].id, cancelled.id);
  assert.equal(runs[0].status, "cancelled");
  await capture("checks-cancelled-360", 360);
  assert.equal(starts.length, 3);
  assert.equal(new Set(starts.map((item) => item.requestId)).size, 3);
  assert.equal(modelStarts.length, 0);
  assert.deepEqual(errors, []);
  assert.equal(
    await readFile(new URL("src/index.md", fixture), "utf8"),
    source,
  );
  const result = {
    scope: "Actual local UI and Node process; isolated fixture; no models",
    unknownApiStatus: unknownApi.status,
    projectId: project.id,
    successRunId: success.id,
    starts: starts.length,
    modelStarts,
    errors,
    sourceUnchanged: true,
    screens,
  };
  await writeFile(
    new URL("project-check-results.json", output),
    JSON.stringify(result, null, 2),
  );
  console.log(JSON.stringify(result));
  assert.ok(
    screens.every(
      (screen) =>
        !screen.pageOverflow &&
        !screen.panelOverflow &&
        screen.minimumFontSize >= 13,
    ),
  );
} catch (error) {
  if (!(await page.locator("#pairing-code").isVisible()))
    await page.screenshot({
      path: fileURLToPath(new URL("project-check-failure.jpg", output)),
      type: "jpeg",
      quality: 65,
    });
  throw error;
} finally {
  for (const id of startedIds) {
    const run = await api(route + "/" + encodeURIComponent(id));
    if (run.status === "running" || run.status === "cancelling") {
      await api(route + "/" + encodeURIComponent(id) + "/cancel", "POST");
      await settled(id);
    }
  }
  await browser.close();
}
