# Third-party dependencies and license records

Checked 2026-09-06. This record distinguishes actual dependencies from proposed
language tooling. It does not assign a license to first-party Voice Studio or
the @voice workspace packages.

## Actual dependency metadata

| Component | Resolved version(s) | Declared license | Evidence |
|---|---|---|---|
| Angular runtime packages | 21.2.22 | MIT | Installed package manifests; package-lock.json |
| Angular build / CLI | 21.2.23 | MIT | Installed package manifests; package-lock.json |
| Angular compiler-cli | 21.2.22 | MIT | Installed package manifest; package-lock.json |
| RxJS | 7.8.2 | Apache-2.0 | Installed rxjs/package.json; package-lock.json |
| tslib | 2.8.1 | 0BSD | Installed tslib/package.json; package-lock.json |
| TypeScript | 5.8.3 and 5.9.3 | Apache-2.0 | Installed manifests; used for builds and the backend AST adapter |
| esbuild | 0.25.12, 0.28.1, 0.28.2 | MIT | Resolved/installed manifests; build dependency |
| jsdom | 26.1.0 | MIT | Installed manifest; library tests |
| Playwright test | 1.63.0 | Apache-2.0 | Installed manifest; development browser tests |
| CodingAgentRunner | 0.7.0 | Apache-2.0 | Installed NuGet .nuspec license expression; [license](https://licenses.nuget.org/Apache-2.0), [package](https://www.nuget.org/packages/CodingAgentRunner/0.7.0) |
| Microsoft.Extensions.Logging.Abstractions | 9.0.0 | MIT | Installed NuGet metadata; [license](https://licenses.nuget.org/MIT) |
| Microsoft.Extensions.DependencyInjection.Abstractions | 9.0.0 | MIT | Installed NuGet metadata; transitive dependency of Logging.Abstractions |

The CodingAgentRunner package identifies its source as
https://github.com/agent-orc/runner, commit
d456110e17326188d79027db6e7307d0a7e95f2f.
Its net9/net10 dependency chain includes the two Microsoft packages above; their
NuGet metadata identify dotnet/runtime commit
9d5a6a9aa463d6d10b0b0ba6d5982cc82f363dc3.
The CLI programs invoked through Runner are installed separately and are not
redistributed by Voice Studio. Their licenses, account terms and service terms
must be considered independently.

[npm-inventory.json](docs/licenses/npm-inventory.json) records all 603 resolved
npm dependency entries with version, declared license and whether installed
metadata was read. The count includes optional/platform packages and is not a
count of shipped browser modules. Package metadata alone is not a full review of
file-level exceptions, bundled data or required notices.

For a distributable build, preserve the dependency license/copyright material,
the Angular-generated third-party license output and any required NOTICE files.
Review the actual bundle and selected runtime distribution. This overview does
not replace those files or claim the current inventory is a complete distribution
compliance check.

## Language tools are candidates

LanguageTool, Vale, CSpell, Hunspell, textlint and the dictionary examples have
not been installed or bundled by this update. Their source-backed license
research, resource distinctions and activation requirements are in
[language-tooling.md](docs/language-tooling.md).

The MIT license of a framework or checker does not automatically license its
dictionaries or rule packs. Unresolved data-license details remain explicit
before an artifact is selected for redistribution.
