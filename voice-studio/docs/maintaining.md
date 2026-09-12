# Product files and verification records

## File locations

| Location | Purpose |
| --- | --- |
| `frontend/`, `backend/`, `packages/` | Application, source adapters, contracts and reusable review Library. |
| `knowledge/`, `examples/` | Rule explanations and maintained integration/sample sources. |
| `website/` | Static product site and documentation renderer; publish its built output. |
| `scripts/` | Build, operator and verification commands. |
| `benchmarks/writing-review/` | Authored EN/DE fixtures, offline comparison runner and reviewed-result retention. |
| `website/research/` | Maintained source-to-API research and the retained measurement summary. |
| `docs/integrations/`, `scripts/integrations/` | Maintained inputs and commands for external repository integrations. |
| `docs/verification/<date>/` | Selected reports and evidence for a dated verification claim. |
| `test-results/`, `**/dist/`, `**/bin/`, `**/obj/` | Generated output; ignored in Git and reproducible from source. |
| `.local/`, `.voice-runtime/`, `.voice-studio/`, private user application data | Local maintenance, registry, session and runtime data; excluded from publication. |

A reviewed project's decisions and tasks live in that project's `.voice-lint/`
folder. See the [storage reference](workflow.md#files-beside-the-source) for its
actual file tree and JSON formats.

## Run maintained tools

Use the [command catalogue](../scripts/README.md) for prerequisites, inputs and
outputs. From the Voice Studio workspace:

```sh
npm run build
npm run website:build
npm run test:evidence
```

`test:evidence` checks retained manifests and file hashes; it does not rerun the
historical checks. Source and task changes go through the Studio backend.

## Keep evidence that can be reused

After a verification run, select the report and captures needed to support its
result. Store them under a dated `docs/verification/` directory with the source
revision or working-copy snapshot, capture time, tested scope and remaining gaps.
Add byte sizes and SHA-256 hashes to the manifest. Keep capture time separate from
copy time. A new run gets a new record rather than replacing an old observation.

Raw output stays in `test-results/`. Before promoting it, remove credentials,
unnecessary host paths and raw instructions. Preserve the source or an authorized
snapshot reference when content must remain reproducible; hashes alone are not
backups. The website includes only its selected document sources and evidence
whose manifest hashes match.

## Maintain reusable commands

Build and operator commands belong in `scripts/`; benchmark runners and their
fixtures belong in `benchmarks/`. Document explicit inputs, side effects,
output locations and failure behavior. Document it in the command catalogue.
Keep one-off patch and investigation scripts in ignored local maintenance storage;
product code and supported commands must not import that storage.
