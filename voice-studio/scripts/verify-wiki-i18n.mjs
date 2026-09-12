// Verify the real knowledge catalogue and service without a browser or server.
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import ts from 'typescript';

const source = name => readFileSync(new URL('../frontend/src/app/' + name, import.meta.url), 'utf8');
const compile = name => ts.transpileModule(source(name), { compilerOptions: {
  target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, experimentalDecorators: true,
} }).outputText;
const catalogueModule = { exports: {} };
vm.runInNewContext(compile('messages.wiki.ts'), { exports: catalogueModule.exports });
const { wikiMessages } = catalogueModule.exports;
const data = JSON.parse(readFileSync(new URL('../knowledge/rules.json', import.meta.url), 'utf8'));
const missing = [];
const technicalNames = new Set(['Vale', 'CSpell / cspell-lib', 'Hunspell', 'textlint']);
const inspect = (text, path) => {
  if (text && !Object.hasOwn(wikiMessages, text) && !technicalNames.has(text)) missing.push({ path, text });
};
inspect(data.overview, 'overview');
for (const entry of [...data.rules, ...data.articles]) {
  for (const key of ['title', 'summary', 'section', 'message', 'explanation', 'question', 'nextStep']) inspect(entry[key], `${entry.id}.${key}`);
  for (const key of ['paragraphs', 'steps', 'acceptable', 'limitations']) (entry[key] ?? []).forEach((text, index) => inspect(text, `${entry.id}.${key}.${index}`));
  (entry.examples ?? []).forEach((example, index) => inspect(example.why, `${entry.id}.examples.${index}.why`));
  (entry.tools ?? []).forEach((tool, index) => Object.entries(tool).forEach(([key, text]) => inspect(text, `${entry.id}.tools.${index}.${key}`)));
  (entry.sources ?? []).forEach((entrySource, index) => inspect(entrySource.title, `${entry.id}.sources.${index}.title`));
}
assert.deepEqual(missing, [], 'Every reader-facing knowledge field needs an English translation.');
for (const rule of data.rules) {
  const expected = [...rule.explanation.matchAll(/\{([^{}]+)\}/g)].map(match => match[0]);
  const translated = [...wikiMessages[rule.explanation].matchAll(/\{([^{}]+)\}/g)].map(match => match[0]);
  assert.deepEqual(translated, expected, `Explanation parameters preserved for ${rule.id}`);
}

let locale = 'en', fetches = 0;
const signal = initial => { let value = initial; const read = () => value; read.set = next => { value = next; }; return read; };
const core = { Injectable: () => value => value, signal, computed: fn => fn,
  inject: () => ({ t: text => locale === 'de' ? text : wikiMessages[text] ?? text }) };
const serviceModule = { exports: {} };
vm.runInNewContext(compile('knowledge.service.ts'), {
  exports: serviceModule.exports, require: id => id === '@angular/core' ? core : {}, URL,
  document: { baseURI: 'http://127.0.0.1:5188/' },
  fetch: async () => { fetches++; return { ok: true, json: async () => data }; },
});
const knowledge = new serviceModule.exports.KnowledgeService();
for (let index = 0; index < 8; index++) await Promise.resolve();
assert.equal(knowledge.entries().length, data.rules.length + data.articles.length);
assert.equal(knowledge.entry('review-basics').title, 'What a finding means');
for (const rule of data.rules) {
  const translated = knowledge.entry(rule.id);
  assert.equal(translated.pattern, rule.pattern);
  assert.equal(translated.category, rule.category);
  assert.equal(JSON.stringify(translated.related), JSON.stringify(rule.related));
  for (let index = 0; index < rule.examples.length; index++) {
    assert.equal(translated.examples[index].before, rule.examples[index].before, 'Original example quotes are never translated.');
    assert.equal(translated.examples[index].after, rule.examples[index].after, 'Example revisions keep their labelled source language.');
  }
}
locale = 'de';
assert.equal(knowledge.entry('review-basics').title, 'Was ein Hinweis bedeutet');
assert.equal(knowledge.entry('stock-wording').section, 'Regeln');
assert.equal(JSON.stringify(knowledge.data()), JSON.stringify(data), 'German restores the original versioned catalogue.');
locale = 'en';
assert.equal(knowledge.entry('stock-wording').section, 'Rules');
assert.equal(fetches, 1, 'Changing language uses the loaded catalogue without refetching or losing article identity.');
console.log(`Wiki i18n: ${data.rules.length} rules, ${data.articles.length} articles, ${Object.keys(wikiMessages).length} messages; no missing translations; source quotes and patterns preserved; EN/DE switching verified.`);
