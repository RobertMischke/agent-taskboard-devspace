// Exercise actual component methods with deferred fake HTTP and controlled timers.
// This harness never connects to a backend, CLI, model, or website.
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
  for (let i = 0; i < 15; i++) await Promise.resolve();
};
function setup() {
  const timers = new Map();
  let timerId = 0;
  const signal = (initial) => {
    let value = initial;
    const read = () => value;
    read.set = (next) => {
      value = next;
    };
    read.update = (update) => {
      value = update(value);
    };
    return read;
  };
  const decorator = () => (value) => value;
  const core = {
    Component: decorator,
    Input: decorator,
    Output: decorator,
    signal,
    EventEmitter: class {
      values = [];
      emit(value) {
        this.values.push(value);
      }
    },
    inject: () => ({ run: (action) => action() }),
    NgZone: class {},
  };
  const code = ts.transpileModule(
    fs.readFileSync(
      new URL("../frontend/src/app/source-tasks.component.ts", import.meta.url),
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
    code.diagnostics?.filter(
      (item) => item.category === ts.DiagnosticCategory.Error,
    ).length,
    0,
  );
  const module = { exports: {} };
  vm.runInNewContext(
    code.outputText,
    {
      exports: module.exports,
      require: (id) => (id === "@angular/core" ? core : {}),
      crypto: webcrypto,
      setTimeout: (callback) => {
        const id = ++timerId;
        timers.set(id, callback);
        return id;
      },
      clearTimeout: (id) => timers.delete(id),
      console,
    },
    { filename: "source-tasks.component.ts" },
  );
  const component = new module.exports.SourceTasksComponent();
  component.projectId = "project-a";
  component.document = document();
  return {
    component,
    timers,
    fire: () => {
      const entry = timers.entries().next().value;
      assert.ok(entry, "active task has poll timer");
      timers.delete(entry[0]);
      entry[1]();
    },
  };
}
const document = (id = "a") => ({
  id,
  version: "source-" + id,
  reviewRevision: 4,
  path: id + ".ts",
  format: "typescript",
  source: "Before",
  feedback: [
    { id: "feedback-a", status: "open", comment: "Clarify", quote: "Before" },
  ],
});
const task = (id = "one", status = "queued", documentId = "a") => ({
  id,
  projectId: "project-a",
  documentId,
  instruction: "Clarify the opening",
  feedbackIds: ["feedback-a"],
  sourceVersion: "source-" + documentId,
  reviewRevision: 4,
  revision: 1,
  status,
  createdAt: "2026-09-06T20:00:00Z",
  updatedAt: "2026-09-06T20:00:00Z",
  runId: null,
  proposalId: null,
  error: null,
  proposal:
    status === "ready"
      ? {
          id: "proposal-one",
          documentId,
          state: "pending",
          expectedVersion: "source-" + documentId,
          sourceBefore: "Before",
          sourceAfter: "After",
        }
      : null,
});
const route = {
  configured: true,
  available: true,
  cli: "test-cli",
  model: "test-model",
  thinkingLevel: "medium",
  message: "Fake route",
};
const initialApi =
  (tasks = [task()], requests = []) =>
  async (path) =>
    path.endsWith("/status")
      ? route
      : path.endsWith("/requests")
        ? requests
        : tasks;

{
  const { component } = setup();
  let posts = 0;
  const legacy = {
    id: "old",
    instruction: "Earlier saved work",
    feedbackIds: ["feedback-a"],
    status: "queued-local",
  };
  component.api = async (path, method) => {
    if (method === "POST") posts++;
    return initialApi([task()], [legacy])(path);
  };
  component.activeFeedbackId = "feedback-a";
  component.ngOnChanges();
  await flush();
  check(
    component.tasks().length === 1 &&
      component.legacyRequests()[0].id === "old",
    "durable tasks and earlier local requests both remain visible",
  );
  check(
    component.attachedFeedbackIds()[0] === "feedback-a",
    "explicitly selected feedback seeds the task scope",
  );
  component.prepareTask(legacy.instruction, legacy.feedbackIds);
  check(
    component.instruction === legacy.instruction && posts === 0,
    "legacy import prepares a draft without silently migrating or executing it",
  );
  component.ngOnDestroy();
}
{
  const { component, timers, fire } = setup();
  const history = deferred();
  let started;
  component.api = async (path, method, body) => {
    if (path.endsWith("/status")) return route;
    if (path.endsWith("/requests")) return [];
    if (path.endsWith("/start")) {
      started = body;
      return { ...task("one", "running"), revision: 2 };
    }
    if (path.endsWith("/cancel"))
      return { ...task("one", "cancelling"), revision: 3 };
    if (path.endsWith("/one"))
      return { ...task("one", "cancelled"), revision: 4 };
    return history.promise;
  };
  component.ngOnChanges();
  await component.start(task());
  check(
    !started,
    "loading durable history prevents an accidental duplicate launch",
  );
  history.resolve([task()]);
  await flush();
  await component.start(component.selectedTask());
  check(
    started.expectedTaskRevision === 1 &&
      started.expectedVersion === "source-a" &&
      started.expectedReviewRevision === 4 &&
      !!started.requestId,
    "runner handoff carries task, source and feedback preconditions",
  );
  check(
    component.label(component.selectedTask()) === "In Bearbeitung" &&
      timers.size === 1,
    "acknowledged runner work gets an honest running status and polling",
  );
  await component.cancel(component.selectedTask());
  check(
    component.selectedTask().status === "cancelling" && timers.size === 1,
    "cancellation continues polling until a durable terminal state",
  );
  fire();
  await flush();
  check(
    component.selectedTask().status === "cancelled" && timers.size === 0,
    "terminal cancellation stops polling",
  );
  component.ngOnDestroy();
}
{
  const { component } = setup();
  component.api = initialApi([task("ready", "ready")]);
  component.ngOnChanges();
  await flush();
  const ready = component.selectedTask();
  check(
    component.canApply(ready),
    "current ready proposal can be explicitly applied",
  );
  component.document = { ...component.document, reviewRevision: 5 };
  check(
    !component.canApply(ready),
    "feedback revision changes block source apply",
  );
  component.document = document("b");
  check(
    !component.canApply(ready),
    "another document cannot receive a ready proposal",
  );
  component.document = document();
  component.projectId = "other";
  check(
    !component.canApply(ready),
    "a matching source hash cannot cross project identity",
  );
  check(
    component.label({ ...ready, status: "applied" }) === "Übernommen",
    "applied status stays durable after the source version advances",
  );
  component.ngOnDestroy();
}
{
  const { component } = setup();
  const applying = deferred();
  let captured;
  component.api = async (path, method, body) =>
    path.endsWith("/apply")
      ? ((captured = { path, body }), applying.promise)
      : initialApi([task("ready", "ready")])(path);
  component.ngOnChanges();
  await flush();
  const applyingPromise = component.apply(component.selectedTask());
  component.document = document("b");
  component.ngOnChanges();
  await flush();
  applying.resolve({
    task: task("ready", "applied"),
    document: { ...document(), version: "changed" },
  });
  await applyingPromise;
  check(
    captured.path.includes("/documents/a/tasks/ready/apply") &&
      captured.body.expectedReviewRevision === 4,
    "source apply retains the original file and feedback preconditions",
  );
  check(
    component.documentApplied.values.length === 0 &&
      component.document.id === "b",
    "late apply response cannot replace a newly navigated document",
  );
  component.ngOnDestroy();
}
{
  const { component, fire } = setup();
  const oldPoll = deferred();
  component.api = async (path) =>
    path.endsWith("/status")
      ? route
      : path.endsWith("/requests")
        ? []
        : path.endsWith("/active")
          ? oldPoll.promise
          : path.endsWith("/older")
            ? task("older", "ready")
            : [task("active", "running"), task("older", "ready")];
  component.ngOnChanges();
  await flush();
  fire();
  await flush();
  await component.openTask(task("older", "ready"));
  oldPoll.resolve(task("active", "ready"));
  await flush();
  check(
    component.selectedTask().id === "older",
    "a delayed running-task poll cannot replace the explicitly opened result",
  );
  component.ngOnDestroy();
}
{
  const { component } = setup();
  const payloads = [];
  component.api = async (path, method, body) => {
    if (method !== "POST") return initialApi([])(path);
    payloads.push(body);
    if (payloads.length === 1) throw new Error("Connection interrupted");
    return task();
  };
  component.ngOnChanges();
  await flush();
  component.instruction = "Clarify the opening";
  await component.create();
  await component.create();
  check(
    payloads.length === 2 && payloads[0].requestId === payloads[1].requestId,
    "retrying an uncertain save uses the same idempotency key",
  );
  check(
    component.tasks().length === 1 && component.instruction === "",
    "successful save records one durable task and clears only the saved draft",
  );
  component.ngOnDestroy();
}
{
  const { component } = setup();
  const oldHistory = deferred();
  component.api = async (path) =>
    path.endsWith("/status")
      ? route
      : path.endsWith("/requests")
        ? []
        : path.includes("/documents/a/")
          ? oldHistory.promise
          : [task("new", "queued", "b")];
  component.ngOnChanges();
  component.document = document("b");
  component.ngOnChanges();
  await flush();
  oldHistory.resolve([task("old")]);
  await flush();
  check(
    component.selectedTask().id === "new" && !component.loading(),
    "late former-document history and finally cannot replace the active file state",
  );
  component.ngOnDestroy();
}
{
  const { component } = setup();
  let prompts = 0;
  component.api = async (path, method) => {
    if (path.endsWith("/prompt")) {
      prompts++;
      return {
        prompt: "A manual handoff",
        sourceVersion: "source-a",
        reviewRevision: 4,
      };
    }
    if (method === "POST")
      throw Object.assign(new Error("Feedback changed"), { status: 409 });
    return initialApi()(path);
  };
  component.ngOnChanges();
  await flush();
  check(
    prompts === 0 && component.manualPrompt() === null,
    "manual prompt stays a user-triggered fallback",
  );
  await component.showPrompt(component.selectedTask());
  check(
    prompts === 1 && component.manualPrompt().prompt === "A manual handoff",
    "explicit fallback loads the persisted task prompt",
  );
  await component.start(component.selectedTask());
  check(
    component.conflict() && !component.canStart(component.selectedTask()),
    "server conflict blocks another launch until source refresh",
  );
  component.document = { ...component.document };
  component.ngOnChanges();
  await flush();
  check(
    !component.conflict(),
    "fresh document input revalidates the task after a source refresh",
  );
  component.ngOnDestroy();
}

{
  const { component } = setup();
  const resolutions = [];
  component.api = async (path, method, body) => {
    if (path.endsWith("/resolve")) {
      resolutions.push(body);
      return {
        ...task("one", "completed"),
        resolution: "manual",
        notes: [body.note],
      };
    }
    return initialApi()(path);
  };
  component.ngOnChanges();
  await flush();
  await component.resolve(component.selectedTask());
  check(
    resolutions.length === 0,
    "manual completion requires an explicit explanation",
  );
  component.document = {
    ...component.document,
    version: "new-source",
    reviewRevision: 7,
  };
  component.resolutionNote = "  Reviewed and deliberately retained.  ";
  await component.resolve(component.selectedTask());
  check(
    resolutions[0].expectedVersion === "new-source" &&
      resolutions[0].expectedReviewRevision === 7 &&
      resolutions[0].expectedTaskRevision === 1,
    "manual completion checks the currently displayed source while preserving historic task binding",
  );
  check(
    component.selectedTask().status === "completed" &&
      component.selectedTask().notes[0] ===
        "Reviewed and deliberately retained." &&
      component.documentApplied.values.length === 0,
    "manual resolution persists its explanation without emitting a source write",
  );
  check(
    component.label(component.selectedTask()) === "Als bearbeitet markiert",
    "manual completion is distinguished from an applied source diff",
  );
  component.resolutionNote = "Again";
  check(
    !component.canResolve(component.selectedTask()) &&
      !component.canResolve(task("active", "running")),
    "completed and running tasks cannot be manually resolved again",
  );
  component.ngOnDestroy();
}
{
  const { component, fire, timers } = setup();
  component.api = async (path) =>
    path.endsWith("/status")
      ? route
      : path.endsWith("/requests")
        ? []
        : path.endsWith("/active")
          ? {
              ...task("active", "completed"),
              resolution: "agent_no_changes",
              notes: ["The named wording is already precise."],
            }
          : [task("active", "running")];
  component.ngOnChanges();
  await flush();
  fire();
  await flush();
  check(
    component.selectedTask().status === "completed" &&
      timers.size === 0 &&
      !component.canApply(component.selectedTask()),
    "a successful no-change result stops polling and has no source apply action",
  );
  check(
    component.label(component.selectedTask()) ===
      "Vom Agent als erfüllt bewertet" &&
      component.selectedTask().notes.length === 1,
    "no-change outcome retains an honest status and agent explanation",
  );
  component.ngOnDestroy();
}

{
  const { component, timers } = setup();
  component.api = initialApi([
    {
      ...task("clarification", "needs_review"),
      notes: ["A product fact needs confirmation."],
    },
  ]);
  component.ngOnChanges();
  await flush();
  component.resolutionNote = "Reviewed the open question.";
  check(
    component.label(component.selectedTask()) === "Klärung nötig" &&
      timers.size === 0 &&
      !component.canApply(component.selectedTask()),
    "unresolved questions stop polling without becoming an applied or completed result",
  );
  check(
    component.canResolve(component.selectedTask()),
    "clarification tasks retain an explicit manual resolution path",
  );
  component.ngOnDestroy();
}
console.log(
  "Source task UI: " +
    checks +
    " checks passed; fake HTTP only, no backend or model calls.",
);
