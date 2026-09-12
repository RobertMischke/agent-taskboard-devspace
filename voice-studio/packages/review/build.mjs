import { build } from 'esbuild';
import { copyFile } from 'node:fs/promises';
await copyFile('src/standalone.d.ts', 'dist/standalone.d.ts');
await build({ entryPoints: ['src/index.ts'], outfile: 'dist/voice-review.js', bundle: true, format: 'iife', globalName: 'VoiceReview', target: ['es2020'], sourcemap: true, minify: false });
