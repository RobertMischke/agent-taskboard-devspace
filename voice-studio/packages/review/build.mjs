import { build } from 'esbuild';
await build({ entryPoints: ['src/index.ts'], outfile: 'dist/voice-review.js', bundle: true, format: 'iife', globalName: 'VoiceReview', target: ['es2020'], sourcemap: true, minify: false });
