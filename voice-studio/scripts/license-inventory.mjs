import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const lock = JSON.parse(await fs.readFile(path.join(root, 'package-lock.json'), 'utf8'));
const packages = [];
for (const [location, locked] of Object.entries(lock.packages)) {
  if (!location.includes('node_modules/') || locked.link) continue;
  const name = location.slice(location.lastIndexOf('node_modules/') + 'node_modules/'.length);
  let installed;
  try { installed = JSON.parse(await fs.readFile(path.join(root, location, 'package.json'), 'utf8')); } catch { /* Record missing installed metadata explicitly. */ }
  if (installed && installed.version !== locked.version) {
    throw new Error(`Installed package version mismatch at ${location}: lockfile ${locked.version}, installed ${installed.version ?? "unknown"}. Refusing to associate license metadata with another version.`);
  }
  const declared = installed?.license ?? locked.license ?? null;
  packages.push({
    packageLocation: location,
    name: installed?.name ?? name,
    version: locked.version,
    declaredLicense: typeof declared === 'string' ? declared : declared?.type ?? null,
    developmentOnly: !!locked.dev,
    installedMetadataRead: !!installed,
    source: 'package-lock.json' + (installed ? ' + installed package.json' : ''),
  });
}
packages.sort((a, b) => a.name.localeCompare(b.name) || a.version.localeCompare(b.version));
const report = {
  checkedAt: new Date().toISOString(),
  scope: 'npm dependency metadata; not a complete distribution license audit or SPDX conformance attestation',
  notes: [
    'Declared metadata does not replace each package license text, notices, bundled data or file-level exceptions.',
    'LanguageTool, Vale, CSpell, Hunspell and textlint are researched candidates and are not installed by this change.',
    'First-party @voice workspace packages are excluded; this inventory does not assign them a license.',
  ],
  packages,
};
await fs.mkdir(path.join(root, 'docs/licenses'), { recursive: true });
await fs.writeFile(path.join(root, 'docs/licenses/npm-inventory.json'), JSON.stringify(report, null, 2) + '\n');
const directNames = new Set(['@angular/common','@angular/compiler','@angular/core','@angular/forms','@angular/platform-browser','@angular/build','@angular/cli','@angular/compiler-cli','rxjs','tslib','typescript','esbuild','jsdom','@playwright/test','marked','ajv','ajv-formats']);
console.log(JSON.stringify({
  packages: packages.length,
  missingLicenseMetadata: packages.filter(item => !item.declaredLicense).map(item => ({name:item.name,version:item.version})),
  direct: packages.filter(item => directNames.has(item.name)),
}, null, 2));
