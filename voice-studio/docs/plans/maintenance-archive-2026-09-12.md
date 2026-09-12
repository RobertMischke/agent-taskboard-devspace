# Maintenance archive record, 12 September 2026

Internal recovery reference. This record does not describe a product workflow.

## One-off maintenance history

The former devspace `artifacts/voice-readiness-2026-09-12/` directory is retained
locally under `.local/maintenance-archive/2026-09-12/readiness-session/`. Its
inventory records original relative locations, sizes and SHA-256 hashes. The
move preserves bytes; it does not turn those files into reusable programs.

Examples such as `localize-main.mjs`, `integrate-selection.mjs`, `fix-*.mjs` and
the dated `update*.mjs` patches depend on exact earlier source text. Replaying them
against current code could duplicate imports or undo later edits. Their intended
behavior is now in product source and the supported scripts. Raw project/registry
snapshots and old screenshots remain recovery context, not public documentation.

No runtime code, website build or supported command may import this archive.
If a maintenance capability is needed again, extract a parameterized tool with
clear inputs, side effects, failure handling and verification before reusing it.
