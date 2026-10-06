// Bundles src/index.js into single-file ESM builds (unminified + minified) for import maps / script tags.
import { build } from 'esbuild';
import fs from 'node:fs';
const banner = { js: '/*! jrs - a faster three.js-compatible WebGL2 engine. MIT License. Geometry and shader chunk sources ported from three.js (MIT, Copyright 2010-2026 three.js authors). */' };
fs.mkdirSync('build', { recursive: true });
await build({ entryPoints: ['src/index.js'], bundle: true, format: 'esm', outfile: 'build/jrs.module.js', banner, target: 'es2020', legalComments: 'none' });
await build({ entryPoints: ['src/index.js'], bundle: true, format: 'esm', outfile: 'build/jrs.module.min.js', banner, target: 'es2020', minify: true, legalComments: 'none' });
for (const f of ['build/jrs.module.js', 'build/jrs.module.min.js']) console.log(f, (fs.statSync(f).size / 1024).toFixed(0) + ' KB');
