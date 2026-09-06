// Actual transpiled component methods with fake HTTP and controlled timers.
// Never runs a build command, backend, CLI or model.
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { webcrypto } from "node:crypto";
import ts from "typescript";
let checks = 0;
const check = (condition, message) => {
  assert.ok(condition, message);
  checks++;
};
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
};
const flush = async () => {
  for (let i = 0; i < 16; i++) await Promise.resolve();
};
function setup() {
  const timers = new Map();
  let timerId = 0;
  const signal = (initial) => {
    let value = initial;
    const read = () => value;
    read.set = (next) => (value = next);
    read.update = (fn) => (value = fn(value));
    return read;
  };
  const decorator = () => (value) => value;
  const core = {
    Component: decorator,
    Input: decorator,
    signal,
    inject: () => ({ run: (fn) => fn(), runOutsideAngular: (fn) => fn() }),
    NgZone: class {},
  };
  const code = ts.transpileModule(
    fs.readFileSync(
      new URL(
        "../frontend/src/app/project-checks.component.ts",
        import.meta.url,
      ),
      "utf8",
    ),
    {
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.CommonJS,
        experimentalDecorators: true,
      },
      reportDiagnostics: true,
    },
  );
  assert.equal(
    code.diagnostics.filter((d) => d.category === ts.DiagnosticCategory.Error)
      .length,
    0,
  );
  const module = { exports: {} };
  vm.runInNewContext(
    code.outputText,
    {
      exports: module.exports,
      require: (id) => (id === "@angular/core" ? core : {}),
      crypto: webcrypto,
      setTimeout: (fn) => {
        const id = ++timerId;
        timers.set(id, fn);
        return id;
      },
      clearTimeout: (id) => timers.delete(id),
      console,
    },
    { filename: "project-checks.component.ts" },
  );
  const component = new module.exports.ProjectChecksComponent();
  component.projectId = "project-a";
  component.sourceSnapshot = {
    id: "doc-a",
    version: "document-hash",
    reviewRevision: 1,
  };
  return {
    component,
    timers,
    fire() {
      const entry = timers.entries().next().value;
      assert.ok(entry, "poll scheduled");
      timers.delete(entry[0]);
      entry[1]();
    },
  };
}
const configuration = () => ({
  configured: true,
  startable: true,
  label: "npm run check",
  currentSourceVersion: "project-hash",
  configurationVersion: "config-hash",
  logLimitChars: 65536,
});
const run = (status = "running", id = "check-one") => ({
  id,
  projectId: "project-a",
  label: "npm run check",
  sourceVersion: "project-hash",
  configurationVersion: "config-hash",
  status,
  createdAt: "2026-09-06T21:00:00Z",
  startedAt: "2026-09-06T21:00:00Z",
  log: "",
  logTruncated: false,
  inputFileCount: 8,
  inputBytes: 500,
});
async function load(component, runs = []) {
  component.api = async (path) =>
    path.endsWith("/configuration") ? configuration() : runs;
  component.ngOnChanges();
  await flush();
}

