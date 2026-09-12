import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const reviewRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const contractsRoot = path.resolve(reviewRoot, '../contracts');

test('shipped declarations support TS/checkJs consumers and language-service completion', async () => {
  // Outside the workspace: package resolution cannot silently fall back to its source aliases.
  const consumer = await fsp.mkdtemp(path.join(os.tmpdir(), 'voice-types-consumer-'));
  try {
    await fsp.writeFile(path.join(consumer, 'package.json'), JSON.stringify({ name: 'voice-types-consumer', private: true, type: 'module' }));
    for (const [name, root] of [['review', reviewRoot], ['contracts', contractsRoot]]) {
      const target = path.join(consumer, 'node_modules', '@voice', name);
      const manifest = JSON.parse(await fsp.readFile(path.join(root, 'package.json'), 'utf8'));
      await fsp.mkdir(target, { recursive: true });
      await fsp.copyFile(path.join(root, 'package.json'), path.join(target, 'package.json'));
      for (const entry of manifest.files) await fsp.cp(path.join(root, entry), path.join(target, entry), { recursive: true });
    }
    const fixtures = ['typescript.ts', 'javascript.js', 'standalone.js', 'type-errors.ts', 'type-errors.js'];
    for (const name of fixtures) await fsp.copyFile(path.join(reviewRoot, 'examples', name), path.join(consumer, name));
    const files = fixtures.map(name => path.join(consumer, name));
    const options = {
      target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.NodeNext, moduleResolution: ts.ModuleResolutionKind.NodeNext,
      lib: ['lib.es2022.d.ts', 'lib.dom.d.ts', 'lib.dom.iterable.d.ts'],
      strict: true, allowJs: true, checkJs: true, noEmit: true, skipLibCheck: false, types: [],
    };
    const program = ts.createProgram(files, options);
    const diagnostics = ts.getPreEmitDiagnostics(program);
    const format = values => ts.formatDiagnostics(values, { getCanonicalFileName: value => value, getCurrentDirectory: () => consumer, getNewLine: () => '\n' });
    assert.equal(diagnostics.length, 0, format(diagnostics));
    assert(program.getSourceFiles().some(file => file.fileName.replaceAll('\\', '/').endsWith('/@voice/review/dist/review.d.ts')), 'Consumer must resolve the distributed declaration');
    assert(!program.getSourceFiles().some(file => file.fileName.replaceAll('\\', '/').endsWith('/@voice/review/src/review.ts')), 'Consumer must not use unpublished library source');

    // Bundler resolution is also the supported Angular/Vite-style consumer path.
    const bundler = ts.createProgram(files, { ...options, module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler });
    const bundlerDiagnostics = ts.getPreEmitDiagnostics(bundler);
    assert.equal(bundlerDiagnostics.length, 0, format(bundlerDiagnostics));

    const service = ts.createLanguageService({
      getScriptFileNames: () => files,
      getScriptVersion: () => '0',
      getScriptSnapshot: filename => fs.existsSync(filename) ? ts.ScriptSnapshot.fromString(fs.readFileSync(filename, 'utf8')) : undefined,
      getCurrentDirectory: () => consumer,
      getCompilationSettings: () => options,
      getDefaultLibFileName: values => ts.getDefaultLibFilePath(values),
      fileExists: fs.existsSync,
      readFile: filename => ts.sys.readFile(filename),
      readDirectory: ts.sys.readDirectory,
      directoryExists: ts.sys.directoryExists,
      getDirectories: ts.sys.getDirectories,
    });
    function position(name, needle, offset = 0) {
      const filename = path.join(consumer, name);
      const source = fs.readFileSync(filename, 'utf8');
      const index = source.indexOf(needle);
      assert(index >= 0, `Missing language-service probe ${name}: ${needle}`);
      return [filename, index + offset];
    }
    function complete(name, needle, offset, expected) {
      const [filename, at] = position(name, needle, offset);
      const entries = service.getCompletionsAtPosition(filename, at, {})?.entries.map(entry => entry.name) ?? [];
      for (const item of expected) assert(entries.includes(item), `${name} completion lacks ${item}: ${entries.join(', ')}`);
    }
    for (const name of ['typescript.ts', 'javascript.js']) {
      complete(name, 'controller.getDiagnostics', 'controller.'.length, ['update', 'selectFinding', 'getDiagnostics', 'dispose']);
      complete(name, 'selection.quote', 'selection.'.length, ['unitId', 'quote', 'start', 'end']);
      const [filename, at] = position(name, 'controller.dispose', 'controller.'.length);
      const quickInfo = service.getQuickInfoAtPosition(filename, at);
      assert.match(ts.displayPartsToString(quickInfo?.displayParts), /dispose\(\): void/, `${name} exposes a typed cleanup method`);
      assert.match(ts.displayPartsToString(quickInfo?.documentation), /Remove overlays, observers and listeners/, `${name} retains public method documentation`);
    }
    complete('standalone.js', 'VoiceReview.mountVoiceReview', 'VoiceReview.'.length, ['mountVoiceReview', 'connectVoiceStudio', 'createReviewClient', 'codePointOffsetToUtf16']);
    const [standaloneFile, standaloneAt] = position('standalone.js', 'VoiceReview.mountVoiceReview', 'VoiceReview.'.length);
    assert.match(ts.displayPartsToString(service.getQuickInfoAtPosition(standaloneFile, standaloneAt)?.displayParts), /VoiceReviewOptions/, 'Classic-script global resolves the same typed API');
    service.dispose();
  } finally {
    const absolute = path.resolve(consumer), temporary = path.resolve(os.tmpdir());
    const relative = path.relative(temporary, absolute);
    assert(relative && !relative.startsWith('..') && !path.isAbsolute(relative) && path.basename(absolute).startsWith('voice-types-consumer-'), 'Refuse cleanup outside the isolated temporary consumer');
    await fsp.rm(absolute, { recursive: true, force: true });
  }
});
