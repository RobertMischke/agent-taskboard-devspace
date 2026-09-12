# Voice Lint dossier integration

This integration maintains the Voice Studio section of dossier **VL-W1** in the
separate Voice Lint repository. It is a documentation integration, not a runtime
dependency of Studio or `@voice/review`.

- `dossier-fragment.html` is the maintained implementation/evidence narrative.
- `dossier.json` declares the target identity, public title, status text and summary.
- The target checkout retains the full dossier and its lifecycle fields.

From the Voice Studio workspace:

```sh
# Compare only. Exit 1 means that an explicit synchronization is needed.
npm run docs:dossier:check -- --repository C:/Projects/voice-lint

# Synchronize the marked section and declared presentation fields.
npm run docs:dossier:sync -- --repository C:/Projects/voice-lint

# Read the actually served dossier and check desktop/mobile layout.
npm run test:dossier
```

`VOICE_LINT_REPOSITORY` can supply the target path. No machine-specific path is
compiled into the tool. `--content-only` preserves the descriptor while updating
the marked HTML section. Repeat synchronization makes no changes when the
maintained content is already current.

The synchronizer requires the existing `voice-concept-revision` / `VL-W1`
identity and unique section markers. It preserves status, phase, related task
keys and all unrelated fields. It never commits, pushes or changes companion
concept files. Missing markers or identity mismatch fail before writing. This
tool targets a standalone checked-out documentation repository; it must not be
pointed at centrally managed application metadata.

The read-only verifier accepts `--api-base`, `--client-id`, `--project`, `--output`
and `--skip-browser`. It checks the maintained content, not hardcoded historical
test counts or Git commits. Its default API is the existing local Agent Studio
reference service; it does not start that service or mutate its data.

The older patch scripts also rewrote historical introductions, fixed one
particular table or patched source strings. Those completed migrations are local
maintenance history. They are not part of this reusable synchronizer.