{
  const { component, timers } = setup();
  await load(component);
  check(
    component.canStart(),
    "configured current project can be explicitly checked",
  );
  check(
    component.runs().length === 0 && timers.size === 0,
    "loading an empty project never starts or polls a process",
  );
  const config = component.configuration();
  component.configuration.set({ ...config, startable: false });
  check(!component.canStart(), "missing host prerequisites disable start");
  component.configuration.set(config);
  component.disabled = true;
  check(!component.canStart(), "parent mutation disables check start");
}
{
  const { component } = setup();
  const slow = deferred();
  component.api = (path) =>
    path.includes("project-a")
      ? slow.promise
      : Promise.resolve(
          path.endsWith("/configuration")
            ? { ...configuration(), currentSourceVersion: "new-project" }
            : [],
        );
  component.ngOnChanges();
  component.projectId = "project-b";
  component.ngOnChanges();
  await flush();
  slow.resolve([run()]);
  await flush();
  check(
    component.configuration().currentSourceVersion === "new-project" &&
      component.runs().length === 0,
    "old project load cannot overwrite a newly selected project",
  );
}
{
  const { component, timers } = setup();
  await load(component);
  const bodies = [];
  const first = deferred();
  component.api = async (path, method, body) => {
    bodies.push(body);
    if (bodies.length === 1) return first.promise;
    return run();
  };
  const start = component.start();
  await component.start();
  check(bodies.length === 1, "double click starts one request");
  first.reject(new Error("Connection lost"));
  await start;
  check(
    component.error() === "Connection lost" && component.runs().length === 0,
    "ambiguous start error does not pretend a process is running",
  );
  await component.start();
  check(
    bodies.length === 2 && bodies[0].requestId === bodies[1].requestId,
    "manual retry preserves the idempotency key",
  );
  check(
    bodies[0].expectedSourceVersion === "project-hash" &&
      bodies[0].expectedConfigurationVersion === "config-hash",
    "start binds the displayed project and check-configuration fingerprints",
  );
  check(
    component.selectedRun().status === "running" && timers.size === 1,
    "successful explicit start begins status polling",
  );
  component.ngOnDestroy();
  check(timers.size === 0, "destroy clears the active poll timer");
}
{
  const { component } = setup();
  await load(component);
  const late = deferred();
  component.api = () => late.promise;
  const start = component.start();
  component.projectId = "project-b";
  component.api = async (path) =>
    path.endsWith("/configuration") ? configuration() : [];
  component.ngOnChanges();
  await flush();
  late.resolve(run());
  await start;
  check(
    component.runs().length === 0 && component.selectedRun() === null,
    "late start response cannot attach an old project run to the new project",
  );
}
{
  const { component, timers, fire } = setup();
  await load(component, [run()]);
  const oldPoll = deferred();
  component.api = async (path, method) =>
    method === "POST" ? run("cancelling") : oldPoll.promise;
  fire();
  await flush();
  await component.cancel(component.selectedRun());
  oldPoll.resolve({ ...run("completed"), exitCode: 0 });
  await flush();
  check(
    component.selectedRun().status === "cancelling",
    "an older poll result cannot overwrite the newer cancellation response",
  );
  component.api = async () => run("cancelled");
  fire();
  await flush();
  check(
    component.selectedRun().status === "cancelled" && timers.size === 0,
    "cancellation remains visible until terminal status and then stops polling",
  );
}
{
  const { component, timers } = setup();
  await load(component, [
    { ...run("completed"), exitCode: 0, outcome: "completed" },
  ]);
  check(
    component.label(component.selectedRun()) === "Prüfung bestanden" &&
      timers.size === 0,
    "current successful historical run is shown without polling",
  );
  component.configuration.set({
    ...configuration(),
    currentSourceVersion: "changed-project",
  });
  check(
    component.isStale(component.selectedRun()) &&
      component.label(component.selectedRun()) === "Prüfung veraltet",
    "exit zero on an older source cannot be presented as current success",
  );
  component.configuration.set({
    ...configuration(),
    configurationVersion: "changed-config",
  });
  check(
    component.isStale(component.selectedRun()),
    "changed check configuration also invalidates the displayed result",
  );
  const active = run();
  check(
    !component.isStale(active),
    "running process remains running until the backend resolves its actual outcome",
  );
}
{
  const { component } = setup();
  await load(component);
  component.api = async () => {
    throw Object.assign(new Error("conflict"), { status: 412 });
  };
  await component.start();
  check(
    !component.canStart() && component.error().includes("Projektstand"),
    "stale preconditions block retry until explicit refresh",
  );
  let reads = 0;
  component.api = async (path) => {
    reads++;
    return path.endsWith("/configuration") ? configuration() : [];
  };
  component.sourceSnapshot = { ...component.sourceSnapshot };
  component.ngOnChanges();
  await flush();
  check(
    reads === 2 && component.canStart(),
    "fresh source snapshot after apply reloads configuration and history",
  );
}
{
  const { component } = setup();
  component.api = async () => ({});
  component.ngOnChanges();
  await flush();
  check(
    Array.isArray(component.runs()) &&
      !component.activeRun() &&
      !component.canStart() &&
      component.error().includes("keine Projektprüfungen"),
    "older API SPA fallback never corrupts the run list or renders as a configured check",
  );
}
{
  const { component } = setup();
  await load(component, [{ ...run("completed"), exitCode: 0 }]);
  component.api = async () => {
    throw new Error("Cannot read project fingerprint");
  };
  component.sourceSnapshot = { ...component.sourceSnapshot };
  component.ngOnChanges();
  await flush();
  check(
    component.selectedRun()?.exitCode === 0 &&
      component.label(component.selectedRun()) ===
        "Prüfstand nicht bestätigt" &&
      component.resultStatus(component.selectedRun()) === "unknown",
    "failed fingerprint refresh keeps historical output without a current green success label",
  );
}
{
  const { component } = setup();
  await load(component);
  component.configuration.set({
    ...configuration(),
    configurationVersion: undefined,
  });
  check(
    !component.canStart(),
    "an unknown check-configuration version cannot be started",
  );
}
console.log(
  `Project check UI state: ${checks} checks passed; fake HTTP only, no process or inference.`,
);
