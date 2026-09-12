import { readFile, writeFile } from 'node:fs/promises';

// Keep public JSON exports inspectable without sharing their mutable import-cache
// values with the API. The generated module owns its data before the first call.
const output = new URL('./dist/index.js', import.meta.url);
let javascript = await readFile(output, 'utf8');
for (const [binding, filename] of [['catalogueData', 'catalogue.json'], ['patternData', 'surface-patterns.json']]) {
  const statement = `import ${binding} from './${filename}' with { type: 'json' };`;
  if (javascript.split(statement).length !== 2) {
    throw new Error(`Expected exactly one generated import for ${filename}; run TypeScript compilation first`);
  }
  const data = JSON.parse(await readFile(new URL(`./src/${filename}`, import.meta.url), 'utf8'));
  // JSON.parse preserves JSON object semantics, including any future keys named
  // __proto__. The nested serialization escapes the complete string literal.
  javascript = javascript.replace(statement, () => `const ${binding} = JSON.parse(${JSON.stringify(JSON.stringify(data))});`);
}
await writeFile(output, javascript);
