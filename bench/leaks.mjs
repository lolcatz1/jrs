// Resource-lifetime check: cycles of (build a varied scene, render, dispose the three.js way, render empty)
// for jrs and three.js; prints a per-cycle table of info.memory, programs, live WebGL objects and JS heap.
//   node bench/leaks.mjs [--cycles=20] [--lib=three,jrs] [--json=path] [--context-loss]
// Exit code 1 when a jrs counter grows between cycle 5 and the last cycle (constant slack for the heap).
import fs from 'node:fs';
import { startServer } from './serve.mjs';
import { launchBrowser } from './browser.mjs';

const arg = (k, d) => { const a = process.argv.find((x) => x.startsWith(`--${k}=`)); return a ? a.split('=')[1] : d; };
const cycles = Number(arg('cycles', 20));
const libs = arg('lib', 'three,jrs').split(',');
const jsonOut = arg('json', '');
const HEAP_SLACK_KB = Number(arg('heapslack', 1024));

const { server, port } = await startServer();
const browser = await launchBrowser(['--js-flags=--expose-gc', '--enable-precise-memory-info']);
const results = {};
let failed = false;

for (const lib of libs) {
	const page = await browser.newPage();
	page.on('console', (m) => { if (m.type() === 'error') console.log(`[${lib}] [browser error]`, m.text()); });
	page.on('pageerror', (e) => console.log(`[${lib}] [pageerror]`, e.message));
	await page.goto(`http://127.0.0.1:${port}/bench/leaks.html`);
	await page.waitForFunction(() => window.ready === true);
	const rows = await page.evaluate(async ([lib, cycles]) => {
		const T = lib === 'jrs' ? await import('/src/index.js') : await import('/node_modules/three/build/three.module.js');
		const { runLeaks } = await import('/bench/leaks-case.js');
		return (await runLeaks(T, { cycles })).rows;
	}, [lib, cycles]);
	results[lib] = rows;
	await page.close();
	const keys = Object.keys(rows[0]).filter((k) => k !== 'cycle');
	console.log(`\n== ${lib}: ${cycles} cycles ==`);
	console.log(['cycle', ...keys].map((k) => String(k).padStart(8)).join(' '));
	for (const r of rows) console.log([r.cycle, ...keys.map((k) => r[k])].map((v) => String(v).padStart(8)).join(' '));
	// flatness: compare the last row to cycle 5 (warm-up allowed up to there)
	const ref = rows[Math.min(5, rows.length - 1)], last = rows[rows.length - 1];
	const bad = keys.filter((k) => (k === 'heapKB' ? last[k] - ref[k] > HEAP_SLACK_KB : last[k] > ref[k]));
	if (bad.length) { console.log(`${lib}: GROWING after cycle 5: ${bad.map((k) => `${k} ${ref[k]} -> ${last[k]}`).join(', ')}`); if (lib === 'jrs') failed = true; }
	else console.log(`${lib}: flat after cycle 5`);
	const base = rows[0];
	const unrecovered = keys.filter((k) => k !== 'heapKB' && last[k] > base[k]);
	if (unrecovered.length) console.log(`${lib}: above the empty baseline: ${unrecovered.map((k) => `${k} ${base[k]} -> ${last[k]}`).join(', ')}`);
}
// context loss / restore, renderer.dispose()
const ctx = {};
for (const lib of libs) {
	const page = await browser.newPage();
	page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('404')) console.log(`[${lib}] [browser error]`, m.text()); });
	page.on('pageerror', (e) => console.log(`[${lib}] [pageerror]`, e.message));
	await page.goto(`http://127.0.0.1:${port}/bench/leaks.html`);
	await page.waitForFunction(() => window.ready === true);
	const run = (fn) => page.evaluate(async ([lib, fn]) => {
		const T = lib === 'jrs' ? await import('/src/index.js') : await import('/node_modules/three/build/three.module.js');
		const L = await import('/bench/leaks-case.js');
		return L[fn](T);
	}, [lib, fn]);
	ctx[lib] = await run('runContextTests');
	console.log(`\n== ${lib}: context loss / renderer.dispose() ==`);
	console.log(JSON.stringify(ctx[lib], null, 1));
	const c = ctx[lib];
	if (lib === 'jrs') {
		const zero = (o) => Object.values(o).every((v) => v === 0);
		if (c.restorePixels.differing !== 0 || c.restorePixels3.differing !== 0) { console.log('jrs: restored context renders different pixels'); failed = true; }
		if (!zero(c.afterRendererDispose)) { console.log('jrs: renderer.dispose() left GL objects alive'); failed = true; }
		if (!String(c.renderWhileLost).startsWith('ok')) failed = true;
		if (typeof c.renderAfterDispose === 'string' || c.renderAfterDispose.differing !== 0) { console.log('jrs: rendering after dispose() differs'); failed = true; }
		if (!zero(c.afterSecondDispose)) { console.log('jrs: second renderer.dispose() left GL objects alive'); failed = true; }
		const nd = await page.evaluate(async () => { const T = await import('/src/index.js'); return (await import('/bench/leaks-case.js')).runNoDispose(T); });
		ctx.jrsNoDispose = nd;
		console.log('\n== jrs: materials / geometries dropped without dispose() (after gc) ==');
		const keys = Object.keys(nd[0]);
		console.log(keys.map((k) => k.padStart(12)).join(' '));
		for (const r of nd) console.log(keys.map((k) => String(r[k]).padStart(12)).join(' '));
		const a = nd[Math.min(3, nd.length - 1)], b = nd[nd.length - 1];
		// (GL object counts are informational here: the harness's own live-object sets keep the wrappers alive)
		for (const k of ['batchGroups', 'matSlots', 'programCache']) if (b[k] > a[k]) { console.log(`jrs: ${k} grows without dispose: ${a[k]} -> ${b[k]}`); failed = true; }
	}
	await page.close();
}
results.context = ctx;
if (jsonOut) fs.writeFileSync(jsonOut, JSON.stringify(results, null, 1));
await browser.close(); server.close();
process.exit(failed ? 1 : 0);
