# Local project checks

After applying a source proposal, explicitly run the project's configured local build/test command and inspect its result. Checks run as a separate local process, with no model call or Coding-Agent-Runner invocation. They start only on request.

The host selects one fixed command per exact registered project root. The HTTP API accepts a source fingerprint and an idempotency key, never an executable, arguments, working directory or environment. `voice.config.json` has no command configuration.

## Private host configuration

Read `.voice-studio/session-location.json` to locate the session file. Place `checks.json` beside that session file in its existing user-owned session directory, outside every target project. The API reads this file on startup; changing a profile requires a controlled service restart. There is no HTTP endpoint to create or edit it.

For an Angular project with an `npm run check` script, a Windows profile can use the absolute Node executable and npm CLI JavaScript path:

```json
{
  "version": 1,
  "profiles": [{
    "projectPath": "C:/path/to/website",
    "label": "npm run check",
    "executable": "C:/Program Files/nodejs/node.exe",
    "arguments": ["C:/Program Files/nodejs/node_modules/npm/bin/npm-cli.js", "run", "check"],
    "inputDirectories": ["src", "scripts", "public"],
    "inputFiles": [
      "package.json", "package-lock.json", "angular.json", "tsconfig.json",
      "tsconfig.app.json", "tsconfig.spec.json", "eslint.config.js",
      "stylelint.config.cjs", ".prettierrc", ".editorconfig"
    ],
    "requiredFiles": ["package.json", "package-lock.json", "node_modules/@angular/build/package.json"],
    "timeoutSeconds": 600
  }]
}
```

Use the real executable paths installed on the host. `inputDirectories` and `inputFiles` contain fixed relative paths, without globs, and must exist completely. Directories are recursive. The required-file check is repeated immediately before launch and includes its files in the fingerprint. The example's dependency marker blocks start when Angular's build package is missing. The command still executes trusted repository code with the host user's permissions; repository scripts may perform network requests, package operations or other writes. This is not a process sandbox or an offline guarantee.

Host configuration and executable must be outside the target project. Project roots, configuration files, executables, inputs and persisted results reject symbolic links and junctions. Executable arguments use `ProcessStartInfo.ArgumentList`; the service never infers a command from project files.

## Source binding and results

The source fingerprint covers relative file paths and complete file bytes in the configured scope, including missing prerequisite markers. The configuration fingerprint covers the host profile. Capture occurs before starting and again after the process exits. A later GET also marks historical results stale when that scope or profile differs. A successful exit becomes `completed` only for the matching configured source scope; a changed or unreadable scope becomes `stale`, while preserving the original outcome and exit code.

This is an optimistic before/after comparison, not an immutable snapshot. It does not fingerprint every installed dependency or the entire host environment. Build output outside the configured scope does not invalidate a result. The host must update the input scope when build scripts start reading additional source/configuration paths.

States are `running`, `cancelling`, `completed`, `failed`, `cancelled` and `stale`. Timeout is `failed` with an explicit timeout reason. A persisted unfinished run after restart is `failed` with an interruption reason, or `stale` if its source/profile also changed. It is never restarted automatically. Cancellation kills the process tree and waits for process exit. Completion never changes task acceptance, source files, Git state or an earlier proposal's status.

Results are atomically persisted in `.voice-lint/check-runs/<32-hex-run-id>.json`, with the request ID, timestamps, checked fingerprints, input size/count, outcome, exit code and bounded combined output. Both process streams continue to drain after truncation. Limits are 65,536 stored log characters, 2,000 input files, 64 MiB total input bytes, 8 MiB per file, depth 20 and at most 1,200 seconds. One check runs at a time per Voice Studio service. The API returns the newest 50 runs; after 200 persisted runs it requires explicit host-side archival and never silently deletes history.

## API

All routes require the normal paired local session. Base path: `/api/projects/{projectId}/checks`.

| Method | Path | Meaning |
| --- | --- | --- |
| GET | `/configuration` | Availability, prerequisite/limit message, current source fingerprint and counts |
| POST | empty | Explicit start with `{expectedSourceVersion, expectedConfigurationVersion, requestId}` |
| GET | empty | Newest persisted runs, with current staleness |
| GET | `/{id}` | Run status, bounded log, exit code and outcome |
| POST | `/{id}/cancel` | Explicit cancellation; repeated cancellation is idempotent |

A repeated start request returns its existing run and never launches another process. Reusing the same request ID with another source or configuration fingerprint returns HTTP 409. A newly started run must match both displayed fingerprints, so a changed host command cannot be launched from an older UI state. New starts while any check runs, missing prerequisites or a changed expected fingerprint also return 409. The frontend must refresh configuration after source apply and offer a separate start action.

## Verification

```sh
dotnet run --project backend/VoiceStudio.CheckTests/VoiceStudio.CheckTests.csproj --artifacts-path /absolute/isolated/build-directory
```

Tests use an injected fake process for lifecycle, persistence, command selection, source/configuration drift, idempotency, log bounds, prerequisites and invalid scopes. Separate tiny executable fixtures verify actual concurrent stdout/stderr draining, nonzero exit codes and process-tree cancellation. Tests do not invoke a model or build the target website.
